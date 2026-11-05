import SwiftUI

/// Écran titre : scène de théâtre d'ombres, rideaux qui s'ouvrent sur « Lever le rideau » (`titleScreen` du web).
@MainActor
struct TitleView: View {
    let onStart: () -> Void
    @Environment(AppModel.self) private var app
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @State private var opening = false
    @State private var bob = false

    private var reduceMotion: Bool { systemReduceMotion || app.settings.reduceMotion }

    var body: some View {
        let th = KingdomTheme.of(kingdom: 1)
        GeometryReader { outer in
          let insets = outer.safeAreaInsets
          GeometryReader { geo in
            let safeTop = insets.top
            let safeBottom = insets.bottom
            let full = geo.size.height
            let stageTop = 64 + safeTop
            let stageBottom = full * 0.37
            ZStack(alignment: .top) {
                Theme.curtain

                // écran de papier éclairé par derrière (même mise en page que `.stage` / `.screen-paper` du web)
                ZStack(alignment: .top) {
                    RadialGradient(
                        stops: [.init(color: th.lightColor, location: 0), .init(color: th.paperColor, location: 0.6),
                                .init(color: th.edgeColor, location: 1.3)],
                        center: UnitPoint(x: 0.5, y: 0.38), startRadius: 0, endRadius: geo.size.width * 0.62)
                    GeometryReader { paper in
                        // lune découpée
                        ZStack {
                            Circle().fill(Theme.cut)
                            Circle().fill(Theme.ink).frame(width: 84, height: 84).offset(x: 30, y: -18)
                        }
                        .frame(width: 92, height: 92)
                        .clipShape(Circle())
                        .overlay(Circle().strokeBorder(Theme.ink, lineWidth: 4))
                        .position(x: paper.size.width / 2, y: paper.size.height * 0.09 + 46)

                        ForestSilhouette(far: th.farColor)
                            .frame(width: paper.size.width, height: paper.size.height * 0.38)
                            .position(x: paper.size.width / 2, y: paper.size.height * 0.81)

                        // marionnette au bout de sa baguette
                        Rectangle().fill(Theme.ink).frame(width: 2, height: 300)
                            .rotationEffect(.degrees(8), anchor: .top)
                            .position(x: paper.size.width / 2, y: paper.size.height * 0.96 - 170 * 0.28 + 150)
                        Puppet(name: "scout", size: 170)
                            .rotationEffect(.degrees(bob ? 2 : -2))
                            .position(x: paper.size.width / 2, y: paper.size.height * 0.96 - 85 + (bob ? -10 : 0))
                    }
                }
                .frame(width: geo.size.width * 0.82, height: max(0, full - stageTop - stageBottom))
                .clipped()
                .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 6))
                .padding(.top, stageTop)

                // rideaux latéraux, qui s'écartent au lever
                HStack(spacing: 0) {
                    Curtain()
                        .clipShape(CurtainShape(left: true))
                        .frame(width: geo.size.width * 0.22, height: full * 0.7)
                        .offset(x: opening ? -geo.size.width * 0.22 : 0)
                    Spacer(minLength: 0)
                    Curtain()
                        .clipShape(CurtainShape(left: false))
                        .frame(width: geo.size.width * 0.22, height: full * 0.7)
                        .offset(x: opening ? geo.size.width * 0.22 : 0)
                }

                // lambrequin festonné
                Valance().fill(Theme.ink, style: FillStyle(eoFill: true)).frame(height: 58 + safeTop).clipped()

                // bandeau d'encre du titre (filet d'or)
                VStack(spacing: 0) {
                    Spacer(minLength: 0)
                    VStack(spacing: 0) {
                        Rectangle().fill(Theme.goldLeaf).frame(height: 3)
                        VStack(spacing: 0) {
                            Text(K.appName)
                                .font(Theme.display(58))
                                .foregroundStyle(Theme.paper)
                                .tracking(1)
                            Text("Un héros, un doigt, trois cents niveaux.\nBouge pour esquiver ; ta héroïne tire toute seule.")
                                .font(Theme.note(16))
                                .foregroundStyle(Theme.paper3)
                                .multilineTextAlignment(.center)
                                .lineSpacing(3)
                                .padding(.top, 10)
                                .padding(.bottom, 18)
                            Button("Lever le rideau") {
                                app.audio.play(.tap)
                                withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .timingCurve(0.6, 0, 0.3, 1, duration: 0.65)) { opening = true }
                                Task {
                                    try? await Task.sleep(for: .milliseconds(reduceMotion ? 200 : 650))
                                    app.progress.markTitleSeen()
                                    onStart()
                                }
                            }
                            .buttonStyle(InkButtonStyle(kind: .primary))
                            .frame(maxWidth: 320)
                        }
                        .padding(.horizontal, 24)
                        .padding(.top, 18)
                        .padding(.bottom, 28 + safeBottom)
                        .frame(maxWidth: .infinity)
                        .background(Theme.ink)
                    }
                }
                .frame(height: full)
            }
            .frame(width: geo.size.width, height: full)
          }
          .ignoresSafeArea()
        }
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) { bob = true }
        }
    }
}

/// Bas arrondi du rideau, côté scène (`border-bottom-*-radius: 70% 20%` du web).
struct CurtainShape: Shape {
    let left: Bool
    func path(in r: CGRect) -> Path {
        var p = Path()
        let rx = r.width * 0.7, ry = r.height * 0.2
        if left {
            p.move(to: CGPoint(x: r.minX, y: r.minY))
            p.addLine(to: CGPoint(x: r.maxX, y: r.minY))
            p.addLine(to: CGPoint(x: r.maxX, y: r.maxY - ry))
            p.addQuadCurve(to: CGPoint(x: r.maxX - rx, y: r.maxY), control: CGPoint(x: r.maxX, y: r.maxY))
            p.addLine(to: CGPoint(x: r.minX, y: r.maxY))
        } else {
            p.move(to: CGPoint(x: r.maxX, y: r.minY))
            p.addLine(to: CGPoint(x: r.minX, y: r.minY))
            p.addLine(to: CGPoint(x: r.minX, y: r.maxY - ry))
            p.addQuadCurve(to: CGPoint(x: r.minX + rx, y: r.maxY), control: CGPoint(x: r.minX, y: r.maxY))
            p.addLine(to: CGPoint(x: r.maxX, y: r.maxY))
        }
        p.closeSubpath()
        return p
    }
}

/// Lambrequin : bande d'encre festonnée de demi-cercles (pas de 28 pt).
struct Valance: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        p.addRect(r)
        var x: CGFloat = 0
        while x < r.width {
            p.addEllipse(in: CGRect(x: x + 1, y: r.maxY - 13, width: 26, height: 26))
            x += 28
        }
        return p
    }
}

/// Pan de rideau (plis verticaux).
@MainActor
struct Curtain: View {
    var body: some View {
        Canvas { ctx, size in
            // `repeating-linear-gradient(90deg, curtain 0 9px, curtain-2 9px 16px, #1d0b0e 16px 19px)` du web
            ctx.fill(Path(CGRect(origin: .zero, size: size)), with: .color(Theme.curtain))
            var x: CGFloat = 0
            while x < size.width {
                ctx.fill(Path(CGRect(x: x + 9, y: 0, width: 7, height: size.height)), with: .color(Theme.curtain2))
                ctx.fill(Path(CGRect(x: x + 16, y: 0, width: 3, height: size.height)), with: .color(Color(hex: 0x1D0B0E)))
                x += 19
            }
        }
    }
}

/// Forêt d'encre au bas de l'écran titre (même tracé que le web).
@MainActor
struct ForestSilhouette: View {
    let far: Color
    var body: some View {
        Canvas { ctx, size in
            let sx = size.width / 400, sy = size.height / 160
            func path(_ pts: [(CGFloat, CGFloat)]) -> Path {
                var p = Path()
                p.move(to: CGPoint(x: 0, y: size.height))
                for (x, y) in pts { p.addLine(to: CGPoint(x: x * sx, y: y * sy)) }
                p.addLine(to: CGPoint(x: size.width, y: size.height))
                p.closeSubpath()
                return p
            }
            ctx.fill(path([(0, 110), (20, 80), (34, 104), (52, 60), (72, 104), (90, 86), (112, 112), (140, 70), (166, 112), (190, 92), (214, 116), (246, 64), (276, 112), (300, 90), (326, 114), (352, 72), (380, 108), (400, 92)]), with: .color(far))
            ctx.fill(path([(0, 132), (30, 104), (48, 126), (70, 96), (96, 130), (128, 120), (160, 134), (200, 124), (240, 136), (272, 118), (300, 132), (330, 108), (360, 130), (400, 116)]), with: .color(Theme.ink))
        }
    }
}
