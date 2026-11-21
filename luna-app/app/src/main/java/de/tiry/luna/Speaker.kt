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

    private fun pickBestVoice(): Voice? = try {
        tts?.voices?.filter { it.locale.language == "de" && !it.features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED) }
            ?.sortedWith(compareByDescending<Voice> { it.quality }.thenBy { if (it.locale.country == "DE") 0 else 1 }.thenBy { it.latency })
            ?.firstOrNull()
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
            io.execute {
                val file = try { fetchEleven(text) } catch (e: Exception) { lastError = "Stimme: ${e.message}"; null }
                main.post {
                    if (my != token) return@post
                    if (file != null) playFile(file, my) else speakLocal(text, my)
                }
            }
        } else speakLocal(text, my)
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

    private fun playFile(f: File, my: Int) {
        try {
            val mp = MediaPlayer()
            mp.setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANT)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
            mp.setDataSource(f.absolutePath)
            mp.setOnCompletionListener { finish(my) }
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

    fun shutdown() { stop(); tts?.shutdown(); io.shutdown() }

    companion object {
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
