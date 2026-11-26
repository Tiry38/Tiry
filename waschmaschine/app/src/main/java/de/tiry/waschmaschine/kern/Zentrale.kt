package de.tiry.waschmaschine.kern

import android.content.Context
import de.tiry.waschmaschine.logik.PopupRegeln
import de.tiry.waschmaschine.logik.Status
import de.tiry.waschmaschine.logik.Weg
import de.tiry.waschmaschine.logik.WegEntscheidung
import de.tiry.waschmaschine.logik.Wegwahl
import de.tiry.waschmaschine.logik.Zustand
import de.tiry.waschmaschine.netz.Netz
import de.tiry.waschmaschine.netz.Suche
import de.tiry.waschmaschine.netz.Tunnel
import de.tiry.waschmaschine.protokoll.Maschine
import de.tiry.waschmaschine.speicher.Ablage
import de.tiry.waschmaschine.speicher.VerlaufEintrag
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import javax.net.SocketFactory

/**
 * Herz der App: hält EINE Verbindung zur Maschine (für Oberfläche und Hintergrund gemeinsam),
 * wählt Zuhause/Unterwegs, baut nach Abbrüchen selbst neu auf und wertet jeden Zustand für Pop-ups aus.
 */
class Zentrale private constructor(private val ctx: Context) {
    val ablage = Ablage(ctx)
    val netz = Netz(ctx)
    val suche = Suche(ctx, netz)
    val tunnel = Tunnel(ctx)
    val melder = Melder(ctx)

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val _zustand = MutableStateFlow<Zustand?>(null)
    val zustand: StateFlow<Zustand?> = _zustand
    private val _weg = MutableStateFlow(WegEntscheidung(Weg.KEINER, null))
    val weg: StateFlow<WegEntscheidung> = _weg
    private val _verbindet = MutableStateFlow(false)
    val verbindet: StateFlow<Boolean> = _verbindet

    @Volatile var maschine: Maschine? = null; private set
    private val nutzer = HashSet<String>()
    private var schleife: Job? = null

    @Synchronized fun start(wer: String) {
        nutzer += wer
        if (schleife?.isActive != true) schleife = scope.launch { halteVerbunden() }
    }

    @Synchronized fun stop(wer: String) {
        nutzer -= wer
        if (nutzer.isEmpty()) {
            schleife?.cancel(); schleife = null
            maschine?.close(); maschine = null
            scope.launch { tunnel.runter() }
        }
    }

    /** Sofort neu verbinden (z. B. nach Netzwechsel). */
    fun neuVerbinden() { maschine?.close() }

    private suspend fun halteVerbunden() {
        var pause = 3_000L
        while (scope.isActive) {
            val p = ablage.profil ?: run { delay(2_000); null } ?: continue
            _verbindet.value = true
            val m = runCatching { verbinde(p) }.getOrNull()
            _verbindet.value = false
            if (m == null) {
                bewerteOhneKontakt(_weg.value.hinweis ?: "Die Maschine antwortet nicht. Ich versuche es weiter.")
                delay(pause); pause = (pause * 2).coerceAtMost(60_000); continue
            }
            pause = 3_000L
            maschine = m
            val beobachter = scope.launch { m.zustand.collect { z -> if (z != null) { _zustand.value = z; bewerte(z) } } }
            while (m.offen && scope.isActive) delay(1_000)
            beobachter.cancel(); maschine = null
            bewerteOhneKontakt("Verbindung zur Waschmaschine abgerissen. Ich baue sie automatisch neu auf.")
        }
    }

    private suspend fun verbinde(p: de.tiry.waschmaschine.protokoll.GeraeteProfil): Maschine? = withContext(Dispatchers.IO) {
        var adresse = p.adresse
        val td = ablage.tunnel
        val wahl = Wegwahl(
            imWlan = netz::imWlan,
            direktErreichbar = {
                val s = netz.wlanSockets() ?: SocketFactory.getDefault()
                if (adresse != null && Netz.erreichbar(adresse!!, p.port, 1200, s)) true
                else runBlocking { withTimeoutOrNull(25_000) { suche.finde(p) } }?.also { adresse = it; merkeAdresse(it) } != null
            },
            tunnelEingerichtet = { td != null },
            tunnelHoch = { runBlocking { tunnel.istOben || tunnel.hoch(td!!.konfig) } },
            ueberTunnelErreichbar = {
                if (adresse != null && Netz.erreichbar(adresse!!, p.port, 4000)) true
                else runBlocking { withTimeoutOrNull(40_000) { suche.findeUeberTunnel(p, td!!.heimnetze) } }?.also { adresse = it; merkeAdresse(it) } != null
            },
            hatInternet = netz::hatInternet,
        )
        val e = wahl.waehle()
        _weg.value = e
        if (e.weg == Weg.ZUHAUSE && tunnel.istOben) tunnel.runter()
        val a = adresse ?: return@withContext null
        when (e.weg) {
            Weg.ZUHAUSE -> Maschine.verbinde(p, a, netz.wlanSockets() ?: SocketFactory.getDefault())
            Weg.UNTERWEGS -> Maschine.verbinde(p, a, SocketFactory.getDefault(), 6000)
            Weg.KEINER -> null
        }?.also { m ->
            if (m.warteAufZustand(15_000) == null) { m.close(); _weg.value = WegEntscheidung(Weg.KEINER, "Die Maschine hat die Verbindung abgelehnt. Schlüssel neu holen unter Einstellungen."); return@withContext null }
        }
    }

    private fun merkeAdresse(a: String) { ablage.profil?.let { if (it.adresse != a) ablage.profil = it.copy(adresse = a) } }

    @Synchronized private fun bewerte(z: Zustand) {
        val jetzt = System.currentTimeMillis()
        val alt = ablage.laufbuch
        val r = PopupRegeln.neuerZustand(alt, z, jetzt, ablage.popups)
        ablage.laufbuch = r.buch
        r.popups.forEach(melder::zeige)
        if (r.buch.gemeldetFertig && !alt.gemeldetFertig) {
            ablage.verlauf = listOf(VerlaufEintrag(r.buch.programm ?: z.programm ?: "Waschgang", alt.laufStartMs, jetzt, z.temperatur, z.schleudern)) + ablage.verlauf
        }
        Planer.plane(ctx, PopupRegeln.naechstePruefungMs(r.buch, z, jetzt))
        if (z.laeuftGerade) Planer.begleite(ctx)
    }

    @Synchronized private fun bewerteOhneKontakt(grund: String) {
        val r = PopupRegeln.keinKontakt(ablage.laufbuch, System.currentTimeMillis(), grund, ablage.popups)
        ablage.laufbuch = r.buch
        r.popups.forEach(melder::zeige)
    }

    /** Für den Hintergrund: einmal verbinden und den ersten Zustand abwarten. */
    suspend fun warteAufZustand(ms: Long): Zustand? = withTimeoutOrNull(ms) {
        maschine?.zustand?.value?.let { return@withTimeoutOrNull it }
        _zustand.value = null
        _zustand.first { it != null }
    }

    fun befehl(aktion: (Maschine) -> Unit): Boolean {
        val m = maschine ?: return false
        return runCatching { aktion(m) }.isSuccess
    }

    fun abgemeldetLeeren() { _zustand.value = null }

    companion object {
        @Volatile private var ich: Zentrale? = null
        fun von(ctx: Context): Zentrale = ich ?: synchronized(this) { ich ?: Zentrale(ctx.applicationContext).also { ich = it } }
        val Status.aktiv get() = this == Status.LAEUFT || this == Status.PAUSE
    }
}
