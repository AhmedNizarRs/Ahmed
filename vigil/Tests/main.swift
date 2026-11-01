// Unit tests for Vigil's task rules and call planning.
// Run on a Mac:
//   swiftc -O Vigil/Model/Tasks.swift Tests/main.swift -o /tmp/vigiltests && /tmp/vigiltests

import Foundation

var failures = 0

func check(_ condition: @autoclosure () -> Bool, _ message: String, line: Int = #line) {
    if condition() {
        print("  ok   \(message)")
    } else {
        failures += 1
        print("  FAIL \(message) (line \(line))")
    }
}

var calendar = Calendar(identifier: .gregorian)
calendar.timeZone = TimeZone(identifier: "Europe/London")!
calendar.firstWeekday = 2 // Monday

func date(_ y: Int, _ m: Int, _ d: Int, _ h: Int = 12, _ min: Int = 0) -> Date {
    calendar.date(from: DateComponents(year: y, month: m, day: d, hour: h, minute: min))!
}

// 2026-11-02 is a Monday.
let monday = date(2026, 11, 2)
let tuesday = date(2026, 11, 3)
let sunday = date(2026, 11, 8)
let nextMonday = date(2026, 11, 9)

print("Due dates")
do {
    let daily = VigilTask(title: "Water plants", cadence: .daily)
    let onTuesday = VigilTask(title: "Bins out", cadence: .weekly(weekday: 3))
    let anyDay = VigilTask(title: "Call grandma", cadence: .weekly(weekday: nil))
    check(daily.isDue(on: monday, calendar: calendar) && daily.isDue(on: sunday, calendar: calendar), "daily tasks are due every day")
    check(!onTuesday.isDue(on: monday, calendar: calendar) && onTuesday.isDue(on: tuesday, calendar: calendar), "weekday tasks are due only on their day")
    check(anyDay.isDue(on: monday, calendar: calendar) && anyDay.isDue(on: sunday, calendar: calendar), "any-day weekly tasks are due all week")
}

print("Completions")
do {
    var daily = VigilTask(title: "Water plants", cadence: .daily)
    daily.setDone(true, on: monday, calendar: calendar)
    check(daily.isDone(on: monday, calendar: calendar), "done today")
    check(!daily.isDone(on: tuesday, calendar: calendar), "daily task comes back the next day")
    daily.setDone(false, on: monday, calendar: calendar)
    check(!daily.isDone(on: monday, calendar: calendar), "can be un-done")

    var anyDay = VigilTask(title: "Call grandma", cadence: .weekly(weekday: nil))
    anyDay.setDone(true, on: tuesday, calendar: calendar)
    check(anyDay.isDone(on: monday, calendar: calendar) && anyDay.isDone(on: sunday, calendar: calendar), "any-day weekly task stays done all week")
    check(!anyDay.isDone(on: nextMonday, calendar: calendar), "and comes back next week (weeks start Monday)")

    var many = VigilTask(title: "Old", cadence: .daily)
    for d in 0..<100 { many.setDone(true, on: date(2026, 1, 1).addingTimeInterval(Double(d) * 86400), calendar: calendar) }
    check(many.completions.count <= 60, "old completions are trimmed (\(many.completions.count) kept)")
    check(many.isDone(on: date(2026, 1, 1).addingTimeInterval(99 * 86400), calendar: calendar), "the latest completion survives trimming")
}

print("Call planning")
do {
    var water = VigilTask(title: "Water plants", cadence: .daily)
    let bins = VigilTask(title: "Bins out", cadence: .weekly(weekday: 3))
    let grandma = VigilTask(title: "Call grandma", cadence: .weekly(weekday: nil))
    let times = [CallTime(hour: 9, minute: 0), CallTime(hour: 13, minute: 0), CallTime(hour: 21, minute: 0)]
    let now = date(2026, 11, 2, 10, 30) // Monday 10:30

    let plan = CallPlanner.plan(tasks: [water, bins, grandma], times: times, from: now, days: 7, calendar: calendar)
    check(plan.first?.date == date(2026, 11, 2, 13, 0), "first call is the next time today, not one that passed")
    check(plan.count == 2 + 6 * 3, "calls for the rest of today and six more days (got \(plan.count))")
    check(plan.first?.pending == ["Water plants", "Call grandma"], "Monday reminds about daily and this week's tasks")
    let tuesdayCall = plan.first { calendar.isDate($0.date, inSameDayAs: tuesday) }
    check(tuesdayCall?.pending == ["Water plants", "Bins out", "Call grandma"], "Tuesday adds its weekday task, any-day tasks last")
    check(zip(plan, plan.dropFirst()).allSatisfy { $0.date < $1.date }, "calls are in time order")

    // Everything done today: no more calls today.
    water.setDone(true, on: now, calendar: calendar)
    var grandmaDone = grandma
    grandmaDone.setDone(true, on: now, calendar: calendar)
    let quiet = CallPlanner.plan(tasks: [water, bins, grandmaDone], times: times, from: now, days: 7, calendar: calendar)
    check(!quiet.contains { calendar.isDate($0.date, inSameDayAs: now) }, "a finished day gets no more calls")
    check(quiet.first.map { calendar.isDate($0.date, inSameDayAs: tuesday) } == true, "calls resume tomorrow")
    check(!quiet.contains { $0.pending.contains("Call grandma") }, "a weekly task done this week isn't nagged about again")

    check(CallPlanner.plan(tasks: [], times: times, from: now, calendar: calendar).isEmpty, "no tasks, no calls")
    check(CallPlanner.plan(tasks: [bins], times: times, from: now, calendar: calendar).allSatisfy { calendar.component(.weekday, from: $0.date) == 3 }, "a weekday-only list calls on that day only")
    check(CallPlanner.plan(tasks: [water], times: times, from: now, days: 7, limit: 5, calendar: calendar).count == 5, "the limit is respected")
    let duplicates = CallPlanner.plan(tasks: [water], times: times + times, from: now, days: 1, calendar: calendar)
    check(duplicates.count == 2, "duplicate times don't double-call")
}

print("Alarm text")
do {
    let call = PlannedCall(date: monday, pending: ["Feed cat", "Gym", "Pay rent", "Read"])
    check(CallPlanner.alarmTitle(for: call) == "4 tasks await: Feed cat, Gym, Pay rent…", "lists the first three tasks")
    check(CallPlanner.alarmTitle(for: PlannedCall(date: monday, pending: ["Gym"])) == "1 task awaits: Gym", "singular for one task")
}

print("Saving")
do {
    let tasks = [VigilTask(title: "A", cadence: .daily), VigilTask(title: "B", cadence: .weekly(weekday: 5)), VigilTask(title: "C", cadence: .weekly(weekday: nil))]
    let data = try! JSONEncoder().encode(tasks)
    let back = try! JSONDecoder().decode([VigilTask].self, from: data)
    check(back == tasks, "tasks survive a save and load")
}

if failures > 0 {
    print("\n\(failures) check(s) failed")
    exit(1)
}
print("\nAll checks passed")
