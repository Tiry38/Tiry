package de.tiry.luna

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Canvas
import android.view.View
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import org.robolectric.shadows.ShadowLooper
import java.io.File

/** Rendert die Bildschirme als PNG nach build/screens (nur zur Sichtprüfung, kein Pixelvergleich). */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w411dp-h891dp-xxhdpi")
class ScreenshotTest {
    private fun shot(a: Activity, name: String, scrollY: Int = 0) {
        ShadowLooper.idleMainLooper()
        val root: View = a.window.decorView
        val w = 1233; val h = 2673
        root.measure(View.MeasureSpec.makeMeasureSpec(w, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(h, View.MeasureSpec.EXACTLY))
        root.layout(0, 0, w, h)
        if (scrollY != 0) (root.findViewById<View>(android.R.id.content) as android.view.ViewGroup).let { c ->
            fun find(v: View): android.widget.ScrollView? = if (v is android.widget.ScrollView) v else (v as? android.view.ViewGroup)?.let { g -> (0 until g.childCount).firstNotNullOfOrNull { find(g.getChildAt(it)) } }
            find(c)?.scrollTo(0, scrollY)
        }
        repeat(40) { root.draw(Canvas(Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888))) } // Animation ein paar Frames laufen lassen
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        root.draw(Canvas(bmp))
        val out = File("build/screens/$name.png"); out.parentFile!!.mkdirs()
        out.outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    @Test fun hauptbildschirm() {
        val a = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        shot(a, "1-start")
        LunaBus.update { it.copy(state = LunaState.WAITING, status = "Bereit", userText = "", lunaText = "Hey Tiry, was gibt's?") }
        shot(a, "2-wartet")
        LunaBus.update { it.copy(state = LunaState.LISTENING, status = "Ich höre …", userText = "Wie wird das Wetter morgen in Wörth", level = 0.7f) }
        shot(a, "3-hoert")
        LunaBus.update { it.copy(state = LunaState.SPEAKING, status = "Spreche …", lunaText = "Morgen wird's in Wörth teils bewölkt bei vier bis neun Grad, Regenrisiko zwanzig Prozent. Perfekt für eine Runde mit dem E-Bike – nimm aber Handschuhe mit.") }
        shot(a, "4-spricht")
        LunaBus.update { it.copy(state = LunaState.THINKING, status = "Suche im Netz …") }
        shot(a, "5-denkt")
    }

    @Test fun einstellungen() {
        val a = Robolectric.buildActivity(SettingsActivity::class.java).setup().get()
        shot(a, "6-einstellungen")
        shot(a, "7-einstellungen-mitte", 2600)
        shot(a, "8-einstellungen-heimnetz", 6400)
        shot(a, "9-einstellungen-rechte", 11500)
    }
}
