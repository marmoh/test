import SwiftUI

/// Carte saga (§12.1, port de `web/src/map.ts`) : chemin sinueux à défilement vertical à travers les 5 royaumes,
/// 300 nœuds (étoiles, crâne des niveaux difficiles, boss), avatar de l'héroïne sur le niveau courant,
/// vies et gemmes en haut, bandeaux du tournoi et du pass, navigation basse.
@MainActor
struct MapScreen: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        ZStack(alignment: .top) {
            SagaMap(current: app.progress.unlocked) { app.openLevel($0) }
                .ignoresSafeArea(edges: .bottom)
            VStack(spacing: 8) {
                TopBar()
                HStack(alignment: .top) {
                    if app.wallet.weeklyGemsClaimable() && app.subscribed {
                        TributeTag { app.claimTribute() }
                    }
                    Spacer()
                }
                .padding(.horizontal, 12)
                Spacer()
                VStack(spacing: 6) {
                    TournamentBanner()
                    PassBanner()
                }
                .padding(.horizontal, 12)
                BottomNav()
            }
        }
        .background(Theme.curtain.ignoresSafeArea())
    }
}

// MARK: - géométrie (identique au web)

enum MapGeo {
    static let width: CGFloat = 400
    static let step: CGFloat = 96
    static let padTop: CGFloat = 300
    static let padBottom: CGFloat = 300
    static let height: CGFloat = padTop + CGFloat(K.levelCount - 1) * step + padBottom
    static let chunk = 4

    static func nodeY(_ n: Int) -> CGFloat { height - padBottom - CGFloat(n - 1) * step }
    static func nodeX(_ n: Int) -> CGFloat { width / 2 + sin(CGFloat(n) * 0.55) * 112 + sin(CGFloat(n) * 0.17 + 1) * 18 }
    static func rnd(_ i: Int) -> Double {
        let x = sin(Double(i) * 127.1 + 311.7) * 43758.5453
        return x - floor(x)
    }

    /// Haut (global) du tronçon g (niveaux 4g+1 … 4g+4).
    static func chunkTop(_ g: Int) -> CGFloat { nodeY(g * chunk + chunk) - step / 2 }
    static let headerHeight: CGFloat = nodeY(K.levelCount) - step / 2
    static let footerHeight: CGFloat = height - (nodeY(1) + step / 2)
    static var chunkCount: Int { K.levelCount / chunk }

    /// Couleur du ciel à la hauteur globale y (dégradé continu par royaume).
    static func sky(_ y: CGFloat) -> Color {
        for k in 0..<5 {
            let top = nodeY(60 * (k + 1)) - step / 2
            let bot = nodeY(60 * k + 1) + step / 2
            if y >= top - 1 && y <= bot + 1 {
                let th = KingdomTheme.all[k]
                return mix(th.sky.0, th.sky.1, Double((y - top) / max(1, bot - top)))
            }
        }
        return Theme.paper
    }

    static func mix(_ a: UIColor, _ b: UIColor, _ f: Double) -> Color {
        var r1: CGFloat = 0, g1: CGFloat = 0, b1: CGFloat = 0, a1: CGFloat = 0
        var r2: CGFloat = 0, g2: CGFloat = 0, b2: CGFloat = 0, a2: CGFloat = 0
        _ = a.getRed(&r1, green: &g1, blue: &b1, alpha: &a1)
        _ = b.getRed(&r2, green: &g2, blue: &b2, alpha: &a2)
        let t = CGFloat(max(0, min(1, f)))
        return Color(red: r1 + (r2 - r1) * t, green: g1 + (g2 - g1) * t, blue: b1 + (b2 - b1) * t)
    }
}

// MARK: - carte défilante

@MainActor
struct SagaMap: View {
    let current: Int
    let onSelect: (Int) -> Void

    var body: some View {
        GeometryReader { geo in
            let k = geo.size.width / MapGeo.width
            ScrollViewReader { proxy in
                ScrollView(.vertical, showsIndicators: false) {
                    LazyVStack(spacing: 0) {
                        MapHeader().frame(height: MapGeo.headerHeight * k).id("header")
                        ForEach((0..<MapGeo.chunkCount).reversed(), id: \.self) { g in
                            MapChunk(g: g, current: current, k: k, onSelect: onSelect)
                                .frame(height: CGFloat(MapGeo.chunk) * MapGeo.step * k)
                                .id(g)
                        }
                        MapGeo.sky(MapGeo.height).frame(height: MapGeo.footerHeight * k)
                    }
                }
                .onAppear {
                    proxy.scrollTo((max(1, current) - 1) / MapGeo.chunk, anchor: UnitPoint(x: 0.5, y: 0.5))
                }
                .onChange(of: current) { _, n in
                    withAnimation(.easeInOut(duration: 0.6)) { proxy.scrollTo((max(1, n) - 1) / MapGeo.chunk, anchor: .center) }
                }
            }
        }
    }
}

/// Le Trône de la Lune, au sommet de la carte.
@MainActor
struct MapHeader: View {
    var body: some View {
        GeometryReader { geo in
            let k = geo.size.width / MapGeo.width
            ZStack(alignment: .top) {
                LinearGradient(colors: [MapGeo.sky(0), MapGeo.sky(MapGeo.headerHeight)], startPoint: .top, endPoint: .bottom)
                ZStack {
                    Circle().fill(Theme.ink).frame(width: 84 * k, height: 84 * k)
                    Circle().fill(Theme.cut).frame(width: 76 * k, height: 76 * k)
                    Circle().fill(Theme.ink).frame(width: 68 * k, height: 68 * k).offset(x: 15 * k, y: -9 * k)
                }
                .offset(y: 88 * k)
                Text("Le Trône de la Lune").font(Theme.display(22 * k)).foregroundStyle(Theme.ink).offset(y: 200 * k)
            }
        }
    }
}

/// Quatre niveaux de la carte : ciel, chemin, décor (Canvas), puis les nœuds (boutons).
@MainActor
struct MapChunk: View {
    let g: Int
    let current: Int
    let k: CGFloat
    let onSelect: (Int) -> Void
    @Environment(AppModel.self) private var app

    private var first: Int { g * MapGeo.chunk + 1 }
    private var last: Int { g * MapGeo.chunk + MapGeo.chunk }
    private var top: CGFloat { MapGeo.chunkTop(g) }

    /// Position locale (pt écran) d'un nœud.
    private func local(_ n: Int) -> CGPoint { CGPoint(x: MapGeo.nodeX(n) * k, y: (MapGeo.nodeY(n) - top) * k) }

    var body: some View {
        ZStack(alignment: .topLeading) {
            Canvas { ctx, size in draw(ctx, size) }
            ForEach(first...last, id: \.self) { n in
                MapNode(n: n, current: current, stars: app.progress.stars(n)) { onSelect(n) }
                    .position(local(n))
            }
            if (first...last).contains(current) {
                MapAvatar(heroId: app.currentHero, crown: app.subscribed && app.wallet.snapshot.dragonSkin)
                    .position(x: local(current).x, y: local(current).y - (Formulas.levelKind(current) == .boss ? 70 : 58) * k)
            }
        }
    }

    private func draw(_ ctx: GraphicsContext, _ size: CGSize) {
        // ciel continu
        let rect = CGRect(origin: .zero, size: size)
        ctx.fill(Path(rect), with: .linearGradient(Gradient(colors: [MapGeo.sky(top), MapGeo.sky(top + CGFloat(MapGeo.chunk) * MapGeo.step)]),
                                                   startPoint: .zero, endPoint: CGPoint(x: 0, y: size.height)))
        // décor découpé (y compris celui des voisins, pour les raccords)
        for n in max(1, first - 1)...min(K.levelCount, last + 1) { decorations(ctx, n) }
        // chemin : ombre large puis pointillés d'encre ; parcours déjà fait en vermillon
        let lo = max(1, first - 1), hi = min(K.levelCount, last + 1)
        let path = route(lo, hi)
        ctx.stroke(path, with: .color(Theme.ink.opacity(0.12)), style: StrokeStyle(lineWidth: 22 * k, lineCap: .round))
        ctx.stroke(path, with: .color(Theme.ink), style: StrokeStyle(lineWidth: 2.5 * k, lineCap: .round, dash: [9 * k, 7 * k]))
        if current > lo {
            let done = route(lo, min(hi, current))
            ctx.stroke(done, with: .color(Theme.vermilion), style: StrokeStyle(lineWidth: 3.5 * k, lineCap: .round, dash: [9 * k, 7 * k]))
        }
        // bandeaux de royaume et de chapitre
        for n in first...last where Formulas.positionOf(n) == 1 {
            let info = Formulas.levelInfo(n)
            let th = KingdomTheme.all[info.kingdom - 1]
            let y = (MapGeo.nodeY(n) - top + 58) * k
            if (info.chapter - 1) % 3 == 0 {
                let r = CGRect(x: (MapGeo.width / 2 - 150) * k, y: y, width: 300 * k, height: 52 * k)
                ctx.fill(Path(r.offsetBy(dx: 4 * k, dy: 4 * k)), with: .color(Theme.ink))
                ctx.fill(Path(r), with: .color(th.lightColor))
                ctx.stroke(Path(r), with: .color(Theme.ink), lineWidth: 2.5 * k)
                ctx.draw(Text(th.name).font(Theme.display(19 * k)).foregroundColor(Theme.ink), at: CGPoint(x: r.midX, y: r.minY + 18 * k))
                let roman = ["I", "II", "III", "IV", "V"][info.kingdom - 1]
                ctx.draw(Text("Royaume \(roman) · chapitres \(info.chapter) à \(info.chapter + 2)").font(Theme.note(11 * k)).foregroundColor(Theme.ink2),
                         at: CGPoint(x: r.midX, y: r.minY + 38 * k))
            } else {
                let r = CGRect(x: (MapGeo.width / 2 - 54) * k, y: y - 11 * k, width: 108 * k, height: 22 * k)
                ctx.fill(Path(r), with: .color(Theme.ink))
                ctx.draw(Text("Chapitre \(info.chapter)").font(Theme.text(12 * k, weight: .bold)).foregroundColor(Theme.cut), at: CGPoint(x: r.midX, y: r.midY))
            }
        }
    }

    /// Chemin de Catmull-Rom entre les nœuds lo…hi (même construction que `pathD`).
    private func route(_ lo: Int, _ hi: Int) -> Path {
        var p = Path()
        guard hi > lo else { return p }
        func pt(_ n: Int) -> CGPoint { local(max(1, min(K.levelCount, n))) }
        p.move(to: pt(lo))
        for n in lo..<hi {
            let p0 = pt(n - 1), p1 = pt(n), p2 = pt(n + 1), p3 = pt(n + 2)
            let c1 = CGPoint(x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6)
            let c2 = CGPoint(x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6)
            p.addCurve(to: p2, control1: c1, control2: c2)
        }
        return p
    }

    /// Silhouettes de décor découpées dans l'encre (plus pâles au loin), comme `decoration()` du web.
    private func decorations(_ ctx: GraphicsContext, _ n: Int) {
        let info = Formulas.levelInfo(n)
        let th = KingdomTheme.all[info.kingdom - 1]
        let x = MapGeo.nodeX(n)
        let y = MapGeo.nodeY(n)
        for j in 0..<2 {
            let side: CGFloat = (MapGeo.rnd(n * 3 + j) < 0.5 ? -1 : 1) * (x > MapGeo.width / 2 ? (j == 0 ? -1 : 1) : (j == 0 ? 1 : -1))
            let dx = side * CGFloat(80 + MapGeo.rnd(n * 7 + j) * 70)
            let xx = min(MapGeo.width - 24, max(24, x + dx))
            if Swift.abs(xx - x) < 60 { continue }
            let yy = y + CGFloat((MapGeo.rnd(n * 11 + j) - 0.5) * 60)
            let i = n * 2 + j
            let far = MapGeo.rnd(i * 7) < 0.4
            let s = CGFloat(0.7 + MapGeo.rnd(n * 5 + j) * 0.6) * (far ? 0.75 : 1)
            var c = ctx
            c.translateBy(x: xx * k, y: (yy - top) * k)
            c.scaleBy(x: s * k, y: s * k)
            c.fill(Self.decorPath(th.mote, MapGeo.rnd(i)), with: .color(far ? th.farColor : Theme.ink))
        }
    }

    static func decorPath(_ kind: KingdomTheme.Mote, _ r: Double) -> Path {
        var p = Path()
        func poly(_ pts: [(CGFloat, CGFloat)]) {
            p.move(to: CGPoint(x: pts[0].0, y: pts[0].1))
            for q in pts.dropFirst() { p.addLine(to: CGPoint(x: q.0, y: q.1)) }
            p.closeSubpath()
        }
        switch kind {
        case .firefly:
            if r < 0.7 {
                poly([(0, -50), (9, -34), (5, -34), (15, -18), (8, -18), (19, 0), (-19, 0), (-8, -18), (-15, -18), (-5, -34), (-9, -34)])
                p.addRect(CGRect(x: -3, y: 0, width: 6, height: 9))
            } else {
                poly([(-3, 8), (-3, -6), (3, -6), (3, 8)])
                p.addEllipse(in: CGRect(x: -13, y: -18, width: 26, height: 14))
            }
        case .spore:
            p.addEllipse(in: CGRect(x: -5, y: -49, width: 6, height: 14))
            p.addEllipse(in: CGRect(x: 5.5, y: -38, width: 5, height: 12))
            poly([(1, 6), (-1, -40), (3, -40), (3, 6)])
            poly([(5, 6), (6, -30), (9, -30), (8, 6)])
        case .sand:
            if r < 0.55 {
                poly([(-4, 6), (-4, -34), (4, -34), (4, 6)])
                poly([(-4, -14), (-12, -14), (-12, -26), (-8, -26), (-8, -18), (-4, -18)])
                poly([(4, -8), (12, -8), (12, -22), (8, -22), (8, -12), (4, -12)])
            } else {
                p.addRect(CGRect(x: -8, y: -34, width: 16, height: 40))
                p.addRect(CGRect(x: -12, y: -41, width: 24, height: 7))
            }
        case .snow:
            if r < 0.55 { poly([(-32, 6), (-4, -42), (24, 6)]) } else {
                poly([(0, -44), (11, -26), (5, -26), (15, -10), (7, -10), (18, 6), (-18, 6), (-7, -10), (-15, -10), (-5, -26), (-11, -26)])
            }
        case .ember:
            if r < 0.5 { poly([(-36, 6), (-11, -30), (11, -30), (36, 6)]) } else {
                poly([(-10, 6), (-4, -32), (2, -8), (8, -24), (12, 6)])
            }
        }
        return p
    }
}

/// Nœud de niveau : numéro, étoiles, crâne (difficile), boss (couronne et portrait).
@MainActor
struct MapNode: View {
    let n: Int
    let current: Int
    let stars: Int
    let action: () -> Void

    var body: some View {
        let info = Formulas.levelInfo(n)
        let th = KingdomTheme.all[info.kingdom - 1]
        let locked = n > current
        let isBoss = info.kind == .boss
        let isCurrent = n == current
        let r: CGFloat = isBoss ? 30 : 21
        Button(action: action) {
            ZStack {
                if isCurrent {
                    Circle().strokeBorder(Theme.vermilion, style: StrokeStyle(lineWidth: 2.5, dash: [4, 4]))
                        .frame(width: (r + 7) * 2, height: (r + 7) * 2)
                }
                Circle().fill(Theme.ink).frame(width: r * 2, height: r * 2).offset(x: 3, y: 3)
                if isBoss {
                    Circle().fill(locked ? Theme.ink : Theme.vermilion).frame(width: (r + 3) * 2, height: (r + 3) * 2)
                        .overlay(Circle().strokeBorder(Theme.ink, lineWidth: 3))
                    Circle().fill(locked ? Theme.ink2 : th.lightColor).frame(width: (r - 3) * 2, height: (r - 3) * 2)
                    Puppet(name: Bosses.byKingdom[info.kingdom - 1].rawValue, size: r * 2.2)
                        .clipShape(Circle().scale(0.78))
                        .opacity(locked ? 0.3 : 1)
                    InkIcon(name: "ui_crown", size: 24, fallback: "crown.fill").offset(y: -r - 8)
                } else {
                    Circle().fill(locked ? Theme.ink : isCurrent ? Theme.vermilion : th.lightColor)
                        .frame(width: r * 2, height: r * 2)
                        .overlay(Circle().strokeBorder(Theme.ink, lineWidth: 3))
                    if !locked {
                        Circle().strokeBorder(isCurrent ? Theme.cut : Theme.ink, lineWidth: 1).opacity(0.6).frame(width: (r - 5) * 2, height: (r - 5) * 2)
                    }
                    Text("\(n)")
                        .font(Theme.display(17))
                        .foregroundStyle(locked ? Theme.ink3 : isCurrent ? Theme.cut : Theme.ink)
                    if info.kind == .hard {
                        InkIcon(name: "ui_skull", size: 22, fallback: "exclamationmark.triangle.fill").offset(x: r - 1, y: -r + 3)
                    }
                }
                if !locked && n < current {
                    HStack(spacing: -2) {
                        ForEach(0..<3, id: \.self) { i in
                            InkIcon(name: i < stars ? "ui_star" : "ui_starEmpty", size: 16, fallback: i < stars ? "star.fill" : "star")
                                .offset(y: i == 1 ? -3 : 0)
                        }
                    }
                    .offset(y: r + 9)
                }
            }
            .frame(width: (r + 10) * 2, height: (r + 10) * 2)
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .disabled(locked)
        .accessibilityLabel("Niveau \(n)\(isBoss ? ", boss" : info.kind == .hard ? ", difficile" : "")\(locked ? ", verrouillé" : ", \(stars) étoiles")")
    }
}

/// La marionnette de l'héroïne tenue par sa baguette, sur le niveau courant.
@MainActor
struct MapAvatar: View {
    let heroId: HeroID
    let crown: Bool
    @State private var bob = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(spacing: 0) {
            ZStack(alignment: .top) {
                Puppet(name: heroId.rawValue, size: 60)
                if crown { InkIcon(name: "ui_crown", size: 18).foregroundStyle(Theme.goldLeaf).offset(y: -6) }
            }
            Rectangle().fill(Theme.ink).frame(width: 2, height: 24)
        }
        .offset(y: bob ? -4 : 2)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) { bob = true }
        }
        .allowsHitTesting(false)
    }
}

// MARK: - barre du haut, étiquettes, bandeaux, navigation

@MainActor
struct TopBar: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        HStack(spacing: 8) {
            Chip(action: { app.audio.play(.tap); app.sheet = .lives }) {
                InkIcon(name: "ui_heart", size: 20, fallback: "heart.fill")
                if app.subscribed {
                    Text("∞")
                } else {
                    TimelineView(.periodic(from: .now, by: 1)) { _ in
                        let s = app.lives.state
                        HStack(spacing: 4) {
                            Text("\(s.lives)")
                            if let left = app.lives.secondsToNextLife {
                                Text(LivesView.clock(left)).font(Theme.text(11, weight: .bold)).foregroundStyle(Theme.ink2).monospacedDigit()
                            } else {
                                Text("max").font(Theme.text(11, weight: .bold)).foregroundStyle(Theme.ink2)
                            }
                        }
                    }
                }
            }
            .accessibilityLabel("Vies")
            Chip {
                InkIcon(name: "ui_star", size: 20, fallback: "star.fill")
                Text("\(app.progress.totalStars)")
            }
            Chip {
                InkIcon(name: "ui_coin", size: 20, fallback: "circle.fill")
                Text("\(app.wallet.gold)")
            }
            Spacer(minLength: 0)
            Chip(action: { app.audio.play(.tap); app.sheet = .shop }) {
                InkIcon(name: "ui_gem", size: 20, fallback: "diamond.fill")
                Text("\(app.wallet.gems)")
                Text("+").foregroundStyle(Theme.vermilion)
            }
            .accessibilityLabel("Gemmes, boutique")
        }
        .padding(.horizontal, 12)
        .padding(.top, 4)
    }
}

/// « Tribut de l'Ordre » : 60 gemmes à réclamer chaque semaine (abonnés).
@MainActor
struct TributeTag: View {
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                InkIcon(name: "ui_gem", size: 20, fallback: "diamond.fill")
                VStack(alignment: .leading, spacing: 0) {
                    Text("\(DragonPerks.weeklyGems)").font(Theme.text(16, weight: .heavy))
                    Text("Tribut de l’Ordre · réclamer").font(Theme.note(11))
                }
            }
            .foregroundStyle(Theme.ink)
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(Theme.cut)
            .overlay(Rectangle().strokeBorder(Theme.goldLeaf, lineWidth: 2))
            .rotationEffect(.degrees(-2))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Réclamer \(DragonPerks.weeklyGems) gemmes")
    }
}

@MainActor
struct TournamentBanner: View {
    @Environment(AppModel.self) private var app
    var body: some View {
        let wk = Formulas.isoWeek(Date())
        let t = app.progress.tournament(week: app.weekKey)
        Button { app.audio.play(.tap); app.sheet = .tournament } label: {
            HStack(spacing: 10) {
                InkIcon(name: "ui_trophy", size: 30, fallback: "trophy.fill")
                VStack(alignment: .leading, spacing: 1) {
                    Text("Tournoi de la semaine \(wk.week)").font(Theme.display(17))
                    Text("Mêmes conditions pour tous · \(t.attempts) essai\(t.attempts > 1 ? "s" : "")").font(Theme.note(12))
                }
                Spacer()
                Text("›").font(Theme.display(26)).foregroundStyle(Theme.vermilion)
            }
            .foregroundStyle(Theme.ink)
            .padding(.horizontal, 12).padding(.vertical, 6)
            .paperCard(shadow: 3)
        }
        .buttonStyle(.plain)
    }
}

@MainActor
struct PassBanner: View {
    @Environment(AppModel.self) private var app
    var body: some View {
        let pass = app.progress.pass()
        let claimable = pass.claimableCount
        Button { app.audio.play(.tap); app.sheet = .pass } label: {
            HStack(spacing: 10) {
                InkIcon(name: "ui_chest", size: 26, fallback: "gift.fill")
                VStack(alignment: .leading, spacing: 3) {
                    Text("Pass de saison · palier \(pass.tier)/\(SeasonPass.tiers)").font(Theme.text(14, weight: .heavy))
                    GeometryReader { g in
                        ZStack(alignment: .leading) {
                            Rectangle().fill(Theme.paper3)
                            Rectangle().fill(Theme.goldLeaf).frame(width: g.size.width * CGFloat(SeasonPass.progress(pass.points)))
                        }
                    }
                    .frame(height: 5)
                    .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 1))
                }
                if claimable > 0 {
                    Text("\(claimable)").font(Theme.text(13, weight: .heavy)).foregroundStyle(Theme.cut)
                        .frame(minWidth: 22, minHeight: 22).background(Circle().fill(Theme.vermilion))
                }
                Text("›").font(Theme.display(24)).foregroundStyle(Theme.vermilion)
            }
            .foregroundStyle(Theme.ink)
            .padding(.horizontal, 12).padding(.vertical, 6)
            .paperCard(shadow: 3)
        }
        .buttonStyle(.plain)
    }
}

@MainActor
struct BottomNav: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        HStack(spacing: 0) {
            item("Héros", "ui_aegis", "person.fill") { app.sheet = .heroes }
            item("Boutique", "ui_gem", "bag.fill") { app.sheet = .shop }
            item("Carte", "ui_star", "map.fill", on: true) {}
            item("Pass", "ui_chest", "gift.fill") { app.sheet = .pass }
            item("Tournoi", "ui_trophy", "trophy.fill") { app.sheet = .tournament }
            item("Réglages", "ui_scroll", "gearshape.fill") { app.sheet = .settings }
        }
        .padding(.top, 6)
        .padding(.bottom, 2)
        .background(Theme.ink.ignoresSafeArea(edges: .bottom))
    }

    private func item(_ title: String, _ icon: String, _ sys: String, on: Bool = false, action: @escaping () -> Void) -> some View {
        Button {
            app.audio.play(.tap)
            action()
        } label: {
            VStack(spacing: 2) {
                InkIcon(name: icon, size: 24, fallback: sys)
                    .colorInvert()
                Text(title).font(Theme.text(11, weight: .bold))
            }
            .foregroundStyle(on ? Theme.goldLeaf : Theme.paper)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 4)
            .background(on ? Theme.ink2 : Color.clear)
        }
        .buttonStyle(.plain)
    }
}
