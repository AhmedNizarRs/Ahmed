import CoreText
import SwiftUI

enum Theme {
    static let ink = Color(red: 0.035, green: 0.024, blue: 0.031)
    static let stone = Color(red: 0.085, green: 0.06, blue: 0.068)
    static let stoneLight = Color(red: 0.13, green: 0.095, blue: 0.105)
    static let oxblood = Color(red: 0.42, green: 0.04, blue: 0.08)
    static let crimson = Color(red: 0.72, green: 0.07, blue: 0.16)
    static let ember = Color(red: 0.98, green: 0.55, blue: 0.2)
    static let gold = Color(red: 0.80, green: 0.65, blue: 0.38)
    static let goldDim = Color(red: 0.55, green: 0.44, blue: 0.27)
    static let bone = Color(red: 0.92, green: 0.87, blue: 0.78)
    static let ash = Color(red: 0.58, green: 0.52, blue: 0.48)
}

/// Gothic fonts bundled at build time (UnifrakturCook, IM Fell English),
/// with system serif fallbacks so the app still looks right without them.
enum Fonts {
    private static var names: [String: String] = [:]

    /// Registers every .ttf/.otf in the app bundle and remembers its PostScript name.
    static func register() {
        let urls = (Bundle.main.urls(forResourcesWithExtension: "ttf", subdirectory: nil) ?? [])
            + (Bundle.main.urls(forResourcesWithExtension: "otf", subdirectory: nil) ?? [])
        for url in urls {
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
            if let provider = CGDataProvider(url: url as CFURL), let font = CGFont(provider),
               let name = font.postScriptName as String? {
                names[url.deletingPathExtension().lastPathComponent] = name
            }
        }
    }

    private static func custom(_ file: String, size: CGFloat, relativeTo style: Font.TextStyle) -> Font? {
        guard let name = names[file] else { return nil }
        return .custom(name, size: size, relativeTo: style)
    }

    /// Blackletter for the name and big headings.
    static func blackletter(_ size: CGFloat) -> Font {
        custom("UnifrakturCook-Bold", size: size, relativeTo: .largeTitle)
            ?? .system(size: size, weight: .black, design: .serif)
    }

    /// Old-book serif for headings.
    static func heading(_ size: CGFloat) -> Font {
        custom("IMFeENsc28P", size: size, relativeTo: .headline)
            ?? .system(size: size, weight: .semibold, design: .serif).smallCaps()
    }

    static func body(_ size: CGFloat = 19) -> Font {
        custom("IMFeENrm28P", size: size, relativeTo: .body)
            ?? .system(size: size - 1, design: .serif)
    }

    static func italic(_ size: CGFloat = 17) -> Font {
        custom("IMFeENit28P", size: size, relativeTo: .body)
            ?? .system(size: size - 1, design: .serif).italic()
    }
}

extension Date {
    /// "Sunday, the 1st of November".
    var vigilLongDate: String {
        let calendar = Calendar.current
        let day = calendar.component(.day, from: self)
        let suffix: String
        switch day {
        case 11, 12, 13: suffix = "th"
        default:
            switch day % 10 {
            case 1: suffix = "st"
            case 2: suffix = "nd"
            case 3: suffix = "rd"
            default: suffix = "th"
            }
        }
        let weekday = formatted(.dateTime.weekday(.wide))
        let month = formatted(.dateTime.month(.wide))
        return "\(weekday), the \(day)\(suffix) of \(month)"
    }
}
