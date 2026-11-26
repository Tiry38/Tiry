package de.tiry.waschmaschine.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
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
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class UnterwegsAktionen(
    val fritzBoxOeffnen: () -> Unit = {},
    val qrScannen: () -> Unit = {},
    val dateiWaehlen: () -> Unit = {},
    val spaeter: () -> Unit = {},
)

private val titel = listOf("Ist die Box erreichbar?", "MyFRITZ! einschalten", "WireGuard-Zugang anlegen", "QR-Code scannen")

/** 02 · Von unterwegs – die komplette FRITZ!Box-Einrichtung geführt in der App. */
@Composable
fun UnterwegsAssistent(stand: EinrichtungsStand, start: Int = 0, aktionen: UnterwegsAktionen) {
    var schritt by remember { mutableIntStateOf(start) }
    Flaeche(Modifier.background(Farbe.Grund)) {
        Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
            Spacer(Modifier.height(18.dp))
            Row(verticalAlignment = Alignment.Bottom) {
                Text("02", style = Schrift.Riesig.copy(fontSize = 84.sp, lineHeight = 80.sp, color = Farbe.Akzent))
                Text(" / 02", style = Schrift.Etikett.copy(fontSize = 13.sp), modifier = Modifier.padding(bottom = 12.dp))
            }
            Text("VON UNTERWEGS", style = Schrift.Etikett.copy(color = Farbe.Tinte), modifier = Modifier.padding(top = 4.dp))
            Spacer(Modifier.height(16.dp))
            Fortschrittsbahn(listOf("E", "F", "G", "H"), titel[schritt], schritt) { schritt = it }
            Spacer(Modifier.height(20.dp))
            stand.meldung?.let { Text(it, style = Schrift.Text, modifier = Modifier.padding(bottom = 12.dp)) }
            AnimatedContent(schritt, transitionSpec = { (slideInHorizontally(spring(0.85f, 380f)) { it / 6 } + fadeIn()) togetherWith fadeOut() }, label = "unterwegs") { t ->
                Column {
                    Text("Am besten am PC oder Tablet im Heim-WLAN – die FRITZ!Box-Oberfläche ist dort größer. Das Handy brauchst du erst in Schritt H.", style = Schrift.Text.copy(color = Farbe.Nebel, fontSize = 13.sp))
                    Spacer(Modifier.height(14.dp))
                    when (t) {
                        0 -> {
                            Pfad("fritz.box", "Internet", "Online-Monitor")
                            Anweisung(1, "Unten **FRITZ!Box öffnen**, mit dem FRITZ!Box-Kennwort anmelden (steht auf der Unterseite der Box, falls nie geändert).")
                            Anweisung(2, "Links **Internet → Online-Monitor** öffnen.")
                            Anweisung(3, "Bei **IPv4** steht eine normale Adresse (nicht 100.64… bis 100.127…)? **Perfekt** – weiter.")
                            Anweisung(4, "Steht dort **DS-Lite** oder **100.64…**: Es geht nur über **IPv6**. Das klappt mit den meisten Handynetzen (Telekom, Vodafone, o2). Einfach weitermachen – beim Test von unterwegs sehen wir es.")
                            Spacer(Modifier.height(8.dp)); Textaktion("FRITZ!BOX ÖFFNEN ↗", farbe = Farbe.Akzent, onClick = aktionen.fritzBoxOeffnen)
                            Spacer(Modifier.height(18.dp)); Haupttaste("Geprüft – weiter") { schritt = 1 }
                        }
                        1 -> {
                            Pfad("fritz.box", "Internet", "MyFRITZ!-Konto")
                            Anweisung(1, "**Internet → MyFRITZ!-Konto** öffnen.")
                            Anweisung(2, "Steht dort schon **„MyFRITZ!-Konto ist eingerichtet“** mit einer Adresse **…myfritz.net**? Dann fertig – weiter.")
                            Anweisung(3, "Sonst: **E-Mail-Adresse** eintragen → **Übernehmen**. Die Box schickt eine Mail → den Link darin anklicken und ein MyFRITZ!-Kennwort festlegen.")
                            Anweisung(4, "Zurück in der Box: Unter MyFRITZ! steht jetzt eine Adresse wie **abcd1234efgh5678.myfritz.net**. Die nutzt die App automatisch – nichts abschreiben.")
                            Spacer(Modifier.height(8.dp)); Textaktion("FRITZ!BOX ÖFFNEN ↗", farbe = Farbe.Akzent, onClick = aktionen.fritzBoxOeffnen)
                            Spacer(Modifier.height(18.dp)); Haupttaste("MyFRITZ! läuft – weiter") { schritt = 2 }
                        }
                        2 -> {
                            Pfad("fritz.box", "Internet", "Freigaben", "VPN (WireGuard)")
                            Anweisung(1, "**Internet → Freigaben → Reiter „VPN (WireGuard)“** öffnen.")
                            Anweisung(2, "**„Verbindung hinzufügen“** antippen → **„Einzelgerät verbinden“** wählen → **Weiter**.")
                            Anweisung(3, "Als Name **Waschmaschine-Handy** eintragen → **Fertigstellen**.")
                            Anweisung(4, "Fragt die Box nach einer **Bestätigung**: kurz eine Taste an der FRITZ!Box drücken (die Box sagt, welche) – das ist ihr Schutz gegen Fremde.")
                            Anweisung(5, "Jetzt zeigt die Box einen **QR-Code**. Fenster **offen lassen** – weiter zu H.")
                            Spacer(Modifier.height(8.dp)); Textaktion("FRITZ!BOX ÖFFNEN ↗", farbe = Farbe.Akzent, onClick = aktionen.fritzBoxOeffnen)
                            Spacer(Modifier.height(18.dp)); Haupttaste("QR-Code ist zu sehen – weiter") { schritt = 3 }
                        }
                        else -> {
                            Anweisung(1, "Unten **„QR-Code scannen“** antippen und den Code auf dem Bildschirm abfilmen.")
                            Anweisung(2, "Android fragt **„Verbindungsanfrage – VPN“** → **OK**. Das ist der eingebaute Tunnel – er leitet **nur** Verkehr dieser App ins Heimnetz, sonst nichts.")
                            Anweisung(3, "Fertig. Oben steht ab jetzt **ZUHAUSE** oder **UNTERWEGS** – die App wählt selbst.")
                            Spacer(Modifier.height(18.dp))
                            Haupttaste(if (stand.laeuft) "Einen Moment …" else "QR-Code scannen", aktiv = !stand.laeuft, onClick = aktionen.qrScannen)
                            Spacer(Modifier.height(6.dp))
                            Row { Textaktion("KONFIG-DATEI WÄHLEN", farbe = Farbe.Nebel, onClick = aktionen.dateiWaehlen); Spacer(Modifier.width(26.dp)); Textaktion("SPÄTER", farbe = Farbe.Nebel, onClick = aktionen.spaeter) }
                            Spacer(Modifier.height(18.dp))
                            Etikett("+", "Tipp für schnelleres Verbinden")
                            Hinweis("In der Box **Heimnetz → Netzwerk** → bei der Waschmaschine auf den **Stift** → **„Diesem Netzwerkgerät immer die gleiche IPv4-Adresse zuweisen“** anhaken → OK. Dann findet die App sie von unterwegs sofort.")
                        }
                    }
                    stand.fehler?.let { Text(it, style = Schrift.Text.copy(color = Farbe.Akzent), modifier = Modifier.padding(top = 12.dp)) }
                    Spacer(Modifier.height(30.dp))
                }
            }
        }
    }
}

@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
/** Klickpfad als Kette – so wie er in der FRITZ!Box-Oberfläche aussieht. */
@Composable
private fun Pfad(vararg teile: String) {
    androidx.compose.foundation.layout.FlowRow(Modifier.fillMaxWidth().padding(bottom = 10.dp), verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(6.dp)) {
        teile.forEachIndexed { i, t ->
            Text(t, style = Schrift.Etikett.copy(color = if (i == teile.lastIndex) Farbe.AufAkzent else Farbe.Tinte, fontSize = 12.sp),
                modifier = Modifier.then(if (i == teile.lastIndex) Modifier.background(Farbe.Akzent) else Modifier.border(1.dp, Farbe.Linie)).padding(horizontal = 10.dp, vertical = 8.dp))
            if (i < teile.lastIndex) Text("  →  ", style = Schrift.Etikett.copy(color = Farbe.Akzent), modifier = Modifier.padding(top = 8.dp))
        }
    }
}
