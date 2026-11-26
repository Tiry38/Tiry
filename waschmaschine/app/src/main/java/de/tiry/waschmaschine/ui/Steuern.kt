package de.tiry.waschmaschine.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.tiry.waschmaschine.logik.Texte
import de.tiry.waschmaschine.protokoll.GeraeteProfil

data class Auftrag(val name: String, val programm: Int, val optionen: Map<Int, Long>)

/** Programm + Temperatur + Schleudern + Endzeit. Was die Maschine nicht erlaubt, lehnt sie ab – die App sagt dann klar warum. */
@Composable
fun Steuern(profil: GeraeteProfil, fernstartErlaubt: Boolean, zurueck: () -> Unit, starten: (Auftrag) -> Unit, merken: (Auftrag) -> Unit) {
    val programme = profil.programme.mapNotNull { p -> profil.merkmale[p.uid]?.let { p to Texte.programm(it.name) } }.ifEmpty {
        profil.merkmale.filter { it.value.name.contains(".Program.") }.map { de.tiry.waschmaschine.protokoll.ProgrammInfo(it.key) to Texte.programm(it.value.name) }
    }
    var wahl by remember { mutableStateOf(0) }
    val tempUid = profil.merkmale.entries.firstOrNull { it.value.name.endsWith("Washer.Option.Temperature") }?.key
    val schlUid = profil.merkmale.entries.firstOrNull { it.value.name.endsWith("Washer.Option.SpinSpeed") }?.key
    val endUid = profil.uidVon("BSH.Common.Option.FinishInRelative")
    val temps = tempUid?.let { profil.merkmale[it]?.werte }?.entries?.map { it.key to Texte.temperatur(it.value) }.orEmpty()
    val schl = schlUid?.let { profil.merkmale[it]?.werte }?.entries?.map { it.key to Texte.schleudern(it.value) }.orEmpty()
    val enden = listOf(0L to "sofort", 2L to "in 2 h", 3L to "in 3 h", 4L to "in 4 h", 6L to "in 6 h", 8L to "in 8 h", 10L to "in 10 h")
    var t by remember { mutableStateOf(-1) }; var s by remember { mutableStateOf(-1) }; var e by remember { mutableStateOf(0) }

    fun auftrag(): Auftrag? {
        val (p, name) = programme.getOrNull(wahl) ?: return null
        val o = LinkedHashMap<Int, Long>()
        if (tempUid != null && t >= 0 && (p.optionen.isEmpty() || tempUid in p.optionen)) o[tempUid] = temps[t].first.toLong()
        if (schlUid != null && s >= 0 && (p.optionen.isEmpty() || schlUid in p.optionen)) o[schlUid] = schl[s].first.toLong()
        if (endUid != null && e > 0) o[endUid] = enden[e].first * 3600
        val titel = listOfNotNull(name, temps.getOrNull(t)?.second, schl.getOrNull(s)?.second).joinToString(" · ")
        return Auftrag(titel, p.uid, o)
    }

    Flaeche(Modifier.background(Farbe.Grund)) {
        Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Textaktion("← ZURÜCK", farbe = Farbe.Nebel, onClick = zurueck)
            }
            Text("Was\nwaschen\nwir?", style = Schrift.Riesig.copy(fontSize = 56.sp, lineHeight = 56.sp, letterSpacing = (-2).sp), modifier = Modifier.padding(top = 10.dp, bottom = 24.dp))
            Etikett("01", "Programm")
            Spacer(Modifier.height(4.dp))
            programme.forEachIndexed { i, (_, name) ->
                Row(Modifier.fillMaxWidth().defaultMinSize(minHeight = 52.dp).clickable(role = Role.RadioButton) { wahl = i }, verticalAlignment = Alignment.CenterVertically) {
                    Text((i + 1).toString().padStart(2, '0'), style = Schrift.Etikett.copy(color = if (i == wahl) Farbe.Akzent else Farbe.Nebel), modifier = Modifier.width(40.dp))
                    Text(name, style = Schrift.Mittel.copy(color = if (i == wahl) Farbe.Akzent else Farbe.Tinte, fontSize = if (i == wahl) 26.sp else 20.sp))
                }
            }
            if (temps.isNotEmpty()) {
                Spacer(Modifier.height(22.dp)); Etikett("02", "Temperatur")
                Auswahlzeile(listOf("Standard" to (t < 0)) + temps.mapIndexed { i, x -> x.second to (i == t) }) { t = it - 1 }
            }
            if (schl.isNotEmpty()) {
                Spacer(Modifier.height(14.dp)); Etikett("03", "Schleudern")
                Auswahlzeile(listOf("Standard" to (s < 0)) + schl.mapIndexed { i, x -> x.second to (i == s) }) { s = it - 1 }
            }
            if (endUid != null) {
                Spacer(Modifier.height(14.dp)); Etikett("04", "Fertig")
                Auswahlzeile(enden.mapIndexed { i, x -> x.second to (i == e) }) { e = it }
            }
            Spacer(Modifier.height(28.dp))
            if (!fernstartErlaubt) {
                Text("Fernstart ist an der Maschine aus. Wäsche rein, Tür zu, Programm am Drehwähler wählen und die Fernstart-Taste KURZ drücken (Symbol leuchtet). Öffnen der Tür, Ausschalten oder Stromausfall schalten ihn wieder aus.", style = Schrift.Text.copy(color = Farbe.Akzent))
                Spacer(Modifier.height(14.dp))
            }
            Haupttaste("Starten", aktiv = fernstartErlaubt) { auftrag()?.let(starten) }
            Spacer(Modifier.height(8.dp))
            Textaktion("ALS FAVORIT MERKEN", farbe = Farbe.Nebel) { auftrag()?.let(merken) }
            Spacer(Modifier.height(30.dp))
        }
    }
}
