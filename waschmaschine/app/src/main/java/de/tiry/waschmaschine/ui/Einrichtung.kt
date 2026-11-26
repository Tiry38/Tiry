package de.tiry.waschmaschine.ui

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import de.tiry.waschmaschine.logik.Status

/** Zustand der Einrichtung – von der Activity gesteuert. */
data class EinrichtungsStand(
    val schritt: Int = 1,
    val laeuft: Boolean = false,
    val meldung: String? = null,
    val fehler: String? = null,
)

@Composable
fun Einrichtung(
    stand: EinrichtungsStand,
    verbinden: () -> Unit,
    qrScannen: () -> Unit,
    dateiWaehlen: () -> Unit,
    spaeter: () -> Unit,
) {
    Flaeche(Modifier.background(Farbe.Grund)) {
        Box(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
            // Die Trommel als Fortschritt der Einrichtung: halb sichtbar, rechts angeschnitten
            Trommel(if (stand.laeuft) Status.LAEUFT else Status.AUS, if (stand.schritt == 1) 0.5f else 1f, null,
                Modifier.requiredSize(400.dp).align(Alignment.TopEnd).offset(x = 200.dp, y = (-175).dp))
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
                Spacer(Modifier.height(24.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("0${stand.schritt}", style = Schrift.Riesig.copy(fontSize = 120.sp, lineHeight = 110.sp, color = Farbe.Akzent))
                    Text(" / 02", style = Schrift.Etikett.copy(fontSize = 13.sp))
                }
                Spacer(Modifier.height(24.dp))
                if (stand.schritt == 1) {
                    Text("Wasch-\nmaschine\nverbinden", style = Schrift.Gross.copy(fontSize = 38.sp, lineHeight = 42.sp))
                    Spacer(Modifier.height(18.dp))
                    Text("Einmalig: Den Geräteschlüssel kennt nur BSH. Du meldest dich EIN Mal mit deinem Home-Connect-Konto an, die App holt den Schlüssel und spricht danach nur noch direkt mit der Maschine – ohne Cloud.",
                        style = Schrift.Text.copy(color = Farbe.Nebel), modifier = Modifier.fillMaxWidth(0.92f))
                    Spacer(Modifier.height(28.dp))
                    Haupttaste(if (stand.laeuft) "Einen Moment …" else "Waschmaschine verbinden", aktiv = !stand.laeuft, onClick = verbinden)
                } else {
                    Text("Von\nunterwegs", style = Schrift.Gross.copy(fontSize = 38.sp, lineHeight = 42.sp))
                    Spacer(Modifier.height(18.dp))
                    Text("FRITZ!Box öffnen → Internet → Freigaben → VPN (WireGuard) → Verbindung hinzufügen → Einzelgerät. Den angezeigten QR-Code hier scannen. Fertig.",
                        style = Schrift.Text.copy(color = Farbe.Nebel), modifier = Modifier.fillMaxWidth(0.92f))
                    Spacer(Modifier.height(28.dp))
                    Haupttaste(if (stand.laeuft) "Einen Moment …" else "FRITZ!Box-QR-Code scannen", aktiv = !stand.laeuft, onClick = qrScannen)
                    Spacer(Modifier.height(6.dp))
                    Row { Textaktion("KONFIG-DATEI WÄHLEN", farbe = Farbe.Nebel, onClick = dateiWaehlen); Spacer(Modifier.width(26.dp)); Textaktion("SPÄTER", farbe = Farbe.Nebel, onClick = spaeter) }
                }
                Spacer(Modifier.height(20.dp))
                stand.meldung?.let { Text(it, style = Schrift.Text) }
                stand.fehler?.let { Text(it, style = Schrift.Text.copy(color = Farbe.Akzent), modifier = Modifier.padding(top = 6.dp)) }
                Spacer(Modifier.height(30.dp))
            }
        }
    }
}

/** Einmalige Anmeldung im eingebetteten Browser; fängt den Rücksprung hcauth://… ab. */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun Anmeldung(adresse: String, abbrechen: () -> Unit, rueckgabe: (String) -> Unit) {
    Column(Modifier.fillMaxSize().background(Farbe.Grund).windowInsetsPadding(WindowInsets.safeDrawing)) {
        Row(Modifier.padding(horizontal = 20.dp), verticalAlignment = Alignment.CenterVertically) {
            Textaktion("← ABBRECHEN", farbe = Farbe.Nebel, onClick = abbrechen)
            Spacer(Modifier.width(16.dp))
            Text("EINMALIG ANMELDEN", style = Schrift.Etikett)
        }
        AndroidView(factory = { c ->
            WebView(c).apply {
                settings.javaScriptEnabled = true; settings.domStorageEnabled = true
                var fertig = false
                fun pruefe(url: String?): Boolean {
                    if (url != null && url.startsWith("hcauth:")) { if (!fertig) { fertig = true; rueckgabe(url) }; return true }
                    return false
                }
                webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) = pruefe(request.url.toString())
                    @Deprecated("alt") override fun shouldOverrideUrlLoading(view: WebView, url: String) = pruefe(url)
                    override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) { if (pruefe(url)) view.stopLoading() }
                }
                loadUrl(adresse)
            }
        }, modifier = Modifier.fillMaxSize())
    }
}
