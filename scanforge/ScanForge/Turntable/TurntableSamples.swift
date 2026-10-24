import CoreImage
import CoreMotion
import CoreVideo
import Foundation
import RealityKit

/// Turns a saved turntable capture into PhotogrammetrySamples: each photo
/// with its LiDAR depth map, its LiDAR background mask and gravity.
/// Samples are made one at a time as the reconstruction asks for them, so
/// only a few full-size images are in memory at once.
struct TurntableSamples: Sequence {
    let folders: TurntableFolders
    /// When false, masks are left out and Apple's own object masking decides.
    var useMasks = true

    static func shotCount(in folders: TurntableFolders) -> Int {
        log(in: folders)?.shots.count ?? 0
    }

    private static func log(in folders: TurntableFolders) -> TurntableCaptureLog? {
        guard let data = try? Data(contentsOf: folders.log) else { return nil }
        return try? JSONDecoder().decode(TurntableCaptureLog.self, from: data)
    }

    func makeIterator() -> AnyIterator<PhotogrammetrySample> {
        let shots = Self.log(in: folders)?.shots ?? []
        let context = CIContext(options: [.cacheIntermediates: false])
        var index = 0
        return AnyIterator {
            while index < shots.count {
                let shot = shots[index]
                index += 1
                if let sample = makeSample(id: index, shot: shot, context: context) { return sample }
            }
            return nil
        }
    }

    private func makeSample(id: Int, shot: TurntableShot, context: CIContext) -> PhotogrammetrySample? {
        let imageURL = folders.images.appendingPathComponent("\(shot.name).HEIC")
        // Pixels stay in sensor orientation, matching the depth map and mask.
        guard let image = CIImage(contentsOf: imageURL),
              let pixels = Self.makeBuffer(width: Int(image.extent.width), height: Int(image.extent.height), format: kCVPixelFormatType_32BGRA)
        else { return nil }
        context.render(image, to: pixels, bounds: image.extent, colorSpace: CGColorSpace(name: CGColorSpace.sRGB))

        var sample = PhotogrammetrySample(id: id, image: pixels)

        if let data = try? Data(contentsOf: folders.depth.appendingPathComponent("\(shot.name).depth")),
           let depth = RawGrid.decodeFloats(data) {
            sample.depthDataMap = Self.depthBuffer(depth.values, width: depth.width, height: depth.height)
        }
        if useMasks,
           let data = try? Data(contentsOf: folders.masks.appendingPathComponent("\(shot.name).mask")),
           let mask = RawGrid.decodeBytes(data) {
            sample.objectMask = Self.maskBuffer(mask.values, width: mask.width, height: mask.height,
                                                outputWidth: CVPixelBufferGetWidth(pixels), outputHeight: CVPixelBufferGetHeight(pixels))
        }
        if let g = shot.gravity, g.count == 3 {
            sample.gravity = CMAcceleration(x: g[0], y: g[1], z: g[2])
        }
        return sample
    }

    private static func makeBuffer(width: Int, height: Int, format: OSType) -> CVPixelBuffer? {
        var buffer: CVPixelBuffer?
        let attributes = [kCVPixelBufferIOSurfacePropertiesKey: [:] as CFDictionary] as CFDictionary
        CVPixelBufferCreate(kCFAllocatorDefault, width, height, format, attributes, &buffer)
        return buffer
    }

    private static func depthBuffer(_ values: [Float], width: Int, height: Int) -> CVPixelBuffer? {
        guard let buffer = makeBuffer(width: width, height: height, format: kCVPixelFormatType_DepthFloat32) else { return nil }
        CVPixelBufferLockBaseAddress(buffer, [])
        defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
        guard let base = CVPixelBufferGetBaseAddress(buffer) else { return nil }
        let rowBytes = CVPixelBufferGetBytesPerRow(buffer)
        values.withUnsafeBufferPointer { source in
            for y in 0..<height {
                let row = base.advanced(by: y * rowBytes).assumingMemoryBound(to: Float32.self)
                for x in 0..<width { row[x] = source[y * width + x] }
            }
        }
        return buffer
    }

    /// Scales the depth-sized mask up to the photo's size (nearest neighbour).
    private static func maskBuffer(_ values: [UInt8], width: Int, height: Int, outputWidth: Int, outputHeight: Int) -> CVPixelBuffer? {
        guard let buffer = makeBuffer(width: outputWidth, height: outputHeight, format: kCVPixelFormatType_OneComponent8) else { return nil }
        CVPixelBufferLockBaseAddress(buffer, [])
        defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
        guard let base = CVPixelBufferGetBaseAddress(buffer) else { return nil }
        let rowBytes = CVPixelBufferGetBytesPerRow(buffer)
        var columnMap = [Int](repeating: 0, count: outputWidth)
        for x in 0..<outputWidth {
            let scaled: Int = x * width / outputWidth
            columnMap[x] = min(width - 1, scaled)
        }
        values.withUnsafeBufferPointer { source in
            for y in 0..<outputHeight {
                let scaledRow: Int = y * height / outputHeight
                let sourceRow: Int = min(height - 1, scaledRow) * width
                let row = base.advanced(by: y * rowBytes).assumingMemoryBound(to: UInt8.self)
                for x in 0..<outputWidth { row[x] = source[sourceRow + columnMap[x]] }
            }
        }
        return buffer
    }
}
