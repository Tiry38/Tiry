package de.tiry.luna

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer

/** Versteht, was Tiry nach „Hey Luna“ sagt (Android-Spracherkennung, Deutsch, sehr genau). Nur auf dem Haupt-Thread benutzen. */
class Listener(private val ctx: Context) {

    interface Callback {
        fun onLevel(level: Float)
        fun onPartial(text: String)
        fun onHeard(text: String)
        fun onNothing()
        fun onListenError(msg: String)
    }

    private var sr: SpeechRecognizer? = null

    fun listen(cb: Callback, longPause: Boolean = false) {
        cancel()
        if (!SpeechRecognizer.isRecognitionAvailable(ctx)) { cb.onListenError("Auf diesem Handy ist keine Spracherkennung installiert (Google-App nötig)."); return }
        val r = SpeechRecognizer.createSpeechRecognizer(ctx)
        sr = r
        var done = false
        r.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) { cb.onLevel(((rmsdB + 2f) / 12f).coerceIn(0f, 1f)) }
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() { cb.onLevel(0f) }
            override fun onError(error: Int) {
                if (done) return; done = true
                when (error) {
                    SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> cb.onNothing()
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> cb.onListenError("Mikrofon-Recht fehlt.")
                    SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> cb.onListenError("Kein Internet für die Spracherkennung.")
                    else -> cb.onNothing()
                }
            }
            override fun onResults(results: Bundle?) {
                if (done) return; done = true
                val t = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.trim().orEmpty()
                if (t.isBlank()) cb.onNothing() else cb.onHeard(t)
            }
            override fun onPartialResults(partial: Bundle?) {
                partial?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.let { if (it.isNotBlank()) cb.onPartial(it) }
            }
            override fun onEvent(eventType: Int, params: Bundle?) {}
        })
        val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "de-DE")
            .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            .putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, if (longPause) 1800L else 1200L)
            .putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, if (longPause) 1500L else 1000L)
        r.startListening(i)
    }

    fun cancel() {
        try { sr?.cancel(); sr?.destroy() } catch (_: Exception) {}
        sr = null
    }
}
