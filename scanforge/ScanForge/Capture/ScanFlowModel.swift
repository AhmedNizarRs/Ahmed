import Foundation
import RealityKit
import SwiftUI

/// Drives one scan from the camera to a finished STL:
/// guided capture (ObjectCaptureSession), on-device reconstruction
/// (PhotogrammetrySession), then STL export with the scan's print settings.
@MainActor
final class ScanFlowModel: ObservableObject, Identifiable {
    enum Phase: Equatable {
        case capturing
        case processing
        case finished
        case failed(String)
    }

    enum Start {
        case capture
        case processing
    }

    let id: UUID
    let scan: Scan

    @Published private(set) var phase: Phase
    @Published private(set) var captureSession: ObjectCaptureSession?
    @Published private(set) var passNumber = 1
    @Published private(set) var progress: Double = 0
    @Published private(set) var stage = "Getting ready…"
    @Published private(set) var remainingTime: TimeInterval?
    @Published private(set) var isDiscarded = false

    var canRetryProcessing: Bool { store.photoCount(scan) >= Self.minimumPhotos }

    private let store: ScanStore
    private let start: Start
    private var hasStarted = false
    private var isStopping = false
    private var stateTask: Task<Void, Never>?
    private var processingTask: Task<Void, Never>?
    private var photogrammetrySession: PhotogrammetrySession?

    /// At least this many photos are needed for a usable reconstruction.
    static let minimumPhotos = 20

    init(scan: Scan, store: ScanStore, start: Start) {
        self.id = scan.id
        self.scan = scan
        self.store = store
        self.start = start
        self.phase = start == .capture ? .capturing : .processing
    }

    func begin() {
        guard !hasStarted else { return }
        hasStarted = true
        switch start {
        case .capture: startCapture()
        case .processing: startProcessing()
        }
    }

    // MARK: Capture

    private func startCapture() {
        let session = ObjectCaptureSession()
        var configuration = ObjectCaptureSession.Configuration()
        configuration.checkpointDirectory = store.checkpointURL(for: scan)
        configuration.isOverCaptureEnabled = true
        session.start(imagesDirectory: store.imagesURL(for: scan), configuration: configuration)
        captureSession = session
        phase = .capturing

        stateTask = Task { [weak self] in
            for await state in session.stateUpdates {
                self?.handleCaptureState(state)
            }
        }
    }

    private func handleCaptureState(_ state: ObjectCaptureSession.CaptureState) {
        switch state {
        case .completed:
            endCaptureSession()
            store.makeThumbnailIfNeeded(for: scan)
            startProcessing()
        case .failed(let error):
            endCaptureSession()
            guard !isStopping else { return }
            if store.photoCount(scan) >= Self.minimumPhotos {
                phase = .failed("The capture stopped early (\(error.localizedDescription)). Your photos were saved, so you can still try building the model.")
            } else {
                phase = .failed("The capture stopped (\(error.localizedDescription)). Please start a new scan.")
            }
        default:
            break
        }
    }

    /// Releases the camera session. The reconstruction needs that memory.
    private func endCaptureSession() {
        stateTask?.cancel()
        stateTask = nil
        captureSession = nil
    }

    func startDetecting() -> Bool {
        captureSession?.startDetecting() ?? false
    }

    func startCapturing() {
        captureSession?.startCapturing()
    }

    func resetDetection() {
        captureSession?.resetDetection()
    }

    func scanAnotherPass(flipped: Bool) {
        guard let captureSession else { return }
        passNumber += 1
        if flipped {
            captureSession.beginNewScanPassAfterFlip()
        } else {
            captureSession.beginNewScanPass()
        }
    }

    func finishCapture() {
        captureSession?.finish()
    }

    /// Throws the scan away (used when cancelling a new capture).
    func discard() {
        isStopping = true
        captureSession?.cancel()
        endCaptureSession()
        photogrammetrySession?.cancel()
        processingTask?.cancel()
        store.delete(scan)
        isDiscarded = true
    }

    // MARK: Reconstruction

    func startProcessing() {
        guard store.photoCount(scan) >= Self.minimumPhotos else {
            phase = .failed("This scan has too few photos to build a model. Start a new scan and walk all the way around the object.")
            return
        }
        isStopping = false
        phase = .processing
        progress = 0
        remainingTime = nil
        stage = "Getting ready…"
        processingTask = Task { await reconstruct() }
    }

    /// Stops reconstruction but keeps the photos so it can be retried later.
    func stopProcessing() {
        isStopping = true
        photogrammetrySession?.cancel()
        processingTask?.cancel()
    }

    private func reconstruct() async {
        let modelURL = store.modelURL(for: scan)
        let temporaryURL = store.folder(for: scan).appendingPathComponent("model-building.usdz")
        try? FileManager.default.removeItem(at: temporaryURL)

        var configuration = PhotogrammetrySession.Configuration()
        configuration.checkpointDirectory = store.checkpointURL(for: scan)

        do {
            let session = try PhotogrammetrySession(input: store.imagesURL(for: scan), configuration: configuration)
            photogrammetrySession = session
            try session.process(requests: [.modelFile(url: temporaryURL)])

            outputs: for try await output in session.outputs {
                switch output {
                case .requestProgress(_, let fractionComplete):
                    progress = fractionComplete
                case .requestProgressInfo(_, let info):
                    remainingTime = info.estimatedRemainingTime
                    if let processingStage = info.processingStage {
                        stage = Self.describe(processingStage)
                    }
                case .requestError(_, let error):
                    throw error
                case .processingCancelled:
                    photogrammetrySession = nil
                    return
                case .processingComplete:
                    break outputs
                default:
                    break
                }
            }
            photogrammetrySession = nil
            guard !isStopping else { return }

            guard FileManager.default.fileExists(atPath: temporaryURL.path) else {
                throw ReconstructionError.noModel
            }
            try? FileManager.default.removeItem(at: modelURL)
            try FileManager.default.moveItem(at: temporaryURL, to: modelURL)
            store.markProcessed(scan)

            stage = "Building STL…"
            progress = 1
            remainingTime = nil
            let current = store.scan(id: scan.id) ?? scan
            let settings = current.settings
            let stlURL = store.stlURL(for: current)
            try await Task.detached(priority: .userInitiated) {
                let prepared = try PrintPreparer.prepare(modelURL: modelURL, removeFloatingBits: settings.removeFloatingBits)
                try PrintPreparer.writeSTL(prepared, scale: settings.scale, to: stlURL)
            }.value
            store.markExported(current, settings: settings)
            phase = .finished
        } catch {
            photogrammetrySession = nil
            guard !isStopping else { return }
            phase = .failed(Self.message(for: error))
        }
    }

    private enum ReconstructionError: LocalizedError {
        case noModel

        var errorDescription: String? {
            "The photos couldn't be turned into a model. Try scanning again with brighter, even light and slower movement."
        }
    }

    private static func message(for error: Error) -> String {
        if let localized = error as? LocalizedError, let description = localized.errorDescription {
            return description
        }
        return "Building the model failed: \(error.localizedDescription)"
    }

    private static func describe(_ stage: PhotogrammetrySession.Output.ProcessingStage) -> String {
        switch stage {
        case .preProcessing: "Preparing photos…"
        case .imageAlignment: "Lining up photos…"
        case .pointCloudGeneration: "Measuring the shape…"
        case .meshGeneration: "Building the surface…"
        case .textureMapping: "Adding colour…"
        case .optimization: "Finishing up…"
        @unknown default: "Working…"
        }
    }
}
