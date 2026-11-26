package de.tiry.waschmaschine.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.defaultMinSize
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.tiry.waschmaschine.logik.PopupArt
import de.tiry.waschmaschine.logik.PopupEinstellungen
import de.tiry.waschmaschine.speicher.VerlaufEintrag
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun Verlauf(eintraege: List<VerlaufEintrag>, zurueck: () -> Unit) {
    val tag = SimpleDateFormat("EE dd.MM.", Locale.GERMANY); val uhr = SimpleDateFormat("HH:mm", Locale.GERMANY)
    Flaeche(Modifier.background(Farbe.Grund)) {
        Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
            Textaktion("← ZURÜCK", farbe = Farbe.Nebel, onClick = zurueck)
            Text("Verlauf", style = Schrift.Riesig.copy(fontSize = 64.sp, lineHeight = 66.sp, letterSpacing = (-3).sp), modifier = Modifier.padding(vertical = 14.dp))
            if (eintraege.isEmpty()) Text("Noch kein Waschgang aufgezeichnet. Der erste fertige landet hier.", style = Schrift.Text.copy(color = Farbe.Nebel))
            eintraege.forEach { e ->
                Row(Modifier.fillMaxWidth().padding(vertical = 12.dp)) {
                    Column(Modifier.width(92.dp)) {
                        Text(tag.format(Date(e.endeMs)).uppercase(), style = Schrift.Etikett)
                        Text(uhr.format(Date(e.endeMs)), style = Schrift.Text.copy(color = Farbe.Akzent))
                    }
                    Column(Modifier.weight(1f)) {
                        Text(e.programm, style = Schrift.Mittel)
                        val d = e.startMs?.let { ((e.endeMs - it) / 60000).toString() + " min" }
                        Text(listOfNotNull(e.temperatur, e.schleudern, d).joinToString("  /  "), style = Schrift.Text.copy(color = Farbe.Nebel, fontSize = 12.sp))
                    }
                }
                Box(Modifier.fillMaxWidth().height(1.dp).background(Farbe.Linie))
            }
            Spacer(Modifier.height(30.dp))
        }
    }
}

@Composable
fun Einstellungen(
    e: PopupEinstellungen, aendern: (PopupEinstellungen) -> Unit, zurueck: () -> Unit,
    unterwegsEingerichtet: Boolean, unterwegsEinrichten: () -> Unit, geraetNeu: () -> Unit, adresse: String?,
) {
    Flaeche(Modifier.background(Farbe.Grund)) {
        Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
            Textaktion("← ZURÜCK", farbe = Farbe.Nebel, onClick = zurueck)
            Text("Pop-ups", style = Schrift.Riesig.copy(fontSize = 64.sp, lineHeight = 66.sp, letterSpacing = (-3).sp), modifier = Modifier.padding(vertical = 14.dp))
            Schalter("Wäsche ist fertig", e.fertig) { aendern(e.copy(fertig = it)) }
            Schalter("Wäsche liegt seit 30 Minuten drin", e.waescheWartet) { aendern(e.copy(waescheWartet = it)) }
            Schalter("Fehler mit Klartext", e.fehler) { aendern(e.copy(fehler = it)) }
            Schalter("Verbindung verloren", e.verbindungWeg) { aendern(e.copy(verbindungWeg = it)) }
            Schalter("Noch 10 Minuten", e.nochZehn) { aendern(e.copy(nochZehn = it)) }
            Spacer(Modifier.height(30.dp))
            Etikett("01", "Verbindung")
            Text("Maschine im Heimnetz: ${adresse ?: "wird gesucht"}", style = Schrift.Text, modifier = Modifier.padding(top = 8.dp))
            Text(if (unterwegsEingerichtet) "Unterwegs: eingerichtet (WireGuard zur FRITZ!Box, nur Heimnetz, nur diese App)." else "Unterwegs: noch nicht eingerichtet.", style = Schrift.Text.copy(color = Farbe.Nebel), modifier = Modifier.padding(top = 4.dp))
            Spacer(Modifier.height(8.dp))
            Textaktion(if (unterwegsEingerichtet) "FRITZ!BOX-QR NEU SCANNEN" else "UNTERWEGS EINRICHTEN", onClick = unterwegsEinrichten)
            Textaktion("MASCHINE NEU KOPPELN", farbe = Farbe.Nebel, onClick = geraetNeu)
            Spacer(Modifier.height(30.dp))
        }
    }
}

@Composable
private fun Schalter(text: String, an: Boolean, wechsel: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().defaultMinSize(minHeight = 56.dp).clickable(role = Role.Switch) { wechsel(!an) }, verticalAlignment = Alignment.CenterVertically) {
        Text(text, style = Schrift.Mittel.copy(fontSize = 18.sp, color = if (an) Farbe.Tinte else Farbe.Nebel), modifier = Modifier.weight(1f))
        // Schalter als Schieber-Schlitz: Rechteck, kein Pillenknopf
        Box(Modifier.size(width = 52.dp, height = 22.dp).background(if (an) Farbe.Akzent else Farbe.Linie), contentAlignment = if (an) Alignment.CenterEnd else Alignment.CenterStart) {
            Box(Modifier.padding(3.dp).size(16.dp).background(if (an) Farbe.AufAkzent else Farbe.Nebel))
        }
    }
}

/** Nach einem Absturz: Grund anzeigen, mit einem Tipp kopierbar. */
@Composable
fun Absturzbericht(bericht: String, kopieren: () -> Unit, weiter: () -> Unit) {
    Flaeche(Modifier.background(Farbe.Grund)) {
        Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
            Spacer(Modifier.height(20.dp))
            Text("Abge-\nstürzt.", style = Schrift.Riesig.copy(fontSize = 56.sp, lineHeight = 58.sp, letterSpacing = (-2).sp, color = Farbe.Akzent))
            Text("Beim letzten Mal ist die App abgestürzt. Den Bericht kopieren und an Claude schicken – dann ist der Fehler schnell behoben.", style = Schrift.Text, modifier = Modifier.padding(vertical = 14.dp))
            Haupttaste("Bericht kopieren", onClick = kopieren)
            Textaktion("WEITER ZUR APP", farbe = Farbe.Nebel, onClick = weiter)
            Spacer(Modifier.height(16.dp))
            Text(bericht, style = Schrift.Text.copy(fontSize = 11.sp, lineHeight = 15.sp, color = Farbe.Nebel))
            Spacer(Modifier.height(30.dp))
        }
    }
}
