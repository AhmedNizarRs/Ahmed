import SwiftUI

@main
struct VigilApp: App {
    @StateObject private var store = TaskStore()
    @StateObject private var scheduler = CallScheduler()
    @StateObject private var router = CallRouter.shared
    @Environment(\.scenePhase) private var scenePhase

    init() {
        Fonts.register()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .environmentObject(scheduler)
                .environmentObject(router)
                .preferredColorScheme(.dark)
                .tint(Theme.gold)
                .onAppear {
                    store.onScheduleChange = { [weak store, weak scheduler] in
                        guard let store, let scheduler else { return }
                        scheduler.refresh(with: store.plannedCalls)
                    }
                    applyAudioSettings()
                }
                .onChange(of: scenePhase) { _, phase in
                    guard phase == .active else { return }
                    store.refreshDay()
                    scheduler.refresh(with: store.plannedCalls)
                }
                .onChange(of: store.data.soundEnabled) { _, _ in applyAudioSettings() }
                .onChange(of: store.data.voiceEnabled) { _, _ in applyAudioSettings() }
        }
    }

    private func applyAudioSettings() {
        SoundBoard.shared.enabled = store.data.soundEnabled
        SoundBoard.shared.voiceEnabled = store.data.voiceEnabled
    }
}

struct RootView: View {
    @EnvironmentObject private var store: TaskStore
    @EnvironmentObject private var scheduler: CallScheduler
    @EnvironmentObject private var router: CallRouter

    var body: some View {
        HomeView()
            .fullScreenCover(item: $router.call) { call in
                CallView(startAnswered: call == .answered)
            }
            .fullScreenCover(isPresented: Binding(get: { !store.data.hasSeenWelcome }, set: { _ in })) {
                WelcomeView()
            }
    }
}
