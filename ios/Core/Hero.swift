import Foundation

/// §4 Héros : statistiques effectives (base × talents × pouvoirs) — port exact de `sim/src/hero.ts`.
public struct Talents: Codable, Equatable, Sendable {
    public var vigor: Int
    public var strength: Int
    public var agility: Int
    public var fortune: Int
    /// « Encre lente » : le fil dure plus longtemps (DECISIONS #71).
    public var ink: Int

    public init(vigor: Int = 0, strength: Int = 0, agility: Int = 0, fortune: Int = 0, ink: Int = 0) {
        self.vigor = vigor; self.strength = strength; self.agility = agility; self.fortune = fortune; self.ink = ink
    }

    private enum CodingKeys: String, CodingKey { case vigor, strength, agility, fortune, ink }

    /// Les sauvegardes d'avant « Encre lente » n'ont pas `ink` : rang 0.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        vigor = try c.decode(Int.self, forKey: .vigor)
        strength = try c.decode(Int.self, forKey: .strength)
        agility = try c.decode(Int.self, forKey: .agility)
        fortune = try c.decode(Int.self, forKey: .fortune)
        ink = try c.decodeIfPresent(Int.self, forKey: .ink) ?? 0
    }

    public static let none = Talents()
    public static func atRank(_ r: Int) -> Talents { Talents(vigor: r, strength: r, agility: r, fortune: r, ink: r) }
    /// Talents attendus au niveau n (bots, prototype).
    public static func forLevel(_ n: Int) -> Talents { atRank(expectedTalentRank(n)) }
}

public struct HeroStats: Equatable, Sendable {
    public var maxHp: Double
    public var damage: Double
    /// Multiplicateur des aiguilles seules (Multitir : −40 % par prise ; les découpes n'en pâtissent pas, DECISIONS #44).
    public var needleMult: Double
    public var fireRate: Double
    public var speed: Double
    public var multishot: Int
    public var rearShot: Bool
    public var diagonals: Bool
    public var sideShots: Bool
    public var ricochet: Int
    public var pierce: Bool
    public var wallBounce: Int
    public var critChance: Double
    public var eliteMult: Double
    public var flame: Bool
    public var frost: Bool
    public var chain: Bool
    public var poison: Bool
    public var blast: Bool
    public var orb: Bool
    public var shield: Bool
    public var lifesteal: Double
    public var dodge: Double
    public var flashStep: Bool
    public var magnet: Bool
    // Ciseaux de lune
    public var threadLife: Double
    public var steelThread: Bool
    public var barbedThread: Bool
    public var cutMult: Double
    public var echoCut: Bool
    public var confetti: Bool
}

public func computeStats(_ talents: Talents, _ powers: [PowerID: Int]) -> HeroStats {
    func n(_ id: PowerID) -> Int { powers[id] ?? 0 }
    let hpMult = (1 + TalentK.hpPerRank * Double(talents.vigor)) * (1 + 0.2 * Double(n(.maxHp)))
    let dmgMult = (1 + TalentK.damagePerRank * Double(talents.strength)) * (1 + 0.2 * Double(n(.damage)))
    let rateMult = (1 + TalentK.fireRatePerRank * Double(talents.agility)) * (1 + 0.25 * Double(n(.attackSpeed)))
    return HeroStats(
        maxHp: DMath.round(HeroK.hp * hpMult),
        damage: HeroK.damage * dmgMult,
        needleMult: DMath.pow(PowerTuning.multishotDmg, Double(n(.multishot))),
        fireRate: HeroK.fireRate * rateMult,
        speed: HeroK.speed * (1 + PowerTuning.speedPerStack * Double(n(.speed))),
        multishot: n(.multishot),
        rearShot: n(.rearShot) > 0,
        diagonals: n(.diagonals) > 0,
        sideShots: n(.sideShots) > 0,
        ricochet: n(.ricochet) > 0 ? PowerTuning.ricochetBounces : 0,
        pierce: n(.pierce) > 0,
        wallBounce: n(.wallBounce) > 0 ? 2 : 0,
        critChance: DMath.min(0.6, 0.15 * Double(n(.crit))),
        eliteMult: n(.eliteSlayer) > 0 ? 1.5 : 1,
        flame: n(.flame) > 0,
        frost: n(.frost) > 0,
        chain: n(.chain) > 0,
        poison: n(.poison) > 0,
        blast: n(.blast) > 0,
        orb: n(.orb) > 0,
        shield: n(.shield) > 0,
        lifesteal: n(.lifesteal) > 0 ? 0.02 : 0,
        dodge: n(.dodge) > 0 ? 0.1 : 0,
        flashStep: n(.flashStep) > 0,
        magnet: n(.magnet) > 0,
        threadLife: (1 + TalentK.inkPerRank * Double(talents.ink)) * (1 + longThreadPerStack * Double(n(.longThread))),
        steelThread: n(.steelThread) > 0,
        barbedThread: n(.barbedThread) > 0,
        cutMult: 1 + 0.3 * Double(n(.sharpScissors)),
        echoCut: n(.echoCut) > 0,
        confetti: n(.confetti) > 0
    )
}
