package de.tiry.luna

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Shader
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.view.Gravity
import android.view.View
import android.widget.TextView

/** Gemeinsame Design-Bausteine: Glas-Pillen, Verlaufs-Kreise, Typo. Alles organisch, große Radien. */
object Ui {
    const val TEXT = 0xFFF5F3FF.toInt()
    const val MUTED = 0xFFC4C1E0.toInt()     // Kontrast auf #06070F ≈ 11:1
    const val VIOLET = 0xFF8B5CF6.toInt()
    const val CYAN = 0xFF22D3EE.toInt()
    const val PINK = 0xFFF472B6.toInt()
    const val GREEN = 0xFF34D399.toInt()
    const val RED = 0xFFF87171.toInt()

    fun dp(c: Context, v: Float) = v * c.resources.displayMetrics.density
    fun dpi(c: Context, v: Int) = (v * c.resources.displayMetrics.density).toInt()

    /** Milchglas-Pille. */
    fun glass(c: Context, radiusDp: Float = 999f, alpha: Int = 26): GradientDrawable = GradientDrawable().apply {
        cornerRadius = dp(c, radiusDp)
        setColor(Color.argb(alpha, 255, 255, 255))
        setStroke(dpi(c, 1), Color.argb(46, 255, 255, 255))
    }

    /** Kreis/Pille mit 3-Farben-Verlauf. */
    fun gradient(c: Context, radiusDp: Float = 999f, vararg colors: Int = intArrayOf(VIOLET, PINK, CYAN)): GradientDrawable =
        GradientDrawable(GradientDrawable.Orientation.TL_BR, colors).apply { cornerRadius = dp(c, radiusDp) }

    fun ripple(content: android.graphics.drawable.Drawable) =
        RippleDrawable(ColorStateList.valueOf(Color.argb(70, 255, 255, 255)), content, null)

    fun text(c: Context, s: String, sizeSp: Float, color: Int = TEXT, bold: Boolean = false) = TextView(c).apply {
        text = s; textSize = sizeSp; setTextColor(color)
        typeface = Typeface.create("sans-serif" + if (bold) "-medium" else "", Typeface.NORMAL)
        setLineSpacing(0f, 1.15f)
    }

    /** Text mit Farbverlauf (für den „LUNA“-Schriftzug). */
    fun gradientText(tv: TextView, vararg colors: Int) {
        tv.addOnLayoutChangeListener { v, _, _, _, _, _, _, _, _ ->
            val w = (v as TextView).paint.measureText(v.text.toString())
            v.paint.shader = LinearGradient(0f, 0f, w, v.textSize, colors, null, Shader.TileMode.CLAMP)
            v.invalidate()
        }
    }

    /** Pillen-Knopf mit min. 48 dp Höhe. */
    fun pillButton(c: Context, label: String, filled: Boolean = false, onClick: (View) -> Unit) = text(c, label, 15f, TEXT, true).apply {
        gravity = Gravity.CENTER
        minHeight = dpi(c, 52)
        setPadding(dpi(c, 22), dpi(c, 12), dpi(c, 22), dpi(c, 12))
        background = ripple(if (filled) gradient(c) else glass(c))
        isClickable = true; isFocusable = true
        setOnClickListener(onClick)
    }
}
