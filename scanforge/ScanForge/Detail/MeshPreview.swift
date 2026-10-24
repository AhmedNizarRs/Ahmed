import SceneKit
import SwiftUI

/// Interactive grey preview of the exact mesh that goes into the STL,
/// standing on a disc that stands in for the build plate.
struct MeshPreview: UIViewRepresentable {
    let prepared: PreparedPrint

    final class Coordinator {
        var shownID: UUID?
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> SCNView {
        let view = SCNView()
        view.allowsCameraControl = true
        view.autoenablesDefaultLighting = true
        view.antialiasingMode = .multisampling4X
        view.backgroundColor = .secondarySystemBackground
        show(prepared, in: view, context: context)
        return view
    }

    func updateUIView(_ view: SCNView, context: Context) {
        if context.coordinator.shownID != prepared.id {
            show(prepared, in: view, context: context)
        }
    }

    private func show(_ prepared: PreparedPrint, in view: SCNView, context: Context) {
        context.coordinator.shownID = prepared.id
        let mesh = prepared.mesh
        let scene = SCNScene()

        // The print mesh is Z-up; SceneKit is Y-up.
        let modelNode = SCNNode(geometry: Self.geometry(for: mesh))
        modelNode.eulerAngles.x = -.pi / 2
        scene.rootNode.addChildNode(modelNode)

        let size = mesh.size
        let extent = max(size.x, size.y, size.z, 1)

        let plate = SCNCylinder(radius: CGFloat(max(size.x, size.y) * 0.75 + extent * 0.1), height: CGFloat(extent * 0.01))
        plate.firstMaterial?.diffuse.contents = UIColor.systemGray4
        let plateNode = SCNNode(geometry: plate)
        plateNode.position.y = -extent * 0.005
        scene.rootNode.addChildNode(plateNode)

        let center = SCNVector3(0, size.z / 2, 0)
        let camera = SCNCamera()
        camera.zNear = Double(extent) * 0.01
        camera.zFar = Double(extent) * 100
        let cameraNode = SCNNode()
        cameraNode.camera = camera
        cameraNode.position = SCNVector3(extent * 1.1, size.z / 2 + extent * 0.9, extent * 1.6)
        cameraNode.look(at: center)
        scene.rootNode.addChildNode(cameraNode)

        view.scene = scene
        view.pointOfView = cameraNode
        view.defaultCameraController.target = center
    }

    private static func geometry(for mesh: PrintMesh) -> SCNGeometry {
        let stride = MemoryLayout<SIMD3<Float>>.stride
        let normals = mesh.vertexNormals()
        let vertexData = mesh.positions.withUnsafeBytes { Data($0) }
        let normalData = normals.withUnsafeBytes { Data($0) }

        let vertexSource = SCNGeometrySource(
            data: vertexData, semantic: .vertex, vectorCount: mesh.positions.count,
            usesFloatComponents: true, componentsPerVector: 3, bytesPerComponent: 4,
            dataOffset: 0, dataStride: stride
        )
        let normalSource = SCNGeometrySource(
            data: normalData, semantic: .normal, vectorCount: normals.count,
            usesFloatComponents: true, componentsPerVector: 3, bytesPerComponent: 4,
            dataOffset: 0, dataStride: stride
        )

        var indices: [UInt32] = []
        indices.reserveCapacity(mesh.triangles.count * 3)
        for t in mesh.triangles {
            indices.append(t.x)
            indices.append(t.y)
            indices.append(t.z)
        }
        let element = SCNGeometryElement(
            data: indices.withUnsafeBytes { Data($0) }, primitiveType: .triangles,
            primitiveCount: mesh.triangles.count, bytesPerIndex: 4
        )

        let geometry = SCNGeometry(sources: [vertexSource, normalSource], elements: [element])
        let material = SCNMaterial()
        material.diffuse.contents = UIColor(white: 0.85, alpha: 1)
        material.specular.contents = UIColor(white: 0.25, alpha: 1)
        material.isDoubleSided = true
        geometry.materials = [material]
        return geometry
    }
}
