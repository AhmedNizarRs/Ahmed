import Foundation
import SwiftUI

/// Everything Vigil remembers, saved as one JSON file.
struct VigilData: Codable {
    var tasks: [VigilTask] = []
    var callTimes: [CallTime] = CallTime.defaults
    var callsEnabled = true
    var soundEnabled = true
    var voiceEnabled = true
    var hasSeenWelcome = false

    init() {}

    // Older files may miss newer keys; fall back to defaults.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        tasks = try c.decodeIfPresent([VigilTask].self, forKey: .tasks) ?? []
        callTimes = try c.decodeIfPresent([CallTime].self, forKey: .callTimes) ?? CallTime.defaults
        callsEnabled = try c.decodeIfPresent(Bool.self, forKey: .callsEnabled) ?? true
        soundEnabled = try c.decodeIfPresent(Bool.self, forKey: .soundEnabled) ?? true
        voiceEnabled = try c.decodeIfPresent(Bool.self, forKey: .voiceEnabled) ?? true
        hasSeenWelcome = try c.decodeIfPresent(Bool.self, forKey: .hasSeenWelcome) ?? false
    }
}

@MainActor
final class TaskStore: ObservableObject {
    @Published private(set) var data = VigilData()
    /// Bumped when the day may have changed, so views recompute "today".
    @Published var now = Date()

    let calendar = Calendar.current
    private let fileURL: URL
    /// Called after anything that affects the call schedule.
    var onScheduleChange: (@MainActor () -> Void)?

    init() {
        let folder = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        fileURL = folder.appendingPathComponent("vigil.json")
        if let saved = try? Data(contentsOf: fileURL), let decoded = try? JSONDecoder().decode(VigilData.self, from: saved) {
            data = decoded
        }
    }

    // MARK: Reading

    var tasks: [VigilTask] { data.tasks }

    /// Today's work: daily tasks and weekly tasks set for today.
    var todayTasks: [VigilTask] {
        data.tasks.filter { task in
            if case .weekly(weekday: nil) = task.cadence { return false }
            return task.isDue(on: now, calendar: calendar)
        }
    }

    /// Weekly tasks with no set day.
    var thisWeekTasks: [VigilTask] {
        data.tasks.filter { if case .weekly(weekday: nil) = $0.cadence { return true } else { return false } }
    }

    /// Weekly tasks set for a different day than today, in weekday order from tomorrow.
    var laterThisWeekTasks: [VigilTask] {
        let today = calendar.component(.weekday, from: now)
        return data.tasks
            .filter { if case .weekly(let day?) = $0.cadence { return day != today } else { return false } }
            .sorted { daysUntil($0, from: today) < daysUntil($1, from: today) }
    }

    var pendingNow: [VigilTask] {
        data.tasks.filter { $0.isPending(on: now, calendar: calendar) }
    }

    func isDone(_ task: VigilTask) -> Bool { task.isDone(on: now, calendar: calendar) }

    var plannedCalls: [PlannedCall] {
        guard data.callsEnabled else { return [] }
        return CallPlanner.plan(tasks: data.tasks, times: data.callTimes, from: Date(), calendar: calendar)
    }

    private func daysUntil(_ task: VigilTask, from today: Int) -> Int {
        guard case .weekly(let day?) = task.cadence else { return 0 }
        return (day - today + 7) % 7
    }

    // MARK: Changing

    func add(_ task: VigilTask) {
        data.tasks.append(task)
        save(scheduleChanged: true)
    }

    func update(_ task: VigilTask) {
        guard let index = data.tasks.firstIndex(where: { $0.id == task.id }) else { return }
        data.tasks[index] = task
        save(scheduleChanged: true)
    }

    func delete(_ task: VigilTask) {
        data.tasks.removeAll { $0.id == task.id }
        save(scheduleChanged: true)
    }

    func toggle(_ task: VigilTask) {
        guard let index = data.tasks.firstIndex(where: { $0.id == task.id }) else { return }
        let done = data.tasks[index].isDone(on: now, calendar: calendar)
        data.tasks[index].setDone(!done, on: now, calendar: calendar)
        save(scheduleChanged: true)
    }

    func setCallTimes(_ times: [CallTime]) {
        data.callTimes = Array(Set(times)).sorted()
        save(scheduleChanged: true)
    }

    func setCallsEnabled(_ enabled: Bool) {
        data.callsEnabled = enabled
        save(scheduleChanged: true)
    }

    func setSoundEnabled(_ enabled: Bool) {
        data.soundEnabled = enabled
        save(scheduleChanged: false)
    }

    func setVoiceEnabled(_ enabled: Bool) {
        data.voiceEnabled = enabled
        save(scheduleChanged: false)
    }

    func markWelcomeSeen() {
        data.hasSeenWelcome = true
        save(scheduleChanged: false)
    }

    func refreshDay() {
        now = Date()
    }

    private func save(scheduleChanged: Bool) {
        if let encoded = try? JSONEncoder().encode(data) {
            try? encoded.write(to: fileURL, options: .atomic)
        }
        if scheduleChanged { onScheduleChange?() }
    }
}
