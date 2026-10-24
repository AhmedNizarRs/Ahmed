import Foundation
import ModelIO
import simd

/// What the user can tweak before exporting an STL.
struct PrintSettings: Codable, Equatable, Hashable, Sendable {
    /// 1.0 prints the object at its real, scanned size.
    var scale: Double = 1.0
    var removeFloatingBits: Bool = true
}

/// A scan converted into a print-ready mesh at real size (scale 1.0).
struct PreparedPrint: Identifiable, Sendable {
    let id = UUID()
    let mesh: PrintMesh
    let analysis: PrintMesh.Analysis
}

enum PrintPreparationError: LocalizedError {
    case unreadableModel(String)
    case noGeometry

    var errorDescription: String? {
        switch self {
        case .unreadableModel(let reason): "The 3D model couldn't be opened (\(reason))."
        case .noGeometry: "The 3D model doesn't contain any printable surface. Try scanning again."
        }
    }
}

enum PrintPreparer {
    /// Object Capture models are in metres. Print meshes are in millimetres.
    static let metresToMillimetres: Float = 1000
    /// Pieces smaller than this share of the main piece count as scan debris.
    static let debrisShare: Float = 0.05

    /// Loads the reconstructed USDZ and turns it into a clean, Z-up mesh in
    /// millimetres sitting on the build plate. Runs for a second or two, so
    /// call it off the main thread.
    static func prepare(modelURL: URL, removeFloatingBits: Bool) throws -> PreparedPrint {
        var mesh = try loadMesh(from: modelURL)
            .convertedFromYUpToZUp()
            .scaled(by: metresToMillimetres)
            .welded(tolerance: 0.001)
        if removeFloatingBits {
            mesh = mesh.removingSmallPieces(minimumShare: debrisShare)
        }
        mesh = mesh.placedOnBed()
        guard !mesh.isEmpty else { throw PrintPreparationError.noGeometry }
        return PreparedPrint(mesh: mesh, analysis: mesh.analyze())
    }

    /// Writes an STL for `prepared` at the given scale.
    static func writeSTL(_ prepared: PreparedPrint, scale: Double, to url: URL) throws {
        try prepared.mesh.binarySTL(scale: Float(scale)).write(to: url, options: .atomic)
    }

    /// Reads every mesh in a USD/USDZ/OBJ file into one triangle soup, in
    /// the file's own units, with each mesh's scene transform applied.
    static func loadMesh(from url: URL) throws -> PrintMesh {
        var loadError: NSError?
        // preserveTopology: false makes Model I/O triangulate any polygons.
        let asset = MDLAsset(url: url, vertexDescriptor: nil, bufferAllocator: nil, preserveTopology: false, error: &loadError)
        if let loadError { throw PrintPreparationError.unreadableModel(loadError.localizedDescription) }

        let meshes = asset.childObjects(of: MDLMesh.self).compactMap { $0 as? MDLMesh }
        var positions: [SIMD3<Float>] = []
        var triangles: [SIMD3<UInt32>] = []

        for mesh in meshes {
            guard let attribute = mesh.vertexAttributeData(forAttributeNamed: MDLVertexAttributePosition, as: .float3) else { continue }
            let world = MDLTransform.globalTransform(with: mesh, atTime: 0)
            let base = UInt32(positions.count)
            let vertexCount = mesh.vertexCount
            positions.reserveCapacity(positions.count + vertexCount)

            for i in 0..<vertexCount {
                let offset = i * attribute.stride
                let x = attribute.dataStart.loadUnaligned(fromByteOffset: offset, as: Float.self)
                let y = attribute.dataStart.loadUnaligned(fromByteOffset: offset + 4, as: Float.self)
                let z = attribute.dataStart.loadUnaligned(fromByteOffset: offset + 8, as: Float.self)
                let p = world * SIMD4<Float>(x, y, z, 1)
                positions.append(SIMD3(p.x, p.y, p.z))
            }

            let submeshes = mesh.submeshes?.compactMap { $0 as? MDLSubmesh } ?? []
            for submesh in submeshes where submesh.geometryType == .triangles {
                let indexCount = submesh.indexCount
                guard indexCount >= 3 else { continue }
                let map = submesh.indexBuffer(asIndexType: .uInt32).map()
                let indices = map.bytes.bindMemory(to: UInt32.self, capacity: indexCount)
                for t in stride(from: 0, to: indexCount - 2, by: 3) {
                    let a = indices[t], b = indices[t + 1], c = indices[t + 2]
                    guard a < vertexCount, b < vertexCount, c < vertexCount else { continue }
                    triangles.append(SIMD3(base + a, base + b, base + c))
                }
            }
        }

        guard !triangles.isEmpty else { throw PrintPreparationError.noGeometry }
        return PrintMesh(positions: positions, triangles: triangles)
    }
}
