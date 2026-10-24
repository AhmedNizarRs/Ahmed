import Foundation

/// A plain triangle mesh used to turn a scan into a printable STL.
///
/// ScanForge keeps print meshes in millimetres, Z up, centred on the origin
/// and resting on the build plate at z = 0. This file only depends on
/// Foundation so it can be unit tested on its own (see `Tests/main.swift`).
struct PrintMesh: Sendable {
    var positions: [SIMD3<Float>]
    var triangles: [SIMD3<UInt32>]

    init(positions: [SIMD3<Float>], triangles: [SIMD3<UInt32>]) {
        self.positions = positions
        self.triangles = triangles
    }

    var isEmpty: Bool { triangles.isEmpty }

    /// Axis-aligned bounds of the vertices, or nil for an empty mesh.
    var bounds: (min: SIMD3<Float>, max: SIMD3<Float>)? {
        guard var lo = positions.first else { return nil }
        var hi = lo
        for p in positions {
            lo = pointwiseMin(lo, p)
            hi = pointwiseMax(hi, p)
        }
        return (lo, hi)
    }

    var size: SIMD3<Float> {
        guard let b = bounds else { return .zero }
        return b.max - b.min
    }

    // MARK: - Clean-up

    /// Merges vertices that sit within `tolerance` of each other and drops
    /// triangles that collapse or reference broken vertices (NaN, out of range).
    /// Scanned meshes duplicate vertices along texture seams, so welding is
    /// what lets us find connected pieces and open edges.
    /// The result only contains vertices used by a triangle.
    func welded(tolerance: Float) -> PrintMesh {
        let inverse = 1 / tolerance
        let limit: Float = 2_000_000_000
        var lookup: [SIMD3<Int32>: UInt32] = [:]
        lookup.reserveCapacity(positions.count)
        var cache = [UInt32](repeating: .max, count: positions.count)
        var newPositions: [SIMD3<Float>] = []
        newPositions.reserveCapacity(positions.count)
        var newTriangles: [SIMD3<UInt32>] = []
        newTriangles.reserveCapacity(triangles.count)

        func weldedIndex(_ original: UInt32) -> UInt32? {
            let i = Int(original)
            guard i < positions.count else { return nil }
            if cache[i] != .max { return cache[i] }
            let p = positions[i]
            let q = (p * inverse).rounded(.toNearestOrAwayFromZero)
            // Comparisons with NaN are false, so this also rejects NaN and infinity.
            guard abs(q.x) < limit, abs(q.y) < limit, abs(q.z) < limit else { return nil }
            let key = SIMD3<Int32>(Int32(q.x), Int32(q.y), Int32(q.z))
            let index: UInt32
            if let existing = lookup[key] {
                index = existing
            } else {
                index = UInt32(newPositions.count)
                newPositions.append(p)
                lookup[key] = index
            }
            cache[i] = index
            return index
        }

        for t in triangles {
            guard let a = weldedIndex(t.x), let b = weldedIndex(t.y), let c = weldedIndex(t.z) else { continue }
            guard a != b, b != c, a != c else { continue }
            newTriangles.append(SIMD3(a, b, c))
        }
        return PrintMesh(positions: newPositions, triangles: newTriangles)
    }

    /// Removes loose pieces (floating scan debris, bits of the table) whose
    /// triangle count is below `minimumShare` of the biggest piece.
    /// Expects a welded mesh.
    func removingSmallPieces(minimumShare: Float) -> PrintMesh {
        let roots = pieceRoots()
        var counts: [UInt32: Int] = [:]
        for r in roots { counts[r, default: 0] += 1 }
        let largest = counts.values.max() ?? 0
        let threshold = max(1, Int((Float(largest) * minimumShare).rounded(.up)))
        var kept: [SIMD3<UInt32>] = []
        kept.reserveCapacity(triangles.count)
        for (t, r) in zip(triangles, roots) where counts[r, default: 0] >= threshold {
            kept.append(t)
        }
        return PrintMesh(positions: positions, triangles: kept).compacted()
    }

    /// Drops vertices no triangle uses.
    func compacted() -> PrintMesh {
        var remap = [UInt32](repeating: .max, count: positions.count)
        var newPositions: [SIMD3<Float>] = []
        var newTriangles: [SIMD3<UInt32>] = []
        newTriangles.reserveCapacity(triangles.count)

        func mapped(_ i: UInt32) -> UInt32 {
            if remap[Int(i)] == .max {
                remap[Int(i)] = UInt32(newPositions.count)
                newPositions.append(positions[Int(i)])
            }
            return remap[Int(i)]
        }

        for t in triangles {
            newTriangles.append(SIMD3(mapped(t.x), mapped(t.y), mapped(t.z)))
        }
        return PrintMesh(positions: newPositions, triangles: newTriangles)
    }

    // MARK: - Placement

    func transformed(_ transform: (SIMD3<Float>) -> SIMD3<Float>) -> PrintMesh {
        PrintMesh(positions: positions.map(transform), triangles: triangles)
    }

    /// Scans come out Y-up (USD); slicers expect Z-up.
    func convertedFromYUpToZUp() -> PrintMesh {
        transformed { SIMD3($0.x, -$0.z, $0.y) }
    }

    func scaled(by factor: Float) -> PrintMesh {
        transformed { $0 * factor }
    }

    /// Centres the mesh on X/Y and sets its lowest point on z = 0.
    func placedOnBed() -> PrintMesh {
        guard let b = bounds else { return self }
        let offset = SIMD3<Float>(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -b.min.z)
        return transformed { $0 + offset }
    }

    // MARK: - Analysis

    struct Analysis: Sendable {
        var triangleCount: Int
        var pieceCount: Int
        /// Edges used by only one triangle. Zero means the mesh is closed (watertight).
        var openEdgeCount: Int
        var size: SIMD3<Float>

        var isWatertight: Bool { openEdgeCount == 0 }
    }

    /// Expects a welded mesh.
    func analyze() -> Analysis {
        var edges: [UInt64: Int32] = [:]
        edges.reserveCapacity(triangles.count * 2)

        func addEdge(_ a: UInt32, _ b: UInt32) {
            let key = UInt64(min(a, b)) << 32 | UInt64(max(a, b))
            edges[key, default: 0] += 1
        }

        for t in triangles {
            addEdge(t.x, t.y)
            addEdge(t.y, t.z)
            addEdge(t.z, t.x)
        }
        let openEdges = edges.values.reduce(0) { $0 + ($1 == 1 ? 1 : 0) }
        let pieces = Set(pieceRoots()).count
        return Analysis(triangleCount: triangles.count, pieceCount: pieces, openEdgeCount: openEdges, size: size)
    }

    /// For each triangle, the id of the connected piece it belongs to.
    private func pieceRoots() -> [UInt32] {
        var parent = Array(0..<UInt32(positions.count))

        func find(_ start: UInt32) -> UInt32 {
            var x = start
            while parent[Int(x)] != x {
                parent[Int(x)] = parent[Int(parent[Int(x)])]
                x = parent[Int(x)]
            }
            return x
        }

        func union(_ a: UInt32, _ b: UInt32) {
            let ra = find(a), rb = find(b)
            if ra != rb { parent[Int(ra)] = rb }
        }

        for t in triangles {
            union(t.x, t.y)
            union(t.y, t.z)
        }
        return triangles.map { find($0.x) }
    }

    // MARK: - Normals and export

    static func faceNormal(_ a: SIMD3<Float>, _ b: SIMD3<Float>, _ c: SIMD3<Float>) -> SIMD3<Float> {
        unitVector(crossProduct(b - a, c - a))
    }

    /// Smooth per-vertex normals (area weighted), used for the on-screen preview.
    func vertexNormals() -> [SIMD3<Float>] {
        var normals = [SIMD3<Float>](repeating: .zero, count: positions.count)
        for t in triangles {
            let a = positions[Int(t.x)], b = positions[Int(t.y)], c = positions[Int(t.z)]
            let n = crossProduct(b - a, c - a)
            normals[Int(t.x)] += n
            normals[Int(t.y)] += n
            normals[Int(t.z)] += n
        }
        return normals.map { unitVector($0) }
    }

    /// Binary STL, little endian. Coordinates are multiplied by `scale`.
    func binarySTL(scale: Float = 1, header: String = "ScanForge STL export, units: mm") -> Data {
        let count = triangles.count
        var bytes = [UInt8](repeating: 0, count: 84 + count * 50)
        // A header that starts with "solid" makes some tools read the file as ASCII STL.
        var headerBytes = Array(header.utf8.prefix(80))
        if headerBytes.starts(with: Array("solid".utf8)) { headerBytes = Array("ScanForge".utf8) }

        bytes.withUnsafeMutableBytes { raw in
            for (i, byte) in headerBytes.enumerated() { raw[i] = byte }
            raw.storeBytes(of: UInt32(count).littleEndian, toByteOffset: 80, as: UInt32.self)

            var offset = 84
            func write(_ v: SIMD3<Float>) {
                raw.storeBytes(of: v.x.bitPattern.littleEndian, toByteOffset: offset, as: UInt32.self)
                raw.storeBytes(of: v.y.bitPattern.littleEndian, toByteOffset: offset + 4, as: UInt32.self)
                raw.storeBytes(of: v.z.bitPattern.littleEndian, toByteOffset: offset + 8, as: UInt32.self)
                offset += 12
            }

            for t in triangles {
                let a = positions[Int(t.x)] * scale
                let b = positions[Int(t.y)] * scale
                let c = positions[Int(t.z)] * scale
                write(PrintMesh.faceNormal(a, b, c))
                write(a)
                write(b)
                write(c)
                offset += 2 // attribute byte count, left at zero
            }
        }
        return Data(bytes)
    }
}

// MARK: - Vector helpers

fileprivate func crossProduct(_ a: SIMD3<Float>, _ b: SIMD3<Float>) -> SIMD3<Float> {
    SIMD3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)
}

fileprivate func unitVector(_ v: SIMD3<Float>) -> SIMD3<Float> {
    let length = (v * v).sum().squareRoot()
    guard length > 0, length.isFinite else { return .zero }
    return v / length
}
