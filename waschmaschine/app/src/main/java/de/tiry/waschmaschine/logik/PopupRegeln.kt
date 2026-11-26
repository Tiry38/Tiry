package de.tiry.waschmaschine.logik

import kotlinx.serialization.Serializable

enum class PopupArt(val titel: String) {
    FERTIG("Wäsche ist fertig"),
    WAESCHE_WARTET("Wäsche liegt seit 30 Minuten drin"),
    FEHLER("Die Maschine meldet ein Problem"),
    VERBINDUNG_WEG("Verbindung zur Waschmaschine verloren"),
    NOCH_ZEHN("Noch 10 Minuten"),
}

data class Popup(val art: PopupArt, val text: String)

@Serializable
data class PopupEinstellungen(
    val fertig: Boolean = true,
    val waescheWartet: Boolean = true,
    val fehler: Boolean = true,
    val verbindungWeg: Boolean = true,
    val nochZehn: Boolean = false,
) {
    fun an(a: PopupArt) = when (a) {
        PopupArt.FERTIG -> fertig; PopupArt.WAESCHE_WARTET -> waescheWartet; PopupArt.FEHLER -> fehler
        PopupArt.VERBINDUNG_WEG -> verbindungWeg; PopupArt.NOCH_ZEHN -> nochZehn
    }
}

/** Was über den laufenden Waschgang schon gemeldet wurde – überlebt App-Neustarts. */
@Serializable
data class Laufbuch(
    val letzterStatus: Status? = null,
    val programm: String? = null,
    val laufStartMs: Long? = null,
    val fertigSeitMs: Long? = null,
    val tuerNachFertigAuf: Boolean = false,
    val gemeldetFertig: Boolean = false,
    val gemeldetZehn: Boolean = false,
    val gemeldetWartet: Boolean = false,
    val gemeldeteFehler: List<String> = emptyList(),
    val kontaktWegSeitMs: Long? = null,
    val gemeldetVerbindungWeg: Boolean = false,
)

/**
 * Reine Entscheidungslogik: aus altem Laufbuch + neuem Zustand → neues Laufbuch + Pop-ups.
 * Ohne Android, damit sie vollständig testbar ist.
 */
object PopupRegeln {
    const val WARTEZEIT_MS = 30 * 60 * 1000L
    const val VERBINDUNG_TOLERANZ_MS = 5 * 60 * 1000L

    data class Ergebnis(val buch: Laufbuch, val popups: List<Popup>)

    fun neuerZustand(b: Laufbuch, z: Zustand, jetzt: Long, e: PopupEinstellungen): Ergebnis {
        val raus = ArrayList<Popup>()
        var n = b.copy(kontaktWegSeitMs = null, gemeldetVerbindungWeg = false, letzterStatus = z.status)

        // Neuer Waschgang beginnt
        if (z.laeuftGerade && (b.letzterStatus == null || b.letzterStatus == Status.AUS || b.letzterStatus == Status.BEREIT || b.letzterStatus == Status.FERTIG)) {
            n = Laufbuch(letzterStatus = z.status, programm = z.programm, laufStartMs = jetzt)
        }
        if (z.programm != null && z.laeuftGerade) n = n.copy(programm = z.programm)

        // Noch 10 Minuten
        val rest = z.restSek
        if (z.status == Status.LAEUFT && rest != null && rest in 1..600 && !n.gemeldetZehn) {
            n = n.copy(gemeldetZehn = true)
            raus += Popup(PopupArt.NOCH_ZEHN, "${z.programm ?: "Waschgang"}: in ${Texte.dauer(rest)} fertig.")
        }

        // Fertig
        if (z.status == Status.FERTIG && !n.gemeldetFertig && (b.letzterStatus == null || b.letzterStatus != Status.FERTIG || b.laufStartMs != null)) {
            n = n.copy(gemeldetFertig = true, fertigSeitMs = jetzt, tuerNachFertigAuf = z.tuer == Tuer.OFFEN)
            raus += Popup(PopupArt.FERTIG, "${n.programm ?: "Waschgang"} ist durch. Tür auf, Wäsche raus.")
        }
        if (n.fertigSeitMs != null && z.tuer == Tuer.OFFEN) n = n.copy(tuerNachFertigAuf = true)
        // Nach dem Ausräumen ist der Waschgang erledigt
        if (n.fertigSeitMs != null && (z.status == Status.AUS || z.status == Status.BEREIT) && n.tuerNachFertigAuf) {
            n = n.copy(gemeldetWartet = true)
        }

        // Fehler – jeder neue Fehler einmal
        val neu = z.fehler.filter { it !in n.gemeldeteFehler }
        if (neu.isNotEmpty()) {
            n = n.copy(gemeldeteFehler = (n.gemeldeteFehler + neu).distinct())
            neu.forEach { raus += Popup(PopupArt.FEHLER, Texte.fehler(it)) }
        } else if (z.status == Status.FEHLER && "Error" !in n.gemeldeteFehler && z.fehler.isEmpty()) {
            n = n.copy(gemeldeteFehler = n.gemeldeteFehler + "Error")
            raus += Popup(PopupArt.FEHLER, "Die Maschine steht mit einem Fehler. Anzeige am Gerät ansehen.")
        }
        // Behobene Fehler vergessen, damit ein erneutes Auftreten wieder gemeldet wird
        n = n.copy(gemeldeteFehler = n.gemeldeteFehler.filter { it in z.fehler || (it == "Error" && z.status == Status.FEHLER) })

        // Wäsche wartet (wird beim Prüfen nach 30 min ausgelöst)
        waescheWartet(n, z, jetzt)?.let { (buch, p) -> n = buch; raus += p }

        return Ergebnis(n, raus.filter { e.an(it.art) })
    }

    private fun waescheWartet(b: Laufbuch, z: Zustand, jetzt: Long): Pair<Laufbuch, Popup>? {
        val seit = b.fertigSeitMs ?: return null
        if (b.gemeldetWartet || b.tuerNachFertigAuf) return null
        if (jetzt - seit < WARTEZEIT_MS) return null
        if (z.tuer == Tuer.OFFEN) return null
        return b.copy(gemeldetWartet = true) to Popup(PopupArt.WAESCHE_WARTET, "Die Wäsche liegt seit ${(jetzt - seit) / 60000} Minuten in der Trommel. Bitte ausräumen, sonst knittert und riecht sie.")
    }

    /** Kein Kontakt zur Maschine. Meldet nur, wenn gerade ein Waschgang läuft und die Pause länger als 5 min ist. */
    fun keinKontakt(b: Laufbuch, jetzt: Long, grund: String, e: PopupEinstellungen): Ergebnis {
        val laeuft = b.letzterStatus == Status.LAEUFT || b.letzterStatus == Status.PAUSE
        val seit = b.kontaktWegSeitMs ?: jetzt
        var n = b.copy(kontaktWegSeitMs = seit)
        val raus = ArrayList<Popup>()
        if (laeuft && !b.gemeldetVerbindungWeg && jetzt - seit >= VERBINDUNG_TOLERANZ_MS) {
            n = n.copy(gemeldetVerbindungWeg = true)
            raus += Popup(PopupArt.VERBINDUNG_WEG, grund)
        }
        return Ergebnis(n, raus.filter { e.an(it.art) })
    }

    /** Wann soll der Hintergrund das nächste Mal nachsehen? */
    fun naechstePruefungMs(b: Laufbuch, z: Zustand?, jetzt: Long): Long? {
        if (z != null && z.laeuftGerade) {
            val rest = z.restSek ?: return jetzt + 5 * 60_000
            return jetzt + maxOf(60_000, (rest - 30) * 1000)
        }
        val seit = b.fertigSeitMs
        if (seit != null && !b.gemeldetWartet && !b.tuerNachFertigAuf) return seit + WARTEZEIT_MS
        return null
    }
}
