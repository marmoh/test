import Foundation

/// §3 Arène : grille, collisions, ligne de vue, champ de déplacement — port exact de `sim/src/arena.ts`.
public enum Tile: UInt8, Sendable {
    case free = 0, rock = 1, water = 2, hedge = 3
}

/// Gabarit de salle (`content/rooms/*.json`).
public struct RoomTemplate: Codable, Equatable, Sendable {
    public var id: String
    public var name: String
    public var symmetric: Bool
    public var grid: [String]
    public init(id: String, name: String, symmetric: Bool, grid: [String]) {
        self.id = id; self.name = name; self.symmetric = symmetric; self.grid = grid
    }
}

public final class Arena {
    public let template: RoomTemplate
    public private(set) var tiles: [Tile]
    public let portal: Vec
    public let spawn: Vec
    private var flow: [Int16]
    private var flowTarget = -1

    public init(_ template: RoomTemplate) {
        self.template = template
        var tiles = [Tile](repeating: .free, count: K.cols * K.rows)
        var portal: Vec?
        var spawn: Vec?
        for r in 0..<K.rows {
            let row = Array(template.grid[r])
            for c in 0..<K.cols {
                let ch: Character = c < row.count ? row[c] : "."
                var t = Tile.free
                switch ch {
                case "#": t = .rock
                case "~": t = .water
                case "%": t = .hedge
                case "P": portal = cellCenter(c, r)
                case "S": spawn = cellCenter(c, r)
                default: break
                }
                tiles[r * K.cols + c] = t
            }
        }
        self.tiles = tiles
        self.portal = portal ?? cellCenter(4, 0)
        self.spawn = spawn ?? cellCenter(4, K.rows - 1)
        self.flow = [Int16](repeating: -1, count: K.cols * K.rows)
    }

    @inline(__always)
    public func tile(_ c: Int, _ r: Int) -> Tile {
        if c < 0 || r < 0 || c >= K.cols || r >= K.rows { return .rock }
        return tiles[r * K.cols + c]
    }

    /// Bloque le déplacement au sol : rocher, eau/lave, haie.
    @inline(__always) public func blocksWalk(_ c: Int, _ r: Int) -> Bool { tile(c, r) != .free }
    /// Bloque les projectiles : rocher, haie (+ murs extérieurs).
    @inline(__always) public func blocksShot(_ c: Int, _ r: Int) -> Bool {
        let t = tile(c, r)
        return t == .rock || t == .hedge
    }

    @inline(__always) static func cellIndex(_ v: Double) -> Int { Int((v / K.cell).rounded(.down)) }

    public func isShotBlockedAt(_ x: Double, _ y: Double) -> Bool {
        if x < 0 || y < 0 || x >= K.arenaW || y >= K.arenaH { return true }
        return blocksShot(Self.cellIndex(x), Self.cellIndex(y))
    }

    public func isWalkableAt(_ x: Double, _ y: Double) -> Bool {
        if x < 0 || y < 0 || x >= K.arenaW || y >= K.arenaH { return false }
        return !blocksWalk(Self.cellIndex(x), Self.cellIndex(y))
    }

    /// Ligne de vue (échantillonnage en pas de 8 pt).
    public func lineOfSight(_ a: Vec, _ b: Vec, flyingTarget: Bool = false) -> Bool {
        let dx = b.x - a.x
        let dy = b.y - a.y
        let d = DMath.hypot(dx, dy)
        let steps = Int((d / 8).rounded(.up))
        var i = 1
        while i < steps {
            let x = a.x + (dx * Double(i)) / Double(steps)
            let y = a.y + (dy * Double(i)) / Double(steps)
            let t = tile(Self.cellIndex(x), Self.cellIndex(y))
            if t == .rock { return false }
            if t == .hedge && !flyingTarget { return false }
            i += 1
        }
        return true
    }

    /// Déplace un cercle en résolvant les collisions axe par axe contre les cases bloquantes et les bords.
    public func moveCircle(_ p: inout Vec, _ dx: Double, _ dy: Double, _ rad: Double, flying: Bool = false) {
        p.x = clampJS(p.x + dx, rad, K.arenaW - rad)
        if !flying { resolve(&p, rad, xAxis: true) }
        p.y = clampJS(p.y + dy, rad, K.arenaH - rad)
        if !flying { resolve(&p, rad, xAxis: false) }
        p.x = clampJS(p.x, rad, K.arenaW - rad)
        p.y = clampJS(p.y, rad, K.arenaH - rad)
    }

    private func resolve(_ p: inout Vec, _ rad: Double, xAxis: Bool) {
        let c0 = Self.cellIndex(p.x - rad)
        let c1 = Self.cellIndex(p.x + rad)
        let r0 = Self.cellIndex(p.y - rad)
        let r1 = Self.cellIndex(p.y + rad)
        if r0 > r1 || c0 > c1 { return }
        for r in r0...r1 {
            for c in c0...c1 {
                if c < 0 || r < 0 || c >= K.cols || r >= K.rows { continue }
                if !blocksWalk(c, r) { continue }
                let bx0 = Double(c) * K.cell
                let by0 = Double(r) * K.cell
                let nx = clampJS(p.x, bx0, bx0 + K.cell)
                let ny = clampJS(p.y, by0, by0 + K.cell)
                let ox = p.x - nx
                let oy = p.y - ny
                let d2 = ox * ox + oy * oy
                if d2 >= rad * rad { continue }
                let d = d2.squareRoot()
                if d > 1e-6 {
                    let push = rad - d
                    if xAxis { p.x += (ox / d) * push } else { p.y += (oy / d) * push }
                } else {
                    if xAxis { p.x = p.x - bx0 < K.cell / 2 ? bx0 - rad : bx0 + K.cell + rad }
                    else { p.y = p.y - by0 < K.cell / 2 ? by0 - rad : by0 + K.cell + rad }
                }
            }
        }
    }

    /// Distance BFS (4-voisins) vers la case contenant `target` ; -1 = inaccessible.
    public func flowTo(_ target: Vec) -> [Int16] {
        let tc = Int(clampJS(Double(Self.cellIndex(target.x)), 0, Double(K.cols - 1)))
        let tr = Int(clampJS(Double(Self.cellIndex(target.y)), 0, Double(K.rows - 1)))
        let ti = tr * K.cols + tc
        if ti == flowTarget { return flow }
        flowTarget = ti
        var f = [Int16](repeating: -1, count: K.cols * K.rows)
        var q = [Int](repeating: 0, count: K.cols * K.rows)
        var h = 0
        var t = 0
        f[ti] = 0
        q[t] = ti; t += 1
        while h < t {
            let i = q[h]; h += 1
            let c = i % K.cols
            let r = i / K.cols
            for (nc, nr) in [(c + 1, r), (c - 1, r), (c, r + 1), (c, r - 1)] {
                if nc < 0 || nr < 0 || nc >= K.cols || nr >= K.rows { continue }
                let ni = nr * K.cols + nc
                if f[ni] != -1 || blocksWalk(nc, nr) { continue }
                f[ni] = f[i] + 1
                q[t] = ni; t += 1
            }
        }
        flow = f
        return f
    }

    private static let steerDirs: [(Int, Int)] = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]

    /// Direction de marche (vecteur unitaire) vers `target` en suivant le champ BFS.
    public func steer(_ from: Vec, _ target: Vec) -> Vec {
        if lineOfWalk(from, target) { return normJS(target.x - from.x, target.y - from.y) }
        let f = flowTo(target)
        let c = Self.cellIndex(from.x)
        let r = Self.cellIndex(from.y)
        var best = -1
        var bx = 0
        var by = 0
        let cur: Int = tile(c, r) == .free ? Int(f[r * K.cols + c]) : 9999
        for (dc, dr) in Self.steerDirs {
            let nc = c + dc
            let nr = r + dr
            if nc < 0 || nr < 0 || nc >= K.cols || nr >= K.rows { continue }
            let v = Int(f[nr * K.cols + nc])
            if v < 0 { continue }
            if dc != 0 && dr != 0 && (blocksWalk(c + dc, r) || blocksWalk(c, r + dr)) { continue }
            if best == -1 || v < best {
                best = v
                bx = dc
                by = dr
            }
        }
        if best == -1 || best >= cur { return normJS(target.x - from.x, target.y - from.y) }
        let goal = cellCenter(c + bx, r + by)
        return normJS(goal.x - from.x, goal.y - from.y)
    }

    /// Chemin droit praticable (sans obstacle de marche) entre deux points.
    public func lineOfWalk(_ a: Vec, _ b: Vec) -> Bool {
        let dx = b.x - a.x
        let dy = b.y - a.y
        let d = DMath.hypot(dx, dy)
        let steps = Int((d / 11).rounded(.up))
        if steps < 1 { return true }
        for i in 1...steps {
            let x = a.x + (dx * Double(i)) / Double(steps)
            let y = a.y + (dy * Double(i)) / Double(steps)
            if !isWalkableAt(x, y) { return false }
        }
        return true
    }

    /// Cases libres, pour placer les ennemis.
    public func freeCells() -> [(c: Int, r: Int)] {
        var out: [(c: Int, r: Int)] = []
        for r in 0..<K.rows { for c in 0..<K.cols where tile(c, r) == .free { out.append((c, r)) } }
        return out
    }
}

public func cellCenter(_ c: Int, _ r: Int) -> Vec {
    Vec(Double(c) * K.cell + K.cell / 2, Double(r) * K.cell + K.cell / 2)
}

/// Validation d'un gabarit de salle (§3). Renvoie la liste des erreurs.
public func validateRoom(_ t: RoomTemplate) -> [String] {
    var errs: [String] = []
    if t.id.isEmpty || t.name.isEmpty { errs.append("id/name manquant") }
    guard t.grid.count == K.rows else { return errs + ["grille : \(K.rows) lignes attendues"] }
    let g = t.grid.map { Array($0) }
    var obstacles = 0, portals = 0, spawns = 0
    for (r, row) in g.enumerated() {
        if row.count != K.cols { errs.append("ligne \(r) : \(K.cols) colonnes attendues") }
        for ch in row {
            if !".#~%PS".contains(ch) { errs.append("caractère inconnu « \(ch) » ligne \(r)") }
            if "#~%".contains(ch) { obstacles += 1 }
            if ch == "P" { portals += 1 }
            if ch == "S" { spawns += 1 }
        }
    }
    if errs.contains(where: { $0.contains("colonnes") }) { return errs }
    if obstacles > K.maxObstacles { errs.append("\(obstacles) obstacles (> \(K.maxObstacles))") }
    if portals != 1 || g[0][4] != "P" { errs.append("portail unique attendu en (ligne 0, col 4)") }
    if spawns != 1 || g[K.rows - 1][4] != "S" { errs.append("départ unique attendu en (ligne 14, col 4)") }
    let sym = g.allSatisfy { $0 == Array($0.reversed()) }
    if sym != t.symmetric { errs.append("drapeau symmetric=\(t.symmetric) incohérent") }
    for r in (K.rows - 3)..<K.rows where g[r].contains(where: { "#~%".contains($0) }) {
        errs.append("obstacle dans la zone de départ (ligne \(r))")
    }
    let walk = { (c: Int, r: Int) in ".PS".contains(g[r][c]) }
    var seen: Set<Int> = [(K.rows - 1) * K.cols + 4]
    var stack = [(K.rows - 1) * K.cols + 4]
    while let i = stack.popLast() {
        let c = i % K.cols, r = i / K.cols
        for (nc, nr) in [(c + 1, r), (c - 1, r), (c, r + 1), (c, r - 1)] {
            if nc < 0 || nr < 0 || nc >= K.cols || nr >= K.rows || !walk(nc, nr) { continue }
            let ni = nr * K.cols + nc
            if seen.insert(ni).inserted { stack.append(ni) }
        }
    }
    var walkable = 0
    for r in 0..<K.rows { for c in 0..<K.cols where walk(c, r) { walkable += 1 } }
    if seen.count != walkable { errs.append("\(walkable - seen.count) case(s) libre(s) isolée(s)") }
    if !seen.contains(4) { errs.append("portail inaccessible") }
    return errs
}
