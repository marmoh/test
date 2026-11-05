// Icône de l'app iOS : rend `window.atlasAppIcon(1024)` (web/src/atlas.ts, mêmes dessins vectoriels que les atlas)
// avec WebKit et écrit ios/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png (opaque, sans canal alpha).
//   pnpm web:dev            (dans un autre terminal)
//   swift tools/app-icon.swift [URL] [sortie.png]
import AppKit
import WebKit

let args = CommandLine.arguments
let url = URL(string: args.count > 1 ? args[1] : "http://localhost:5173/?atlas")!
let out = args.count > 2 ? args[2] : "ios/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png"

@MainActor
func run() {
    let web = WKWebView(frame: NSRect(x: 0, y: 0, width: 400, height: 400))
    web.load(URLRequest(url: url))
    var tries = 0
    func poll() {
        tries += 1
        if tries > 100 { fputs("✗ page \(url) pas prête (serveur de dev lancé ?)\n", stderr); exit(1) }
        web.evaluateJavaScript("document.body && document.body.dataset.atlasReady === '1' && typeof window.atlasAppIcon === 'function'") { ready, _ in
            guard (ready as? Bool) == true else {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { poll() }
                return
            }
            web.evaluateJavaScript("window.atlasAppIcon(1024)") { result, error in
                guard let s = result as? String, let comma = s.firstIndex(of: ","),
                      let data = Data(base64Encoded: String(s[s.index(after: comma)...])),
                      let src = NSBitmapImageRep(data: data)?.cgImage else {
                    fputs("✗ rendu impossible : \(String(describing: error))\n", stderr); exit(1)
                }
                // aplatit sur fond opaque (App Store : pas de transparence)
                let ctx = CGContext(data: nil, width: 1024, height: 1024, bitsPerComponent: 8, bytesPerRow: 0,
                                    space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
                ctx.draw(src, in: CGRect(x: 0, y: 0, width: 1024, height: 1024))
                let rep = NSBitmapImageRep(cgImage: ctx.makeImage()!)
                try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: out))
                print("✓ \(out)")
                exit(0)
            }
        }
    }
    poll()
}
DispatchQueue.main.async { MainActor.assumeIsolated { run() } }
RunLoop.main.run()
