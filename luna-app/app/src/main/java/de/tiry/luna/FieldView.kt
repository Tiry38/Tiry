package de.tiry.luna

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.Shader
import android.graphics.Typeface
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.hypot
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * LICHTFELD-INTERFACE – Lunas eigene Bedien-Idee.
 *
 * Der Bildschirm ist ein Raumzeit-Gitter aus Licht. Bedienelemente sind keine Objekte, sondern Gravitationsdellen:
 * Das Gitter krümmt sich zu ihnen hin. Antippen vertieft die Delle und schickt eine Schockwelle durchs ganze Feld.
 * Luna (der Kern) ist die größte Masse – wenn sie spricht, schwingt das gesamte Gitter mit ihrer Stimme.
 */
class FieldView(ctx: Context) : View(ctx) {

    /** Eine Gravitationsdelle = ein Bedienelement. Position kommt von einem unsichtbaren Anker-View im Layout. */
    class Well(
        val id: String,
        val icon: String?,
        val label: String,
        val anchor: View,
        val mass: Float = 1f,
        val onTap: (() -> Unit)? = null,
    ) {
        var active = false
        var activeColor = Ui.ICE
        internal var press = 0f      // 0..1, klingt nach dem Antippen ab
        internal var glow = 0f       // geglättete Aktiv-Leuchtkraft
        internal var x = 0f; internal var y = 0f; internal var visible = false
        internal var iconDrawable: LineIcon? = null
    }

    private class Ripple(val x: Float, val y: Float, var age: Float, val strength: Float, val color: Int)

    val wells = mutableListOf<Well>()
    /** Anker für Lunas Kern (Masse in der Mitte); null = kein Kern auf diesem Bildschirm. */
    var coreAnchor: View? = null
    var state: LunaState = LunaState.WAITING
    var level = 0f
    /** Ruhiges Feld ohne Kern-Schwingung (z. B. Einstellungen). */
    var calm = false

    private val reduceMotion = !ValueAnimator.areAnimatorsEnabled()
    private val ripples = ArrayList<Ripple>()
    private var t = 0f
    private var voice = 0f
    private var voiceEmit = 0f
    private val loc = IntArray(2); private val myLoc = IntArray(2)

    private val spacing = Ui.dp(ctx, 19f)
    private var cols = 0; private var rows = 0
    private var gx = FloatArray(0); private var gy = FloatArray(0)
    private var dx = FloatArray(0); private var dy = FloatArray(0); private var heat = FloatArray(0)
    private var lines = FloatArray(0)

    private val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { strokeWidth = Ui.dp(ctx, 0.6f) }
    private val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val glowPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER; textSize = Ui.dp(ctx, 7.6f); letterSpacing = 0.12f; color = Ui.STEEL
    }
    private val orbitPaint = Paint(Paint.ANTI_ALIAS_FLAG)

    init {
        setLayerType(LAYER_TYPE_HARDWARE, null); isClickable = true
        labelPaint.setShadowLayer(Ui.dp(ctx, 5f), 0f, 0f, Color.BLACK)   // dunkler Lichthof → Beschriftung hebt sich vom Gitter ab
    }

    fun setTypeface(tf: Typeface) { labelPaint.typeface = tf }

    /** Schockwelle von einem Punkt (auch von außen, z. B. wenn Luna antwortet). */
    fun pulse(x: Float, y: Float, strength: Float = 1f, color: Int = Ui.ICE) {
        ripples += Ripple(x, y, 0f, strength, color)
        if (ripples.size > 8) ripples.removeAt(0)
    }

    fun pulseCore(strength: Float = 1f) { coreCenter()?.let { (x, y) -> pulse(x, y, strength, Ui.ICE) } }

    override fun onSizeChanged(w: Int, h: Int, ow: Int, oh: Int) {
        cols = (w / spacing).toInt() + 3; rows = (h / spacing).toInt() + 3
        val n = cols * rows
        gx = FloatArray(n); gy = FloatArray(n); dx = FloatArray(n); dy = FloatArray(n); heat = FloatArray(n)
        val ox = (w - (cols - 1) * spacing) / 2f; val oy = (h - (rows - 1) * spacing) / 2f
        for (r in 0 until rows) for (c in 0 until cols) { val i = r * cols + c; gx[i] = ox + c * spacing; gy[i] = oy + r * spacing }
        lines = FloatArray(n * 8)
    }

    private fun centerOf(v: View): Pair<Float, Float>? {
        if (!v.isShown || v.width == 0) return null
        v.getLocationInWindow(loc); getLocationInWindow(myLoc)
        return (loc[0] - myLoc[0] + v.width / 2f) to (loc[1] - myLoc[1] + v.height / 2f)
    }

    private fun coreCenter() = coreAnchor?.let { centerOf(it) }

    private fun a(c: Int, alpha: Int) = (c and 0x00FFFFFF) or (alpha.coerceIn(0, 255) shl 24)

    override fun onDraw(c: Canvas) {
        c.drawColor(Ui.BLACK)
        if (cols == 0) return
        val dt = if (reduceMotion) 0f else 0.016f
        t += dt

        // Stimme → Energie, die aus dem Kern ins Feld strömt
        val targetVoice = when (state) {
            LunaState.SPEAKING -> 0.55f + 0.45f * kotlin.math.abs(sin(t * 6.3f))
            LunaState.LISTENING -> level
            LunaState.THINKING -> 0.25f
            else -> 0f
        }
        voice += (targetVoice - voice) * 0.15f
        voiceEmit += dt
        if (!calm && voice > 0.3f && voiceEmit > 0.42f) { voiceEmit = 0f; pulseCore(0.35f + voice * 0.5f) }

        for (w in wells) {
            val p = centerOf(w.anchor)
            w.visible = p != null
            if (p != null) { w.x = p.first; w.y = p.second }
            w.press = (w.press - dt * 1.6f).coerceAtLeast(0f)
            w.glow += ((if (w.active) 1f else 0f) - w.glow) * 0.08f
        }
        val core = coreCenter()
        for (r in ripples) r.age += dt
        ripples.removeAll { it.age > 2.6f }

        // ---------- Gitter verformen ----------
        val sig = Ui.dp(context, 46f)
        val coreSig = Ui.dp(context, 120f)
        val n = gx.size
        for (i in 0 until n) {
            val px = gx[i]; val py = gy[i]
            var ox = 0f; var oy = 0f; var hh = 0f
            // sanftes Atmen des Raums
            val breathe = sin(px * 0.012f + t * 0.8f) * cos(py * 0.010f - t * 0.6f)
            oy += breathe * Ui.dp(context, 1.6f)
            // Kern: große Masse
            if (core != null) {
                val ddx = core.first - px; val ddy = core.second - py
                val d = hypot(ddx, ddy) + 1f
                val pull = exp(-(d * d) / (2 * coreSig * coreSig)) * Ui.dp(context, 26f) * (1f + voice * 0.4f)
                ox += ddx / d * pull; oy += ddy / d * pull; hh += exp(-(d * d) / (2 * coreSig * coreSig)) * 0.8f
            }
            // Dellen
            for (w in wells) {
                if (!w.visible) continue
                val ddx = w.x - px; val ddy = w.y - py
                val d = hypot(ddx, ddy) + 1f
                val g = exp(-(d * d) / (2 * sig * sig))
                val pull = g * Ui.dp(context, 13f) * w.mass * (1f + w.press * 1.6f + w.glow * 0.5f)
                ox += ddx / d * pull; oy += ddy / d * pull
                hh += g * (0.45f + w.press + w.glow * 0.7f)
            }
            // Schockwellen
            for (r in ripples) {
                val ddx = px - r.x; val ddy = py - r.y
                val d = hypot(ddx, ddy) + 1f
                val front = r.age * Ui.dp(context, 420f)
                val band = d - front
                val env = exp(-(band * band) / (2 * 30f * 30f * context.resources.displayMetrics.density)) * exp(-r.age * 1.4f) * r.strength
                val push = env * Ui.dp(context, 11f)
                ox += ddx / d * push; oy += ddy / d * push; hh += env * 1.2f
            }
            dx[i] = px + ox; dy[i] = py + oy; heat[i] = hh.coerceAtMost(1.6f)
        }

        // ---------- Gitterlinien (je Linie eigene Helligkeit nach Energie) ----------
        val baseCol = when (state) { LunaState.LISTENING -> Ui.MINT; LunaState.THINKING -> Ui.VIOLET; LunaState.ERROR -> Ui.RED; else -> Ui.ICE }
        for (r in 0 until rows) for (col in 0 until cols) {
            val i = r * cols + col
            if (col + 1 < cols) seg(c, i, i + 1, baseCol)
            if (r + 1 < rows) seg(c, i, i + cols, baseCol)
        }
        // Knotenpunkte
        for (i in 0 until n) {
            val e = heat[i]
            if (e < 0.06f) continue
            dotPaint.color = a(if (e > 0.7f) Color.WHITE else baseCol, (40 + e * 150).toInt())
            c.drawCircle(dx[i], dy[i], Ui.dp(context, 0.8f + e * 0.9f), dotPaint)
        }

        // ---------- Dellen-Zentren: Glyphe, Licht, Orbitpartikel, Beschriftung ----------
        for (w in wells) {
            if (!w.visible) continue
            val col = if (w.glow > 0.05f) mixColor(Ui.ICE, w.activeColor, w.glow) else Ui.ICE
            val gr = Ui.dp(context, 30f + w.press * 16f)
            glowPaint.shader = RadialGradient(w.x, w.y, gr, intArrayOf(a(col, (60 + w.press * 120 + w.glow * 90).toInt()), Color.TRANSPARENT), null, Shader.TileMode.CLAMP)
            c.drawCircle(w.x, w.y, gr, glowPaint)
            // zwei Orbitpartikel
            for (k in 0 until 2) {
                val ang = t * (1.3f + k * 0.5f) * (if (k == 0) 1 else -1) + w.id.hashCode() % 7
                val rr = Ui.dp(context, 19f + k * 5f) * w.mass.coerceAtMost(1.4f)
                orbitPaint.color = a(col, 170 - k * 60)
                c.drawCircle(w.x + cos(ang) * rr, w.y + sin(ang) * rr * 0.55f, Ui.dp(context, 1.4f), orbitPaint)
            }
            w.icon?.let { name ->
                val ic = w.iconDrawable ?: LineIcon(name, Ui.TEXT).also { w.iconDrawable = it }
                val s = Ui.dp(context, 22f * w.mass.coerceAtMost(1.3f)).toInt()
                ic.setBounds((w.x - s / 2).toInt(), (w.y - s / 2).toInt(), (w.x + s / 2).toInt(), (w.y + s / 2).toInt())
                ic.alpha = 235; ic.draw(c)
            }
            if (w.label.isNotEmpty()) {
                labelPaint.color = if (w.glow > 0.5f) col else Ui.STEEL
                c.drawText(w.label.uppercase(), w.x, w.y + Ui.dp(context, 34f), labelPaint)
            }
        }
        if (isAttachedToWindow && !reduceMotion) postInvalidateOnAnimation()
    }

    private fun seg(c: Canvas, i: Int, j: Int, col: Int) {
        val e = (heat[i] + heat[j]) * 0.5f
        linePaint.color = a(if (e > 0.9f) mixColor(col, Color.WHITE, (e - 0.9f).coerceAtMost(0.6f)) else col, (16 + e * 120).toInt())
        c.drawLine(dx[i], dy[i], dx[j], dy[j], linePaint)
    }

    private fun mixColor(a: Int, b: Int, f: Float): Int {
        fun ch(s: Int) = ((a shr s and 0xFF) + (((b shr s and 0xFF) - (a shr s and 0xFF)) * f.coerceIn(0f, 1f))).toInt()
        return Color.rgb(ch(16), ch(8), ch(0))
    }

    /** Für Anker-Views (Barrierefreiheit/Touch über dem Feld): Delle drücken bzw. auslösen. */
    fun touchDown(id: String) { wells.firstOrNull { it.id == id }?.press = 0.6f }
    fun trigger(id: String) {
        val w = wells.firstOrNull { it.id == id } ?: return
        w.press = 1f
        pulse(w.x, w.y, 1.2f, if (w.active) w.activeColor else Ui.ICE)
        performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
        w.onTap?.invoke()
    }

    // ---------- Berührung: Treffer auf die nächstgelegene Delle ----------
    private var downWell: Well? = null

    override fun onTouchEvent(e: MotionEvent): Boolean {
        when (e.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                downWell = hit(e.x, e.y)
                downWell?.let { it.press = 0.6f; return true }
                return false
            }
            MotionEvent.ACTION_UP -> {
                val w = downWell; downWell = null
                if (w != null && hit(e.x, e.y) === w) {
                    w.press = 1f
                    pulse(w.x, w.y, 1.2f, w.activeColor)
                    performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
                    w.onTap?.invoke()
                    return true
                }
            }
            MotionEvent.ACTION_CANCEL -> downWell = null
        }
        return super.onTouchEvent(e)
    }

    private fun hit(x: Float, y: Float): Well? {
        val r = Ui.dp(context, 32f)
        return wells.filter { it.visible && it.onTap != null }.minByOrNull { hypot(it.x - x, it.y - y) }
            ?.takeIf { hypot(it.x - x, it.y - y) <= r * sqrt(it.mass) }
    }

    /** Barrierefreiheit: Dellen als Liste ansagen. */
    override fun onAttachedToWindow() { super.onAttachedToWindow(); postInvalidateOnAnimation() }
}
