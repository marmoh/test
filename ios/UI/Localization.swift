import Foundation

/// Couche d'affichage des textes (DECISIONS #70). Langue de développement : le français ; traductions anglaise et
/// espagnole dans `Resources/Localizable.xcstrings` (clé = texte français).
///
/// Le cœur (`Core/`, port bit à bit de `sim/src`) garde ses libellés français, identiques au web : l'app ne les
/// affiche jamais directement mais passe par les extensions ci-dessous (mêmes identifiants, aucune règle touchée).

// MARK: - nombres, prix, dates

enum Fmt {
    /// Entier groupé selon la langue de l'app : « 1 200 », « 1,200 », « 1200 » (l'espagnol ne groupe qu'à partir de
    /// 10 000). L'espace fine insécable du français (U+202F) est remplacée par l'espace insécable ordinaire :
    /// en Alegreya Sans grasse, l'espace fine est plus large qu'une espace normale.
    static func int(_ n: Int) -> String {
        n.formatted(.number.grouping(.automatic)).replacingOccurrences(of: "\u{202F}", with: "\u{00A0}")
    }

    /// Prix de repli en euros (tant que StoreKit n'a pas chargé les produits) : « 4,99 € », « €4.99 ».
    static func euros(_ amount: Decimal) -> String {
        amount.formatted(.currency(code: "EUR")).replacingOccurrences(of: "\u{202F}", with: "\u{00A0}")
    }

    /// « 8 novembre », « November 8 », « 8 de noviembre ».
    static func dayMonth(_ date: Date) -> String {
        date.formatted(.dateTime.day().month(.wide))
    }

    /// Compte à rebours : « 1 h 05 » (au-delà d'une heure) ou « 4:09 ».
    static func clock(_ seconds: TimeInterval) -> String {
        let s = max(0, Int(seconds.rounded(.up)))
        let h = s / 3600, m = (s % 3600) / 60, r = s % 60
        if h > 0 {
            return String(format: String(localized: "%d h %02d", comment: "Compte à rebours de plus d'une heure : heures, minutes"), h, m)
        }
        return String(format: "%d:%02d", m, r)
    }

    /// Bonus en pour cent : « +4,8 % », « +4.8% » (une décimale sous 10 % si elle compte, comme `pct` du web).
    static func pct(_ v: Double) -> String {
        let x = v * 100
        let digits = x < 10 && Swift.abs(x - x.rounded()) > 0.001 ? 1 : 0
        return "+" + v.formatted(.percent.precision(.fractionLength(digits))).replacingOccurrences(of: "\u{202F}", with: "\u{00A0}")
    }
}

// MARK: - pouvoirs (§6)

extension PowerID {
    /// Nom affiché. Les pouvoirs retirés (tir arrière…) gardent le libellé du cœur.
    var title: String {
        switch self {
        case .longThread: String(localized: "Fil long", comment: "Pouvoir")
        case .sharpScissors: String(localized: "Ciseaux affûtés", comment: "Pouvoir")
        case .steelThread: String(localized: "Fil d’acier", comment: "Pouvoir")
        case .barbedThread: String(localized: "Fil barbelé", comment: "Pouvoir")
        case .confetti: String(localized: "Confettis", comment: "Pouvoir")
        case .echoCut: String(localized: "Écho", comment: "Pouvoir ; aussi affiché en combat quand une découpe se répète")
        case .multishot: String(localized: "Multitir", comment: "Pouvoir")
        case .ricochet: String(localized: "Ricochet", comment: "Pouvoir")
        case .pierce: String(localized: "Perforation", comment: "Pouvoir")
        case .diagonals: String(localized: "Diagonales", comment: "Pouvoir")
        case .attackSpeed: String(localized: "Cadence +25 %", comment: "Pouvoir")
        case .damage: String(localized: "Dégâts +20 %", comment: "Pouvoir")
        case .crit: String(localized: "Critique", comment: "Pouvoir")
        case .eliteSlayer: String(localized: "Tueur d’élites", comment: "Pouvoir")
        case .flame: String(localized: "Flamme", comment: "Pouvoir")
        case .frost: String(localized: "Givre", comment: "Pouvoir (ralentit)")
        case .chain: String(localized: "Foudre en chaîne", comment: "Pouvoir")
        case .poison: String(localized: "Poison", comment: "Pouvoir")
        case .orb: String(localized: "Orbe gardien", comment: "Pouvoir")
        case .shield: String(localized: "Bouclier", comment: "Pouvoir")
        case .lifesteal: String(localized: "Vol de vie", comment: "Pouvoir")
        case .maxHp: String(localized: "PV max +20 %", comment: "Pouvoir")
        case .speed: String(localized: "Vitesse +20 %", comment: "Pouvoir")
        case .dodge: String(localized: "Esquive", comment: "Pouvoir ; aussi affiché en combat quand un coup est esquivé")
        case .bigGust: String(localized: "Grand souffle", comment: "Pouvoir du Moine du vent")
        case .keenGust: String(localized: "Rafale tranchante", comment: "Pouvoir du Moine du vent")
        case .quickMomentum: String(localized: "Élan rapide", comment: "Pouvoir du Moine du vent")
        case .eyeOfStorm: String(localized: "Œil du cyclone", comment: "Pouvoir du Moine du vent")
        case .whirlwind: String(localized: "Tourbillon", comment: "Pouvoir du Moine du vent")
        case .featherStep: String(localized: "Pas de plume", comment: "Pouvoir du Moine du vent")
        case .liveEmbers: String(localized: "Braises vives", comment: "Pouvoir du Sorcier de braise")
        case .blaze: String(localized: "Brasier", comment: "Pouvoir du Sorcier de braise")
        case .wideTrail: String(localized: "Traînée large", comment: "Pouvoir du Sorcier de braise")
        case .combustion: String(localized: "Combustion", comment: "Pouvoir du Sorcier de braise")
        case .ashWard: String(localized: "Cendres ardentes", comment: "Pouvoir du Sorcier de braise")
        case .furnace: String(localized: "Fournaise", comment: "Pouvoir du Sorcier de braise")
        case .rearShot, .sideShots, .wallBounce, .blast, .flashStep, .magnet: Powers.def(self).name
        }
    }

    var detail: String {
        switch self {
        case .longThread: String(localized: "Le fil dure 40 % plus longtemps", comment: "Description du pouvoir Fil long")
        case .sharpScissors: String(localized: "+30 % de dégâts de découpe", comment: "Description du pouvoir Ciseaux affûtés")
        case .steelThread: String(localized: "Ni les mites ni les crabes ne coupent le fil", comment: "Description du pouvoir Fil d’acier")
        case .barbedThread: String(localized: "Le fil blesse les ennemis qui le touchent", comment: "Description du pouvoir Fil barbelé")
        case .confetti: String(localized: "Les découpés éclatent sur leurs voisins (40 %)", comment: "Description du pouvoir Confettis")
        case .echoCut: String(localized: "Chaque découpe se répète 0,5 s après (50 %)", comment: "Description du pouvoir Écho")
        case .multishot: String(localized: "+1 aiguille, −40 % de dégâts par aiguille", comment: "Description du pouvoir Multitir")
        case .ricochet: String(localized: "Rebondit sur un 2e ennemi (25 %)", comment: "Description du pouvoir Ricochet")
        case .pierce: String(localized: "Traverse les ennemis (−15 % dégâts)", comment: "Description du pouvoir Perforation")
        case .diagonals: String(localized: "Deux aiguilles en diagonale", comment: "Description du pouvoir Diagonales")
        case .attackSpeed: String(localized: "Tire 25 % plus vite", comment: "Description du pouvoir Cadence")
        case .damage: String(localized: "+20 % de dégâts (aiguilles et découpes)", comment: "Description du pouvoir Dégâts")
        case .crit: String(localized: "15 % de chances de doubler les dégâts", comment: "Description du pouvoir Critique")
        case .eliteSlayer: String(localized: "+50 % contre élites et boss", comment: "Description du pouvoir Tueur d’élites")
        case .flame: String(localized: "Brûle : 20 %/s pendant 2 s", comment: "Description du pouvoir Flamme")
        case .frost: String(localized: "Ralentit de 40 % pendant 2 s", comment: "Description du pouvoir Givre")
        case .chain: String(localized: "Arc sur 2 cibles (20 %)", comment: "Description du pouvoir Foudre en chaîne")
        case .poison: String(localized: "Poison cumulable (1,5 %/s par dose)", comment: "Description du pouvoir Poison")
        case .orb: String(localized: "Un orbe tourne et inflige 80 dégâts", comment: "Description du pouvoir Orbe gardien")
        case .shield: String(localized: "Absorbe 1 coup toutes les 25 s", comment: "Description du pouvoir Bouclier")
        case .lifesteal: String(localized: "Soigne de 2 % des dégâts infligés", comment: "Description du pouvoir Vol de vie")
        case .maxHp: String(localized: "+20 % PV max et soigne d’autant", comment: "Description du pouvoir PV max")
        case .speed: String(localized: "Déplacement 20 % plus rapide", comment: "Description du pouvoir Vitesse")
        case .dodge: String(localized: "10 % de chances d’éviter un coup", comment: "Description du pouvoir Esquive")
        case .bigGust: String(localized: "Bourrasque 25 % plus large", comment: "Description du pouvoir Grand souffle")
        case .keenGust: String(localized: "+35 % de dégâts de bourrasque", comment: "Description du pouvoir Rafale tranchante")
        case .quickMomentum: String(localized: "L’élan se charge 35 % plus vite", comment: "Description du pouvoir Élan rapide")
        case .eyeOfStorm: String(localized: "Renvoie les projectiles pris dans la bourrasque", comment: "Description du pouvoir Œil du cyclone")
        case .whirlwind: String(localized: "La bourrasque laisse un tourbillon qui aspire", comment: "Description du pouvoir Tourbillon")
        case .featherStep: String(localized: "Invulnérable 0,6 s après une bourrasque", comment: "Description du pouvoir Pas de plume")
        case .liveEmbers: String(localized: "La traînée dure 35 % plus longtemps", comment: "Description du pouvoir Braises vives")
        case .blaze: String(localized: "+35 % de dégâts de brûlure", comment: "Description du pouvoir Brasier")
        case .wideTrail: String(localized: "Traînée 40 % plus large", comment: "Description du pouvoir Traînée large")
        case .combustion: String(localized: "Un ennemi qui meurt en brûlant explose", comment: "Description du pouvoir Combustion")
        case .ashWard: String(localized: "Les projectiles ennemis brûlent dans la traînée", comment: "Description du pouvoir Cendres ardentes")
        case .furnace: String(localized: "La traînée ralentit de 35 % et brûle 2 × plus", comment: "Description du pouvoir Fournaise")
        case .rearShot, .sideShots, .wallBounce, .blast, .flashStep, .magnet: Powers.def(self).desc
        }
    }
}

// MARK: - ennemis, boss, héros (§4, §5)

extension MinionType {
    var title: String {
        switch self {
        case .goblin: String(localized: "Gobelin frondeur", comment: "Ennemi")
        case .mushroom: String(localized: "Champignon-spore", comment: "Ennemi")
        case .wolf: String(localized: "Loup d’ombre", comment: "Ennemi")
        case .skeleton: String(localized: "Archer squelette", comment: "Ennemi")
        case .jelly: String(localized: "Gelée", comment: "Ennemi")
        case .jellySmall: String(localized: "Petite gelée", comment: "Ennemi")
        case .totem: String(localized: "Totem runique", comment: "Ennemi")
        case .bat: String(localized: "Chauve-souris", comment: "Ennemi")
        case .mage: String(localized: "Mage de braise", comment: "Ennemi")
        case .moth: String(localized: "Mite de papier", comment: "Ennemi")
        case .snipper: String(localized: "Crabe-ciseaux", comment: "Ennemi")
        case .lantern: String(localized: "Lampion", comment: "Ennemi (chapitre 11)")
        case .weaver: String(localized: "Araignée tisseuse", comment: "Ennemi (chapitre 12)")
        case .beetle: String(localized: "Scarabée-bouclier", comment: "Ennemi (chapitre 13)")
        case .puppeteer: String(localized: "Montreur d’ombres", comment: "Ennemi (chapitre 14)")
        case .shade: String(localized: "Ombre", comment: "Ennemi invoqué par le montreur d’ombres")
        case .specter: String(localized: "Spectre de papier", comment: "Ennemi (chapitre 15)")
        }
    }

    /// Comportement (bestiaire, présentation d'un nouvel ennemi), `LORE[type].what` du web.
    var loreWhat: String {
        switch self {
        case .goblin: String(localized: "Lance une pierre visée toutes les 3 s.", comment: "Bestiaire : comportement du gobelin")
        case .bat: String(localized: "Vole en zigzag, puis pique en ligne droite.", comment: "Bestiaire : comportement de la chauve-souris")
        case .jelly: String(localized: "Te poursuit et se divise en deux à sa mort.", comment: "Bestiaire : comportement de la gelée")
        case .moth: String(localized: "File vers le fil de l’Éclaireuse et le grignote.", comment: "Bestiaire : comportement de la mite")
        case .snipper: String(localized: "Sa charge tranche le fil de découpe.", comment: "Bestiaire : comportement du crabe-ciseaux")
        case .mushroom: String(localized: "Immobile, lâche un anneau de huit spores.", comment: "Bestiaire : comportement du champignon")
        case .wolf: String(localized: "Charge en ligne droite après 0,6 s.", comment: "Bestiaire : comportement du loup")
        case .skeleton: String(localized: "Tire trois flèches en éventail.", comment: "Bestiaire : comportement de l’archer squelette")
        case .totem: String(localized: "Étoile de six projectiles qui tourne.", comment: "Bestiaire : comportement du totem")
        case .mage: String(localized: "Pose une flaque de feu là où tu te tiens.", comment: "Bestiaire : comportement du mage")
        case .lantern: String(localized: "Fonce sur toi, s’arrête et explose.", comment: "Bestiaire : comportement du lampion")
        case .weaver: String(localized: "Crache une toile qui te ralentit.", comment: "Bestiaire : comportement de l’araignée")
        case .beetle: String(localized: "Son bouclier arrête les aiguilles de face.", comment: "Bestiaire : comportement du scarabée")
        case .puppeteer: String(localized: "Garde ses distances et invoque des ombres.", comment: "Bestiaire : comportement du montreur d’ombres")
        case .shade: String(localized: "Ombre rapide et fragile, invoquée par le montreur.", comment: "Bestiaire : comportement de l’ombre")
        case .specter: String(localized: "S’efface, réapparaît près de toi et tire en anneau.", comment: "Bestiaire : comportement du spectre")
        case .jellySmall: String(localized: "Morceau de gelée, rapide.", comment: "Bestiaire : comportement de la petite gelée")
        }
    }

    /// Astuce (bestiaire, présentation d'un nouvel ennemi), `LORE[type].tip` du web.
    var loreTip: String {
        switch self {
        case .goblin: String(localized: "Il ne recule pas : entoure-le.", comment: "Bestiaire : astuce contre le gobelin")
        case .bat: String(localized: "La ligne du piqué s’annonce : pas de côté.", comment: "Bestiaire : astuce contre la chauve-souris")
        case .jelly: String(localized: "Garde de la place pour les petites gelées.", comment: "Bestiaire : astuce contre la gelée")
        case .moth: String(localized: "Les aiguilles lui font trois fois plus mal.", comment: "Bestiaire : astuce contre la mite")
        case .snipper: String(localized: "Ferme ta boucle avant sa charge, ou esquive-la.", comment: "Bestiaire : astuce contre le crabe-ciseaux")
        case .mushroom: String(localized: "Les spores passent entre leurs intervalles.", comment: "Bestiaire : astuce contre le champignon")
        case .wolf: String(localized: "Sors de la bande hachurée, il passe tout droit.", comment: "Bestiaire : astuce contre le loup")
        case .skeleton: String(localized: "De loin, l’éventail s’ouvre : reste à distance.", comment: "Bestiaire : astuce contre l’archer squelette")
        case .totem: String(localized: "Tourne avec l’étoile pour rester entre deux branches.", comment: "Bestiaire : astuce contre le totem")
        case .mage: String(localized: "Ne t’arrête pas sur un cercle qui se referme.", comment: "Bestiaire : astuce contre le mage")
        case .lantern: String(localized: "Abats-le pendant qu’il gonfle : il s’éteint sans exploser.", comment: "Bestiaire : astuce contre le lampion")
        case .weaver: String(localized: "Tuer l’araignée fait disparaître ses toiles.", comment: "Bestiaire : astuce contre l’araignée")
        case .beetle: String(localized: "Contourne-le, ou frappe avec ta mécanique : le bouclier n’y peut rien.", comment: "Bestiaire : astuce contre le scarabée")
        case .puppeteer: String(localized: "Vise-le en premier : sans lui, plus d’ombres.", comment: "Bestiaire : astuce contre le montreur d’ombres")
        case .shade: String(localized: "Une bourrasque ou une boucle en emporte plusieurs.", comment: "Bestiaire : astuce contre l’ombre")
        case .specter: String(localized: "Sa marque s’annonce au sol : éloigne-toi d’elle.", comment: "Bestiaire : astuce contre le spectre")
        case .jellySmall: String(localized: "Il ne se divise plus.", comment: "Bestiaire : astuce contre la petite gelée")
        }
    }
}

extension BossArchetype {
    var title: String {
        switch self {
        case .treant: String(localized: "Treant colossal", comment: "Boss du royaume 1")
        case .queen: String(localized: "Reine des marais", comment: "Boss du royaume 2")
        case .scorpion: String(localized: "Scorpion d’ambre", comment: "Boss du royaume 3")
        case .wyvern: String(localized: "Wyverne de givre", comment: "Boss du royaume 4")
        case .ashlord: String(localized: "Seigneur des cendres", comment: "Boss du royaume 5")
        }
    }

    var loreWhat: String {
        switch self {
        case .treant: String(localized: "Boss de la Forêt : onde de choc, anneaux, pluie de graines.", comment: "Bestiaire : attaques du Treant colossal")
        case .queen: String(localized: "Boss du Marais : flaques, anneaux, petites gelées.", comment: "Bestiaire : attaques de la Reine des marais")
        case .scorpion: String(localized: "Boss du Désert : charges et éventails.", comment: "Bestiaire : attaques du Scorpion d’ambre")
        case .wyvern: String(localized: "Boss du Givre : vole, pluie de glace, charges.", comment: "Bestiaire : attaques de la Wyverne de givre")
        case .ashlord: String(localized: "Boss des Cendres : flaques, mages, onde de choc.", comment: "Bestiaire : attaques du Seigneur des cendres")
        }
    }

    var loreTip: String {
        switch self {
        case .treant: String(localized: "Il reprend son souffle après chaque attaque.", comment: "Bestiaire : astuce contre le Treant colossal")
        case .queen: String(localized: "Garde un chemin sec pour bouger.", comment: "Bestiaire : astuce contre la Reine des marais")
        case .scorpion: String(localized: "Après une charge, il est à découvert.", comment: "Bestiaire : astuce contre le Scorpion d’ambre")
        case .wyvern: String(localized: "Elle survole les obstacles : ne t’y cache pas.", comment: "Bestiaire : astuce contre la Wyverne de givre")
        case .ashlord: String(localized: "Abats ses mages avant qu’ils ne remplissent la salle.", comment: "Bestiaire : astuce contre le Seigneur des cendres")
        }
    }
}

extension HeroID {
    var title: String {
        switch self {
        case .scout: String(localized: "L’Éclaireuse", comment: "Héroïne de départ")
        case .windMonk: String(localized: "Moine du vent", comment: "Héros")
        case .emberSorcerer: String(localized: "Sorcier de braise", comment: "Héros")
        }
    }

    /// Condition de déblocage (`heroUnlockText` du web, DECISIONS #77).
    var unlockText: String {
        switch self {
        case .scout: String(localized: "Disponible", comment: "Héros déjà débloqué")
        case .windMonk: String(localized: "Terminer le niveau \(HeroUnlocks.level(self)) · ou offre de départ", comment: "Condition de déblocage du Moine du vent : numéro du niveau")
        case .emberSorcerer: String(localized: "Terminer le niveau \(HeroUnlocks.level(self))", comment: "Condition de déblocage d’un héros : numéro du niveau")
        }
    }

    /// Nom de la mécanique signature (`HeroDef.mechanic`).
    var mechanicText: String {
        switch self {
        case .scout: String(localized: "Ciseaux de lune", comment: "Mécanique de l’Éclaireuse")
        case .windMonk: String(localized: "Élan et bourrasque", comment: "Mécanique du Moine du vent")
        case .emberSorcerer: String(localized: "Traînée de braises", comment: "Mécanique du Sorcier de braise")
        }
    }

    /// Phrase d'accroche (`HeroDef.pitch`).
    var pitchText: String {
        switch self {
        case .scout: String(localized: "Entoure tes ennemis de ton fil : la boucle refermée les découpe.", comment: "Présentation de l’Éclaireuse")
        case .windMonk: String(localized: "Cours pour prendre de l’élan, arrête-toi : la bourrasque balaie tout autour de toi.", comment: "Présentation du Moine du vent")
        case .emberSorcerer: String(localized: "Tes pas laissent des braises : attire tes poursuivants dans le feu.", comment: "Présentation du Sorcier de braise")
        }
    }
}

// MARK: - équipement (DECISIONS #75)

extension GearSlot {
    var title: String {
        switch self {
        case .needle: String(localized: "Aiguille", comment: "Emplacement d’équipement (arme)")
        case .cloak: String(localized: "Cape", comment: "Emplacement d’équipement")
        case .mask: String(localized: "Masque", comment: "Emplacement d’équipement")
        case .charm: String(localized: "Talisman", comment: "Emplacement d’équipement")
        }
    }
}

extension GearRarity {
    var title: String {
        switch self {
        case .common: String(localized: "Commun", comment: "Rareté d’un pouvoir")
        case .rare: String(localized: "Rare", comment: "Rareté d’un pouvoir")
        case .epic: String(localized: "Épique", comment: "Rareté d’un pouvoir")
        case .legendary: String(localized: "Légendaire", comment: "Rareté d’un pouvoir")
        }
    }
}

extension GearStat {
    var title: String {
        switch self {
        case .dmg: String(localized: "Dégâts", comment: "Statistique d’équipement")
        case .hp: String(localized: "PV", comment: "Statistique d’équipement (points de vie)")
        case .rate: String(localized: "Cadence", comment: "Statistique d’équipement (cadence de tir)")
        case .speed: String(localized: "Vitesse", comment: "Statistique d’équipement")
        case .crit: String(localized: "Critique", comment: "Statistique d’équipement")
        case .dodge: String(localized: "Esquive", comment: "Pouvoir ; aussi affiché en combat quand un coup est esquivé")
        case .sig: String(localized: "Signature", comment: "Statistique d’équipement : puissance de la mécanique du héros")
        }
    }

    /// « Dégâts +4,8 % » (`statLine` du web).
    func line(_ v: Double) -> String { "\(title) \(Fmt.pct(v))" }
}

extension GearDef {
    /// Nom affiché ; un objet inconnu garde le libellé du cœur.
    var title: String {
        switch id {
        case "sewingNeedle": String(localized: "Aiguille de couturière", comment: "Objet (aiguille)")
        case "boneNeedle": String(localized: "Aiguille d’os", comment: "Objet (aiguille)")
        case "crowPin": String(localized: "Épingle de corbeau", comment: "Objet (aiguille)")
        case "moonNeedle": String(localized: "Aiguille lunaire", comment: "Objet (aiguille)")
        case "amberSting": String(localized: "Dard d’ambre", comment: "Objet (aiguille)")
        case "throneNeedle": String(localized: "Aiguille du Trône de lune", comment: "Objet légendaire (aiguille)")
        case "juteCloak": String(localized: "Cape de jute", comment: "Objet (cape)")
        case "feltCloak": String(localized: "Cape de feutre", comment: "Objet (cape)")
        case "crowCloak": String(localized: "Cape de corbeau", comment: "Objet (cape)")
        case "mistMantle": String(localized: "Manteau de brume", comment: "Objet (cape)")
        case "marshCloak": String(localized: "Cape des marais", comment: "Objet (cape)")
        case "starryMantle": String(localized: "Manteau de nuit étoilée", comment: "Objet légendaire (cape)")
        case "paperMask": String(localized: "Masque de papier", comment: "Objet (masque)")
        case "foxMask": String(localized: "Masque de renard", comment: "Objet (masque)")
        case "owlMask": String(localized: "Masque de chouette", comment: "Objet (masque)")
        case "wolfMask": String(localized: "Masque de loup", comment: "Objet (masque)")
        case "emberMask": String(localized: "Masque de braise", comment: "Objet (masque)")
        case "eclipseMask": String(localized: "Masque de la lune noire", comment: "Objet légendaire (masque)")
        case "spool": String(localized: "Bobine de fil", comment: "Objet (talisman)")
        case "windBell": String(localized: "Grelot de vent", comment: "Objet (talisman)")
        case "emberJar": String(localized: "Braise captive", comment: "Objet (talisman)")
        case "paperCrane": String(localized: "Grue de papier", comment: "Objet (talisman)")
        case "waxHeart": String(localized: "Cœur de cire", comment: "Objet (talisman)")
        case "eclipseCharm": String(localized: "Éclipse", comment: "Objet légendaire (talisman)")
        default: name
        }
    }

    /// Ligne d'ambiance.
    var loreText: String {
        switch id {
        case "sewingNeedle": String(localized: "Elle a cousu plus de rideaux que de batailles.", comment: "Ambiance de l’Aiguille de couturière")
        case "boneNeedle": String(localized: "Taillée dans un os de marionnette brisée.", comment: "Ambiance de l’Aiguille d’os")
        case "crowPin": String(localized: "Le corbeau ne rate jamais un œil.", comment: "Ambiance de l’Épingle de corbeau")
        case "moonNeedle": String(localized: "Trempée dans le premier quartier.", comment: "Ambiance de l’Aiguille lunaire")
        case "amberSting": String(localized: "Arraché au Scorpion d’ambre, encore tiède.", comment: "Ambiance du Dard d’ambre")
        case "throneNeedle": String(localized: "Celle qui a découpé la lune dans l’écran.", comment: "Ambiance de l’Aiguille du Trône de lune")
        case "juteCloak": String(localized: "Rêche, chaude, increvable.", comment: "Ambiance de la Cape de jute")
        case "feltCloak": String(localized: "Le feutre étouffe les pas.", comment: "Ambiance de la Cape de feutre")
        case "crowCloak": String(localized: "Mille plumes de papier noir.", comment: "Ambiance de la Cape de corbeau")
        case "mistMantle": String(localized: "On le voit, puis on ne le voit plus.", comment: "Ambiance du Manteau de brume")
        case "marshCloak": String(localized: "Tissée par la Reine des marais pour son champion.", comment: "Ambiance de la Cape des marais")
        case "starryMantle": String(localized: "Chaque étoile est un trou de lumière.", comment: "Ambiance du Manteau de nuit étoilée")
        case "paperMask": String(localized: "Deux trous, un sourire, beaucoup de courage.", comment: "Ambiance du Masque de papier")
        case "foxMask": String(localized: "Le renard file entre les ombres.", comment: "Ambiance du Masque de renard")
        case "owlMask": String(localized: "Il voit dans le noir des coulisses.", comment: "Ambiance du Masque de chouette")
        case "wolfMask": String(localized: "Pris au Loup d’ombre, crocs compris.", comment: "Ambiance du Masque de loup")
        case "emberMask": String(localized: "Ses yeux fument encore.", comment: "Ambiance du Masque de braise")
        case "eclipseMask": String(localized: "Quand il le porte, la scène retient son souffle.", comment: "Ambiance du Masque de la lune noire")
        case "spool": String(localized: "Le premier outil de tout marionnettiste.", comment: "Ambiance de la Bobine de fil")
        case "windBell": String(localized: "Il tinte avant la bourrasque.", comment: "Ambiance du Grelot de vent")
        case "emberJar": String(localized: "Une braise qui ne veut pas mourir.", comment: "Ambiance de la Braise captive")
        case "paperCrane": String(localized: "Pliée mille fois, elle porte chance.", comment: "Ambiance de la Grue de papier")
        case "waxHeart": String(localized: "Il bat au rythme de la rampe.", comment: "Ambiance du Cœur de cire")
        case "eclipseCharm": String(localized: "Un disque d’encre devant la lune.", comment: "Ambiance de l’Éclipse")
        default: lore
        }
    }
}

// MARK: - quêtes du jour (DECISIONS #76)

extension QuestDef {
    var text: String {
        switch id {
        case "win3": String(localized: "Gagne 3 niveaux", comment: "Quête du jour")
        case "kills60": String(localized: "Vaincs 60 ennemis", comment: "Quête du jour")
        case "stars": String(localized: "Termine 2 niveaux avec 3 étoiles", comment: "Quête du jour")
        case "replay": String(localized: "Rejoue un niveau déjà gagné", comment: "Quête du jour")
        case "boss": String(localized: "Terrasse un boss", comment: "Quête du jour")
        case "sig": String(localized: "Frappe 25 fois avec ta mécanique (découpes, bourrasques, ennemis brûlés)", comment: "Quête du jour")
        case "scoutWin": String(localized: "Gagne 2 niveaux avec l’Éclaireuse", comment: "Quête du jour")
        case "monkWin": String(localized: "Gagne 2 niveaux avec le Moine du vent", comment: "Quête du jour")
        case "emberWin": String(localized: "Gagne 2 niveaux avec le Sorcier de braise", comment: "Quête du jour")
        case "clean": String(localized: "Gagne un niveau en gardant plus de 90 % de tes PV", comment: "Quête du jour")
        default: id
        }
    }
}

// MARK: - économie (§8, §11)

extension BonusKind {
    var title: String {
        switch self {
        case .potion: String(localized: "Potion", comment: "Bonus d’avant niveau")
        case .scroll: String(localized: "Parchemin", comment: "Bonus d’avant niveau (pouvoir de départ)")
        case .aegis: String(localized: "Égide", comment: "Bonus d’avant niveau (bouclier)")
        }
    }

    var blurbText: String {
        switch self {
        case .potion: String(localized: "+25 % PV", comment: "Effet de la Potion")
        case .scroll: String(localized: "1 pouvoir", comment: "Effet du Parchemin")
        case .aegis: String(localized: "1 bouclier", comment: "Effet de l’Égide")
        }
    }
}

extension SkinID {
    var title: String {
        switch self {
        case .foxEars: String(localized: "Oreilles de renard", comment: "Apparence du pass")
        case .paperWings: String(localized: "Ailes de papier", comment: "Apparence du pass")
        case .moonCrown: String(localized: "Couronne de lune", comment: "Apparence du pass")
        }
    }
}

extension Reward {
    /// Libellé d'une récompense du pass ou d'un coffre (`Reward.label`).
    var text: String {
        switch self {
        case .gold(let n): String(localized: "\(Fmt.int(n)) or", comment: "Récompense : quantité d’or")
        case .gems(let n): String(localized: "\(Fmt.int(n)) gemmes", comment: "Récompense : quantité de gemmes (toujours plusieurs)")
        case .bonus(.potion, let n): n > 1 ? String(localized: "\(n) potions") : String(localized: "Potion de vie")
        case .bonus(.scroll, let n): n > 1 ? String(localized: "\(n) parchemins") : String(localized: "Parchemin", comment: "Bonus d’avant niveau (pouvoir de départ)")
        case .bonus(.aegis, let n): n > 1 ? String(localized: "\(n) égides") : String(localized: "Égide", comment: "Bonus d’avant niveau (bouclier)")
        case .lives: String(localized: "5 vies", comment: "Récompense : recharge complète des vies")
        case .skin(let s): s.title
        }
    }

    /// « +300 or · +40 gemmes · Ailes de papier » (`Reward.summary`).
    static func summaryText(_ rs: [Reward]) -> String {
        var gold = 0, gems = 0, lives = 0
        var bonus: [BonusKind: Int] = [:]
        var skins: [String] = []
        for r in rs {
            switch r {
            case .gold(let n): gold += n
            case .gems(let n): gems += n
            case .bonus(let k, let n): bonus[k, default: 0] += n
            case .lives: lives += 1
            case .skin(let s): skins.append(s.title)
            }
        }
        var parts: [String] = []
        if gold > 0 { parts.append("+" + Reward.gold(gold).text) }
        if gems > 0 { parts.append("+" + Reward.gems(gems).text) }
        for k in BonusKind.allCases { if let n = bonus[k] { parts.append("+" + Reward.bonus(k, n).text) } }
        if lives > 0 { parts.append("+" + Reward.lives.text) }
        return (parts + skins).joined(separator: " · ")
    }
}

extension SeasonPass {
    /// Nom de la saison (`SeasonPass.name`).
    static var title: String { String(localized: "La Lune de papier", comment: "Nom de la saison 1 du pass") }
}

/// Distinctions du tournoi : enregistrées en français dans la sauvegarde (« Semaine 44 · top 10 % », format
/// inchangé), traduites à l'affichage.
enum HonorText {
    static func display(_ stored: String) -> String {
        let parts = stored.components(separatedBy: " · ")
        guard parts.count == 2, parts[0].hasPrefix("Semaine "), let week = Int(parts[0].dropFirst("Semaine ".count)) else {
            return stored
        }
        let tier: String
        switch parts[1] {
        case "top 1 %": tier = String(localized: "top 1 %", comment: "Distinction du tournoi")
        case "top 10 %": tier = String(localized: "top 10 %", comment: "Distinction du tournoi")
        case "top 50 %": tier = String(localized: "top 50 %", comment: "Distinction du tournoi")
        case "participation": tier = String(localized: "participation", comment: "Distinction du tournoi")
        default: tier = parts[1]
        }
        return String(localized: "Semaine \(week) · \(tier)", comment: "Distinction du tournoi : semaine ISO et palier")
    }
}
