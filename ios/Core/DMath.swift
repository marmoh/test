import Foundation

/// Mathématiques déterministes : reproduisent **au bit près** les fonctions de V8 (Node, navigateurs Chromium)
/// utilisées par la simulation TypeScript, quelle que soit la libm de la plateforme (Apple, glibc).
///
/// - `sin`, `cos`, `atan2` : portage de fdlibm 5.3 (`v8/src/base/ieee754.cc`).
/// - `hypot` : algorithme de `Math.hypot` de V8 (normalisation par le max + sommation de Kahan).
/// - `round` : sémantique de `Math.round` (demi vers +∞).
/// - `sqrt`, `floor`, `ceil`, `abs` : IEEE 754, identiques partout.
///
/// Vérifié contre des vecteurs produits par Node (`content/traces/math_vectors.json`, test `DMathTests`).
/// N'utiliser **que** ces fonctions dans `Core/` pour tout calcul qui influence l'état de la simulation.
public enum DMath {
    public static let pi = Double.pi // 3.141592653589793 (même double que Math.PI)

    // MARK: - Math.min / Math.max (NaN et zéros signés comme en JS)

    @inline(__always)
    public static func max(_ a: Double, _ b: Double) -> Double {
        if a.isNaN || b.isNaN { return .nan }
        if a == 0 && b == 0 { return (a.sign == .plus || b.sign == .plus) ? 0.0 : -0.0 }
        return a > b ? a : b
    }

    @inline(__always)
    public static func min(_ a: Double, _ b: Double) -> Double {
        if a.isNaN || b.isNaN { return .nan }
        if a == 0 && b == 0 { return (a.sign == .minus || b.sign == .minus) ? -0.0 : 0.0 }
        return a < b ? a : b
    }

    // MARK: - Math.round / Math.hypot

    /// `Math.round` : arrondi au plus proche, les demis vers +∞ (−2,5 → −2).
    @inline(__always)
    public static func round(_ x: Double) -> Double {
        let f = x.rounded(.down)
        return x - f >= 0.5 ? f + 1 : f
    }

    /// `Math.hypot(a, b)` de V8.
    public static func hypot(_ a: Double, _ b: Double) -> Double {
        if a.isNaN || b.isNaN {
            if a.isInfinite || b.isInfinite { return .infinity }
            return .nan
        }
        let aa = Swift.abs(a)
        let ab = Swift.abs(b)
        var m = 0.0
        if aa > m { m = aa }
        if ab > m { m = ab }
        if m == .infinity { return .infinity }
        if m == 0 { return 0 }
        var sum = 0.0
        var comp = 0.0
        for v in [aa, ab] {
            let n = v / m
            let summand = n * n - comp
            let prelim = sum + summand
            comp = (prelim - sum) - summand
            sum = prelim
        }
        return sum.squareRoot() * m
    }

    // MARK: - mots IEEE

    @inline(__always) private static func hi(_ x: Double) -> Int32 { Int32(bitPattern: UInt32(truncatingIfNeeded: x.bitPattern >> 32)) }
    @inline(__always) private static func lo(_ x: Double) -> UInt32 { UInt32(truncatingIfNeeded: x.bitPattern) }
    @inline(__always) private static func make(_ h: Int32, _ l: UInt32) -> Double {
        Double(bitPattern: (UInt64(UInt32(bitPattern: h)) << 32) | UInt64(l))
    }

    // MARK: - sin / cos (fdlibm)

    private static let S1 = -1.66666666666666324348e-01
    private static let S2 = 8.33333333332248946124e-03
    private static let S3 = -1.98412698298579493134e-04
    private static let S4 = 2.75573137070700676789e-06
    private static let S5 = -2.50507602534068634195e-08
    private static let S6 = 1.58969099521155010221e-10

    private static func kernelSin(_ x: Double, _ y: Double, _ iy: Int) -> Double {
        let ix = hi(x) & 0x7fff_ffff
        if ix < 0x3e40_0000 { if Int(x) == 0 { return x } }
        let z = x * x
        let v = z * x
        let r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)))
        if iy == 0 { return x + v * (S1 + z * r) }
        return x - ((z * (0.5 * y - v * r) - y) - v * S1)
    }

    private static let C1 = 4.16666666666666019037e-02
    private static let C2 = -1.38888888888741095749e-03
    private static let C3 = 2.48015872894767294178e-05
    private static let C4 = -2.75573143513906633035e-07
    private static let C5 = 2.08757232129817482790e-09
    private static let C6 = -1.13596475577881948265e-11

    private static func kernelCos(_ x: Double, _ y: Double) -> Double {
        let ix = hi(x) & 0x7fff_ffff
        if ix < 0x3e40_0000 { if Int(x) == 0 { return 1 } }
        let z = x * x
        let r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))))
        if ix < 0x3fd3_3333 { return 1 - (0.5 * z - (z * r - x * y)) }
        let qx: Double = ix > 0x3fe9_0000 ? 0.28125 : make(ix - 0x0020_0000, 0)
        let hz = 0.5 * z - qx
        let a = 1 - qx
        return a - (hz - (z * r - x * y))
    }

    private static let npio2hw: [Int32] = [
        0x3FF921FB, 0x400921FB, 0x4012D97C, 0x401921FB, 0x401F6A7A, 0x4022D97C,
        0x4025FDBB, 0x402921FB, 0x402C463A, 0x402F6A7A, 0x4031475C, 0x4032D97C,
        0x40346B9C, 0x4035FDBB, 0x40378FDB, 0x403921FB, 0x403AB41B, 0x403C463A,
        0x403DD85A, 0x403F6A7A, 0x40407E4C, 0x4041475C, 0x4042106C, 0x4042D97C,
        0x4043A28C, 0x40446B9C, 0x404534AC, 0x4045FDBB, 0x4046C6CB, 0x40478FDB,
        0x404858EB, 0x404921FB,
    ]
    private static let invpio2 = 6.36619772367581382433e-01
    private static let pio2_1 = 1.57079632673412561417e+00
    private static let pio2_1t = 6.07710050650619224932e-11
    private static let pio2_2 = 6.07710050630396597660e-11
    private static let pio2_2t = 2.02226624879595063154e-21
    private static let pio2_3 = 2.02226624871116645580e-21
    private static let pio2_3t = 8.47842766036889956997e-32

    /// Réduction d'argument ; `nil` pour |x| > 2^19·π/2 (jamais atteint par la simulation).
    private static func remPio2(_ x: Double) -> (n: Int, y0: Double, y1: Double)? {
        let hx = hi(x)
        let ix = hx & 0x7fff_ffff
        if ix <= 0x3fe9_21fb { return (0, x, 0) }
        if ix < 0x4002_d97c {
            if hx > 0 {
                var z = x - pio2_1
                if ix != 0x3ff9_21fb {
                    let y0 = z - pio2_1t
                    return (1, y0, (z - y0) - pio2_1t)
                }
                z -= pio2_2
                let y0 = z - pio2_2t
                return (1, y0, (z - y0) - pio2_2t)
            } else {
                var z = x + pio2_1
                if ix != 0x3ff9_21fb {
                    let y0 = z + pio2_1t
                    return (-1, y0, (z - y0) + pio2_1t)
                }
                z += pio2_2
                let y0 = z + pio2_2t
                return (-1, y0, (z - y0) + pio2_2t)
            }
        }
        if ix <= 0x4139_21fb {
            var t = Swift.abs(x)
            let n = Int(Int32(t * invpio2 + 0.5))
            let fn = Double(n)
            var r = t - fn * pio2_1
            var w = fn * pio2_1t
            var y0: Double
            if n < 32 && ix != npio2hw[n - 1] {
                y0 = r - w
            } else {
                let j = Int(ix >> 20)
                y0 = r - w
                var i = j - Int((UInt32(bitPattern: hi(y0)) >> 20) & 0x7ff)
                if i > 16 {
                    t = r
                    w = fn * pio2_2
                    r = t - w
                    w = fn * pio2_2t - ((t - r) - w)
                    y0 = r - w
                    i = j - Int((UInt32(bitPattern: hi(y0)) >> 20) & 0x7ff)
                    if i > 49 {
                        t = r
                        w = fn * pio2_3
                        r = t - w
                        w = fn * pio2_3t - ((t - r) - w)
                        y0 = r - w
                    }
                }
            }
            let y1 = (r - y0) - w
            if hx < 0 { return (-n, -y0, -y1) }
            return (n, y0, y1)
        }
        return nil
    }

    public static func sin(_ x: Double) -> Double {
        let ix = hi(x) & 0x7fff_ffff
        if ix <= 0x3fe9_21fb { return kernelSin(x, 0, 0) }
        if ix >= 0x7ff0_0000 { return x - x }
        guard let (n, y0, y1) = remPio2(x) else { return Foundation.sin(x) }
        switch n & 3 {
        case 0: return kernelSin(y0, y1, 1)
        case 1: return kernelCos(y0, y1)
        case 2: return -kernelSin(y0, y1, 1)
        default: return -kernelCos(y0, y1)
        }
    }

    public static func cos(_ x: Double) -> Double {
        let ix = hi(x) & 0x7fff_ffff
        if ix <= 0x3fe9_21fb { return kernelCos(x, 0) }
        if ix >= 0x7ff0_0000 { return x - x }
        guard let (n, y0, y1) = remPio2(x) else { return Foundation.cos(x) }
        switch n & 3 {
        case 0: return kernelCos(y0, y1)
        case 1: return -kernelSin(y0, y1, 1)
        case 2: return -kernelCos(y0, y1)
        default: return kernelSin(y0, y1, 1)
        }
    }

    // MARK: - atan / atan2 (fdlibm)

    private static let atanhi: [Double] = [
        4.63647609000806093515e-01, 7.85398163397448278999e-01,
        9.82793723247329054082e-01, 1.57079632679489655800e+00,
    ]
    private static let atanlo: [Double] = [
        2.26987774529616870924e-17, 3.06161699786838301793e-17,
        1.39033110312309984516e-17, 6.12323399573676603587e-17,
    ]
    private static let aT: [Double] = [
        3.33333333333329318027e-01, -1.99999999998764832476e-01,
        1.42857142725034663711e-01, -1.11111104054623557880e-01,
        9.09088713343650656196e-02, -7.69187620504482999495e-02,
        6.66107313738753120669e-02, -5.83357013379057348645e-02,
        4.97687799461593236017e-02, -3.65315727442169155270e-02,
        1.62858201153657823623e-02,
    ]

    public static func atan(_ xIn: Double) -> Double {
        var x = xIn
        let hx = hi(x)
        let ix = hx & 0x7fff_ffff
        if ix >= 0x4410_0000 {
            if ix > 0x7ff0_0000 || (ix == 0x7ff0_0000 && lo(x) != 0) { return x + x }
            return hx > 0 ? atanhi[3] + atanlo[3] : -atanhi[3] - atanlo[3]
        }
        var id: Int
        if ix < 0x3fdc_0000 {
            if ix < 0x3e40_0000 { return x }
            id = -1
        } else {
            x = Swift.abs(x)
            if ix < 0x3ff3_0000 {
                if ix < 0x3fe6_0000 {
                    id = 0
                    x = (2.0 * x - 1) / (2.0 + x)
                } else {
                    id = 1
                    x = (x - 1) / (x + 1)
                }
            } else if ix < 0x4003_8000 {
                id = 2
                x = (x - 1.5) / (1 + 1.5 * x)
            } else {
                id = 3
                x = -1.0 / x
            }
        }
        let z = x * x
        let w = z * z
        let s1 = z * (aT[0] + w * (aT[2] + w * (aT[4] + w * (aT[6] + w * (aT[8] + w * aT[10])))))
        let s2 = w * (aT[1] + w * (aT[3] + w * (aT[5] + w * (aT[7] + w * aT[9]))))
        if id < 0 { return x - x * (s1 + s2) }
        let r = atanhi[id] - ((x * (s1 + s2) - atanlo[id]) - x)
        return hx < 0 ? -r : r
    }

    private static let piO2 = 1.5707963267948965580e+00
    private static let piO4 = 7.8539816339744827900e-01
    private static let piLo = 1.2246467991473531772e-16

    /// `Math.atan2(y, x)`.
    public static func atan2(_ y: Double, _ x: Double) -> Double {
        if x.isNaN || y.isNaN { return x + y }
        let hx = hi(x), lx = lo(x), hy = hi(y), ly = lo(y)
        let ix = hx & 0x7fff_ffff
        let iy = hy & 0x7fff_ffff
        if hx == 0x3ff0_0000 && lx == 0 { return atan(y) }
        let m = Int(((hy >> 31) & 1) | ((hx >> 30) & 2))
        if iy == 0 && ly == 0 {
            switch m {
            case 0, 1: return y
            case 2: return pi
            default: return -pi
            }
        }
        if ix == 0 && lx == 0 { return hy < 0 ? -piO2 : piO2 }
        if ix == 0x7ff0_0000 && lx == 0 {
            if iy == 0x7ff0_0000 && ly == 0 {
                switch m {
                case 0: return piO4
                case 1: return -piO4
                case 2: return 3.0 * piO4
                default: return -3.0 * piO4
                }
            }
            switch m {
            case 0: return 0
            case 1: return -0.0
            case 2: return pi
            default: return -pi
            }
        }
        if iy == 0x7ff0_0000 && ly == 0 { return hy < 0 ? -piO2 : piO2 }
        let k = Int((iy - ix) >> 20)
        var z: Double
        var mm = m
        if k > 60 {
            z = piO2 + 0.5 * piLo
            mm &= 1
        } else if hx < 0 && k < -60 {
            z = 0
        } else {
            z = atan(Swift.abs(y / x))
        }
        switch mm {
        case 0: return z
        case 1: return -z
        case 2: return pi - (z - piLo)
        default: return (z - piLo) - pi
        }
    }

    // MARK: - pow (fdlibm, `v8/src/base/ieee754.cc` jusqu'à V8 12.x / Node 22)

    @inline(__always) private static func withLow(_ x: Double, _ l: UInt32) -> Double { make(hi(x), l) }
    @inline(__always) private static func withHigh(_ x: Double, _ h: Int32) -> Double { make(h, lo(x)) }

    private static let bp: [Double] = [1.0, 1.5]
    private static let dpH: [Double] = [0.0, 5.84962487220764160156e-01]
    private static let dpL: [Double] = [0.0, 1.35003920212974897128e-08]
    private static let two53 = 9007199254740992.0
    private static let huge = 1.0e300
    private static let tiny = 1.0e-300
    private static let L1 = 5.99999999999994648725e-01
    private static let L2 = 4.28571428578550184252e-01
    private static let L3 = 3.33333329818377432918e-01
    private static let L4 = 2.72728123808534006489e-01
    private static let L5 = 2.30660745775561754067e-01
    private static let L6 = 2.06975017800338417784e-01
    private static let P1 = 1.66666666666666019037e-01
    private static let P2 = -2.77777777770155933842e-03
    private static let P3 = 6.61375632143793436117e-05
    private static let P4 = -1.65339022054652515390e-06
    private static let P5 = 4.13813679705723846039e-08
    private static let lg2 = 6.93147180559945286227e-01
    private static let lg2H = 6.93147182464599609375e-01
    private static let lg2L = -1.90465429995776804525e-09
    private static let ovt = 8.0085662595372944372e-17
    private static let cp = 9.61796693925975554329e-01
    private static let cpH = 9.61796700954437255859e-01
    private static let cpL = -7.02846165095275826516e-09
    private static let ivln2 = 1.44269504088896338700e+00
    private static let ivln2H = 1.44269502162933349609e+00
    private static let ivln2L = 1.92596299112661746887e-08

    /// `Math.pow(x, y)` / `x ** y` de V8 (fdlibm).
    public static func pow(_ x: Double, _ y: Double) -> Double {
        let hx = hi(x), lx = lo(x), hy = hi(y), ly = lo(y)
        var ix = hx & 0x7fff_ffff
        let iy = hy & 0x7fff_ffff
        if iy == 0 && ly == 0 { return 1 }
        if ix > 0x7ff0_0000 || (ix == 0x7ff0_0000 && lx != 0) || iy > 0x7ff0_0000 || (iy == 0x7ff0_0000 && ly != 0) {
            return x + y
        }
        var yisint: Int32 = 0
        if hx < 0 {
            if iy >= 0x4340_0000 {
                yisint = 2
            } else if iy >= 0x3ff0_0000 {
                let k = (iy >> 20) - 0x3ff
                if k > 20 {
                    let j = ly >> UInt32(52 - k)
                    if (j << UInt32(52 - k)) == ly { yisint = 2 - Int32(j & 1) }
                } else if ly == 0 {
                    let j = iy >> (20 - k)
                    if (j << (20 - k)) == iy { yisint = 2 - (j & 1) }
                }
            }
        }
        if ly == 0 {
            if iy == 0x7ff0_0000 {
                if ix == 0x3ff0_0000 && lx == 0 { return y - y }
                if ix >= 0x3ff0_0000 { return hy >= 0 ? y : 0 }
                return hy < 0 ? -y : 0
            }
            if iy == 0x3ff0_0000 { return hy < 0 ? 1 / x : x }
            if hy == 0x4000_0000 { return x * x }
            if hy == 0x3fe0_0000 && hx >= 0 { return x.squareRoot() }
        }
        var ax = Swift.abs(x)
        if lx == 0 && (ix == 0x7ff0_0000 || ix == 0 || ix == 0x3ff0_0000) {
            var z = ax
            if hy < 0 { z = 1 / z }
            if hx < 0 {
                if ix == 0x3ff0_0000 && yisint == 0 { z = .nan } else if yisint == 1 { z = -z }
            }
            return z
        }
        var n = (hx >> 31) + 1
        if n == 0 && yisint == 0 { return .nan }
        var s = 1.0
        if n == 0 && yisint == 1 { s = -1 }

        var t1: Double, t2: Double
        if iy > 0x41e0_0000 {
            if iy > 0x43f0_0000 {
                if ix <= 0x3fef_ffff { return hy < 0 ? huge * huge : tiny * tiny }
                if ix >= 0x3ff0_0000 { return hy > 0 ? huge * huge : tiny * tiny }
            }
            if ix < 0x3fef_ffff { return hy < 0 ? s * huge * huge : s * tiny * tiny }
            if ix > 0x3ff0_0000 { return hy > 0 ? s * huge * huge : s * tiny * tiny }
            let t = ax - 1
            let w = (t * t) * (0.5 - t * (0.3333333333333333333333 - t * 0.25))
            let u = ivln2H * t
            let v = t * ivln2L - w * ivln2
            t1 = withLow(u + v, 0)
            t2 = v - (t1 - u)
        } else {
            n = 0
            if ix < 0x0010_0000 {
                ax *= two53
                n -= 53
                ix = hi(ax)
            }
            n += (ix >> 20) - 0x3ff
            let j = ix & 0x000f_ffff
            ix = j | 0x3ff0_0000
            var k: Int
            if j <= 0x3988E {
                k = 0
            } else if j < 0xBB67A {
                k = 1
            } else {
                k = 0
                n += 1
                ix -= 0x0010_0000
            }
            ax = withHigh(ax, ix)
            var u = ax - bp[k]
            var v = 1 / (ax + bp[k])
            let ss = u * v
            let sH = withLow(ss, 0)
            var tH = make(((ix >> 1) | 0x2000_0000) + 0x0008_0000 + Int32(k << 18), 0)
            let tL = ax - (tH - bp[k])
            let sL = v * ((u - sH * tH) - sH * tL)
            var s2 = ss * ss
            var r = s2 * s2 * (L1 + s2 * (L2 + s2 * (L3 + s2 * (L4 + s2 * (L5 + s2 * L6)))))
            r += sL * (sH + ss)
            s2 = sH * sH
            tH = withLow(3.0 + s2 + r, 0)
            let tL2 = r - ((tH - 3.0) - s2)
            u = sH * tH
            v = sL * tH + tL2 * ss
            let pH = withLow(u + v, 0)
            let pL = v - (pH - u)
            let zH = cpH * pH
            let zL = cpL * pH + pL * cp + dpL[k]
            let t = Double(n)
            t1 = withLow(((zH + zL) + dpH[k]) + t, 0)
            t2 = zL - (((t1 - t) - dpH[k]) - zH)
        }
        let y1 = withLow(y, 0)
        let pL = (y - y1) * t1 + y * t2
        var pH = y1 * t1
        var z = pL + pH
        var j = hi(z)
        let i0 = lo(z)
        if j >= 0x4090_0000 {
            if (j - 0x4090_0000) != 0 || i0 != 0 { return s * huge * huge }
            if pL + ovt > z - pH { return s * huge * huge }
        } else if (j & 0x7fff_ffff) >= 0x4090_cc00 {
            if (UInt32(bitPattern: j) &- 0xc090_cc00) != 0 || i0 != 0 { return s * tiny * tiny }
            if pL <= z - pH { return s * tiny * tiny }
        }
        let i = j & 0x7fff_ffff
        var k = (i >> 20) - 0x3ff
        var nn: Int32 = 0
        if i > 0x3fe0_0000 {
            nn = j &+ (0x0010_0000 >> (k + 1))
            k = ((nn & 0x7fff_ffff) >> 20) - 0x3ff
            let t = make(nn & ~(0x000f_ffff >> k), 0)
            nn = ((nn & 0x000f_ffff) | 0x0010_0000) >> (20 - k)
            if j < 0 { nn = -nn }
            pH -= t
        }
        let t = withLow(pL + pH, 0)
        let u = t * lg2H
        let v = (pL - (t - pH)) * lg2 + t * lg2L
        z = u + v
        let w = v - (z - u)
        let tt = z * z
        let tt1 = z - tt * (P1 + tt * (P2 + tt * (P3 + tt * (P4 + tt * P5))))
        let r = (z * tt1) / ((tt1 - 2) - (w + z * w))
        z = 1 - (r - z)
        j = hi(z)
        j = j &+ Int32(bitPattern: UInt32(bitPattern: nn) << 20)
        if (j >> 20) <= 0 {
            z = Foundation.scalbn(z, Int(nn))
        } else {
            z = withHigh(z, hi(z) &+ Int32(bitPattern: UInt32(bitPattern: nn) << 20))
        }
        return s * z
    }
}
