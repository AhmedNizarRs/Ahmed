import Foundation

// Task rules and call planning. Foundation only, so they can be unit
// tested on their own (see Tests/main.swift).

/// How often a task comes due.
enum Cadence: Codable, Hashable, Sendable {
    /// Every day.
    case daily
    /// Once a week: on a set weekday (1 = Sunday … 7 = Saturday, like Calendar),
    /// or on any day of the week when `weekday` is nil.
    case weekly(weekday: Int?)

    var isDaily: Bool { self == .daily }
}

struct VigilTask: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var title: String
    var note: String = ""
    var cadence: Cadence
    var createdAt = Date()
    /// Period keys (see `periodKey`) in which the task was done.
    var completions: Set<String> = []

    /// Whether the task is part of the given day's work.
    func isDue(on date: Date, calendar: Calendar) -> Bool {
        switch cadence {
        case .daily, .weekly(weekday: nil):
            return true
        case .weekly(let weekday?):
            return calendar.component(.weekday, from: date) == weekday
        }
    }

    /// The span one completion counts for: a day, or the whole week for
    /// weekly tasks without a set day.
    func periodKey(on date: Date, calendar: Calendar) -> String {
        switch cadence {
        case .weekly(weekday: nil):
            return Periods.weekKey(date, calendar: calendar)
        default:
            return Periods.dayKey(date, calendar: calendar)
        }
    }

    func isDone(on date: Date, calendar: Calendar) -> Bool {
        completions.contains(periodKey(on: date, calendar: calendar))
    }

    func isPending(on date: Date, calendar: Calendar) -> Bool {
        isDue(on: date, calendar: calendar) && !isDone(on: date, calendar: calendar)
    }

    mutating func setDone(_ done: Bool, on date: Date, calendar: Calendar) {
        let key = periodKey(on: date, calendar: calendar)
        if done { completions.insert(key) } else { completions.remove(key) }
        // Old completions only matter for the current period; keep the file small.
        if completions.count > 60 {
            completions = Set(completions.sorted().suffix(30))
        }
    }
}

enum Periods {
    static func dayKey(_ date: Date, calendar: Calendar) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "D%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    static func weekKey(_ date: Date, calendar: Calendar) -> String {
        let c = calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: date)
        return String(format: "W%04d-%02d", c.yearForWeekOfYear ?? 0, c.weekOfYear ?? 0)
    }
}

/// A time of day for Vigil to call.
struct CallTime: Codable, Hashable, Comparable, Sendable, Identifiable {
    var hour: Int
    var minute: Int

    var id: Int { hour * 60 + minute }

    static func < (a: CallTime, b: CallTime) -> Bool { a.id < b.id }

    static let defaults = [CallTime(hour: 9, minute: 0), CallTime(hour: 13, minute: 0),
                           CallTime(hour: 17, minute: 30), CallTime(hour: 21, minute: 0)]
}

struct PlannedCall: Equatable, Sendable {
    let date: Date
    /// Titles of the tasks still waiting at that time, daily ones first.
    let pending: [String]
}

enum CallPlanner {
    /// Every call in the coming `days` days that has something to remind
    /// about. A day whose work is all done gets no more calls.
    static func plan(tasks: [VigilTask], times: [CallTime], from now: Date, days: Int = 7,
                     limit: Int = 60, calendar: Calendar) -> [PlannedCall] {
        var calls: [PlannedCall] = []
        let today = calendar.startOfDay(for: now)
        for offset in 0..<days {
            guard let day = calendar.date(byAdding: .day, value: offset, to: today) else { continue }
            for time in Set(times).sorted() {
                guard let date = calendar.date(bySettingHour: time.hour, minute: time.minute, second: 0, of: day),
                      date > now else { continue }
                let pending = pendingTitles(tasks, on: date, calendar: calendar)
                if !pending.isEmpty { calls.append(PlannedCall(date: date, pending: pending)) }
                if calls.count == limit { return calls }
            }
        }
        return calls
    }

    static func pendingTitles(_ tasks: [VigilTask], on date: Date, calendar: Calendar) -> [String] {
        let waiting = tasks.filter { $0.isPending(on: date, calendar: calendar) }
        let dayFirst = waiting.filter { if case .weekly(weekday: nil) = $0.cadence { return false } else { return true } }
            + waiting.filter { if case .weekly(weekday: nil) = $0.cadence { return true } else { return false } }
        return dayFirst.map(\.title)
    }

    /// What the alarm says, e.g. "3 tasks await: Feed the cat, Gym, Pay rent".
    static func alarmTitle(for call: PlannedCall) -> String {
        let count = call.pending.count
        let head = count == 1 ? "1 task awaits" : "\(count) tasks await"
        let names = call.pending.prefix(3).joined(separator: ", ")
        let more = count > 3 ? "…" : ""
        return "\(head): \(names)\(more)"
    }
}
