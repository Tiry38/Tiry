package de.tiry.waschmaschine

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import de.tiry.waschmaschine.cloud.SchluesselAbruf
import de.tiry.waschmaschine.kern.Planer
import de.tiry.waschmaschine.kern.Zentrale
import de.tiry.waschmaschine.logik.WireGuardImport
import de.tiry.waschmaschine.speicher.Favorit
import de.tiry.waschmaschine.speicher.TunnelDaten
import de.tiry.waschmaschine.ui.Anmeldung
import de.tiry.waschmaschine.ui.Auftrag
import de.tiry.waschmaschine.ui.Einrichtung
import de.tiry.waschmaschine.ui.EinrichtungsStand
import de.tiry.waschmaschine.ui.Einstellungen
import de.tiry.waschmaschine.ui.Farbe
import de.tiry.waschmaschine.ui.Schrift
import de.tiry.waschmaschine.ui.StartAktionen
import de.tiry.waschmaschine.ui.Startseite
import de.tiry.waschmaschine.ui.Steuern
import de.tiry.waschmaschine.ui.Verlauf
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

enum class Seite { START, STEUERN, VERLAUF, EINSTELLUNGEN, ANMELDUNG }

class MainActivity : ComponentActivity() {
    private val z by lazy { Zentrale.von(this) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { Wurzel() }
    }

    override fun onStart() { super.onStart(); z.start("oberflaeche") }
    override fun onStop() { super.onStop(); z.stop("oberflaeche") }

    @SuppressLint("BatteryLife")
    private fun akkuAusnahme() {
        val pm = getSystemService(PowerManager::class.java)
        if (!pm.isIgnoringBatteryOptimizations(packageName))
            runCatching { startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName"))) }
    }

    @Composable
    private fun Wurzel() {
        val ctx = LocalContext.current
        val scope = rememberCoroutineScope()
        var profil by remember { mutableStateOf(z.ablage.profil) }
        var tunnelDa by remember { mutableStateOf(z.ablage.tunnel != null) }
        var unterwegsFertig by remember { mutableStateOf(z.ablage.tunnel != null || z.ablage.unterwegsUebersprungen) }
        var seite by remember { mutableStateOf(Seite.START) }
        var stand by remember { mutableStateOf(EinrichtungsStand(schritt = if (profil == null) 1 else 2)) }
        var abruf by remember { mutableStateOf<SchluesselAbruf?>(null) }
        var popups by remember { mutableStateOf(z.ablage.popups) }
        var favoriten by remember { mutableStateOf(z.ablage.favoriten) }
        var fernstartFrage by remember { mutableStateOf<Auftrag?>(null) }
        var wartenderTunnel by remember { mutableStateOf<TunnelDaten?>(null) }
        val zustand by z.zustand.collectAsState()
        val weg by z.weg.collectAsState()
        val verbindet by z.verbindet.collectAsState()

        var absturz by remember { mutableStateOf(java.io.File(filesDir, "absturz.txt").takeIf { it.exists() }?.readText()) }
        absturz?.let { bericht ->
            de.tiry.waschmaschine.ui.Absturzbericht(bericht,
                kopieren = { getSystemService(android.content.ClipboardManager::class.java).setPrimaryClip(android.content.ClipData.newPlainText("Absturz", bericht)); Toast.makeText(ctx, "Kopiert – einfach an Claude schicken.", Toast.LENGTH_LONG).show() },
                weiter = { java.io.File(filesDir, "absturz.txt").delete(); absturz = null })
            return
        }

        val benachrichtigung = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { akkuAusnahme() }

        fun tunnelSpeichern(t: TunnelDaten) {
            z.ablage.tunnel = t; tunnelDa = true; unterwegsFertig = true
            stand = stand.copy(laeuft = false, meldung = "Unterwegs eingerichtet: ${t.endpunkt}. Heimnetz ${t.heimnetze.joinToString()}.", fehler = null)
            z.neuVerbinden(); seite = Seite.START
        }
        val vpnZustimmung = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            val t = wartenderTunnel
            if (z.tunnel.zustimmungNoetig() == null && t != null) tunnelSpeichern(t)
            else stand = stand.copy(laeuft = false, fehler = "Ohne die VPN-Erlaubnis geht es unterwegs nicht. Bitte noch einmal und „OK“ tippen.")
        }
        fun importiere(text: String?) {
            if (text.isNullOrBlank()) { stand = stand.copy(laeuft = false); return }
            try {
                val e = WireGuardImport.alsSplitTunnel(text, packageName)
                val t = TunnelDaten(e.konfig, e.heimnetze, e.endpunkt)
                val i = z.tunnel.zustimmungNoetig()
                if (i == null) tunnelSpeichern(t) else { wartenderTunnel = t; vpnZustimmung.launch(i) }
            } catch (f: WireGuardImport.Fehler) { stand = stand.copy(laeuft = false, fehler = f.message) }
        }
        val qr = rememberLauncherForActivityResult(ScanContract()) { r -> importiere(r.contents) }
        val datei = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { u ->
            importiere(u?.let { runCatching { contentResolver.openInputStream(it)?.use { s -> s.readBytes().decodeToString() } }.getOrNull() })
        }
        fun scanne() {
            stand = stand.copy(fehler = null)
            qr.launch(ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE).setPrompt("QR-Code aus der FRITZ!Box").setBeepEnabled(false).setOrientationLocked(false))
        }

        BackHandler(seite != Seite.START) { seite = Seite.START }

        val einrichten = profil == null || !unterwegsFertig
        if (seite == Seite.ANMELDUNG && abruf != null) {
            Anmeldung(abruf!!.anmeldeAdresse, abbrechen = { seite = Seite.START; stand = stand.copy(laeuft = false) }) { url ->
                seite = Seite.START
                stand = stand.copy(laeuft = true, meldung = "Hole den Schlüssel …", fehler = null)
                scope.launch {
                    try {
                        val funde = withContext(Dispatchers.IO) { abruf!!.hole(abruf!!.codeAus(url)) }
                        val f = funde.firstOrNull { it.istWaschmaschine } ?: funde.firstOrNull()
                            ?: throw IllegalStateException("Im Konto ist keine Waschmaschine gekoppelt.")
                        stand = stand.copy(meldung = "Schlüssel da. Suche die Maschine im WLAN …")
                        val adr = withTimeoutOrNull(60_000) { z.suche.finde(f.profil) { m -> stand = stand.copy(meldung = m) } }
                        z.ablage.profil = f.profil.copy(adresse = adr)
                        profil = z.ablage.profil
                        Planer.regelmaessig(ctx)
                        stand = EinrichtungsStand(schritt = 2, meldung = if (adr != null) "Verbunden: ${f.profil.marke} ${f.profil.vib.ifEmpty { f.profil.typ }} unter $adr." else "Schlüssel gespeichert. Die Maschine ist gerade nicht im WLAN zu sehen – die App sucht sie automatisch weiter.")
                        if (Build.VERSION.SDK_INT >= 33) benachrichtigung.launch(Manifest.permission.POST_NOTIFICATIONS) else akkuAusnahme()
                        z.neuVerbinden()
                    } catch (t: Throwable) {
                        stand = stand.copy(laeuft = false, meldung = null, fehler = t.message ?: "Das hat nicht geklappt. Bitte noch einmal.")
                    }
                }
            }
            return
        }
        if (einrichten && seite != Seite.EINSTELLUNGEN) {
            Einrichtung(
                stand,
                verbinden = { abruf = SchluesselAbruf(); seite = Seite.ANMELDUNG },
                qrScannen = { scanne() },
                dateiWaehlen = { datei.launch(arrayOf("*/*")) },
                spaeter = { z.ablage.unterwegsUebersprungen = true; unterwegsFertig = true },
            )
            return
        }

        fun ausfuehren(a: Auftrag) {
            if (!z.befehl { it.starte(a.programm, a.optionen) }) Toast.makeText(ctx, "Keine Verbindung zur Maschine.", Toast.LENGTH_LONG).show()
            else { Toast.makeText(ctx, "Startbefehl gesendet: ${a.name}", Toast.LENGTH_SHORT).show(); seite = Seite.START }
        }
        fun starte(a: Auftrag) { if (!z.ablage.fernstartBestaetigt) fernstartFrage = a else ausfuehren(a) }

        fernstartFrage?.let { a ->
            AlertDialog(
                onDismissRequest = { fernstartFrage = null },
                containerColor = Farbe.Grund,
                title = { Text("Erster Fernstart", style = Schrift.Gross) },
                text = { Text("Die Maschine startet jetzt „${a.name}“ – ohne dass jemand davorsteht. Wäsche drin, Tür zu, Wasserhahn auf?", style = Schrift.Text) },
                confirmButton = { de.tiry.waschmaschine.ui.Textaktion("JA, STARTEN", farbe = Farbe.Akzent) { z.ablage.fernstartBestaetigt = true; fernstartFrage = null; ausfuehren(a) } },
                dismissButton = { de.tiry.waschmaschine.ui.Textaktion("NEIN", farbe = Farbe.Nebel) { fernstartFrage = null } },
            )
        }

        AnimatedContent(seite, transitionSpec = { (slideInHorizontally(spring(0.8f, 380f)) { it / 5 } + fadeIn()) togetherWith fadeOut() }, label = "seite") { s ->
            when (s) {
                Seite.STEUERN -> profil?.let { p -> Steuern(p, zustand?.fernstartErlaubt == true, { seite = Seite.START }, ::starte) { a ->
                    favoriten = (listOf(Favorit(a.name, a.programm, a.optionen)) + favoriten.filter { it.name != a.name }).take(6)
                    z.ablage.favoriten = favoriten; Toast.makeText(ctx, "Als Favorit gemerkt.", Toast.LENGTH_SHORT).show()
                } }
                Seite.VERLAUF -> Verlauf(z.ablage.verlauf) { seite = Seite.START }
                Seite.EINSTELLUNGEN -> Einstellungen(popups, { popups = it; z.ablage.popups = it }, { seite = Seite.START }, tunnelDa,
                    unterwegsEinrichten = { stand = EinrichtungsStand(schritt = 2); unterwegsFertig = false; seite = Seite.START },
                    geraetNeu = { z.ablage.profil = null; profil = null; z.abgemeldetLeeren(); stand = EinrichtungsStand(schritt = 1); seite = Seite.START },
                    adresse = profil?.adresse)
                else -> {
                    var jetzt by remember { mutableStateOf(System.currentTimeMillis()) }
                    LaunchedEffect(Unit) { while (true) { delay(20_000); jetzt = System.currentTimeMillis() } }
                    Startseite(zustand, weg, verbindet, profil?.vib?.ifEmpty { null } ?: profil?.typ ?: "", favoriten, jetzt, StartAktionen(
                        pause = { z.befehl { it.pause() } }, fortsetzen = { z.befehl { it.fortsetzen() } },
                        abbrechen = { z.befehl { it.abbrechen() } }, steuern = { seite = Seite.STEUERN },
                        favorit = { f -> starte(Auftrag(f.name, f.programmUid, f.optionen)) },
                        verlauf = { seite = Seite.VERLAUF }, einstellungen = { seite = Seite.EINSTELLUNGEN },
                    ))
                }
            }
        }
    }
}
