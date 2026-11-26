package de.tiry.waschmaschine.logik

/** Verständliche deutsche Texte für Programme, Optionen und Fehler. */
object Texte {
    private val programme = mapOf(
        "Cotton" to "Baumwolle", "CottonEco" to "Baumwolle Eco", "Eco4060" to "Eco 40-60", "EasyCare" to "Pflegeleicht",
        "Mix" to "Mix", "NightWash" to "Nachtwäsche", "DelicatesSilk" to "Fein / Seide", "Wool" to "Wolle",
        "Super153045" to "Super 15'/30'", "Super15" to "Super 15'", "Super1530" to "Super 15'/30'", "PowerSpeed59" to "Power Speed 59'",
        "Rinse" to "Spülen", "RinseSpinDrain" to "Spülen", "Spin" to "Schleudern", "SpinDrain" to "Schleudern / Abpumpen", "Drain" to "Abpumpen",
        "Sensitive" to "Sensitive", "Shirts" to "Hemden", "ShirtsBlouses" to "Hemden / Blusen", "Sportswear" to "Sport / Fitness",
        "Towels" to "Handtücher", "DownDuvet" to "Daunen", "Duvet" to "Daunen", "DrumClean" to "Trommelreinigung",
        "Hygiene" to "Hygiene", "HygienePlus" to "Hygiene Plus", "Allergy" to "Allergie+", "Outdoor" to "Outdoor",
        "DarkWash" to "Dunkle Wäsche", "Jeans" to "Jeans", "Curtains" to "Gardinen", "Auto30" to "Auto 30 °C",
        "Auto40" to "Auto 40 °C", "Auto60" to "Auto 60 °C", "Chiffon" to "Chiffon", "Synthetic" to "Synthetik",
        "Steam" to "Dampf", "SteamRefresh" to "Auffrischen", "Babycare" to "Baby", "Quick" to "Schnell",
    )

    fun programm(name: String): String {
        val teile = name.split('.')
        val i = teile.indexOf("Program")
        val rest = if (i >= 0) teile.drop(i + 1) else listOf(teile.last())
        return programme[rest.last()] ?: programme[rest.first()] ?: rest.last().worte()
    }

    fun temperatur(w: String): String {
        val k = w.substringAfterLast('.')
        return when {
            k.startsWith("GC") -> k.removePrefix("GC").toIntOrNull()?.let { "$it °C" } ?: k
            k.startsWith("Ul") -> k.removePrefix("Ul").let { if (it == "Cold") "kalt" else it.filter(Char::isDigit).takeIf(String::isNotEmpty)?.let { d -> "$d °C" } ?: it }
            k == "Cold" -> "kalt"
            else -> k.toIntOrNull()?.let { "$it °C" } ?: k.worte()
        }
    }

    fun schleudern(w: String): String {
        val k = w.substringAfterLast('.')
        return when {
            k.startsWith("RPM") -> "${k.removePrefix("RPM")} U/min"
            k == "Off" -> "ohne"
            k.startsWith("Ul") -> k.removePrefix("Ul").let { r -> r.filter(Char::isDigit).takeIf(String::isNotEmpty)?.let { "$it U/min" } ?: if (r == "Off") "ohne" else r.worte() }
            else -> k.toIntOrNull()?.let { "$it U/min" } ?: k.worte()
        }
    }

    /** Fehler, bei denen die Maschine wirklich steht. */
    val schwer = setOf("AquaStopOccured", "FatalErrorOccured", "PumpError", "DrainPumpBlocked", "WaterLevelTooHigh", "DoorNotLockable", "DoorNotUnlockable")

    val fehlerTexte = mapOf(
        "AquaStopOccured" to "Aquastop hat ausgelöst. Wasserhahn zudrehen und Gerät prüfen lassen.",
        "LowWaterPressure" to "Zu wenig Wasser. Wasserhahn ganz aufdrehen, Zulaufschlauch prüfen.",
        "PumpError" to "Abpumpen klappt nicht. Flusensieb unten rechts reinigen.",
        "DrainPumpBlocked" to "Abpumpen klappt nicht. Flusensieb unten rechts reinigen.",
        "DoorNotLockable" to "Tür lässt sich nicht verriegeln. Tür kräftig zudrücken.",
        "DoorNotUnlockable" to "Tür lässt sich nicht öffnen. Kurz warten, dann erneut versuchen.",
        "FoamDetection" to "Zu viel Schaum. Beim nächsten Mal weniger Waschmittel nehmen.",
        "WaterLevelTooHigh" to "Wasserstand zu hoch. Programm abbrechen, Gerät prüfen.",
        "FatalErrorOccured" to "Schwerer Gerätefehler. Maschine ausschalten, Kundendienst rufen.",
        "CustomerServiceRequest" to "Die Maschine bittet um den Kundendienst.",
        "ReleaseRinseHoldPending" to "Spülstopp aktiv. Abpumpen oder Schleudern wählen.",
        "Unbalance" to "Unwucht. Wäsche in der Trommel verteilen.",
    )

    fun fehler(name: String): String = fehlerTexte[name] ?: "Meldung der Maschine: ${name.worte()}."

    private fun String.worte() = replace(Regex("(?<=[a-z])(?=[A-Z0-9])"), " ")

    fun dauer(sek: Long): String {
        val m = (sek + 59) / 60
        return if (m >= 60) "${m / 60}:${(m % 60).toString().padStart(2, '0')} h" else "$m min"
    }
}
