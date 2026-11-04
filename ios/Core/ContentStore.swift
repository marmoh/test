import Foundation

/// Lecture des contenus JSON partagés avec le web : `content/rooms/*.json`, `content/levels/level_NNNN.json`
/// et `content/levels/index.json`. Copiés tels quels dans le paquet de l'app (références de dossier
/// `rooms/` et `levels/`, voir `project.yml`). Pur Foundation : testable hors iOS.
public final class ContentStore: @unchecked Sendable {
    public let rooms: [RoomTemplate]
    public let templates: [String: RoomTemplate]
    /// Graine et facteur de budget validés par les bots, par niveau (`index.json`).
    public let index: [Int: (seed: Int, budgetScale: Double)]
    private let levelsDir: URL?
    private var cache: [Int: LevelDef] = [:]
    private let lock = NSLock()

    public enum LoadError: Error, CustomStringConvertible {
        case missing(String)
        public var description: String {
            switch self { case .missing(let s): "Contenu introuvable : \(s)" }
        }
    }

    public init(roomsDir: URL, levelsDir: URL?) throws {
        let fm = FileManager.default
        let files = try fm.contentsOfDirectory(at: roomsDir, includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == "json" }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
        let dec = JSONDecoder()
        var rooms = try files.map { try dec.decode(RoomTemplate.self, from: Data(contentsOf: $0)) }
        rooms.sort { $0.id < $1.id }
        if rooms.isEmpty { throw LoadError.missing(roomsDir.path) }
        self.rooms = rooms
        self.templates = Dictionary(uniqueKeysWithValues: rooms.map { ($0.id, $0) })
        self.levelsDir = levelsDir
        var idx: [Int: (Int, Double)] = [:]
        if let levelsDir, let data = try? Data(contentsOf: levelsDir.appendingPathComponent("index.json")),
           let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            for (k, v) in obj {
                guard let n = Int(k), let e = v as? [String: Any] else { continue }
                let seed = (e["seed"] as? NSNumber)?.intValue ?? 1
                let scale = (e["budgetScale"] as? NSNumber)?.doubleValue ?? 1
                idx[n] = (seed, scale)
            }
        }
        self.index = idx
    }

    /// Contenu embarqué dans l'app (`rooms/` et `levels/` à la racine du paquet).
    public static func bundled(_ bundle: Bundle = .main) throws -> ContentStore {
        guard let rooms = bundle.url(forResource: "rooms", withExtension: nil) else { throw LoadError.missing("rooms/") }
        return try ContentStore(roomsDir: rooms, levelsDir: bundle.url(forResource: "levels", withExtension: nil))
    }

    /// Niveau n, comme le prototype web : régénéré depuis `index.json` (graine et facteur de budget validés
    /// par les bots ; contenu identique au fichier `level_NNNN.json` produit par `pnpm levels:gen`).
    /// Sans entrée d'index, le fichier `level_NNNN.json` fait foi.
    public func level(_ n: Int) -> LevelDef {
        lock.lock()
        defer { lock.unlock() }
        if let l = cache[n] { return l }
        let def = index[n] != nil ? generated(n) : (file(n) ?? generated(n))
        cache[n] = def
        return def
    }

    /// Le fichier `level_NNNN.json` tel quel (avec ses statistiques de validation).
    public func file(_ n: Int) -> LevelDef? {
        guard let dir = levelsDir else { return nil }
        let url = dir.appendingPathComponent(String(format: "level_%04d.json", n))
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(LevelDef.self, from: data)
    }

    /// Niveau n régénéré depuis `index.json` (ce que fait le prototype web).
    public func generated(_ n: Int) -> LevelDef {
        let e = index[n]
        return LevelGen.generate(n, seed: e?.seed ?? 1, templates: rooms, budgetScale: e?.budgetScale ?? 1)
    }

    public func tournament(seed: Int) -> LevelDef { LevelGen.tournament(seed: seed, templates: rooms) }
}
