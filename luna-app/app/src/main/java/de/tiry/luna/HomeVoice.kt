package de.tiry.luna

import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Heim-Stimme: Client für den „Luna-Stimmserver v1“ auf Tirys PC (Kartoffel-Orpheus, kostenlos, offline, nur Heimnetz).
 * Vertrag (mit der AIVOX-Sitzung abgestimmt, stimme/STANDARD.md):
 *   GET  /health → {"ok":true,"engine":"…","voices":[…],"tags":[…],"version":"1"}
 *   POST /tts {text, voice, speed, format:"wav", previous_text} → audio/wav
 *   Header „Authorization: Bearer <Token>“, sonst 401.
 * Reines Java-Netzwerk → per JUnit gegen einen simulierten Server getestet.
 */
class HomeVoice(private val baseUrl: String, private val token: String) {

    data class Health(val ok: Boolean, val engine: String, val voices: List<String>, val tags: List<String>)

    companion object {
        const val PORT = 5055
        fun urlFor(host: String) = if (host.startsWith("http")) host.trimEnd('/') else "http://${host.trim()}:$PORT"

        /** Lunas Tags ([laughs], [sighs] …) in Server-Tags (<laugh>) umwandeln – nur die, die der Server kann; Rest entfernen. */
        fun convertTags(text: String, serverTags: List<String>): String {
            val known = serverTags.map { it.lowercase() }.toSet()
            return Regex("\\[([a-zA-Z ]{2,24})]\\s*").replace(text) { m ->
                val w = m.groupValues[1].lowercase().trim()
                val base = listOf(w, w.removeSuffix("s"), w.removeSuffix("es"), when (w) {
                    "chuckles", "laughs harder", "starts laughing" -> "chuckle"; "exhales" -> "sigh"; else -> w
                }, when (w) { "chuckles" -> "laugh"; else -> w }).firstOrNull { it in known }
                if (base != null) "<$base> " else ""
            }.trim()
        }
    }

    private fun open(path: String, method: String): HttpURLConnection {
        val c = URL(baseUrl.trimEnd('/') + path).openConnection() as HttpURLConnection
        c.requestMethod = method; c.connectTimeout = 2500; c.readTimeout = 20000
        c.setRequestProperty("Authorization", "Bearer $token")
        return c
    }

    fun health(): Health {
        val c = open("/health", "GET")
        if (c.responseCode == 401) throw SecurityException("Stimm-Server: Schlüssel falsch")
        if (c.responseCode != 200) throw IllegalStateException("Stimm-Server antwortet mit ${c.responseCode}")
        val o = JSONObject(c.inputStream.bufferedReader().use { it.readText() })
        fun list(k: String) = o.optJSONArray(k)?.let { a -> (0 until a.length()).map { a.optString(it) } } ?: emptyList()
        return Health(o.optBoolean("ok"), o.optString("engine"), list("voices"), list("tags"))
    }

    /** Erzeugt Sprache als WAV-Datei. */
    fun tts(text: String, voice: String, out: File, previous: String? = null) {
        val c = open("/tts", "POST")
        c.doOutput = true
        c.setRequestProperty("Content-Type", "application/json")
        val body = JSONObject().put("text", text).put("voice", voice).put("speed", 1.0).put("format", "wav")
        previous?.let { body.put("previous_text", it) }
        c.outputStream.use { it.write(body.toString().toByteArray()) }
        when (c.responseCode) {
            200 -> {}
            401 -> throw SecurityException("Stimm-Server: Schlüssel falsch")
            else -> throw IllegalStateException("Stimm-Server ${c.responseCode}: " + (c.errorStream?.bufferedReader()?.use { it.readText() }?.take(200) ?: ""))
        }
        val tmp = File(out.path + ".tmp")
        c.inputStream.use { inp -> tmp.outputStream().use { inp.copyTo(it) } }
        if (tmp.length() < 100) { tmp.delete(); throw IllegalStateException("Stimm-Server: leere Antwort") }
        tmp.renameTo(out)
    }
}
