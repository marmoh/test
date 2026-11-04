import SwiftUI

/// Écran titre : scène de théâtre d'ombres, rideaux qui s'ouvrent sur « Lever le rideau » (`titleScreen` du web).
struct TitleView: View {
    let onStart: () -> Void
    @Environment(AppModel.self) private var app
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @State private var opening = false
    @State private var bob = false

    private var reduceMotion: Bool { systemReduceMotion || app.settings.reduceMotion }

    var body: some View {
        let th = KingdomTheme.of(kingdom: 1)
        GeometryReader { geo in
            ZStack {
                Theme.curtain.ignoresSafeArea()
                // écran de papier éclairé, lune découpée, forêt d'encre
                ZStack {
                    LinearGradient(colors: [th.skyTop, th.lightColor], startPoint: .top, endPoint: .bottom)
                    Circle().fill(Theme.cut).frame(width: 120, height: 120)
                        .overlay(Circle().fill(Theme.ink).frame(width: 104, height: 104).offset(x: 34, y: -22))
                        .offset(y: -geo.size.height * 0.2)
                    VStack {
                        Spacer()
                        ForestSilhouette(far: th.farColor).frame(height: 160)
                    }
                    Puppet(name: "scout", size: 170)
                        .rotationEffect(.degrees(bob ? 2 : -2))
                        .offset(y: geo.size.height * 0.12 + (bob ? -4 : 4))
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 60)
                .clipped()

                // rideaux
                HStack(spacing: 0) {
                    Curtain().frame(width: geo.size.width / 2).offset(x: opening ? -geo.size.width / 2 : 0)
                    Curtain().frame(width: geo.size.width / 2).offset(x: opening ? geo.size.width / 2 : 0)
                }
                .ignoresSafeArea()
                .opacity(opening ? 0 : 0.92)

                VStack(spacing: 14) {
                    Spacer()
                    Text(K.appName)
                        .font(Theme.display(56))
                        .foregroundStyle(Theme.cut)
                        .shadow(color: Theme.ink, radius: 0, x: 3, y: 3)
                    Text("Un héros, un doigt, trois cents niveaux.\nBouge pour esquiver ; ta héroïne tire toute seule.")
                        .font(Theme.note(17))
                        .foregroundStyle(Theme.paper)
                        .multilineTextAlignment(.center)
                    Button("Lever le rideau") {
                        app.audio.play(.tap)
                        withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .easeInOut(duration: 0.65)) { opening = true }
                        Task {
                            try? await Task.sleep(for: .milliseconds(reduceMotion ? 200 : 650))
                            app.progress.markTitleSeen()
                            onStart()
                        }
                    }
                    .buttonStyle(InkButtonStyle(kind: .primary))
                    .frame(maxWidth: 280)
                    .padding(.bottom, 50)
                }
                .padding(.horizontal, 24)
                .opacity(opening ? 0 : 1)
            }
        }
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 1.6).repeatForever(autoreverses: true)) { bob = true }
        }
    }
}

/// Pan de rideau (plis verticaux).
struct Curtain: View {
    var body: some View {
        Canvas { ctx, size in
            ctx.fill(Path(CGRect(origin: .zero, size: size)), with: .color(Theme.curtain))
            var x: CGFloat = 0
            var i = 0
            while x < size.width {
                let w: CGFloat = 22
                ctx.fill(Path(CGRect(x: x, y: 0, width: w * 0.45, height: size.height)), with: .color(i % 2 == 0 ? Theme.curtain2 : Theme.curtain2.opacity(0.6)))
                x += w
                i += 1
            }
        }
    }
}

/// Forêt d'encre au bas de l'écran titre (même tracé que le web).
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
