import SwiftUI

/// First launch: what Vigil does, and the alarm permission it needs.
struct WelcomeView: View {
    @EnvironmentObject private var store: TaskStore
    @EnvironmentObject private var scheduler: CallScheduler
    @State private var asking = false
    @State private var appeared = false

    var body: some View {
        ZStack {
            GothicBackground(glow: 1.2)
            ScrollView {
                VStack(spacing: 20) {
                    ZStack(alignment: .bottom) {
                        GothicArch()
                            .stroke(Theme.gold, lineWidth: 1.2)
                            .frame(width: 150, height: 196)
                        Candle(width: 28)
                            .padding(.bottom, 8)
                    }
                    .padding(.top, 24)
                    Text("Vigil")
                        .font(Fonts.blackletter(72))
                        .foregroundStyle(LinearGradient(colors: [Theme.bone, Theme.gold], startPoint: .top, endPoint: .bottom))
                        .shadow(color: Theme.crimson, radius: 18)
                    Text("A keeper of your daily and weekly tasks")
                        .font(Fonts.italic(19))
                        .foregroundStyle(Theme.ash)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                    VStack(alignment: .leading, spacing: 14) {
                        point("pencil.and.scribble", "Write down your daily and weekly tasks.")
                        point("bell.and.waves.left.and.right", "Vigil calls you several times a day, ringing like an alarm.")
                        point("phone.fill", "Answer, and a voice reads out what's still waiting.")
                        point("flame", "Finish the day's work and the calls stop until tomorrow.")
                    }
                    .padding(.horizontal, 28)
                    .padding(.top, 6)
                }
                .frame(maxWidth: .infinity)
                .padding(.bottom, 20)
            }
            .scrollBounceBehavior(.basedOnSize)
            .opacity(appeared ? 1 : 0)
            .animation(.easeIn(duration: 1.2), value: appeared)
        }
        // The button always stays on screen, whatever the screen size.
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 8) {
                Button {
                    begin()
                } label: {
                    Text(asking ? "One moment…" : "Allow calls and begin")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(GothicButtonStyle(filled: true))
                .disabled(asking)
                Text("iOS will ask to allow alarms. Say yes so the calls can ring.")
                    .font(Fonts.italic(14))
                    .foregroundStyle(Theme.ash)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, 24)
            .padding(.top, 12)
            .padding(.bottom, 8)
            .background(LinearGradient(colors: [.clear, Theme.ink.opacity(0.9), Theme.ink], startPoint: .top, endPoint: .bottom).ignoresSafeArea())
        }
        .onAppear {
            appeared = true
            SoundBoard.shared.play(.answer, volume: 0.6)
        }
    }

    private func begin() {
        asking = true
        Task {
            await scheduler.requestPermissions()
            store.markWelcomeSeen()
            scheduler.refresh(with: store.plannedCalls)
            SoundBoard.shared.play(.toll, volume: 0.7)
        }
    }

    private func point(_ icon: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon)
                .foregroundStyle(Theme.crimson)
                .frame(width: 26)
            Text(text)
                .font(Fonts.body(18))
                .foregroundStyle(Theme.bone.opacity(0.9))
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
