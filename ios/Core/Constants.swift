import Foundation

/// Toutes les valeurs d'équilibrage : port exact de `sim/src/constants.ts`.
/// Tout écart avec la simulation TypeScript casse la parité (tests `ParityTests`) :
/// modifier les deux en même temps, puis régénérer les traces (`pnpm traces`).
///
/// Les règles et constantes du fil (Ciseaux de lune) sont regroupées dans `ThreadTuning` (ci-dessous)
/// et `ThreadRules` (`Core/Thread.swift`) pour être faciles à mettre à jour.
public enum K {
    public static let appName = "Ombrelune"

    /// Pas fixe de simulation (s).
    public static let simDT: Double = 1.0 / 30.0

    // §3 Arène
    public static let cell: Double = 44
    public static let cols = 9
    public static let rows = 15
    public static let arenaW: Double = 9 * 44 // 396
    public static let arenaH: Double = 15 * 44 // 660
    public static let maxObstacles = 14

    // §13 bornes
    public static let maxProjectiles = 150
    public static let maxEnemies = 30

    /// Tir automatique permanent : activé par défaut (DECISIONS #10, #17).
    public static let autoFireDefault = true

    // §7
    public static let levelCount = 300
    public static let levelsPerChapter = 20
    public static let chaptersPerKingdom = 3

    public static let healBetweenRooms: Double = 0.15
    /// La vague suivante arrive quand il reste au plus ce nombre d'ennemis (DECISIONS #33).
    public static let waveNextAlive = 1
    /// Les tireurs qui reculent glissent vers l'intérieur à moins de cette distance d'un mur (pt) : DECISIONS #42.
    public static let wallShy: Double = 90
    public static let telegraphMin: Double = 0.5
    public static let bossBaseHP: Double = 1800
    /// Niveaux de boss : facteur sur le budget des salles qui précèdent le boss.
    public static let bossLevelPreRooms: Double = 0.45
    public static let bossBreath: Double = 1.2
    /// Onde de choc du boss : télégraphe = max(0,8 s, (rayon + 7) / vitesse héros + marge).
    public static let bossSlamMargin: Double = 0.35

    /// Le tir automatique d'aiguilles est l'attaque secondaire (DECISIONS #31, #40).
    public static let shotDmgMult: Double = 0.3
    /// Les aiguilles épinglent les mites de papier : dégâts × 3 contre elles (DECISIONS #41).
    public static let needleMothMult: Double = 3
}

/// §2 Contrôles.
public enum Control {
    public static let deadZone: Double = 8
    public static let fullSpeedSpan: Double = 40
    public static let maxAnchorDist: Double = 70
    public static let stillSpeed: Double = 12
    public static let stillTime: Double = 0.1
    public static let turnTime: Double = 0.08
}

/// §4 Héros.
public enum HeroK {
    public static let hp: Double = 600
    public static let damage: Double = 100
    public static let fireRate: Double = 1.6
    public static let speed: Double = 220
    public static let projectileSpeed: Double = 900
    public static let projectileRadius: Double = 6
    public static let radius: Double = 14
    public static let invulnAfterHit: Double = 0.5
}

public enum TalentK {
    public static let maxRank = 10
    public static let hpPerRank: Double = 0.02
    public static let damagePerRank: Double = 0.02
    public static let fireRatePerRank: Double = 0.015
    public static let goldPerRank: Double = 0.05
    /// « Encre lente » : durée du fil, par rang (DECISIONS #71).
    public static let inkPerRank: Double = 0.06
}

/// Carte « Fil long » : durée du fil par prise (DECISIONS #71).
public let longThreadPerStack: Double = 0.4

/// Rang de talent attendu au niveau n (modèle des bots).
public func expectedTalentRank(_ n: Int) -> Int { min(TalentK.maxRank, n / 25) }

/// §5 Mise à l'échelle (DECISIONS #18, #34).
public enum ScaleK {
    public static let hpPerD: Double = 0.02
    public static let dmgPerD: Double = 0.035
}

/// §7 Budget d'une salle (voir `roomBudget`).
public enum BudgetK {
    public static let base: Double = 6
    public static let perD: Double = 3.2
    public static let powerPerD: Double = 0.5
    public static func byRooms(_ n: Int) -> Double? {
        switch n {
        case 2: return 1.5
        case 3: return 1.9
        case 4: return 2.2
        default: return nil
        }
    }
    public static let waveCap: Double = 8
    public static let waveCapPerD: Double = 0.8
}

public enum EliteK {
    public static let hpMult: Double = 2.2
    public static let fromChapter = 3
    public static let maxPerRoom = 1
    public static let maxPerRoomHard = 2
}

/// §8
public enum StarK {
    public static let two: Double = 0.5
    public static let three: Double = 0.8
}

/// §6 tirage des raretés.
public enum RarityWeights {
    public static let common: Double = 0.6
    public static let rare: Double = 0.3
    public static let epic: Double = 0.1
}

/// Orbes de soin lâchés par les ennemis.
public enum HealOrbK {
    public static let dropChance: Double = 0.08
    public static let healFrac: Double = 0.04
    public static let magnetRange: Double = 260
    public static let magnetHealMult: Double = 1.5
    public static let pickupRadius: Double = 26
}

/// §6 Réglage des pouvoirs par le test d'équilibrage (DECISIONS #27, #35).
public enum PowerTuning {
    public static let multishotDmg: Double = 0.6
    public static let ricochetBounces = 1
    public static let ricochetDmg: Double = 0.25
    public static let chainTargets = 2
    public static let chainFrac: Double = 0.2
    public static let shieldCooldown: Double = 25
    public static let pierceDmg: Double = 0.85
    public static let frostSlow: Double = 0.4
    public static let frostDuration: Double = 2
    public static let orbDamage: Double = 80
    public static let speedPerStack: Double = 0.2
    public static let poisonPerStack: Double = 0.015
}

/// Ciseaux de lune (DECISIONS #28, #31, #39) : en se déplaçant, l'héroïne déroule un fil de découpe ;
/// refermer une boucle découpe tout ce qu'elle entoure. Qui coupe le fil : `ThreadRules` (`Thread.swift`).
public enum ThreadTuning {
    /// Distance entre deux points du fil (pt).
    public static let spacing: Double = 9
    /// Durée de vie d'un point avant que l'encre ne sèche (s) ; 3,2 → 6 (DECISIONS #40) → 2,2 (#71).
    public static let life: Double = 2.2
    public static let maxPoints = 200
    /// Aire minimale d'une boucle (pt²).
    public static let minArea: Double = 1400
    /// Dégâts de base d'une découpe, × dégâts du héros / 100.
    public static let cutBase: Double = 600
    /// Bonus par ennemi supplémentaire pris dans la même boucle.
    public static let comboPerExtra: Double = 0.2
    /// Dégâts du fil barbelé (par seconde de contact, × dégâts du héros / 100).
    public static let barbedDps: Double = 40
    public static let echoDelay: Double = 0.5
    public static let echoMult: Double = 0.5
    public static let confettiFrac: Double = 0.4
    public static let confettiRadius: Double = 72
}

/// Moine du vent — Élan et bourrasque (DECISIONS #74) : `GUST` de `sim/src/constants.ts`.
public enum GustK {
    /// secondes de course pour charger l'élan de 0 à 1
    public static let chargeTime: Double = 0.9
    /// perte d'élan par seconde à l'arrêt (si la bourrasque n'a pas eu lieu)
    public static let decay: Double = 1.5
    /// élan minimal pour déclencher une bourrasque
    public static let minMomentum: Double = 0.3
    /// rayon (pt) : base + perMomentum × élan
    public static let radius: Double = 62
    public static let radiusPerMomentum: Double = 58
    /// dégâts à élan plein, × dégâts du héros / 100
    public static let damage: Double = 130
    /// recul (pt) à élan plein
    public static let knockback: Double = 46
    /// délai minimal entre deux bourrasques (s)
    public static let cooldown: Double = 0.35
    /// Tourbillon : durée, rayon d'aspiration, dégâts par seconde (× dégâts / 100), vitesse d'aspiration
    public static let whirlLife: Double = 1.6
    public static let whirlRadius: Double = 90
    public static let whirlDps: Double = 60
    public static let whirlPull: Double = 70
    /// Pas de plume : invulnérabilité après une bourrasque (s)
    public static let featherInvuln: Double = 0.6
}

/// Sorcier de braise — Traînée de braises (DECISIONS #74) : `EMBER` de `sim/src/constants.ts`.
public enum EmberK {
    public static let spacing: Double = 12
    /// durée de vie d'une braise (s)
    public static let life: Double = 1.8
    public static let maxPoints = 120
    /// rayon d'une braise (pt), ajouté au rayon de l'ennemi
    public static let radius: Double = 13
    /// dégâts par seconde de la brûlure, × dégâts du héros / 100
    public static let dps: Double = 21
    /// durée de la brûlure après avoir quitté les braises (s)
    public static let linger: Double = 1.2
    /// Combustion : fraction des PV max, plafond × dégâts / 100, rayon
    public static let combustFrac: Double = 0.35
    public static let combustCap: Double = 260
    public static let combustRadius: Double = 70
    /// les projectiles du sorcier font couver leur cible : fraction de la brûlure et durée
    public static let needleFrac: Double = 0.4
    public static let needleLinger: Double = 0.6
    /// Fournaise : ralentissement des ennemis dans la traînée
    public static let furnaceSlow: Double = 0.35
}

extension K {
    /// Aiguilles du Moine et du Sorcier (DECISIONS #74).
    public static let signatureNeedleMult: Double = 0.65
    /// Toile de l'araignée tisseuse : ralentit l'héroïne (DECISIONS #73).
    public static let webSlow: Double = 0.45
}
