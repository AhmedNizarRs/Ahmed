import RealityKit
import SwiftUI

@main
struct ScanForgeApp: App {
    @StateObject private var store = ScanStore()

    var body: some SwiftUI.Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var store: ScanStore
    @State private var path: [UUID] = []
    @State private var activeFlow: ScanFlowModel?
    @State private var showUnsupported = false
    @State private var choosingMode = false

    var body: some View {
        NavigationStack(path: $path) {
            LibraryView(onNewScan: { choosingMode = true })
                .navigationDestination(for: UUID.self) { id in
                    ScanDetailView(scanID: id, onBuildModel: buildModel)
                }
        }
        .fullScreenCover(item: $activeFlow) { flow in
            ScanFlowView(flow: flow) { finishedID in
                activeFlow = nil
                if let finishedID { path = [finishedID] }
            }
        }
        .sheet(isPresented: $choosingMode) {
            ScanModePicker { kind in
                choosingMode = false
                startNewScan(kind)
            }
            .presentationDetents([.medium, .large])
        }
        .alert("This iPhone can't scan objects", isPresented: $showUnsupported) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Object Capture needs an iPhone Pro with a LiDAR scanner (iPhone 12 Pro or newer).")
        }
    }

    private func startNewScan(_ kind: CaptureKind) {
        let supported = kind == .guided ? ObjectCaptureSession.isSupported : TurntableCamera.isAvailable
        guard supported, PhotogrammetrySession.isSupported else {
            showUnsupported = true
            return
        }
        let scan = store.createScan(kind: kind)
        activeFlow = ScanFlowModel(scan: scan, store: store, start: .capture)
    }

    private func buildModel(for scan: Scan) {
        activeFlow = ScanFlowModel(scan: scan, store: store, start: .processing)
    }
}

/// First choice when starting a scan: walk around, or let the object turn.
struct ScanModePicker: View {
    let onChoose: (CaptureKind) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("How do you want to scan?")
                .font(.title2.bold())
                .padding(.top, 24)
            ModeCard(
                title: "Turntable",
                subtitle: "Phone on a stand, you turn the object. No walking. Uses LiDAR to cut out the background. Sharpest detail.",
                systemImage: "arrow.triangle.2.circlepath.circle.fill",
                badge: "Recommended"
            ) { onChoose(.turntable) }
            ModeCard(
                title: "Walk around",
                subtitle: "Apple's guided scan. Hold the phone and circle the object. Good for big or heavy things.",
                systemImage: "figure.walk.circle.fill",
                badge: nil
            ) { onChoose(.guided) }
            Spacer()
        }
        .padding(.horizontal)
    }
}

private struct ModeCard: View {
    let title: String
    let subtitle: String
    let systemImage: String
    let badge: String?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 14) {
                Image(systemName: systemImage)
                    .font(.system(size: 34))
                    .foregroundStyle(Color.accentColor)
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(title).font(.headline)
                        if let badge {
                            Text(badge)
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 2)
                                .background(Color.accentColor.opacity(0.18), in: Capsule())
                        }
                    }
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: 0)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}
