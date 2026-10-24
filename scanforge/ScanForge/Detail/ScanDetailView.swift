import QuickLook
import SwiftUI

struct ScanDetailView: View {
    @EnvironmentObject private var store: ScanStore
    let scanID: UUID
    let onBuildModel: (Scan) -> Void

    var body: some View {
        if let scan = store.scan(id: scanID) {
            ScanDetailContent(scan: scan, onBuildModel: onBuildModel)
        } else {
            Text("This scan was deleted.")
                .foregroundStyle(.secondary)
        }
    }
}

/// Loads the scan's model as a print mesh and keeps it while the user tweaks settings.
@MainActor
final class PrintModel: ObservableObject {
    enum State {
        case idle
        case loading
        case ready(PreparedPrint)
        case failed(String)
    }

    @Published private(set) var state: State = .idle
    @Published var isExporting = false

    var prepared: PreparedPrint? {
        if case .ready(let prepared) = state { return prepared }
        return nil
    }

    func load(modelURL: URL, removeFloatingBits: Bool) async {
        if prepared == nil { state = .loading }
        do {
            let prepared = try await Task.detached(priority: .userInitiated) {
                try PrintPreparer.prepare(modelURL: modelURL, removeFloatingBits: removeFloatingBits)
            }.value
            guard !Task.isCancelled else { return }
            state = .ready(prepared)
        } catch {
            guard !Task.isCancelled else { return }
            state = .failed(error.localizedDescription)
        }
    }
}

private enum PrintAxis: String, CaseIterable, Identifiable {
    case width = "Width"
    case depth = "Depth"
    case height = "Height"

    var id: Self { self }

    func value(of size: SIMD3<Float>) -> Double {
        switch self {
        case .width: Double(size.x)
        case .depth: Double(size.y)
        case .height: Double(size.z)
        }
    }
}

private struct ShareItem: Identifiable {
    let id = UUID()
    let url: URL
}

private struct LoadKey: Equatable {
    let processedAt: Date?
    let removeFloatingBits: Bool
    let hasModel: Bool
}

private struct ScanDetailContent: View {
    @EnvironmentObject private var store: ScanStore
    @Environment(\.dismiss) private var dismiss
    let scan: Scan
    let onBuildModel: (Scan) -> Void

    @StateObject private var printModel = PrintModel()
    @State private var shareItem: ShareItem?
    @State private var arPreviewURL: URL?
    @State private var isRenaming = false
    @State private var newName = ""
    @State private var confirmDelete = false
    @State private var confirmDeletePhotos = false
    @State private var fitAxis: PrintAxis = .height
    @State private var fitTarget: Double?
    @State private var exportError: String?
    @FocusState private var editingNumber: Bool

    /// A common bed size (Bambu X1/P1, Prusa MK4 is a little smaller).
    private let typicalBed: Float = 256

    var body: some View {
        List {
            if store.hasModel(scan) {
                modelSections
            } else {
                notBuiltSection
            }
            storageSection
            Section {
                Button("Delete scan", role: .destructive) { confirmDelete = true }
            }
        }
        .navigationTitle(scan.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Rename") {
                    newName = scan.name
                    isRenaming = true
                }
            }
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { editingNumber = false }
            }
        }
        .task(id: LoadKey(processedAt: scan.processedAt, removeFloatingBits: scan.settings.removeFloatingBits, hasModel: store.hasModel(scan))) {
            guard store.hasModel(scan) else { return }
            await printModel.load(modelURL: store.modelURL(for: scan), removeFloatingBits: scan.settings.removeFloatingBits)
        }
        .sheet(item: $shareItem) { item in
            ActivityView(items: [item.url])
                .ignoresSafeArea()
        }
        .quickLookPreview($arPreviewURL)
        .alert("Rename scan", isPresented: $isRenaming) {
            TextField("Name", text: $newName)
            Button("Save") { store.rename(scan, to: newName) }
            Button("Cancel", role: .cancel) {}
        }
        .alert("Export failed", isPresented: Binding(get: { exportError != nil }, set: { if !$0 { exportError = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(exportError ?? "")
        }
        .confirmationDialog("Delete \(scan.name)?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete scan and STL", role: .destructive) {
                store.delete(scan)
                dismiss()
            }
        } message: {
            Text("This removes the photos, the 3D model and the exported STL.")
        }
        .confirmationDialog("Delete capture photos?", isPresented: $confirmDeletePhotos, titleVisibility: .visible) {
            Button("Delete photos", role: .destructive) { store.deletePhotos(of: scan) }
        } message: {
            Text("The 3D model and STL stay, but you won't be able to rebuild the model.")
        }
    }

    // MARK: Model

    @ViewBuilder
    private var modelSections: some View {
        switch printModel.state {
        case .idle, .loading:
            Section {
                HStack {
                    Spacer()
                    ProgressView("Preparing print model…")
                    Spacer()
                }
                .frame(height: 280)
            }
        case .failed(let message):
            Section {
                Label(message, systemImage: "exclamationmark.triangle")
                    .foregroundStyle(.orange)
            }
        case .ready(let prepared):
            readySections(prepared)
        }
    }

    @ViewBuilder
    private func readySections(_ prepared: PreparedPrint) -> some View {
        let size = prepared.analysis.size * Float(scan.settings.scale)

        Section {
            MeshPreview(prepared: prepared)
                .frame(height: 300)
                .listRowInsets(EdgeInsets())
        } footer: {
            Text("Drag to turn, pinch to zoom. This is exactly what goes into the STL.")
        }

        Section("Print size") {
            dimensionRow("Width (X)", size.x)
            dimensionRow("Depth (Y)", size.y)
            dimensionRow("Height (Z)", size.z)
            if max(size.x, size.y, size.z) > typicalBed {
                Label("Larger than a typical \(Int(typicalBed)) mm print bed. Scale it down or split it in your slicer.", systemImage: "exclamationmark.triangle")
                    .font(.footnote)
                    .foregroundStyle(.orange)
            }
        }

        Section {
            HStack {
                Text("Scale")
                Spacer()
                TextField("100", value: scalePercent, format: .number.precision(.fractionLength(0...1)))
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 80)
                    .focused($editingNumber)
                Text("%").foregroundStyle(.secondary)
            }
            if scan.settings.scale != 1 {
                Button("Reset to real size (100%)") { updateSettings { $0.scale = 1 } }
            }

            VStack(alignment: .leading, spacing: 10) {
                Text("Fit to size")
                Picker("Measure", selection: $fitAxis) {
                    ForEach(PrintAxis.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                HStack {
                    TextField("e.g. 85", value: $fitTarget, format: .number)
                        .keyboardType(.decimalPad)
                        .textFieldStyle(.roundedBorder)
                        .focused($editingNumber)
                    Text("mm").foregroundStyle(.secondary)
                    Button("Apply") { applyFit(prepared) }
                        .buttonStyle(.bordered)
                        .disabled((fitTarget ?? 0) <= 0)
                }
            }
            .padding(.vertical, 4)

            Toggle("Remove floating bits", isOn: Binding(
                get: { scan.settings.removeFloatingBits },
                set: { value in updateSettings { $0.removeFloatingBits = value } }
            ))
        } header: {
            Text("Adjust")
        } footer: {
            Text("Scans are measured at real size. Measure the real object once and use Fit to size if your print needs to be exact. Floating bits are loose specks and pieces of the table picked up during the scan.")
        }

        Section("Mesh check") {
            if prepared.analysis.isWatertight {
                Label("Closed surface, ready to slice", systemImage: "checkmark.seal.fill")
                    .foregroundStyle(.green)
            } else {
                Label("\(prepared.analysis.openEdgeCount) open edges. Most slicers repair this automatically when you import.", systemImage: "wrench.adjustable")
                    .foregroundStyle(.orange)
            }
            if prepared.analysis.pieceCount > 1 {
                LabeledContent("Separate pieces", value: "\(prepared.analysis.pieceCount)")
            }
            LabeledContent("Triangles", value: prepared.analysis.triangleCount.formatted())
        }

        Section {
            PrimaryButton(title: printModel.isExporting ? "Exporting…" : "Export STL", systemImage: "square.and.arrow.up") {
                Task { await exportSTL(prepared) }
            }
            .disabled(printModel.isExporting)
            .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))

            Button {
                arPreviewURL = store.modelURL(for: scan)
            } label: {
                Label("View textured model in AR", systemImage: "arkit")
            }
            Button {
                shareTexturedModel()
            } label: {
                Label("Share textured model (USDZ)", systemImage: "cube")
            }
        } footer: {
            if store.hasSTL(scan), scan.exportedSettings == scan.settings {
                Text("STL is up to date. It's also in Files › On My iPhone › ScanForge › \(scan.stlFileName).")
            } else if store.hasSTL(scan) {
                Text("You changed the settings. Export again to update the STL.")
            } else {
                Text("Export to save the STL to the Files app and share it to your slicer or CAD app.")
            }
        }
    }

    private var notBuiltSection: some View {
        Section {
            if store.photoCount(scan) >= ScanFlowModel.minimumPhotos {
                Text("The photos are saved but the 3D model hasn't been built yet.")
                PrimaryButton(title: "Build model", systemImage: "hammer.fill") { onBuildModel(scan) }
                    .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
            } else {
                Text("This scan doesn't have enough photos to build a model. Delete it and start a new scan.")
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private var storageSection: some View {
        let photos = store.photoCount(scan)
        if photos > 0 {
            Section {
                LabeledContent("Capture photos", value: "\(photos)")
                LabeledContent("Space used", value: ByteCountFormatter.string(fromByteCount: store.photoStorageSize(scan), countStyle: .file))
                if store.hasModel(scan), photos >= ScanFlowModel.minimumPhotos {
                    Button("Rebuild model from photos") { onBuildModel(scan) }
                    Button("Delete photos to free space", role: .destructive) { confirmDeletePhotos = true }
                }
            } header: {
                Text("Storage")
            }
        }
    }

    // MARK: Helpers

    private func dimensionRow(_ title: String, _ value: Float) -> some View {
        LabeledContent(title) {
            Text("\(value, specifier: "%.1f") mm")
                .monospacedDigit()
        }
    }

    private var scalePercent: Binding<Double> {
        Binding(
            get: { (scan.settings.scale * 1000).rounded() / 10 },
            set: { percent in
                let clamped = min(max(percent, 1), 5000)
                updateSettings { $0.scale = clamped / 100 }
            }
        )
    }

    private func updateSettings(_ change: (inout PrintSettings) -> Void) {
        var updated = store.scan(id: scan.id) ?? scan
        change(&updated.settings)
        store.save(updated)
    }

    private func applyFit(_ prepared: PreparedPrint) {
        editingNumber = false
        let current = fitAxis.value(of: prepared.analysis.size)
        guard let target = fitTarget, target > 0, current > 0 else { return }
        updateSettings { $0.scale = target / current }
    }

    private func exportSTL(_ prepared: PreparedPrint) async {
        editingNumber = false
        printModel.isExporting = true
        defer { printModel.isExporting = false }
        let settings = scan.settings
        let url = store.stlURL(for: scan)
        do {
            try await Task.detached(priority: .userInitiated) {
                try PrintPreparer.writeSTL(prepared, scale: settings.scale, to: url)
            }.value
            store.markExported(scan, settings: settings)
            shareItem = ShareItem(url: url)
        } catch {
            exportError = error.localizedDescription
        }
    }

    private func shareTexturedModel() {
        let baseName = (scan.stlFileName as NSString).deletingPathExtension
        let copy = FileManager.default.temporaryDirectory.appendingPathComponent("\(baseName).usdz")
        try? FileManager.default.removeItem(at: copy)
        do {
            try FileManager.default.copyItem(at: store.modelURL(for: scan), to: copy)
            shareItem = ShareItem(url: copy)
        } catch {
            exportError = error.localizedDescription
        }
    }
}

struct ActivityView: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
