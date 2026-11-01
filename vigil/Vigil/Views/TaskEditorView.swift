import SwiftUI

struct TaskEditorView: View {
    @EnvironmentObject private var store: TaskStore
    @Environment(\.dismiss) private var dismiss
    @State var task: VigilTask
    let isNew: Bool
    @FocusState private var titleFocused: Bool
    @State private var confirmDelete = false

    private let sound = SoundBoard.shared

    private enum Kind: String, CaseIterable, Identifiable {
        case daily = "Daily"
        case weekly = "Weekly"
        var id: Self { self }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                GothicBackground(glow: 0.6)
                ScrollView {
                    VStack(spacing: 22) {
                        Text(isNew ? "New Task" : "Edit Task")
                            .font(Fonts.blackletter(40))
                            .foregroundStyle(Theme.bone)
                            .padding(.top, 10)

                        field(label: "What must be done") {
                            TextField("", text: $task.title, prompt: Text("Feed the ravens").foregroundStyle(Theme.ash.opacity(0.6)), axis: .vertical)
                                .font(Fonts.body(22))
                                .foregroundStyle(Theme.bone)
                                .focused($titleFocused)
                                .submitLabel(.done)
                        }

                        field(label: "Note (optional)") {
                            TextField("", text: $task.note, prompt: Text("A word of detail").foregroundStyle(Theme.ash.opacity(0.6)))
                                .font(Fonts.italic(18))
                                .foregroundStyle(Theme.bone)
                        }

                        field(label: "How often") {
                            VStack(spacing: 14) {
                                HStack(spacing: 10) {
                                    ForEach(Kind.allCases) { kind in
                                        chip(kind.rawValue, selected: currentKind == kind) { setKind(kind) }
                                    }
                                }
                                if currentKind == .weekly {
                                    Text("On which day?")
                                        .font(Fonts.italic(15))
                                        .foregroundStyle(Theme.ash)
                                    weekdayPicker
                                }
                            }
                        }

                        Text(explanation)
                            .font(Fonts.italic(16))
                            .foregroundStyle(Theme.ash)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)

                        Button {
                            save()
                        } label: {
                            Label(isNew ? "Save task" : "Save changes", systemImage: "checkmark")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(GothicButtonStyle(filled: true))
                        .disabled(trimmedTitle.isEmpty)
                        .opacity(trimmedTitle.isEmpty ? 0.5 : 1)

                        if !isNew {
                            Button(role: .destructive) {
                                confirmDelete = true
                            } label: {
                                Label("Delete task", systemImage: "flame")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(GothicButtonStyle())
                        }
                    }
                    .padding(20)
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .font(Fonts.body(18))
                }
            }
            .confirmationDialog("Delete this task?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) {
                    sound.play(.extinguish)
                    store.delete(task)
                    dismiss()
                }
            }
            .onAppear { if isNew { titleFocused = true } }
        }
        .presentationBackground(Theme.ink)
    }

    private var trimmedTitle: String { task.title.trimmingCharacters(in: .whitespacesAndNewlines) }

    private var currentKind: Kind { task.cadence.isDaily ? .daily : .weekly }

    private func setKind(_ kind: Kind) {
        sound.play(.tap, volume: 0.6)
        withAnimation(.easeInOut(duration: 0.2)) {
            task.cadence = kind == .daily ? .daily : .weekly(weekday: nil)
        }
    }

    private var selectedWeekday: Int? {
        if case .weekly(let day) = task.cadence { return day }
        return nil
    }

    private var weekdayPicker: some View {
        let calendar = Calendar.current
        // Start the row on the locale's first weekday.
        let order = (0..<7).map { (calendar.firstWeekday - 1 + $0) % 7 + 1 }
        return VStack(spacing: 10) {
            chip("Any day of the week", selected: selectedWeekday == nil) {
                sound.play(.tap, volume: 0.6)
                task.cadence = .weekly(weekday: nil)
            }
            HStack(spacing: 6) {
                ForEach(order, id: \.self) { day in
                    chip(String(calendar.shortWeekdaySymbols[day - 1].prefix(2)), selected: selectedWeekday == day, compact: true) {
                        sound.play(.tap, volume: 0.6)
                        task.cadence = .weekly(weekday: day)
                    }
                }
            }
        }
    }

    private var explanation: String {
        switch task.cadence {
        case .daily:
            return "Comes back every morning. Vigil calls about it until you mark it done for the day."
        case .weekly(nil):
            return "Once per week, on any day. Vigil reminds you until it's done, then stays quiet until next week."
        case .weekly(let day?):
            return "Due every \(Calendar.current.weekdaySymbols[day - 1]). Vigil calls about it that day."
        }
    }

    private func field<Content: View>(label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label.uppercased())
                .font(Fonts.heading(14))
                .tracking(1.5)
                .foregroundStyle(Theme.gold)
            StoneCard { content().frame(maxWidth: .infinity, alignment: .leading) }
        }
    }

    private func chip(_ title: String, selected: Bool, compact: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(Fonts.heading(compact ? 15 : 18))
                .foregroundStyle(selected ? Theme.bone : Theme.ash)
                .frame(maxWidth: .infinity, minHeight: compact ? 38 : 44)
                .background(Capsule().fill(selected ? Theme.oxblood : Theme.ink.opacity(0.6)))
                .overlay(Capsule().strokeBorder(selected ? Theme.crimson : Theme.goldDim.opacity(0.5), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func save() {
        task.title = trimmedTitle
        task.note = task.note.trimmingCharacters(in: .whitespacesAndNewlines)
        sound.play(.complete, volume: 0.6)
        if isNew { store.add(task) } else { store.update(task) }
        dismiss()
    }
}
