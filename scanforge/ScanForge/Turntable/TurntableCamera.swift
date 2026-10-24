import AVFoundation
import CoreImage
import CoreMotion
import UIKit

/// One photo in a turntable capture, as listed in capture.json.
struct TurntableShot: Codable, Sendable {
    var name: String
    var ring: Int
    var gravity: [Double]?
}

struct TurntableCaptureLog: Codable, Sendable {
    var shots: [TurntableShot] = []
}

/// Where a turntable capture stores its files.
struct TurntableFolders: Sendable {
    let images: URL
    let depth: URL
    let masks: URL
    let log: URL
    let thumbnail: URL
}

/// Camera for turntable scanning: the phone stays still on a stand while the
/// object turns. Uses the LiDAR depth camera to measure distance, to cut the
/// background out of every photo, and to give the model real-world scale.
///
/// All AVFoundation work happens on private queues; published values are
/// updated on the main queue.
final class TurntableCamera: NSObject, ObservableObject {
    enum Status: Equatable {
        case starting
        case running
        case failed(String)
    }

    enum AutoCapture: Equatable {
        case off
        case whenStill
        case every(TimeInterval)
    }

    @Published private(set) var status: Status = .starting
    /// Mask preview, already rotated to portrait: clear where the object is, tinted elsewhere.
    @Published private(set) var maskOverlay: CGImage?
    /// LiDAR distance to the front of the object, in metres.
    @Published private(set) var distance: Float?
    @Published private(set) var depthRange: ClosedRange<Float>?
    @Published private(set) var photoCount = 0
    @Published private(set) var shotFlash = 0
    /// Width / height of the camera image in portrait (for laying out the preview).
    @Published private(set) var portraitAspect: CGFloat = 3.0 / 4.0

    let session = AVCaptureSession()

    private let folders: TurntableFolders
    private let sessionQueue = DispatchQueue(label: "ScanForge.turntable.session")
    private let dataQueue = DispatchQueue(label: "ScanForge.turntable.data", qos: .userInitiated)
    private let photoQueue = DispatchQueue(label: "ScanForge.turntable.photo", qos: .userInitiated)
    private let videoOutput = AVCaptureVideoDataOutput()
    private let depthOutput = AVCaptureDepthDataOutput()
    private let photoOutput = AVCapturePhotoOutput()
    private var synchronizer: AVCaptureDataOutputSynchronizer?
    private var device: AVCaptureDevice?
    private let motion = CMMotionManager()
    private let ciContext = CIContext()

    // Shared between queues; guarded by `lock`.
    private let lock = NSLock()
    private var region = NormalizedRect.centered
    private var extraDepth: Float = 0
    private var frozenMask: DepthMaskSettings?
    private var liveMask: DepthMaskSettings?
    private var autoCapture: AutoCapture = .off
    private var ring = 1
    private var log = TurntableCaptureLog()
    private var photoInFlight = false

    // Only touched on dataQueue.
    private var detector = StillnessDetector()
    private var lastGrid: [Float]?
    private var lastTimedShot = Date.distantPast
    private var frameNumber = 0
    private var focalLengthForDepth: Float = 0

    init(folders: TurntableFolders) {
        self.folders = folders
        super.init()
        for url in [folders.images, folders.depth, folders.masks] {
            try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        }
        if let data = try? Data(contentsOf: folders.log), let saved = try? JSONDecoder().decode(TurntableCaptureLog.self, from: data) {
            log = saved
            photoCount = saved.shots.count
            ring = saved.shots.last?.ring ?? 1
        }
    }

    static var isAvailable: Bool {
        AVCaptureDevice.default(.builtInLiDARDepthCamera, for: .video, position: .back) != nil
    }

    // MARK: Control (call from the main thread)

    func start() {
        AVCaptureDevice.requestAccess(for: .video) { granted in
            guard granted else {
                self.publish { $0.status = .failed("ScanForge needs camera access. Turn it on in Settings › ScanForge.") }
                return
            }
            self.sessionQueue.async { self.configureAndRun() }
        }
        if motion.isDeviceMotionAvailable {
            motion.deviceMotionUpdateInterval = 1.0 / 30
            motion.startDeviceMotionUpdates()
        }
    }

    func stop() {
        sessionQueue.async { self.session.stopRunning() }
        motion.stopDeviceMotionUpdates()
    }

    func setRegion(_ newRegion: NormalizedRect) {
        lock.withLock { region = newRegion }
    }

    func setExtraDepth(_ metres: Float) {
        lock.withLock { extraDepth = metres }
    }

    /// Freezes the current frame and depth range and starts taking photos.
    func beginRing(_ number: Int, mode: AutoCapture) {
        let ready: Bool = lock.withLock {
            guard let live = liveMask else { return false }
            frozenMask = live
            ring = number
            autoCapture = mode
            return true
        }
        guard ready else { return }
        dataQueue.async {
            self.detector.reset()
            self.lastTimedShot = Date()
        }
        lockCameraSettings(true)
    }

    /// Stops taking photos so the phone can be moved for the next ring.
    func endRing() {
        lock.withLock {
            autoCapture = .off
            frozenMask = nil
        }
        lockCameraSettings(false)
    }

    func setAutoCapture(_ mode: AutoCapture) {
        lock.withLock { autoCapture = mode }
    }

    var canCaptureManually: Bool {
        lock.withLock { frozenMask != nil || liveMask != nil }
    }

    func captureNow() {
        dataQueue.async {
            self.detector.noteShot(self.lastGrid)
            self.takePhoto()
        }
    }

    // MARK: Setup

    private func configureAndRun() {
        guard let device = AVCaptureDevice.default(.builtInLiDARDepthCamera, for: .video, position: .back) else {
            publish { $0.status = .failed("This iPhone has no LiDAR scanner, so turntable mode isn't available.") }
            return
        }
        self.device = device

        // A 1920-wide format with depth, like Apple's LiDAR sample. Photos still use the full sensor.
        let formats = device.formats.filter { !$0.supportedDepthDataFormats.isEmpty && !$0.isVideoBinned }
        guard let format = formats.min(by: {
            abs(Int($0.formatDescription.dimensions.width) - 1920) < abs(Int($1.formatDescription.dimensions.width) - 1920)
        }) else {
            publish { $0.status = .failed("The LiDAR camera has no depth format available.") }
            return
        }
        let depthFormat = format.supportedDepthDataFormats.last {
            let type = CMFormatDescriptionGetMediaSubType($0.formatDescription)
            return type == kCVPixelFormatType_DepthFloat32 || type == kCVPixelFormatType_DepthFloat16
        } ?? format.supportedDepthDataFormats.last

        session.beginConfiguration()
        session.sessionPreset = .inputPriority
        do {
            let input = try AVCaptureDeviceInput(device: device)
            guard session.canAddInput(input) else { throw CameraError.setup }
            session.addInput(input)

            videoOutput.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarFullRange]
            videoOutput.alwaysDiscardsLateVideoFrames = true
            depthOutput.isFilteringEnabled = true
            depthOutput.alwaysDiscardsLateDepthData = true
            guard session.canAddOutput(videoOutput), session.canAddOutput(depthOutput), session.canAddOutput(photoOutput) else {
                throw CameraError.setup
            }
            session.addOutput(videoOutput)
            session.addOutput(depthOutput)
            session.addOutput(photoOutput)

            try device.lockForConfiguration()
            device.activeFormat = format
            device.activeDepthDataFormat = depthFormat
            if device.isFocusModeSupported(.continuousAutoFocus) { device.focusMode = .continuousAutoFocus }
            device.unlockForConfiguration()

            photoOutput.maxPhotoQualityPrioritization = .quality
            if let largest = format.supportedMaxPhotoDimensions.max(by: { $0.width * $0.height < $1.width * $1.height }) {
                photoOutput.maxPhotoDimensions = largest
            }
            photoOutput.isDepthDataDeliveryEnabled = photoOutput.isDepthDataDeliverySupported
        } catch {
            session.commitConfiguration()
            publish { $0.status = .failed("The camera couldn't be set up. Close other camera apps and try again.") }
            return
        }
        session.commitConfiguration()

        let sync = AVCaptureDataOutputSynchronizer(dataOutputs: [videoOutput, depthOutput])
        sync.setDelegate(self, queue: dataQueue)
        synchronizer = sync

        let dimensions = format.formatDescription.dimensions
        let fieldOfView = format.videoFieldOfView
        session.startRunning()
        publish {
            $0.portraitAspect = CGFloat(dimensions.height) / CGFloat(dimensions.width)
            $0.status = .running
        }
        dataQueue.async {
            // Focal length in pixels of a buffer as wide as the sensor's long side, scaled later.
            self.focalLengthForDepth = 1 / (2 * tan(fieldOfView * .pi / 360))
        }
    }

    private enum CameraError: Error { case setup }

    /// Keeps exposure, white balance and focus fixed while a ring is shot, so
    /// every photo matches; releases them for framing.
    private func lockCameraSettings(_ locked: Bool) {
        sessionQueue.async {
            guard let device = self.device, (try? device.lockForConfiguration()) != nil else { return }
            if locked {
                if device.isExposureModeSupported(.locked) { device.exposureMode = .locked }
                if device.isWhiteBalanceModeSupported(.locked) { device.whiteBalanceMode = .locked }
                if device.isFocusModeSupported(.locked) { device.focusMode = .locked }
            } else {
                if device.isExposureModeSupported(.continuousAutoExposure) { device.exposureMode = .continuousAutoExposure }
                if device.isWhiteBalanceModeSupported(.continuousAutoWhiteBalance) { device.whiteBalanceMode = .continuousAutoWhiteBalance }
                if device.isFocusModeSupported(.continuousAutoFocus) { device.focusMode = .continuousAutoFocus }
            }
            device.unlockForConfiguration()
        }
    }

    // MARK: Photos

    private func takePhoto() {
        let alreadyBusy: Bool = lock.withLock {
            if photoInFlight { return true }
            photoInFlight = true
            return false
        }
        guard !alreadyBusy else { return }

        sessionQueue.async {
            let settings: AVCapturePhotoSettings
            if self.photoOutput.availablePhotoCodecTypes.contains(.hevc) {
                settings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.hevc])
            } else {
                settings = AVCapturePhotoSettings()
            }
            settings.maxPhotoDimensions = self.photoOutput.maxPhotoDimensions
            settings.photoQualityPrioritization = .balanced
            settings.flashMode = .off
            if self.photoOutput.isDepthDataDeliveryEnabled {
                settings.isDepthDataDeliveryEnabled = true
                settings.embedsDepthDataInPhoto = true
                settings.isDepthDataFiltered = true
            }
            self.photoOutput.capturePhoto(with: settings, delegate: self)
        }
    }

    private func savePhoto(_ photo: AVCapturePhoto) {
        defer { lock.withLock { photoInFlight = false } }
        guard let data = photo.fileDataRepresentation() else { return }

        let (index, ringNumber, maskSettings) = lock.withLock {
            (log.shots.count + 1, ring, frozenMask ?? liveMask)
        }
        let name = String(format: "IMG_%04d", index)
        do {
            try data.write(to: folders.images.appendingPathComponent("\(name).HEIC"), options: .atomic)
            if let depth = photo.depthData.flatMap(Self.floatDepth) {
                try RawGrid.encode(depth.values, width: depth.width, height: depth.height)
                    .write(to: folders.depth.appendingPathComponent("\(name).depth"), options: .atomic)
                if let maskSettings {
                    let mask = DepthMask.make(depth: depth.values, width: depth.width, height: depth.height, settings: maskSettings, grow: 3)
                    try RawGrid.encode(mask, width: depth.width, height: depth.height)
                        .write(to: folders.masks.appendingPathComponent("\(name).mask"), options: .atomic)
                }
            }
        } catch {
            return
        }

        var gravity: [Double]?
        if let g = motion.deviceMotion?.gravity { gravity = [g.x, g.y, g.z] }
        let snapshot: TurntableCaptureLog = lock.withLock {
            log.shots.append(TurntableShot(name: name, ring: ringNumber, gravity: gravity))
            return log
        }
        if let encoded = try? JSONEncoder().encode(snapshot) {
            try? encoded.write(to: folders.log, options: .atomic)
        }
        if index == 1 { saveThumbnail(from: data) }
        publish {
            $0.photoCount = snapshot.shots.count
            $0.shotFlash += 1
        }
    }

    private func saveThumbnail(from data: Data) {
        guard let image = CIImage(data: data)?.oriented(.right) else { return }
        let scale = 320 / max(image.extent.width, image.extent.height)
        let small = image.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        guard let cg = ciContext.createCGImage(small, from: small.extent) else { return }
        try? UIImage(cgImage: cg).jpegData(compressionQuality: 0.8)?.write(to: folders.thumbnail, options: .atomic)
    }

    // MARK: Pixel helpers

    static func floatDepth(_ depthData: AVDepthData) -> (values: [Float], width: Int, height: Int)? {
        let converted = depthData.depthDataType == kCVPixelFormatType_DepthFloat32
            ? depthData : depthData.converting(toDepthDataType: kCVPixelFormatType_DepthFloat32)
        let buffer = converted.depthDataMap
        CVPixelBufferLockBaseAddress(buffer, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
        guard let base = CVPixelBufferGetBaseAddress(buffer) else { return nil }
        let width = CVPixelBufferGetWidth(buffer), height = CVPixelBufferGetHeight(buffer)
        let rowBytes = CVPixelBufferGetBytesPerRow(buffer)
        var values = [Float](repeating: 0, count: width * height)
        for y in 0..<height {
            let row = base.advanced(by: y * rowBytes).assumingMemoryBound(to: Float32.self)
            for x in 0..<width { values[y * width + x] = row[x] }
        }
        return (values, width, height)
    }

    /// Average brightness in a 16 x 12 grid over the frame region.
    private static func brightnessGrid(_ buffer: CVPixelBuffer, region: NormalizedRect) -> [Float] {
        CVPixelBufferLockBaseAddress(buffer, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
        guard CVPixelBufferGetPlaneCount(buffer) > 0, let base = CVPixelBufferGetBaseAddressOfPlane(buffer, 0) else { return [] }
        let width = CVPixelBufferGetWidthOfPlane(buffer, 0), height = CVPixelBufferGetHeightOfPlane(buffer, 0)
        let rowBytes = CVPixelBufferGetBytesPerRowOfPlane(buffer, 0)
        let pixels = base.assumingMemoryBound(to: UInt8.self)
        let columns = 16, rows = 12
        let x0 = Int(region.x * Float(width)), y0 = Int(region.y * Float(height))
        let cellW = max(1, Int(region.width * Float(width)) / columns), cellH = max(1, Int(region.height * Float(height)) / rows)
        var grid = [Float](repeating: 0, count: columns * rows)
        for r in 0..<rows {
            for c in 0..<columns {
                var sum = 0, count = 0
                // Sample every 4th pixel; plenty for a brightness average.
                for y in stride(from: y0 + r * cellH, to: min(height, y0 + (r + 1) * cellH), by: 4) {
                    for x in stride(from: x0 + c * cellW, to: min(width, x0 + (c + 1) * cellW), by: 4) {
                        sum += Int(pixels[y * rowBytes + x])
                        count += 1
                    }
                }
                grid[r * columns + c] = count > 0 ? Float(sum) / Float(count) : 0
            }
        }
        return grid
    }

    /// Portrait-rotated preview of the mask: clear on the object, red on the
    /// cut-away background inside the frame, dark outside the frame.
    private static func overlayImage(mask: [UInt8], depthWidth w: Int, depthHeight h: Int, region: NormalizedRect) -> CGImage? {
        let outW = h, outH = w
        var rgba = [UInt8](repeating: 0, count: outW * outH * 4)
        let rx0 = Int(region.x * Float(w)), rx1 = Int((region.x + region.width) * Float(w))
        let ry0 = Int(region.y * Float(h)), ry1 = Int((region.y + region.height) * Float(h))
        for by in 0..<h {
            for bx in 0..<w {
                // Rotating the sensor image 90° clockwise gives the portrait view.
                let px = h - 1 - by, py = bx
                let o = (py * outW + px) * 4
                let inside = bx >= rx0 && bx < rx1 && by >= ry0 && by < ry1
                if !inside {
                    rgba[o + 3] = 150 // dark (premultiplied black)
                } else if mask[by * w + bx] == 0 {
                    rgba[o] = 120; rgba[o + 1] = 20; rgba[o + 2] = 20; rgba[o + 3] = 120 // red tint
                }
            }
        }
        let data = Data(rgba) as CFData
        guard let provider = CGDataProvider(data: data) else { return nil }
        return CGImage(width: outW, height: outH, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: outW * 4,
                       space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
                       provider: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent)
    }

    private func publish(_ update: @escaping (TurntableCamera) -> Void) {
        DispatchQueue.main.async { update(self) }
    }
}

extension TurntableCamera: AVCaptureDataOutputSynchronizerDelegate {
    func dataOutputSynchronizer(_ synchronizer: AVCaptureDataOutputSynchronizer, didOutput collection: AVCaptureSynchronizedDataCollection) {
        guard let syncedDepth = collection.synchronizedData(for: depthOutput) as? AVCaptureSynchronizedDepthData,
              !syncedDepth.depthDataWasDropped,
              let syncedVideo = collection.synchronizedData(for: videoOutput) as? AVCaptureSynchronizedSampleBufferData,
              !syncedVideo.sampleBufferWasDropped,
              let pixelBuffer = CMSampleBufferGetImageBuffer(syncedVideo.sampleBuffer) else { return }

        frameNumber += 1
        let (currentRegion, extra, frozen, mode) = lock.withLock { (region, extraDepth, frozenMask, autoCapture) }
        let activeRegion = frozen?.region ?? currentRegion

        // Should a photo be taken now?
        let grid = Self.brightnessGrid(pixelBuffer, region: activeRegion)
        lastGrid = grid
        switch mode {
        case .off:
            _ = detector.feed(grid)
        case .whenStill:
            if detector.feed(grid) { takePhoto() }
        case .every(let interval):
            _ = detector.feed(grid)
            if Date().timeIntervalSince(lastTimedShot) >= interval {
                lastTimedShot = Date()
                takePhoto()
            }
        }

        // Depth work runs at 10 fps; it only drives the preview and the range.
        guard frameNumber % 3 == 0, let depth = Self.floatDepth(syncedDepth.depthData) else { return }
        let focal = focalLengthForDepth * Float(max(depth.width, depth.height))
        let settings: DepthMaskSettings?
        if let frozen {
            settings = frozen
        } else {
            settings = DepthMask.suggestedSettings(depth: depth.values, width: depth.width, height: depth.height,
                                                   region: currentRegion, focalLength: focal, extraDepth: extra)
            lock.withLock { liveMask = settings }
        }
        let distance = DepthMask.centerDepth(depth: depth.values, width: depth.width, height: depth.height, region: activeRegion)
        let mask = settings.map { DepthMask.make(depth: depth.values, width: depth.width, height: depth.height, settings: $0, grow: 1) }
        let overlay = Self.overlayImage(
            mask: mask ?? [UInt8](repeating: 0, count: depth.width * depth.height),
            depthWidth: depth.width, depthHeight: depth.height, region: activeRegion
        )
        publish {
            $0.distance = distance
            $0.depthRange = settings.map { $0.near...$0.far }
            $0.maskOverlay = overlay
        }
    }
}

extension TurntableCamera: AVCapturePhotoCaptureDelegate {
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        guard error == nil else {
            lock.withLock { photoInFlight = false }
            return
        }
        photoQueue.async { self.savePhoto(photo) }
    }
}
