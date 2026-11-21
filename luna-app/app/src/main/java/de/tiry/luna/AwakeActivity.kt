package de.tiry.luna

import android.animation.ValueAnimator
import android.app.Activity
import android.content.Context
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Shader
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.sin

/**
 * „Hey Luna“ bei ausgeschaltetem Display: Schwarz, nur eine leuchtende Stimm-Linie, die sich mit Lunas und deiner
 * Stimme bewegt, darunter ihre Worte. Erscheint über dem Sperrbildschirm und verschwindet nach dem Gespräch von selbst.
 */
class AwakeActivity : Activity(), LunaBus.Listener {

    companion object { @Volatile var visible = false }

    private lateinit var line: VoiceLineView
    private lateinit var lunaText: TextView
    private lateinit var userText: TextView
    private val ui = Handler(Looper.getMainLooper())
    private val close = Runnable { if (LunaBus.current.state == LunaState.WAITING || LunaBus.current.state == LunaState.OFF) finishAndRemoveTask() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true) }
        else @Suppress("DEPRECATION") window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.statusBarColor = Color.BLACK; window.navigationBarColor = Color.BLACK

        val root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
        line = VoiceLineView(this)
        root.addView(line, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_HORIZONTAL }
        val d = { v: Int -> Ui.dpi(this, v) }
        userText = Ui.text(this, "", 15f, Ui.STEEL).apply { gravity = Gravity.CENTER; setPadding(d(28), 0, d(28), d(10)) }
        lunaText = Ui.text(this, "", 22f, Ui.TEXT).apply { gravity = Gravity.CENTER; typeface = Ui.sans(context, 300); setPadding(d(28), 0, d(28), 0) }
        col.addView(userText); col.addView(lunaText)
        root.addView(col, FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT, Gravity.CENTER).apply { topMargin = d(90) })
        root.addView(Ui.label(this, "Luna", 11f, Ui.DIM, 0.6f).apply { gravity = Gravity.CENTER },
            FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT, Gravity.TOP).apply { topMargin = d(70) })
        // Antippen: Luna unterbrechen bzw. sprechen
        root.setOnClickListener {
            val st = LunaBus.current.state
            LunaService.send(this, if (st == LunaState.SPEAKING || st == LunaState.LISTENING || st == LunaState.THINKING) LunaService.ACTION_INTERRUPT else LunaService.ACTION_LISTEN)
        }
        setContentView(root)
    }

    override fun onResume() { super.onResume(); visible = true; LunaBus.add(this); maybeUnlock(intent) }

    override fun onNewIntent(intent: android.content.Intent) { super.onNewIntent(intent); setIntent(intent); maybeUnlock(intent) }

    /** Sperrschutz: Android-eigene Entsperr-Abfrage (Fingerabdruck/PIN) anzeigen. */
    private fun maybeUnlock(i: android.content.Intent?) {
        if (i?.getBooleanExtra(Unlock.EXTRA, false) != true) return
        i.removeExtra(Unlock.EXTRA)
        if (Build.VERSION.SDK_INT >= 26) getSystemService(android.app.KeyguardManager::class.java).requestDismissKeyguard(this, null)
    }
    override fun onPause() { visible = false; LunaBus.remove(this); ui.removeCallbacks(close); super.onPause() }

    override fun onLuna(s: LunaBus.Snapshot) {
        line.state = s.state; line.level = s.level
        userText.text = if (s.userText.isBlank()) "" else "„${s.userText}“"
        lunaText.text = s.lunaText
        ui.removeCallbacks(close)
        if (s.state == LunaState.WAITING || s.state == LunaState.OFF) ui.postDelayed(close, 4000)
    }

}

/** Die Stimm-Linie: mehrere überlagerte Sinuswellen, Hüllkurve in der Mitte, Leuchten. */
class VoiceLineView(c: Context) : View(c) {
    var state = LunaState.LISTENING
    var level = 0f
    private var t = 0f
    private var amp = 0f
    private val reduce = !ValueAnimator.areAnimatorsEnabled()
    private val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND }
    private val path = Path()

    override fun onDraw(c: Canvas) {
        if (!reduce) t += 0.016f
        val target = when (state) {
            LunaState.SPEAKING -> 0.35f + 0.65f * abs(sin(t * 7.1f)) * (0.55f + 0.45f * sin(t * 2.3f))
            LunaState.LISTENING -> 0.08f + level * 0.95f
            LunaState.THINKING -> 0.18f + 0.08f * sin(t * 4f)
            else -> 0.05f
        }
        amp += (target - amp) * 0.18f
        val col = when (state) { LunaState.LISTENING -> Ui.MINT; LunaState.THINKING -> Ui.VIOLET; LunaState.ERROR -> Ui.RED; else -> Ui.ICE }
        val w = width.toFloat(); val cy = height * 0.40f
        val d = resources.displayMetrics.density
        val shader = LinearGradient(0f, 0f, w, 0f, intArrayOf(Color.TRANSPARENT, col, Color.WHITE, col, Color.TRANSPARENT),
            floatArrayOf(0f, 0.25f, 0.5f, 0.75f, 1f), Shader.TileMode.CLAMP)
        for (layer in 0 until 3) {
            path.reset()
            val steps = 120
            for (s in 0..steps) {
                val f = s / steps.toFloat()
                val env = sin(f * PI.toFloat()).let { it * it }
                val y = cy + env * amp * d * 70f * (
                    sin(f * (14f + layer * 5f) - t * (6f + layer)) * 0.6f +
                    sin(f * (29f - layer * 4f) + t * (4.2f + layer * 0.7f)) * 0.3f +
                    sin(f * 7f - t * 2f + layer) * 0.2f) * (1f - layer * 0.25f)
                if (s == 0) path.moveTo(f * w, y) else path.lineTo(f * w, y)
            }
            p.shader = shader
            if (layer == 0) {
                p.strokeWidth = 7f * d; p.alpha = 70; p.maskFilter = BlurMaskFilter(8f * d, BlurMaskFilter.Blur.NORMAL)
                c.drawPath(path, p); p.maskFilter = null
            }
            p.strokeWidth = (if (layer == 0) 2.2f else 1.1f) * d; p.alpha = if (layer == 0) 255 else 110
            c.drawPath(path, p)
        }
        if (!reduce && isAttachedToWindow) postInvalidateOnAnimation()
    }
}

/** Fordert das Entsperren an (zeigt die Stimm-Linie über der Sperre und darüber Androids Entsperr-Dialog). */
object Unlock {
    const val EXTRA = "unlock"
    fun request(ctx: Context) {
        try {
            ctx.startActivity(android.content.Intent(ctx, AwakeActivity::class.java).putExtra(EXTRA, true)
                .addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK or android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP))
        } catch (_: Exception) {}
    }
}
