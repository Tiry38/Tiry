package de.tiry.luna

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.Shader
import android.graphics.SweepGradient
import android.util.AttributeSet
import android.view.View
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

/** Farbpaletten je Zustand (3+ Farben, weich ineinander). */
private val PALETTE = mapOf(
    LunaState.OFF to intArrayOf(0xFF4B4870.toInt(), 0xFF2E2B52.toInt(), 0xFF5B5784.toInt()),
    LunaState.LOADING to intArrayOf(0xFF8B5CF6.toInt(), 0xFF6366F1.toInt(), 0xFF22D3EE.toInt()),
    LunaState.WAITING to intArrayOf(0xFF8B5CF6.toInt(), 0xFF22D3EE.toInt(), 0xFFF472B6.toInt()),
    LunaState.LISTENING to intArrayOf(0xFF22D3EE.toInt(), 0xFF34D399.toInt(), 0xFF818CF8.toInt()),
    LunaState.THINKING to intArrayOf(0xFFC084FC.toInt(), 0xFFF472B6.toInt(), 0xFF6366F1.toInt()),
    LunaState.SPEAKING to intArrayOf(0xFFF472B6.toInt(), 0xFFFBBF24.toInt(), 0xFFA78BFA.toInt()),
    LunaState.ERROR to intArrayOf(0xFFF87171.toInt(), 0xFFFB923C.toInt(), 0xFFF472B6.toInt()),
)

/**
 * Lunas „Gesicht“: ein lebendiger Energie-Orb aus mehreren weichen Blobs, Glow und Lichtring.
 * Atmet im Ruhezustand, reagiert beim Zuhören auf deine Lautstärke, wirbelt beim Denken, pulsiert beim Sprechen.
 */
class OrbView @JvmOverloads constructor(ctx: Context, attrs: AttributeSet? = null) : View(ctx, attrs) {

    var state: LunaState = LunaState.WAITING
        set(v) { field = v; target = PALETTE[v] ?: target }
    var level = 0f

    private var target = PALETTE[LunaState.WAITING]!!
    private val colors = target.copyOf()
    private var t = 0f
    private var smooth = 0f
    private val reduceMotion = ValueAnimator.areAnimatorsEnabled().not()

    private val blobPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val glowPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
    private val corePaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val path = Path()

    init { setLayerType(LAYER_TYPE_HARDWARE, null) }

    private fun mix(a: Int, b: Int, f: Float): Int {
        fun ch(s: Int) = ((a shr s and 0xFF) + (((b shr s and 0xFF) - (a shr s and 0xFF)) * f)).toInt()
        return Color.argb(ch(24), ch(16), ch(8), ch(0))
    }

    private fun alpha(c: Int, a: Int) = (c and 0x00FFFFFF) or (a.coerceIn(0, 255) shl 24)

    override fun onDraw(c: Canvas) {
        super.onDraw(c)
        val speed = when (state) { LunaState.THINKING -> 2.6f; LunaState.SPEAKING -> 1.8f; LunaState.LISTENING -> 1.4f; LunaState.OFF -> 0.3f; else -> 0.8f }
        if (!reduceMotion) t += 0.016f * speed
        for (i in colors.indices) colors[i] = mix(colors[i], target[i], 0.06f)
        smooth += (level - smooth) * 0.25f

        val cx = width / 2f; val cy = height / 2f
        val base = min(width, height) * 0.30f
        val pulse = when (state) {
            LunaState.WAITING, LunaState.LOADING -> 1f + 0.035f * sin(t * 1.6f)
            LunaState.LISTENING -> 1f + 0.18f * smooth + 0.02f * sin(t * 3f)
            LunaState.SPEAKING -> 1f + 0.07f * (0.5f + 0.5f * sin(t * 7f)) * (0.6f + 0.4f * sin(t * 2.3f))
            LunaState.THINKING -> 1f + 0.03f * sin(t * 5f)
            else -> 1f
        }
        val r = base * pulse

        // 1) großer weicher Glow
        // Radius endet innerhalb der View → keine sichtbaren Kanten
        val gr = min(min(width, height) / 2f - 2f, r * 2.1f)
        glowPaint.shader = RadialGradient(cx, cy, gr, intArrayOf(alpha(colors[0], 120), alpha(colors[1], 45), Color.TRANSPARENT),
            floatArrayOf(0f, 0.5f, 1f), Shader.TileMode.CLAMP)
        c.drawCircle(cx, cy, gr, glowPaint)

        // 2) Lichtring mit Farbverlauf, dreht sich
        ringPaint.strokeWidth = r * 0.035f
        ringPaint.shader = SweepGradient(cx, cy, intArrayOf(colors[0], colors[1], colors[2], colors[0]), null)
        ringPaint.alpha = if (state == LunaState.OFF) 60 else 170
        c.save(); c.rotate(t * 40f, cx, cy)
        c.drawCircle(cx, cy, r * 1.32f, ringPaint)
        c.restore()

        // 3) drei organische Blobs, die ineinanderfließen
        for (k in 0 until 3) {
            val amp = when (state) { LunaState.THINKING -> 0.16f; LunaState.LISTENING -> 0.08f + 0.22f * smooth; LunaState.SPEAKING -> 0.12f; else -> 0.07f }
            blob(cx + cos(t * 0.7f + k * 2.1f) * r * 0.10f, cy + sin(t * 0.9f + k * 2.1f) * r * 0.10f,
                r * (1f - k * 0.13f), amp, k)
            blobPaint.shader = RadialGradient(cx - r * 0.25f, cy - r * 0.3f, r * 1.4f,
                intArrayOf(alpha(colors[(k + 2) % 3], 255), alpha(colors[k], 220), alpha(colors[(k + 1) % 3], 140)),
                floatArrayOf(0f, 0.55f, 1f), Shader.TileMode.CLAMP)
            blobPaint.alpha = 150 + k * 35
            c.drawPath(path, blobPaint)
        }

        // 4) heller Kern
        corePaint.shader = RadialGradient(cx - r * 0.15f, cy - r * 0.2f, r * 0.75f,
            intArrayOf(Color.argb(230, 255, 255, 255), Color.argb(60, 255, 255, 255), Color.TRANSPARENT), floatArrayOf(0f, 0.4f, 1f), Shader.TileMode.CLAMP)
        c.drawCircle(cx - r * 0.12f, cy - r * 0.16f, r * 0.75f, corePaint)

        // 5) Denk-Partikel
        if (state == LunaState.THINKING || state == LunaState.LOADING) {
            for (i in 0 until 6) {
                val a = t * 2.2f + i * (2 * PI.toFloat() / 6)
                val rr = r * (1.5f + 0.08f * sin(t * 4f + i))
                dotPaint.color = alpha(colors[i % 3], 220)
                dotPaint.maskFilter = BlurMaskFilter(r * 0.04f, BlurMaskFilter.Blur.NORMAL)
                c.drawCircle(cx + cos(a) * rr, cy + sin(a) * rr, r * 0.045f, dotPaint)
            }
        }
        if (isAttachedToWindow && !reduceMotion) postInvalidateOnAnimation()
    }

    private fun blob(cx: Float, cy: Float, r: Float, amp: Float, seed: Int) {
        path.reset()
        val n = 96
        for (i in 0..n) {
            val a = i * 2 * PI.toFloat() / n
            val wobble = sin(a * 3 + t * 1.3f + seed) * 0.5f + sin(a * 5 - t * 0.9f + seed * 1.7f) * 0.3f + sin(a * 2 + t * 2.1f) * 0.2f
            val rr = r * (1f + amp * wobble)
            val x = cx + cos(a) * rr; val y = cy + sin(a) * rr
            if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        path.close()
    }

    override fun onAttachedToWindow() { super.onAttachedToWindow(); postInvalidateOnAnimation() }
}

/** Animierter Aurora-Hintergrund: tiefes Nachtblau mit langsam wandernden Farbnebeln. */
class AuroraView @JvmOverloads constructor(ctx: Context, attrs: AttributeSet? = null) : View(ctx, attrs) {
    private var t = 0f
    private val p = Paint(Paint.ANTI_ALIAS_FLAG)
    private val reduceMotion = ValueAnimator.areAnimatorsEnabled().not()
    private val blobs = listOf(
        Triple(0xFF7C3AED.toInt(), 0.2f, 0.15f), Triple(0xFF0891B2.toInt(), 0.85f, 0.35f),
        Triple(0xFFDB2777.toInt(), 0.3f, 0.85f), Triple(0xFF4F46E5.toInt(), 0.8f, 0.9f),
    )

    override fun onDraw(c: Canvas) {
        c.drawColor(0xFF06070F.toInt())
        if (!reduceMotion) t += 0.004f
        val w = width.toFloat(); val h = height.toFloat()
        blobs.forEachIndexed { i, (col, x, y) ->
            val cx = w * (x + 0.12f * sin(t * (1 + i * 0.3f) + i))
            val cy = h * (y + 0.08f * cos(t * (0.8f + i * 0.2f) + i * 2))
            val r = maxOf(w, h) * 0.55f
            p.shader = RadialGradient(cx, cy, r, intArrayOf((col and 0x00FFFFFF) or (0x55 shl 24), Color.TRANSPARENT), null, Shader.TileMode.CLAMP)
            c.drawCircle(cx, cy, r, p)
        }
        if (isAttachedToWindow && !reduceMotion) postInvalidateOnAnimation()
    }
}
