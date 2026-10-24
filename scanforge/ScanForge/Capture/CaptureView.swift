import RealityKit
import SwiftUI

/// Camera screen with Apple's guided Object Capture overlay plus
/// plain-language instructions and one obvious button for each step.
struct CaptureView: View {
    // ObjectCaptureSession is @Observable, so SwiftUI tracks it without a wrapper.
    let session: ObjectCaptureSession
    @ObservedObject var flow: ScanFlowModel
    @State private var confirmCancel = false
    @State private var showTips = false
    @State private var detectionFailed = false

    var body: some View {
        ZStack {
            ObjectCaptureView(session: session)
                .ignoresSafeArea()

            VStack(spacing: 12) {
                topBar
                Spacer()
                if let feedback = feedbackMessage {
                    Label(feedback, systemImage: "exclamationmark.circle.fill")
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(.yellow, in: Capsule())
                        .foregroundStyle(.black)
                        .transition(.opacity)
                }
                instructionCard
            }
            .padding()
            .animation(.easeInOut(duration: 0.2), value: feedbackMessage)

            if session.userCompletedScanPass {
                PassCompleteCard(passNumber: flow.passNumber) { choice in
                    switch choice {
                    case .anotherHeight: flow.scanAnotherPass(flipped: false)
                    case .flip: flow.scanAnotherPass(flipped: true)
                    case .finish: flow.finishCapture()
                    }
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.spring(duration: 0.3), value: session.userCompletedScanPass)
        .sheet(isPresented: $showTips) { TipsView() }
        .confirmationDialog("Cancel this scan?", isPresented: $confirmCancel, titleVisibility: .visible) {
            if canFinishEarly {
                Button("Stop and build model now") { flow.finishCapture() }
            }
            Button("Discard scan", role: .destructive) { flow.discard() }
            Button("Keep scanning", role: .cancel) {}
        } message: {
            Text("Discarding deletes the photos taken so far.")
        }
        .alert("Couldn't find the object", isPresented: $detectionFailed) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Move a little closer and keep the object in the middle of the screen, then try again.")
        }
    }

    // MARK: Pieces

    private var topBar: some View {
        HStack {
            Button { confirmCancel = true } label: {
                Image(systemName: "xmark")
                    .font(.headline)
                    .frame(width: 44, height: 44)
                    .background(.ultraThinMaterial, in: Circle())
            }
            .accessibilityLabel("Cancel scan")

            Spacer()

            if isCapturing {
                Text("Pass \(flow.passNumber) · \(session.numberOfShotsTaken) photos")
                    .font(.subheadline.weight(.semibold).monospacedDigit())
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(.ultraThinMaterial, in: Capsule())
            }

            Spacer()

            Button { showTips = true } label: {
                Image(systemName: "lightbulb")
                    .font(.headline)
                    .frame(width: 44, height: 44)
                    .background(.ultraThinMaterial, in: Circle())
            }
            .accessibilityLabel("Scanning tips")
        }
        .foregroundStyle(.primary)
    }

    @ViewBuilder
    private var instructionCard: some View {
        VStack(spacing: 14) {
            Text(instruction)
                .font(.body.weight(.medium))
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)

            switch session.state {
            case .ready:
                PrimaryButton(title: "Continue", systemImage: "viewfinder") {
                    if !flow.startDetecting() { detectionFailed = true }
                }
            case .detecting:
                PrimaryButton(title: "Start Capture", systemImage: "camera.fill") {
                    flow.startCapturing()
                }
                Button("Reset box") { flow.resetDetection() }
                    .font(.subheadline.weight(.semibold))
            case .capturing:
                if canFinishEarly {
                    Button("Finish now") { flow.finishCapture() }
                        .font(.subheadline.weight(.semibold))
                }
            case .initializing, .finishing:
                ProgressView()
            default:
                EmptyView()
            }
        }
        .padding(18)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    // MARK: State

    private var isCapturing: Bool {
        if case .capturing = session.state { return true }
        return false
    }

    private var canFinishEarly: Bool {
        isCapturing && session.numberOfShotsTaken >= ScanFlowModel.minimumPhotos
    }

    private var instruction: String {
        switch session.state {
        case .initializing:
            return "Starting the camera…"
        case .ready:
            return "Put your object on a plain table with space to walk around it. Aim the dot at the object."
        case .detecting:
            return "Drag the box edges so they fit snugly around the object, then start."
        case .capturing:
            switch flow.passNumber {
            case 1: return "Walk slowly all the way around the object, holding the phone at its height."
            case 2: return "Go around again, this time from higher up looking down."
            default: return "Go around once more so the camera sees every side."
            }
        case .finishing:
            return "Saving photos…"
        case .completed:
            return "Done!"
        case .failed:
            return "The capture stopped."
        @unknown default:
            return ""
        }
    }

    private var feedbackMessage: String? {
        var isDetecting = false
        if case .detecting = session.state { isDetecting = true }
        guard isCapturing || isDetecting else { return nil }
        for item in session.feedback {
            switch item {
            case .objectTooClose: return "Move farther away"
            case .objectTooFar: return "Move closer"
            case .movingTooFast: return "Slow down"
            case .environmentTooDark: return "Too dark. Turn on more light"
            case .environmentLowLight: return "More light would help"
            case .outOfFieldOfView: return "Keep the object on screen"
            default: continue
            }
        }
        return nil
    }
}

// MARK: - Pass complete

private struct PassCompleteCard: View {
    enum Choice { case anotherHeight, flip, finish }

    let passNumber: Int
    let onChoose: (Choice) -> Void

    var body: some View {
        VStack {
            Spacer()
            VStack(spacing: 14) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 44))
                    .foregroundStyle(.green)
                Text("Pass \(passNumber) done")
                    .font(.title2.bold())
                Text(advice)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)

                ForEach(options, id: \.title) { option in
                    if option.choice == recommended {
                        PrimaryButton(title: option.title, systemImage: option.icon) { onChoose(option.choice) }
                    } else {
                        Button { onChoose(option.choice) } label: {
                            Label(option.title, systemImage: option.icon)
                                .font(.headline)
                                .frame(maxWidth: .infinity, minHeight: 50)
                        }
                        .buttonStyle(.bordered)
                    }
                }
            }
            .padding(22)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
            .padding()
        }
    }

    private struct Option {
        let choice: Choice
        let title: String
        let icon: String
    }

    private var options: [Option] {
        [
            Option(choice: .anotherHeight, title: "Scan from another height", icon: "arrow.up.and.down.circle"),
            Option(choice: .flip, title: "Flip object and scan", icon: "arrow.triangle.2.circlepath"),
            Option(choice: .finish, title: "Finish and build model", icon: "cube.transparent"),
        ]
    }

    private var recommended: Choice {
        switch passNumber {
        case 1: .anotherHeight
        case 2: .flip
        default: .finish
        }
    }

    private var advice: String {
        switch passNumber {
        case 1: "Next, scan again from higher up so the top gets captured."
        case 2: "For a complete print model, lay the object on its side and scan the bottom too. Skip this if the bottom is flat."
        default: "You've got all sides. Build the model when you're ready."
        }
    }
}

struct PrimaryButton: View {
    let title: String
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.headline)
                .frame(maxWidth: .infinity, minHeight: 52)
        }
        .buttonStyle(.borderedProminent)
        .buttonBorderShape(.roundedRectangle(radius: 16))
    }
}
