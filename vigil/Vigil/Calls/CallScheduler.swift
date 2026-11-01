import ActivityKit
import AlarmKit
import AppIntents
import SwiftUI
import UserNotifications

/// Shown by the system with every alarm call.
struct VigilCallMetadata: AlarmMetadata {
    var pendingCount: Int
}

/// The "Answer" button on Vigil's alarm: opens the app straight into the call.
struct AnswerCallIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Answer Vigil"
    static var description = IntentDescription("Opens Vigil and reads out your waiting tasks.")
    static var openAppWhenRun = true

    init() {}

    func perform() async throws -> some IntentResult {
        await MainActor.run { CallRouter.shared.ring(answered: true) }
        return .result()
    }
}

/// Decides when the in-app call screen shows.
@MainActor
final class CallRouter: ObservableObject {
    static let shared = CallRouter()

    enum Call: Identifiable, Equatable {
        case incoming
        case answered
        var id: Int { self == .incoming ? 0 : 1 }
    }

    @Published var call: Call?

    /// `answered` skips the ringing screen (the alarm already rang).
    func ring(answered: Bool = false) {
        call = answered ? .answered : .incoming
    }
}

/// Puts Vigil's calls on the system schedule.
///
/// With AlarmKit (iOS 26) each call rings like a Clock alarm, full screen,
/// even in Silent mode or a Focus. Without alarm permission, Vigil falls
/// back to time-sensitive notifications with the bell sound.
@MainActor
final class CallScheduler: NSObject, ObservableObject {
    enum Method: Equatable {
        case alarms
        case notifications
        case none
    }

    @Published private(set) var alarmAuthorization: AlarmManager.AuthorizationState = .notDetermined
    @Published private(set) var notificationsAllowed = false
    @Published private(set) var scheduledCount = 0
    @Published private(set) var lastError: String?

    private let alarms = AlarmManager.shared
    private let center = UNUserNotificationCenter.current()
    private var refreshTask: Task<Void, Never>?
    static let soundName = "toll.wav"
    static let categoryID = "VIGIL_CALL"

    var method: Method {
        if alarmAuthorization == .authorized { return .alarms }
        if notificationsAllowed { return .notifications }
        return .none
    }

    override init() {
        super.init()
        alarmAuthorization = alarms.authorizationState
        center.delegate = self
        let answer = UNNotificationAction(identifier: "ANSWER", title: "Answer", options: [.foreground])
        center.setNotificationCategories([UNNotificationCategory(identifier: Self.categoryID, actions: [answer], intentIdentifiers: [])])
        Task { await updateNotificationStatus() }
    }

    func requestPermissions() async {
        do {
            alarmAuthorization = try await alarms.requestAuthorization()
        } catch {
            alarmAuthorization = alarms.authorizationState
        }
        if alarmAuthorization != .authorized {
            _ = try? await center.requestAuthorization(options: [.alert, .sound, .badge])
        }
        await updateNotificationStatus()
    }

    func updateNotificationStatus() async {
        let settings = await center.notificationSettings()
        notificationsAllowed = settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional
        alarmAuthorization = alarms.authorizationState
    }

    /// Replaces every scheduled call with a fresh plan.
    func refresh(with calls: [PlannedCall]) {
        refreshTask?.cancel()
        refreshTask = Task { await apply(calls) }
    }

    private func apply(_ calls: [PlannedCall]) async {
        await updateNotificationStatus()
        lastError = nil
        removeAllAlarms()
        center.removeAllPendingNotificationRequests()

        switch method {
        case .alarms:
            var count = 0
            for call in calls {
                if Task.isCancelled { return }
                do {
                    try await scheduleAlarm(for: call)
                    count += 1
                } catch AlarmManager.AlarmError.maximumLimitReached {
                    break
                } catch {
                    lastError = "An alarm couldn't be set: \(error.localizedDescription)"
                }
            }
            scheduledCount = count
        case .notifications:
            for call in calls.prefix(60) {
                try? await center.add(notification(for: call))
            }
            scheduledCount = min(60, calls.count)
        case .none:
            scheduledCount = 0
        }
    }

    /// A single test call one minute from now.
    func scheduleTestCall() async {
        let call = PlannedCall(date: Date().addingTimeInterval(60), pending: ["This is a test call"])
        switch method {
        case .alarms: try? await scheduleAlarm(for: call)
        case .notifications: try? await center.add(notification(for: call))
        case .none: break
        }
    }

    private func removeAllAlarms() {
        guard alarmAuthorization == .authorized, let existing = try? alarms.alarms else { return }
        for alarm in existing { try? alarms.cancel(id: alarm.id) }
    }

    private func scheduleAlarm(for call: PlannedCall) async throws {
        let title = LocalizedStringResource(stringLiteral: CallPlanner.alarmTitle(for: call))
        let answer = AlarmButton(text: "Answer", textColor: Theme.bone, systemImageName: "phone.fill")
        let alert: AlarmPresentation.Alert
        if #available(iOS 26.1, *) {
            alert = AlarmPresentation.Alert(title: title, secondaryButton: answer, secondaryButtonBehavior: .custom)
        } else {
            let silence = AlarmButton(text: "Silence", textColor: Theme.bone, systemImageName: "bell.slash.fill")
            alert = AlarmPresentation.Alert(title: title, stopButton: silence, secondaryButton: answer, secondaryButtonBehavior: .custom)
        }
        let attributes = AlarmAttributes(
            presentation: AlarmPresentation(alert: alert),
            metadata: VigilCallMetadata(pendingCount: call.pending.count),
            tintColor: Theme.crimson
        )
        let configuration = AlarmManager.AlarmConfiguration.alarm(
            schedule: .fixed(call.date),
            attributes: attributes,
            secondaryIntent: AnswerCallIntent(),
            sound: .named(Self.soundName)
        )
        _ = try await alarms.schedule(id: UUID(), configuration: configuration)
    }

    private func notification(for call: PlannedCall) -> UNNotificationRequest {
        let content = UNMutableNotificationContent()
        content.title = "Vigil is calling"
        content.body = CallPlanner.alarmTitle(for: call)
        content.sound = UNNotificationSound(named: UNNotificationSoundName(Self.soundName))
        content.interruptionLevel = .timeSensitive
        content.categoryIdentifier = Self.categoryID
        let parts = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: call.date)
        let trigger = UNCalendarNotificationTrigger(dateMatching: parts, repeats: false)
        return UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: trigger)
    }
}

extension CallScheduler: UNUserNotificationCenterDelegate {
    /// While Vigil is open, a due call goes straight to the call screen.
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                            withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        Task { @MainActor in CallRouter.shared.ring() }
        completionHandler([])
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                            withCompletionHandler completionHandler: @escaping () -> Void) {
        let answered = response.actionIdentifier == "ANSWER"
        Task { @MainActor in CallRouter.shared.ring(answered: answered) }
        completionHandler()
    }
}
