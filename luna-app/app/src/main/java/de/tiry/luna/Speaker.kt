package de.tiry.luna

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.Locale
import java.util.concurrent.Executors

/**
 * Lunas Stimme.
 *  - Mit ElevenLabs-Key: echte, menschlich klingende Stimme (multilingual_v2), Begrüßungen werden vorab gespeichert → sofort da.
 *  - Ohne Key: beste deutsche Stimme, die auf dem Handy installiert ist (Google-Sprachausgabe).
 */
class Speaker(private val ctx: Context, private val prefs: Prefs) {

    private val main = Handler(Looper.getMainLooper())
    private val io = Executors.newSingleThreadExecutor()
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var player: MediaPlayer? = null
    private var pendingDone: (() -> Unit)? = null
    @Volatile private var token = 0
    var lastError: String? = null; private set

    private val cacheDir = File(ctx.filesDir, "voice").apply { mkdirs() }

    init {
        tts = TextToSpeech(ctx.applicationContext) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale.GERMANY
                pickBestVoice()?.let { tts?.voice = it }
                tts?.setSpeechRate(1.02f)
                ttsReady = true
            }
        }
    }

    /** Alle installierten deutschen Stimmen (für die Auswahl in den Einstellungen). */
    fun germanVoices(): List<Voice> = try {
        tts?.voices?.filter { it.locale.language == "de" && !it.features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED) }
            ?.sortedWith(compareByDescending<Voice> { femaleScore(it.name) }.thenByDescending { it.quality }.thenBy { it.name }) ?: emptyList()
    } catch (_: Exception) { emptyList() }

    val ready get() = ttsReady

    fun useVoice(name: String) {
        prefs.ttsVoice = name
        tts?.voices?.firstOrNull { it.name == name }?.let { tts?.voice = it }
    }

    /** Gewählte Stimme, sonst automatisch weiblich (Samsung „SMTf…“, Namen mit „female“), dann beste Qualität. */
    private fun pickBestVoice(): Voice? = try {
        val all = germanVoices()
        all.firstOrNull { it.name == prefs.ttsVoice } ?: all.firstOrNull()
    } catch (_: Exception) { null }

    val usesHumanVoice get() = prefs.elevenKey.isNotBlank()

    /** Spricht den Text. [onDone] kommt immer genau einmal (auch bei Fehler/Abbruch). */
    fun speak(raw: String, onDone: () -> Unit) {
        pendingDone = null
        stop()
        val text = pronounce(clean(if (prefs.voiceTags) raw else stripTags(raw)))
        if (text.isBlank()) { main.post(onDone); return }
        val my = ++token
        pendingDone = onDone
        if (usesHumanVoice) {
            // Erster Satz sofort, der Rest als längerer Block (durchgehende Satzmelodie) – mit Kontext davor/danach
            val parts = chunks(text)
            val files = parts.mapIndexed { i, part -> io.submit<File?> {
                try { fetchEleven(part, parts.getOrNull(i - 1), parts.getOrNull(i + 1)) } catch (e: Exception) { lastError = "Stimme: ${e.message}"; null } } }
            playSeq(files, parts, 0, my)
        } else speakLocal(text, my)
    }

    private val waiter = Executors.newCachedThreadPool()

    private fun playSeq(files: List<java.util.concurrent.Future<File?>>, parts: List<String>, i: Int, my: Int) {
        if (my != token) return
        if (i >= files.size) { finish(my); return }
        waiter.execute {
            val f = try { files[i].get(40, java.util.concurrent.TimeUnit.SECONDS) } catch (_: Exception) { null }
            main.post {
                if (my != token) return@post
                if (f != null) playFile(f, my) { playSeq(files, parts, i + 1, my) }
                else speakLocal(parts.drop(i).joinToString(" "), my)   // Netz weg → Rest mit Handy-Stimme
            }
        }
    }

    private fun finish(my: Int) {
        if (my != token) return
        val d = pendingDone; pendingDone = null
        d?.invoke()
    }

    fun stop() {
        token++
        try { player?.stop() } catch (_: Exception) {}
        player?.release(); player = null
        tts?.stop()
        val d = pendingDone; pendingDone = null
        d?.let { main.post(it) }
    }

    val isSpeaking get() = player?.isPlaying == true || tts?.isSpeaking == true

    private fun playFile(f: File, my: Int, next: () -> Unit) {
        try {
            val mp = MediaPlayer()
            mp.setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANT)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
            mp.setDataSource(f.absolutePath)
            mp.setOnCompletionListener { it.release(); if (player === it) player = null; if (my == token) next() }
            mp.setOnErrorListener { _, _, _ -> finish(my); true }
            mp.prepare(); mp.start()
            player = mp
        } catch (e: Exception) {
            lastError = "Wiedergabe: ${e.message}"; finish(my)
        }
    }

    private fun speakLocal(text: String, my: Int) {
        val t = tts
        if (t == null || !ttsReady) { main.postDelayed({ if (ttsReady) speakLocal(text, my) else finish(my) }, 600); return }
        // in den Einstellungen gewählte Stimme übernehmen (auch wenn sie inzwischen geändert wurde)
        if (prefs.ttsVoice.isNotBlank() && t.voice?.name != prefs.ttsVoice) t.voices?.firstOrNull { it.name == prefs.ttsVoice }?.let { t.voice = it }
        t.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(id: String?) {}
            override fun onDone(id: String?) { main.post { finish(my) } }
            @Deprecated("alt") override fun onError(id: String?) { main.post { finish(my) } }
            override fun onError(utteranceId: String?, errorCode: Int) { main.post { finish(my) } }
        })
        val params = android.os.Bundle().apply { putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, android.media.AudioManager.STREAM_MUSIC) }
        t.speak(text, TextToSpeech.QUEUE_FLUSH, params, "luna-$my")
    }

    /** Namen so aussprechen, wie Tiry es will („Tiry“ geschrieben, „Tiri“ gesprochen). */
    private fun pronounce(t: String): String {
        val written = prefs.userName; val spoken = prefs.spokenName
        return if (written.isBlank() || written == spoken) t else t.replace(Regex("\\b" + Regex.escape(written) + "\\b", RegexOption.IGNORE_CASE), spoken)
    }

    private fun cacheFile(text: String): File {
        val key = prefs.elevenVoice + "|" + prefs.elevenModel + "|" + text
        val h = MessageDigest.getInstance("SHA-1").digest(key.toByteArray()).joinToString("") { "%02x".format(it) }
        return File(cacheDir, "$h.mp3")
    }

    private object Tune {
        // Bits in prefs.elevenTune: was das Konto NICHT akzeptiert hat → beim nächsten Mal gleich weglassen
        const val NO_CONTEXT = 1      // previous_text/next_text
        const val FMT_128 = 2         // mp3_44100_192 (braucht Creator-Abo) → 128
        const val STAB_HALF = 4       // Stabilität fest 0.5 statt 0.4
        const val NO_LANG = 8         // language_code
    }

    /**
     * Holt Audio von ElevenLabs (oder aus dem Speicher). Für maximal menschlichen Klang:
     * neuestes Modell (v4), Sprache fest Deutsch, Kontext davor/danach (durchgehende Satzmelodie), 192 kbit/s,
     * ausdrucksstarke Einstellungen. Lehnt das Konto etwas ab, lernt Luna das und lässt es weg – erst dann wird
     * das Modell gewechselt (v4 → v3 → Multilingual v2).
     */
    private fun fetchEleven(text: String, prev: String? = null, next: String? = null): File {
        val f = cacheFile(text)
        if (f.exists() && f.length() > 1000) return f
        val model = prefs.elevenModel
        val tune = prefs.elevenTune
        val modern = model == "eleven_v4" || model == "eleven_v3"
        val fmt = if (tune and Tune.FMT_128 != 0) "mp3_44100_128" else "mp3_44100_192"
        val c = URL("https://api.elevenlabs.io/v1/text-to-speech/${prefs.elevenVoice}?output_format=$fmt").openConnection() as HttpURLConnection
        c.requestMethod = "POST"; c.doOutput = true; c.connectTimeout = 10000; c.readTimeout = 45000
        c.setRequestProperty("xi-api-key", prefs.elevenKey)
        c.setRequestProperty("Content-Type", "application/json")
        c.setRequestProperty("Accept", "audio/mpeg")
        val stability = if (tune and Tune.STAB_HALF != 0) 0.5 else if (modern) 0.4 else 0.35
        val body = JSONObject().put("text", text).put("model_id", model)
            .put("voice_settings", JSONObject().put("stability", stability).put("similarity_boost", 0.8)
                .put("style", if (modern) 0.5 else 0.45).put("use_speaker_boost", true).put("speed", 1.0))
            .put("apply_text_normalization", "auto")
        if (modern && tune and Tune.NO_LANG == 0) body.put("language_code", "de")
        if (tune and Tune.NO_CONTEXT == 0) { prev?.let { body.put("previous_text", it) }; next?.let { body.put("next_text", it) } }
        c.outputStream.use { it.write(body.toString().toByteArray()) }
        val code = c.responseCode
        if (code !in 200..299) {
            val err = (c.errorStream?.bufferedReader()?.use { it.readText() } ?: "").take(300)
            if (code == 401) throw IllegalStateException("ElevenLabs-Schlüssel ungültig")
            if (code in 400..499 && code != 429) {
                val e = err.lowercase()
                // Kontingent aufgebraucht / Text-Problem → nichts „verlernen“, nur diesmal Handy-Stimme
                if ("quota" in e || "credit" in e || "character" in e || "too long" in e) throw IllegalStateException("ElevenLabs: $err")
                // Gewählte Stimme nicht nutzbar → zurück auf Sarah (statt fälschlich das Modell zu verschlechtern)
                if ("voice" in e && ("not found" in e || "not_found" in e || "does not exist" in e || "permission" in e) &&
                    prefs.elevenVoice != Prefs.DEFAULT_VOICE) {
                    prefs.elevenVoice = Prefs.DEFAULT_VOICE
                    return fetchEleven(text, prev, next)
                }
                // Schritt für Schritt das Abgelehnte weglassen, gelernt wird dauerhaft
                val fix = when {
                    "output_format" in e || "format" in e || "tier" in e || "subscription" in e -> Tune.FMT_128
                    "previous_text" in e || "next_text" in e -> Tune.NO_CONTEXT
                    "stability" in e -> Tune.STAB_HALF
                    "language" in e -> Tune.NO_LANG
                    else -> listOf(Tune.NO_CONTEXT, Tune.FMT_128, Tune.STAB_HALF, Tune.NO_LANG).firstOrNull { tune and it == 0 } ?: 0
                }
                if (fix != 0 && tune and fix == 0) { prefs.elevenTune = tune or fix; return fetchEleven(text, prev, next) }
                // alles probiert → älteres Modell
                val older = when (model) { "eleven_v4" -> "eleven_v3"; "eleven_v3" -> "eleven_multilingual_v2"; else -> null }
                if (older != null) {
                    prefs.elevenModel = older; prefs.elevenTune = 0
                    return fetchEleven(if (older == "eleven_multilingual_v2") stripTags(text) else text, prev, next)
                }
            }
            throw IllegalStateException("ElevenLabs $code $err")
        }
        val tmp = File(cacheDir, f.name + ".tmp")
        c.inputStream.use { inp -> tmp.outputStream().use { inp.copyTo(it) } }
        tmp.renameTo(f)
        cacheDir.listFiles()?.sortedByDescending { it.lastModified() }?.drop(150)?.forEach { it.delete() }
        return f
    }

    data class VoiceInfo(val id: String, val name: String, val info: String, val preview: String?)

    /** Weibliche Stimmen fürs Deutsche aus dem ElevenLabs-Konto + der Community-Bibliothek (zum Probehören). Hintergrund-Thread! */
    fun femaleVoices(): List<VoiceInfo> {
        val out = LinkedHashMap<String, VoiceInfo>()
        for (q in listOf("gender=female&page_size=50", "gender=female&language=de&voice_type=community&page_size=50&sort=name")) {
            try {
                val c = URL("https://api.elevenlabs.io/v2/voices?$q").openConnection() as HttpURLConnection
                c.setRequestProperty("xi-api-key", prefs.elevenKey); c.connectTimeout = 10000; c.readTimeout = 15000
                if (c.responseCode != 200) continue
                val arr = JSONObject(c.inputStream.bufferedReader().use { it.readText() }).optJSONArray("voices") ?: continue
                for (i in 0 until arr.length()) {
                    val v = arr.getJSONObject(i)
                    val labels = v.optJSONObject("labels")
                    val gender = labels?.optString("gender", "") ?: ""
                    if (gender.isNotBlank() && gender != "female") continue
                    val de = v.optJSONArray("verified_languages")?.let { l -> (0 until l.length()).any { l.getJSONObject(it).optString("language") == "de" } } ?: false
                    val info = listOfNotNull(if (de) "Deutsch" else null, labels?.optString("accent")?.takeIf { it.isNotBlank() },
                        labels?.optString("age")?.takeIf { it.isNotBlank() }, labels?.optString("descriptive")?.takeIf { it.isNotBlank() }).joinToString(" · ")
                    out.putIfAbsent(v.getString("voice_id"), VoiceInfo(v.getString("voice_id"), v.optString("name"), info, v.optString("preview_url").ifBlank { null }))
                }
            } catch (_: Exception) {}
        }
        return out.values.toList()
    }

    /** Hörprobe abspielen (Vorschau-Datei von ElevenLabs). */
    fun playPreview(url: String) {
        pendingDone = null; stop()
        try {
            val mp = MediaPlayer()
            mp.setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANT).build())
            mp.setDataSource(url); mp.setOnPreparedListener { it.start() }
            mp.setOnCompletionListener { it.release(); if (player === it) player = null }
            mp.prepareAsync(); player = mp
        } catch (e: Exception) { lastError = "Hörprobe: ${e.message}" }
    }

    /** Begrüßungen vorab erzeugen, damit Luna nach „Hey Luna“ ohne Verzögerung antwortet. */
    fun precache(phrases: List<String>) {
        if (!usesHumanVoice) return
        io.execute { phrases.forEach { try { fetchEleven(pronounce(clean(it))) } catch (e: Exception) { lastError = "Stimme: ${e.message}" } } }
    }

    fun shutdown() { stop(); tts?.shutdown(); io.shutdown(); waiter.shutdown() }

    companion object {
        /** Grobe Erkennung weiblicher Stimmen am Namen (Android liefert kein Geschlecht mit). */
        fun femaleScore(name: String): Int {
            val n = name.lowercase()
            return when {
                "female" in n || Regex("smtf\\d").containsMatchIn(n) || Regex("[-_]f0\\d").containsMatchIn(n) -> 2
                "male" in n || Regex("smtm\\d").containsMatchIn(n) || Regex("[-_]m0\\d").containsMatchIn(n) -> 0
                else -> 1
            }
        }

        /** Teilt in Sprech-Häppchen: erster Satz allein (schneller Start), danach Blöcke bis ~600 Zeichen. */
        fun chunks(text: String): List<String> {
            val sentences = text.split(Regex("(?<=[.!?…])\\s+")).map { it.trim() }.filter { it.isNotEmpty() }
            if (sentences.size <= 1) return listOf(text)
            val out = mutableListOf(sentences[0])
            val cur = StringBuilder()
            for (snt in sentences.drop(1)) {
                if (cur.isNotEmpty() && cur.length + snt.length > 600) { out += cur.toString(); cur.clear() }
                if (cur.isNotEmpty()) cur.append(' ')
                cur.append(snt)
            }
            if (cur.isNotEmpty()) out += cur.toString()
            return out
        }

        /** Emotions-Tags wie [laughs] oder [sarcastic] entfernen (für Anzeige und Stimmen ohne v3). */
        fun stripTags(s: String) = s.replace(Regex("\\[[a-zA-Z ]{2,24}]\\s*"), "").trim()

        /** Entfernt Markdown, Emojis & Co., damit es gesprochen natürlich klingt. */
        fun clean(s: String): String = s
            .replace(Regex("```[\\s\\S]*?```"), " ")
            .replace(Regex("[*_#`>|~]"), "")
            .replace(Regex("\\[(.*?)]\\((.*?)\\)"), "$1")
            .replace(Regex("https?://\\S+"), "den Link")
            .replace(Regex("[\\x{1F000}-\\x{1FAFF}\\x{2600}-\\x{27BF}\\x{FE0F}]"), "")
            .replace(Regex("\\s+"), " ")
            .trim()
    }
}
