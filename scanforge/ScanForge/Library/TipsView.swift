import SwiftUI

struct TipsView: View {
    @Environment(\.dismiss) private var dismiss

    private let tips: [(icon: String, title: String, text: String)] = [
        ("sun.max", "Bright, even light", "Daylight or several lamps. Avoid hard shadows and direct sun."),
        ("square.dashed", "Plain background", "Put the object on a plain, non-shiny table with room to walk all the way around."),
        ("figure.walk", "Move slowly", "Keep the object in the middle of the screen and circle it at a steady pace."),
        ("arrow.up.and.down", "Two heights", "Do one pass at object height and one from above so the top is captured."),
        ("arrow.triangle.2.circlepath", "Flip for the bottom", "Turn the object on its side for a third pass if you need the underside in your print."),
        ("hand.raised", "Best objects", "Matte, textured things scan best: shoe-box size down to about a mug. Shiny, see-through, very thin or plain white objects scan poorly. A light dusting of matte spray or chalk powder helps."),
        ("ruler", "Check the size", "Scans are measured in real millimetres. Measure one side with a ruler and use Fit to size on the scan page if you need it exact."),
    ]

    var body: some View {
        NavigationStack {
            List(tips, id: \.title) { tip in
                HStack(alignment: .top, spacing: 14) {
                    Image(systemName: tip.icon)
                        .font(.title3)
                        .foregroundStyle(Color.accentColor)
                        .frame(width: 30)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(tip.title).font(.headline)
                        Text(tip.text).foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 4)
            }
            .navigationTitle("Scanning tips")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
