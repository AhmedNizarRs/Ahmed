import AVFoundation
import SwiftUI

/// Turntable scanning: phone on a stand, object on a turntable or lazy Susan.
/// The user fits a frame around the object; LiDAR cuts away everything
/// outside the object's depth (shown live in red). Then each time the object
/// is turned a little and let go, a photo is taken automatically.
struct TurntableCaptureView: View {
    @ObservedObject var flow: ScanFlowModel
    @StateObject private var camera: TurntableCamera

    private enum Step: Equatable {
        case framing
        case shooting
        case ringDone
    }

    private enum Trigger: String, CaseIterable, Identifiable {
        case turnAndStop = "Turn & stop"
        case motorized = "Motorized"
        var id: Self { self }
    }

    @State private var step: Step = .framing
    @State private var ring = 1
    @State private var ringStartCount = 0
    /// The frame in portrait coordinates of the camera image (0...1).
    @State private var frame = CGRect(x: 0.2, y: 0.25, width: 0.6, height: 0.5)
    @State private var extraDepthCM: Double = 0
    @State private var trigger: Trigger = .turnAndStop
    @State private var confirmExit = false
    @State private var showHelp = false
    @State private var flash = false

    private static let photosPerRing = 30

    init(flow: ScanFlowModel) {
        self.flow = flow
        _camera = StateObject(wrappedValue: TurntableCamera(folders: flow.turntableFolders))
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            GeometryReader { geometry in
                let area = fittedRect(in: geometry.size)
                ZStack(alignment: .topLeading) {
                    CameraPreview(session: camera.session)
                        .frame(width: area.width, height: area.height)
                    if let overlay = camera.maskOverlay {
                        Image(decorative: overlay, scale: 1)
                            .resizable()
                            .frame(width: area.width, height: area.height)
                            .allowsHitTesting(false)
                    }
                    FrameEditor(frame: $frame, size: area.size, editable: step == .framing)
                        .frame(width: area.width, height: area.height)
                    Color.white
                        .opacity(flash ? 0.6 : 0)
                        .frame(width: area.width, height: area.height)
                        .allowsHitTesting(false)
                }
                .frame(width: area.width, height: area.height)
                .offset(x: area.minX, y: area.minY)
            }
            .ignoresSafeArea(edges: .bottom)

            VStack(spacing: 12) {
                topBar
                Spacer()
                panel
            }
            .padding()

            if case .failed(let message) = camera.status {
                VStack(spacing: 16) {
                    Text(message).multilineTextAlignment(.center)
                    Button("Close") { flow.discard() }.buttonStyle(.borderedProminent)
                }
                .padding(24)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20))
                .padding()
            }
        }
        .onAppear {
            camera.start()
            camera.setRegion(sensorRegion(frame))
            ringStartCount = camera.photoCount
            UIApplication.shared.isIdleTimerDisabled = true
        }
        .onDisappear { camera.stop() }
        .onChange(of: frame) { _, newFrame in camera.setRegion(sensorRegion(newFrame)) }
        .onChange(of: extraDepthCM) { _, value in camera.setExtraDepth(Float(value) / 100) }
        .onChange(of: trigger) { _, value in
            if step == .shooting { camera.setAutoCapture(autoCapture(for: value)) }
        }
        .onChange(of: camera.shotFlash) { _, _ in
            flash = true
            withAnimation(.easeOut(duration: 0.35)) { flash = false }
        }
        .sheet(isPresented: $showHelp) { TurntableHelpView() }
        .confirmationDialog("Leave this scan?", isPresented: $confirmExit, titleVisibility: .visible) {
            if camera.photoCount >= ScanFlowModel.minimumPhotos {
                Button("Build model from \(camera.photoCount) photos") { buildModel() }
            }
            Button("Discard scan", role: .destructive) {
                camera.stop()
                flow.discard()
            }
            Button("Keep scanning", role: .cancel) {}
        }
    }

    // MARK: Top and bottom

    private var topBar: some View {
        HStack {
            CircleButton(systemImage: "xmark", label: "Leave scan") { confirmExit = true }
            Spacer()
            Text("Ring \(ring) · \(camera.photoCount) photos")
                .font(.subheadline.weight(.semibold).monospacedDigit())
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(.ultraThinMaterial, in: Capsule())
            Spacer()
            CircleButton(systemImage: "questionmark", label: "How turntable scanning works") { showHelp = true }
        }
    }

    @ViewBuilder
    private var panel: some View {
        VStack(spacing: 14) {
            switch step {
            case .framing: framingPanel
            case .shooting: shootingPanel
            case .ringDone: ringDonePanel
            }
        }
        .padding(18)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    @ViewBuilder
    private var framingPanel: some View {
        Text(ringInstruction)
            .font(.body.weight(.medium))
            .multilineTextAlignment(.center)
        DistanceBadge(distance: camera.distance)
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("Background cut-off")
                Spacer()
                if let range = camera.depthRange {
                    Text("\(Int(range.upperBound * 100)) cm")
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                }
            }
            .font(.subheadline)
            Slider(value: $extraDepthCM, in: -10...40, step: 1)
            Text("Drag the white corners around the object. Red areas are cut out of the photos. Your object must stay clear.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        Picker("Turntable", selection: $trigger) {
            ForEach(Trigger.allCases) { Text($0.rawValue).tag($0) }
        }
        .pickerStyle(.segmented)
        PrimaryButton(title: "Start ring \(ring)", systemImage: "record.circle") { startRing() }
            .disabled(camera.distance == nil || camera.status != .running)
    }

    @ViewBuilder
    private var shootingPanel: some View {
        let inRing = camera.photoCount - ringStartCount
        Text(trigger == .turnAndStop
             ? "Turn the object a little (about a 12th of a turn) and let go. A photo is taken when it stops."
             : "Let the turntable spin slowly. A photo is taken every 1.5 seconds.")
            .font(.body.weight(.medium))
            .multilineTextAlignment(.center)
        ProgressView(value: min(1, Double(inRing) / Double(Self.photosPerRing))) {
            Text("\(inRing) of about \(Self.photosPerRing) photos for one full turn")
                .font(.subheadline)
        }
        HStack(spacing: 12) {
            Button {
                camera.captureNow()
            } label: {
                Label("Photo", systemImage: "camera.fill")
                    .frame(maxWidth: .infinity, minHeight: 50)
            }
            .buttonStyle(.bordered)
            Button {
                camera.endRing()
                step = .ringDone
            } label: {
                Label("Turn done", systemImage: "checkmark")
                    .frame(maxWidth: .infinity, minHeight: 50)
            }
            .buttonStyle(.borderedProminent)
        }
        .font(.headline)
    }

    @ViewBuilder
    private var ringDonePanel: some View {
        Text("Ring \(ring) done").font(.title3.bold())
        Text(nextAdvice)
            .multilineTextAlignment(.center)
            .foregroundStyle(.secondary)
        if ring < 3 {
            PrimaryButton(title: ring == 1 ? "Next: from higher up" : "Next: object on its side", systemImage: "arrow.up.circle") {
                ring += 1
                step = .framing
            }
        }
        if camera.photoCount >= ScanFlowModel.minimumPhotos {
            if ring >= 3 {
                PrimaryButton(title: "Build model (\(camera.photoCount) photos)", systemImage: "cube.transparent") { buildModel() }
            } else {
                Button {
                    buildModel()
                } label: {
                    Label("Build model (\(camera.photoCount) photos)", systemImage: "cube.transparent")
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 50)
                }
                .buttonStyle(.bordered)
            }
        } else {
            Text("Take at least \(ScanFlowModel.minimumPhotos) photos before building.")
                .font(.footnote)
                .foregroundStyle(.orange)
            Button("Add more photos to this ring") { step = .framing }
        }
    }

    // MARK: Actions

    private func startRing() {
        ringStartCount = camera.photoCount
        camera.beginRing(ring, mode: autoCapture(for: trigger))
        step = .shooting
    }

    private func autoCapture(for trigger: Trigger) -> TurntableCamera.AutoCapture {
        trigger == .turnAndStop ? .whenStill : .every(1.5)
    }

    private func buildModel() {
        camera.endRing()
        camera.stop()
        flow.startProcessing()
    }

    // MARK: Text

    private var ringInstruction: String {
        switch ring {
        case 1: "Phone on a stand 25–45 cm away, level with the object. Centre the object on the turntable."
        case 2: "Raise the phone so it looks down at the object from above (about 45°)."
        default: "Lay the object on its side so the bottom faces the camera."
        }
    }

    private var nextAdvice: String {
        switch ring {
        case 1: "One more turn from higher up captures the top and adds detail."
        case 2: "Need the underside? Lay the object on its side for a last turn. Otherwise, build the model."
        default: "You've covered every side. Build the model."
        }
    }

    // MARK: Geometry

    /// The camera image, fitted into the screen in portrait.
    private func fittedRect(in size: CGSize) -> CGRect {
        let aspect = camera.portraitAspect
        var width = size.width
        var height = width / aspect
        if height > size.height {
            height = size.height
            width = height * aspect
        }
        return CGRect(x: (size.width - width) / 2, y: 0, width: width, height: height)
    }

    /// Converts the portrait frame to unrotated sensor coordinates
    /// (the portrait view is the sensor image turned 90° clockwise).
    private func sensorRegion(_ r: CGRect) -> NormalizedRect {
        NormalizedRect(x: Float(r.minY), y: Float(1 - r.maxX), width: Float(r.height), height: Float(r.width))
    }
}

// MARK: - Pieces

private struct FrameEditor: View {
    @Binding var frame: CGRect
    let size: CGSize
    let editable: Bool
    @State private var moveStart: CGRect?

    private enum Corner: CaseIterable { case topLeft, topRight, bottomLeft, bottomRight }
    private let minimumSide: CGFloat = 0.15

    var body: some View {
        let rect = CGRect(x: frame.minX * size.width, y: frame.minY * size.height,
                          width: frame.width * size.width, height: frame.height * size.height)
        ZStack(alignment: .topLeading) {
            Rectangle()
                .fill(Color.white.opacity(0.001))
                .overlay(Rectangle().stroke(Color.white, style: StrokeStyle(lineWidth: 2, dash: editable ? [8, 6] : [])))
                .frame(width: rect.width, height: rect.height)
                .position(x: rect.midX, y: rect.midY)
                .gesture(moveGesture, including: editable ? .all : .none)
            if editable {
                ForEach(Corner.allCases, id: \.self) { corner in
                    Circle()
                        .fill(.white)
                        .frame(width: 26, height: 26)
                        .shadow(radius: 2)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                        .position(point(of: corner, in: rect))
                        .gesture(cornerGesture(corner))
                }
            }
        }
        .coordinateSpace(name: "frameArea")
    }

    private func point(of corner: Corner, in r: CGRect) -> CGPoint {
        switch corner {
        case .topLeft: CGPoint(x: r.minX, y: r.minY)
        case .topRight: CGPoint(x: r.maxX, y: r.minY)
        case .bottomLeft: CGPoint(x: r.minX, y: r.maxY)
        case .bottomRight: CGPoint(x: r.maxX, y: r.maxY)
        }
    }

    private var moveGesture: some Gesture {
        DragGesture(coordinateSpace: .named("frameArea"))
            .onChanged { value in
                let start = moveStart ?? frame
                moveStart = start
                var moved = start.offsetBy(dx: value.translation.width / size.width, dy: value.translation.height / size.height)
                moved.origin.x = min(max(0, moved.origin.x), 1 - moved.width)
                moved.origin.y = min(max(0, moved.origin.y), 1 - moved.height)
                frame = moved
            }
            .onEnded { _ in moveStart = nil }
    }

    private func cornerGesture(_ corner: Corner) -> some Gesture {
        DragGesture(coordinateSpace: .named("frameArea"))
            .onChanged { value in
                let x = min(max(0, value.location.x / size.width), 1)
                let y = min(max(0, value.location.y / size.height), 1)
                var minX = frame.minX, maxX = frame.maxX, minY = frame.minY, maxY = frame.maxY
                switch corner {
                case .topLeft: minX = min(x, maxX - minimumSide); minY = min(y, maxY - minimumSide)
                case .topRight: maxX = max(x, minX + minimumSide); minY = min(y, maxY - minimumSide)
                case .bottomLeft: minX = min(x, maxX - minimumSide); maxY = max(y, minY + minimumSide)
                case .bottomRight: maxX = max(x, minX + minimumSide); maxY = max(y, minY + minimumSide)
                }
                frame = CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
            }
    }
}

private struct DistanceBadge: View {
    let distance: Float?

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
            Text(text)
        }
        .font(.subheadline.weight(.semibold))
        .foregroundStyle(color)
    }

    private var centimetres: Int? { distance.map { Int(($0 * 100).rounded()) } }

    private var text: String {
        guard let cm = centimetres else { return "Aim the middle of the frame at the object" }
        if cm < 20 { return "\(cm) cm: move the phone back a little" }
        if cm > 50 { return "\(cm) cm: move closer for more detail" }
        return "\(cm) cm: good distance"
    }

    private var icon: String {
        guard let cm = centimetres else { return "scope" }
        return (20...50).contains(cm) ? "checkmark.circle.fill" : "arrow.left.and.right.circle"
    }

    private var color: Color {
        guard let cm = centimetres else { return .secondary }
        return (20...50).contains(cm) ? .green : .orange
    }
}

private struct CircleButton: View {
    let systemImage: String
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.headline)
                .frame(width: 44, height: 44)
                .background(.ultraThinMaterial, in: Circle())
        }
        .accessibilityLabel(label)
    }
}

/// Live camera image. The connection is turned to portrait.
private struct CameraPreview: UIViewRepresentable {
    let session: AVCaptureSession

    final class PreviewView: UIView {
        override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
        var previewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }

        override func layoutSubviews() {
            super.layoutSubviews()
            if let connection = previewLayer.connection, connection.isVideoRotationAngleSupported(90) {
                connection.videoRotationAngle = 90
            }
        }
    }

    func makeUIView(context: Context) -> PreviewView {
        let view = PreviewView()
        view.previewLayer.session = session
        view.previewLayer.videoGravity = .resizeAspect
        view.backgroundColor = .black
        return view
    }

    func updateUIView(_ view: PreviewView, context: Context) {
        view.setNeedsLayout()
    }
}

struct TurntableHelpView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("You need") {
                    Label("A turntable, lazy Susan, or a plate you can turn", systemImage: "circle.dashed")
                    Label("Something to hold the phone still: a stand, tripod, or books", systemImage: "iphone.gen3")
                    Label("Bright, even light and a plain background", systemImage: "sun.max")
                }
                Section("How it works") {
                    Label("The phone stays still. Only the object turns.", systemImage: "arrow.triangle.2.circlepath")
                    Label("LiDAR measures each photo and cuts away the background (shown in red), so the model has true size and the room doesn't confuse it.", systemImage: "camera.metering.matrix")
                    Label("Turn a little, let go, wait for the flash. About 30 photos per full turn.", systemImage: "camera.shutter.button")
                    Label("Do a second turn from higher up. Add a third with the object on its side if you need the bottom.", systemImage: "arrow.up.and.down")
                }
                Section("Tips for detail") {
                    Label("Get close: 25–35 cm fills the frame and gives the most detail.", systemImage: "plus.magnifyingglass")
                    Label("Put the object on a small riser, like a bottle cap, so it's easy to cut the turntable off later with Flat base.", systemImage: "square.stack.3d.up")
                    Label("Keep your hand out of the frame when the photo is taken.", systemImage: "hand.raised")
                }
            }
            .navigationTitle("Turntable scanning")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
    }
}
