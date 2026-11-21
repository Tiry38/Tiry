package de.tiry.luna

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Hauptbildschirm „Luna 2100“: HUD oben, 3D-Stimmkern, Dialog, Kontrollleiste (Ein-Knopf-Aktionen), Mikro.
 */
class MainActivity : Activity(), LunaBus.Listener {

    companion object {
        const val EXTRA_AWAKE = "awake"
        @Volatile var visible = false
    }

    /** true, wenn Luna das Handy per „Hey Luna“ aufgeweckt hat. */
    private var awakened = false

    private lateinit var prefs: Prefs
    private lateinit var core: CoreView
    private lateinit var status: TextView
    private lateinit var statusDot: View
    private lateinit var userText: TextView
    private lateinit var lunaText: TextView
    private var lastState = LunaState.OFF
    private lateinit var permHint: TextView
    private lateinit var hudBattery: TextView
    private lateinit var hudNet: TextView
    private lateinit var hudTime: TextView
    private val ui = Handler(Looper.getMainLooper())
    private val hudTick = object : Runnable { override fun run() { updateHud(); ui.postDelayed(this, 15_000) } }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = Prefs(this)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_STABLE or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
        setContentView(build())
        if (savedInstanceState == null) askRuntimePermissions()
        handleAwake(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleAwake(intent)
    }

    /** „Hey Luna“ bei ausgeschaltetem Display: über der Sperre zeigen, Display an, Lichtfeld zündet. */
    private fun handleAwake(i: Intent?) {
        if (i?.getBooleanExtra(EXTRA_AWAKE, false) != true) return
        i.removeExtra(EXTRA_AWAKE)
        awakened = true
        if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true) }
        else @Suppress("DEPRECATION") window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        ui.removeCallbacks(sleepAgain)
        // Zündung: drei Schockwellen aus dem Kern
        field.post { field.pulseCore(2.2f) }
        ui.postDelayed({ field.pulseCore(1.6f) }, 260)
        ui.postDelayed({ field.pulseCore(1.1f) }, 560)
    }

    /** Gespräch vorbei → Display darf wieder ausgehen, Sperrbildschirm zurück. */
    private val sleepAgain = Runnable {
        if (!awakened || LunaBus.current.state != LunaState.WAITING) return@Runnable
        awakened = false
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(false); setTurnScreenOn(false) }
        val km = getSystemService(android.app.KeyguardManager::class.java)
        if (km.isKeyguardLocked) moveTaskToBack(true)
    }

    private fun dp(v: Int) = Ui.dpi(this, v)

    private lateinit var field: FieldView
    private val anchors = HashMap<String, View>()

    private fun build(): View {
        val root = FrameLayout(this)
        field = FieldView(this).apply { setTypeface(Ui.sans(context, 500)) }
        root.addView(field, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_HORIZONTAL }
        root.addView(col, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        col.setPadding(dp(22), dp(40), dp(22), dp(16))
        root.setOnApplyWindowInsetsListener { _, ins ->
            @Suppress("DEPRECATION")
            col.setPadding(dp(22), ins.systemWindowInsetTop + dp(14), dp(22), ins.systemWindowInsetBottom + dp(10))
            ins
        }

        // ── Kopf: LUNA · Statuslicht · Einstellungs-Delle (alles ohne Rahmen)
        val head = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        val title = Ui.label(this, "Luna", 19f, Ui.TEXT, 0.55f)
        Ui.chrome(title)
        head.addView(title)
        head.addView(View(this), LinearLayout.LayoutParams(0, 1, 1f))
        statusDot = View(this).apply { background = Ui.circle(context, 0, Ui.MINT) }
        head.addView(statusDot, LinearLayout.LayoutParams(dp(6), dp(6)).apply { marginEnd = dp(9) })
        status = Ui.label(this, "Bereit", 9.5f, Ui.TEXT, 0.28f).apply { maxLines = 1; ellipsize = android.text.TextUtils.TruncateAt.END; maxWidth = dp(170) }
        head.addView(status)
        head.addView(anchor("settings", "Einstellungen"), LinearLayout.LayoutParams(dp(48), dp(48)).apply { marginStart = dp(14) })
        col.addView(head, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))

        // ── HUD-Zeile mit Spektrum-Haarlinie
        col.addView(HairlineView(this), LinearLayout.LayoutParams(MATCH_PARENT, dp(1)).apply { topMargin = dp(10) })
        val hud = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(0, dp(10), 0, 0) }
        hudBattery = Ui.label(this, "Akku –", 9f).apply { isSingleLine = true }; hudNet = Ui.label(this, "Netz –", 9f).apply { gravity = Gravity.CENTER; isSingleLine = true }
        hudTime = Ui.label(this, "--:--", 9f).apply { gravity = Gravity.END; isSingleLine = true }
        hud.addView(hudBattery, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
        hud.addView(hudNet, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
        hud.addView(hudTime, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
        col.addView(hud, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))

        // ── Stimmkern = größte Masse im Feld, antippen = sprechen
        core = CoreView(this).apply { contentDescription = "Luna – antippen zum Sprechen"; setOnClickListener { talk() } }
        col.addView(core, LinearLayout.LayoutParams(MATCH_PARENT, 0, 1.15f))
        field.coreAnchor = core
        col.addView(Ui.label(this, "Kern antippen  ·  oder „Hey Luna“", 8f, Ui.DIM, 0.3f).apply { gravity = Gravity.CENTER },
            LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))

        // ── Dialog
        val talkBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_HORIZONTAL }
        userText = Ui.text(this, "", 14f, Ui.STEEL).apply { gravity = Gravity.CENTER; setPadding(dp(8), dp(12), dp(8), dp(8)) }
        lunaText = Ui.text(this, "", 19f, Ui.TEXT).apply { gravity = Gravity.CENTER; typeface = Ui.sans(context, 300); setPadding(dp(8), 0, dp(8), 0) }
        talkBox.addView(userText); talkBox.addView(lunaText)
        col.addView(ScrollView(this).apply { isVerticalScrollBarEnabled = false; addView(talkBox) }, LinearLayout.LayoutParams(MATCH_PARENT, 0, 0.55f))

        permHint = Ui.label(this, "", 9f, Ui.AMBER, 0.25f).apply {
            setPadding(dp(12), dp(12), dp(12), dp(12)); isClickable = true
            setOnClickListener { startActivity(Intent(context, SettingsActivity::class.java).putExtra("focus", "rechte")) }
        }
        permHint.gravity = Gravity.CENTER
        col.addView(permHint, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))

        // ── Dellen-Feld: zwei geschwungene Waben-Bögen (5 oben, 4 versetzt darunter)
        val deck = WellLayout(this)
        listOf("pc" to "PC an", "remote" to "Remote", "vpn" to "VPN", "guest" to "Gast-WLAN",
            "torch" to "Licht", "silent" to "Lautlos", "lock" to "Sperren", "wake" to "Wachmodus")
            .forEach { (id, label) -> deck.addView(anchor(id, label)) }
        col.addView(deck, LinearLayout.LayoutParams(MATCH_PARENT, dp(210)))

        // Dellen registrieren
        val icons = mapOf("pc" to "power", "remote" to "remote", "wake" to "mic", "vpn" to "shield", "guest" to "wifi",
            "torch" to "torch", "silent" to "bell", "lock" to "lock", "weather" to "cloud", "settings" to "gear")
        val labels = mapOf("pc" to "PC an", "remote" to "Remote", "wake" to "Wachmodus", "vpn" to "VPN", "guest" to "Gast-WLAN",
            "torch" to "Licht", "silent" to "Lautlos", "lock" to "Sperren", "weather" to "Wetter", "settings" to "")
        for ((id, v) in anchors) {
            field.wells += FieldView.Well(id, icons[id], labels[id] ?: "", v, mass = if (id == "settings") 0.75f else 1f) { onWell(id) }.apply {
                activeColor = when (id) { "torch" -> Ui.AMBER; "silent" -> Ui.VIOLET; "wake" -> Ui.MINT; else -> Ui.ICE }
            }
        }
        return root
    }

    /** Unsichtbarer Anker: gibt der Delle ihre Position, nimmt Berührung + TalkBack entgegen. */
    private fun anchor(id: String, label: String): View = View(this).apply {
        contentDescription = label; isClickable = true; isFocusable = true
        setOnTouchListener { _, e -> if (e.actionMasked == android.view.MotionEvent.ACTION_DOWN) field.touchDown(id); false }
        setOnClickListener { field.trigger(id) }
        anchors[id] = this
    }

    private fun onWell(id: String) {
        when (id) {
            "settings" -> startActivity(Intent(this, SettingsActivity::class.java))
            "wake" -> toggleWake()
            else -> LunaService.send(this, LunaService.ACTION_QUICK, id)
        }
        ui.postDelayed({ updateActive() }, 1500)
    }

    /** Aktive Dellen glühen in ihrer Farbe (Licht an, Lautlos, VPN, Wachmodus). */
    private fun updateActive() {
        val am = getSystemService(AUDIO_SERVICE) as android.media.AudioManager
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val vpn = cm.getNetworkCapabilities(cm.activeNetwork)?.hasTransport(NetworkCapabilities.TRANSPORT_VPN) == true
        for (w in field.wells) w.active = when (w.id) {
            "torch" -> torchOn
            "silent" -> am.ringerMode != android.media.AudioManager.RINGER_MODE_NORMAL
            "vpn" -> vpn
            "wake" -> LunaService.running
            else -> false
        }
    }

    @Volatile private var torchOn = false
    private val torchCb = object : android.hardware.camera2.CameraManager.TorchCallback() {
        override fun onTorchModeChanged(cameraId: String, enabled: Boolean) { torchOn = enabled; updateActive() }
    }

    private fun updateHud() {
        val bm = getSystemService(BATTERY_SERVICE) as BatteryManager
        val pct = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        hudBattery.text = (if (pct in 0..100) "AKKU $pct %" else "AKKU –") + if (bm.isCharging) " +" else ""
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val caps = cm.getNetworkCapabilities(cm.activeNetwork)
        hudNet.text = when {
            caps == null -> "OFFLINE"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN) -> "VPN"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "WLAN"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "MOBIL"
            else -> "ONLINE"
        }
        hudTime.text = SimpleDateFormat("HH:mm", Locale.GERMANY).format(Date())
        updateActive()
    }

    override fun onResume() {
        super.onResume()
        visible = true
        LunaBus.add(this)
        if (prefs.wakeWanted && !LunaService.running && hasMic()) LunaService.start(this)
        refreshChrome()
        ui.post(hudTick)
        // Selbst-Update beim Öffnen (höchstens alle 2 Minuten)
        if (Updater.due(this, 2)) Thread {
            val msg = try { Updater.run(applicationContext) } catch (_: Exception) { "" }
            if (msg.isNotBlank()) runOnUiThread { lunaText.text = msg }
        }.start()
    }

    override fun onStart() {
        super.onStart()
        try { getSystemService(android.hardware.camera2.CameraManager::class.java).registerTorchCallback(torchCb, ui) } catch (_: Exception) {}
    }

    override fun onStop() {
        try { getSystemService(android.hardware.camera2.CameraManager::class.java).unregisterTorchCallback(torchCb) } catch (_: Exception) {}
        super.onStop()
    }

    override fun onPause() { visible = false; LunaBus.remove(this); ui.removeCallbacks(hudTick); super.onPause() }

    private fun setWake(on: Boolean) { field.wells.firstOrNull { it.id == "wake" }?.active = on }

    private fun refreshChrome() {
        setWake(LunaService.running)
        val missing = Permissions.missing(this)
        permHint.visibility = if (missing.isEmpty()) View.GONE else View.VISIBLE
        permHint.text = if (missing.size == 1) "◇  1 RECHT FEHLT  ›" else "◇  ${missing.size} RECHTE FEHLEN  ›"
        if (!LunaService.running && LunaBus.current.state == LunaState.OFF) {
            status.text = if (hasMic()) "SCHLÄFT" else "KEIN MIKROFON"
            statusDot.background = Ui.circle(this, 0, Ui.DIM)
            core.state = LunaState.OFF
            if (lunaText.text.isBlank()) lunaText.text = "Hallo ${prefs.userName}. Wachmodus an – dann genügt „Hey Luna“."
        }
    }

    override fun onLuna(s: LunaBus.Snapshot) {
        core.state = s.state
        core.level = s.level
        if (s.status.isNotBlank()) status.text = s.status.uppercase().trimEnd('.', ' ', '…')
        statusDot.background = Ui.circle(this, 0, when (s.state) {
            LunaState.LISTENING -> Ui.MINT; LunaState.THINKING -> Ui.VIOLET; LunaState.SPEAKING -> Ui.TEXT
            LunaState.ERROR -> Ui.RED; LunaState.OFF -> Ui.DIM; else -> Ui.ICE
        })
        userText.text = if (s.userText.isBlank()) "" else "„${s.userText}“"
        if (s.lunaText.isNotBlank()) lunaText.text = s.lunaText
        setWake(s.state != LunaState.OFF)
        field.state = s.state; field.level = s.level
        if (s.state == LunaState.SPEAKING && lastState != LunaState.SPEAKING) field.pulseCore(1.3f)
        if (awakened) {
            ui.removeCallbacks(sleepAgain)
            if (s.state == LunaState.WAITING) ui.postDelayed(sleepAgain, 7000)
        }
        lastState = s.state
    }

    private fun talk() {
        if (!hasMic()) { askRuntimePermissions(); return }
        val st = LunaBus.current.state
        if (st == LunaState.SPEAKING || st == LunaState.LISTENING || st == LunaState.THINKING) LunaService.send(this, LunaService.ACTION_INTERRUPT)
        else LunaService.send(this, LunaService.ACTION_LISTEN)
    }

    private fun toggleWake() {
        if (!hasMic()) { askRuntimePermissions(); return }
        if (LunaService.running) LunaService.send(this, LunaService.ACTION_STOP)
        else { prefs.wakeWanted = true; LunaService.start(this) }
        ui.postDelayed({ refreshChrome() }, 400)
    }

    private fun hasMic() = checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    /**
     * Schrittweise fragen: zuerst nur Mikrofon (+ Benachrichtigungen), danach den Rest.
     * SMS wird hier nie gefragt – Android sperrt es bei selbst installierten Apps („eingeschränkte Einstellung“),
     * und eine Sperre im Sammelaufruf würde sonst auch das Mikrofon mitreißen.
     */
    private fun askRuntimePermissions() {
        val first = Permissions.FIRST.filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (first.isNotEmpty()) { requestPermissions(first.toTypedArray(), 1); return }
        val rest = Permissions.runtimeFor(this).filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (rest.isNotEmpty()) requestPermissions(rest.toTypedArray(), 2)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (hasMic() && prefs.wakeWanted && !LunaService.running) LunaService.start(this)
        if (requestCode == 1 && hasMic()) askRuntimePermissions()   // danach die übrigen Rechte
        refreshChrome()
    }
}

/** Alle Rechte, die Luna für „volle Kontrolle“ braucht. */
object Permissions {
    val RUNTIME: List<String> = buildList {
        add(Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
        add(Manifest.permission.READ_CONTACTS); add(Manifest.permission.CALL_PHONE)
        add(Manifest.permission.READ_CALENDAR); add(Manifest.permission.WRITE_CALENDAR)
    }

    /** Zuerst und einzeln: das Wichtigste. */
    val FIRST: List<String> = buildList {
        add(Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
    }

    fun runtimeFor(a: Activity): List<String> = RUNTIME + (if (wireguardInstalled(a)) listOf(PhoneTools.WG_PERMISSION) else emptyList())

    private fun wireguardInstalled(a: Activity) = try { a.packageManager.getPackageInfo("com.wireguard.android", 0); true } catch (_: Exception) { false }

    data class Item(val key: String, val title: String, val why: String, val granted: Boolean)

    fun all(a: Activity): List<Item> {
        val pm = a.getSystemService(android.os.PowerManager::class.java)
        fun rt(p: String) = a.checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED
        return listOf(
            Item("mic", "Mikrofon", "Damit Luna „Hey Luna“ hört.", rt(Manifest.permission.RECORD_AUDIO)),
            Item("runtime", "Kontakte, Anrufe, Kalender" + (if (wireguardInstalled(a)) ", VPN" else ""), "Anrufen, Termine, VPN nach Hause.", runtimeFor(a).all { rt(it) }),
            Item("sms", "SMS senden (optional)", "Nur für SMS per Sprache. Wird blockiert? App-Info → ⋮ → „Eingeschränkte Einstellungen zulassen“, dann hier erneut tippen.", rt(Manifest.permission.SEND_SMS)),
            Item("access", "Bedienungshilfe (Handy steuern)", "Tippen, scrollen, Bildschirm lesen, WhatsApp senden, sperren.", LunaAccessibilityService.enabled(a)),
            Item("notif", "Benachrichtigungen lesen", "Damit Luna dir neue Nachrichten vorliest.", NotificationStore.enabled(a)),
            Item("battery", "Akku-Optimierung aus", "Sonst schläfert Android Luna nachts ein.", pm.isIgnoringBatteryOptimizations(a.packageName)),
            Item("overlay", "Über anderen Apps", "Damit Luna Apps auch aus dem Hintergrund öffnen darf.", android.provider.Settings.canDrawOverlays(a)),
            Item("write", "Systemeinstellungen ändern", "Für die Helligkeit.", android.provider.Settings.System.canWrite(a)),
        )
    }

    fun missing(a: Activity) = all(a).filter { !it.granted && it.key != "write" && it.key != "sms" }
}

/** Ordnet die Anker übersichtlich an: zwei Reihen à vier, gleichmäßig verteilt. */
class WellLayout(c: Context) : android.view.ViewGroup(c) {
    override fun onMeasure(wSpec: Int, hSpec: Int) {
        val s = Ui.dpi(context, 64)
        val spec = MeasureSpec.makeMeasureSpec(s, MeasureSpec.EXACTLY)
        for (i in 0 until childCount) getChildAt(i).measure(spec, spec)
        setMeasuredDimension(MeasureSpec.getSize(wSpec), MeasureSpec.getSize(hSpec))
    }
    override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
        val w = r - l; val h = b - t
        val s = Ui.dpi(context, 64)
        for (i in 0 until childCount) {
            val row = i / 4; val colIdx = i % 4
            val cx = w * (colIdx + 0.5f) / 4f
            val cy = h * (if (row == 0) 0.22f else 0.67f)
            getChildAt(i).layout((cx - s / 2).toInt(), (cy - s / 2).toInt(), (cx + s / 2).toInt(), (cy + s / 2).toInt())
        }
    }
}
