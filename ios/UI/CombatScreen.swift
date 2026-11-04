import SwiftUI

/// Combat (§12.3) : la scène SpriteKit en plein écran ; au-dessus, seulement « Niveau n · Salle 2/4 » et la pause.
/// Les écrans de choix du pouvoir, pause, défaite, victoire et fin de tournoi se superposent à la scène.
struct CombatScreen: View {
    let session: CombatSession
    @Environment(AppModel.self) private var app

    var body: some View {
        ZStack {
            Theme.curtain.ignoresSafeArea()
            if let scene = session.scene {
                GameViewHost(scene: scene).ignoresSafeArea()
                hud
            }
            if let o = session.overlay {
                Color.black.opacity(0.001).ignoresSafeArea() // bloque les touches vers la scène
                overlay(o)
                    .transition(.opacity.combined(with: .scale(scale: 0.96)))
            }
        }
        .animation(.easeOut(duration: 0.25), value: session.overlay)
        .persistentSystemOverlays(.hidden)
    }

    private var hud: some View {
        VStack {
            HStack {
                HStack(spacing: 8) {
                    Text(session.mode.isTournament ? "Tournoi" : "Niveau \(session.level.n)")
                        .font(Theme.display(17))
                    Text("Salle \(session.roomIndex + 1)/\(session.roomCount)")
                        .font(Theme.text(14, weight: .bold))
                }
                .foregroundStyle(Theme.ink)
                .padding(.horizontal, 12).padding(.vertical, 5)
                .background(Theme.paper)
                .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 2))
                Spacer()
                Button {
                    app.audio.play(.tap)
                    session.requestPause()
                } label: {
                    HStack(spacing: 5) {
                        Rectangle().frame(width: 5, height: 18)
                        Rectangle().frame(width: 5, height: 18)
                    }
                    .foregroundStyle(Theme.ink)
                    .frame(width: 44, height: 40)
                    .background(Theme.paper)
                    .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 2))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Pause")
            }
            .padding(.horizontal, 12)
            .padding(.top, 4)
            Spacer()
        }
    }

    @ViewBuilder
    private func overlay(_ o: CombatSession.Overlay) -> some View {
        switch o {
        case let .powers(offer, owned, title):
            PowerChoiceView(offer: offer, owned: owned, title: title) { session.pick($0) }
        case .pause:
            PauseView(settings: app.settings) { session.resolvePause($0) }
        case let .defeat(used):
            DefeatView(continuesUsed: used, gems: app.wallet.gems, subscribed: app.subscribed,
                       onContinue: { app.buyContinue(session, used: used) },
                       onRetry: { session.resolveDefeat(.retry) },
                       onMap: { session.resolveDefeat(.map) })
        case let .victory(info):
            VictoryView(info: info, onNext: { app.afterVictory(next: true) }, onMap: { app.afterVictory(next: false) },
                        onChest: info.chestsAvailable > 0 ? { app.openStarChest() } : nil)
        case let .tournament(info):
            TournamentResultView(info: info, onMap: { app.closeCombat() }, onAgain: {
                app.closeCombat()
                Task { @MainActor in
                    try? await Task.sleep(for: .milliseconds(350))
                    app.playTournament()
                }
            })
        }
    }
}

// MARK: - choix du pouvoir (§12.4)

/// Trois cartes illustrées qui se retournent l'une après l'autre ; rareté par couleur de cadre.
struct PowerChoiceView: View {
    let offer: [PowerID]
    let owned: [PowerID: Int]
    let title: String
    let onPick: (PowerID) -> Void
    @Environment(AppModel.self) private var app
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @State private var flipped: [Bool] = [false, false, false]
    @State private var picked: PowerID?

    var body: some View {
        VStack(spacing: 18) {
            Text(title).font(Theme.display(30)).foregroundStyle(Theme.cut)
                .shadow(color: Theme.ink, radius: 0, x: 2, y: 2)
            HStack(spacing: 10) {
                ForEach(Array(offer.enumerated()), id: \.offset) { i, id in
                    card(id, i)
                }
            }
            .padding(.horizontal, 12)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.ink.opacity(0.72).ignoresSafeArea())
        .task {
            let reduce = systemReduceMotion || app.settings.reduceMotion
            for i in offer.indices {
                try? await Task.sleep(for: .milliseconds(reduce ? 60 : (i == 0 ? 350 : 160)))
                app.audio.play(.flip)
                withAnimation(reduce ? .easeOut(duration: 0.1) : .spring(response: 0.45, dampingFraction: 0.75)) { flipped[i] = true }
            }
        }
    }

    private func card(_ id: PowerID, _ i: Int) -> some View {
        let p = Powers.def(id)
        let isUp = i < flipped.count && flipped[i]
        return Button {
            guard picked == nil, isUp else { return }
            picked = id
            app.audio.play(.star)
            Task {
                try? await Task.sleep(for: .milliseconds(550))
                onPick(id)
            }
        } label: {
            ZStack {
                // dos de la carte : lune découpée
                Rectangle().fill(Theme.curtain)
                    .overlay(Circle().fill(Theme.cut).frame(width: 40).overlay(Circle().fill(Theme.curtain).frame(width: 34).offset(x: 9, y: -6)))
                    .opacity(isUp ? 0 : 1)
                VStack(spacing: 6) {
                    Text(p.rarity.label.uppercased()).font(Theme.text(11, weight: .heavy)).foregroundStyle(p.rarity.color)
                    InkIcon(name: "power_\(id.rawValue)", size: 56, fallback: "sparkles")
                    HStack(spacing: 3) {
                        Text(p.name).font(Theme.display(16)).multilineTextAlignment(.center)
                        if let n = owned[id], n > 0 { Text("×\(n + 1)").font(Theme.text(12, weight: .heavy)) }
                    }
                    Text(p.desc).font(Theme.text(12)).multilineTextAlignment(.center).foregroundStyle(Theme.ink2)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 0)
                }
                .padding(8)
                .foregroundStyle(Theme.ink)
                .opacity(isUp ? 1 : 0)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 210)
            .background(Theme.cut)
            .overlay(Rectangle().strokeBorder(p.rarity.color, lineWidth: 4))
            .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 1.5).padding(4))
            .background(Theme.ink.offset(x: 4, y: 4))
            .rotation3DEffect(.degrees(isUp ? 0 : 180), axis: (x: 0, y: 1, z: 0), perspective: 0.6)
            .scaleEffect(picked == id ? 1.08 : picked != nil ? 0.92 : 1)
            .opacity(picked != nil && picked != id ? 0.4 : 1)
            .animation(.spring(response: 0.35), value: picked)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(p.name), \(p.rarity.label). \(p.desc)")
    }
}

// MARK: - pause

struct PauseView: View {
    @Bindable var settings: GameSettings
    let onChoice: (PauseChoice) -> Void

    var body: some View {
        VStack(spacing: 0) {
            Text("Pause").font(Theme.display(32)).foregroundStyle(Theme.ink).padding(.bottom, 6)
            toggle("Effets sonores", $settings.sound)
            toggle("Musique", $settings.music)
            toggle("Vibrations", $settings.haptics)
            toggle("Réduire les animations", $settings.reduceMotion)
            Button("Reprendre") { onChoice(.resume) }
                .buttonStyle(InkButtonStyle(kind: .primary))
                .padding(.top, 16)
            Button("Quitter le niveau") { onChoice(.quit) }
                .buttonStyle(InkButtonStyle(kind: .ghost))
                .padding(.top, 10)
        }
        .padding(20)
        .frame(maxWidth: 340)
        .paperCard(fill: Theme.paper)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.ink.opacity(0.6).ignoresSafeArea())
    }

    private func toggle(_ title: String, _ b: Binding<Bool>) -> some View {
        Toggle(isOn: b) { Text(title).font(Theme.text(16, weight: .bold)).foregroundStyle(Theme.ink) }
            .toggleStyle(InkToggleStyle())
            .padding(.vertical, 8)
            .overlay(alignment: .bottom) { DashedRule() }
    }
}

// MARK: - défaite (§12.5, §11)

struct DefeatView: View {
    let continuesUsed: Int
    let gems: Int
    let subscribed: Bool
    let onContinue: () -> Void
    let onRetry: () -> Void
    let onMap: () -> Void
    @Environment(AppModel.self) private var app
    @State private var showDragon = false

    var body: some View {
        let cost = ShopPrices.continueCost(continuesUsed)
        VStack(spacing: 12) {
            Text("Défaite").font(Theme.display(40)).foregroundStyle(Theme.ink)
            Text("L’ombre t’a rattrapée…").font(Theme.note(16)).foregroundStyle(Theme.ink2)
            Puppet(name: app.currentHero.rawValue, size: 110).opacity(0.5).grayscale(1)
            if let cost {
                Button(action: onContinue) {
                    HStack {
                        Text("Continuer")
                        Spacer()
                        HStack(spacing: 3) {
                            InkIcon(name: "ui_gem", size: 18, fallback: "diamond.fill")
                            Text("\(cost)").font(Theme.text(17, weight: .heavy))
                        }
                        .padding(.horizontal, 8)
                        .background(Theme.cut)
                        .foregroundStyle(Theme.ink)
                    }
                }
                .buttonStyle(InkButtonStyle(kind: .jade))
                .disabled(gems < cost)
                .opacity(gems < cost ? 0.55 : 1)
                Text("Rend 50 % des PV et efface les projectiles.").font(Theme.note(12)).foregroundStyle(Theme.ink2)
            }
            HStack(spacing: 10) {
                Button("Carte", action: onMap).buttonStyle(InkButtonStyle(kind: .ghost))
                Button("Réessayer", action: onRetry).buttonStyle(InkButtonStyle(kind: .primary))
            }
            if !subscribed {
                // §11 : paywall en bouton secondaire de l'écran de défaite (le combat est terminé)
                Button {
                    showDragon = true
                } label: {
                    HStack(spacing: 6) {
                        InkIcon(name: "ui_crown", size: 18, fallback: "crown.fill")
                        Text("Ordre du Dragon : vies illimitées").font(Theme.text(14, weight: .bold)).underline()
                    }
                    .foregroundStyle(Theme.ink)
                }
                .buttonStyle(.plain)
                .padding(.top, 4)
            }
        }
        .padding(22)
        .frame(maxWidth: 360)
        .paperCard(fill: Theme.paper)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.ink.opacity(0.65).ignoresSafeArea())
        .sheet(isPresented: $showDragon) {
            DragonView(context: .defeat, store: app.store, wallet: app.wallet)
        }
    }
}

// MARK: - victoire (§12.5)

/// Étoiles qui tombent une à une, or qui défile, coffre d'étoiles, NIVEAU SUIVANT.
struct VictoryView: View {
    let info: VictoryInfo
    let onNext: () -> Void
    let onMap: () -> Void
    var onChest: (() -> Void)?
    @Environment(AppModel.self) private var app
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @State private var shownStars = 0
    @State private var gold = 0
    @State private var chestOpened = false

    var body: some View {
        VStack(spacing: 12) {
            Text("Victoire !").font(Theme.display(42)).foregroundStyle(Theme.ink)
            HStack(spacing: 8) {
                ForEach(0..<3, id: \.self) { i in
                    ZStack {
                        InkIcon(name: "ui_starEmpty", size: 54, fallback: "star")
                        if i < shownStars {
                            InkIcon(name: "ui_star", size: 54, fallback: "star.fill")
                                .transition(.asymmetric(insertion: .scale(scale: 2.2).combined(with: .opacity), removal: .identity))
                        }
                    }
                    .offset(y: i == 1 ? -10 : 0)
                }
            }
            Puppet(name: app.currentHero.rawValue, size: 120)
            HStack(spacing: 18) {
                stat("Or", "+\(gold)", icon: "ui_coin")
                stat("Ennemis", "\(info.kills)")
                stat("Temps", "\(Int(info.seconds.rounded())) s")
            }
            if info.dragonBonus {
                Text("dont +25 % de l’Ordre du Dragon").font(Theme.note(12)).foregroundStyle(Theme.ink2)
            }
            Text("+\(info.passXP) XP du pass de saison").font(Theme.note(12)).foregroundStyle(Theme.ink2)
            if let onChest, !chestOpened {
                Button {
                    chestOpened = true
                    onChest()
                } label: {
                    HStack {
                        InkIcon(name: "ui_chest", size: 26, fallback: "shippingbox.fill")
                        Text("Ouvrir le coffre d’étoiles")
                    }
                }
                .buttonStyle(InkButtonStyle(kind: .jade))
            }
            HStack(spacing: 10) {
                Button("Carte", action: onMap).buttonStyle(InkButtonStyle(kind: .ghost))
                if !info.isLast {
                    Button("Niveau suivant", action: onNext).buttonStyle(InkButtonStyle(kind: .primary))
                }
            }
        }
        .padding(22)
        .frame(maxWidth: 380)
        .paperCard(fill: Theme.paper)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.ink.opacity(0.6).ignoresSafeArea())
        .toast(Binding(get: { app.toast }, set: { app.toast = $0 }))
        .task {
            let reduce = systemReduceMotion || app.settings.reduceMotion
            try? await Task.sleep(for: .milliseconds(reduce ? 100 : 600))
            for _ in 0..<info.stars {
                withAnimation(reduce ? .easeOut(duration: 0.1) : .spring(response: 0.35, dampingFraction: 0.55)) { shownStars += 1 }
                app.audio.play(.star)
                try? await Task.sleep(for: .milliseconds(reduce ? 80 : 450))
            }
            // l'or défile
            let steps = 20
            for s in 1...steps {
                gold = Int((Double(info.gold) * Double(s) / Double(steps)).rounded())
                try? await Task.sleep(for: .milliseconds(reduce ? 5 : 40))
            }
        }
    }

    private func stat(_ label: String, _ value: String, icon: String? = nil) -> some View {
        VStack(spacing: 2) {
            if let icon { InkIcon(name: icon, size: 22, fallback: "circle.fill") } else { Text(label).font(Theme.note(12)) }
            Text(value).font(Theme.text(20, weight: .heavy)).monospacedDigit()
        }
        .foregroundStyle(Theme.ink)
    }
}

// MARK: - fin d'un essai de tournoi

struct TournamentResultView: View {
    let info: TournamentInfo
    let onMap: () -> Void
    let onAgain: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            Text(info.won ? "Tournoi terminé" : "Essai terminé").font(Theme.display(34)).foregroundStyle(Theme.ink)
            Text("\(info.score)").font(Theme.display(54)).foregroundStyle(Theme.vermilion)
            Text(info.newBest ? "Nouveau meilleur score !" : "Meilleur score : \(info.best)").font(Theme.note(15)).foregroundStyle(Theme.ink2)
            HStack(spacing: 18) {
                stat("Ennemis", "\(info.kills)")
                stat("PV restants", "\(Int(info.hpLeft.rounded()))")
                stat("Temps", "\(Int(info.seconds.rounded())) s")
            }
            Text("Score = ennemis × 100 + PV × 5 + (240 − secondes) × 40").font(Theme.note(11)).foregroundStyle(Theme.ink2)
            HStack(spacing: 10) {
                Button("Carte", action: onMap).buttonStyle(InkButtonStyle(kind: .ghost))
                Button("Rejouer (\(info.attemptsLeft))", action: onAgain)
                    .buttonStyle(InkButtonStyle(kind: .primary))
                    .disabled(info.attemptsLeft <= 0)
                    .opacity(info.attemptsLeft <= 0 ? 0.5 : 1)
            }
        }
        .padding(22)
        .frame(maxWidth: 380)
        .paperCard(fill: Theme.paper)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.ink.opacity(0.6).ignoresSafeArea())
    }

    private func stat(_ label: String, _ value: String) -> some View {
        VStack(spacing: 2) {
            Text(label).font(Theme.note(12))
            Text(value).font(Theme.text(20, weight: .heavy)).monospacedDigit()
        }
        .foregroundStyle(Theme.ink)
    }
}
