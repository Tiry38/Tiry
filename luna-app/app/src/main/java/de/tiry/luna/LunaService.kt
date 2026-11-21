package de.tiry.luna

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors

/**
 * Herzstück: läuft im Hintergrund (auch bei ausgeschaltetem Bildschirm), wartet auf „Hey Luna“,
 * begrüßt, hört zu, denkt nach, antwortet – und bleibt für Nachfragen kurz im Gespräch.
 */
class LunaService : Service(), WakeWordEngine.Callback, Listener.Callback {

    companion object {
        const val ACTION_START = "de.tiry.luna.START"
        const val ACTION_STOP = "de.tiry.luna.STOP"
        const val ACTION_LISTEN = "de.tiry.luna.LISTEN"
        const val ACTION_SAY = "de.tiry.luna.SAY"
        const val ACTION_INTERRUPT = "de.tiry.luna.INTERRUPT"
        const val ACTION_RELOAD = "de.tiry.luna.RELOAD"
        const val ACTION_QUICK = "de.tiry.luna.QUICK"
        const val CH_SERVICE = "luna_service"
        val FILLERS = listOf("Sekunde.", "Mhm, bin dran.", "Moment.", "Schau ich nach.", "Gib mir 'nen Augenblick.", "Okay, Moment.")
        const val CH_REMINDER = "luna_reminder"
        private const val NOTIF_ID = 7

        @Volatile var running = false; private set

        fun start(ctx: Context, action: String = ACTION_START) {
            val i = Intent(ctx, LunaService::class.java).setAction(action)
            if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i) else ctx.startService(i)
        }

        fun send(ctx: Context, action: String, extra: String? = null) {
            val i = Intent(ctx, LunaService::class.java).setAction(action).apply { if (extra != null) putExtra("id", extra) }
            if (running) ctx.startService(i)
            else if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i) else ctx.startService(i)
        }

        fun ensureChannels(ctx: Context) {
            val nm = ctx.getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(NotificationChannel(CH_SERVICE, "Luna hört zu", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Zeigt an, dass Luna auf „Hey Luna“ wartet."; setShowBadge(false)
            })
            nm.createNotificationChannel(NotificationChannel(CH_REMINDER, "Erinnerungen", NotificationManager.IMPORTANCE_HIGH))
        }

        fun postStartHint(ctx: Context) {
            ensureChannels(ctx)
            val pi = PendingIntent.getActivity(ctx, 1, Intent(ctx, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
            val n = NotificationCompat.Builder(ctx, CH_REMINDER).setSmallIcon(R.drawable.ic_stat_luna)
                .setContentTitle("Luna antippen zum Aufwecken")
                .setContentText("Nach dem Neustart erlaubt Android das Mikrofon erst, wenn du Luna einmal öffnest.")
                .setContentIntent(pi).setAutoCancel(true).build()
            ctx.getSystemService(NotificationManager::class.java).notify(99, n)
        }
    }

    private val main = Handler(Looper.getMainLooper())
    private val worker = Executors.newSingleThreadExecutor()
    private lateinit var prefs: Prefs
    private lateinit var tools: PhoneTools
    private lateinit var speaker: Speaker
    private lateinit var wake: WakeWordEngine
    private lateinit var listener: Listener
    private var wakeLock: PowerManager.WakeLock? = null
    private var focus: AudioFocusRequest? = null

    private var inConversation = false
    private var followUps = 0
    private var conversationId = 0

    // ---------- Lebenszyklus ----------
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        prefs = Prefs(this)
        tools = PhoneTools(this, prefs)
        speaker = Speaker(this, prefs)
        wake = WakeWordEngine(this, prefs)
        listener = Listener(this)
        ensureChannels(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> { prefs.wakeWanted = false; shutdown(); return START_NOT_STICKY }
            else -> if (!running) boot()
        }
        when (intent?.action) {
            ACTION_LISTEN -> main.postDelayed({ beginListening(greet = false) }, if (wake.ready) 50 else 300)
            ACTION_INTERRUPT -> interrupt()
            ACTION_SAY -> intent.getStringExtra("text")?.let { say(it) }
            ACTION_QUICK -> intent.getStringExtra("id")?.let { quick(it) }
            ACTION_RELOAD -> { speaker.precache(greetings() + FILLERS); if (!inConversation) startWake() }
        }
        return START_STICKY
    }

    private fun boot() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            postStartHint(this); stopSelf(); return
        }
        val n = notification("Starte …")
        try {
            if (Build.VERSION.SDK_INT >= 30) startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
            else startForeground(NOTIF_ID, n)
        } catch (e: Exception) {
            // z. B. Android 14+ nach Neustart: Mikrofon-Dienst nur, wenn Luna im Vordergrund war
            postStartHint(this); stopSelf(); return
        }
        running = true
        prefs.wakeWanted = true
        if (prefs.stayAwake) {
            wakeLock = (getSystemService(POWER_SERVICE) as PowerManager).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "luna:wake").apply { acquire() }
        }
        state(LunaState.LOADING, "Startet …")
        speaker.precache(greetings() + FILLERS)
        worker.execute {
            try {
                wake.load()
                main.post { if (!inConversation) startWake() }
            } catch (e: Throwable) {
                main.post { state(LunaState.ERROR, "Wake-Word nicht verfügbar: ${e.message}. Tippe aufs Mikro zum Sprechen.") }
            }
        }
    }

    private fun shutdown() {
        running = false
        conversationId++
        try { wake.release() } catch (_: Exception) {}
        listener.cancel(); speaker.stop()
        releaseFocus()
        wakeLock?.let { if (it.isHeld) it.release() }; wakeLock = null
        state(LunaState.OFF, "Luna schläft. Tippe auf „Wachmodus“, um sie zu wecken.")
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        running = false
        try { wake.release() } catch (_: Exception) {}
        listener.cancel(); speaker.shutdown(); worker.shutdownNow()
        wakeLock?.let { if (it.isHeld) it.release() }
        super.onDestroy()
    }

    // ---------- Ablauf ----------
    private fun startWake() {
        if (!running) return
        barge.stop()
        inConversation = false
        releaseFocus()
        if (!wake.ready) return
        wake.start(this)
        state(LunaState.WAITING, "Bereit")
    }

    override fun onWake(heard: String) { main.post { if (!inConversation) { wakeScreen(); beginListening(greet = true) } } }

    /** Handy erwacht: Bildschirm an und Luna im Vordergrund – auch über dem Sperrbildschirm. */
    private fun wakeScreen() {
        if (!prefs.wakeScreen) return
        try {
            @Suppress("DEPRECATION")
            val wl = (getSystemService(POWER_SERVICE) as PowerManager).newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE, "luna:screen")
            wl.acquire(8000)
        } catch (_: Exception) {}
        try {
            // Cockpit offen → dort bleiben; sonst die schlichte Stimm-Linie über allem zeigen
            if (MainActivity.visible || AwakeActivity.visible) return
            startActivity(Intent(this, AwakeActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION))
        } catch (_: Exception) { /* ohne Bedienungshilfe/Overlay-Recht darf Android die App nicht nach vorn holen */ }
    }

    override fun onWakeError(msg: String) {
        main.post {
            state(LunaState.ERROR, "Mikrofon: $msg")
            main.postDelayed({ if (running && !inConversation) startWake() }, 4000)
        }
    }

    private fun beginListening(greet: Boolean) {
        if (!running) return
        inConversation = true
        followUps = 0
        val id = ++conversationId
        wake.stop()
        speaker.stop()
        grabFocus()
        if (greet) {
            val g = greeting()
            LunaBus.update { it.copy(userText = "", lunaText = g) }
            state(LunaState.SPEAKING, g)
            talk(g, id) { listenNow() }
        } else main.postDelayed({ if (id == conversationId) listenNow() }, 250)
    }

    private fun listenNow() {
        if (!running) return
        barge.stop()
        state(LunaState.LISTENING, "Ich höre …")
        listener.listen(this, longPause = followUps == 0)
    }

    override fun onLevel(level: Float) { LunaBus.update { it.copy(level = level) } }
    override fun onPartial(text: String) { LunaBus.update { it.copy(userText = text) } }

    override fun onNothing() {
        // Direkt nach dem Aufwecken nichts gehört → kurz nachfragen; im Nachfrage-Modus still zurück
        if (followUps == 0 && inConversation) {
            val id = conversationId
            val msg = listOf("Hm? Ich hab nichts gehört.", "Ich bin noch da, falls du was brauchst.", "Na gut, dann eben nicht.").random()
            LunaBus.update { it.copy(lunaText = msg) }
            state(LunaState.SPEAKING, "Spreche …")
            speaker.speak(msg) { if (id == conversationId) main.postDelayed({ startWake() }, 300) }
            return
        }
        main.postDelayed({ startWake() }, 300)
    }

    private var retries = 0
    override fun onRetry() {
        if (retries++ < 3) main.postDelayed({ listenNow() }, 600)
        else { retries = 0; onListenError("Mein Mikrofon ist gerade belegt. Versuch's gleich nochmal.") }
    }

    override fun onListenError(msg: String) {
        val id = conversationId
        state(LunaState.SPEAKING, msg)
        speaker.speak(msg) { if (id == conversationId) main.postDelayed({ startWake() }, 300) }
    }

    override fun onHeard(text: String) {
        retries = 0
        val id = conversationId
        LunaBus.update { it.copy(userText = text, level = 0f) }
        state(LunaState.THINKING, "Moment …")
        val fast = fastPath(text)
        val brain: Brain = if (prefs.claudeKey.isBlank() || fast) local else claude
        val ctxLine = contextLine()
        // Menschliche Denkpause: dauert es länger, sagt Luna kurz etwas, statt stumm zu sein
        main.postDelayed({
            if (id == conversationId && LunaBus.current.state == LunaState.THINKING && !speaker.isSpeaking)
                speaker.speak(FILLERS.random()) {}
        }, 2300)
        worker.execute {
            val reply = try {
                brain.reply(text, ctxLine) { tool -> LunaBus.update { it.copy(status = toolLabel(tool)) } }
            } catch (e: Exception) { Reply("Da ist etwas schiefgelaufen: ${e.message}") }
            main.post { if (id == conversationId) answer(reply, id) }
        }
    }

    private val barge = BargeIn()
    @Volatile private var barged = false

    /** Sprechen mit Unterbrechungs-Erkennung: Redest du dazwischen, verstummt Luna und hört dir zu. */
    private fun talk(text: String, id: Int, then: () -> Unit) {
        barged = false
        speaker.speak(text) {
            barge.stop()
            if (id != conversationId) return@speak
            if (barged) { barged = false; LunaBus.update { it.copy(userText = "") }; main.postDelayed({ listenNow() }, 120) }
            else then()
        }
        if (prefs.bargeIn && checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            // kurz warten, bis die Wiedergabe läuft (sonst lernt der Detektor Stille statt Echo)
            main.postDelayed({
                if (id == conversationId) barge.start { main.post { if (id == conversationId && !barged) { barged = true; speaker.stop() } } }
            }, 250)
        }
    }

    private fun answer(r: Reply, id: Int) {
        // Luna hat erkannt, dass sie gar nicht gemeint war → still zurück in den Wartemodus
        if (r.text.trim().startsWith("[STILL]") && followUps == 0) {
            // direkt nach „Hey Luna“ war er sicher gemeint → nicht schweigen, sondern nachfragen
            return answer(Reply("Hm? Sag das nochmal, ${prefs.userName}."), id)
        }
        if (r.text.trim().startsWith("[STILL]")) {
            LunaBus.update { it.copy(userText = "", lunaText = "") }
            claude.reset()
            main.postDelayed({ startWake() }, 200)
            return
        }
        LunaBus.update { it.copy(lunaText = Speaker.stripTags(r.text)) }
        state(LunaState.SPEAKING, "Spreche …")
        talk(r.text, id) {
            followUps++
            if (r.end || !prefs.followUp || followUps > 40) main.postDelayed({ startWake() }, 300)
            else main.postDelayed({ listenNow() }, 250)
        }
    }

    private fun say(text: String) {
        conversationId++
        val id = conversationId
        inConversation = true
        wake.stop(); listener.cancel(); grabFocus()
        LunaBus.update { it.copy(lunaText = text) }
        state(LunaState.SPEAKING, "Spreche …")
        speaker.speak(text) { if (id == conversationId) main.postDelayed({ startWake() }, 300) }
    }

    /** Ein-Knopf-Aktion aus der Kontrollleiste: sofort ausführen, Ergebnis kurz ansagen. */
    private fun quick(id: String) {
        conversationId++
        val my = conversationId
        inConversation = true
        wake.stop(); listener.cancel()
        state(LunaState.THINKING, "Erledige das …")
        worker.execute {
            val out = tools.quick(id)
            main.post {
                if (my != conversationId) return@post
                LunaBus.update { it.copy(userText = "", lunaText = out) }
                grabFocus()
                state(LunaState.SPEAKING, "Spreche …")
                speaker.speak(out) { if (my == conversationId) main.postDelayed({ startWake() }, 300) }
            }
        }
    }

    private fun interrupt() {
        conversationId++
        barge.stop(); listener.cancel(); speaker.stop()
        main.postDelayed({ startWake() }, 200)
    }

    // ---------- Gehirne ----------
    private val claude by lazy { ClaudeBrain({ BrainConfig.from(prefs) }, tools) }
    private val local by lazy { LocalBrain(prefs, tools) }

    /** Kurze Standardbefehle erledigt Luna sofort selbst (schneller und ohne KI-Kosten). */
    private fun fastPath(text: String): Boolean {
        if (text.trim().split(Regex("\\s+")).size > 7) return false
        val c = LocalIntentParser.parse(text) ?: return false
        return c.tool in setOf("get_time", "flashlight", "set_timer", "set_alarm", "media_control", "set_volume", "screen_action", "end_conversation")
    }

    private fun contextLine(): String {
        val now = SimpleDateFormat("EEEE, d. MMMM yyyy, HH:mm 'Uhr'", Locale.GERMANY).format(Date())
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        val first = prefs.lastBriefingDay != today
        if (first) prefs.lastBriefingDay = today
        val bat = try { tools.batteryPercent() } catch (_: Exception) { -1 }
        return "Jetzt: $now; Akku $bat %" + (if (first) "; erstes Gespräch heute" else "") +
            (if (followUps == 0) "; direkt nach „Hey Luna“ – du bist gemeint" else "; Nachfrage-Modus – prüfe, ob du gemeint bist")
    }

    private var lastGreeting = ""

    /** Begrüßungen je Tageszeit – Jarvis-Stil, abwechslungsreich. */
    private fun greetingsFor(hour: Int, firstToday: Boolean): List<String> {
        val n = prefs.userName
        val any = listOf("Ja, $n?", "Ich höre.", "Bin da.", "Was liegt an?", "Schieß los.", "Zu Diensten.", "Ich bin ganz Ohr.",
            "Was kann ich tun?", "Hier. Was brauchst du?", "$n. Was gibt's?", "Online und bereit.", "Sag an.")
        val tod = when (hour) {
            in 4..10 -> listOf("Guten Morgen, $n.", "Morgen, $n. Was steht an?", "Morgen. Kaffee schon gehabt?")
            in 11..13 -> listOf("Mittag, $n. Was brauchst du?", "Na, Mittagspause?")
            in 14..17 -> listOf("Nachmittag, $n. Was liegt an?")
            in 18..22 -> listOf("Guten Abend, $n.", "Abend, $n. Was kann ich tun?", "Feierabend-Modus. Was brauchst du?")
            else -> listOf("Noch wach, $n?", "Späte Stunde. Was brauchst du?", "Nachtschicht? Ich bin da.")
        }
        return if (firstToday) tod else any + tod
    }

    private fun greetings(): List<String> = (0..23 step 4).flatMap { greetingsFor(it, false) }.distinct()

    private fun greeting(): String {
        val h = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        val options = greetingsFor(h, prefs.lastBriefingDay != today).filter { it != lastGreeting }
        return options.random().also { lastGreeting = it }
    }

    private fun toolLabel(t: String) = when (t) {
        "web_search" -> "Suche im Netz …"; "get_weather" -> "Schaue aufs Wetter …"; "open_app" -> "Öffne App …"
        "call_contact" -> "Rufe an …"; "send_whatsapp", "send_sms" -> "Schreibe Nachricht …"; "read_screen" -> "Lese Bildschirm …"
        "tap_element" -> "Tippe …"; "read_notifications" -> "Lese Benachrichtigungen …"; else -> "Erledige das …"
    }

    // ---------- Anzeige ----------
    private fun state(s: LunaState, status: String) {
        LunaBus.update { it.copy(state = s, status = status, level = if (s == LunaState.LISTENING) it.level else 0f) }
        if (running) getSystemService(NotificationManager::class.java).notify(NOTIF_ID, notification(status))
    }

    private fun notification(text: String): Notification {
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        val talk = PendingIntent.getService(this, 2, Intent(this, LunaService::class.java).setAction(ACTION_LISTEN), PendingIntent.FLAG_IMMUTABLE)
        val stop = PendingIntent.getService(this, 3, Intent(this, LunaService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE)
        return NotificationCompat.Builder(this, CH_SERVICE)
            .setSmallIcon(R.drawable.ic_stat_luna).setContentTitle("Luna").setContentText(text)
            .setOngoing(true).setOnlyAlertOnce(true).setSilent(true).setContentIntent(open)
            .setColor(0xFF8B5CF6.toInt())
            .addAction(0, "Sprechen", talk).addAction(0, "Schlafen", stop)
            .setCategory(NotificationCompat.CATEGORY_SERVICE).build()
    }

    // ---------- Audio-Fokus: Musik wird leiser, während Luna spricht ----------
    private fun grabFocus() {
        if (focus != null) return
        val am = getSystemService(AUDIO_SERVICE) as AudioManager
        val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
            .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANT).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
            .build()
        am.requestAudioFocus(req)
        focus = req
    }

    private fun releaseFocus() {
        focus?.let { (getSystemService(AUDIO_SERVICE) as AudioManager).abandonAudioFocusRequest(it) }
        focus = null
    }
}
