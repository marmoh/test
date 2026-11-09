import Foundation

/// Équipement (DECISIONS #75, #79) — port exact de `sim/src/gear.ts` : 4 emplacements, 24 objets, 4 raretés.
/// Butin sans hasard (§11) : la première victoire de certains niveaux donne un objet précis, annoncé d'avance.

public enum GearSlot: String, Codable, CaseIterable, Sendable { case needle, cloak, mask, charm }
public enum GearRarity: String, Codable, CaseIterable, Sendable { case common, rare, epic, legendary }
public enum GearStat: String, Codable, CaseIterable, Sendable { case dmg, hp, rate, speed, crit, dodge, sig }

/// Bonus cumulés de l'équipement porté (fractions : 0,1 = +10 %).
public struct GearStats: Equatable, Sendable {
    public var dmg: Double = 0
    public var hp: Double = 0
    public var rate: Double = 0
    public var speed: Double = 0
    public var crit: Double = 0
    public var dodge: Double = 0
    /// puissance de la mécanique signature (découpe, bourrasque, braises)
    public var sig: Double = 0

    public init() {}

    public static let none = GearStats()

    public subscript(_ s: GearStat) -> Double {
        get {
            switch s {
            case .dmg: dmg
            case .hp: hp
            case .rate: rate
            case .speed: speed
            case .crit: crit
            case .dodge: dodge
            case .sig: sig
            }
        }
        set {
            switch s {
            case .dmg: dmg = newValue
            case .hp: hp = newValue
            case .rate: rate = newValue
            case .speed: speed = newValue
            case .crit: crit = newValue
            case .dodge: dodge = newValue
            case .sig: sig = newValue
            }
        }
    }
}

public struct GearSub: Equatable, Sendable {
    public let stat: GearStat
    public let value: Double
}

public struct GearDef: Equatable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let slot: GearSlot
    public let rarity: GearRarity
    /// statistique secondaire fixe
    public let sub: GearSub?
    /// une ligne d'ambiance
    public let lore: String
}

/// Objet possédé : identifiant unique (uid), définition, niveau.
public struct GearItem: Codable, Equatable, Hashable, Sendable {
    public var uid: Int
    public var id: String
    public var level: Int
    public init(uid: Int, id: String, level: Int) { self.uid = uid; self.id = id; self.level = level }
}

public enum Gear {
    public static let slotNames: [GearSlot: String] = [.needle: "Aiguille", .cloak: "Cape", .mask: "Masque", .charm: "Talisman"]
    public static let rarityNames: [GearRarity: String] = [.common: "Commun", .rare: "Rare", .epic: "Épique", .legendary: "Légendaire"]
    public static let statNames: [GearStat: String] = [.dmg: "Dégâts", .hp: "PV", .rate: "Cadence", .speed: "Vitesse", .crit: "Critique", .dodge: "Esquive", .sig: "Signature"]

    /// Statistique principale de chaque emplacement.
    public static func slotMain(_ s: GearSlot) -> GearStat {
        switch s {
        case .needle: .dmg
        case .cloak: .hp
        case .mask: .rate
        case .charm: .sig
        }
    }

    /// Niveau maximal par rareté.
    public static func maxLevel(_ r: GearRarity) -> Int {
        switch r {
        case .common: 10
        case .rare: 20
        case .epic: 30
        case .legendary: 40
        }
    }

    /// Statistique principale au niveau 1 et gain par niveau (fractions), pour un multiplicateur d'emplacement de 1.
    static func mainBase(_ r: GearRarity) -> Double {
        switch r {
        case .common: 0.015
        case .rare: 0.025
        case .epic: 0.035
        case .legendary: 0.045
        }
    }
    static let mainPerLevel: Double = 0.001
    /// Le masque (cadence) vaut moins, le talisman (signature) plus.
    static func slotMult(_ s: GearSlot) -> Double {
        switch s {
        case .needle: 1
        case .cloak: 1
        case .mask: 0.6
        case .charm: 1.2
        }
    }

    public static let all: [GearDef] = [
        GearDef(id: "sewingNeedle", name: "Aiguille de couturière", slot: .needle, rarity: .common, sub: nil, lore: "Elle a cousu plus de rideaux que de batailles."),
        GearDef(id: "boneNeedle", name: "Aiguille d'os", slot: .needle, rarity: .common, sub: GearSub(stat: .hp, value: 0.02), lore: "Taillée dans un os de marionnette brisée."),
        GearDef(id: "crowPin", name: "Épingle de corbeau", slot: .needle, rarity: .rare, sub: GearSub(stat: .crit, value: 0.03), lore: "Le corbeau ne rate jamais un œil."),
        GearDef(id: "moonNeedle", name: "Aiguille lunaire", slot: .needle, rarity: .rare, sub: GearSub(stat: .sig, value: 0.05), lore: "Trempée dans le premier quartier."),
        GearDef(id: "amberSting", name: "Dard d'ambre", slot: .needle, rarity: .epic, sub: GearSub(stat: .rate, value: 0.04), lore: "Arraché au Scorpion d'ambre, encore tiède."),
        GearDef(id: "throneNeedle", name: "Aiguille du Trône de lune", slot: .needle, rarity: .legendary, sub: GearSub(stat: .crit, value: 0.03), lore: "Celle qui a découpé la lune dans l'écran."),
        GearDef(id: "juteCloak", name: "Cape de jute", slot: .cloak, rarity: .common, sub: nil, lore: "Rêche, chaude, increvable."),
        GearDef(id: "feltCloak", name: "Cape de feutre", slot: .cloak, rarity: .common, sub: GearSub(stat: .dmg, value: 0.02), lore: "Le feutre étouffe les pas."),
        GearDef(id: "crowCloak", name: "Cape de corbeau", slot: .cloak, rarity: .rare, sub: GearSub(stat: .speed, value: 0.03), lore: "Mille plumes de papier noir."),
        GearDef(id: "mistMantle", name: "Manteau de brume", slot: .cloak, rarity: .rare, sub: GearSub(stat: .dodge, value: 0.03), lore: "On le voit, puis on ne le voit plus."),
        GearDef(id: "marshCloak", name: "Cape des marais", slot: .cloak, rarity: .epic, sub: GearSub(stat: .sig, value: 0.04), lore: "Tissée par la Reine des marais pour son champion."),
        GearDef(id: "starryMantle", name: "Manteau de nuit étoilée", slot: .cloak, rarity: .legendary, sub: GearSub(stat: .dmg, value: 0.03), lore: "Chaque étoile est un trou de lumière."),
        GearDef(id: "paperMask", name: "Masque de papier", slot: .mask, rarity: .common, sub: nil, lore: "Deux trous, un sourire, beaucoup de courage."),
        GearDef(id: "foxMask", name: "Masque de renard", slot: .mask, rarity: .common, sub: GearSub(stat: .speed, value: 0.02), lore: "Le renard file entre les ombres."),
        GearDef(id: "owlMask", name: "Masque de chouette", slot: .mask, rarity: .rare, sub: GearSub(stat: .crit, value: 0.03), lore: "Il voit dans le noir des coulisses."),
        GearDef(id: "wolfMask", name: "Masque de loup", slot: .mask, rarity: .rare, sub: GearSub(stat: .dmg, value: 0.03), lore: "Pris au Loup d'ombre, crocs compris."),
        GearDef(id: "emberMask", name: "Masque de braise", slot: .mask, rarity: .epic, sub: GearSub(stat: .sig, value: 0.04), lore: "Ses yeux fument encore."),
        GearDef(id: "eclipseMask", name: "Masque de la lune noire", slot: .mask, rarity: .legendary, sub: GearSub(stat: .crit, value: 0.03), lore: "Quand il le porte, la scène retient son souffle."),
        GearDef(id: "spool", name: "Bobine de fil", slot: .charm, rarity: .common, sub: nil, lore: "Le premier outil de tout marionnettiste."),
        GearDef(id: "windBell", name: "Grelot de vent", slot: .charm, rarity: .common, sub: GearSub(stat: .speed, value: 0.02), lore: "Il tinte avant la bourrasque."),
        GearDef(id: "emberJar", name: "Braise captive", slot: .charm, rarity: .rare, sub: GearSub(stat: .dmg, value: 0.03), lore: "Une braise qui ne veut pas mourir."),
        GearDef(id: "paperCrane", name: "Grue de papier", slot: .charm, rarity: .rare, sub: GearSub(stat: .dodge, value: 0.025), lore: "Pliée mille fois, elle porte chance."),
        GearDef(id: "waxHeart", name: "Cœur de cire", slot: .charm, rarity: .epic, sub: GearSub(stat: .hp, value: 0.04), lore: "Il bat au rythme de la rampe."),
        GearDef(id: "eclipseCharm", name: "Éclipse", slot: .charm, rarity: .legendary, sub: GearSub(stat: .rate, value: 0.03), lore: "Un disque d'encre devant la lune."),
    ]

    public static let byID: [String: GearDef] = Dictionary(uniqueKeysWithValues: all.map { ($0.id, $0) })

    /// Valeur de la statistique principale d'un objet à un niveau donné.
    public static func mainValue(_ def: GearDef, _ level: Int) -> Double {
        let l = max(1, min(maxLevel(def.rarity), level))
        return (mainBase(def.rarity) + mainPerLevel * Double(l - 1)) * slotMult(def.slot)
    }

    /// Somme des bonus de l'équipement porté (au plus un objet par emplacement ; les inconnus sont ignorés).
    public static func stats(_ items: [GearItem]) -> GearStats {
        var s = GearStats()
        var seen = Set<GearSlot>()
        for it in items {
            guard let def = byID[it.id], !seen.contains(def.slot) else { continue }
            seen.insert(def.slot)
            s[slotMain(def.slot)] += mainValue(def, it.level)
            if let sub = def.sub { s[sub.stat] += sub.value }
        }
        return s
    }

    static func rarityCost(_ r: GearRarity) -> Double {
        switch r {
        case .common: 1
        case .rare: 1.6
        case .epic: 2.4
        case .legendary: 3.4
        }
    }

    /// Coût du niveau suivant (nil au maximum).
    public static func upgradeCost(_ def: GearDef, _ level: Int) -> (gold: Int, shards: Int)? {
        if level >= maxLevel(def.rarity) { return nil }
        let k = rarityCost(def.rarity)
        let l = Double(level)
        return (Int(DMath.round((60 + 30 * l) * k / 10) * 10), Int(DMath.round((2 + 1.5 * l) * k)))
    }

    /// Éclats rendus par le recyclage : la moitié de ce qui a été investi, plus une base par rareté.
    public static func salvageValue(_ def: GearDef, _ level: Int) -> Int {
        let base: Int
        switch def.rarity {
        case .common: base = 6
        case .rare: base = 16
        case .epic: base = 40
        case .legendary: base = 90
        }
        var spent = 0
        if level > 1 { for l in 1..<level { spent += upgradeCost(def, l)!.shards } }
        return base + spent / 2
    }

    // MARK: butin

    /// Rareté de l'objet donné par la première victoire du niveau n, ou nil (niveau sans objet).
    public static func lootRarity(_ n: Int) -> GearRarity? {
        let c = (n + 19) / 20
        let p = n - 20 * (c - 1)
        if p == 20 { return c % 3 == 0 ? .legendary : .epic } // boss ; fin de royaume : légendaire
        if p == 7 || p == 14 { return c >= 4 ? .epic : .rare } // niveaux difficiles
        if p == 3 || p == 10 || p == 17 { return c >= 7 ? .rare : .common }
        return nil
    }

    static func hash32(_ a: Int) -> UInt32 {
        var x = UInt32(truncatingIfNeeded: a) ^ 0x9e37_79b9
        x = (x ^ (x >> 16)) &* 0x85eb_ca6b
        x = (x ^ (x >> 13)) &* 0xc2b2_ae35
        return x ^ (x >> 16)
    }

    /// Objet de la première victoire du niveau n (annoncé d'avance) : l'emplacement tourne d'un objet à l'autre et
    /// se décale d'un cran par chapitre, pour que les boss tombent tour à tour sur les quatre emplacements.
    public static func levelLoot(_ n: Int) -> (id: String, level: Int)? {
        guard let rarity = lootRarity(n) else { return nil }
        var index = 0
        if n > 1 { for k in 1..<n where lootRarity(k) != nil { index += 1 } }
        let slot = GearSlot.allCases[(index + (n + 19) / 20 - 1) % 4]
        let pool = all.filter { $0.slot == slot && $0.rarity == rarity }
        let def = pool[Int(hash32(n) % UInt32(pool.count))]
        // un objet trouvé loin dans la saga arrive déjà un peu amélioré
        let level = max(1, min(maxLevel(rarity), 1 + max(0, n - 40) / 30))
        return (def.id, level)
    }

    /// Éclats d'une première victoire (en plus d'un éventuel objet) ; ×2 pour trois étoiles.
    public static func firstWinShards(_ n: Int, threeStars: Bool) -> Int {
        Int(DMath.round((4 + Double(n) / 12) * (threeStars ? 2 : 1)))
    }

    /// Éclats d'une victoire rejouée (niveau déjà gagné).
    public static func replayShards(_ n: Int) -> Int { 1 + n / 40 }

    /// Équipement attendu au niveau n (modèle des bots) : dans chaque emplacement, l'objet le plus fort des niveaux
    /// déjà gagnés (principale + secondaire), amélioré à mi-chemin de son maximum.
    public static func expected(_ n: Int) -> [GearItem] {
        var order: [GearSlot] = []
        var best: [GearSlot: (def: GearDef, level: Int, value: Double)] = [:]
        if n > 1 {
            for k in 1..<n {
                guard let l = levelLoot(k), let def = byID[l.id] else { continue }
                let level = max(l.level, Int(DMath.round(Double(maxLevel(def.rarity)) / 2)))
                let value = mainValue(def, level) + (def.sub?.value ?? 0)
                if let cur = best[def.slot] {
                    if value > cur.value { best[def.slot] = (def, level, value) }
                } else {
                    order.append(def.slot)
                    best[def.slot] = (def, level, value)
                }
            }
        }
        var uid = 0
        return order.map { s in
            uid += 1
            return GearItem(uid: uid, id: best[s]!.def.id, level: best[s]!.level)
        }
    }

    /// Équipement attendu au niveau n, en bonus (comme `gearForLevel`).
    public static func forLevel(_ n: Int) -> GearStats { stats(expected(n)) }
}
