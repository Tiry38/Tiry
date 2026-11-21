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
        /** Es wurde gar nicht gesprochen. */
        fun onNothing()
        /** Es wurde gesprochen, aber nichts verstanden (nach stillen Wiederholungen). */
        fun onNotUnderstood()
        /** Ernstes Problem, das Tiry wissen muss (fehlendes Recht, kein Netz) – menschlich formuliert. */
        fun onListenError(msg: String)
    }

    private var sr: SpeechRecognizer? = null
    private val main = android.os.Handler(android.os.Looper.getMainLooper())
    @Volatile private var session = 0

    /**
     * Hört zu. Technische Aussetzer der Spracherkennung werden still wiederholt (bis zu 2×, dabei wird auf eine andere
     * Erkennung gewechselt: Google → On-Device → Standard). Nur wenn wirklich gesprochen wurde, meldet Luna „nicht verstanden“.
     */
    fun listen(cb: Callback, longPause: Boolean = false, attempt: Int = 0, spokeBefore: Boolean = false) {
        cancel()
        val my = ++session
        val r = try { createRecognizer(attempt) } catch (_: Exception) { null }
        if (r == null) { cb.onListenError("Auf dem Handy fehlt die Google-Spracherkennung. Installier bitte die Google-App."); return }
        sr = r
        var done = false
        var spoke = spokeBefore
        fun retryOr(fallback: () -> Unit) {
            if (attempt < 2) main.postDelayed({ if (my == session) listen(cb, longPause, attempt + 1, spoke) }, 350)
            else fallback()
        }
        r.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {}
            override fun onBeginningOfSpeech() { spoke = true }
            override fun onRmsChanged(rmsdB: Float) { cb.onLevel(((rmsdB + 2f) / 12f).coerceIn(0f, 1f)) }
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() { cb.onLevel(0f) }
            override fun onError(error: Int) {
                if (done || my != session) return; done = true
                when (error) {
                    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> if (spoke) cb.onNotUnderstood() else cb.onNothing()
                    SpeechRecognizer.ERROR_NO_MATCH -> if (spoke) cb.onNotUnderstood() else cb.onNothing()
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> cb.onListenError("Mir fehlt das Recht aufs Mikrofon. Schau mal in meine Einstellungen.")
                    SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT ->
                        retryOr { cb.onListenError("Ich hab gerade kein Netz, deshalb versteh ich dich nicht.") }
                    // Alles andere (belegt, Client, Server, Sprache nicht verfügbar …) → still nochmal, mit anderer Erkennung
                    else -> retryOr { if (spoke) cb.onNotUnderstood() else cb.onNothing() }
                }
            }
            override fun onResults(results: Bundle?) {
                if (done || my != session) return; done = true
                val t = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.trim().orEmpty()
                if (t.isNotBlank()) cb.onHeard(t) else if (spoke) cb.onNotUnderstood() else cb.onNothing()
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
            .putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, if (longPause) 1800L else 1300L)
            .putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, if (longPause) 1500L else 1100L)
        try { r.startListening(i) } catch (_: Exception) { done = true; retryOr { cb.onNothing() } }
    }

    /**
     * Immer eine ECHTE Spracherkennung nehmen – nie Lunas eigenen Platzhalter (der wird zum Standard, wenn Luna
     * digitaler Assistent ist, und versteht nichts). Bevorzugt Google, sonst Samsung/andere, sonst die On-Device-Erkennung.
     */
    private fun createRecognizer(attempt: Int): SpeechRecognizer {
        val services = ctx.packageManager.queryIntentServices(Intent(android.speech.RecognitionService.SERVICE_INTERFACE), 0)
            .map { it.serviceInfo }.filter { it.packageName != ctx.packageName }
        val google = services.firstOrNull { it.packageName == "com.google.android.googlequicksearchbox" }
            ?: services.firstOrNull { it.packageName.startsWith("com.google") }
        val onDevice = android.os.Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(ctx)
        // Versuch 0: Google · Versuch 1: On-Device (falls vorhanden) · Versuch 2: irgendeine andere echte Erkennung
        return when {
            attempt == 0 && google != null -> SpeechRecognizer.createSpeechRecognizer(ctx, android.content.ComponentName(google.packageName, google.name))
            attempt <= 1 && onDevice -> SpeechRecognizer.createOnDeviceSpeechRecognizer(ctx)
            else -> (services.firstOrNull { it.packageName != google?.packageName } ?: google)
                ?.let { SpeechRecognizer.createSpeechRecognizer(ctx, android.content.ComponentName(it.packageName, it.name)) }
                ?: throw IllegalStateException("keine Spracherkennung")
        }
    }

    fun cancel() {
        session++
        try { sr?.cancel(); sr?.destroy() } catch (_: Exception) {}
        sr = null
    }
}
