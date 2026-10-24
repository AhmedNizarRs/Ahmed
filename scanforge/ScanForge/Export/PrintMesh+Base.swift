import Foundation

extension PrintMesh {
    /// Cuts off everything below `height` (Z-up) and closes the cut with a
    /// flat cap. This removes a turntable or a messy scanned bottom and gives
    /// the print a flat face to sit on the bed. Expects a welded mesh.
    func cutBelow(height: Float) -> PrintMesh {
        guard let b = bounds, height > b.min.z else { return self }
        guard height < b.max.z else { return PrintMesh(positions: [], triangles: []) }

        var newPositions = positions
        var kept: [SIMD3<UInt32>] = []
        kept.reserveCapacity(triangles.count)
        // One new vertex per cut mesh edge, shared by both triangles on that edge.
        var edgePoints: [UInt64: UInt32] = [:]
        // Cap boundary as directed segments, start -> end.
        var capNext: [UInt32: UInt32] = [:]

        func isAbove(_ i: UInt32) -> Bool { positions[Int(i)].z > height }

        func edgePoint(_ i: UInt32, _ j: UInt32) -> UInt32 {
            let key = UInt64(min(i, j)) << 32 | UInt64(max(i, j))
            if let existing = edgePoints[key] { return existing }
            let p = positions[Int(i)], q = positions[Int(j)]
            let t = (height - p.z) / (q.z - p.z)
            var point = p + (q - p) * t
            point.z = height
            let index = UInt32(newPositions.count)
            newPositions.append(point)
            edgePoints[key] = index
            return index
        }

        for t in triangles {
            let corners = [t.x, t.y, t.z]
            let above = corners.map(isAbove)
            switch above.filter({ $0 }).count {
            case 3:
                kept.append(t)
            case 1:
                let k = above.firstIndex(of: true)!
                let v0 = corners[k], v1 = corners[(k + 1) % 3], v2 = corners[(k + 2) % 3]
                let p01 = edgePoint(v0, v1), p02 = edgePoint(v0, v2)
                kept.append(SIMD3(v0, p01, p02))
                // The kept triangle walks the cut as p01 -> p02; the cap walks it the other way.
                capNext[p02] = p01
            case 2:
                let k = above.firstIndex(of: false)!
                let v2 = corners[k], v0 = corners[(k + 1) % 3], v1 = corners[(k + 2) % 3]
                let p12 = edgePoint(v1, v2), p20 = edgePoint(v2, v0)
                kept.append(SIMD3(v0, v1, p12))
                kept.append(SIMD3(v0, p12, p20))
                capNext[p20] = p12
            default:
                break
            }
        }

        let cap = PrintMesh.capTriangles(next: capNext, positions: newPositions)
        return PrintMesh(positions: newPositions, triangles: kept + cap).compacted()
    }

    /// Chains cap segments into loops and fills them, facing down (-Z).
    private static func capTriangles(next: [UInt32: UInt32], positions: [SIMD3<Float>]) -> [SIMD3<UInt32>] {
        var loops: [[UInt32]] = []
        var visited = Set<UInt32>()
        for start in next.keys where !visited.contains(start) {
            var loop: [UInt32] = []
            var current = start
            var closed = false
            while let following = next[current], !visited.contains(current) {
                visited.insert(current)
                loop.append(current)
                current = following
                if current == start { closed = true; break }
            }
            if closed, loop.count >= 3 { loops.append(loop) }
        }

        let polygon = Polygon2D(positions: positions)
        // Seen from above, the cap's outer loops run clockwise and its holes counter-clockwise.
        var outers: [(loop: [UInt32], area: Float)] = []
        var holes: [[UInt32]] = []
        for loop in loops {
            let area = polygon.signedArea(loop)
            if area < -1e-6 {
                outers.append((Array(loop.reversed()), -area))
            } else if area > 1e-6 {
                holes.append(Array(loop.reversed()))
            }
        }

        var holesByOuter = [[[UInt32]]](repeating: [], count: outers.count)
        for hole in holes {
            let probe = polygon.point(hole[0])
            let containing = outers.indices
                .filter { polygon.contains(probe, in: outers[$0].loop) }
                .min { outers[$0].area < outers[$1].area }
            if let containing { holesByOuter[containing].append(hole) }
        }

        var result: [SIMD3<UInt32>] = []
        for (index, outer) in outers.enumerated() {
            let merged = polygon.bridgeHoles(outer: outer.loop, holes: holesByOuter[index])
            // Ear clipping yields counter-clockwise (+Z) triangles; flip them to face down.
            result += polygon.earClip(merged).map { SIMD3($0.x, $0.z, $0.y) }
        }
        return result
    }
}

/// Polygon helpers working on the XY coordinates of mesh vertices.
private struct Polygon2D {
    let positions: [SIMD3<Float>]

    func point(_ i: UInt32) -> SIMD2<Float> {
        let p = positions[Int(i)]
        return SIMD2(p.x, p.y)
    }

    func signedArea(_ loop: [UInt32]) -> Float {
        var sum: Float = 0
        for k in loop.indices {
            let a = point(loop[k]), b = point(loop[(k + 1) % loop.count])
            sum += a.x * b.y - b.x * a.y
        }
        return sum / 2
    }

    func contains(_ q: SIMD2<Float>, in loop: [UInt32]) -> Bool {
        var inside = false
        var j = loop.count - 1
        for i in loop.indices {
            let a = point(loop[i]), b = point(loop[j])
            if (a.y > q.y) != (b.y > q.y), q.x < (b.x - a.x) * (q.y - a.y) / (b.y - a.y) + a.x {
                inside.toggle()
            }
            j = i
        }
        return inside
    }

    /// Joins holes (clockwise) into a counter-clockwise outer loop with
    /// zero-width bridges so the result can be ear clipped.
    func bridgeHoles(outer: [UInt32], holes: [[UInt32]]) -> [UInt32] {
        var merged = outer
        let ordered = holes.sorted { maxX($0) > maxX($1) }
        for (holeIndex, hole) in ordered.enumerated() {
            let m = hole.indices.max { point(hole[$0]).x < point(hole[$1]).x }!
            let mPoint = point(hole[m])
            let remainingHoles = Array(ordered[holeIndex...])
            let candidates = merged.indices.sorted {
                distanceSquared(point(merged[$0]), mPoint) < distanceSquared(point(merged[$1]), mPoint)
            }
            guard let c = candidates.first(where: { isVisible(from: mPoint, to: point(merged[$0]), loops: [merged] + remainingHoles) }) else {
                continue
            }
            let rotatedHole = Array(hole[m...] + hole[..<m])
            var next = Array(merged[...c])
            next += rotatedHole
            next.append(hole[m])
            next.append(merged[c])
            next += merged[(c + 1)...]
            merged = next
        }
        return merged
    }

    /// Triangulates a counter-clockwise simple polygon. Always terminates,
    /// even on slightly broken input.
    func earClip(_ polygon: [UInt32]) -> [SIMD3<UInt32>] {
        var ring = polygon
        var result: [SIMD3<UInt32>] = []
        result.reserveCapacity(max(0, ring.count - 2))
        var start = 0
        while ring.count > 3 {
            let n = ring.count
            var clipped = false
            for step in 0..<n {
                let k = (start + step) % n
                let a = ring[(k + n - 1) % n], b = ring[k], c = ring[(k + 1) % n]
                let pa = point(a), pb = point(b), pc = point(c)
                guard cross2(pb - pa, pc - pb) > 0 else { continue }
                var blocked = false
                for v in ring where v != a && v != b && v != c {
                    let pv = point(v)
                    if pv == pa || pv == pb || pv == pc { continue }
                    if pointInTriangle(pv, pa, pb, pc) { blocked = true; break }
                }
                if blocked { continue }
                result.append(SIMD3(a, b, c))
                ring.remove(at: k)
                start = k % ring.count
                clipped = true
                break
            }
            if !clipped {
                // Only degenerate (collinear or self-touching) vertices are left here.
                ring.remove(at: start % n)
            }
        }
        if ring.count == 3 {
            let pa = point(ring[0]), pb = point(ring[1]), pc = point(ring[2])
            if cross2(pb - pa, pc - pb) > 0 { result.append(SIMD3(ring[0], ring[1], ring[2])) }
        }
        return result
    }

    private func maxX(_ loop: [UInt32]) -> Float {
        loop.map { point($0).x }.max() ?? -.infinity
    }

    private func isVisible(from a: SIMD2<Float>, to b: SIMD2<Float>, loops: [[UInt32]]) -> Bool {
        for loop in loops {
            for k in loop.indices {
                let c = point(loop[k]), d = point(loop[(k + 1) % loop.count])
                if c == a || c == b || d == a || d == b { continue }
                if segmentsCross(a, b, c, d) { return false }
            }
        }
        return true
    }
}

private func cross2(_ a: SIMD2<Float>, _ b: SIMD2<Float>) -> Float { a.x * b.y - a.y * b.x }

private func distanceSquared(_ a: SIMD2<Float>, _ b: SIMD2<Float>) -> Float {
    let d = a - b
    return (d * d).sum()
}

private func pointInTriangle(_ p: SIMD2<Float>, _ a: SIMD2<Float>, _ b: SIMD2<Float>, _ c: SIMD2<Float>) -> Bool {
    cross2(b - a, p - a) >= 0 && cross2(c - b, p - b) >= 0 && cross2(a - c, p - c) >= 0
}

private func segmentsCross(_ a: SIMD2<Float>, _ b: SIMD2<Float>, _ c: SIMD2<Float>, _ d: SIMD2<Float>) -> Bool {
    let o1 = cross2(b - a, c - a), o2 = cross2(b - a, d - a)
    let o3 = cross2(d - c, a - c), o4 = cross2(d - c, b - c)
    return o1 * o2 < 0 && o3 * o4 < 0
}
