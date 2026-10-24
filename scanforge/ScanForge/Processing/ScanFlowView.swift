import SwiftUI

/// Full-screen container for a scan in progress: camera, then model building.
struct ScanFlowView: View {
    @ObservedObject var flow: ScanFlowModel
    /// Called with the scan id when the STL is ready, or nil when the user leaves.
    let onClose: (UUID?) -> Void

    var body: some View {
        Group {
            switch flow.phase {
            case .capturing:
                if flow.scan.isTurntable {
                    TurntableCaptureView(flow: flow)
                } else if let session = flow.captureSession {
                    CaptureView(session: session, flow: flow)
                } else {
                    ProgressView("Starting camera…")
                }
            case .processing:
                ProcessingView(flow: flow, onStop: { onClose(nil) })
            case .finished:
                ProgressView()
            case .failed(let message):
                FailureView(message: message, flow: flow, onClose: onClose)
            }
        }
        .task { flow.begin() }
        .onAppear { UIApplication.shared.isIdleTimerDisabled = true }
        .onDisappear { UIApplication.shared.isIdleTimerDisabled = false }
        .onChange(of: flow.phase) { _, phase in
            if phase == .finished { onClose(flow.id) }
        }
        .onChange(of: flow.isDiscarded) { _, discarded in
            if discarded { onClose(nil) }
        }
    }
}

private struct ProcessingView: View {
    @ObservedObject var flow: ScanFlowModel
    let onStop: () -> Void
    @State private var confirmStop = false

    var body: some View {
        VStack(spacing: 28) {
            Spacer()
            ZStack {
                Circle()
                    .stroke(.quaternary, lineWidth: 14)
                Circle()
                    .trim(from: 0, to: max(0.02, flow.progress))
                    .stroke(Color.accentColor, style: StrokeStyle(lineWidth: 14, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.easeInOut, value: flow.progress)
                VStack(spacing: 4) {
                    Text(flow.progress, format: .percent.precision(.fractionLength(0)))
                        .font(.system(size: 44, weight: .bold, design: .rounded).monospacedDigit())
                    Image(systemName: "cube.transparent")
                        .font(.title2)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(width: 210, height: 210)

            VStack(spacing: 8) {
                Text(flow.stage)
                    .font(.title3.weight(.semibold))
                if let remaining = flow.remainingTime, remaining > 0 {
                    Text("About \(Self.format(remaining)) left")
                        .foregroundStyle(.secondary)
                }
            }

            Label("Keep ScanForge open while it works. Building usually takes 2 to 10 minutes; plug your phone in if the battery is low.", systemImage: "iphone.gen3")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.leading)
                .padding()
                .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .padding(.horizontal)

            Spacer()

            Button("Stop", role: .destructive) { confirmStop = true }
                .padding(.bottom)
        }
        .padding()
        .confirmationDialog("Stop building the model?", isPresented: $confirmStop, titleVisibility: .visible) {
            Button("Stop", role: .destructive) {
                flow.stopProcessing()
                onStop()
            }
            Button("Keep going", role: .cancel) {}
        } message: {
            Text("Your photos are kept. You can build the model later from the scan list.")
        }
    }

    private static func format(_ seconds: TimeInterval) -> String {
        let formatter = DateComponentsFormatter()
        formatter.allowedUnits = seconds >= 60 ? [.minute] : [.second]
        formatter.unitsStyle = .full
        return formatter.string(from: seconds.rounded(.up)) ?? ""
    }
}

private struct FailureView: View {
    let message: String
    @ObservedObject var flow: ScanFlowModel
    let onClose: (UUID?) -> Void

    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 54))
                .foregroundStyle(.orange)
            Text("Something went wrong")
                .font(.title2.bold())
            Text(message)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Spacer()
            if flow.canRetryProcessing {
                PrimaryButton(title: "Try building again", systemImage: "arrow.clockwise") {
                    flow.startProcessing()
                }
            }
            Button("Close") { onClose(nil) }
                .font(.headline)
                .frame(minHeight: 44)
        }
        .padding(24)
    }
}
