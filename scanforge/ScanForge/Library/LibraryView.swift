import SwiftUI

struct LibraryView: View {
    @EnvironmentObject private var store: ScanStore
    let onNewScan: () -> Void
    @State private var showTips = false

    var body: some View {
        Group {
            if store.scans.isEmpty {
                EmptyLibraryView(onShowTips: { showTips = true })
            } else {
                List {
                    ForEach(store.scans) { scan in
                        NavigationLink(value: scan.id) {
                            ScanRow(scan: scan)
                        }
                    }
                    .onDelete { offsets in
                        for index in offsets { store.delete(store.scans[index]) }
                    }
                }
            }
        }
        .navigationTitle("ScanForge")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showTips = true } label: {
                    Image(systemName: "lightbulb")
                }
                .accessibilityLabel("Scanning tips")
            }
        }
        .safeAreaInset(edge: .bottom) {
            PrimaryButton(title: "New Scan", systemImage: "camera.viewfinder", action: onNewScan)
                .padding(.horizontal)
                .padding(.vertical, 10)
                .background(.bar)
        }
        .sheet(isPresented: $showTips) { TipsView() }
    }
}

private struct ScanRow: View {
    @EnvironmentObject private var store: ScanStore
    let scan: Scan

    var body: some View {
        HStack(spacing: 14) {
            Group {
                if let image = store.thumbnail(for: scan) {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                } else {
                    Image(systemName: "cube")
                        .font(.title2)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(.quaternary)
                }
            }
            .frame(width: 60, height: 60)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            VStack(alignment: .leading, spacing: 4) {
                Text(scan.name)
                    .font(.headline)
                Text(scan.createdAt, format: .dateTime.day().month().hour().minute())
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                status
            }
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private var status: some View {
        if store.hasSTL(scan) {
            Label("STL ready", systemImage: "checkmark.circle.fill")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.green)
        } else if store.hasModel(scan) {
            Label("Model ready", systemImage: "cube.fill")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.blue)
        } else if store.photoCount(scan) >= ScanFlowModel.minimumPhotos {
            Label("Tap to build model", systemImage: "hammer.fill")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.orange)
        } else {
            Label("Incomplete scan", systemImage: "exclamationmark.circle")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        }
    }
}

private struct EmptyLibraryView: View {
    let onShowTips: () -> Void

    var body: some View {
        VStack(spacing: 18) {
            Spacer()
            Image(systemName: "cube.transparent")
                .font(.system(size: 64, weight: .light))
                .foregroundStyle(Color.accentColor)
            Text("Scan your first object")
                .font(.title2.bold())
            VStack(alignment: .leading, spacing: 12) {
                StepRow(number: 1, text: "Put the object on a plain table with space around it.")
                StepRow(number: 2, text: "Tap New Scan and walk slowly around it.")
                StepRow(number: 3, text: "ScanForge builds a 3D model and an STL at real size.")
                StepRow(number: 4, text: "Share the STL to your slicer or CAD app.")
            }
            .padding(.horizontal, 32)
            Button("Tips for great scans", action: onShowTips)
                .font(.headline)
            Spacer()
        }
        .padding()
    }
}

private struct StepRow: View {
    let number: Int
    let text: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text("\(number)")
                .font(.subheadline.bold())
                .frame(width: 26, height: 26)
                .background(Color.accentColor.opacity(0.18), in: Circle())
            Text(text)
                .foregroundStyle(.secondary)
        }
    }
}
