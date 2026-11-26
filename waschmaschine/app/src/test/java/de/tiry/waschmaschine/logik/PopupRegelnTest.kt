package de.tiry.waschmaschine.logik

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Simulierte Status-Wechsel eines Waschgangs → genau die richtigen Pop-ups. */
class PopupRegelnTest {
    private val alle = PopupEinstellungen(nochZehn = true)
    private val min = 60_000L

    private fun z(s: Status, rest: Long? = null, tuer: Tuer = Tuer.VERRIEGELT, fehler: List<String> = emptyList()) =
        Zustand(status = s, restSek = rest, tuer = tuer, programm = "Baumwolle", fehler = fehler)

    private class Ablauf(val e: PopupEinstellungen) {
        var buch = Laufbuch(); val popups = ArrayList<Pair<Long, Popup>>()
        fun mit(t: Long, z: Zustand) = apply { val r = PopupRegeln.neuerZustand(buch, z, t, e); buch = r.buch; r.popups.forEach { popups += t to it } }
        fun weg(t: Long) = apply { val r = PopupRegeln.keinKontakt(buch, t, "Handy offline.", e); buch = r.buch; r.popups.forEach { popups += t to it } }
        val arten get() = popups.map { it.second.art }
    }

    @Test fun ganzerWaschgangMeldetZehnFertigUndWartet() {
        val a = Ablauf(alle)
            .mit(0, z(Status.BEREIT, tuer = Tuer.ZU))
            .mit(1 * min, z(Status.LAEUFT, rest = 5400))
            .mit(60 * min, z(Status.LAEUFT, rest = 1800))
            .mit(80 * min, z(Status.LAEUFT, rest = 540))
            .mit(81 * min, z(Status.LAEUFT, rest = 480))   // keine Doppelmeldung
            .mit(90 * min, z(Status.FERTIG, rest = 0, tuer = Tuer.ZU))
            .mit(100 * min, z(Status.FERTIG, rest = 0, tuer = Tuer.ZU))
            .mit(120 * min, z(Status.FERTIG, rest = 0, tuer = Tuer.ZU))
            .mit(150 * min, z(Status.FERTIG, rest = 0, tuer = Tuer.ZU))
        assertEquals(listOf(PopupArt.NOCH_ZEHN, PopupArt.FERTIG, PopupArt.WAESCHE_WARTET), a.arten)
        assertEquals(120 * min, a.popups.last().first)
        assertTrue(a.popups[1].second.text.contains("Baumwolle"))
    }

    @Test fun tuerAufNachFertigVerhindertErinnerung() {
        val a = Ablauf(alle)
            .mit(0, z(Status.LAEUFT, rest = 3000))
            .mit(50 * min, z(Status.FERTIG, rest = 0, tuer = Tuer.ZU))
            .mit(55 * min, z(Status.FERTIG, tuer = Tuer.OFFEN))
            .mit(90 * min, z(Status.BEREIT, tuer = Tuer.ZU))
        assertEquals(listOf(PopupArt.FERTIG), a.arten)
    }

    @Test fun nochZehnIstStandardmaessigAus() {
        val a = Ablauf(PopupEinstellungen())
            .mit(0, z(Status.LAEUFT, rest = 700)).mit(2 * min, z(Status.LAEUFT, rest = 580)).mit(12 * min, z(Status.FERTIG, tuer = Tuer.ZU))
        assertEquals(listOf(PopupArt.FERTIG), a.arten)
    }

    @Test fun fehlerMitVerstaendlichemTextEinmalUndErneutNachBehebung() {
        val a = Ablauf(alle)
            .mit(0, z(Status.LAEUFT, rest = 3000))
            .mit(1 * min, z(Status.PAUSE, rest = 3000, fehler = listOf("LowWaterPressure")))
            .mit(2 * min, z(Status.PAUSE, rest = 3000, fehler = listOf("LowWaterPressure")))
            .mit(3 * min, z(Status.LAEUFT, rest = 2900))
            .mit(4 * min, z(Status.PAUSE, rest = 2900, fehler = listOf("LowWaterPressure")))
        assertEquals(listOf(PopupArt.FEHLER, PopupArt.FEHLER), a.arten)
        assertEquals("Zu wenig Wasser. Wasserhahn ganz aufdrehen, Zulaufschlauch prüfen.", a.popups[0].second.text)
    }

    @Test fun einzelnAbschaltbar() {
        val a = Ablauf(PopupEinstellungen(fertig = false, nochZehn = true))
            .mit(0, z(Status.LAEUFT, rest = 500)).mit(9 * min, z(Status.FERTIG, tuer = Tuer.ZU))
        assertEquals(listOf(PopupArt.NOCH_ZEHN), a.arten)
    }

    @Test fun verbindungVerlorenNurWaehrendWaschgangUndErstNachFuenfMinuten() {
        val a = Ablauf(alle).mit(0, z(Status.LAEUFT, rest = 3000)).weg(1 * min).weg(3 * min)
        assertEquals(emptyList<PopupArt>(), a.arten)
        a.weg(7 * min).weg(9 * min)
        assertEquals(listOf(PopupArt.VERBINDUNG_WEG), a.arten)
        a.mit(10 * min, z(Status.LAEUFT, rest = 2400)).weg(11 * min).weg(17 * min) // nach Rückkehr wieder scharf
        assertEquals(listOf(PopupArt.VERBINDUNG_WEG, PopupArt.VERBINDUNG_WEG), a.arten)

        val ruhig = Ablauf(alle).mit(0, z(Status.AUS, tuer = Tuer.ZU)).weg(1 * min).weg(60 * min)
        assertEquals(emptyList<PopupArt>(), ruhig.arten)
    }

    @Test fun fertigObwohlLaufNichtBeobachtetWurde() {
        // App war zu, Hintergrundprüfung sieht direkt "Fertig" → trotzdem melden
        val a = Ablauf(alle).mit(0, z(Status.FERTIG, tuer = Tuer.ZU))
        assertEquals(listOf(PopupArt.FERTIG), a.arten)
    }

    @Test fun endpruefungWirdAnhandRestzeitGeplant() {
        val jetzt = 1_000_000L
        assertEquals(jetzt + (1800 - 30) * 1000, PopupRegeln.naechstePruefungMs(Laufbuch(), z(Status.LAEUFT, rest = 1800), jetzt))
        assertEquals(jetzt + 60_000, PopupRegeln.naechstePruefungMs(Laufbuch(), z(Status.LAEUFT, rest = 20), jetzt))
        val fertig = Laufbuch(fertigSeitMs = jetzt, gemeldetFertig = true)
        assertEquals(jetzt + 30 * min, PopupRegeln.naechstePruefungMs(fertig, z(Status.FERTIG, tuer = Tuer.ZU), jetzt + min))
        assertEquals(null, PopupRegeln.naechstePruefungMs(Laufbuch(), z(Status.AUS), jetzt))
    }
}
