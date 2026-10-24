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

    var body: some View {
        NavigationStack(path: $path) {
            LibraryView(onNewScan: startNewScan)
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
        .alert("This iPhone can't scan objects", isPresented: $showUnsupported) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Object Capture needs an iPhone Pro with a LiDAR scanner (iPhone 12 Pro or newer).")
        }
    }

    private func startNewScan() {
        guard ObjectCaptureSession.isSupported else {
            showUnsupported = true
            return
        }
        let scan = store.createScan()
        activeFlow = ScanFlowModel(scan: scan, store: store, start: .capture)
    }

    private func buildModel(for scan: Scan) {
        activeFlow = ScanFlowModel(scan: scan, store: store, start: .processing)
    }
}
