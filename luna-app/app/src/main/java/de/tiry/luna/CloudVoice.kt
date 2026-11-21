package de.tiry.luna

import android.util.Base64
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Lunas mobile Stimme: Google Cloud Text-to-Speech „Chirp 3 HD“ (sehr natürliche deutsche Stimmen, überall per Internet).
 * Laut Google-Doku: Endpoint v1/text:synthesize, Stimmen „de-DE-Chirp3-HD-<Name>“, Feld „markup“ mit Pausen-Tags
 * ([pause short], [pause], [pause long]) nur für HD-Stimmen, Antwort audioContent (Base64).
 *
 * Sicherheit: Der Schlüssel liegt im Keystore-Tresor. Zusätzlich sendet Luna Paketname + Signatur-Fingerabdruck
 * (X-Android-Package / X-Android-Cert) – so kann der Schlüssel in der Google-Konsole auf GENAU diese App beschränkt werden.
 */
class CloudVoice(private val apiKey: String, private val androidPackage: String? = null, private val androidCert: String? = null,
                 private val endpoint: String = "https://texttospeech.googleapis.com/v1/text:synthesize") {

    companion object {
        const val DEFAULT_VOICE = "de-DE-Chirp3-HD-Aoede"
        /** Weibliche deutsche Chirp-3-HD-Stimmen (laut Google-Stimmenliste). */
        val FEMALE = listOf("Aoede", "Kore", "Leda", "Zephyr", "Despina", "Callirrhoe", "Autonoe", "Erinome", "Laomedeia",
            "Achernar", "Gacrux", "Pulcherrima", "Sulafat", "Vindemiatrix")

        /** Lunas Gefühls-Tags kann Chirp nicht – „[sighs]“ wird zur Pause, alles andere entfällt. */
        fun toMarkup(text: String): String = Regex("\\[([a-zA-Z ]{2,24})]\\s*").replace(text) { m ->
            when (m.groupValues[1].lowercase().trim()) { "sighs", "sigh", "exhales", "pauses", "pause" -> "[pause] "; else -> "" }
        }.trim()
    }

    /** Erzeugt MP3. useMarkup=false als Rückfall, falls „markup“ abgelehnt wird. */
    fun tts(text: String, voice: String, out: File, useMarkup: Boolean = true, speakingRate: Double = 1.0) {
        val c = URL(endpoint).openConnection() as HttpURLConnection
        c.requestMethod = "POST"; c.doOutput = true; c.connectTimeout = 8000; c.readTimeout = 20000
        c.setRequestProperty("Content-Type", "application/json; charset=utf-8")
        c.setRequestProperty("x-goog-api-key", apiKey)
        androidPackage?.let { c.setRequestProperty("X-Android-Package", it) }
        androidCert?.let { c.setRequestProperty("X-Android-Cert", it) }
        val input = if (useMarkup) JSONObject().put("markup", toMarkup(text)) else JSONObject().put("text", Speaker.stripTags(text))
        val name = if (voice.startsWith("de-DE-")) voice else "de-DE-Chirp3-HD-$voice"
        val body = JSONObject().put("input", input)
            .put("voice", JSONObject().put("languageCode", "de-DE").put("name", name))
            .put("audioConfig", JSONObject().put("audioEncoding", "MP3").put("speakingRate", speakingRate))
        c.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
        val code = c.responseCode
        if (code != 200) {
            val err = c.errorStream?.bufferedReader()?.use { it.readText() }?.take(300) ?: ""
            if (useMarkup && code == 400 && ("markup" in err.lowercase() || "input" in err.lowercase())) return tts(text, voice, out, false, speakingRate)
            throw when (code) {
                401, 403 -> SecurityException("Google-Stimme: Schlüssel abgelehnt ($code). ${err.take(160)}")
                429 -> IllegalStateException("Google-Stimme: Kontingent erreicht")
                else -> IllegalStateException("Google-Stimme $code: ${err.take(160)}")
            }
        }
        val audio = JSONObject(c.inputStream.bufferedReader().use { it.readText() }).optString("audioContent")
        if (audio.isEmpty()) throw IllegalStateException("Google-Stimme: leere Antwort")
        val tmp = File(out.path + ".tmp")
        tmp.writeBytes(decode(audio))
        tmp.renameTo(out)
    }

    /** Base64 (Android-Implementierung; in JVM-Tests durch java.util.Base64 ersetzt). */
    private fun decode(b64: String): ByteArray = try { Base64.decode(b64, Base64.DEFAULT) ?: java.util.Base64.getDecoder().decode(b64) }
        catch (_: Throwable) { java.util.Base64.getDecoder().decode(b64) }
}
