import Foundation

/// §5 et §6 : ennemis, boss, pouvoirs, héros — port exact de `sim/src/content.ts`.

public enum MinionType: String, Codable, CaseIterable, Sendable {
    case goblin, mushroom, wolf, skeleton, jelly, jellySmall, totem, bat, mage, moth, snipper
    // chapitres 11 à 15 (DECISIONS #73) ; `shade` : ombre invoquée par le montreur (jamais tirée par le générateur)
    case lantern, weaver, beetle, puppeteer, shade, specter
}

public struct EnemyDef: Sendable {
    public let type: MinionType
    public let name: String
    public let hp: Double
    public let contact: Double
    public let speed: Double
    public let radius: Double
    public let flying: Bool
    public let shotDmg: Double
    public let cost: Int
    public let period: Double
    /// Tireurs : distance gardée [recul en deçà, approche au-delà] (pt).
    public let range: (near: Double, far: Double)?
}

public enum Bestiary {
    public static func def(_ t: MinionType) -> EnemyDef {
        switch t {
        case .goblin: EnemyDef(type: .goblin, name: "Gobelin frondeur", hp: 220, contact: 60, speed: 70, radius: 15, flying: false, shotDmg: 80, cost: 2, period: 3.0, range: (0, 250))
        case .mushroom: EnemyDef(type: .mushroom, name: "Champignon-spore", hp: 300, contact: 50, speed: 0, radius: 16, flying: false, shotDmg: 60, cost: 3, period: 3, range: nil)
        case .wolf: EnemyDef(type: .wolf, name: "Loup d'ombre", hp: 260, contact: 120, speed: 90, radius: 16, flying: false, shotDmg: 0, cost: 3, period: 3.2, range: nil)
        case .skeleton: EnemyDef(type: .skeleton, name: "Archer squelette", hp: 200, contact: 40, speed: 60, radius: 14, flying: false, shotDmg: 70, cost: 3, period: 3.2, range: (120, 300))
        case .jelly: EnemyDef(type: .jelly, name: "Gelée", hp: 380, contact: 70, speed: 55, radius: 18, flying: false, shotDmg: 0, cost: 3, period: 0, range: nil)
        case .jellySmall: EnemyDef(type: .jellySmall, name: "Petite gelée", hp: 120, contact: 70, speed: 70, radius: 11, flying: false, shotDmg: 0, cost: 0, period: 0, range: nil)
        case .totem: EnemyDef(type: .totem, name: "Totem runique", hp: 500, contact: 0, speed: 0, radius: 18, flying: false, shotDmg: 60, cost: 4, period: 2, range: nil)
        case .bat: EnemyDef(type: .bat, name: "Chauve-souris", hp: 120, contact: 70, speed: 140, radius: 12, flying: true, shotDmg: 0, cost: 2, period: 2, range: nil)
        case .mage: EnemyDef(type: .mage, name: "Mage de braise", hp: 340, contact: 50, speed: 50, radius: 15, flying: false, shotDmg: 60, cost: 5, period: 3.4, range: (110, 280))
        case .moth: EnemyDef(type: .moth, name: "Mite de papier", hp: 100, contact: 40, speed: 105, radius: 12, flying: true, shotDmg: 0, cost: 2, period: 0.6, range: nil)
        case .snipper: EnemyDef(type: .snipper, name: "Crabe-ciseaux", hp: 320, contact: 90, speed: 62, radius: 16, flying: false, shotDmg: 0, cost: 3, period: 3, range: nil)
        case .lantern: EnemyDef(type: .lantern, name: "Lampion", hp: 150, contact: 0, speed: 112, radius: 13, flying: false, shotDmg: 120, cost: 2, period: 0, range: nil)
        case .weaver: EnemyDef(type: .weaver, name: "Araignée tisseuse", hp: 240, contact: 50, speed: 70, radius: 14, flying: false, shotDmg: 0, cost: 3, period: 3.6, range: (130, 270))
        case .beetle: EnemyDef(type: .beetle, name: "Scarabée-bouclier", hp: 420, contact: 55, speed: 45, radius: 18, flying: false, shotDmg: 0, cost: 4, period: 3.6, range: nil)
        case .puppeteer: EnemyDef(type: .puppeteer, name: "Montreur d'ombres", hp: 300, contact: 40, speed: 55, radius: 15, flying: false, shotDmg: 0, cost: 4, period: 6.5, range: (150, 300))
        case .shade: EnemyDef(type: .shade, name: "Ombre", hp: 70, contact: 50, speed: 122, radius: 10, flying: false, shotDmg: 0, cost: 0, period: 0, range: nil)
        case .specter: EnemyDef(type: .specter, name: "Spectre de papier", hp: 260, contact: 50, speed: 32, radius: 14, flying: true, shotDmg: 65, cost: 4, period: 3.8, range: nil)
        }
    }

    /// Ordre d'apparition : un nouveau type par chapitre (DECISIONS #29, #32).
    public static let unlockOrder: [MinionType] = [.goblin, .bat, .jelly, .moth, .snipper, .mushroom, .wolf, .skeleton, .totem, .mage, .lantern, .weaver, .beetle, .puppeteer, .specter]

    public static func unlocked(chapter: Int) -> [MinionType] { Array(unlockOrder.prefix(min(unlockOrder.count, max(0, chapter)))) }

    /// Type introduit au début de ce chapitre (salle tutoriel), ou nil.
    public static func newEnemy(at chapter: Int) -> MinionType? {
        chapter - 1 < unlockOrder.count && chapter >= 1 ? unlockOrder[chapter - 1] : nil
    }

    /// Poids de tirage dans le remplissage du budget.
    public static func spawnWeight(_ t: MinionType) -> Double {
        switch t {
        case .moth: 0.35
        case .snipper: 0.6
        case .goblin: 0.9
        case .mushroom: 0.8
        case .wolf: 0.7
        case .skeleton: 0.7
        case .jelly: 1.0
        case .totem: 0.6
        case .bat: 0.8
        case .mage: 0.6
        case .lantern: 0.7
        case .weaver: 0.6
        case .beetle: 0.5
        case .puppeteer: 0.45
        case .specter: 0.55
        case .jellySmall, .shade: 0
        }
    }
}

// MARK: - Boss

public enum BossArchetype: String, Codable, CaseIterable, Sendable {
    case treant, queen, scorpion, wyvern, ashlord
}

public enum PatternKind: String, Sendable { case aimed, ring, spiral, charge, puddles, slam, rain, summon }

public struct Pattern: Sendable, Equatable {
    public var kind: PatternKind
    public var count: Int
    public var speed: Double?
    public var spread: Double?
    public var repeats: Int?
    public var interval: Double?
    public var radius: Double?
    public var minion: MinionType?

    public init(_ kind: PatternKind, _ count: Int, speed: Double? = nil, spread: Double? = nil, repeats: Int? = nil, interval: Double? = nil, radius: Double? = nil, minion: MinionType? = nil) {
        self.kind = kind; self.count = count; self.speed = speed; self.spread = spread
        self.repeats = repeats; self.interval = interval; self.radius = radius; self.minion = minion
    }
}

public struct BossDef: Sendable {
    public let archetype: BossArchetype
    public let name: String
    public let radius: Double
    public let speed: Double
    public let flying: Bool
    public let contact: Double
    public let shotDmg: Double
    /// 3 phases (100 %, 66 %, 33 %).
    public let phases: [[Pattern]]
}

public enum Bosses {
    public static let byKingdom: [BossArchetype] = [.treant, .queen, .scorpion, .wyvern, .ashlord]

    public static func def(_ a: BossArchetype) -> BossDef {
        switch a {
        case .treant: return BossDef(archetype: .treant, name: "Treant colossal", radius: 34, speed: 35, flying: false, contact: 100, shotDmg: 90, phases: [
            [Pattern(.aimed, 3, speed: 260, spread: 30, repeats: 2, interval: 0.5), Pattern(.slam, 1, radius: 110)],
            [Pattern(.ring, 12, speed: 170, repeats: 2, interval: 0.6), Pattern(.summon, 2, minion: .goblin)],
            [Pattern(.rain, 5, radius: 50), Pattern(.spiral, 3, speed: 180, repeats: 8, interval: 0.25), Pattern(.slam, 1, radius: 130)],
        ])
        case .queen: return BossDef(archetype: .queen, name: "Reine des marais", radius: 32, speed: 45, flying: false, contact: 100, shotDmg: 90, phases: [
            [Pattern(.puddles, 3, radius: 48), Pattern(.aimed, 5, speed: 230, spread: 50)],
            [Pattern(.summon, 2, minion: .jellySmall), Pattern(.ring, 14, speed: 160), Pattern(.puddles, 4, radius: 48)],
            [Pattern(.spiral, 4, speed: 170, repeats: 10, interval: 0.22), Pattern(.puddles, 5, radius: 52)],
        ])
        case .scorpion: return BossDef(archetype: .scorpion, name: "Scorpion d'ambre", radius: 32, speed: 60, flying: false, contact: 120, shotDmg: 95, phases: [
            [Pattern(.charge, 1, speed: 460), Pattern(.aimed, 5, speed: 280, spread: 60)],
            [Pattern(.charge, 2, speed: 480), Pattern(.rain, 6, radius: 46)],
            [Pattern(.aimed, 7, speed: 290, spread: 90, repeats: 2, interval: 0.6), Pattern(.charge, 2, speed: 500), Pattern(.ring, 16, speed: 190)],
        ])
        case .wyvern: return BossDef(archetype: .wyvern, name: "Wyverne de givre", radius: 32, speed: 80, flying: true, contact: 110, shotDmg: 95, phases: [
            [Pattern(.rain, 6, radius: 50), Pattern(.aimed, 3, speed: 320, spread: 24, repeats: 3, interval: 0.4)],
            [Pattern(.charge, 1, speed: 520), Pattern(.ring, 16, speed: 180, repeats: 2, interval: 0.5)],
            [Pattern(.spiral, 5, speed: 190, repeats: 10, interval: 0.2), Pattern(.rain, 8, radius: 50), Pattern(.charge, 2, speed: 540)],
        ])
        case .ashlord: return BossDef(archetype: .ashlord, name: "Seigneur des cendres", radius: 34, speed: 40, flying: false, contact: 120, shotDmg: 100, phases: [
            [Pattern(.puddles, 4, radius: 52), Pattern(.ring, 14, speed: 180)],
            [Pattern(.summon, 2, minion: .mage), Pattern(.slam, 1, radius: 130), Pattern(.aimed, 5, speed: 300, spread: 50, repeats: 2, interval: 0.5)],
            [Pattern(.spiral, 6, speed: 200, repeats: 12, interval: 0.2), Pattern(.puddles, 6, radius: 52), Pattern(.slam, 1, radius: 150)],
        ])
        }
    }
}

// MARK: - Pouvoirs

public enum Rarity: String, Codable, Sendable { case common, rare, epic }
public enum PowerFamily: String, Codable, Sendable {
    case thread, wind, ember, shot, power, element, defense, mobility
    /// Familles « signature » : propres à un héros (première carte de chaque tirage, DECISIONS #71 et #74).
    public var isSignature: Bool { self == .thread || self == .wind || self == .ember }
}

public enum PowerID: String, Codable, CaseIterable, Sendable {
    case multishot, rearShot, diagonals, sideShots, ricochet, pierce, wallBounce
    case attackSpeed, damage, crit, eliteSlayer
    case flame, frost, chain, poison, blast
    case orb, shield, lifesteal, maxHp
    case speed, dodge, flashStep, magnet
    case longThread, steelThread, barbedThread, sharpScissors, echoCut, confetti
    // famille Vent (Moine du vent) et famille Braise (Sorcier de braise), DECISIONS #74
    case bigGust, keenGust, quickMomentum, eyeOfStorm, whirlwind, featherStep
    case liveEmbers, blaze, wideTrail, combustion, ashWard, furnace
}

public struct PowerDef: Sendable, Identifiable {
    public let id: PowerID
    public let name: String
    public let family: PowerFamily
    public let rarity: Rarity
    /// Nombre de prises maximum dans un même niveau.
    public let maxStacks: Int
    public let desc: String
}

public enum Powers {
    /// 36 pouvoirs (DECISIONS #28, #74), dans l'ordre de `POWERS` (l'ordre compte pour les offres à graine).
    public static let all: [PowerDef] = [
        PowerDef(id: .longThread, name: "Fil long", family: .thread, rarity: .common, maxStacks: 3, desc: "Le fil dure 40 % plus longtemps"),
        PowerDef(id: .sharpScissors, name: "Ciseaux affûtés", family: .thread, rarity: .common, maxStacks: 3, desc: "+30 % de dégâts de découpe"),
        PowerDef(id: .steelThread, name: "Fil d'acier", family: .thread, rarity: .rare, maxStacks: 1, desc: "Ni les mites ni les crabes ne coupent le fil"),
        PowerDef(id: .barbedThread, name: "Fil barbelé", family: .thread, rarity: .rare, maxStacks: 1, desc: "Le fil blesse les ennemis qui le touchent"),
        PowerDef(id: .confetti, name: "Confettis", family: .thread, rarity: .rare, maxStacks: 1, desc: "Les découpés éclatent sur leurs voisins (40 %)"),
        PowerDef(id: .echoCut, name: "Écho", family: .thread, rarity: .epic, maxStacks: 1, desc: "Chaque découpe se répète 0,5 s après (50 %)"),
        PowerDef(id: .multishot, name: "Multitir", family: .shot, rarity: .epic, maxStacks: 2, desc: "+1 aiguille, −40 % de dégâts par aiguille"),
        PowerDef(id: .ricochet, name: "Ricochet", family: .shot, rarity: .epic, maxStacks: 1, desc: "Rebondit sur un 2e ennemi (25 %)"),
        PowerDef(id: .pierce, name: "Perforation", family: .shot, rarity: .rare, maxStacks: 1, desc: "Traverse les ennemis (−15 % dégâts)"),
        PowerDef(id: .diagonals, name: "Diagonales", family: .shot, rarity: .rare, maxStacks: 1, desc: "Deux aiguilles en diagonale"),
        PowerDef(id: .attackSpeed, name: "Cadence +25 %", family: .power, rarity: .common, maxStacks: 3, desc: "Tire 25 % plus vite"),
        PowerDef(id: .damage, name: "Dégâts +20 %", family: .power, rarity: .common, maxStacks: 3, desc: "+20 % de dégâts (aiguilles et découpes)"),
        PowerDef(id: .crit, name: "Critique", family: .power, rarity: .rare, maxStacks: 2, desc: "15 % de chances de doubler les dégâts"),
        PowerDef(id: .eliteSlayer, name: "Tueur d'élites", family: .power, rarity: .common, maxStacks: 1, desc: "+50 % contre élites et boss"),
        PowerDef(id: .flame, name: "Flamme", family: .element, rarity: .common, maxStacks: 1, desc: "Brûle : 20 %/s pendant 2 s"),
        PowerDef(id: .frost, name: "Givre", family: .element, rarity: .common, maxStacks: 1, desc: "Ralentit de 40 % pendant 2 s"),
        PowerDef(id: .chain, name: "Foudre en chaîne", family: .element, rarity: .epic, maxStacks: 1, desc: "Arc sur 2 cibles (20 %)"),
        PowerDef(id: .poison, name: "Poison", family: .element, rarity: .common, maxStacks: 1, desc: "Poison cumulable (1,5 %/s par dose)"),
        PowerDef(id: .orb, name: "Orbe gardien", family: .defense, rarity: .rare, maxStacks: 1, desc: "Un orbe tourne et inflige 80 dégâts"),
        PowerDef(id: .shield, name: "Bouclier", family: .defense, rarity: .common, maxStacks: 1, desc: "Absorbe 1 coup toutes les 25 s"),
        PowerDef(id: .lifesteal, name: "Vol de vie", family: .defense, rarity: .common, maxStacks: 1, desc: "Soigne de 2 % des dégâts infligés"),
        PowerDef(id: .maxHp, name: "PV max +20 %", family: .defense, rarity: .common, maxStacks: 3, desc: "+20 % PV max et soigne d’autant"),
        PowerDef(id: .speed, name: "Vitesse +20 %", family: .mobility, rarity: .common, maxStacks: 2, desc: "Déplacement 20 % plus rapide"),
        PowerDef(id: .dodge, name: "Esquive", family: .mobility, rarity: .rare, maxStacks: 1, desc: "10 % de chances d’éviter un coup"),
        // Ajoutés à la fin : le tirage de l'Éclaireuse (famille Fil) reste identique au bit près (DECISIONS #74).
        PowerDef(id: .bigGust, name: "Grand souffle", family: .wind, rarity: .common, maxStacks: 3, desc: "Bourrasque 25 % plus large"),
        PowerDef(id: .keenGust, name: "Rafale tranchante", family: .wind, rarity: .common, maxStacks: 3, desc: "+35 % de dégâts de bourrasque"),
        PowerDef(id: .quickMomentum, name: "Élan rapide", family: .wind, rarity: .common, maxStacks: 2, desc: "L’élan se charge 35 % plus vite"),
        PowerDef(id: .eyeOfStorm, name: "Œil du cyclone", family: .wind, rarity: .rare, maxStacks: 1, desc: "Renvoie les projectiles pris dans la bourrasque"),
        PowerDef(id: .whirlwind, name: "Tourbillon", family: .wind, rarity: .rare, maxStacks: 1, desc: "La bourrasque laisse un tourbillon qui aspire"),
        PowerDef(id: .featherStep, name: "Pas de plume", family: .wind, rarity: .epic, maxStacks: 1, desc: "Invulnérable 0,6 s après une bourrasque"),
        PowerDef(id: .liveEmbers, name: "Braises vives", family: .ember, rarity: .common, maxStacks: 3, desc: "La traînée dure 35 % plus longtemps"),
        PowerDef(id: .blaze, name: "Brasier", family: .ember, rarity: .common, maxStacks: 3, desc: "+35 % de dégâts de brûlure"),
        PowerDef(id: .wideTrail, name: "Traînée large", family: .ember, rarity: .common, maxStacks: 2, desc: "Traînée 40 % plus large"),
        PowerDef(id: .combustion, name: "Combustion", family: .ember, rarity: .rare, maxStacks: 1, desc: "Un ennemi qui meurt en brûlant explose"),
        PowerDef(id: .ashWard, name: "Cendres ardentes", family: .ember, rarity: .rare, maxStacks: 1, desc: "Les projectiles ennemis brûlent dans la traînée"),
        PowerDef(id: .furnace, name: "Fournaise", family: .ember, rarity: .epic, maxStacks: 1, desc: "La traînée ralentit de 35 % et brûle 2 × plus"),
    ]

    private static let byID: [PowerID: PowerDef] = Dictionary(uniqueKeysWithValues: all.map { ($0.id, $0) })

    /// Définition d'un pouvoir. Les pouvoirs retirés (tir arrière, etc.) restent décodables : maxStacks 1.
    public static func def(_ id: PowerID) -> PowerDef {
        byID[id] ?? PowerDef(id: id, name: id.rawValue, family: .shot, rarity: .common, maxStacks: 1, desc: "")
    }
}

// MARK: - Héros

public enum HeroID: String, Codable, CaseIterable, Sendable {
    case scout, windMonk, emberSorcerer
}

/// Mécanique signature (DECISIONS #74) : fil (Éclaireuse), élan et bourrasque (Moine), traînée de braises (Sorcier).
public enum HeroKind: String, Codable, Sendable { case thread, gust, ember }

public struct HeroDef: Sendable {
    public let id: HeroID
    public let name: String
    public let kind: HeroKind
    /// Famille de pouvoirs signature (première carte de chaque tirage).
    public let family: PowerFamily
    /// Petit pouvoir de départ propre (aucun depuis la 0.2).
    public let startPower: PowerID?
    public let shotShape: String
    /// Nom de la mécanique et phrase d'accroche (écrans).
    public let mechanic: String
    public let pitch: String
}

public enum Heroes {
    public static func def(_ id: HeroID) -> HeroDef {
        switch id {
        case .scout: HeroDef(id: .scout, name: "L'Éclaireuse", kind: .thread, family: .thread, startPower: nil, shotShape: "arrow", mechanic: "Ciseaux de lune", pitch: "Entoure tes ennemis de ton fil : la boucle refermée les découpe.")
        case .windMonk: HeroDef(id: .windMonk, name: "Moine du vent", kind: .gust, family: .wind, startPower: nil, shotShape: "gust", mechanic: "Élan et bourrasque", pitch: "Cours pour prendre de l’élan, arrête-toi : la bourrasque balaie tout autour de toi.")
        case .emberSorcerer: HeroDef(id: .emberSorcerer, name: "Sorcier de braise", kind: .ember, family: .ember, startPower: nil, shotShape: "ember", mechanic: "Traînée de braises", pitch: "Tes pas laissent des braises : attire tes poursuivants dans le feu.")
        }
    }
}
