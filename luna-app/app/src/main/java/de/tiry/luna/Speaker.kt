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
        val text = clean(raw)
        if (text.isBlank()) { main.post(onDone); return }
        val my = ++token
        pendingDone = onDone
        if (usesHumanVoice) {
            // Satzweise: erster Satz sofort, die nächsten werden erzeugt, während Luna schon spricht
            val parts = chunks(text)
            val files = parts.map { part -> io.submit<File?> { try { fetchEleven(part) } catch (e: Exception) { lastError = "Stimme: ${e.message}"; null } } }
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

    private fun cacheFile(text: String): File {
        val key = prefs.elevenVoice + "|" + prefs.elevenModel + "|" + text
        val h = MessageDigest.getInstance("SHA-1").digest(key.toByteArray()).joinToString("") { "%02x".format(it) }
        return File(cacheDir, "$h.mp3")
    }

    /** Holt Audio von ElevenLabs (oder aus dem Speicher). */
    private fun fetchEleven(text: String): File {
        val f = cacheFile(text)
        if (f.exists() && f.length() > 1000) return f
        val c = URL("https://api.elevenlabs.io/v1/text-to-speech/${prefs.elevenVoice}?output_format=mp3_44100_128").openConnection() as HttpURLConnection
        c.requestMethod = "POST"; c.doOutput = true; c.connectTimeout = 10000; c.readTimeout = 30000
        c.setRequestProperty("xi-api-key", prefs.elevenKey)
        c.setRequestProperty("Content-Type", "application/json")
        c.setRequestProperty("Accept", "audio/mpeg")
        val body = JSONObject().put("text", text).put("model_id", prefs.elevenModel)
            .put("voice_settings", JSONObject().put("stability", 0.42).put("similarity_boost", 0.8).put("style", 0.3).put("use_speaker_boost", true))
        c.outputStream.use { it.write(body.toString().toByteArray()) }
        if (c.responseCode !in 200..299) {
            val err = c.errorStream?.bufferedReader()?.use { it.readText() }?.take(200) ?: ""
            throw IllegalStateException("ElevenLabs ${c.responseCode} $err")
        }
        val tmp = File(cacheDir, f.name + ".tmp")
        c.inputStream.use { inp -> tmp.outputStream().use { inp.copyTo(it) } }
        tmp.renameTo(f)
        // Speicher klein halten: nur die neuesten 150 Sätze behalten
        cacheDir.listFiles()?.sortedByDescending { it.lastModified() }?.drop(150)?.forEach { it.delete() }
        return f
    }

    /** Begrüßungen vorab erzeugen, damit Luna nach „Hey Luna“ ohne Verzögerung antwortet. */
    fun precache(phrases: List<String>) {
        if (!usesHumanVoice) return
        io.execute { phrases.forEach { try { fetchEleven(clean(it)) } catch (e: Exception) { lastError = "Stimme: ${e.message}" } } }
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

        /** Teilt in Sprech-Häppchen: erster Satz allein (schneller Start), danach Blöcke bis ~220 Zeichen. */
        fun chunks(text: String): List<String> {
            val sentences = text.split(Regex("(?<=[.!?…])\\s+")).map { it.trim() }.filter { it.isNotEmpty() }
            if (sentences.size <= 1) return listOf(text)
            val out = mutableListOf(sentences[0])
            val cur = StringBuilder()
            for (snt in sentences.drop(1)) {
                if (cur.isNotEmpty() && cur.length + snt.length > 220) { out += cur.toString(); cur.clear() }
                if (cur.isNotEmpty()) cur.append(' ')
                cur.append(snt)
            }
            if (cur.isNotEmpty()) out += cur.toString()
            return out
        }

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
