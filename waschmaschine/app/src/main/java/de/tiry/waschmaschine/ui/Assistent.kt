package de.tiry.waschmaschine.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/** Teilschritte von „01 · Waschmaschine verbinden“. Tasten/Anzeigen exakt nach der Gebrauchsanleitung WM14UR5EM2, Kap. 15. */
enum class Teilschritt(val buchstabe: String, val titel: String) {
    FRAGE("A", "Schon gekoppelt?"),
    WLAN("B", "Maschine ins WLAN"),
    KOPPELN("C", "Einmal mit Konto koppeln"),
    SCHLUESSEL("D", "Schlüssel holen"),
}

data class AssistentAktionen(
    val fritzBoxOeffnen: () -> Unit = {},
    val homeConnectApp: () -> Unit = {},
    val schluesselHolen: () -> Unit = {},
    val anleitungPdf: () -> Unit = {},
)

@Composable
fun Assistent(
    stand: EinrichtungsStand,
    start: Teilschritt = Teilschritt.FRAGE,
    imWlanGefunden: String?,
    sucht: Boolean,
    aktionen: AssistentAktionen,
) {
    var schritt by remember { mutableStateOf(start) }
    Flaeche(Modifier.background(Farbe.Grund)) {
        Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
            Spacer(Modifier.height(18.dp))
            Row(verticalAlignment = Alignment.Bottom) {
                Text("01", style = Schrift.Riesig.copy(fontSize = 84.sp, lineHeight = 80.sp, color = Farbe.Akzent))
                Text(" / 02", style = Schrift.Etikett.copy(fontSize = 13.sp), modifier = Modifier.padding(bottom = 12.dp))
            }
            Text("WASCHMASCHINE VERBINDEN", style = Schrift.Etikett.copy(color = Farbe.Tinte), modifier = Modifier.padding(top = 4.dp))
            Spacer(Modifier.height(16.dp))
            Fortschrittsbahn(Teilschritt.entries.map { it.buchstabe }, schritt.titel, schritt.ordinal) { schritt = Teilschritt.entries[it] }
            Spacer(Modifier.height(22.dp))
            AnimatedContent(schritt, transitionSpec = { (slideInHorizontally(spring(0.85f, 380f)) { it / 6 } + fadeIn()) togetherWith fadeOut() }, label = "teil") { t ->
                Column {
                    when (t) {
                        Teilschritt.FRAGE -> {
                            Text("Ist die Maschine schon in deiner Home-Connect-App?", style = Schrift.Gross)
                            Spacer(Modifier.height(10.dp))
                            Text("Wenn du sie früher schon mal mit der Home-Connect-App eingerichtet hast: Ja. Sonst: Nein – ich führe dich durch alles.", style = Schrift.Text.copy(color = Farbe.Nebel))
                            Spacer(Modifier.height(24.dp))
                            Haupttaste("Nein, noch nicht", onClick = { schritt = Teilschritt.WLAN })
                            Spacer(Modifier.height(10.dp))
                            Haupttaste("Ja, ist gekoppelt", aktiv = true, onClick = { schritt = Teilschritt.SCHLUESSEL }, dunkel = true)
                        }
                        Teilschritt.WLAN -> {
                            Text("Ohne Passwort-Tippen: per WPS-Knopf der FRITZ!Box.", style = Schrift.Text.copy(color = Farbe.Nebel))
                            Spacer(Modifier.height(18.dp))
                            Maschinenbild(position = null, anzeige = "Aut")
                            Spacer(Modifier.height(18.dp))
                            Anweisung(1, "Maschine einschalten (Drehwähler auf irgendein Programm).")
                            Anweisung(2, "**Fernstart-Taste** (Symbol mit Funkwellen) **mindestens 3 Sekunden** drücken. Das Display zeigt **Aut**.")
                            Anweisung(3, "**Start/Pause** drücken. Das WLAN-Symbol im Display blinkt.")
                            Anweisung(4, "**Innerhalb von 2 Minuten** an der FRITZ!Box WPS starten: die **Connect/WPS-Taste** kurz drücken – oder unten „FRITZ!Box öffnen“ → **WLAN → Sicherheit → WPS-Schnellverbindung → WPS starten**.")
                            Anweisung(5, "Zeigt das Display dauerhaft **con**, ist die Maschine im WLAN.")
                            Spacer(Modifier.height(8.dp))
                            Textaktion("FRITZ!BOX ÖFFNEN ↗", farbe = Farbe.Akzent, onClick = aktionen.fritzBoxOeffnen)
                            Spacer(Modifier.height(14.dp))
                            Livepruefung(imWlanGefunden, sucht)
                            Spacer(Modifier.height(18.dp))
                            Haupttaste(if (imWlanGefunden != null) "Im WLAN – weiter" else "Display zeigt con – weiter", onClick = { schritt = Teilschritt.KOPPELN })
                            Spacer(Modifier.height(18.dp))
                            Etikett("?", "Klappt nicht")
                            Hinweis("Display zeigt „Home Connect Error“: Maschine ist zu weit vom WLAN weg oder WPS kam zu spät. Schritte 2–4 wiederholen.")
                            Hinweis("Display zeigt nicht Aut: WLAN an der Maschine ist aus. Fernstart-Taste 3 s → Drehwähler auf **4** → Display **Con** → Start/Pause drücken, bis **on** erscheint.")
                            Hinweis("Alles zurück auf Anfang: Fernstart-Taste 3 s → Drehwähler auf **5** → **rES** → Start/Pause → **Yes** → Start/Pause → **End**.")
                        }
                        Teilschritt.KOPPELN -> {
                            Text("Das ist der einzige Schritt, für den BSH ihre eigene App verlangt – nur dort lassen sich Konto und Maschine verbinden. Danach kannst du die Home-Connect-App wieder löschen.", style = Schrift.Text.copy(color = Farbe.Nebel))
                            Spacer(Modifier.height(18.dp))
                            Maschinenbild(position = 3, anzeige = "APP")
                            Spacer(Modifier.height(18.dp))
                            Anweisung(1, "**Home-Connect-App** laden und öffnen, Konto anlegen oder anmelden.")
                            Anweisung(2, "In der Home-Connect-App **„Hausgerät hinzufügen“** antippen.")
                            Anweisung(3, "An der Maschine: **Fernstart-Taste 3 Sekunden** drücken.")
                            Anweisung(4, "**Drehwähler auf Position 3** stellen. Das Display zeigt **APP**.")
                            Anweisung(5, "**Start/Pause** drücken. Sobald die Maschine in der Home-Connect-App erscheint, dort bestätigen.")
                            Anweisung(6, "Display zeigt **con** – gekoppelt. Zurück in diese App.")
                            Spacer(Modifier.height(8.dp))
                            Textaktion("HOME-CONNECT-APP ÖFFNEN / LADEN ↗", farbe = Farbe.Akzent, onClick = aktionen.homeConnectApp)
                            Spacer(Modifier.height(18.dp))
                            Haupttaste("Gekoppelt – weiter", onClick = { schritt = Teilschritt.SCHLUESSEL })
                        }
                        Teilschritt.SCHLUESSEL -> {
                            Text("Jetzt holt die App EINMAL den Geräteschlüssel. Danach spricht sie nur noch direkt mit der Maschine – ohne Cloud.", style = Schrift.Text.copy(color = Farbe.Nebel))
                            Spacer(Modifier.height(18.dp))
                            Anweisung(1, "Unten antippen und mit **denselben Zugangsdaten** wie in der Home-Connect-App anmelden.")
                            Anweisung(2, "Die App findet die Maschine im WLAN selbst – das Handy muss dafür **im Heim-WLAN** sein.")
                            Spacer(Modifier.height(18.dp))
                            Haupttaste(if (stand.laeuft) "Einen Moment …" else "Anmelden & Schlüssel holen", aktiv = !stand.laeuft, onClick = aktionen.schluesselHolen)
                        }
                    }
                    Spacer(Modifier.height(18.dp))
                    stand.meldung?.let { Text(it, style = Schrift.Text) }
                    stand.fehler?.let { Text(it, style = Schrift.Text.copy(color = Farbe.Akzent), modifier = Modifier.padding(top = 6.dp)) }
                    Spacer(Modifier.height(14.dp))
                    Textaktion("ANLEITUNG BEI SIEMENS (KAP. 15) ↗", farbe = Farbe.Nebel, onClick = aktionen.anleitungPdf)
                    Spacer(Modifier.height(30.dp))
                }
            }
        }
    }
}

/** Waagrechte Bahn: erledigte Knoten gefüllt, aktueller in Akzent. Antippen springt zurück. */
@Composable
fun Fortschrittsbahn(buchstaben: List<String>, titel: String, aktiv: Int, wahl: (Int) -> Unit) {
    Column {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            buchstaben.forEachIndexed { i, b ->
                val fertig = i < aktiv; val jetzt = i == aktiv
                Box(
                    Modifier.size(44.dp).then(if (jetzt) Modifier.background(Farbe.Akzent) else if (fertig) Modifier.background(Farbe.Linie) else Modifier.border(1.dp, Farbe.Linie))
                        .androidx_clickable(i <= aktiv) { wahl(i) },
                    contentAlignment = Alignment.Center,
                ) { Text(b, style = Schrift.Etikett.copy(fontSize = 14.sp, color = if (jetzt) Farbe.AufAkzent else Farbe.Tinte)) }
                if (i < buchstaben.size - 1) Box(Modifier.weight(1f).height(2.dp).background(if (fertig) Farbe.Akzent else Farbe.Linie))
            }
        }
        Spacer(Modifier.height(10.dp))
        Text(titel.uppercase(), style = Schrift.Etikett.copy(color = Farbe.Tinte))
    }
}

private fun Modifier.androidx_clickable(an: Boolean, onClick: () -> Unit) =
    this.clickable(enabled = an, role = androidx.compose.ui.semantics.Role.Tab, onClick = onClick)

@Composable
fun Anweisung(n: Int, text: String) {
    Row(Modifier.padding(vertical = 7.dp)) {
        Text(n.toString().padStart(2, '0'), style = Schrift.Etikett.copy(color = Farbe.Akzent, fontSize = 12.sp), modifier = Modifier.width(34.dp).padding(top = 3.dp))
        Text(fett(text), style = Schrift.Text.copy(fontSize = 15.sp, lineHeight = 22.sp))
    }
}

@Composable
fun Hinweis(text: String) {
    Text(fett(text), style = Schrift.Text.copy(color = Farbe.Nebel, fontSize = 13.sp, lineHeight = 19.sp), modifier = Modifier.padding(top = 8.dp))
}

/** **fett** → Akzent-Gewicht. */
private fun fett(t: String) = buildAnnotatedString {
    t.split("**").forEachIndexed { i, teil -> if (i % 2 == 1) withStyle(SpanStyle(fontWeight = FontWeight(700), color = Farbe.Tinte)) { append(teil) } else append(teil) }
}

@Composable
private fun Livepruefung(gefunden: String?, sucht: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Punkt(if (gefunden != null) Farbe.Akzent else Farbe.Nebel)
        Spacer(Modifier.width(10.dp))
        Text(
            when {
                gefunden != null -> "LIVE: HOME-CONNECT-GERÄT IM WLAN GEFUNDEN"
                sucht -> "LIVE: SUCHE IM WLAN …"
                else -> "LIVE: NOCH NICHTS IM WLAN"
            }, style = Schrift.Etikett.copy(color = if (gefunden != null) Farbe.Akzent else Farbe.Nebel),
        )
    }
    gefunden?.let { Text(it, style = Schrift.Text.copy(fontSize = 12.sp, color = Farbe.Nebel), modifier = Modifier.padding(start = 18.dp, top = 2.dp)) }
}

/**
 * Nachbau des Bedienfelds: Siebensegment-Anzeige wie am Gerät + Drehwähler, der per Feder auf die
 * gesuchte Position schnappt. So sieht man sofort, WAS an der Maschine zu tun ist.
 */
@Composable
fun Maschinenbild(position: Int?, anzeige: String, hoehe: Dp = 150.dp) {
    val winkel = remember { Animatable(-140f) }
    val ziel = position?.let { -100f + (it - 1) * 32f } ?: -140f
    LaunchedEffect(ziel) { winkel.animateTo(ziel, spring(dampingRatio = 0.38f, stiffness = 90f)) }
    Row(Modifier.fillMaxWidth().height(hoehe).background(Farbe.Tiefe).border(1.dp, Farbe.Linie), verticalAlignment = Alignment.CenterVertically) {
        Canvas(Modifier.weight(1f).fillMaxSize().padding(14.dp)) {
            val r = size.minDimension / 2f * 0.78f
            val m = Offset(size.width / 2f, size.height / 2f + r * 0.08f)
            // Positionen 1–8 auf dem Ring
            for (p in 1..8) {
                val w = Math.toRadians((-100.0 + (p - 1) * 32.0) - 90.0)
                val an = p == position
                drawCircle(if (an) Farbe.Akzent else Color(0x55EAF0F3), r * (if (an) 0.09f else 0.05f), m + Offset(cos(w).toFloat(), sin(w).toFloat()) * (r * 1.18f))
            }
            drawCircle(Color(0xFF1A242E), r, m)
            drawCircle(Color(0xFF3A4754), r, m, style = Stroke(r * 0.06f))
            val w = Math.toRadians(winkel.value - 90.0)
            drawLine(Farbe.Tinte, m, m + Offset(cos(w).toFloat(), sin(w).toFloat()) * (r * 0.82f), strokeWidth = r * 0.12f, cap = StrokeCap.Round)
            drawCircle(Farbe.Tiefe, r * 0.16f, m)
        }
        Canvas(Modifier.weight(1.25f).fillMaxSize().padding(vertical = 34.dp, horizontal = 10.dp)) { siebenSegment(anzeige) }
    }
    Row(Modifier.fillMaxWidth().padding(top = 6.dp)) {
        Text(if (position == null) "DREHWÄHLER: BELIEBIG" else "DREHWÄHLER: POSITION $position", style = Schrift.Etikett, modifier = Modifier.weight(1f))
        Text("DISPLAY: $anzeige", style = Schrift.Etikett.copy(color = Farbe.Akzent))
    }
}

/** Siebensegment-Zeichen (a b c d e f g). Klein-/Großschreibung wie am Gerät angenähert. */
private val segmente = mapOf(
    'A' to 0b1110111, 'u' to 0b0011100, 't' to 0b0001111, 'S' to 0b1011011, 'P' to 0b1100111, 'c' to 0b0001101,
    'o' to 0b0011101, 'n' to 0b0010101, 'C' to 0b1001110, 'r' to 0b0000101, 'E' to 0b1001111, 's' to 0b1011011,
    'Y' to 0b0111011, 'e' to 0b1101111, 'F' to 0b1000111, 'O' to 0b1111110, 'N' to 0b1110110, 'd' to 0b0111101,
)

private fun DrawScope.siebenSegment(text: String) {
    val n = text.length.coerceAtLeast(3)
    val zw = size.width / n
    val h = size.height; val b = zw * 0.66f; val dick = b * 0.16f
    text.forEachIndexed { i, ch ->
        val maske = segmente[ch] ?: 0
        val x0 = i * zw + (zw - b) / 2; val y0 = 0f; val sch = b * 0.12f // leichte Schräge wie echte LED
        fun p(x: Float, y: Float) = Offset(x0 + x + sch * (1 - y / h), y0 + y)
        val linien = listOf(
            p(0f, 0f) to p(b, 0f), p(b, 0f) to p(b, h / 2), p(b, h / 2) to p(b, h),
            p(0f, h) to p(b, h), p(0f, h / 2) to p(0f, h), p(0f, 0f) to p(0f, h / 2), p(0f, h / 2) to p(b, h / 2),
        )
        linien.forEachIndexed { s, (a, e) ->
            val an = maske and (1 shl (6 - s)) != 0
            drawLine(if (an) Farbe.Akzent else Color(0x14D4FF3A), a, e, strokeWidth = dick, cap = StrokeCap.Round)
        }
    }
}
