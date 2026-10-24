// Unit tests for the STL pipeline in ScanForge/Export/PrintMesh.swift.
// Run on a Mac:
//   swiftc -O ScanForge/Export/PrintMesh.swift Tests/main.swift -o /tmp/meshtests && /tmp/meshtests

import Foundation

var failures = 0

func check(_ condition: @autoclosure () -> Bool, _ message: String, line: Int = #line) {
    if condition() {
        print("  ok   \(message)")
    } else {
        failures += 1
        print("  FAIL \(message) (line \(line))")
    }
}

func close(_ a: Float, _ b: Float, _ tolerance: Float = 1e-4) -> Bool { abs(a - b) <= tolerance }

/// A cube from 0 to `size` built face by face with `n` × `n` quads per face.
/// Like a real scan it duplicates vertices along the face seams.
func gridCube(size: Float, n: Int, skipTopFace: Bool = false) -> PrintMesh {
    var positions: [SIMD3<Float>] = []
    var triangles: [SIMD3<UInt32>] = []
    // origin, u axis, v axis: u × v points outward
    let faces: [(SIMD3<Float>, SIMD3<Float>, SIMD3<Float>)] = [
        (SIMD3(0, 0, 0), SIMD3(0, 1, 0), SIMD3(1, 0, 0)), // bottom, -z
        (SIMD3(0, 0, 1), SIMD3(1, 0, 0), SIMD3(0, 1, 0)), // top, +z
        (SIMD3(0, 0, 0), SIMD3(1, 0, 0), SIMD3(0, 0, 1)), // front, -y
        (SIMD3(0, 1, 0), SIMD3(0, 0, 1), SIMD3(1, 0, 0)), // back, +y
        (SIMD3(0, 0, 0), SIMD3(0, 0, 1), SIMD3(0, 1, 0)), // left, -x
        (SIMD3(1, 0, 0), SIMD3(0, 1, 0), SIMD3(0, 0, 1)), // right, +x
    ]
    for (index, face) in faces.enumerated() {
        if skipTopFace && index == 1 { continue }
        let (origin, u, v) = face
        let base = UInt32(positions.count)
        for j in 0...n {
            for i in 0...n {
                let p = origin + u * (Float(i) / Float(n)) + v * (Float(j) / Float(n))
                positions.append(p * size)
            }
        }
        let row = UInt32(n + 1)
        for j in 0..<UInt32(n) {
            for i in 0..<UInt32(n) {
                let a = base + j * row + i
                let b = a + 1
                let c = a + row
                let d = c + 1
                triangles.append(SIMD3(a, b, d))
                triangles.append(SIMD3(a, d, c))
            }
        }
    }
    return PrintMesh(positions: positions, triangles: triangles)
}

func readSTL(_ data: Data) -> (count: Int, triangles: [[SIMD3<Float>]])? {
    guard data.count >= 84 else { return nil }
    let bytes = [UInt8](data)
    func u32(_ o: Int) -> UInt32 { UInt32(bytes[o]) | UInt32(bytes[o + 1]) << 8 | UInt32(bytes[o + 2]) << 16 | UInt32(bytes[o + 3]) << 24 }
    func f32(_ o: Int) -> Float { Float(bitPattern: u32(o)) }
    let count = Int(u32(80))
    guard data.count == 84 + count * 50 else { return nil }
    var triangles: [[SIMD3<Float>]] = []
    for t in 0..<count {
        let o = 84 + t * 50
        var vectors: [SIMD3<Float>] = []
        for k in 0..<4 {
            vectors.append(SIMD3(f32(o + k * 12), f32(o + k * 12 + 4), f32(o + k * 12 + 8)))
        }
        triangles.append(vectors)
    }
    return (count, triangles)
}

print("Welding and analysis")
do {
    let cube = gridCube(size: 1, n: 10)
    check(cube.triangles.count == 1200, "grid cube has 1200 triangles")
    let welded = cube.welded(tolerance: 1e-5)
    check(welded.positions.count == 6 * 11 * 11 - 12 * 11 + 8, "seams are welded (\(welded.positions.count) vertices)")
    let analysis = welded.analyze()
    check(analysis.isWatertight, "closed cube is watertight (open edges: \(analysis.openEdgeCount))")
    check(analysis.pieceCount == 1, "closed cube is one piece")
    check(analysis.triangleCount == 1200, "no triangles lost")

    let unwelded = cube.analyze()
    check(!unwelded.isWatertight, "unwelded cube reports open seams")
}

print("Open meshes")
do {
    let box = gridCube(size: 1, n: 10, skipTopFace: true).welded(tolerance: 1e-5)
    let analysis = box.analyze()
    check(analysis.openEdgeCount == 40, "open box has 40 open edges (got \(analysis.openEdgeCount))")
}

print("Floating debris")
do {
    var mesh = gridCube(size: 1, n: 10)
    // a tiny loose tetrahedron far away, like a speck picked up by the scan
    let base = UInt32(mesh.positions.count)
    mesh.positions += [SIMD3(5, 5, 5), SIMD3(5.01, 5, 5), SIMD3(5, 5.01, 5), SIMD3(5, 5, 5.01)]
    mesh.triangles += [SIMD3(base, base + 2, base + 1), SIMD3(base, base + 1, base + 3), SIMD3(base, base + 3, base + 2), SIMD3(base + 1, base + 2, base + 3)]
    let welded = mesh.welded(tolerance: 1e-5)
    check(welded.analyze().pieceCount == 2, "debris counted as a second piece")
    let cleaned = welded.removingSmallPieces(minimumShare: 0.05)
    check(cleaned.triangles.count == 1200, "debris removed, cube kept")
    check(cleaned.analyze().pieceCount == 1, "one piece left")
    check(close(cleaned.size.x, 1), "bounds no longer include debris")

    // Two equally big pieces must both survive.
    let second = gridCube(size: 1, n: 10).transformed { $0 + SIMD3(3, 0, 0) }
    let pair = PrintMesh(
        positions: cleaned.positions + second.positions,
        triangles: cleaned.triangles + second.triangles.map { $0 &+ UInt32(cleaned.positions.count) }
    ).welded(tolerance: 1e-5)
    check(pair.removingSmallPieces(minimumShare: 0.05).triangles.count == 2400, "two real pieces are both kept")
}

print("Broken input")
do {
    let mesh = PrintMesh(
        positions: [SIMD3(0, 0, 0), SIMD3(1, 0, 0), SIMD3(0, 1, 0), SIMD3(.nan, 0, 0), SIMD3(.infinity, 0, 0)],
        triangles: [SIMD3(0, 1, 2), SIMD3(0, 1, 3), SIMD3(0, 4, 2), SIMD3(0, 1, 99), SIMD3(0, 0, 1)]
    )
    let welded = mesh.welded(tolerance: 1e-5)
    check(welded.triangles.count == 1, "NaN, infinite, out-of-range and collapsed triangles are dropped")
    check(welded.positions.count == 3, "unused vertices are dropped")
    check(PrintMesh(positions: [], triangles: []).welded(tolerance: 1e-5).isEmpty, "empty mesh stays empty")
}

print("Orientation and placement")
do {
    let up = PrintMesh(positions: [SIMD3(0, 1, 0)], triangles: []).convertedFromYUpToZUp()
    check(up.positions[0] == SIMD3(0, 0, 1), "Y-up becomes Z-up")
    let forward = PrintMesh(positions: [SIMD3(0, 0, 1)], triangles: []).convertedFromYUpToZUp()
    check(forward.positions[0] == SIMD3(0, -1, 0), "rotation keeps handedness")

    // A Y-up cube in metres, offset in space, like an Object Capture model.
    let scan = gridCube(size: 0.05, n: 4).transformed { SIMD3($0.x + 0.3, $0.y - 0.2, $0.z + 1) }
    let prepared = scan.convertedFromYUpToZUp().scaled(by: 1000).welded(tolerance: 0.001).placedOnBed()
    let bounds = prepared.bounds!
    check(close(bounds.min.z, 0), "rests on the bed (min z = \(bounds.min.z))")
    check(close(bounds.min.x, -bounds.max.x), "centred on X")
    check(close(bounds.min.y, -bounds.max.y), "centred on Y")
    check(close(prepared.size.x, 50, 1e-3) && close(prepared.size.y, 50, 1e-3) && close(prepared.size.z, 50, 1e-3), "5 cm cube becomes 50 mm")
    check(prepared.analyze().isWatertight, "still watertight after transforms")
}

print("Binary STL")
do {
    let cube = gridCube(size: 20, n: 2).welded(tolerance: 1e-4).placedOnBed()
    let data = cube.binarySTL(scale: 1.5)
    check(data.count == 84 + cube.triangles.count * 50, "file size matches triangle count")
    check(!String(decoding: data.prefix(5), as: UTF8.self).lowercased().hasPrefix("solid"), "header doesn't start with 'solid'")
    let solidHeader = cube.binarySTL(header: "solid trap")
    check(!String(decoding: solidHeader.prefix(5), as: UTF8.self).hasPrefix("solid"), "a 'solid' header is replaced")

    if let parsed = readSTL(data) {
        check(parsed.count == cube.triangles.count, "triangle count round-trips")
        let first = cube.triangles[0]
        let expected = cube.positions[Int(first.x)] * 1.5
        check(parsed.triangles[0][1] == expected, "vertices are scaled and written in order")
        var maxZ: Float = 0
        var outward = 0
        for tri in parsed.triangles {
            let normal = tri[0]
            let centroid = (tri[1] + tri[2] + tri[3]) / 3
            let fromCentre = centroid - SIMD3(0, 0, 15)
            if (normal * fromCentre).sum() > 0 { outward += 1 }
            maxZ = max(maxZ, tri[1].z, tri[2].z, tri[3].z)
            check(close((normal * normal).sum(), 1), "normal is unit length")
        }
        check(outward == parsed.count, "all facet normals point outward (\(outward)/\(parsed.count))")
        check(close(maxZ, 30), "scaled height is 30 mm (got \(maxZ))")
    } else {
        check(false, "STL parses")
    }
}

print("Normals")
do {
    let tri = PrintMesh(positions: [SIMD3(0, 0, 0), SIMD3(1, 0, 0), SIMD3(0, 1, 0)], triangles: [SIMD3(0, 1, 2)])
    check(tri.vertexNormals().allSatisfy { $0 == SIMD3(0, 0, 1) }, "counter-clockwise triangle faces +Z")
    check(PrintMesh.faceNormal(SIMD3(0, 0, 0), SIMD3(0, 0, 0), SIMD3(1, 0, 0)) == .zero, "degenerate triangle gets a zero normal")
}

print("Performance")
do {
    let big = gridCube(size: 0.1, n: 130) // about 200k triangles, a typical scan
    let start = Date()
    let prepared = big.convertedFromYUpToZUp().scaled(by: 1000).welded(tolerance: 0.001).removingSmallPieces(minimumShare: 0.05).placedOnBed()
    _ = prepared.analyze()
    _ = prepared.binarySTL()
    let seconds = Date().timeIntervalSince(start)
    print("  prepared \(prepared.triangles.count) triangles in \(String(format: "%.2f", seconds)) s")
    check(seconds < 10, "a 200k-triangle scan prepares in under 10 s")
}

if failures > 0 {
    print("\n\(failures) check(s) failed")
    exit(1)
}
print("\nAll checks passed")
