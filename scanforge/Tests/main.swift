// Unit tests for the STL pipeline in ScanForge/Export/PrintMesh.swift.
// Run on a Mac:
//   swiftc -O ScanForge/Export/PrintMesh.swift ScanForge/Export/PrintMesh+Base.swift ScanForge/Turntable/TurntableMath.swift Tests/main.swift -o /tmp/meshtests && /tmp/meshtests

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

/// Adds a quad facing `outward` (winding is picked automatically).
func addQuad(_ mesh: inout PrintMesh, _ q: [SIMD3<Float>], outward: SIMD3<Float>) {
    let base = UInt32(mesh.positions.count)
    let e1 = q[1] - q[0], e2 = q[2] - q[0]
    let n = SIMD3(e1.y * e2.z - e1.z * e2.y, e1.z * e2.x - e1.x * e2.z, e1.x * e2.y - e1.y * e2.x)
    mesh.positions += (n * outward).sum() >= 0 ? q : q.reversed()
    mesh.triangles += [SIMD3(base, base + 1, base + 2), SIMD3(base, base + 2, base + 3)]
}

/// A closed 20 x 20 x 20 block with a 10 x 10 square hole straight through it.
func squareTube() -> PrintMesh {
    var m = PrintMesh(positions: [], triangles: [])
    let cuts: [Float] = [0, 5, 15, 20]
    for z: Float in [0, 20] {
        let up: SIMD3<Float> = z == 0 ? SIMD3(0, 0, -1) : SIMD3(0, 0, 1)
        for i in 0..<3 {
            for j in 0..<3 where !(i == 1 && j == 1) {
                let x0 = cuts[i], x1 = cuts[i + 1], y0 = cuts[j], y1 = cuts[j + 1]
                addQuad(&m, [SIMD3(x0, y0, z), SIMD3(x1, y0, z), SIMD3(x1, y1, z), SIMD3(x0, y1, z)], outward: up)
            }
        }
    }
    for i in 0..<3 {
        let a = cuts[i], b = cuts[i + 1]
        addQuad(&m, [SIMD3(a, 0, 0), SIMD3(b, 0, 0), SIMD3(b, 0, 20), SIMD3(a, 0, 20)], outward: SIMD3(0, -1, 0))
        addQuad(&m, [SIMD3(a, 20, 0), SIMD3(b, 20, 0), SIMD3(b, 20, 20), SIMD3(a, 20, 20)], outward: SIMD3(0, 1, 0))
        addQuad(&m, [SIMD3(0, a, 0), SIMD3(0, b, 0), SIMD3(0, b, 20), SIMD3(0, a, 20)], outward: SIMD3(-1, 0, 0))
        addQuad(&m, [SIMD3(20, a, 0), SIMD3(20, b, 0), SIMD3(20, b, 20), SIMD3(20, a, 20)], outward: SIMD3(1, 0, 0))
    }
    // Hole walls face into the hole.
    addQuad(&m, [SIMD3(5, 5, 0), SIMD3(15, 5, 0), SIMD3(15, 5, 20), SIMD3(5, 5, 20)], outward: SIMD3(0, 1, 0))
    addQuad(&m, [SIMD3(5, 15, 0), SIMD3(15, 15, 0), SIMD3(15, 15, 20), SIMD3(5, 15, 20)], outward: SIMD3(0, -1, 0))
    addQuad(&m, [SIMD3(5, 5, 0), SIMD3(5, 15, 0), SIMD3(5, 15, 20), SIMD3(5, 5, 20)], outward: SIMD3(1, 0, 0))
    addQuad(&m, [SIMD3(15, 5, 0), SIMD3(15, 15, 0), SIMD3(15, 15, 20), SIMD3(15, 5, 20)], outward: SIMD3(-1, 0, 0))
    return m.welded(tolerance: 1e-4)
}

print("Volume")
do {
    let cube = gridCube(size: 20, n: 4).welded(tolerance: 1e-4)
    check(close(cube.volume(), 8000, 0.5), "20 mm cube is 8000 mm³ (got \(cube.volume()))")
    let tube = squareTube()
    check(tube.analyze().isWatertight, "square tube test shape is watertight (open edges: \(tube.analyze().openEdgeCount))")
    check(close(tube.volume(), 6000, 0.5), "square tube is 6000 mm³ (got \(tube.volume()))")
}

print("Flat base cut")
do {
    let cube = gridCube(size: 20, n: 4).welded(tolerance: 1e-4)
    let cut = cube.cutBelow(height: 5.3).welded(tolerance: 1e-4)
    let analysis = cut.analyze()
    check(analysis.isWatertight, "cut cube is closed again (open edges: \(analysis.openEdgeCount))")
    check(close(cut.bounds!.min.z, 5.3), "nothing left below the cut")
    check(close(cut.volume(), 20 * 20 * 14.7, 0.5), "cut cube volume is right (got \(cut.volume()))")
    let capDown = cut.triangles.filter { t in
        let a = cut.positions[Int(t.x)], b = cut.positions[Int(t.y)], c = cut.positions[Int(t.z)]
        return close(a.z, 5.3) && close(b.z, 5.3) && close(c.z, 5.3)
    }
    check(!capDown.isEmpty && capDown.allSatisfy { t in
        PrintMesh.faceNormal(cut.positions[Int(t.x)], cut.positions[Int(t.y)], cut.positions[Int(t.z)]).z < -0.99
    }, "cap faces down onto the bed (\(capDown.count) cap triangles)")

    let tube = squareTube().cutBelow(height: 4).welded(tolerance: 1e-4)
    check(tube.analyze().isWatertight, "cut tube is closed, cap keeps its hole (open edges: \(tube.analyze().openEdgeCount))")
    check(close(tube.volume(), 16 * 300, 0.5), "cut tube volume is right, hole not filled (got \(tube.volume()))")

    check(cube.cutBelow(height: -1).triangles.count == cube.triangles.count, "cut below the mesh changes nothing")
    check(cube.cutBelow(height: 25).isEmpty, "cut above the mesh leaves nothing")

    // A rotated, finely tessellated cube is closer to a real scan: many cut edges and slanted faces.
    let angle: Float = 0.6
    let tilted = gridCube(size: 30, n: 24)
        .transformed { p in
            let c = p - SIMD3(15, 15, 15)
            let y = c.y * cos(angle) - c.z * sin(angle), z = c.y * sin(angle) + c.z * cos(angle)
            let x = c.x * cos(angle) - y * sin(angle), y2 = c.x * sin(angle) + y * cos(angle)
            return SIMD3(x, y2, z)
        }
        .welded(tolerance: 1e-4)
    let tiltedCut = tilted.cutBelow(height: -3.7).welded(tolerance: 1e-4)
    let tiltedAnalysis = tiltedCut.analyze()
    check(tiltedAnalysis.isWatertight, "tilted cube cut is closed (open edges: \(tiltedAnalysis.openEdgeCount))")
    check(tiltedAnalysis.pieceCount == 1, "tilted cube cut is one piece")
    check(tiltedCut.volume() > 0 && tiltedCut.volume() < tilted.volume(), "cut removes volume but keeps it positive")
}

print("Turntable depth mask")
do {
    // 40 x 30 depth map: wall at 1.2 m, a 10 x 10 object at 0.35 m in the middle, one missing reading on it.
    let w = 40, h = 30
    var depth = [Float](repeating: 1.2, count: w * h)
    for y in 10..<20 { for x in 15..<25 { depth[y * w + x] = 0.35 } }
    depth[15 * w + 20] = 0
    let region = NormalizedRect(x: 0.25, y: 0.2, width: 0.5, height: 0.6)

    check(DepthMask.centerDepth(depth: depth, width: w, height: h, region: region) == 0.35, "centre depth finds the object")
    let suggested = DepthMask.suggestedSettings(depth: depth, width: w, height: h, region: region, focalLength: 30)!
    check(suggested.near < 0.35 && suggested.far > 0.35 && suggested.far < 1.2, "suggested range holds the object but not the wall (\(suggested.near)...\(suggested.far))")

    let mask = DepthMask.make(depth: depth, width: w, height: h, settings: suggested, grow: 0)
    check(mask[15 * w + 18] == 255, "object pixels are kept")
    check(mask[15 * w + 20] == 255, "pixels with no LiDAR reading inside the frame are kept")
    check(mask[12 * w + 12] == 0, "wall inside the frame is masked out")
    check(mask[2 * w + 2] == 0, "everything outside the frame is masked out")
    check(mask.filter { $0 == 255 }.count == 100, "mask is exactly the object (got \(mask.filter { $0 == 255 }.count))")

    let grown = DepthMask.make(depth: depth, width: w, height: h, settings: suggested, grow: 2)
    check(grown[15 * w + 13] == 255 && grown[15 * w + 12] == 0, "growing widens the mask by 2 pixels")
    check(grown[2 * w + 2] == 0, "growing stays inside the frame")
}

print("Stillness detector")
do {
    var detector = StillnessDetector()
    let a = [Float](repeating: 100, count: 64)
    let b = (0..<64).map { Float($0 % 2 == 0 ? 130 : 70) }
    var shots = 0
    // Held still at the start: one photo.
    for _ in 0..<20 { if detector.feed(a) { shots += 1 } }
    check(shots == 1, "takes one photo once the scene is still (got \(shots))")
    // Still longer: no duplicates.
    for _ in 0..<40 { if detector.feed(a) { shots += 1 } }
    check(shots == 1, "no duplicate photos while nothing moves")
    // Turned: a blur of frames, then a new still view.
    for i in 0..<6 { _ = detector.feed(i % 2 == 0 ? b : a) }
    for _ in 0..<20 { if detector.feed(b) { shots += 1 } }
    check(shots == 2, "takes a new photo after the object is turned and stops (got \(shots))")
    // A hand passes through but the object ends where it was: no duplicate.
    for i in 0..<6 { _ = detector.feed(i % 2 == 0 ? a : b) }
    for _ in 0..<20 { if detector.feed(b) { shots += 1 } }
    check(shots == 2, "no photo when the view ends up unchanged")
    // Sensor noise doesn't count as movement.
    var noisy = detector
    let noise = b.enumerated().map { $0.element + ($0.offset % 3 == 0 ? 0.8 : -0.4) }
    var noiseShots = 0
    for i in 0..<60 { if noisy.feed(i % 2 == 0 ? b : noise) { noiseShots += 1 } }
    check(noiseShots == 0, "camera noise doesn't trigger photos")
}

print("Raw grid files")
do {
    let floats: [Float] = [0.25, 1.5, .nan, 3]
    let decoded = RawGrid.decodeFloats(RawGrid.encode(floats, width: 2, height: 2))!
    check(decoded.width == 2 && decoded.height == 2 && decoded.values[0] == 0.25 && decoded.values[3] == 3 && decoded.values[2].isNaN, "depth round-trips")
    let bytes: [UInt8] = [0, 255, 255, 0, 7, 9]
    let decodedBytes = RawGrid.decodeBytes(RawGrid.encode(bytes, width: 3, height: 2))!
    check(decodedBytes.values == bytes && decodedBytes.width == 3, "mask round-trips")
    check(RawGrid.decodeFloats(Data([1, 2, 3])) == nil, "truncated file is rejected")
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
