# Vigil: a gothic task keeper that calls you

Vigil keeps your daily and weekly tasks and **calls you several times a day** until they're done. Calls ring full-screen with a church bell, like the Clock app's alarms, even in Silent mode or a Focus. Tap **Answer** and a low voice reads out what's still waiting over an organ drone, and you can tick tasks off with a wax seal while it speaks.

Built for iPhone with iOS 26 (iPhone 17 Pro Max).

## How it works

- **Daily tasks** come back every morning.
- **Weekly tasks** come in two kinds:
  - on a set weekday, e.g. "Bins out" every Tuesday
  - once on any day of the week, e.g. "Call grandma", which stays done until next Monday
- **Calls:**
  - You pick the hours; the default is 9:00, 13:00, 17:30 and 21:00.
  - Vigil plans a week of calls and skips any call when that day's work is already done.
  - It refreshes the plan every time you open the app or change a task.
- **How calls arrive:**
  - Calls use **AlarmKit** (iOS 26), so they ring like a real alarm.
  - If alarms aren't allowed, Vigil falls back to notifications with the bell sound. Silent mode can mute those.
- **On the call:** the voice greets you by the time of day, reads each task, and ends with a warning ("The candle burns low. Do not tarry."). Tick tasks off right there.
- **Try it any time:**
  - The phone button calls you instantly.
  - **The Calls › Test the alarm in 1 minute** checks real ringing with the phone locked.

The iPhone doesn't let apps place real phone calls, so the alarm plus the in-app call screen is as close as iOS allows.

## Sound and look

- **Sounds**, all synthesized by `tools/make_sounds.py`, so there's nothing to license:
  - a great bell tolling over an organ chord (the call)
  - "Dies Irae" on a music box (ringtone)
  - an organ drone
  - small effects: a bright bell for a finished task, a wooden knock on taps, a candle being blown out on delete, a low toll on hang-up, and an organ swell on answer
- **Visuals:**
  - flickering candles that burn down as tasks get done, and go out when everything is done
  - pointed gothic arches, wax-seal checkboxes, drifting embers
  - black, oxblood and gold
- **Fonts:** UnifrakturCook (blackletter) and IM Fell English (both SIL Open Font License). The GitHub build downloads them; local builds without them fall back to the system serif.
- **Deeper voice:** download "Daniel (Enhanced)" in Settings › Accessibility › Spoken Content › Voices › English.

## Install

Same as ScanForge. Install `Vigil.ipa` with **Sideloadly** from a PC, or build `vigil/Vigil.xcodeproj` with Xcode 26 on a Mac using your Apple ID as the team. On first launch, allow **Alarms** when iOS asks. With a free Apple ID, reinstall every 7 days; your tasks are kept.

## Tests

```sh
cd vigil
swiftc -O Vigil/Model/Tasks.swift Tests/main.swift -o /tmp/vigiltests && /tmp/vigiltests
```
