import Foundation

/// Stockage « clé → JSON » des services persistés (`Wallet`, `LivesCenter`, `Progress`).
/// `UserDefaults` (tests) ou `SaveStore` (fichier JSON + iCloud Key-Value, l'app).
@MainActor
protocol BlobStore: AnyObject {
    func blob(_ key: String) -> Data?
    func setBlob(_ data: Data, forKey key: String)
}

extension UserDefaults: BlobStore {
    func blob(_ key: String) -> Data? { data(forKey: key) }
    func setBlob(_ data: Data, forKey key: String) { set(data, forKey: key) }
}

/// Sauvegarde locale (§13) : un seul fichier JSON lisible, `Application Support/Ombrelune/save.json`,
/// écrit atomiquement à chaque modification, avec une section par service :
/// `progress` (étoiles, niveaux, talents, héros, tournoi, pass de saison), `wallet` (or, gemmes, bonus, héros
/// débloqués, registre des transactions créditées, droits), `lives` (vies avec horodatage, publicités vues).
/// Synchronisée avec iCloud Key-Value (`CloudSync`) : fusion section par section (voir `SaveMerge`).
@MainActor
final class SaveStore: BlobStore {
    static let didMergeRemote = Notification.Name("ombrelune.save.didMergeRemote")

    private(set) var sections: [String: Data] = [:]
    /// Instant (s) de la dernière écriture de chaque section (arbitrage iCloud).
    private(set) var stamps: [String: TimeInterval] = [:]
    let url: URL
    private var cloud: CloudSync?
    private let clock: () -> Date

    init(directory: URL? = nil, iCloud: Bool = true, clock: @escaping () -> Date = Date.init) {
        self.clock = clock
        let dir = directory ?? Self.defaultDirectory()
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        url = dir.appendingPathComponent("save.json")
        if let data = try? Data(contentsOf: url), let doc = SaveDocument.decode(data) {
            sections = doc.sections
            stamps = doc.stamps
        }
        if iCloud {
            cloud = CloudSync { [weak self] remote in self?.mergeRemote(remote) }
            cloud?.start()
            if let remote = cloud?.fetch() { mergeRemote(remote) }
        }
    }

    static func defaultDirectory() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSTemporaryDirectory())
        return base.appendingPathComponent("Ombrelune", isDirectory: true)
    }

    // MARK: BlobStore

    func blob(_ key: String) -> Data? { sections[key] }

    func setBlob(_ data: Data, forKey key: String) {
        sections[key] = data
        stamps[key] = clock().timeIntervalSince1970
        flush()
    }

    /// Document complet (fichier local et copie iCloud).
    var document: Data? { SaveDocument(sections: sections, stamps: stamps, savedAt: clock().timeIntervalSince1970).encode() }

    private func flush() {
        guard let data = document else { return }
        do {
            try data.write(to: url, options: [.atomic])
        } catch {
            // disque plein ou indisponible : la partie continue, la prochaine écriture réessaiera
        }
        cloud?.push(data)
    }

    // MARK: iCloud

    /// Fusionne le document iCloud d'un autre appareil, puis prévient les services (rechargement).
    func mergeRemote(_ data: Data) {
        guard let remote = SaveDocument.decode(data) else { return }
        var changed = false
        for (key, theirs) in remote.sections {
            let mine = sections[key]
            let merged = SaveMerge.merge(section: key, local: mine, localStamp: stamps[key] ?? 0,
                                         remote: theirs, remoteStamp: remote.stamps[key] ?? 0)
            if merged != mine {
                sections[key] = merged
                stamps[key] = max(stamps[key] ?? 0, remote.stamps[key] ?? 0)
                changed = true
            }
        }
        guard changed else { return }
        if let doc = document { try? doc.write(to: url, options: [.atomic]) }
        NotificationCenter.default.post(name: Self.didMergeRemote, object: self)
    }
}

/// Format du fichier `save.json` : sections JSON lisibles (pas de base64).
struct SaveDocument {
    var sections: [String: Data]
    var stamps: [String: TimeInterval]
    var savedAt: TimeInterval = 0

    static let version = 1

    func encode() -> Data? {
        var secs: [String: Any] = [:]
        for (k, v) in sections {
            if let obj = try? JSONSerialization.jsonObject(with: v, options: [.fragmentsAllowed]) { secs[k] = obj }
        }
        let root: [String: Any] = ["version": Self.version, "app": K.appName, "savedAt": savedAt, "stamps": stamps, "sections": secs]
        return try? JSONSerialization.data(withJSONObject: root, options: [.prettyPrinted, .sortedKeys])
    }

    static func decode(_ data: Data) -> SaveDocument? {
        guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let secs = root["sections"] as? [String: Any] else { return nil }
        var sections: [String: Data] = [:]
        for (k, v) in secs {
            if let d = try? JSONSerialization.data(withJSONObject: v, options: [.fragmentsAllowed]) { sections[k] = d }
        }
        var stamps: [String: TimeInterval] = [:]
        for (k, v) in root["stamps"] as? [String: Any] ?? [:] { stamps[k] = (v as? NSNumber)?.doubleValue ?? 0 }
        return SaveDocument(sections: sections, stamps: stamps, savedAt: (root["savedAt"] as? NSNumber)?.doubleValue ?? 0)
    }
}

/// Règles de fusion iCloud (deux appareils qui jouent hors ligne puis se resynchronisent).
@MainActor
enum SaveMerge {
    static func merge(section: String, local: Data?, localStamp: TimeInterval, remote: Data, remoteStamp: TimeInterval) -> Data {
        guard let local else { return remote }
        let dec = JSONDecoder()
        let enc = JSONEncoder()
        switch section {
        case Progress.key:
            // jamais de perte : étoiles, niveaux, talents, récompenses réclamées
            if let a = try? dec.decode(ProgressData.self, from: local), let b = try? dec.decode(ProgressData.self, from: remote) {
                var m = a.merged(with: b)
                if remoteStamp > localStamp {
                    m.heroId = b.heroId
                    m.threadSkin = b.threadSkin
                }
                return (try? enc.encode(m)) ?? local
            }
        case Wallet.key:
            // le plus récent l'emporte (or, gemmes), mais le registre des transactions est l'union des deux :
            // un achat crédité sur un appareil ne l'est jamais une seconde fois sur l'autre
            if let a = try? dec.decode(Wallet.Snapshot.self, from: local), let b = try? dec.decode(Wallet.Snapshot.self, from: remote) {
                var m = remoteStamp > localStamp ? b : a
                m.ledger = a.ledger.union(b.ledger)
                m.heroes = a.heroes.union(b.heroes)
                return (try? enc.encode(m)) ?? local
            }
        default:
            break
        }
        return remoteStamp > localStamp ? remote : local
    }
}

#if !os(Linux)
/// iCloud Key-Value (§13) : une copie du document complet sous la clé `save.v1` (quelques Ko, < 1 Mo).
/// Activer la capacité « iCloud › Key-value storage » (fichier `Ombrelune.entitlements`).
@MainActor
final class CloudSync {
    static let key = "save.v1"
    private let kv = NSUbiquitousKeyValueStore.default
    private let onRemote: (Data) -> Void
    private var observer: NSObjectProtocol?

    init(onRemote: @escaping (Data) -> Void) {
        self.onRemote = onRemote
    }

    func start() {
        observer = NotificationCenter.default.addObserver(
            forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification, object: kv, queue: .main
        ) { [weak self] note in
            let reason = note.userInfo?[NSUbiquitousKeyValueStoreChangeReasonKey] as? Int
            MainActor.assumeIsolated {
                guard let self else { return }
                if reason == NSUbiquitousKeyValueStoreQuotaViolationChange { return }
                if let data = self.fetch() { self.onRemote(data) }
            }
        }
        kv.synchronize()
    }

    func fetch() -> Data? { kv.data(forKey: Self.key) }

    func push(_ data: Data) {
        guard data.count < 900_000 else { return }
        kv.set(data, forKey: Self.key)
    }
}
#else
@MainActor
final class CloudSync {
    init(onRemote: @escaping (Data) -> Void) {}
    func start() {}
    func fetch() -> Data? { nil }
    func push(_ data: Data) {}
}
#endif
