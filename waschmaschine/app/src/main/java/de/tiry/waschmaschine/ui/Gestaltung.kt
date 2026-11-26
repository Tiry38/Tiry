package de.tiry.waschmaschine.ui

import android.content.Context
import android.provider.Settings
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.ImageShader
import androidx.compose.ui.graphics.ShaderBrush
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import de.tiry.waschmaschine.R
import kotlin.random.Random

/**
 * Gestaltung „Bullauge bei Nacht“: ein Grundton (Nachtwasser, oklch ≈ 0.15 0.015 245)
 * und EIN radikaler Akzent (Laugen-Gelbgrün, oklch ≈ 0.94 0.21 125). Farbe ist Ereignis, nicht Tapete.
 */
object Farbe {
    val Grund = Color(0xFF0A0F14)
    val Tiefe = Color(0xFF060A0E)
    val Linie = Color(0xFF1E2A35)
    val Tinte = Color(0xFFEAF0F3)      // 16.9:1 auf Grund
    val Nebel = Color(0xFF8D9BA8)      // 6.9:1 auf Grund
    val Akzent = Color(0xFFD4FF3A)     // 16.2:1 auf Grund
    val AufAkzent = Color(0xFF0A0F14)
}

@OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)
object Schrift {
    private fun unb(w: Int) = Font(R.font.unbounded, FontWeight(w), variationSettings = FontVariation.Settings(FontVariation.weight(w)))
    val Display = FontFamily(unb(300), unb(500), unb(800))
    private fun mono(w: Int) = Font(R.font.mono, FontWeight(w), variationSettings = FontVariation.Settings(FontVariation.weight(w)))
    val Mono = FontFamily(mono(400), mono(700))

    val Riesig = TextStyle(fontFamily = Display, fontWeight = FontWeight(800), fontSize = 168.sp, lineHeight = 150.sp, letterSpacing = (-8).sp, color = Farbe.Tinte)
    val Gross = TextStyle(fontFamily = Display, fontWeight = FontWeight(500), fontSize = 30.sp, lineHeight = 34.sp, letterSpacing = (-1).sp, color = Farbe.Tinte)
    val Mittel = TextStyle(fontFamily = Display, fontWeight = FontWeight(300), fontSize = 20.sp, lineHeight = 26.sp, color = Farbe.Tinte)
    val Etikett = TextStyle(fontFamily = Mono, fontWeight = FontWeight(700), fontSize = 11.sp, letterSpacing = 2.2.sp, color = Farbe.Nebel)
    val Text = TextStyle(fontFamily = Mono, fontWeight = FontWeight(400), fontSize = 14.sp, lineHeight = 21.sp, color = Farbe.Tinte)
}

/** Reduzierte Bewegung: Animationen in den Android-Einstellungen aus? */
fun Context.wenigBewegung(): Boolean =
    Settings.Global.getFloat(contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f

@Composable
fun wenigBewegung(): Boolean { val c = LocalContext.current; return remember { c.wenigBewegung() } }

/** Feines Korn über allem – Material statt glatter Fläche. */
private val korn: ImageBitmap by lazy {
    val n = 128; val r = Random(7)
    val px = IntArray(n * n) { val v = r.nextInt(256); (r.nextInt(18) shl 24) or (v shl 16) or (v shl 8) or v }
    android.graphics.Bitmap.createBitmap(px, n, n, android.graphics.Bitmap.Config.ARGB_8888).asImageBitmap()
}

fun Modifier.korn(): Modifier = drawWithCache {
    val b = ShaderBrush(ImageShader(korn, TileMode.Repeated, TileMode.Repeated))
    onDrawWithContent { drawContent(); drawRect(b) }
}

@Composable
fun Flaeche(modifier: Modifier = Modifier, inhalt: @Composable () -> Unit) {
    Box(modifier.fillMaxSize().korn()) { inhalt() }
}
