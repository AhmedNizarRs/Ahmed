import SwiftUI

/// Near-black stone with a crimson glow from above, a vignette and drifting embers.
struct GothicBackground: View {
    var glow: Double = 1

    var body: some View {
        ZStack {
            Theme.ink
            RadialGradient(colors: [Theme.oxblood.opacity(0.55 * glow), .clear], center: .top, startRadius: 0, endRadius: 520)
            RadialGradient(colors: [.clear, .black.opacity(0.75)], center: .center, startRadius: 180, endRadius: 650)
            Embers()
        }
        .ignoresSafeArea()
    }
}

/// Slow, flickering sparks rising from below.
struct Embers: View {
    private struct Spark {
        let x: Double, speed: Double, size: Double, phase: Double, drift: Double
    }

    private let sparks: [Spark] = {
        var generator = SeededGenerator(seed: 13)
        return (0..<26).map { _ in
            Spark(x: .random(in: 0...1, using: &generator), speed: .random(in: 0.018...0.05, using: &generator),
                  size: .random(in: 1.2...3.2, using: &generator), phase: .random(in: 0...1, using: &generator),
                  drift: .random(in: 8...30, using: &generator))
        }
    }()

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30)) { timeline in
            Canvas { context, size in
                let t = timeline.date.timeIntervalSinceReferenceDate
                for spark in sparks {
                    let progress = (spark.phase + t * spark.speed).truncatingRemainder(dividingBy: 1)
                    let y = size.height * (1.05 - progress * 1.1)
                    let x = size.width * spark.x + sin(t * 0.7 + spark.phase * 9) * spark.drift
                    let flicker = 0.55 + 0.45 * sin(t * 6 + spark.phase * 40)
                    let alpha = flicker * sin(progress * .pi) * 0.8
                    let rect = CGRect(x: x, y: y, width: spark.size, height: spark.size)
                    context.fill(Path(ellipseIn: rect.insetBy(dx: -spark.size, dy: -spark.size)), with: .color(Theme.ember.opacity(alpha * 0.18)))
                    context.fill(Path(ellipseIn: rect), with: .color(Theme.ember.opacity(alpha)))
                }
            }
        }
        .allowsHitTesting(false)
    }
}

struct SeededGenerator: RandomNumberGenerator {
    private var state: UInt64
    init(seed: UInt64) { state = seed &+ 0x9E3779B97F4A7C15 }
    mutating func next() -> UInt64 {
        state = state &* 6364136223846793005 &+ 1442695040888963407
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58476D1CE4E5B9
        z = (z ^ (z >> 27)) &* 0x94D049BB133111EB
        return z ^ (z >> 31)
    }
}

/// A church candle. `wax` (0...1) is how much is left; the flame flickers
/// and goes out when `lit` is false, leaving a curl of smoke.
struct Candle: View {
    var wax: Double = 1
    var lit = true
    var width: CGFloat = 34

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: !lit)) { timeline in
            Canvas { context, size in
                draw(in: &context, size: size, t: timeline.date.timeIntervalSinceReferenceDate)
            }
        }
        .frame(width: width * 3, height: width * 4.6)
        .accessibilityHidden(true)
    }

    private func draw(in context: inout GraphicsContext, size: CGSize, t: Double) {
        let cx = size.width / 2
        let bottom = size.height
        let maxBody = size.height * 0.62
        let bodyHeight = max(width * 0.35, maxBody * CGFloat(min(1, max(0, wax))))
        let top = bottom - bodyHeight
        let body = CGRect(x: cx - width / 2, y: top, width: width, height: bodyHeight)

        // Glow on the wall behind.
        if lit {
            let pulse = 0.85 + 0.15 * sin(t * 7.3) * sin(t * 3.1)
            let glowRect = CGRect(x: cx - size.width * 0.75, y: top - size.width * 0.95, width: size.width * 1.5, height: size.width * 1.5)
            context.fill(Path(ellipseIn: glowRect), with: .radialGradient(
                Gradient(colors: [Theme.ember.opacity(0.28 * pulse), .clear]),
                center: CGPoint(x: cx, y: top - width * 0.6), startRadius: 0, endRadius: size.width * 0.75))
        }

        // Wax with a lit top edge and a drip.
        let wax = Path(roundedRect: body, cornerSize: CGSize(width: 3, height: 3))
        context.fill(wax, with: .linearGradient(
            Gradient(colors: [Theme.bone.opacity(0.75), Theme.bone, Theme.bone.opacity(0.55)]),
            startPoint: CGPoint(x: body.minX, y: 0), endPoint: CGPoint(x: body.maxX, y: 0)))
        var drip = Path()
        drip.addRoundedRect(in: CGRect(x: body.minX + width * 0.15, y: top, width: width * 0.16, height: bodyHeight * 0.28 + 6),
                            cornerSize: CGSize(width: width * 0.08, height: width * 0.08))
        context.fill(drip, with: .color(Theme.bone.opacity(0.95)))
        context.fill(Path(ellipseIn: CGRect(x: body.minX, y: top - 3, width: width, height: 6)), with: .color(Theme.bone.opacity(0.9)))

        // Wick.
        var wick = Path()
        wick.move(to: CGPoint(x: cx, y: top))
        wick.addLine(to: CGPoint(x: cx + 1, y: top - width * 0.22))
        context.stroke(wick, with: .color(.black.opacity(0.85)), lineWidth: 2)

        if lit {
            let sway = sin(t * 5.1) * 1.6 + sin(t * 11.7) * 0.8
            let stretch = 1 + 0.08 * sin(t * 9.3)
            let h = width * 1.15 * stretch
            let w = width * 0.42
            let base = CGPoint(x: cx, y: top - width * 0.12)
            func flame(scale: CGFloat) -> Path {
                var p = Path()
                p.move(to: CGPoint(x: base.x + sway * scale, y: base.y - h * scale))
                p.addQuadCurve(to: CGPoint(x: base.x + w * scale / 2, y: base.y - h * scale * 0.18),
                               control: CGPoint(x: base.x + w * scale * 0.55, y: base.y - h * scale * 0.55))
                p.addQuadCurve(to: CGPoint(x: base.x - w * scale / 2, y: base.y - h * scale * 0.18),
                               control: CGPoint(x: base.x, y: base.y + h * scale * 0.12))
                p.addQuadCurve(to: CGPoint(x: base.x + sway * scale, y: base.y - h * scale),
                               control: CGPoint(x: base.x - w * scale * 0.55, y: base.y - h * scale * 0.55))
                return p
            }
            context.fill(flame(scale: 1.25), with: .color(Theme.ember.opacity(0.25)))
            context.fill(flame(scale: 1), with: .linearGradient(
                Gradient(colors: [Color(red: 1, green: 0.95, blue: 0.75), Theme.ember, Theme.crimson.opacity(0.9)]),
                startPoint: CGPoint(x: cx, y: base.y), endPoint: CGPoint(x: cx, y: base.y - h)))
            context.fill(flame(scale: 0.45), with: .color(.white.opacity(0.85)))
        } else {
            // A thin curl of smoke.
            var smoke = Path()
            let start = CGPoint(x: cx + 1, y: top - width * 0.22)
            smoke.move(to: start)
            for i in 1...8 {
                let y = start.y - CGFloat(i) * width * 0.16
                smoke.addLine(to: CGPoint(x: start.x + sin(Double(i) * 0.9) * width * 0.15, y: y))
            }
            context.stroke(smoke, with: .color(Theme.ash.opacity(0.35)), lineWidth: 1.5)
        }
    }
}

/// A pointed gothic arch, for frames and windows.
struct GothicArch: Shape {
    /// How tall the pointed top is, as a share of the width.
    var crown: CGFloat = 0.62

    func path(in rect: CGRect) -> Path {
        var p = Path()
        let archHeight = min(rect.height, rect.width * crown)
        let springY = rect.minY + archHeight
        p.move(to: CGPoint(x: rect.minX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX, y: springY))
        p.addQuadCurve(to: CGPoint(x: rect.midX, y: rect.minY), control: CGPoint(x: rect.minX, y: rect.minY + archHeight * 0.25))
        p.addQuadCurve(to: CGPoint(x: rect.maxX, y: springY), control: CGPoint(x: rect.maxX, y: rect.minY + archHeight * 0.25))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        return p
    }
}

/// A gold rule with a small cross in the middle.
struct OrnamentDivider: View {
    var body: some View {
        HStack(spacing: 10) {
            line
            Image(systemName: "cross.fill")
                .font(.system(size: 9))
                .foregroundStyle(Theme.gold)
            line
        }
        .accessibilityHidden(true)
    }

    private var line: some View {
        Rectangle()
            .fill(LinearGradient(colors: [.clear, Theme.goldDim, .clear], startPoint: .leading, endPoint: .trailing))
            .frame(height: 1)
    }
}

/// Section heading: small caps between rules.
struct SectionTitle: View {
    let text: String
    var detail: String?

    var body: some View {
        VStack(spacing: 6) {
            Text(text)
                .font(Fonts.heading(22))
                .tracking(2)
                .foregroundStyle(Theme.gold)
            if let detail {
                Text(detail)
                    .font(Fonts.italic(15))
                    .foregroundStyle(Theme.ash)
            }
            OrnamentDivider()
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 18)
        .padding(.bottom, 4)
    }
}

/// A wax seal used as the checkbox.
struct WaxSeal: View {
    let done: Bool

    var body: some View {
        ZStack {
            Circle()
                .fill(done ? AnyShapeStyle(RadialGradient(colors: [Theme.crimson, Theme.oxblood], center: .topLeading, startRadius: 2, endRadius: 30))
                           : AnyShapeStyle(Color.clear))
            Circle()
                .strokeBorder(done ? Theme.oxblood : Theme.goldDim, lineWidth: done ? 3 : 1.5)
            Circle()
                .strokeBorder(Theme.bone.opacity(done ? 0.25 : 0), lineWidth: 1)
                .padding(5)
            if done {
                Image(systemName: "checkmark")
                    .font(.system(size: 13, weight: .black))
                    .foregroundStyle(Theme.bone.opacity(0.9))
                    .transition(.scale(scale: 2.2).combined(with: .opacity))
            }
        }
        .frame(width: 34, height: 34)
        .shadow(color: done ? Theme.crimson.opacity(0.5) : .clear, radius: 6)
        .animation(.spring(response: 0.3, dampingFraction: 0.5), value: done)
    }
}

/// Card with a thin gold border and a faint inner glow.
struct StoneCard<Content: View>: View {
    var highlighted = false
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 4, style: .continuous)
                    .fill(LinearGradient(colors: [Theme.stoneLight, Theme.stone], startPoint: .top, endPoint: .bottom))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 4, style: .continuous)
                    .strokeBorder(highlighted ? Theme.crimson.opacity(0.8) : Theme.goldDim.opacity(0.45), lineWidth: 1)
            )
            .overlay(alignment: .topLeading) { cornerMark }
            .overlay(alignment: .bottomTrailing) { cornerMark.rotationEffect(.degrees(180)) }
    }

    private var cornerMark: some View {
        Path { p in
            p.move(to: CGPoint(x: 0, y: 12))
            p.addLine(to: CGPoint(x: 0, y: 0))
            p.addLine(to: CGPoint(x: 12, y: 0))
        }
        .stroke(Theme.gold, lineWidth: 1.5)
        .frame(width: 12, height: 12)
        .padding(3)
    }
}

/// Gold-outlined button with blackletter-ish weight.
struct GothicButtonStyle: ButtonStyle {
    var filled = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Fonts.heading(19))
            .tracking(1)
            .foregroundStyle(filled ? Theme.bone : Theme.gold)
            .padding(.horizontal, 20)
            .frame(minHeight: 50)
            .background(
                Capsule().fill(filled ? AnyShapeStyle(LinearGradient(colors: [Theme.crimson, Theme.oxblood], startPoint: .top, endPoint: .bottom))
                                      : AnyShapeStyle(Theme.stone.opacity(0.85)))
            )
            .overlay(Capsule().strokeBorder(filled ? Theme.crimson : Theme.goldDim, lineWidth: 1))
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .opacity(configuration.isPressed ? 0.85 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}
