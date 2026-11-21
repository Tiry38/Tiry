package de.tiry.luna

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionService
import android.service.voice.VoiceInteractionService
import android.service.voice.VoiceInteractionSession
import android.service.voice.VoiceInteractionSessionService

/*
 * Luna als System-Assistent von Android (Einstellungen → Apps → Standard-Apps → Digitaler Assistent → Luna).
 * Dann startet Luna statt Google Assistant: langes Drücken der Power-/Home-Taste, Wischen aus der Ecke,
 * Headset-Taste – auch auf dem Sperrbildschirm. Das ist die tiefste Einbindung, die Android ohne Root erlaubt.
 */

/** Wird vom System dauerhaft gebunden, solange Luna Standard-Assistent ist. */
class LunaVoiceService : VoiceInteractionService()

class LunaSessionService : VoiceInteractionSessionService() {
    override fun onNewSession(args: Bundle?): VoiceInteractionSession = LunaSession(this)
}

/** Assistent-Taste gedrückt → Luna hört sofort zu, ohne „Hey Luna“. */
class LunaSession(ctx: Context) : VoiceInteractionSession(ctx) {
    override fun onShow(args: Bundle?, showFlags: Int) {
        super.onShow(args, showFlags)
        Assist.trigger(context)
        hide()
    }
}

/** Pflicht-Bestandteil eines System-Assistenten. Luna nutzt intern die Google-Erkennung, daher nur ein Platzhalter. */
class LunaRecognitionService : RecognitionService() {
    override fun onStartListening(recognizerIntent: Intent?, listener: Callback?) { listener?.error(android.speech.SpeechRecognizer.ERROR_CLIENT) }
    override fun onCancel(listener: Callback?) {}
    override fun onStopListening(listener: Callback?) {}
}

/** Für „Assist“-Gesten und Sprachbefehl-Tasten (ACTION_ASSIST / VOICE_COMMAND), falls Luna kein System-Assistent ist. */
class AssistActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Assist.trigger(this)
        finish()
    }
}

object Assist {
    fun trigger(ctx: Context) {
        try { LunaService.send(ctx, LunaService.ACTION_LISTEN) }
        catch (_: Exception) { ctx.startActivity(Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    }
}
