import AVFoundation
import UIKit
import Foundation

/// Effets sonores du combat et de l'interface (mêmes noms que `sfx()` de `web/src/audio.ts`).
enum Sfx: CaseIterable {
    case shoot, hit, kill, hurt, clear, win, lose, boss, bossDown, star, flip, cut, snip, tap
}

/// Sons et musique synthétisés en direct avec AVAudioEngine (§13 : aucun fichier audio sous licence).
/// Port de `web/src/audio.ts` : oscillateurs à enveloppes exponentielles, bruit filtré passe-bande,
/// boîte à musique pentatonique (ré) avec bourdon, beaucoup de silences.
@MainActor
final class AudioService {
    private let engine = AVAudioEngine()
    private var source: AVAudioSourceNode?
    private let synth = SynthCore()
    private let settings: GameSettings
    private var lastShot = Date.distantPast
    private var musicTimer: Timer?
    private var step = 0
    private var degree = 4
    private var started = false
    private var observers: [NSObjectProtocol] = []

    private static let scale: [Double] = [146.83, 174.61, 196.0, 220.0, 261.63, 293.66, 349.23, 392.0, 440.0]

    init(settings: GameSettings) {
        self.settings = settings
    }

    /// Démarre le moteur (appelé au lancement ; catégorie « ambient » : respecte le mode silencieux
    /// et se mélange à la musique de l'utilisateur).
    func start() {
        guard !started else { return }
        started = true
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.ambient, mode: .default, options: [.mixWithOthers])
        try? session.setActive(true)
        let sr = session.sampleRate > 0 ? session.sampleRate : 44_100
        synth.sampleRate = sr
        let core = synth
        let node = AVAudioSourceNode { _, _, frameCount, abl -> OSStatus in
            let buffers = UnsafeMutableAudioBufferListPointer(abl)
            guard let first = buffers.first, let data = first.mData?.assumingMemoryBound(to: Float.self) else { return noErr }
            core.render(Int(frameCount), into: data)
            for b in buffers.dropFirst() {
                if let d = b.mData?.assumingMemoryBound(to: Float.self) { d.update(from: data, count: Int(frameCount)) }
            }
            return noErr
        }
        source = node
        engine.attach(node)
        let fmt = AVAudioFormat(standardFormatWithSampleRate: sr, channels: 1)
        engine.connect(node, to: engine.mainMixerNode, format: fmt)
        engine.mainMixerNode.outputVolume = 0.9
        try? engine.start()
        musicTimer = Timer.scheduledTimer(withTimeInterval: 0.33, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.musicTick() }
        }
        let nc = NotificationCenter.default
        observers.append(nc.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.resume() }
        })
        observers.append(nc.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.resume() }
        })
    }

    private func resume() {
        guard started, !engine.isRunning else { return }
        try? AVAudioSession.sharedInstance().setActive(true)
        try? engine.start()
    }

    // MARK: effets

    func play(_ s: Sfx) {
        guard settings.sound, started else { return }
        switch s {
        case .shoot:
            let now = Date()
            if now.timeIntervalSince(lastShot) < 0.07 { return }
            lastShot = now
            tone(880, 0.06, .triangle, 0.025, slide: 0.6)
        case .hit:
            noise(0.05, 0.05, 2400)
        case .kill:
            tone(520, 0.12, .square, 0.03, slide: 1.6)
            tone(780, 0.1, .triangle, 0.03, slide: 1.4, delay: 0.05)
        case .hurt:
            tone(180, 0.18, .saw, 0.06, slide: 0.5)
            noise(0.12, 0.08, 600)
        case .clear:
            for (i, f) in [523.0, 659, 784, 1047].enumerated() { tone(f, 0.22, .triangle, 0.05, delay: Double(i) * 0.08) }
        case .win:
            for (i, f) in [392.0, 523, 659, 784, 1047].enumerated() { tone(f, 0.35, .triangle, 0.06, delay: Double(i) * 0.1) }
        case .lose:
            for (i, f) in [392.0, 330, 262, 196].enumerated() { tone(f, 0.4, .sine, 0.06, slide: 0.98, delay: Double(i) * 0.16) }
        case .boss:
            tone(70, 0.9, .saw, 0.06, slide: 0.7)
            tone(105, 0.9, .sine, 0.06, slide: 0.7, delay: 0.1)
        case .bossDown:
            noise(0.6, 0.15, 300)
            for (i, f) in [262.0, 392, 523, 784].enumerated() { tone(f, 0.4, .triangle, 0.06, delay: 0.2 + Double(i) * 0.1) }
        case .star:
            tone(1047, 0.25, .triangle, 0.06, slide: 1.5)
        case .flip:
            noise(0.08, 0.06, 3000)
        case .cut:
            noise(0.09, 0.12, 4200)
            tone(1320, 0.12, .triangle, 0.05, slide: 0.5, delay: 0.02)
            tone(660, 0.18, .sine, 0.05, slide: 1.5, delay: 0.06)
        case .snip:
            noise(0.04, 0.06, 5200)
        case .tap:
            tone(660, 0.05, .triangle, 0.04, slide: 1.2)
        }
    }

    private func tone(_ f: Double, _ dur: Double, _ wave: SynthCore.Wave, _ vol: Double, slide: Double = 1, delay: Double = 0, bus: Double = 1) {
        synth.addTone(freq: f, dur: dur, wave: wave, vol: vol * bus, slide: slide, delay: delay, attack: 0.01)
    }

    private func noise(_ dur: Double, _ vol: Double, _ freq: Double) {
        synth.addNoise(dur: dur, vol: vol, freq: freq)
    }

    // MARK: musique

    private func musicTick() {
        guard settings.music, started, engine.isRunning else { return }
        // bourdon : ré grave toutes les 16 croches, la quinte toutes les 32
        if step % 16 == 0 {
            synth.addTone(freq: step % 32 == 0 ? 73.42 : 110.0, dur: 3.2, wave: .triangle, vol: 0.05 * 0.5, slide: 1, delay: 0.05, attack: 0.015)
        }
        // mélodie : marche aléatoire douce sur la gamme, une note sur deux en moyenne
        if Double.random(in: 0..<1) < (step % 4 == 0 ? 0.8 : 0.35) {
            degree = max(0, min(Self.scale.count - 1, degree + [-2, -1, -1, 1, 1, 2][Int.random(in: 0..<6)]))
            synth.addTone(freq: Self.scale[degree], dur: 1.4, wave: .triangle, vol: 0.022 * 0.5, slide: 1, delay: 0.05, attack: 0.015)
            if Double.random(in: 0..<1) < 0.15 {
                synth.addTone(freq: Self.scale[degree] * 2, dur: 0.9, wave: .triangle, vol: 0.01 * 0.5, slide: 1, delay: 0.17, attack: 0.015)
            }
        }
        step += 1
    }
}

/// Synthétiseur temps réel (fil audio) : voix à enveloppes exponentielles, mixées dans le rappel de rendu.
final class SynthCore: @unchecked Sendable {
    enum Wave { case sine, triangle, square, saw }

    private struct Voice {
        var noise: Bool
        var wave: Wave
        var freq: Double
        var freqMul: Double
        var phase = 0.0
        var wait: Int
        var gain: Double
        var attackMul: Double
        var attackLeft: Int
        var decayMul: Double
        var left: Int
        var total: Int
        // passe-bande (bruit)
        var b0 = 0.0, b2 = 0.0, a1 = 0.0, a2 = 0.0
        var x1 = 0.0, x2 = 0.0, y1 = 0.0, y2 = 0.0
    }

    var sampleRate = 44_100.0
    private var voices: [Voice] = []
    private let lock = NSLock()
    private var seed: UInt32 = 0x1234_5678

    func addTone(freq: Double, dur: Double, wave: Wave, vol: Double, slide: Double, delay: Double, attack: Double) {
        let sr = sampleRate
        let n = max(1, Int(dur * sr))
        let na = max(1, Int(attack * sr))
        let target = max(30, freq * slide)
        let v = Voice(noise: false, wave: wave, freq: freq, freqMul: slide == 1 ? 1 : pow(target / freq, 1 / Double(n)),
                      wait: Int(delay * sr), gain: 0.0001, attackMul: pow(vol / 0.0001, 1 / Double(na)), attackLeft: na,
                      decayMul: pow(0.0001 / vol, 1 / Double(max(1, n - na))), left: n + Int(0.02 * sr), total: n)
        lock.lock()
        if voices.count < 48 { voices.append(v) }
        lock.unlock()
    }

    func addNoise(dur: Double, vol: Double, freq: Double) {
        let sr = sampleRate
        let n = max(1, Int(dur * sr))
        var v = Voice(noise: true, wave: .sine, freq: freq, freqMul: 1, wait: 0, gain: vol, attackMul: 1, attackLeft: 0, decayMul: 1, left: n, total: n)
        // passe-bande RBJ, Q = 1 (BiquadFilterNode « bandpass » par défaut)
        let w0 = 2 * Double.pi * freq / sr
        let alpha = sin(w0) / 2
        let a0 = 1 + alpha
        v.b0 = alpha / a0
        v.b2 = -alpha / a0
        v.a1 = -2 * cos(w0) / a0
        v.a2 = (1 - alpha) / a0
        lock.lock()
        if voices.count < 48 { voices.append(v) }
        lock.unlock()
    }

    @inline(__always) private func random() -> Double {
        seed = seed &* 1_664_525 &+ 1_013_904_223
        return Double(seed) / 4_294_967_296 * 2 - 1
    }

    /// Rappel temps réel : ne bloque jamais (si le verrou est pris, on rend un silence).
    func render(_ frames: Int, into out: UnsafeMutablePointer<Float>) {
        for i in 0..<frames { out[i] = 0 }
        guard lock.try() else { return }
        defer { lock.unlock() }
        if voices.isEmpty { return }
        let sr = sampleRate
        for vi in voices.indices {
            var v = voices[vi]
            var i = 0
            while i < frames && v.left > 0 {
                if v.wait > 0 {
                    v.wait -= 1
                    i += 1
                    continue
                }
                var s: Double
                if v.noise {
                    let done = Double(v.total - v.left) / Double(v.total)
                    let x = random() * (1 - done)
                    s = v.b0 * x + v.b2 * v.x2 - v.a1 * v.y1 - v.a2 * v.y2
                    v.x2 = v.x1
                    v.x1 = x
                    v.y2 = v.y1
                    v.y1 = s
                    s *= v.gain
                } else {
                    let ph = v.phase
                    switch v.wave {
                    case .sine: s = sin(2 * .pi * ph)
                    case .triangle: s = 1 - 4 * Swift.abs(ph - 0.5)
                    case .square: s = ph < 0.5 ? 1 : -1
                    case .saw: s = 2 * ph - 1
                    }
                    s *= v.gain
                    v.phase += v.freq / sr
                    if v.phase >= 1 { v.phase -= 1 }
                    v.freq *= v.freqMul
                    if v.attackLeft > 0 {
                        v.gain *= v.attackMul
                        v.attackLeft -= 1
                    } else if v.left > Int(0.02 * sr) {
                        v.gain *= v.decayMul
                    } else {
                        v.gain *= 0.99
                    }
                }
                out[i] += Float(s)
                v.left -= 1
                i += 1
            }
            voices[vi] = v
        }
        voices.removeAll { $0.left <= 0 }
    }
}
