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
 * Cockpit-Feld: ruhiges Punkteraster, Reaktor-Ringe als Bedienelemente (drehen sich, wenn aktiv),
 * saubere Wellenringe beim Antippen und Schallwellen aus Lunas Kern, wenn sie spricht oder zuhört.
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
        textAlign = Paint.Align.CENTER; textSize = Ui.dp(ctx, 11.5f); letterSpacing = 0.02f; color = Ui.STEEL
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
        val d = context.resources.displayMetrics.density

        // Stimme → Schallwellen aus dem Kern
        val targetVoice = when (state) {
            LunaState.SPEAKING -> 0.55f + 0.45f * kotlin.math.abs(sin(t * 6.3f))
            LunaState.LISTENING -> level
            else -> 0f
        }
        voice += (targetVoice - voice) * 0.15f
        voiceEmit += dt
        if (!calm && voice > 0.3f && voiceEmit > 0.55f) { voiceEmit = 0f; pulseCore(0.4f + voice * 0.4f) }

        for (w in wells) {
            val p = centerOf(w.anchor)
            w.visible = p != null
            if (p != null) { w.x = p.first; w.y = p.second }
            w.press = (w.press - dt * 1.8f).coerceAtLeast(0f)
            w.glow += ((if (w.active) 1f else 0f) - w.glow) * 0.08f
        }
        val core = coreCenter()
        for (r in ripples) r.age += dt
        ripples.removeAll { it.age > 1.8f }

        val accent = when (state) { LunaState.LISTENING -> Ui.MINT; LunaState.THINKING -> Ui.VIOLET; LunaState.ERROR -> Ui.RED; else -> Ui.ICE }

        // ---------- 1) ruhiges, gerades Punkteraster; um den Kern sanft heller ----------
        val coreR = Ui.dp(context, 170f)
        for (i in gx.indices) {
            var alpha = 22
            if (core != null) {
                val dd = hypot(gx[i] - core.first, gy[i] - core.second)
                if (dd < coreR) alpha += ((1f - dd / coreR) * (40 + voice * 70)).toInt()
            }
            dotPaint.color = a(if (alpha > 40) accent else Color.WHITE, alpha)
            c.drawCircle(gx[i], gy[i], 0.9f * d, dotPaint)
        }

        // ---------- 2) Schallwellen / Tipp-Wellen als saubere Ringe ----------
        linePaint.style = Paint.Style.STROKE
        for (r in ripples) {
            val fromCore = core != null && r.x == core.first && r.y == core.second
            val start = if (fromCore) (coreAnchor?.let { minOf(it.width, it.height) } ?: 0) * 0.36f else Ui.dp(context, 28f)
            val maxR = if (fromCore) Ui.dp(context, 150f) else Ui.dp(context, 60f)
            val f = (r.age / 1.8f).coerceIn(0f, 1f)
            val rad = start + f * maxR
            linePaint.strokeWidth = (1.6f - f) * d
            linePaint.color = a(r.color, ((1f - f) * 150 * r.strength.coerceAtMost(1.5f)).toInt())
            c.drawCircle(r.x, r.y, rad, linePaint)
        }

        // ---------- 3) Reaktor-Ringe ----------
        for (w in wells) {
            if (!w.visible) continue
            val col = if (w.glow > 0.05f) mixColor(Ui.STEEL, w.activeColor, w.glow) else Ui.STEEL
            val R = Ui.dp(context, 25f) * w.mass.coerceAtMost(1.2f)
            // Leuchten bei aktiv/gedrückt
            if (w.glow > 0.05f || w.press > 0.05f) {
                val gc = if (w.press > w.glow) Ui.ICE else w.activeColor
                glowPaint.shader = RadialGradient(w.x, w.y, R * 1.6f, intArrayOf(a(gc, (50 * w.glow + 110 * w.press).toInt()), Color.TRANSPARENT), null, Shader.TileMode.CLAMP)
                c.drawCircle(w.x, w.y, R * 1.6f, glowPaint)
            }
            // vier Segmente; drehen sich nur, wenn aktiv
            val rot = if (w.glow > 0.05f) t * 40f * w.glow else 0f
            orbitPaint.style = Paint.Style.STROKE; orbitPaint.strokeCap = Paint.Cap.ROUND
            orbitPaint.strokeWidth = 1.6f * d
            orbitPaint.color = a(if (w.press > 0.2f) Ui.ICE else col, if (w.glow > 0.05f) 230 else 150)
            val oval = android.graphics.RectF(w.x - R, w.y - R, w.x + R, w.y + R)
            for (k in 0 until 4) c.drawArc(oval, rot + k * 90f + 12f, 66f, false, orbitPaint)
            // feiner Innenring
            orbitPaint.strokeWidth = 0.8f * d; orbitPaint.color = a(Color.WHITE, 40)
            c.drawCircle(w.x, w.y, R * 0.78f, orbitPaint)
            orbitPaint.style = Paint.Style.FILL
            w.icon?.let { name ->
                val ic = w.iconDrawable ?: LineIcon(name, Ui.TEXT).also { w.iconDrawable = it }
                val sz = (R * 0.95f).toInt()
                ic.setBounds((w.x - sz / 2).toInt(), (w.y - sz / 2).toInt(), (w.x + sz / 2).toInt(), (w.y + sz / 2).toInt())
                ic.alpha = 240; ic.draw(c)
            }
            if (w.label.isNotEmpty()) {
                labelPaint.color = if (w.glow > 0.5f) w.activeColor else Ui.STEEL
                c.drawText(w.label, w.x, w.y + R + Ui.dp(context, 17f), labelPaint)
            }
        }
        if (isAttachedToWindow && !reduceMotion) postInvalidateOnAnimation()
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
