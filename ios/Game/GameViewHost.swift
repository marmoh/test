import SpriteKit
import SwiftUI

/// Héberge la scène de combat dans SwiftUI (une `SKView` réglée à 60 i/s, ordre des enfants ignoré).
struct GameViewHost: UIViewRepresentable {
    let scene: GameScene

    func makeUIView(context: Context) -> SKView {
        let v = SKView(frame: .zero)
        v.preferredFramesPerSecond = 60
        v.ignoresSiblingOrder = true
        v.isMultipleTouchEnabled = true
        v.shouldCullNonVisibleNodes = true
        v.backgroundColor = Ink.curtain
        #if DEBUG
        v.showsFPS = false
        v.showsNodeCount = false
        #endif
        v.presentScene(scene)
        return v
    }

    func updateUIView(_ view: SKView, context: Context) {
        if view.scene !== scene { view.presentScene(scene) }
    }

    static func dismantleUIView(_ view: SKView, coordinator: ()) {
        view.presentScene(nil)
    }
}
