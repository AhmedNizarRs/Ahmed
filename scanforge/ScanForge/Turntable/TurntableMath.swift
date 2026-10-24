import Foundation

// Pure helpers for turntable capture. Foundation only, so they can be
// unit tested on their own (see Tests/main.swift).

/// A rectangle in normalized camera-buffer coordinates (0...1, origin at
/// the top-left of the unrotated sensor image).
struct NormalizedRect: Codable, Equatable, Sendable {
    var x: Float
    var y: Float
    var width: Float
    var height: Float

    static let centered = NormalizedRect(x: 0.2, y: 0.2, width: 0.6, height: 0.6)
}

/// Which LiDAR depths count as "the object": inside the frame and within the depth range.
struct DepthMaskSettings: Codable, Equatable, Sendable {
    var region: NormalizedRect
    /// Metres from the camera.
    var near: Float
    var far: Float
}

enum DepthMask {
    /// Builds an object mask from a LiDAR depth map (row-major, metres).
    /// 255 marks the object, 0 the background. Pixels with no depth reading
    /// inside the frame count as object, so dark or shiny spots aren't cut away.
    /// `grow` widens the mask by that many pixels to keep thin edges.
    static func make(depth: [Float], width: Int, height: Int, settings: DepthMaskSettings, grow: Int = 2) -> [UInt8] {
        var mask = [UInt8](repeating: 0, count: width * height)
        guard width > 0, height > 0, depth.count == width * height else { return mask }
        let (x0, y0, x1, y1) = pixelBounds(settings.region, width: width, height: height)
        guard x0 < x1, y0 < y1 else { return mask }

        for y in y0..<y1 {
            let row = y * width
            for x in x0..<x1 {
                let d = depth[row + x]
                let hasReading = d.isFinite && d > 0
                if !hasReading || (d >= settings.near && d <= settings.far) {
                    mask[row + x] = 255
                }
            }
        }
        guard grow > 0 else { return mask }
        return dilate(mask, width: width, height: height, radius: grow, within: (x0, y0, x1, y1))
    }

    /// Median depth in the middle of the frame: the distance to the front of the object.
    static func centerDepth(depth: [Float], width: Int, height: Int, region: NormalizedRect) -> Float? {
        guard depth.count == width * height else { return nil }
        let inner = NormalizedRect(
            x: region.x + region.width * 0.35, y: region.y + region.height * 0.35,
            width: region.width * 0.3, height: region.height * 0.3
        )
        let (x0, y0, x1, y1) = pixelBounds(inner, width: width, height: height)
        var values: [Float] = []
        for y in y0..<max(y0, y1) {
            for x in x0..<max(x0, x1) {
                let d = depth[y * width + x]
                if d.isFinite, d > 0 { values.append(d) }
            }
        }
        guard !values.isEmpty else { return nil }
        values.sort()
        return values[values.count / 2]
    }

    /// A depth range that fits the object in the frame. The object can't be
    /// much deeper than it is wide, so the range runs from a little in front
    /// of its face to one object-width behind it. `focalLength` is in pixels
    /// of this depth map.
    static func suggestedSettings(depth: [Float], width: Int, height: Int, region: NormalizedRect,
                                  focalLength: Float, extraDepth: Float = 0) -> DepthMaskSettings? {
        guard let front = centerDepth(depth: depth, width: width, height: height, region: region), focalLength > 0 else { return nil }
        let widthPixels = max(region.width * Float(width), region.height * Float(height))
        let objectSize = widthPixels * front / focalLength
        let near = max(0.05, front - 0.1)
        let far = max(near + 0.05, front + objectSize + 0.03 + extraDepth)
        return DepthMaskSettings(region: region, near: near, far: far)
    }

    private static func pixelBounds(_ r: NormalizedRect, width: Int, height: Int) -> (Int, Int, Int, Int) {
        func clamp(_ v: Float, _ size: Int) -> Int { min(size, max(0, Int((v * Float(size)).rounded()))) }
        return (clamp(r.x, width), clamp(r.y, height), clamp(r.x + r.width, width), clamp(r.y + r.height, height))
    }

    /// Max filter, kept inside the frame.
    private static func dilate(_ mask: [UInt8], width: Int, height: Int, radius: Int, within box: (Int, Int, Int, Int)) -> [UInt8] {
        let (x0, y0, x1, y1) = box
        var horizontal = mask
        for y in y0..<y1 {
            let row = y * width
            for x in x0..<x1 where mask[row + x] == 0 {
                let lo = max(x0, x - radius), hi = min(x1 - 1, x + radius)
                for k in lo...hi where mask[row + k] != 0 {
                    horizontal[row + x] = 255
                    break
                }
            }
        }
        var result = horizontal
        for y in y0..<y1 {
            for x in x0..<x1 where horizontal[y * width + x] == 0 {
                let lo = max(y0, y - radius), hi = min(y1 - 1, y + radius)
                for k in lo...hi where horizontal[k * width + x] != 0 {
                    result[y * width + x] = 255
                    break
                }
            }
        }
        return result
    }
}

/// Decides when to take a turntable photo: after the object was turned
/// and has come to rest, so every photo is sharp and from a new angle.
/// Feed it a small grid of brightness values (0...255) for every camera frame.
struct StillnessDetector {
    /// Average change between frames that counts as "the object is moving".
    var moveThreshold: Float = 4
    /// Average change between frames below which the picture is "still".
    var stillThreshold: Float = 1.5
    /// How many still frames in a row before shooting (about 0.3 s at 30 fps).
    var stillFramesNeeded = 9
    /// The picture must differ this much from the last photo, so a bump doesn't make a duplicate.
    var minimumChangeSinceShot: Float = 5

    private var previous: [Float]?
    private var lastShot: [Float]?
    private var stillFrames = 0
    private var armed = true

    /// Returns true when a photo should be taken now.
    mutating func feed(_ grid: [Float]) -> Bool {
        defer { previous = grid }
        guard let previous, previous.count == grid.count, !grid.isEmpty else { return false }
        let change = Self.meanDifference(previous, grid)

        if change > moveThreshold {
            armed = true
            stillFrames = 0
            return false
        }
        stillFrames = change < stillThreshold ? stillFrames + 1 : 0
        guard armed, stillFrames >= stillFramesNeeded else { return false }

        if let lastShot, Self.meanDifference(lastShot, grid) < minimumChangeSinceShot {
            armed = false
            return false
        }
        armed = false
        stillFrames = 0
        lastShot = grid
        return true
    }

    /// Call after a photo taken some other way (manual or timed).
    mutating func noteShot(_ grid: [Float]?) {
        lastShot = grid ?? previous
        armed = false
        stillFrames = 0
    }

    mutating func reset() {
        self = StillnessDetector(moveThreshold: moveThreshold, stillThreshold: stillThreshold,
                                 stillFramesNeeded: stillFramesNeeded, minimumChangeSinceShot: minimumChangeSinceShot)
    }

    static func meanDifference(_ a: [Float], _ b: [Float]) -> Float {
        guard a.count == b.count, !a.isEmpty else { return .infinity }
        var sum: Float = 0
        for i in a.indices { sum += abs(a[i] - b[i]) }
        return sum / Float(a.count)
    }
}

/// Tiny file format for depth maps and masks: width and height as
/// little-endian UInt32, then the values row by row.
enum RawGrid {
    static func encode(_ values: [Float], width: Int, height: Int) -> Data {
        var data = header(width: width, height: height)
        values.withUnsafeBufferPointer { buffer in
            for v in buffer { withUnsafeBytes(of: v.bitPattern.littleEndian) { data.append(contentsOf: $0) } }
        }
        return data
    }

    static func encode(_ values: [UInt8], width: Int, height: Int) -> Data {
        var data = header(width: width, height: height)
        data.append(contentsOf: values)
        return data
    }

    static func decodeFloats(_ data: Data) -> (values: [Float], width: Int, height: Int)? {
        guard let (width, height) = size(of: data), data.count == 8 + width * height * 4 else { return nil }
        let bytes = [UInt8](data)
        var values = [Float](repeating: 0, count: width * height)
        for i in values.indices {
            let o = 8 + i * 4
            let bits = UInt32(bytes[o]) | UInt32(bytes[o + 1]) << 8 | UInt32(bytes[o + 2]) << 16 | UInt32(bytes[o + 3]) << 24
            values[i] = Float(bitPattern: bits)
        }
        return (values, width, height)
    }

    static func decodeBytes(_ data: Data) -> (values: [UInt8], width: Int, height: Int)? {
        guard let (width, height) = size(of: data), data.count == 8 + width * height else { return nil }
        return (Array(data.dropFirst(8)), width, height)
    }

    private static func header(width: Int, height: Int) -> Data {
        var data = Data()
        withUnsafeBytes(of: UInt32(width).littleEndian) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: UInt32(height).littleEndian) { data.append(contentsOf: $0) }
        return data
    }

    private static func size(of data: Data) -> (Int, Int)? {
        guard data.count >= 8 else { return nil }
        let b = [UInt8](data.prefix(8))
        let width = Int(UInt32(b[0]) | UInt32(b[1]) << 8 | UInt32(b[2]) << 16 | UInt32(b[3]) << 24)
        let height = Int(UInt32(b[4]) | UInt32(b[5]) << 8 | UInt32(b[6]) << 16 | UInt32(b[7]) << 24)
        guard width > 0, height > 0, width < 20_000, height < 20_000 else { return nil }
        return (width, height)
    }
}
