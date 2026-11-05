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
        default: Powers.def(self).name
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
        default: Powers.def(self).desc
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
}

extension HeroID {
    var title: String {
        switch self {
        case .scout: String(localized: "L’Éclaireuse", comment: "Héroïne de départ")
        case .windMonk: String(localized: "Moine du vent", comment: "Héros")
        case .emberSorcerer: String(localized: "Sorcier de braise", comment: "Héros")
        }
    }

    /// Condition de déblocage (`HeroUnlock.label`).
    var unlockText: String {
        switch self {
        case .scout: String(localized: "Disponible", comment: "Héros déjà débloqué")
        case .windMonk: String(localized: "Offre de départ", comment: "Héros débloqué par l’offre de départ (boutique)")
        case .emberSorcerer: String(localized: "Terminer le Marais (niv. 120)", comment: "Condition de déblocage du Sorcier de braise")
        }
    }

    /// Présentation courte (`HeroUnlock.blurb`).
    var blurbText: String {
        switch self {
        case .scout: String(localized: "Aiguilles de lune. Aucune faiblesse, aucune fioriture.")
        case .windMonk: String(localized: "Rafales d’air. Commence avec Vitesse +20 %.")
        case .emberSorcerer: String(localized: "Braises. Commence avec Flamme.")
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
