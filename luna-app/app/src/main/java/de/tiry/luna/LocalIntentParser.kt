package de.tiry.luna

/**
 * Versteht die wichtigsten Sprachbefehle komplett offline (ohne KI-Key, ohne Internet).
 * Reines Kotlin – wird per JUnit getestet. Ergebnis: Werkzeugname + Argumente (gleiche Werkzeuge wie für Claude).
 */
object LocalIntentParser {

    data class Command(val tool: String, val args: Map<String, Any> = emptyMap())

    private val numberWords = mapOf(
        "ein" to 1, "eine" to 1, "einer" to 1, "eins" to 1, "einen" to 1, "zwei" to 2, "drei" to 3, "vier" to 4,
        "fünf" to 5, "sechs" to 6, "sieben" to 7, "acht" to 8, "neun" to 9, "zehn" to 10, "elf" to 11,
        "zwölf" to 12, "dreizehn" to 13, "vierzehn" to 14, "fünfzehn" to 15, "zwanzig" to 20,
        "fünfundzwanzig" to 25, "dreißig" to 30, "vierzig" to 40, "fünfundvierzig" to 45, "fünfzig" to 50,
        "sechzig" to 60, "neunzig" to 90, "hundert" to 100, "halbe" to 0,
    )

    /** Ersetzt Zahlwörter durch Ziffern („zehn minuten“ → „10 minuten“). */
    fun normalize(input: String): String {
        var t = " " + input.lowercase().replace(Regex("[,.!?;„“\"]"), " ") + " "
        for ((w, n) in numberWords.entries.sortedByDescending { it.key.length }) {
            if (w == "halbe") continue
            t = t.replace(Regex("(?<=\\s)$w(?=\\s)"), n.toString())
        }
        return t.replace(Regex("\\s+"), " ").trim()
    }

    fun parse(raw: String): Command? {
        val t = normalize(raw)
        if (t.isBlank()) return null

        // Gespräch beenden
        if (Regex("^(danke|danke dir|danke schön|vielen dank|passt|nichts|nix|tschüss|bis später|abbrechen|stopp|stop|schon gut|gute nacht)( luna)?( danke)?$").matches(t))
            return Command("end_conversation", mapOf("text" to t))

        // Zeit / Datum / Status
        if (Regex("wie spät|uhrzeit|wie viel uhr|wieviel uhr").containsMatchIn(t)) return Command("get_time")
        if (Regex("welcher tag|welches datum|datum|den wievielten|welchen tag").containsMatchIn(t)) return Command("get_time")
        if (Regex("akku|batterie|ladestand").containsMatchIn(t)) return Command("get_device_status")

        // Taschenlampe
        if (Regex("taschenlampe|lampe|licht an|licht aus|blitz").containsMatchIn(t)) {
            val off = Regex("\\baus\\b|ausschalten|ausmachen|abschalten").containsMatchIn(t)
            return Command("flashlight", mapOf("on" to !off))
        }

        // Timer („timer 10 minuten“, „stell einen timer auf 5 minuten“)
        if (t.contains("timer") || t.contains("stoppuhr") || t.contains("countdown")) {
            val secs = parseDuration(t)
            if (secs != null) return Command("set_timer", mapOf("seconds" to secs))
        }

        // Erinnerung
        Regex("erinner(?:e|n)? mich (?:in (\\d+) (minute|minuten|stunde|stunden) )?(?:daran |an |dass |das )?(.+)").find(t)?.let { m ->
            val text = m.groupValues[3].trim()
            val dur = parseDuration(t)
            if (dur != null && text.isNotBlank()) {
                val clean = text.replace(Regex("in \\d+ (minute|minuten|stunde|stunden)"), "").trim()
                return Command("set_reminder", mapOf("text" to clean, "in_minutes" to (dur / 60).coerceAtLeast(1)))
            }
        }

        // Wecker („weck mich um 6:30“, „wecker auf 7 uhr“)
        if (Regex("wecker|weck mich|wecke mich|aufwecken").containsMatchIn(t)) {
            parseClock(t)?.let { (h, m) -> return Command("set_alarm", mapOf("hour" to h, "minute" to m)) }
        }

        // Heimnetz: PC & FRITZ!Box
        if (Regex("\\b(pc|computer|rechner)\\b").containsMatchIn(t)) {
            if (Regex("fernsteuer|remote|fernzugriff|draufschalten|aufschalten|verbinde mich").containsMatchIn(t)) return Command("pc_remote")
            if (Regex("ist .*(an|online)|läuft (mein|der)").containsMatchIn(t)) return Command("pc_status")
            if (Regex("\\ban\\b|einschalten|anschalten|hochfahren|\\bhoch\\b|starte|aufwecken|weck").containsMatchIn(t)) return Command("pc_wake")
        }
        if (Regex("gast.?wlan|gästewlan|gast.?netz").containsMatchIn(t)) {
            val on = when { Regex("\\baus\\b|ausschalten|abschalten").containsMatchIn(t) -> false; Regex("\\ban\\b|einschalten|anschalten").containsMatchIn(t) -> true; else -> null }
            return Command("fritz_guest_wifi", if (on == null) emptyMap() else mapOf("on" to on))
        }
        if (Regex("wer ist (im|online|alles im)|welche geräte|geräte (im|online)").containsMatchIn(t)) return Command("fritz_devices")
        if (Regex("wer hat (mich )?angerufen|anrufliste|verpasste anrufe").containsMatchIn(t)) return Command("fritz_calls")
        if (Regex("vpn|verbindung nach hause").containsMatchIn(t)) return Command("vpn_connect", mapOf("on" to !Regex("\\baus\\b|trenn|beende").containsMatchIn(t)))

        // Anrufen
        Regex("^(?:bitte )?(?:ruf|rufe) (.+?) an$").find(t)?.let { return Command("call_contact", mapOf("name" to it.groupValues[1].trim())) }
        Regex("^(.+?) anrufen$").find(t)?.let { return Command("call_contact", mapOf("name" to it.groupValues[1].replace(Regex("^(bitte )"), "").trim())) }

        // Navigation
        Regex("(?:navigier(?:e)?|navigation|bring mich|führ mich|route)(?: mich)? (?:nach|zu|zur|zum|in die|ins) (.+)").find(t)?.let {
            return Command("navigate", mapOf("destination" to it.groupValues[1].trim()))
        }

        // Musik
        if (Regex("^(pause|musik aus|musik stopp|stopp die musik|halt die musik an|pausier(e)?.*)$").matches(t)) return Command("media_control", mapOf("action" to "pause"))
        if (Regex("nächste(?:s|r)? (lied|song|titel|track)|überspring|skip").containsMatchIn(t)) return Command("media_control", mapOf("action" to "next"))
        if (Regex("vorherige(?:s|r)? (lied|song|titel)|letzte(?:s|n)? (lied|song)").containsMatchIn(t)) return Command("media_control", mapOf("action" to "previous"))
        if (Regex("^(weiter|weiterspielen|musik an|play|abspielen)$").matches(t)) return Command("media_control", mapOf("action" to "play"))
        Regex("^(?:spiel|spiele|spiel mal|spiel mir) (.+?)(?: ab| vor)?$").find(t)?.let { return Command("play_music", mapOf("query" to it.groupValues[1].trim())) }

        // Lautstärke
        Regex("lautstärke (?:auf )?(\\d{1,3})").find(t)?.let { return Command("set_volume", mapOf("level" to it.groupValues[1].toInt().coerceIn(0, 100))) }
        if (Regex("\\blauter\\b").containsMatchIn(t)) return Command("set_volume", mapOf("change" to "up"))
        if (Regex("\\bleiser\\b").containsMatchIn(t)) return Command("set_volume", mapOf("change" to "down"))
        if (Regex("stumm|lautlos").containsMatchIn(t)) return Command("set_ringer_mode", mapOf("mode" to "vibrate"))

        // Bildschirm / System
        if (Regex("bildschirmfoto|screenshot").containsMatchIn(t)) return Command("screen_action", mapOf("action" to "screenshot"))
        if (Regex("sperr|handy aus|bildschirm aus").containsMatchIn(t)) return Command("screen_action", mapOf("action" to "lock"))
        if (Regex("^(geh |gehe )?(zurück)$").matches(t)) return Command("screen_action", mapOf("action" to "back"))
        if (Regex("startbildschirm|homescreen|home bildschirm|^home$").containsMatchIn(t)) return Command("screen_action", mapOf("action" to "home"))
        if (Regex("was steht (da|auf dem bildschirm)|lies (mir )?(den bildschirm|vor was da steht)").containsMatchIn(t)) return Command("read_screen")
        if (Regex("benachrichtigung|neue nachrichten|was gibt.?s neues|hab ich nachrichten").containsMatchIn(t)) return Command("read_notifications")
        Regex("^(?:scroll|scrolle) ?(runter|nach unten|hoch|nach oben)?$").find(t)?.let {
            val up = it.groupValues[1].contains("hoch") || it.groupValues[1].contains("oben")
            return Command("scroll", mapOf("direction" to if (up) "up" else "down"))
        }
        Regex("^(?:tipp|tippe|klick|klicke|drück|drücke) (?:auf )?(.+)$").find(t)?.let { return Command("tap_element", mapOf("text" to it.groupValues[1].trim())) }

        // Wetter
        if (t.contains("wetter") || Regex("regnet|regen|wie warm|wie kalt|temperatur").containsMatchIn(t)) {
            val city = Regex("(?:in|für) ([a-zäöüß .-]+)$").find(t)?.groupValues?.get(1)?.trim()
            return Command("get_weather", if (city != null && city != "morgen" && city != "heute") mapOf("location" to city) else emptyMap())
        }

        // Merken
        Regex("^merk (?:dir|euch)(?: bitte)?(?: dass| das)? (.+)$").find(t)?.let { return Command("remember", mapOf("fact" to it.groupValues[1].trim())) }
        if (Regex("was weißt du (über mich|von mir)|was hast du dir gemerkt").containsMatchIn(t)) return Command("list_memories")

        // Apps öffnen
        Regex("^(?:öffne|öffnen|starte|start|mach|geh auf|zeig mir)(?: mal| bitte)? (?:die |den |das )?(.+?)(?: app)?(?: auf)?$").find(t)?.let {
            return Command("open_app", mapOf("name" to it.groupValues[1].trim()))
        }
        Regex("^(.+?)(?: app)? (?:öffnen|starten|aufmachen)$").find(t)?.let { return Command("open_app", mapOf("name" to it.groupValues[1].trim())) }

        // Suche
        Regex("^(?:google|such|suche|suche nach|such nach|such mal nach|such mal)(?: nach)? (.+)$").find(t)?.let { return Command("web_search_open", mapOf("query" to it.groupValues[1].trim())) }

        // Persönliches
        if (Regex("\\btipp\\b|tip des tages|gib mir (einen|nen) rat|motivier").containsMatchIn(t)) return Command("tip")
        if (t.contains("witz")) return Command("joke")
        if (Regex("guten morgen|briefing|was steht heute an|tagesüberblick").containsMatchIn(t)) return Command("briefing")
        if (Regex("wie geht.?s|wie geht es dir|alles gut bei dir").containsMatchIn(t)) return Command("smalltalk", mapOf("kind" to "how"))
        if (Regex("wer bist du|was kannst du|hilfe").containsMatchIn(t)) return Command("smalltalk", mapOf("kind" to "who"))
        return null
    }

    /** „10 minuten“, „1 stunde 30“, „90 sekunden“, „halbe stunde“ → Sekunden. */
    fun parseDuration(t: String): Int? {
        if (t.contains("halbe stunde")) return 1800
        if (t.contains("viertelstunde")) return 900
        var total = 0
        var found = false
        Regex("(\\d+) ?(stunde|stunden|std|h)\\b").find(t)?.let { total += it.groupValues[1].toInt() * 3600; found = true }
        Regex("(\\d+) ?(minute|minuten|min)\\b").find(t)?.let { total += it.groupValues[1].toInt() * 60; found = true }
        Regex("(\\d+) ?(sekunde|sekunden|sek)\\b").find(t)?.let { total += it.groupValues[1].toInt(); found = true }
        if (!found) Regex("(?:auf|für) (\\d+)$").find(t)?.let { total = it.groupValues[1].toInt() * 60; found = true }
        return if (found && total > 0) total else null
    }

    /** „6:30“, „6 uhr 30“, „um 7“, „halb 8“ → (Stunde, Minute). */
    fun parseClock(t: String): Pair<Int, Int>? {
        Regex("(\\d{1,2})[:.](\\d{2})").find(t)?.let { return valid(it.groupValues[1].toInt(), it.groupValues[2].toInt()) }
        Regex("halb (\\d{1,2})").find(t)?.let { return valid((it.groupValues[1].toInt() + 23) % 24, 30) }
        Regex("viertel nach (\\d{1,2})").find(t)?.let { return valid(it.groupValues[1].toInt(), 15) }
        Regex("viertel vor (\\d{1,2})").find(t)?.let { return valid((it.groupValues[1].toInt() + 23) % 24, 45) }
        Regex("(\\d{1,2}) ?uhr ?(\\d{1,2})?").find(t)?.let {
            return valid(it.groupValues[1].toInt(), it.groupValues[2].toIntOrNull() ?: 0)
        }
        Regex("(?:um|auf|für) (\\d{1,2})\\b").find(t)?.let { return valid(it.groupValues[1].toInt(), 0) }
        return null
    }

    private fun valid(h: Int, m: Int) = if (h in 0..23 && m in 0..59) h to m else null
}
