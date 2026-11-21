package de.tiry.luna

/**
 * Macht Text sprechbar – gemeinsamer Stimmen-Standard Luna/AIVOX (stimme/STANDARD.md, Abschnitt 3, gemessen hilfreich):
 * Zahlen, Uhrzeiten, Beträge, Prozent und Grad als gesprochene Wörter; Abkürzungen so, wie man sie spricht.
 * Gilt für jede Stimme (ElevenLabs und Handy-Stimme). Reines Kotlin → per JUnit getestet.
 */
object SpeechText {

    private val ones = listOf("null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn",
        "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn")
    private val tens = listOf("", "", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig")

    /** 0 … 999 999 999 als deutsches Zahlwort („einundzwanzig“, „dreihundertvier“). */
    fun words(n: Long): String {
        if (n < 0) return "minus " + words(-n)
        if (n < 20) return ones[n.toInt()]
        if (n < 100) {
            val o = (n % 10).toInt(); val t = (n / 10).toInt()
            return if (o == 0) tens[t] else (if (o == 1) "ein" else ones[o]) + "und" + tens[t]
        }
        if (n < 1000) {
            val h = (n / 100).toInt(); val r = n % 100
            return (if (h == 1) "ein" else ones[h]) + "hundert" + if (r == 0L) "" else words(r)
        }
        if (n < 1_000_000) {
            val th = n / 1000; val r = n % 1000
            return (if (th == 1L) "ein" else words(th)) + "tausend" + if (r == 0L) "" else words(r)
        }
        if (n < 1_000_000_000) {
            val m = n / 1_000_000; val r = n % 1_000_000
            return (if (m == 1L) "eine Million" else words(m) + " Millionen") + if (r == 0L) "" else " " + words(r)
        }
        return n.toString()
    }

    private val abbreviations = listOf(
        "SMS" to "Es-Em-Es", "KI" to "Ka-I", "PIN" to "Pin", "ca." to "circa", "z. B." to "zum Beispiel", "z.B." to "zum Beispiel",
        "bzw." to "beziehungsweise", "usw." to "und so weiter", "d. h." to "das heißt", "evtl." to "eventuell", "inkl." to "inklusive",
        "Nr." to "Nummer", "Std." to "Stunden", "Min." to "Minuten", "AIVOX" to "Ei-Wox", "USB" to "U-Es-Be", "GPS" to "Ge-Pe-Es",
    )

    fun normalize(input: String): String {
        var t = input
        // Uhrzeiten: 7:30 / 07.30 Uhr / 14:05
        // Doppelpunkt immer, Punkt nur mit „Uhr“ (sonst wäre „21.11.“ ein Datum)
        t = Regex("\\b([01]?\\d|2[0-3])(?::([0-5]\\d)(\\s*Uhr)?|\\.([0-5]\\d)(\\s*Uhr))\\b").replace(t) { m ->
            val h = m.groupValues[1].toInt(); val min = (m.groupValues[2].ifEmpty { m.groupValues[4] }).toInt()
            val hw = if (h == 1) "ein" else words(h.toLong())
            if (min == 0) "$hw Uhr" else "$hw Uhr ${words(min.toLong())}"
        }
        // Beträge: 89,90 € / 89 € / €89 / 12,50 Euro
        t = Regex("(\\d+)(?:,(\\d{1,2}))?\\s*(€|Euro|EUR)").replace(t) { m ->
            val e = m.groupValues[1].toLong(); val c = m.groupValues[2].takeIf { it.isNotEmpty() }?.padEnd(2, '0')?.toLong() ?: 0
            words(e) + " Euro" + if (c > 0) " " + words(c) else ""
        }
        // Prozent und Grad
        t = Regex("(\\d+)(?:,(\\d+))?\\s*%").replace(t) { m -> num(m.groupValues[1], m.groupValues[2]) + " Prozent" }
        t = Regex("(-?\\d+)(?:,(\\d+))?\\s*°\\s*C?").replace(t) { m -> num(m.groupValues[1], m.groupValues[2]) + " Grad" }
        // Abkürzungen (ganze Wörter)
        for ((a, b) in abbreviations) t = t.replace(Regex("(?<![\\p{L}])" + Regex.escape(a) + "(?![\\p{L}])"), b)
        // Tausenderpunkte („1.500“) entfernen, dann übrige Zahlen bis 9 Stellen (inkl. Dezimal „2,5“) als Wörter
        t = Regex("\\b(\\d{1,3})(\\.\\d{3})+\\b").replace(t) { it.value.replace(".", "") }
        // Datumsangaben („21.11.2026“) bleiben – die Stimmen sprechen sie selbst richtig
        t = Regex("(?<![\\d,.])(\\d{1,9})(?:,(\\d{1,3}))?(?![\\d]|\\.\\d)").replace(t) { m -> num(m.groupValues[1], m.groupValues[2]) }
        return t
    }

    private fun num(int: String, dec: String): String {
        val w = words(int.toLong())
        return if (dec.isEmpty()) w else w + " Komma " + dec.map { ones[it.digitToInt()] }.joinToString(" ")
    }
}
