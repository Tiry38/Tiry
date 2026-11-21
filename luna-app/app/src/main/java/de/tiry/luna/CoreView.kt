package de.tiry.luna

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.util.AttributeSet
import android.view.View
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

/** Leitfarbe je Zustand. */
private fun tint(s: LunaState) = when (s) {
    LunaState.OFF -> 0xFF5D6675.toInt()
    LunaState.LOADING, LunaState.WAITING -> Ui.ICE
    LunaState.LISTENING -> Ui.MINT
    LunaState.THINKING -> Ui.VIOLET
    LunaState.SPEAKING -> 0xFFDFF4FF.toInt()
    LunaState.ERROR -> Ui.RED
}

/**
 * Lunas 3D-Stimmkern: Partikelkugel (Fibonacci-Verteilung, perspektivisch gedreht), Orbit-Ringe, HUD-Skala
 * und eine Plasmalinie quer durch den Kern, die beim Zuhören/Sprechen ausschlägt.
 */
class CoreView @JvmOverloads constructor(ctx: Context, attrs: AttributeSet? = null) : View(ctx, attrs) {

    var state: LunaState = LunaState.WAITING
    var level = 0f

    private val reduceMotion = !ValueAnimator.areAnimatorsEnabled()
    private var t = 0f
    private var smooth = 0f
    private var energy = 0f
    private var color = Ui.ICE

    private val n = 520
    private val px = FloatArray(n); private val py = FloatArray(n); private val pz = FloatArray(n)

    private val dot = Paint(Paint.ANTI_ALIAS_FLAG)
    private val line = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND }
    private val glow = Paint(Paint.ANTI_ALIAS_FLAG)
    private val plasma = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND }
    private val plasmaGlow = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND }
    private val path = Path()
    private val oval = RectF()

    init {
        setLayerType(LAYER_TYPE_HARDWARE, null)
        val golden = PI * (3 - sqrt(5.0))
        for (i in 0 until n) {
            val y = 1 - (i / (n - 1.0)) * 2
            val r = sqrt(1 - y * y)
            val th = golden * i
            px[i] = (cos(th) * r).toFloat(); py[i] = y.toFloat(); pz[i] = (sin(th) * r).toFloat()
        }
    }

    private fun mix(a: Int, b: Int, f: Float): Int {
        fun ch(s: Int) = ((a shr s and 0xFF) + (((b shr s and 0xFF) - (a shr s and 0xFF)) * f)).toInt()
        return Color.argb(255, ch(16), ch(8), ch(0))
    }
    private fun a(c: Int, alpha: Int) = (c and 0x00FFFFFF) or (alpha.coerceIn(0, 255) shl 24)

    override fun onDraw(c: Canvas) {
        val speed = when (state) { LunaState.THINKING -> 2.4f; LunaState.SPEAKING -> 1.5f; LunaState.LISTENING -> 1.2f; LunaState.OFF -> 0.25f; else -> 0.7f }
        if (!reduceMotion) t += 0.016f * speed
        smooth += (level - smooth) * 0.22f
        val targetEnergy = when (state) {
            LunaState.LISTENING -> 0.25f + smooth * 0.9f
            LunaState.SPEAKING -> 0.45f + 0.35f * abs(sin(t * 6.5f)) * (0.6f + 0.4f * sin(t * 1.9f))
            LunaState.THINKING -> 0.4f
            LunaState.OFF -> 0f
            else -> 0.12f + 0.05f * sin(t * 1.4f)
        }
        energy += (targetEnergy - energy) * 0.12f
        color = mix(color, tint(state), 0.07f)

        val w = width.toFloat(); val h = height.toFloat()
        val cx = w / 2f; val cy = h / 2f
        val R = min(w, h) * 0.27f * (1f + energy * 0.06f)

        // 1) weicher Hintergrund-Glow (endet innerhalb der View)
        val gr = min(w, h) / 2f - 1f
        glow.shader = RadialGradient(cx, cy, gr, intArrayOf(a(color, 70), a(color, 18), Color.TRANSPARENT), floatArrayOf(0f, 0.45f, 1f), Shader.TileMode.CLAMP)
        c.drawCircle(cx, cy, gr, glow)

        // 2) HUD-Skala: 120 Striche, ein heller Sektor wandert
        line.strokeWidth = Ui.dp(context, 1f)
        val rr = R * 1.62f
        val sweep = (t * 40f) % 360f
        for (k in 0 until 120) {
            val ang = k * 3f
            val rad = Math.toRadians(ang.toDouble())
            val long = k % 10 == 0
            val d = ((ang - sweep + 360f) % 360f)
            val bright = if (d < 60f) (1f - d / 60f) else 0f
            line.color = a(if (bright > 0) color else Color.WHITE, (if (long) 90 else 40) + (bright * 150).toInt())
            val r1 = rr; val r2 = rr + (if (long) R * 0.09f else R * 0.045f)
            c.drawLine(cx + cos(rad).toFloat() * r1, cy + sin(rad).toFloat() * r1, cx + cos(rad).toFloat() * r2, cy + sin(rad).toFloat() * r2, line)
        }

        // 3) Orbit-Ringe (gekippte Ellipsen, teilweise gezeichnet)
        for (k in 0 until 3) {
            val tilt = 0.28f + k * 0.17f
            val rot = t * (12f + k * 7f) * (if (k % 2 == 0) 1 else -1) + k * 60f
            c.save(); c.rotate(rot, cx, cy)
            oval.set(cx - R * (1.28f + k * 0.07f), cy - R * (1.28f + k * 0.07f) * tilt, cx + R * (1.28f + k * 0.07f), cy + R * (1.28f + k * 0.07f) * tilt)
            line.strokeWidth = Ui.dp(context, if (k == 0) 1.4f else 1f)
            line.color = a(color, 150 - k * 35)
            c.drawArc(oval, 200f, 250f, false, line)
            line.color = a(Color.WHITE, 40)
            c.drawArc(oval, 90f, 70f, false, line)
            c.restore()
        }

        // 4) Partikelkugel
        val ay = t * 0.55f; val ax = 0.35f + 0.08f * sin(t * 0.4f)
        val cyA = cos(ay); val syA = sin(ay); val cxA = cos(ax); val sxA = sin(ax)
        val dotR = Ui.dp(context, 1.35f)
        for (i in 0 until n) {
            var x = px[i]; var y = py[i]; var z = pz[i]
            // Verformung: Wellenbänder entlang der Breitengrade (Sprechen) + Rauschen (Zuhören)
            val lat = acos(y.coerceIn(-1f, 1f))
            val disp = 1f + energy * (0.10f * sin(lat * 7f - t * 5f) + 0.07f * sin(x * 9f + t * 3f) * cos(z * 7f - t * 2f))
            x *= disp; y *= disp; z *= disp
            val x1 = x * cyA + z * syA; val z1 = -x * syA + z * cyA
            val y2 = y * cxA - z1 * sxA; val z2 = y * sxA + z1 * cxA
            val persp = 2.6f / (2.6f + z2)
            val sx = cx + x1 * R * persp; val sy = cy + y2 * R * persp
            val depth = ((z2 + 1f) / 2f)               // 0 = vorne, 1 = hinten
            val alpha = (235 - depth * 190).toInt()
            dot.color = if (depth < 0.35f) a(mix(color, Color.WHITE, 0.55f), alpha) else a(color, alpha)
            c.drawCircle(sx, sy, dotR * persp * (1.15f - depth * 0.5f), dot)
        }

        // 5) heller Kern
        glow.shader = RadialGradient(cx, cy, R * 0.55f, intArrayOf(a(Color.WHITE, (90 + energy * 120).toInt()), a(color, 60), Color.TRANSPARENT),
            floatArrayOf(0f, 0.35f, 1f), Shader.TileMode.CLAMP)
        c.drawCircle(cx, cy, R * 0.55f, glow)

        // 6) Plasmalinie quer durch den Kern
        path.reset()
        val amp = R * (0.04f + energy * 0.55f)
        val steps = 90
        for (s in 0..steps) {
            val f = s / steps.toFloat()
            val x = f * w
            val env = sin(f * PI.toFloat()).let { it * it * it }        // in der Mitte stark, außen flach
            val y = cy + env * amp * (sin(f * 22f - t * 7f) * 0.6f + sin(f * 41f + t * 4.3f) * 0.3f + sin(f * 9f - t * 2f) * 0.25f)
            if (s == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        val shader = LinearGradient(0f, 0f, w, 0f, intArrayOf(Color.TRANSPARENT, a(color, 200), Color.WHITE, a(color, 200), Color.TRANSPARENT),
            floatArrayOf(0f, 0.3f, 0.5f, 0.7f, 1f), Shader.TileMode.CLAMP)
        plasmaGlow.shader = shader; plasmaGlow.strokeWidth = Ui.dp(context, 6f); plasmaGlow.alpha = 70
        plasmaGlow.maskFilter = BlurMaskFilter(Ui.dp(context, 6f), BlurMaskFilter.Blur.NORMAL)
        c.drawPath(path, plasmaGlow)
        plasma.shader = shader; plasma.strokeWidth = Ui.dp(context, 1.5f)
        c.drawPath(path, plasma)

        if (isAttachedToWindow && !reduceMotion) postInvalidateOnAnimation()
    }

    override fun onAttachedToWindow() { super.onAttachedToWindow(); postInvalidateOnAnimation() }
}

/** Weltraum-Hintergrund: Schwarz, feine wandernde Sterne, ein Hauch Eisblau von oben. */
class SpaceView @JvmOverloads constructor(ctx: Context, attrs: AttributeSet? = null) : View(ctx, attrs) {
    private val reduceMotion = !ValueAnimator.areAnimatorsEnabled()
    private val rnd = java.util.Random(7)
    private val stars = Array(140) { floatArrayOf(rnd.nextFloat(), rnd.nextFloat(), 0.3f + rnd.nextFloat() * 1.1f, rnd.nextFloat() * 6.28f) }
    private val p = Paint(Paint.ANTI_ALIAS_FLAG)
    private var t = 0f

    override fun onDraw(c: Canvas) {
        c.drawColor(Ui.BLACK)
        if (!reduceMotion) t += 0.01f
        val w = width.toFloat(); val h = height.toFloat()
        p.shader = RadialGradient(w * 0.5f, -h * 0.05f, h * 0.75f, intArrayOf(0x337FD4FF, 0x0B7FD4FF, 0), floatArrayOf(0f, 0.5f, 1f), Shader.TileMode.CLAMP)
        c.drawRect(0f, 0f, w, h, p)
        p.shader = RadialGradient(w * 0.15f, h * 1.05f, h * 0.6f, intArrayOf(0x22A78BFA, 0), null, Shader.TileMode.CLAMP)
        c.drawRect(0f, 0f, w, h, p)
        p.shader = null
        for (s in stars) {
            val y = ((s[1] + t * 0.004f * s[2]) % 1f) * h
            val tw = 0.55f + 0.45f * sin(t * 2f + s[3])
            p.color = Color.argb((90 * tw * s[2]).toInt().coerceIn(15, 160), 220, 236, 255)
            c.drawCircle(s[0] * w, y, Ui.dp(context, 0.7f) * s[2], p)
        }
        if (isAttachedToWindow && !reduceMotion) postInvalidateOnAnimation()
    }
}
