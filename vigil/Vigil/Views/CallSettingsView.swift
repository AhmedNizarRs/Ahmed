import SwiftUI

struct CallSettingsView: View {
    @EnvironmentObject private var store: TaskStore
    @EnvironmentObject private var scheduler: CallScheduler
    @EnvironmentObject private var router: CallRouter
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var addingTime = false
    @State private var newTime = Calendar.current.date(bySettingHour: 12, minute: 0, second: 0, of: Date()) ?? Date()
    @State private var testScheduled = false

    private let sound = SoundBoard.shared

    var body: some View {
        NavigationStack {
            ZStack {
                GothicBackground(glow: 0.6)
                ScrollView {
                    VStack(spacing: 18) {
                        Text("The Calls")
                            .font(Fonts.blackletter(42))
                            .foregroundStyle(Theme.bone)
                            .padding(.top, 8)
                        Text("Vigil rings at these hours on any day that still has work left. Once everything is done, it stays quiet until tomorrow.")
                            .font(Fonts.italic(16))
                            .foregroundStyle(Theme.ash)
                            .multilineTextAlignment(.center)

                        permissionCard

                        StoneCard {
                            Toggle(isOn: Binding(get: { store.data.callsEnabled }, set: { value in
                                sound.play(.tap)
                                store.setCallsEnabled(value)
                            })) {
                                Text("Calls")
                                    .font(Fonts.heading(19))
                                    .foregroundStyle(Theme.bone)
                            }
                            .tint(Theme.crimson)
                        }

                        SectionTitle(text: "Hours", detail: "\(store.data.callTimes.count) calls a day")
                        ForEach(store.data.callTimes) { time in
                            StoneCard {
                                HStack {
                                    Image(systemName: "bell.fill")
                                        .foregroundStyle(Theme.crimson)
                                    Text(label(for: time))
                                        .font(Fonts.body(22))
                                        .foregroundStyle(Theme.bone)
                                    Spacer()
                                    Button {
                                        sound.play(.extinguish, volume: 0.6)
                                        store.setCallTimes(store.data.callTimes.filter { $0 != time })
                                    } label: {
                                        Image(systemName: "xmark.circle")
                                            .font(.title3)
                                            .foregroundStyle(Theme.ash)
                                    }
                                    .accessibilityLabel("Remove \(label(for: time))")
                                }
                            }
                        }

                        if addingTime {
                            StoneCard {
                                VStack(spacing: 12) {
                                    DatePicker("Time", selection: $newTime, displayedComponents: .hourAndMinute)
                                        .datePickerStyle(.wheel)
                                        .labelsHidden()
                                        .colorScheme(.dark)
                                    Button("Add this hour") {
                                        let parts = Calendar.current.dateComponents([.hour, .minute], from: newTime)
                                        store.setCallTimes(store.data.callTimes + [CallTime(hour: parts.hour ?? 12, minute: parts.minute ?? 0)])
                                        sound.play(.complete, volume: 0.6)
                                        addingTime = false
                                    }
                                    .buttonStyle(GothicButtonStyle(filled: true))
                                }
                            }
                        } else {
                            Button {
                                sound.play(.tap)
                                addingTime = true
                            } label: {
                                Label("Add an hour", systemImage: "plus")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(GothicButtonStyle())
                        }

                        SectionTitle(text: "Try It", detail: nil)
                        Button {
                            dismiss()
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { router.ring() }
                        } label: {
                            Label("Call me now", systemImage: "phone.fill")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(GothicButtonStyle(filled: true))

                        Button {
                            Task {
                                await scheduler.scheduleTestCall()
                                testScheduled = true
                            }
                        } label: {
                            Label(testScheduled ? "Test call set for 1 minute from now" : "Test the alarm in 1 minute", systemImage: "alarm")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(GothicButtonStyle())
                        .disabled(scheduler.method == .none)
                        Text("Lock your phone after setting the test: the call should ring like an alarm.")
                            .font(Fonts.italic(14))
                            .foregroundStyle(Theme.ash)
                            .multilineTextAlignment(.center)

                        SectionTitle(text: "Sound", detail: nil)
                        StoneCard {
                            VStack(spacing: 14) {
                                Toggle(isOn: Binding(get: { store.data.soundEnabled }, set: { store.setSoundEnabled($0) })) {
                                    Text("Sound effects").font(Fonts.body(19)).foregroundStyle(Theme.bone)
                                }
                                Toggle(isOn: Binding(get: { store.data.voiceEnabled }, set: { store.setVoiceEnabled($0) })) {
                                    Text("Voice reads your tasks").font(Fonts.body(19)).foregroundStyle(Theme.bone)
                                }
                            }
                            .tint(Theme.crimson)
                        }
                        Text("For a deeper voice, download \"Daniel (Enhanced)\" or another British voice in Settings › Accessibility › Spoken Content › Voices › English.")
                            .font(Fonts.italic(14))
                            .foregroundStyle(Theme.ash)
                            .multilineTextAlignment(.center)
                            .padding(.bottom, 30)
                    }
                    .padding(20)
                }
            }
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .font(Fonts.heading(18))
                }
            }
            .task { await scheduler.updateNotificationStatus() }
        }
        .presentationBackground(Theme.ink)
    }

    @ViewBuilder
    private var permissionCard: some View {
        StoneCard(highlighted: scheduler.method == .none) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 10) {
                    Image(systemName: statusIcon)
                        .foregroundStyle(scheduler.method == .none ? Theme.crimson : Theme.gold)
                    Text(statusTitle)
                        .font(Fonts.heading(18))
                        .foregroundStyle(Theme.bone)
                }
                Text(statusDetail)
                    .font(Fonts.italic(15))
                    .foregroundStyle(Theme.ash)
                if let error = scheduler.lastError {
                    Text(error)
                        .font(Fonts.italic(14))
                        .foregroundStyle(Theme.crimson)
                }
                if scheduler.alarmAuthorization == .notDetermined {
                    Button("Allow alarm calls") {
                        Task {
                            await scheduler.requestPermissions()
                            scheduler.refresh(with: store.plannedCalls)
                        }
                    }
                    .buttonStyle(GothicButtonStyle(filled: true))
                } else if scheduler.alarmAuthorization == .denied {
                    Button("Open Settings") {
                        if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                    }
                    .buttonStyle(GothicButtonStyle())
                }
            }
        }
    }

    private var statusIcon: String {
        switch scheduler.method {
        case .alarms: return "alarm.waves.left.and.right.fill"
        case .notifications: return "bell.badge.fill"
        case .none: return "exclamationmark.triangle.fill"
        }
    }

    private var statusTitle: String {
        switch scheduler.method {
        case .alarms: return "Calls ring as alarms"
        case .notifications: return "Calls arrive as notifications"
        case .none: return "Vigil can't call you yet"
        }
    }

    private var statusDetail: String {
        switch scheduler.method {
        case .alarms:
            return "Full-screen with the bell, even in Silent mode or a Focus. Tap Answer to hear your tasks. \(scheduler.scheduledCount) calls are set for the coming week."
        case .notifications:
            return "Alarms are off, so calls come as notifications and Silent mode will mute them. Turn on Alarms for Vigil in Settings for real ringing."
        case .none:
            return "Allow alarms so Vigil can ring you through the day."
        }
    }

    private func label(for time: CallTime) -> String {
        let date = Calendar.current.date(bySettingHour: time.hour, minute: time.minute, second: 0, of: Date()) ?? Date()
        return date.formatted(date: .omitted, time: .shortened)
    }
}
