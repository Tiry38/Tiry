package de.tiry.waschmaschine.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.spring
import androidx.compose.animation.togetherWith
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.tiry.waschmaschine.logik.Status
import de.tiry.waschmaschine.logik.Texte
import de.tiry.waschmaschine.logik.Tuer
import de.tiry.waschmaschine.logik.Weg
import de.tiry.waschmaschine.logik.WegEntscheidung
import de.tiry.waschmaschine.logik.Zustand
import de.tiry.waschmaschine.speicher.Favorit
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class StartAktionen(
    val pause: () -> Unit = {}, val fortsetzen: () -> Unit = {}, val abbrechen: () -> Unit = {},
    val steuern: () -> Unit = {}, val favorit: (Favorit) -> Unit = {}, val verlauf: () -> Unit = {}, val einstellungen: () -> Unit = {},
)

/** Oben immer sichtbar: Zuhause / Unterwegs. */
@Composable
fun Wegleiste(weg: WegEntscheidung, verbindet: Boolean, modell: String) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Punkt(if (weg.weg == Weg.KEINER) Farbe.Nebel else Farbe.Akzent)
            Spacer(Modifier.width(10.dp))
            Text((if (verbindet && weg.weg == Weg.KEINER) "VERBINDE …" else weg.weg.wort.uppercase()), style = Schrift.Etikett.copy(color = if (weg.weg == Weg.KEINER) Farbe.Nebel else Farbe.Tinte))
            Spacer(Modifier.weight(1f))
            Text(modell, style = Schrift.Etikett)
        }
        if (weg.weg == Weg.KEINER && weg.hinweis != null) {
            Text(weg.hinweis, style = Schrift.Text.copy(color = Farbe.Tinte, fontSize = 13.sp), modifier = Modifier.padding(top = 6.dp, start = 18.dp))
        }
    }
}

@Composable
fun Startseite(
    z: Zustand?, weg: WegEntscheidung, verbindet: Boolean, modell: String, favoriten: List<Favorit>,
    jetztMs: Long = System.currentTimeMillis(), aktionen: StartAktionen = StartAktionen(),
) {
    val status = z?.status ?: Status.AUS
    var sicher by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(false) }
    val abbruch: () -> Unit = { if (sicher) { sicher = false; aktionen.abbrechen() } else sicher = true }
    Flaeche(Modifier.background(Farbe.Grund)) {
        BoxWithConstraints(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
            val breite = maxWidth
            val durchm = breite * 1.18f
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                Wegleiste(weg, verbindet, modell)
                // Bühne: Trommel ragt rechts aus dem Bild, Zahl liegt darüber
                Box(Modifier.fillMaxWidth().height(durchm * 0.86f).clipToBounds()) {
                    Trommel(status, z?.fortschritt?.div(100f), z?.restSek,
                        Modifier.requiredSize(durchm).offset(x = breite * 0.30f, y = -durchm * 0.04f).align(Alignment.Center))
                    // Status senkrecht an der linken Kante
                    Text(status.wort.uppercase(), style = Schrift.Etikett.copy(color = if (status == Status.FEHLER || status == Status.FERTIG) Farbe.Akzent else Farbe.Tinte, fontSize = 13.sp, letterSpacing = 6.sp),
                        modifier = Modifier.align(Alignment.TopStart).padding(top = 90.dp).rotate(-90f).offset(x = (-30).dp))
                    // Riesige Restzeit
                    Column(Modifier.align(Alignment.BottomStart).padding(start = 20.dp)) {
                        val rest = z?.restSek?.takeIf { z.laeuftGerade && it > 0 }
                        AnimatedContent(rest?.let { (it + 59) / 60 }, transitionSpec = {
                            (slideInVertically(spring(0.7f, 300f)) { -it / 3 } + fadeIn()) togetherWith (slideOutVertically(spring(0.7f, 300f)) { it / 3 } + fadeOut())
                        }, label = "rest") { min ->
                            Row(verticalAlignment = Alignment.Bottom) {
                                Text(if (min == null) grosswort(status) else if (min >= 100) "${min / 60}h" else "$min", style = Schrift.Riesig.copy(fontSize = if (min == null) 64.sp else 168.sp, lineHeight = if (min == null) 70.sp else 150.sp))
                                if (min != null && min < 100) Text("MIN", style = Schrift.Etikett.copy(color = Farbe.Akzent, fontSize = 13.sp), modifier = Modifier.padding(bottom = 28.dp, start = 6.dp))
                            }
                        }
                    }
                }
                Column(Modifier.padding(horizontal = 20.dp)) {
                    val fertigUm = z?.fertigUm(jetztMs)
                    if (fertigUm != null) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("FERTIG UM", style = Schrift.Etikett)
                            Spacer(Modifier.width(12.dp))
                            Text(SimpleDateFormat("HH:mm", Locale.GERMANY).format(Date(fertigUm)), style = Schrift.Gross.copy(color = Farbe.Akzent))
                        }
                    }
                    z?.startInSek?.let { Text("Startet in ${Texte.dauer(it)}", style = Schrift.Mittel, modifier = Modifier.padding(top = 4.dp)) }
                    Spacer(Modifier.height(26.dp))
                    Etikett("01", "Programm")
                    Text(z?.programm ?: "—", style = Schrift.Gross, modifier = Modifier.padding(top = 6.dp))
                    // Eco 40-60 wählt die Temperatur selbst (Gerät zeigt „– –“) → keine Temperatur anzeigen
                    val details = listOfNotNull(z?.temperatur?.takeIf { z.programm != "Eco 40-60" }, z?.schleudern).joinToString("  /  ")
                    if (details.isNotEmpty()) Text(details, style = Schrift.Text.copy(color = Farbe.Nebel), modifier = Modifier.padding(top = 4.dp))
                    Spacer(Modifier.height(22.dp))
                    Row {
                        Column(Modifier.weight(1f)) {
                            Etikett("02", "Fortschritt")
                            Text(z?.fortschritt?.takeIf { z.laeuftGerade || z.status == Status.FERTIG }?.let { "$it %" } ?: "—", style = Schrift.Mittel, modifier = Modifier.padding(top = 6.dp))
                        }
                        Column(Modifier.weight(1f)) {
                            Etikett("03", "Tür")
                            Text(z?.tuer?.wort ?: "—", style = Schrift.Mittel.copy(color = if (z?.tuer == Tuer.OFFEN && status == Status.FERTIG) Farbe.Akzent else Farbe.Tinte), modifier = Modifier.padding(top = 6.dp))
                        }
                    }
                    if (!z?.fehler.isNullOrEmpty()) {
                        Spacer(Modifier.height(22.dp))
                        Etikett("!!", "Meldung", farbe = Farbe.Akzent)
                        z!!.fehler.forEach { Text(Texte.fehler(it), style = Schrift.Mittel.copy(color = Farbe.Akzent), modifier = Modifier.padding(top = 6.dp)) }
                    }
                    Spacer(Modifier.height(30.dp))
                    when (status) {
                        Status.LAEUFT -> Row(horizontalArrangement = Arrangement.spacedBy(28.dp)) {
                            Textaktion("PAUSE", onClick = aktionen.pause); Textaktion(if (sicher) "WIRKLICH ABBRECHEN?" else "ABBRECHEN", farbe = if (sicher) Farbe.Akzent else Farbe.Nebel, onClick = abbruch)
                        }
                        Status.PAUSE -> Row(horizontalArrangement = Arrangement.spacedBy(28.dp)) {
                            Textaktion("WEITER", farbe = Farbe.Akzent, onClick = aktionen.fortsetzen); Textaktion(if (sicher) "WIRKLICH ABBRECHEN?" else "ABBRECHEN", farbe = if (sicher) Farbe.Akzent else Farbe.Nebel, onClick = abbruch)
                        }
                        else -> Haupttaste("Programm wählen", aktiv = z != null, onClick = aktionen.steuern)
                    }
                    if (favoriten.isNotEmpty() && !status.let { it == Status.LAEUFT || it == Status.PAUSE }) {
                        Spacer(Modifier.height(30.dp))
                        Etikett("04", "Favoriten · ein Tipp")
                        favoriten.take(4).forEachIndexed { i, f ->
                            Row(Modifier.fillMaxWidth().padding(top = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                                Text("0${i + 1}", style = Schrift.Etikett.copy(color = Farbe.Akzent), modifier = Modifier.width(34.dp))
                                Textaktion(f.name, onClick = { aktionen.favorit(f) })
                            }
                        }
                    }
                    Spacer(Modifier.height(36.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(28.dp)) {
                        Textaktion("VERLAUF", farbe = Farbe.Nebel, onClick = aktionen.verlauf)
                        Textaktion("EINSTELLUNGEN", farbe = Farbe.Nebel, onClick = aktionen.einstellungen)
                    }
                    Spacer(Modifier.height(28.dp))
                }
            }
        }
    }
}

private fun grosswort(s: Status) = when (s) {
    Status.AUS -> "Aus."; Status.BEREIT -> "Bereit."; Status.FERTIG -> "Fertig."; Status.FEHLER -> "Stopp."
    Status.PAUSE -> "Pause."; Status.LAEUFT -> "Läuft."
}
