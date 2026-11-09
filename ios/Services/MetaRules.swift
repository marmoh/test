import Foundation

/// Règles pures de la méta-progression de la version 0.2 (port de `web/src/meta.ts` et `web/src/journal.ts`) :
/// déblocage des héros (DECISIONS #77), équipement possédé et porté (#75), étal du colporteur (#79),
/// quêtes du jour et bestiaire (#76). Aucune dépendance à l'interface : testables sans simulateur.
/// Les données vivent dans trois sections de la sauvegarde, de même forme que le web : `gear`, `quests`, `bestiary`.

// MARK: - héros

enum HeroUnlocks {
    /// Niveau à terminer pour débloquer un héros en jouant (`HERO_UNLOCK_LEVEL`) ; l'offre de départ donne aussi le Moine.
    static func level(_ id: HeroID) -> Int {
        switch id {
        case .scout: 0
        case .windMonk: 40
        case .emberSorcerer: 100
        }
    }

    /// Héros jouable : déjà inscrit (offre de départ, partie précédente) ou niveau de déblocage terminé.
    static func isUnlocked(_ id: HeroID, owned: Set<String>, unlocked: Int) -> Bool {
        if id == .scout || owned.contains(id.rawValue) { return true }
        let n = level(id)
        return n > 0 && unlocked > n
    }

    /// Héros gagnés en jouant mais pas encore inscrits dans le portefeuille.
    static func earned(owned: Set<String>, unlocked: Int) -> [HeroID] {
        HeroID.allCases.filter { id in
            let n = level(id)
            return !owned.contains(id.rawValue) && n > 0 && unlocked > n
        }
    }

    /// Héros que donne la victoire du niveau n (médaillon sur la carte), s'il n'est pas déjà à soi.
    static func hero(at n: Int, owned: Set<String>) -> HeroID? {
        HeroID.allCases.first { level($0) == n && !owned.contains($0.rawValue) }
    }

    /// Les trois premières cartes de la famille signature (aperçu de la mécanique, `HERO_POWERS`).
    static func signaturePowers(_ id: HeroID) -> [PowerID] {
        switch id {
        case .scout: [.longThread, .sharpScissors, .echoCut]
        case .windMonk: [.bigGust, .whirlwind, .eyeOfStorm]
        case .emberSorcerer: [.liveEmbers, .combustion, .furnace]
        }
    }

    /// Niveau de l'essai d'un héros verrouillé : un niveau déjà connu (au moins le 5).
    static func trialLevel(_ id: HeroID, unlocked: Int) -> Int {
        max(5, min(unlocked - 1, id == .emberSorcerer ? 47 : 25))
    }
}

// MARK: - jour local

enum MetaDay {
    /// « AAAA-MM-JJ » du jour local (`localDay` du web) : quêtes et étal changent à minuit.
    static func key(_ date: Date, calendar: Calendar = .current) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// Secondes jusqu'au prochain minuit local.
    static func secondsToMidnight(_ date: Date, calendar: Calendar = .current) -> TimeInterval {
        let start = calendar.startOfDay(for: date)
        guard let next = calendar.date(byAdding: .day, value: 1, to: start) else { return 0 }
        return max(0, next.timeIntervalSince(date))
    }
}

// MARK: - équipement

/// Étal du colporteur : objets du jour déjà achetés (index 0 à 2).
struct StallState: Codable, Equatable, Sendable {
    var day: String
    var bought: [Int]
}

/// Un objet de l'étal du jour, montré avant l'achat (aucun hasard payant).
struct StallOffer: Equatable, Sendable, Identifiable {
    let index: Int
    let gearID: String
    let level: Int
    let price: Int
    let bought: Bool
    var id: Int { index }
}

/// Butin d'une victoire : objet et éclats (première victoire) ou éclats seuls (niveau rejoué).
struct Loot: Equatable, Sendable {
    var item: GearItem?
    var shards: Int
    var first: Bool
}

/// Section `gear` de la sauvegarde : objets possédés, objet porté par emplacement (uid), éclats, étal.
struct GearState: Codable, Equatable, Sendable {
    var items: [GearItem] = []
    /// Clé : `GearSlot.rawValue` (même forme que le web : `{"needle": 3}`) ; valeur : uid de l'objet porté.
    var equipped: [String: Int] = [:]
    var nextUid = 1
    var shards = 0
    var stall: StallState?

    init() {}

    // décodage tolérant : une sauvegarde plus ancienne reçoit les champs manquants par défaut
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        items = try c.decodeIfPresent([GearItem].self, forKey: .items) ?? []
        equipped = try c.decodeIfPresent([String: Int].self, forKey: .equipped) ?? [:]
        nextUid = try c.decodeIfPresent(Int.self, forKey: .nextUid) ?? 1
        shards = try c.decodeIfPresent(Int.self, forKey: .shards) ?? 0
        stall = try c.decodeIfPresent(StallState.self, forKey: .stall)
        // uid toujours neuf, même si la sauvegarde a été modifiée à la main
        nextUid = max(nextUid, (items.map(\.uid).max() ?? 0) + 1)
    }

    func item(_ uid: Int) -> GearItem? { items.first { $0.uid == uid } }

    /// Objet porté dans un emplacement.
    func wornItem(in slot: GearSlot) -> GearItem? {
        guard let uid = equipped[slot.rawValue] else { return nil }
        return item(uid)
    }

    /// Objets portés, dans l'ordre des emplacements.
    var wornItems: [GearItem] { GearSlot.allCases.compactMap { wornItem(in: $0) } }

    var stats: GearStats { Gear.stats(wornItems) }

    func isEquipped(_ uid: Int) -> Bool { equipped.values.contains(uid) }

    /// Inventaire trié : rareté décroissante, puis emplacement, puis niveau décroissant (`gearPanel`).
    var sortedItems: [GearItem] {
        func rank(_ r: GearRarity) -> Int { GearRarity.allCases.firstIndex(of: r) ?? 0 }
        func slotIndex(_ s: GearSlot) -> Int { GearSlot.allCases.firstIndex(of: s) ?? 0 }
        return items.filter { Gear.byID[$0.id] != nil }.sorted { a, b in
            let da = Gear.byID[a.id]!, db = Gear.byID[b.id]!
            if da.rarity != db.rarity { return rank(da.rarity) > rank(db.rarity) }
            if da.slot != db.slot { return slotIndex(da.slot) < slotIndex(db.slot) }
            if a.level != b.level { return a.level > b.level }
            return a.uid < b.uid
        }
    }

    /// Ajoute un objet ; un emplacement vide le porte tout de suite (`addItem`).
    @discardableResult
    mutating func add(_ id: String, level: Int = 1) -> GearItem {
        let it = GearItem(uid: nextUid, id: id, level: level)
        nextUid += 1
        items.append(it)
        if let def = Gear.byID[id], equipped[def.slot.rawValue] == nil { equipped[def.slot.rawValue] = it.uid }
        return it
    }

    mutating func equip(_ uid: Int) {
        guard let it = item(uid), let def = Gear.byID[it.id] else { return }
        equipped[def.slot.rawValue] = uid
    }

    mutating func unequip(_ slot: GearSlot) { equipped[slot.rawValue] = nil }

    /// Vrai si l'objet est meilleur (statistique principale) que celui porté dans son emplacement.
    func isUpgradeOver(_ it: GearItem) -> Bool {
        guard let def = Gear.byID[it.id] else { return false }
        guard let cur = wornItem(in: def.slot), let curDef = Gear.byID[cur.id] else { return true }
        return Gear.mainValue(def, it.level) > Gear.mainValue(curDef, cur.level) + 1e-9
    }

    /// Coût du niveau suivant (nil au maximum ou objet inconnu).
    func upgradeCost(_ uid: Int) -> (gold: Int, shards: Int)? {
        guard let it = item(uid), let def = Gear.byID[it.id] else { return nil }
        return Gear.upgradeCost(def, it.level)
    }

    /// Monte l'objet d'un niveau (le coût est réglé par l'appelant).
    mutating func levelUp(_ uid: Int) {
        guard let i = items.firstIndex(where: { $0.uid == uid }), let def = Gear.byID[items[i].id] else { return }
        items[i].level = min(Gear.maxLevel(def.rarity), items[i].level + 1)
    }

    /// Recycle un objet : il disparaît (et quitte son emplacement), ses éclats sont rendus.
    @discardableResult
    mutating func salvage(_ uid: Int) -> Int {
        guard let it = item(uid), let def = Gear.byID[it.id] else { return 0 }
        let v = Gear.salvageValue(def, it.level)
        items.removeAll { $0.uid == uid }
        for (slot, u) in equipped where u == uid { equipped[slot] = nil }
        shards += v
        return v
    }

    /// Butin d'une victoire (`grantLoot`) : première victoire = éclats + objet annoncé ; rejouée = éclats.
    mutating func grantLoot(level n: Int, firstWin: Bool, threeStars: Bool) -> Loot {
        guard firstWin else {
            let sh = Gear.replayShards(n)
            shards += sh
            return Loot(item: nil, shards: sh, first: false)
        }
        let sh = Gear.firstWinShards(n, threeStars: threeStars)
        shards += sh
        var item: GearItem?
        if let l = Gear.levelLoot(n) { item = add(l.id, level: l.level) }
        return Loot(item: item, shards: sh, first: true)
    }

    /// Les trois objets du jour (`todayStall`) et ceux déjà achetés aujourd'hui.
    func stallOffers(day: String, progress: Int) -> [StallOffer] {
        let bought = stall?.day == day ? stall?.bought ?? [] : []
        return Gear.stallOffers(day: day, progress: progress).enumerated().map { i, o in
            StallOffer(index: i, gearID: o.id, level: o.level, price: o.price, bought: bought.contains(i))
        }
    }

    /// Inscrit l'achat de l'objet i de l'étal et l'ajoute à l'inventaire (le prix est réglé par l'appelant).
    mutating func takeStall(_ i: Int, day: String, progress: Int) -> GearItem? {
        let offers = stallOffers(day: day, progress: progress)
        guard offers.indices.contains(i), !offers[i].bought else { return nil }
        if stall?.day != day { stall = StallState(day: day, bought: []) }
        stall?.bought.append(i)
        return add(offers[i].gearID, level: offers[i].level)
    }
}

// MARK: - quêtes du jour

enum QuestKind: String, Sendable { case win, kills, threeStars, replay, boss, hero, signature, noHit }

struct QuestReward: Equatable, Sendable {
    var gold = 0
    var gems = 0
    var shards = 0
}

struct QuestDef: Equatable, Sendable, Identifiable {
    let id: String
    let kind: QuestKind
    let goal: Int
    var hero: HeroID? = nil
    let reward: QuestReward
}

enum Quests {
    /// `QUEST_POOL` (l'ordre compte : le tirage du jour en dépend). Textes : `QuestDef.text` (traduits).
    static let pool: [QuestDef] = [
        QuestDef(id: "win3", kind: .win, goal: 3, reward: QuestReward(gold: 150)),
        QuestDef(id: "kills60", kind: .kills, goal: 60, reward: QuestReward(shards: 12)),
        QuestDef(id: "stars", kind: .threeStars, goal: 2, reward: QuestReward(gems: 15)),
        QuestDef(id: "replay", kind: .replay, goal: 1, reward: QuestReward(shards: 10)),
        QuestDef(id: "boss", kind: .boss, goal: 1, reward: QuestReward(gems: 20)),
        QuestDef(id: "sig", kind: .signature, goal: 25, reward: QuestReward(gold: 120, shards: 6)),
        QuestDef(id: "scoutWin", kind: .hero, goal: 2, hero: .scout, reward: QuestReward(gold: 100, shards: 6)),
        QuestDef(id: "monkWin", kind: .hero, goal: 2, hero: .windMonk, reward: QuestReward(gold: 100, shards: 8)),
        QuestDef(id: "emberWin", kind: .hero, goal: 2, hero: .emberSorcerer, reward: QuestReward(gold: 100, shards: 8)),
        QuestDef(id: "clean", kind: .noHit, goal: 1, reward: QuestReward(gems: 15)),
    ]

    /// Bonus des trois quêtes du jour.
    static let bonus = QuestReward(gems: 20, shards: 15)

    /// Trois quêtes par jour, tirées de la date (les mêmes pour tous ce jour-là), comme `todayQuests`.
    static func today(day: String, unlocked: Int, heroUnlocked: (HeroID) -> Bool) -> [QuestDef] {
        var pool = Self.pool.filter { q in
            switch q.kind {
            case .boss: return unlocked > 20
            case .hero: return q.hero.map(heroUnlocked) ?? false
            default: return true
            }
        }
        var out: [QuestDef] = []
        var h = Gear.dayHash(day)
        while out.count < 3 && !pool.isEmpty {
            let q = pool.remove(at: Int(h % UInt32(pool.count)))
            // au plus une quête de héros par jour
            if !(q.kind == .hero && out.contains { $0.kind == .hero }) { out.append(q) }
            h = (h ^ (h >> 13)) &* 0x5bd1_e995
        }
        return out
    }
}

/// Bilan d'un combat (victoire ou défaite) : bestiaire et quêtes (`FightReport`).
struct FightReport: Equatable, Sendable {
    var won: Bool
    var level: Int
    var hero: HeroID
    var killsByType: [String: Int]
    /// découpes, bourrasques qui touchent, ennemis brûlés
    var signatureHits: Int
    var stars: Int
    var hpFrac: Double
    var replay: Bool
    var boss: Bool
}

/// Section `quests` de la sauvegarde.
struct QuestState: Codable, Equatable, Sendable {
    var day = ""
    var progress: [String: Int] = [:]
    var claimed: [String] = []
    var bonusClaimed = false

    init(day: String = "") { self.day = day }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        day = try c.decodeIfPresent(String.self, forKey: .day) ?? ""
        progress = try c.decodeIfPresent([String: Int].self, forKey: .progress) ?? [:]
        claimed = try c.decodeIfPresent([String].self, forKey: .claimed) ?? []
        bonusClaimed = try c.decodeIfPresent(Bool.self, forKey: .bonusClaimed) ?? false
    }

    /// État du jour `d` (remis à zéro à minuit).
    func current(day d: String) -> QuestState { day == d ? self : QuestState(day: d) }

    func progress(of q: QuestDef) -> Int { min(q.goal, progress[q.id] ?? 0) }
    func isClaimed(_ id: String) -> Bool { claimed.contains(id) }
    func isDone(_ q: QuestDef) -> Bool { progress(of: q) >= q.goal }
    func allClaimed(_ qs: [QuestDef]) -> Bool { qs.allSatisfy { isClaimed($0.id) } }

    /// Récompenses à réclamer (pastille de l'étiquette « Quêtes »).
    func toClaim(_ qs: [QuestDef]) -> Int {
        var n = qs.filter { isDone($0) && !isClaimed($0.id) }.count
        if allClaimed(qs) && !bonusClaimed { n += 1 }
        return n
    }

    mutating func claim(_ q: QuestDef) -> QuestReward? {
        guard isDone(q), !isClaimed(q.id) else { return nil }
        claimed.append(q.id)
        return q.reward
    }

    mutating func claimBonus(_ qs: [QuestDef]) -> Bool {
        guard !bonusClaimed, allClaimed(qs) else { return false }
        bonusClaimed = true
        return true
    }

    /// Fait avancer les quêtes du jour avec le bilan d'un combat (`recordFight`).
    mutating func record(_ r: FightReport, quests qs: [QuestDef]) {
        let kills = r.killsByType.values.reduce(0, +)
        for q in qs {
            let v: Int
            switch q.kind {
            case .kills: v = kills
            case .signature: v = r.signatureHits
            case .win: v = r.won ? 1 : 0
            case .threeStars: v = r.won && r.stars == 3 ? 1 : 0
            case .replay: v = r.won && r.replay ? 1 : 0
            case .boss: v = r.won && r.boss ? 1 : 0
            case .hero: v = r.won && r.hero == q.hero ? 1 : 0
            case .noHit: v = r.won && r.hpFrac > 0.9 ? 1 : 0
            }
            if v > 0 { progress[q.id] = min(q.goal, (progress[q.id] ?? 0) + v) }
        }
    }

    /// Fusion iCloud : le même jour, on garde le meilleur avancement et toutes les récompenses réclamées.
    func merged(with o: QuestState) -> QuestState {
        guard day == o.day else { return day > o.day ? self : o }
        var m = self
        for (k, v) in o.progress { m.progress[k] = max(m.progress[k] ?? 0, v) }
        for id in o.claimed where !m.claimed.contains(id) { m.claimed.append(id) }
        m.bonusClaimed = bonusClaimed || o.bonusClaimed
        return m
    }
}

// MARK: - bestiaire

enum BestiaryBook {
    /// 16 ennemis (ordre d'apparition, puis l'ombre du montreur) et 5 boss : 21 créatures.
    static let enemies: [MinionType] = Bestiary.unlockOrder + [.shade]
    static let bosses: [BossArchetype] = Bosses.byKingdom
    static var total: Int { enemies.count + bosses.count }

    /// Chapitre où l'ennemi apparaît (l'ombre : celui du montreur d'ombres).
    static func chapter(of t: MinionType) -> Int {
        let k: MinionType = t == .shade ? .puppeteer : t
        return (Bestiary.unlockOrder.firstIndex(of: k) ?? 0) + 1
    }

    /// Clé du bestiaire pour une clé de `killsByType` : le type de l'ennemi, ou l'archétype pour un boss
    /// (« treant » ; « boss:treant » et « boss » seul sont aussi acceptés : l'archétype vient alors du royaume).
    static func key(forKill raw: String, level n: Int) -> String {
        if raw.hasPrefix("boss:") { return String(raw.dropFirst("boss:".count)) }
        if raw == "boss" {
            let k = Formulas.kingdomOf(max(1, n))
            return Bosses.byKingdom[max(0, min(Bosses.byKingdom.count - 1, k - 1))].rawValue
        }
        return raw
    }

    static func record(_ kills: [String: Int], into book: inout [String: Int], level n: Int) {
        for (k, v) in kills where v > 0 {
            book[key(forKill: k, level: n), default: 0] += v
        }
    }

    static func met(_ book: [String: Int]) -> Int {
        enemies.filter { (book[$0.rawValue] ?? 0) > 0 }.count + bosses.filter { (book[$0.rawValue] ?? 0) > 0 }.count
    }

    /// Fusion iCloud : le plus grand compte de chaque créature.
    static func merged(_ a: [String: Int], _ b: [String: Int]) -> [String: Int] {
        a.merging(b) { max($0, $1) }
    }
}
