package de.tiry.luna

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorFilter
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PixelFormat
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.view.Gravity
import android.view.View
import android.widget.TextView

/**
 * Designsprache „Luna 2100“: tiefes Schwarz, Chrom-Schrift, eisblaues Leuchten, feine Spektrum-Haarlinien,
 * breite Automotive-Schrift (Michroma) für Titel/Labels, Sora für Fließtext. Keine Kästen – nur Pillen, Kreise, Linien.
 */
object Ui {
    const val BLACK = 0xFF000000.toInt()
    const val TEXT = 0xFFF4F7FB.toInt()
    const val STEEL = 0xFFA9B3C1.toInt()    // Kontrast auf Schwarz ≈ 9:1
    const val DIM = 0xFF8C96A5.toInt()      // ≈ 6.4:1
    const val ICE = 0xFF7FD4FF.toInt()
    const val MINT = 0xFFB9FFE4.toInt()
    const val VIOLET = 0xFFA78BFA.toInt()
    const val ROSE = 0xFFFF8FB1.toInt()
    const val AMBER = 0xFFFFD58A.toInt()
    const val RED = 0xFFFF6B6B.toInt()
    const val HAIR = 0x24FFFFFF
    const val HAIR_STRONG = 0x47FFFFFF

    // Für Kompatibilität mit älteren Stellen
    const val MUTED = STEEL
    const val CYAN = ICE
    const val GREEN = MINT
    const val PINK = ROSE

    private var wideTf: Typeface? = null
    private val soraCache = HashMap<Int, Typeface>()

    /** Breite Automotive-Schrift. */
    fun wide(c: Context): Typeface = wideTf ?: try {
        Typeface.createFromAsset(c.assets, "fonts/Michroma-Regular.ttf")
    } catch (_: Exception) { Typeface.create("sans-serif", Typeface.NORMAL) }.also { wideTf = it }

    /** Sora mit beliebiger Stärke (variable Schrift). */
    fun sans(c: Context, weight: Int = 400): Typeface = soraCache.getOrPut(weight) {
        try { Typeface.Builder(c.assets, "fonts/Sora-Variable.ttf").setFontVariationSettings("'wght' $weight").build() }
        catch (_: Exception) { Typeface.create("sans-serif", Typeface.NORMAL) }
    }

    fun dp(c: Context, v: Float) = v * c.resources.displayMetrics.density
    fun dpi(c: Context, v: Int) = (v * c.resources.displayMetrics.density).toInt()

    /** Haarlinien-Pille (nur Kontur, fast unsichtbare Füllung). */
    fun hairline(c: Context, radiusDp: Float = 999f, stroke: Int = HAIR_STRONG, fill: Int = 0x08FFFFFF): GradientDrawable = GradientDrawable().apply {
        cornerRadius = dp(c, radiusDp); setColor(fill); setStroke(dpi(c, 1), stroke)
    }

    fun glass(c: Context, radiusDp: Float = 999f, alpha: Int = 14): GradientDrawable = hairline(c, radiusDp, HAIR_STRONG, Color.argb(alpha, 255, 255, 255))

    fun circle(c: Context, stroke: Int = HAIR_STRONG, fill: Int = 0x0AFFFFFF): GradientDrawable = GradientDrawable().apply {
        shape = GradientDrawable.OVAL; setColor(fill); setStroke(dpi(c, 1), stroke)
    }

    /** Eis-Leuchtkreis (aktiver Zustand). */
    fun iceCircle(c: Context): GradientDrawable = GradientDrawable().apply {
        shape = GradientDrawable.OVAL; gradientType = GradientDrawable.RADIAL_GRADIENT
        gradientRadius = dp(c, 46f); colors = intArrayOf(0x557FD4FF, 0x0F7FD4FF)
        setStroke(dpi(c, 1), 0x997FD4FF.toInt())
    }

    fun gradient(c: Context, radiusDp: Float = 999f, vararg colors: Int = intArrayOf(ICE, VIOLET, MINT)): GradientDrawable =
        GradientDrawable(GradientDrawable.Orientation.TL_BR, colors).apply { cornerRadius = dp(c, radiusDp) }

    /** Weiße Pille mit schwarzer Schrift – der „Tesla-Knopf“. */
    fun solid(c: Context): GradientDrawable = GradientDrawable().apply { cornerRadius = dp(c, 999f); setColor(TEXT) }

    fun ripple(content: Drawable) = RippleDrawable(ColorStateList.valueOf(0x557FD4FF), content, null)

    fun text(c: Context, s: String, sizeSp: Float, color: Int = TEXT, bold: Boolean = false) = TextView(c).apply {
        text = s; textSize = sizeSp; setTextColor(color)
        typeface = sans(c, if (bold) 600 else 400)
        setLineSpacing(0f, 1.18f)
        includeFontPadding = false
    }

    /** Label in breiter Schrift, Großbuchstaben, weit gesperrt („SYSTEM BEREIT“). */
    fun label(c: Context, s: String, sizeSp: Float = 10f, color: Int = DIM, spacing: Float = 0.28f) = TextView(c).apply {
        text = s.uppercase(); textSize = sizeSp; setTextColor(color); typeface = wide(c); letterSpacing = spacing; includeFontPadding = false
    }

    /** Chrom-Verlauf über die Schrift (wie poliertes Metall). */
    fun chrome(tv: TextView) {
        tv.addOnLayoutChangeListener { v, _, _, _, _, _, _, _, _ ->
            val t = v as TextView
            t.paint.shader = LinearGradient(0f, 0f, 0f, t.textSize * 1.1f,
                intArrayOf(0xFFFFFFFF.toInt(), 0xFFDDE4EC.toInt(), 0xFF8E9AA8.toInt(), 0xFFF2F6FA.toInt()),
                floatArrayOf(0f, 0.45f, 0.55f, 1f), Shader.TileMode.CLAMP)
            t.invalidate()
        }
    }

    /** Spektrum-Verlauf über die Schrift (Eis → Violett → Mint). */
    fun spectrum(tv: TextView) {
        tv.addOnLayoutChangeListener { v, _, _, _, _, _, _, _, _ ->
            val t = v as TextView
            val w = t.paint.measureText(t.text.toString()).coerceAtLeast(1f)
            t.paint.shader = LinearGradient(0f, 0f, w, 0f, intArrayOf(ICE, VIOLET, MINT), null, Shader.TileMode.CLAMP)
            t.invalidate()
        }
    }

    /** Lichtzeilen-Knopf (kein Rahmen): Raute + breite Schrift + Leuchtspur darunter. primary = hellere Spur. */
    fun pillButton(c: Context, label: String, solid: Boolean = false, onClick: (View) -> Unit): TextView =
        LightButton(c, label, solid).apply { setOnClickListener(onClick) }

    /** Unterstrich-Feld mit HUD-Eckmarken; fokussiert leuchtet es eisblau. */
    fun underline(c: Context, focused: Boolean = false): Drawable = UnderlineDrawable(c, focused)
}

/** Knopf aus reinem Licht: ◇-Raute, Text, darunter eine Linie mit wandernder Leuchtspur. */
class LightButton(c: Context, label: String, private val primary: Boolean = false) : TextView(c) {
    var selected2 = false
        set(v) { field = v; setTextColor(if (v || primary) Ui.ICE else Ui.TEXT); invalidate() }
    private val p = Paint(Paint.ANTI_ALIAS_FLAG)
    private val reduce = !android.animation.ValueAnimator.areAnimatorsEnabled()
    private var t = (Math.random() * 10).toFloat()
    private var flash = 0f

    init {
        text = label.uppercase(); textSize = 10.5f; typeface = Ui.wide(c); letterSpacing = 0.2f
        setTextColor(if (primary) Ui.ICE else Ui.TEXT)
        gravity = Gravity.CENTER_VERTICAL; minHeight = Ui.dpi(c, 50)
        setPadding(Ui.dpi(c, 24), Ui.dpi(c, 12), Ui.dpi(c, 6), Ui.dpi(c, 14))
        isClickable = true; isFocusable = true
        background = null
    }

    override fun performClick(): Boolean { flash = 1f; invalidate(); return super.performClick() }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val d = resources.displayMetrics.density
        if (!reduce) t += 0.016f
        flash = (flash - 0.03f).coerceAtLeast(0f)
        val on = selected2 || primary
        val cy = height / 2f - d
        // Raute links
        val r = 4.2f * d; val x0 = 9f * d
        val path = Path().apply { moveTo(x0, cy - r); lineTo(x0 + r, cy); lineTo(x0, cy + r); lineTo(x0 - r, cy); close() }
        p.shader = null; p.strokeWidth = 1.2f * d
        p.style = if (on) Paint.Style.FILL else Paint.Style.STROKE
        p.color = if (on) Ui.ICE else Ui.STEEL
        canvas.drawPath(path, p)
        // Linie + Leuchtspur
        val textW = paint.measureText(text.toString()) + paddingLeft
        val y = height - 4f * d
        p.style = Paint.Style.STROKE; p.strokeWidth = 1f * d
        p.color = if (on) 0x807FD4FF.toInt() else 0x33FFFFFF
        canvas.drawLine(paddingLeft.toFloat(), y, textW, y, p)
        val len = (textW - paddingLeft) * 0.35f
        val head = paddingLeft + ((t * 0.35f) % 1.4f) * (textW - paddingLeft + len) - len
        p.shader = LinearGradient(head - len, 0f, head, 0f, intArrayOf(0x007FD4FF, Ui.ICE, 0x007FD4FF), floatArrayOf(0f, 0.8f, 1f), Shader.TileMode.CLAMP)
        p.strokeWidth = 1.6f * d; p.alpha = if (on) 255 else 150
        canvas.drawLine(maxOf(paddingLeft.toFloat(), head - len), y, minOf(textW, head), y, p)
        if (flash > 0f) {
            p.shader = null; p.color = Ui.ICE; p.alpha = (flash * 255).toInt(); p.strokeWidth = 2.4f * d
            canvas.drawLine(paddingLeft.toFloat(), y, paddingLeft + (textW - paddingLeft) * (1f - flash * 0.3f), y, p)
        }
        if (!reduce && isAttachedToWindow) postInvalidateOnAnimation()
    }
}

/** Nur eine Grundlinie mit kleinen hochgezogenen Ecken – wie ein HUD-Zielfeld. */
class UnderlineDrawable(private val c: Context, private val focused: Boolean) : Drawable() {
    private val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND }
    override fun draw(canvas: Canvas) {
        val b = bounds; val d = c.resources.displayMetrics.density
        val y = b.bottom - 2f * d
        p.strokeWidth = if (focused) 1.5f * d else 1f * d
        p.shader = if (focused) LinearGradient(b.left.toFloat(), 0f, b.right.toFloat(), 0f, intArrayOf(Ui.ICE, Ui.VIOLET, Ui.MINT), null, Shader.TileMode.CLAMP) else null
        p.color = if (focused) Ui.ICE else 0x40FFFFFF
        canvas.drawLine(b.left + 4 * d, y, b.right - 4 * d, y, p)
        p.shader = null; p.color = if (focused) Ui.ICE else 0x66FFFFFF
        canvas.drawLine(b.left + 4 * d, y, b.left + 4 * d, y - 7 * d, p)
        canvas.drawLine(b.right - 4 * d, y, b.right - 4 * d, y - 7 * d, p)
    }
    override fun setAlpha(alpha: Int) {}
    override fun setColorFilter(cf: ColorFilter?) {}
    @Deprecated("Deprecated in Java") override fun getOpacity() = PixelFormat.TRANSLUCENT
}

/** Energieknoten als Schalter: Ring aus Segmenten, innen ein Kern, der bei „an“ leuchtet und rotiert. */
class NodeToggle(c: Context) : View(c) {
    var on = false; set(v) { field = v; invalidate() }
    private val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { strokeCap = Paint.Cap.ROUND }
    private var t = 0f
    private val reduce = !android.animation.ValueAnimator.areAnimatorsEnabled()
    override fun onDraw(canvas: Canvas) {
        val d = resources.displayMetrics.density
        val cx = width / 2f; val cy = height / 2f; val r = minOf(width, height) / 2f - 3 * d
        if (!reduce && on) t += 1.2f
        p.style = Paint.Style.STROKE; p.strokeWidth = 1.6f * d
        for (k in 0 until 8) {
            p.color = if (on) (if (k % 2 == 0) Ui.ICE else Ui.MINT) else 0x40FFFFFF
            canvas.drawArc(RectF(cx - r, cy - r, cx + r, cy + r), t + k * 45f + 6f, 33f, false, p)
        }
        p.style = Paint.Style.FILL
        if (on) {
            p.shader = android.graphics.RadialGradient(cx, cy, r * 0.75f, intArrayOf(Color.WHITE, Ui.ICE, 0x007FD4FF), floatArrayOf(0f, 0.4f, 1f), Shader.TileMode.CLAMP)
            canvas.drawCircle(cx, cy, r * 0.75f, p); p.shader = null
        } else { p.color = 0x4DFFFFFF; canvas.drawCircle(cx, cy, 2.2f * d, p) }
        if (on && !reduce && isAttachedToWindow) postInvalidateOnAnimation()
    }
}

/** Feine Spektrum-Haarlinie mit weich ausgeblendeten Enden. */
class HairlineView(c: Context) : View(c) {
    private val p = Paint(Paint.ANTI_ALIAS_FLAG)
    override fun onDraw(canvas: Canvas) {
        p.shader = LinearGradient(0f, 0f, width.toFloat(), 0f,
            intArrayOf(0x007FD4FF, 0xCC7FD4FF.toInt(), 0xCCA78BFA.toInt(), 0xCCB9FFE4.toInt(), 0x00B9FFE4),
            floatArrayOf(0f, 0.25f, 0.5f, 0.75f, 1f), Shader.TileMode.CLAMP)
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), p)
    }
}

/** Dünne Linien-Icons im einheitlichen Stil (24er-Raster, gezeichnet statt Bilddateien). */
class LineIcon(private val kind: String, private val color: Int = Ui.TEXT) : Drawable() {
    private val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND }

    override fun draw(c: Canvas) {
        val b = bounds
        val s = minOf(b.width(), b.height()) / 24f
        c.save(); c.translate(b.left + (b.width() - 24 * s) / 2, b.top + (b.height() - 24 * s) / 2); c.scale(s, s)
        p.color = color; p.strokeWidth = 1.6f; p.style = Paint.Style.STROKE
        val path = Path()
        when (kind) {
            "power" -> { c.drawArc(RectF(5f, 5.5f, 19f, 19.5f), -60f, 300f, false, p); c.drawLine(12f, 3.5f, 12f, 11f, p) }
            "remote" -> { c.drawRoundRect(RectF(3f, 4.5f, 21f, 16f), 2f, 2f, p); c.drawLine(9f, 20f, 15f, 20f, p); c.drawLine(12f, 16f, 12f, 20f, p)
                path.moveTo(10f, 8f); path.lineTo(14f, 10.25f); path.lineTo(10f, 12.5f); path.close(); c.drawPath(path, p) }
            "shield" -> { path.moveTo(12f, 3f); path.lineTo(19.5f, 6f); path.lineTo(19.5f, 11.5f); path.cubicTo(19.5f, 16f, 16f, 19.5f, 12f, 21f)
                path.cubicTo(8f, 19.5f, 4.5f, 16f, 4.5f, 11.5f); path.lineTo(4.5f, 6f); path.close(); c.drawPath(path, p)
                path.reset(); path.moveTo(8.8f, 12f); path.lineTo(11.2f, 14.3f); path.lineTo(15.4f, 9.6f); c.drawPath(path, p) }
            "wifi" -> { c.drawArc(RectF(2.5f, 6f, 21.5f, 25f), 220f, 100f, false, p); c.drawArc(RectF(6f, 9.5f, 18f, 21.5f), 220f, 100f, false, p)
                c.drawArc(RectF(9.3f, 12.8f, 14.7f, 18.2f), 220f, 100f, false, p); p.style = Paint.Style.FILL; c.drawCircle(12f, 19f, 1.2f, p) }
            "torch" -> { path.moveTo(7f, 3.5f); path.lineTo(17f, 3.5f); path.lineTo(17f, 7f); path.lineTo(14.5f, 11f); path.lineTo(14.5f, 20.5f)
                path.lineTo(9.5f, 20.5f); path.lineTo(9.5f, 11f); path.lineTo(7f, 7f); path.close(); c.drawPath(path, p); c.drawLine(7f, 7f, 17f, 7f, p)
                c.drawLine(12f, 13.5f, 12f, 15.5f, p) }
            "bell" -> { path.moveTo(6f, 16.5f); path.lineTo(6f, 11f); path.cubicTo(6f, 7.5f, 8.5f, 5f, 12f, 5f); path.cubicTo(15.5f, 5f, 18f, 7.5f, 18f, 11f)
                path.lineTo(18f, 16.5f); path.lineTo(19.5f, 18f); path.lineTo(4.5f, 18f); path.close(); c.drawPath(path, p)
                c.drawArc(RectF(10f, 18.5f, 14f, 22f), 0f, 180f, false, p); c.drawLine(4f, 4f, 20f, 20f, p) }
            "lock" -> { c.drawRoundRect(RectF(5f, 10.5f, 19f, 20.5f), 2.5f, 2.5f, p); c.drawArc(RectF(8f, 4f, 16f, 13f), 180f, 180f, false, p)
                c.drawLine(8f, 8.5f, 8f, 10.5f, p); c.drawLine(16f, 8.5f, 16f, 10.5f, p); c.drawLine(12f, 14.5f, 12f, 16.5f, p) }
            "cloud" -> { path.moveTo(7f, 18.5f); path.cubicTo(4f, 18.5f, 2.8f, 16f, 3.3f, 14f); path.cubicTo(3.8f, 12f, 5.5f, 11f, 7.2f, 11.2f)
                path.cubicTo(7.8f, 7.8f, 10.5f, 6f, 13.3f, 6.3f); path.cubicTo(16.5f, 6.6f, 18.5f, 9.2f, 18.5f, 11.8f)
                path.cubicTo(20.5f, 12f, 21.6f, 13.8f, 21.3f, 15.6f); path.cubicTo(21f, 17.4f, 19.6f, 18.5f, 17.8f, 18.5f); path.close(); c.drawPath(path, p) }
            "mic" -> { c.drawRoundRect(RectF(9f, 3f, 15f, 14.5f), 3f, 3f, p); c.drawArc(RectF(5.5f, 6.5f, 18.5f, 17.5f), 0f, 180f, false, p)
                c.drawLine(12f, 17.5f, 12f, 21f, p); c.drawLine(8.5f, 21f, 15.5f, 21f, p) }
            "gear" -> { c.drawCircle(12f, 12f, 3.2f, p)
                for (k in 0 until 8) { val a = Math.toRadians(k * 45.0); c.drawLine((12 + 6.2 * Math.cos(a)).toFloat(), (12 + 6.2 * Math.sin(a)).toFloat(),
                    (12 + 8.8 * Math.cos(a)).toFloat(), (12 + 8.8 * Math.sin(a)).toFloat(), p) }
                c.drawCircle(12f, 12f, 6.2f, p) }
            "stop" -> { c.drawRoundRect(RectF(7f, 7f, 17f, 17f), 2f, 2f, p) }
        }
        c.restore()
    }

    override fun setAlpha(alpha: Int) { p.alpha = alpha }
    override fun setColorFilter(cf: ColorFilter?) { p.colorFilter = cf }
    @Deprecated("Deprecated in Java") override fun getOpacity() = PixelFormat.TRANSLUCENT
    override fun getIntrinsicWidth() = 72
    override fun getIntrinsicHeight() = 72
}
