package de.tiry.waschmaschine.logik

import de.tiry.waschmaschine.protokoll.GeraeteProfil
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.longOrNull

enum class Status(val wort: String) { AUS("Aus"), BEREIT("Bereit"), LAEUFT("Läuft"), PAUSE("Pause"), FERTIG("Fertig"), FEHLER("Fehler") }
enum class Tuer(val wort: String) { OFFEN("offen"), ZU("zu"), VERRIEGELT("verriegelt"), UNBEKANNT("–") }

/** Der Maschinenzustand, wie ihn die App anzeigt – unabhängig vom Protokoll. */
@Serializable
data class Zustand(
    val status: Status = Status.AUS,
    val betriebsart: String = "Inactive",
    val tuer: Tuer = Tuer.UNBEKANNT,
    val programm: String? = null,
    val programmUid: Int? = null,
    val restSek: Long? = null,
    val fortschritt: Int? = null,
    val startInSek: Long? = null,
    val temperatur: String? = null,
    val schleudern: String? = null,
    val phase: String? = null,
    /** Aktive Fehler-/Ereignis-Namen (kurz). */
    val fehler: List<String> = emptyList(),
    val fernstartErlaubt: Boolean = false,
    val fernbedienungAktiv: Boolean = false,
    val eingeschaltet: Boolean = false,
) {
    val laeuftGerade get() = status == Status.LAEUFT || status == Status.PAUSE

    /** Fertig-um-Uhrzeit aus Restzeit. */
    fun fertigUm(jetztMs: Long): Long? = restSek?.takeIf { it > 0 && laeuftGerade }?.let { jetztMs + it * 1000 }
}

/** Sammelt die Rohwerte (uid → Wert) und übersetzt sie mit dem Geräteprofil in einen [Zustand]. */
class ZustandsBauer(private val profil: GeraeteProfil) {
    private val roh = LinkedHashMap<String, String>()

    fun uebernimm(werte: Map<Int, JsonElement>): Zustand {
        for ((uid, w) in werte) {
            val m = profil.merkmale[uid] ?: continue
            val p = w as? JsonPrimitive ?: continue
            val kurz = m.name.substringAfterLast('.')
            val text = when {
                m.werte != null -> m.werte[p.longOrNull?.toInt()] ?: p.content
                else -> p.content
            }
            when (m.name) {
                "BSH.Common.Root.ActiveProgram" -> { val u = p.longOrNull?.toInt(); if (u == null || u == 0) roh.remove("_aktiv") else roh["_aktiv"] = u.toString() }
                "BSH.Common.Root.SelectedProgram" -> { val u = p.longOrNull?.toInt(); if (u != null && u != 0) roh["_gewaehlt"] = u.toString() }
                else -> roh[kurz] = text.substringAfterLast('.')
            }
        }
        return zustand()
    }

    fun zustand(): Zustand {
        val betrieb = roh["OperationState"] ?: "Inactive"
        val fehler = roh.filter { (k, v) -> istFehlerName(k) && (v == "Present" || v == "On" || v == "true") }.keys.sorted()
        val power = roh["PowerState"]
        val status = when {
            betrieb == "Error" || fehler.any { it in Texte.schwer } -> Status.FEHLER
            betrieb == "Run" || betrieb == "Aborting" -> Status.LAEUFT
            betrieb == "Pause" || betrieb == "ActionRequired" -> Status.PAUSE
            betrieb == "Finished" -> Status.FERTIG
            betrieb == "Ready" || betrieb == "DelayedStart" -> Status.BEREIT
            power == "On" -> Status.BEREIT
            else -> Status.AUS
        }
        val progUid = roh["_aktiv"]?.toInt() ?: roh["_gewaehlt"]?.toInt()
        val progName = progUid?.let { profil.merkmale[it]?.name }
        return Zustand(
            status = status,
            betriebsart = betrieb,
            tuer = when (roh["DoorState"]) { "Open" -> Tuer.OFFEN; "Closed" -> Tuer.ZU; "Locked" -> Tuer.VERRIEGELT; else -> Tuer.UNBEKANNT },
            programm = progName?.let(Texte::programm),
            programmUid = progUid,
            restSek = roh["RemainingProgramTime"]?.toLongOrNull(),
            fortschritt = roh["ProgramProgress"]?.toIntOrNull(),
            startInSek = roh["StartInRelative"]?.toLongOrNull()?.takeIf { betrieb == "DelayedStart" && it > 0 },
            temperatur = roh["Temperature"]?.let(Texte::temperatur),
            schleudern = roh["SpinSpeed"]?.let(Texte::schleudern),
            phase = roh["ProcessPhase"],
            fehler = fehler,
            fernstartErlaubt = roh["RemoteControlStartAllowed"].wahr(),
            fernbedienungAktiv = roh["RemoteControlActive"].wahr(),
            eingeschaltet = power == "On" || status != Status.AUS,
        )
    }

    private fun String?.wahr() = this != null && (this.equals("true", true) || this == "1" || this == "On")

    companion object {
        fun istFehlerName(k: String) = k in Texte.fehlerTexte.keys || k.endsWith("Occured") || k.endsWith("Occurred") || k.endsWith("Error")
    }
}
