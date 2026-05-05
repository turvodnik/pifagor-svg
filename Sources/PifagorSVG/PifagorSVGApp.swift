import SwiftUI

@main
struct PifagorSVGApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .frame(minWidth: 1120, minHeight: 760)
        }
        .windowStyle(.titleBar)
        .commands {
            CommandGroup(replacing: .newItem) {}
        }
    }
}
