import SwiftUI
import UIKit

/// Jetons de couleur du combat (mêmes valeurs que `art/src/palette.ts` et `Theme.swift`).
enum Ink {
    static let ink = UIColor(hex: 0x1B1418)
    static let ink2 = UIColor(hex: 0x40333A)
    static let cut = UIColor(hex: 0xFFF4D6)
    static let danger = UIColor(hex: 0xD8431F)
    static let jade = UIColor(hex: 0x2B8A74)
    static let jadeLight = UIColor(hex: 0x8FD3BC)
    static let gold = UIColor(hex: 0xC9A13B)
    static let curtain = UIColor(hex: 0x2B1317)
    static let paper = UIColor(hex: 0xEFE3C6)
    static let paperDark = UIColor(hex: 0xD9C9A3)
    static let frost = UIColor(hex: 0x6F9FC4)
    static let poison = UIColor(hex: 0x5F8A63)
    static let common = UIColor(hex: 0x7D6F5F)
}

extension UIColor {
    convenience init(hex: UInt32, alpha: CGFloat = 1) {
        self.init(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: alpha)
    }
}

/// Royaume : seule la lumière derrière l'écran change (`docs/ART.md`, `KINGDOMS` de `palette.ts`).
struct KingdomTheme {
    enum Mote { case firefly, spore, sand, snow, ember }

    let id: Int
    let name: String
    let light: UIColor
    let paper: UIColor
    let edge: UIColor
    let far: UIColor
    let gel: UIColor
    let gelLight: UIColor
    let liquidIsLava: Bool
    let mote: Mote
    let sky: (UIColor, UIColor)
    /// Atlas de décor (`Decor_<Royaume>.atlas`).
    let atlas: String

    static let all: [KingdomTheme] = [
        KingdomTheme(id: 1, name: "Forêt d’Ombrelune", light: UIColor(hex: 0xF4E8C1), paper: UIColor(hex: 0xDDC993), edge: UIColor(hex: 0x6B6630), far: UIColor(hex: 0x9A915A), gel: UIColor(hex: 0x6FA39A), gelLight: UIColor(hex: 0xD3EBE1), liquidIsLava: false, mote: .firefly, sky: (UIColor(hex: 0xCDB878), UIColor(hex: 0xF4E8C1)), atlas: "Decor_Forest"),
        KingdomTheme(id: 2, name: "Marais des Lucioles", light: UIColor(hex: 0xE7EEC9), paper: UIColor(hex: 0xBDC88D), edge: UIColor(hex: 0x45512B), far: UIColor(hex: 0x86935D), gel: UIColor(hex: 0x5F8A63), gelLight: UIColor(hex: 0xD9EABC), liquidIsLava: false, mote: .spore, sky: (UIColor(hex: 0xA9B77A), UIColor(hex: 0xE7EEC9)), atlas: "Decor_Swamp"),
        KingdomTheme(id: 3, name: "Désert d’Ambre", light: UIColor(hex: 0xFBE4AB), paper: UIColor(hex: 0xEFB96B), edge: UIColor(hex: 0x87401F), far: UIColor(hex: 0xC98A4E), gel: UIColor(hex: 0x3F9E94), gelLight: UIColor(hex: 0xC2EFE4), liquidIsLava: false, mote: .sand, sky: (UIColor(hex: 0xE3A35A), UIColor(hex: 0xFBE4AB)), atlas: "Decor_Desert"),
        KingdomTheme(id: 4, name: "Pics de Givre", light: UIColor(hex: 0xF0F5F2), paper: UIColor(hex: 0xC0D5D9), edge: UIColor(hex: 0x3D586B), far: UIColor(hex: 0x8EA7B3), gel: UIColor(hex: 0x6F9FC4), gelLight: UIColor(hex: 0xE6F4FB), liquidIsLava: false, mote: .snow, sky: (UIColor(hex: 0x9FBAC4), UIColor(hex: 0xF0F5F2)), atlas: "Decor_Frost"),
        KingdomTheme(id: 5, name: "Terres de Cendres", light: UIColor(hex: 0xF3CBAB), paper: UIColor(hex: 0xCB8B74), edge: UIColor(hex: 0x3E1A22), far: UIColor(hex: 0x965A52), gel: UIColor(hex: 0xE8892A), gelLight: UIColor(hex: 0xFFD585), liquidIsLava: true, mote: .ember, sky: (UIColor(hex: 0xA8604F), UIColor(hex: 0xF3CBAB)), atlas: "Decor_Ash"),
    ]

    static func of(kingdom k: Int) -> KingdomTheme { all[max(0, min(all.count - 1, k - 1))] }
}

extension KingdomTheme {
    var lightColor: Color { Color(uiColor: light) }
    var paperColor: Color { Color(uiColor: paper) }
    var farColor: Color { Color(uiColor: far) }
    var edgeColor: Color { Color(uiColor: edge) }
    var skyTop: Color { Color(uiColor: sky.0) }
    var skyBottom: Color { Color(uiColor: sky.1) }
}

/// Valeurs pseudo-aléatoires du décor (`hashCell` de `art/src/arena-art.ts`) : mêmes emplacements que le web.
func hashCell(_ c: Int, _ r: Int, _ k: Int = 0) -> Double {
    var h = UInt32(truncatingIfNeeded: c &* 374_761_393 &+ r &* 668_265_263 &+ k &* 2_246_822_519)
    h = (h ^ (h >> 13)) &* 1_274_126_177
    return Double(h ^ (h >> 16)) / 4_294_967_296
}
