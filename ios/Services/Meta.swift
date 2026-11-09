import Foundation
import Observation

/// Méta-progression de la version 0.2 (port de `web/src/meta.ts`) : équipement (section `gear` de la sauvegarde),
/// quêtes du jour (`quests`) et bestiaire (`bestiary`). L'or et les gemmes restent dans le `Wallet`, les niveaux
/// débloqués dans `Progress` ; les règles pures sont dans `MetaRules.swift`.
@MainActor
@Observable
final class Meta {
    static let gearKey = "gear"
    static let questsKey = "quests"
    static let bestiaryKey = "bestiary"

    private(set) var gear: GearState
    private(set) var questState: QuestState
    private(set) var bestiary: [String: Int]

    @ObservationIgnored private let store: any BlobStore
    @ObservationIgnored private let progress: Progress
    @ObservationIgnored private let wallet: Wallet
    @ObservationIgnored private let clock: () -> Date

    init(store: any BlobStore, progress: Progress, wallet: Wallet, clock: @escaping () -> Date = Date.init) {
        self.store = store
        self.progress = progress
        self.wallet = wallet
        self.clock = clock
        gear = Self.read(store, Self.gearKey) ?? GearState()
        questState = Self.read(store, Self.questsKey) ?? QuestState()
        bestiary = Self.read(store, Self.bestiaryKey) ?? [:]
    }

    private static func read<T: Decodable>(_ store: any BlobStore, _ key: String) -> T? {
        guard let d = store.blob(key) else { return nil }
        return try? JSONDecoder().decode(T.self, from: d)
    }

    /// Relit la sauvegarde (après une fusion iCloud).
    func reload() {
        if let g: GearState = Self.read(store, Self.gearKey) { gear = g }
        if let q: QuestState = Self.read(store, Self.questsKey) { questState = q }
        if let b: [String: Int] = Self.read(store, Self.bestiaryKey) { bestiary = b }
    }

    /// « Effacer la progression » : équipement, quêtes et bestiaire repartent de zéro.
    func reset() {
        writeGear(GearState())
        writeQuests(QuestState())
        writeBestiary([:])
    }

    private func writeGear(_ g: GearState) {
        gear = g
        if let d = try? JSONEncoder().encode(g) { store.setBlob(d, forKey: Self.gearKey) }
    }

    private func writeQuests(_ q: QuestState) {
        questState = q
        if let d = try? JSONEncoder().encode(q) { store.setBlob(d, forKey: Self.questsKey) }
    }

    private func writeBestiary(_ b: [String: Int]) {
        bestiary = b
        if let d = try? JSONEncoder().encode(b) { store.setBlob(d, forKey: Self.bestiaryKey) }
    }

    private func mutateGear(_ f: (inout GearState) -> Void) {
        var g = gear
        f(&g)
        writeGear(g)
    }

    var today: String { MetaDay.key(clock()) }

    // MARK: héros

    /// Héros jouable (inscrit, ou niveau de déblocage terminé).
    func heroUnlocked(_ id: HeroID) -> Bool {
        HeroUnlocks.isUnlocked(id, owned: wallet.heroes, unlocked: progress.unlocked)
    }

    /// Inscrit les héros gagnés en jouant ; renvoie les nouveaux (écran « Nouveau héros ! »).
    @discardableResult
    func syncHeroUnlocks() -> [HeroID] {
        let fresh = HeroUnlocks.earned(owned: wallet.heroes, unlocked: progress.unlocked)
        for id in fresh { wallet.unlockHero(id) }
        return fresh
    }

    // MARK: équipement

    var shards: Int { gear.shards }
    var gearStats: GearStats { gear.stats }
    func item(_ uid: Int) -> GearItem? { gear.item(uid) }
    func wornItem(in slot: GearSlot) -> GearItem? { gear.wornItem(in: slot) }
    func isEquipped(_ uid: Int) -> Bool { gear.isEquipped(uid) }
    func isUpgradeOver(_ it: GearItem) -> Bool { gear.isUpgradeOver(it) }

    func equip(_ uid: Int) { mutateGear { $0.equip(uid) } }
    func unequip(_ slot: GearSlot) { mutateGear { $0.unequip(slot) } }

    enum UpgradeResult: Equatable { case ok, max, gold, shards }

    /// Amélioration : or (portefeuille) + éclats.
    func upgrade(_ uid: Int) -> UpgradeResult {
        guard let cost = gear.upgradeCost(uid) else { return .max }
        if wallet.gold < cost.gold { return .gold }
        if gear.shards < cost.shards { return .shards }
        guard wallet.spendGold(cost.gold) else { return .gold }
        mutateGear { g in
            g.shards -= cost.shards
            g.levelUp(uid)
        }
        return .ok
    }

    @discardableResult
    func salvage(_ uid: Int) -> Int {
        var v = 0
        mutateGear { v = $0.salvage(uid) }
        return v
    }

    /// Butin d'une victoire (objet annoncé à la première victoire, éclats).
    func grantLoot(level n: Int, firstWin: Bool, threeStars: Bool) -> Loot {
        var loot = Loot(item: nil, shards: 0, first: firstWin)
        mutateGear { loot = $0.grantLoot(level: n, firstWin: firstWin, threeStars: threeStars) }
        return loot
    }

    // MARK: étal du colporteur (DECISIONS #79)

    /// Les trois objets du jour (les mêmes pour tous ce jour-là, selon la progression).
    var stall: [StallOffer] { gear.stallOffers(day: today, progress: progress.unlocked) }

    enum StallResult: Equatable { case ok, gems, bought }

    /// Achète l'objet i de l'étal contre des gemmes (une fois par jour).
    func buyStall(_ i: Int) -> StallResult {
        let offers = stall
        guard offers.indices.contains(i), !offers[i].bought else { return .bought }
        guard wallet.spendGems(offers[i].price) else { return .gems }
        let day = today
        let unlocked = progress.unlocked
        mutateGear { _ = $0.takeStall(i, day: day, progress: unlocked) }
        return .ok
    }

    /// Sac d'éclats contre des gemmes.
    func buyShards() -> Bool {
        guard wallet.spendGems(Gear.shardPack.gems) else { return false }
        mutateGear { $0.shards += Gear.shardPack.shards }
        return true
    }

    // MARK: quêtes du jour

    /// État des quêtes d'aujourd'hui (remis à zéro à minuit, sans écriture tant que rien ne change).
    var questsToday: QuestState { questState.current(day: today) }

    var quests: [QuestDef] {
        Quests.today(day: today, unlocked: progress.unlocked) { [self] id in heroUnlocked(id) }
    }

    func questProgress(_ q: QuestDef) -> Int { questsToday.progress(of: q) }
    func questClaimed(_ id: String) -> Bool { questsToday.isClaimed(id) }
    var questBonusClaimed: Bool { questsToday.bonusClaimed }
    var allQuestsClaimed: Bool { questsToday.allClaimed(quests) }
    var questsToClaim: Int { questsToday.toClaim(quests) }

    /// Réclame une quête terminée : or et gemmes au portefeuille, éclats à l'équipement.
    func claimQuest(_ id: String) -> QuestReward? {
        guard let q = quests.first(where: { $0.id == id }) else { return nil }
        var s = questsToday
        guard let r = s.claim(q) else { return nil }
        writeQuests(s)
        credit(r)
        return r
    }

    /// Bonus des trois quêtes du jour (20 gemmes + 15 éclats).
    func claimQuestBonus() -> Bool {
        var s = questsToday
        guard s.claimBonus(quests) else { return false }
        writeQuests(s)
        credit(Quests.bonus)
        return true
    }

    private func credit(_ r: QuestReward) {
        var rewards: [Reward] = []
        if r.gold > 0 { rewards.append(.gold(r.gold)) }
        if r.gems > 0 { rewards.append(.gems(r.gems)) }
        if !rewards.isEmpty { wallet.grant(rewards) }
        if r.shards > 0 { mutateGear { $0.shards += r.shards } }
    }

    // MARK: bilan d'un combat

    /// Bestiaire et quêtes (victoire ou défaite, jamais en tournoi ni pendant un essai).
    func recordFight(_ r: FightReport) {
        var b = bestiary
        BestiaryBook.record(r.killsByType, into: &b, level: r.level)
        if b != bestiary { writeBestiary(b) }
        var s = questsToday
        s.record(r, quests: quests)
        if s != questState { writeQuests(s) }
    }

    /// Nombre de créatures de ce type vaincues (clé : type d'ennemi ou archétype de boss).
    func defeated(_ key: String) -> Int { bestiary[key] ?? 0 }
}
