import SwiftUI

/// Vigil's phone call: it rings, you answer, a low voice reads out what's
/// still waiting while an organ drones, and you can tick tasks off as it speaks.
struct CallView: View {
    @EnvironmentObject private var store: TaskStore
    @EnvironmentObject private var router: CallRouter
    let startAnswered: Bool

    @State private var answered = false
    @State private var startedAt = Date()
    @State private var lines: [String] = []
    @State private var lineTasks: [UUID?] = []
    @State private var ringTimer: Timer?
    @State private var pulse = false
    @StateObject private var sound = SoundBoard.shared

    var body: some View {
        ZStack {
            GothicBackground(glow: answered ? 0.8 : 1.3)
            if answered { activeCall } else { incomingCall }
        }
        .onAppear {
            sound.configureSession(forCall: true)
            if startAnswered { answer(playSound: false) } else { startRinging() }
        }
        .onDisappear {
            stopRinging()
            sound.stopSpeaking()
            sound.stop(.drone)
            sound.configureSession(forCall: false)
        }
        .statusBarHidden()
    }

    // MARK: Ringing

    private var incomingCall: some View {
        VStack(spacing: 18) {
            Spacer()
            ZStack {
                ForEach(0..<3) { i in
                    GothicArch()
                        .stroke(Theme.crimson.opacity(pulse ? 0 : 0.55), lineWidth: 1.5)
                        .frame(width: 150, height: 200)
                        .scaleEffect(pulse ? 1.6 + Double(i) * 0.25 : 1)
                        .animation(.easeOut(duration: 2.2).repeatForever(autoreverses: false).delay(Double(i) * 0.5), value: pulse)
                }
                GothicArch()
                    .fill(LinearGradient(colors: [Theme.oxblood.opacity(0.7), Theme.ink], startPoint: .top, endPoint: .bottom))
                    .overlay(GothicArch().stroke(Theme.gold, lineWidth: 1.5))
                    .frame(width: 150, height: 200)
                Candle(width: 28)
                    .offset(y: 30)
            }
            .frame(height: 300)

            Text("Vigil")
                .font(Fonts.blackletter(64))
                .foregroundStyle(Theme.bone)
                .shadow(color: Theme.crimson, radius: 16)
            Text("is calling…")
                .font(Fonts.italic(22))
                .foregroundStyle(Theme.ash)
            Text(pendingSummary)
                .font(Fonts.body(18))
                .foregroundStyle(Theme.gold)
                .padding(.top, 4)
            Spacer()
            HStack {
                callButton(systemImage: "phone.down.fill", label: "Decline", color: Theme.oxblood) {
                    sound.play(.hangup)
                    router.call = nil
                }
                Spacer()
                callButton(systemImage: "phone.fill", label: "Answer", color: Color(red: 0.2, green: 0.45, blue: 0.25)) {
                    answer(playSound: true)
                }
            }
            .padding(.horizontal, 50)
            .padding(.bottom, 40)
        }
    }

    private func callButton(systemImage: String, label: String, color: Color, action: @escaping () -> Void) -> some View {
        VStack(spacing: 8) {
            Button(action: action) {
                Image(systemName: systemImage)
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(Theme.bone)
                    .frame(width: 78, height: 78)
                    .background(Circle().fill(color))
                    .overlay(Circle().strokeBorder(Theme.gold.opacity(0.6), lineWidth: 1))
                    .shadow(color: color.opacity(0.7), radius: 14)
            }
            .accessibilityLabel(label)
            Text(label)
                .font(Fonts.heading(16))
                .foregroundStyle(Theme.ash)
        }
    }

    private func startRinging() {
        pulse = true
        sound.play(.ring, loop: true)
        sound.haptic(.heavy)
        ringTimer = Timer.scheduledTimer(withTimeInterval: 1.4, repeats: true) { _ in
            Task { @MainActor in sound.haptic(.heavy) }
        }
        // Like a real call: give up after a while.
        DispatchQueue.main.asyncAfter(deadline: .now() + 45) {
            if !answered, router.call != nil {
                sound.play(.hangup)
                router.call = nil
            }
        }
    }

    private func stopRinging() {
        ringTimer?.invalidate()
        ringTimer = nil
        sound.stop(.ring, fade: 0.3)
    }

    private func answer(playSound: Bool) {
        stopRinging()
        if playSound { sound.play(.answer, volume: 0.8) }
        startedAt = Date()
        let script = CallScript.make(store: store)
        lines = script.lines
        lineTasks = script.taskIDs
        withAnimation(.easeInOut(duration: 0.5)) { answered = true }
        sound.play(.drone, loop: true, volume: 0.35)
        sound.speak(lines) {
            // Let the drone linger a moment after the last word.
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { sound.stop(.drone, fade: 2) }
        }
    }

    // MARK: On the call

    private var activeCall: some View {
        VStack(spacing: 0) {
            VStack(spacing: 4) {
                Candle(width: 18)
                    .frame(height: 70)
                Text("Vigil")
                    .font(Fonts.blackletter(40))
                    .foregroundStyle(Theme.bone)
                TimelineView(.periodic(from: startedAt, by: 1)) { timeline in
                    Text(duration(timeline.date.timeIntervalSince(startedAt)))
                        .font(Fonts.heading(17).monospacedDigit())
                        .foregroundStyle(Theme.ash)
                }
            }
            .padding(.top, 20)

            ScrollViewReader { proxy in
                ScrollView {
                    VStack(spacing: 10) {
                        ForEach(Array(lines.enumerated()), id: \.offset) { index, line in
                            lineView(index: index, line: line)
                                .id(index)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 18)
                }
                .onChange(of: sound.spokenLine) { _, line in
                    guard let line else { return }
                    withAnimation(.easeInOut) { proxy.scrollTo(line, anchor: .center) }
                }
            }

            HStack(spacing: 40) {
                VStack(spacing: 6) {
                    Button {
                        if sound.isSpeaking { sound.stopSpeaking() } else { sound.speak(lines) {} }
                    } label: {
                        Image(systemName: sound.isSpeaking ? "speaker.slash.fill" : "arrow.counterclockwise")
                            .font(.system(size: 22))
                            .foregroundStyle(Theme.bone)
                            .frame(width: 60, height: 60)
                            .background(Circle().fill(Theme.stoneLight))
                            .overlay(Circle().strokeBorder(Theme.goldDim, lineWidth: 1))
                    }
                    Text(sound.isSpeaking ? "Quiet" : "Repeat")
                        .font(Fonts.heading(14))
                        .foregroundStyle(Theme.ash)
                }
                callButton(systemImage: "phone.down.fill", label: "End", color: Theme.oxblood) {
                    sound.stopSpeaking()
                    sound.stop(.drone, fade: 0.3)
                    sound.play(.hangup)
                    router.call = nil
                }
            }
            .padding(.bottom, 30)
        }
    }

    @ViewBuilder
    private func lineView(index: Int, line: String) -> some View {
        let current = sound.spokenLine == index
        let task = lineTasks.indices.contains(index) ? lineTasks[index].flatMap { id in store.tasks.first { $0.id == id } } : nil
        HStack(alignment: .center, spacing: 12) {
            if let task {
                Button {
                    let wasDone = store.isDone(task)
                    withAnimation { store.toggle(task) }
                    sound.play(wasDone ? .tap : .complete, volume: 0.8)
                    if !wasDone { sound.haptic(.medium) }
                } label: {
                    WaxSeal(done: store.isDone(task))
                }
                .buttonStyle(.plain)
            }
            Text(line)
                .font(task == nil ? Fonts.italic(19) : Fonts.body(21))
                .foregroundStyle(current ? Theme.bone : (task.map(store.isDone) == true ? Theme.ash : Theme.bone.opacity(0.7)))
                .strikethrough(task.map(store.isDone) == true, color: Theme.crimson)
                .frame(maxWidth: .infinity, alignment: task == nil ? .center : .leading)
                .multilineTextAlignment(task == nil ? .center : .leading)
        }
        .padding(.vertical, task == nil ? 4 : 10)
        .padding(.horizontal, task == nil ? 0 : 14)
        .background(
            RoundedRectangle(cornerRadius: 4)
                .fill(task == nil ? Color.clear : Theme.stone.opacity(0.8))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 4)
                .strokeBorder(current ? Theme.crimson : (task == nil ? .clear : Theme.goldDim.opacity(0.35)), lineWidth: 1)
        )
        .shadow(color: current ? Theme.crimson.opacity(0.45) : .clear, radius: 10)
        .scaleEffect(current ? 1.02 : 1)
        .animation(.easeInOut(duration: 0.3), value: current)
    }

    private var pendingSummary: String {
        let count = store.pendingNow.count
        switch count {
        case 0: return "All your work is done"
        case 1: return "1 task awaits"
        default: return "\(count) tasks await"
        }
    }

    private func duration(_ seconds: TimeInterval) -> String {
        let s = max(0, Int(seconds))
        return String(format: "%02d:%02d", s / 60, s % 60)
    }
}

/// What the voice says.
@MainActor
enum CallScript {
    static func make(store: TaskStore) -> (lines: [String], taskIDs: [UUID?]) {
        let now = Date()
        let calendar = store.calendar
        let today = store.todayTasks.filter { !$0.isDone(on: now, calendar: calendar) }
        let week = store.thisWeekTasks.filter { !$0.isDone(on: now, calendar: calendar) }
        var lines: [String] = []
        var ids: [UUID?] = []

        func say(_ line: String, task: UUID? = nil) {
            lines.append(line)
            ids.append(task)
        }

        say(greeting(at: now, calendar: calendar))
        let total = today.count + week.count
        if total == 0 {
            say("Your work is done. The candle may rest, and so may you.")
            return (lines, ids)
        }
        let time = now.formatted(date: .omitted, time: .shortened)
        say(total == 1 ? "It is \(time). One task still waits for you." : "It is \(time). \(spelled(total)) tasks still wait for you.")

        let ordinals = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"]
        for (i, task) in today.enumerated() {
            let lead = i < ordinals.count ? ordinals[i] : "And"
            say("\(lead): \(task.title).", task: task.id)
        }
        if !week.isEmpty {
            say(today.isEmpty ? "This week, do not forget:" : "And before the week is out:")
            for task in week {
                say("\(task.title).", task: task.id)
            }
        }
        say(farewells.randomElement() ?? "I shall call again.")
        return (lines, ids)
    }

    private static func greeting(at date: Date, calendar: Calendar) -> String {
        let hour = calendar.component(.hour, from: date)
        switch hour {
        case 0..<4: return "The witching hour is upon us. This is your Vigil."
        case 4..<12: return "Good morrow. This is your Vigil calling."
        case 12..<17: return "Good afternoon. Your Vigil calls."
        case 17..<21: return "Good evening. This is your Vigil."
        default: return "The night grows deep. Your Vigil calls."
        }
    }

    private static let farewells = [
        "The candle burns low. Do not tarry.",
        "Time is a thief. Be swift.",
        "Finish your work, or I shall call again.",
        "The bell will toll once more if you delay.",
        "Go now. The night is long, but not endless.",
    ]

    private static func spelled(_ n: Int) -> String {
        let words = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"]
        return n < words.count ? words[n] : "\(n)"
    }
}
