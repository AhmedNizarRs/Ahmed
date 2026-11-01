import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var store: TaskStore
    @EnvironmentObject private var scheduler: CallScheduler
    @EnvironmentObject private var router: CallRouter
    @State private var editing: VigilTask?
    @State private var creating = false
    @State private var showingCalls = false

    private let sound = SoundBoard.shared

    var body: some View {
        ZStack {
            GothicBackground(glow: store.pendingNow.isEmpty ? 0.5 : 1)

            List {
                header
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)

                if store.tasks.isEmpty {
                    emptyState
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                } else {
                    section("This Day", detail: todayDetail, tasks: store.todayTasks, empty: "Nothing is bound to this day.")
                    if !store.thisWeekTasks.isEmpty {
                        section("This Week", detail: "To be done by Sunday's end", tasks: store.thisWeekTasks, empty: nil)
                    }
                    if !store.laterThisWeekTasks.isEmpty {
                        section("Days to Come", detail: nil, tasks: store.laterThisWeekTasks, empty: nil, upcoming: true)
                    }
                }

                nextCallCard
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                    .padding(.bottom, 90)
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)

            VStack {
                Spacer()
                bottomBar
            }
        }
        .sheet(item: $editing) { task in
            TaskEditorView(task: task, isNew: false)
        }
        .sheet(isPresented: $creating) {
            TaskEditorView(task: VigilTask(title: "", cadence: .daily), isNew: true)
        }
        .sheet(isPresented: $showingCalls) {
            CallSettingsView()
        }
    }

    // MARK: Header

    private var header: some View {
        let pending = store.pendingNow.count
        let total = store.todayTasks.count + store.thisWeekTasks.count
        return VStack(spacing: 6) {
            ZStack(alignment: .bottom) {
                GothicArch()
                    .stroke(LinearGradient(colors: [Theme.gold, Theme.goldDim.opacity(0.2)], startPoint: .top, endPoint: .bottom), lineWidth: 1.2)
                    .frame(width: 150, height: 190)
                GothicArch()
                    .stroke(Theme.goldDim.opacity(0.35), lineWidth: 0.8)
                    .frame(width: 128, height: 172)
                Candle(wax: total == 0 ? 1 : 0.25 + 0.75 * Double(pending) / Double(max(1, total)), lit: pending > 0 || store.tasks.isEmpty, width: 30)
                    .padding(.bottom, 6)
            }
            .padding(.top, 8)

            Text("Vigil")
                .font(Fonts.blackletter(58))
                .foregroundStyle(LinearGradient(colors: [Theme.bone, Theme.gold], startPoint: .top, endPoint: .bottom))
                .shadow(color: Theme.crimson.opacity(0.6), radius: 12)
            Text(store.now.vigilLongDate)
                .font(Fonts.italic(17))
                .foregroundStyle(Theme.ash)
            Text(statusLine(pending: pending))
                .font(Fonts.body(18))
                .foregroundStyle(pending > 0 ? Theme.bone : Theme.gold)
                .multilineTextAlignment(.center)
                .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
    }

    private func statusLine(pending: Int) -> String {
        if store.tasks.isEmpty { return "No tasks yet. Write one to begin." }
        switch pending {
        case 0: return "All is done. The bells are silent today."
        case 1: return "One task still awaits you."
        default: return "\(pending) tasks still await you."
        }
    }

    private var todayDetail: String? {
        let done = store.todayTasks.filter(store.isDone).count
        return store.todayTasks.isEmpty ? nil : "\(done) of \(store.todayTasks.count) done"
    }

    // MARK: Sections

    @ViewBuilder
    private func section(_ title: String, detail: String?, tasks: [VigilTask], empty: String?, upcoming: Bool = false) -> some View {
        SectionTitle(text: title, detail: detail)
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
        if tasks.isEmpty, let empty {
            Text(empty)
                .font(Fonts.italic(16))
                .foregroundStyle(Theme.ash)
                .frame(maxWidth: .infinity)
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
        }
        ForEach(tasks) { task in
            TaskRow(task: task, done: !upcoming && store.isDone(task), upcoming: upcoming) {
                toggle(task)
            }
            .contentShape(Rectangle())
            .onTapGesture {
                sound.play(.tap, volume: 0.6)
                editing = task
            }
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
            .listRowInsets(EdgeInsets(top: 5, leading: 16, bottom: 5, trailing: 16))
            .swipeActions(edge: .trailing) {
                Button(role: .destructive) {
                    sound.play(.extinguish)
                    withAnimation { store.delete(task) }
                } label: {
                    Label("Snuff out", systemImage: "flame")
                }
                .tint(Theme.oxblood)
            }
        }
    }

    private func toggle(_ task: VigilTask) {
        let wasDone = store.isDone(task)
        withAnimation(.spring(response: 0.35, dampingFraction: 0.7)) { store.toggle(task) }
        if !wasDone {
            sound.play(.complete, volume: 0.8)
            sound.haptic(.medium)
            if store.pendingNow.isEmpty {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { sound.play(.extinguish, volume: 0.7) }
            }
        } else {
            sound.play(.tap)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            OrnamentDivider().padding(.horizontal, 40)
            Text("Write down what must be done: daily duties and weekly ones. Vigil will call you through the day until they're done.")
                .font(Fonts.body(18))
                .foregroundStyle(Theme.bone.opacity(0.85))
                .multilineTextAlignment(.center)
            Button {
                sound.play(.tap)
                creating = true
            } label: {
                Label("Write your first task", systemImage: "pencil.and.scribble")
            }
            .buttonStyle(GothicButtonStyle(filled: true))
        }
        .padding(.vertical, 24)
        .frame(maxWidth: .infinity)
    }

    // MARK: Calls

    private var nextCallCard: some View {
        Button {
            sound.play(.tap)
            showingCalls = true
        } label: {
            StoneCard(highlighted: scheduler.method == .none && store.data.callsEnabled) {
                HStack(spacing: 14) {
                    Image(systemName: callIcon)
                        .font(.system(size: 24))
                        .foregroundStyle(Theme.crimson)
                        .frame(width: 36)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(callTitle)
                            .font(Fonts.heading(18))
                            .foregroundStyle(Theme.bone)
                        Text(callDetail)
                            .font(Fonts.italic(15))
                            .foregroundStyle(Theme.ash)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .foregroundStyle(Theme.goldDim)
                }
            }
        }
        .buttonStyle(.plain)
        .padding(.top, 16)
    }

    private var callIcon: String {
        if !store.data.callsEnabled { return "bell.slash" }
        return scheduler.method == .none ? "exclamationmark.triangle" : "bell.and.waves.left.and.right"
    }

    private var callTitle: String {
        if !store.data.callsEnabled { return "Calls are silenced" }
        if scheduler.method == .none { return "Vigil can't call you yet" }
        guard let next = store.plannedCalls.first else { return "No calls planned" }
        let day = Calendar.current.isDateInToday(next.date) ? "" : next.date.formatted(.dateTime.weekday(.wide)) + " "
        return "Next call: \(day)\(next.date.formatted(date: .omitted, time: .shortened))"
    }

    private var callDetail: String {
        if !store.data.callsEnabled { return "Tap to set when Vigil calls" }
        if scheduler.method == .none { return "Tap to allow alarms" }
        let times = store.data.callTimes.map { String(format: "%d:%02d", $0.hour, $0.minute) }.joined(separator: " · ")
        return "Calls at \(times), until the day's work is done"
    }

    // MARK: Bottom bar

    private var bottomBar: some View {
        HStack(spacing: 12) {
            Button {
                sound.play(.tap)
                showingCalls = true
            } label: {
                Image(systemName: "bell.fill")
                    .frame(width: 22)
            }
            .buttonStyle(GothicButtonStyle())
            .accessibilityLabel("Call settings")

            Button {
                sound.play(.tap)
                creating = true
            } label: {
                Label("New task", systemImage: "plus")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(GothicButtonStyle(filled: true))

            Button {
                router.ring()
            } label: {
                Image(systemName: "phone.fill")
                    .frame(width: 22)
            }
            .buttonStyle(GothicButtonStyle())
            .accessibilityLabel("Get a call now")
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 6)
        .background(
            LinearGradient(colors: [.clear, Theme.ink.opacity(0.95), Theme.ink], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
        )
    }
}

struct TaskRow: View {
    let task: VigilTask
    let done: Bool
    var upcoming = false
    let onToggle: () -> Void

    var body: some View {
        StoneCard(highlighted: false) {
            HStack(spacing: 14) {
                if upcoming {
                    Text(weekdayShort)
                        .font(Fonts.heading(15))
                        .foregroundStyle(Theme.goldDim)
                        .frame(width: 34)
                } else {
                    Button(action: onToggle) {
                        WaxSeal(done: done)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(done ? "Mark not done" : "Mark done")
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(task.title)
                        .font(Fonts.body(20))
                        .foregroundStyle(done ? Theme.ash : Theme.bone)
                        .strikethrough(done, color: Theme.crimson)
                    HStack(spacing: 6) {
                        Text(cadenceLabel)
                        if !task.note.isEmpty {
                            Text("·")
                            Text(task.note).lineLimit(1)
                        }
                    }
                    .font(Fonts.italic(14))
                    .foregroundStyle(Theme.ash)
                }
                Spacer(minLength: 0)
            }
        }
        .opacity(upcoming ? 0.6 : 1)
    }

    private var cadenceLabel: String {
        switch task.cadence {
        case .daily: return "Every day"
        case .weekly(nil): return "Once this week"
        case .weekly(let day?): return "Every \(Calendar.current.weekdaySymbols[day - 1])"
        }
    }

    private var weekdayShort: String {
        guard case .weekly(let day?) = task.cadence else { return "" }
        return Calendar.current.shortWeekdaySymbols[day - 1]
    }
}
