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
import android.widget.HorizontalScrollView
import android.widget.ImageView
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

    private lateinit var prefs: Prefs
    private lateinit var core: CoreView
    private lateinit var status: TextView
    private lateinit var statusDot: View
    private lateinit var userText: TextView
    private lateinit var lunaText: TextView
    private lateinit var wakeToggle: TextView
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
    }

    private fun dp(v: Int) = Ui.dpi(this, v)

    private fun build(): View {
        val root = FrameLayout(this)
        root.addView(SpaceView(this), FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_HORIZONTAL }
        root.addView(col, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        col.setPadding(dp(22), dp(40), dp(22), dp(24))
        root.setOnApplyWindowInsetsListener { _, ins ->
            @Suppress("DEPRECATION")
            col.setPadding(dp(22), ins.systemWindowInsetTop + dp(14), dp(22), ins.systemWindowInsetBottom + dp(18))
            ins
        }

        // ── Kopf: LUNA · Status-Pille · Einstellungen
        val head = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        val title = Ui.label(this, "Luna", 19f, Ui.TEXT, 0.55f)
        Ui.chrome(title)
        head.addView(title)
        head.addView(View(this), LinearLayout.LayoutParams(0, 1, 1f))
        val pill = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(14), dp(9), dp(16), dp(9)); background = Ui.hairline(context)
        }
        statusDot = View(this).apply { background = Ui.circle(context, 0, Ui.MINT) }
        pill.addView(statusDot, LinearLayout.LayoutParams(dp(7), dp(7)).apply { marginEnd = dp(9) })
        status = Ui.label(this, "Bereit", 9.5f, Ui.TEXT, 0.25f).apply { maxLines = 1; ellipsize = android.text.TextUtils.TruncateAt.END; maxWidth = dp(170) }
        pill.addView(status)
        head.addView(pill)
        head.addView(ImageView(this).apply {
            setImageDrawable(LineIcon("gear", Ui.STEEL)); contentDescription = "Einstellungen"
            setPadding(dp(13), dp(13), dp(13), dp(13)); background = Ui.ripple(Ui.circle(context))
            setOnClickListener { startActivity(Intent(context, SettingsActivity::class.java)) }
        }, LinearLayout.LayoutParams(dp(48), dp(48)).apply { marginStart = dp(10) })
        col.addView(head, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))

        // ── HUD-Zeile mit Spektrum-Haarlinie
        col.addView(HairlineView(this), LinearLayout.LayoutParams(MATCH_PARENT, dp(1)).apply { topMargin = dp(16) })
        val hud = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(0, dp(10), 0, 0) }
        hudBattery = Ui.label(this, "Akku –", 9f).apply { isSingleLine = true }; hudNet = Ui.label(this, "Netz –", 9f).apply { gravity = Gravity.CENTER; isSingleLine = true }
        hudTime = Ui.label(this, "--:--", 9f).apply { gravity = Gravity.END; isSingleLine = true }
        hud.addView(hudBattery, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
        hud.addView(hudNet, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
        hud.addView(hudTime, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
        col.addView(hud, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))

        // ── Stimmkern
        core = CoreView(this).apply { contentDescription = "Luna – antippen zum Sprechen"; setOnClickListener { talk() } }
        col.addView(core, LinearLayout.LayoutParams(MATCH_PARENT, 0, 1.3f))

        // ── Dialog
        val talkBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_HORIZONTAL }
        userText = Ui.text(this, "", 14f, Ui.STEEL).apply { gravity = Gravity.CENTER; setPadding(dp(8), 0, dp(8), dp(8)) }
        lunaText = Ui.text(this, "", 20f, Ui.TEXT).apply { gravity = Gravity.CENTER; typeface = Ui.sans(context, 300); setPadding(dp(8), 0, dp(8), 0) }
        talkBox.addView(userText); talkBox.addView(lunaText)
        col.addView(ScrollView(this).apply { isVerticalScrollBarEnabled = false; addView(talkBox) }, LinearLayout.LayoutParams(MATCH_PARENT, 0, 0.62f))

        permHint = Ui.pillButton(this, "", false) { startActivity(Intent(this, SettingsActivity::class.java).putExtra("focus", "rechte")) }.apply {
            setTextColor(Ui.AMBER); textSize = 9.5f
        }
        col.addView(permHint, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply { topMargin = dp(8); bottomMargin = dp(10) })

        // ── Kontrollleiste: Ein-Knopf-Aktionen
        col.addView(Ui.label(this, "Kontrolle", 8.5f, Ui.DIM, 0.4f), LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply { bottomMargin = dp(10) })
        val deck = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; setPadding(dp(4), 0, dp(4), 0) }
        listOf(
            Triple("pc", "power", "PC an"), Triple("remote", "remote", "Remote"), Triple("vpn", "shield", "VPN"),
            Triple("guest", "wifi", "Gast-WLAN"), Triple("torch", "torch", "Licht"), Triple("silent", "bell", "Lautlos"),
            Triple("lock", "lock", "Sperren"), Triple("weather", "cloud", "Wetter"),
        ).forEach { (id, icon, label) -> deck.addView(quickButton(id, icon, label)) }
        col.addView(HorizontalScrollView(this).apply { isHorizontalScrollBarEnabled = false; addView(deck) },
            LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { bottomMargin = dp(16) })

        // ── Unten: Wachmodus-Pille + Mikro
        val bar = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        wakeToggle = Ui.pillButton(this, "", false) { toggleWake() }.apply { textSize = 10f }
        bar.addView(wakeToggle, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f).apply { marginEnd = dp(14) })
        val mic = ImageView(this).apply {
            setImageDrawable(LineIcon("mic", Ui.TEXT)); contentDescription = "Jetzt sprechen"
            setPadding(dp(22), dp(22), dp(22), dp(22)); background = Ui.ripple(Ui.iceCircle(context))
            setOnClickListener { talk() }
        }
        bar.addView(mic, LinearLayout.LayoutParams(dp(76), dp(76)))
        col.addView(bar, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        return root
    }

    /** Runder Ein-Knopf: Haarlinien-Kreis + Linien-Icon + Label darunter. */
    private fun quickButton(id: String, icon: String, label: String): View {
        val box = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_HORIZONTAL; setPadding(dp(5), 0, dp(5), 0) }
        val b = ImageView(this).apply {
            setImageDrawable(LineIcon(icon, Ui.TEXT)); contentDescription = label
            setPadding(dp(17), dp(17), dp(17), dp(17)); background = Ui.ripple(Ui.circle(context))
            setOnClickListener {
                background = Ui.ripple(Ui.iceCircle(context))
                postDelayed({ background = Ui.ripple(Ui.circle(context)) }, 1200)
                LunaService.send(context, LunaService.ACTION_QUICK, id)
            }
        }
        box.addView(b, LinearLayout.LayoutParams(dp(60), dp(60)))
        box.addView(Ui.text(this, label, 11f, Ui.STEEL).apply { gravity = Gravity.CENTER; setPadding(0, dp(7), 0, 0) },
            LinearLayout.LayoutParams(dp(72), WRAP_CONTENT))
        return box
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
    }

    override fun onResume() {
        super.onResume()
        LunaBus.add(this)
        if (prefs.wakeWanted && !LunaService.running && hasMic()) LunaService.start(this)
        refreshChrome()
        ui.post(hudTick)
    }

    override fun onPause() { LunaBus.remove(this); ui.removeCallbacks(hudTick); super.onPause() }

    private fun setWake(on: Boolean) {
        wakeToggle.text = if (on) "Wachmodus  ·  an" else "Wachmodus  ·  aus"
        wakeToggle.setTextColor(if (on) Ui.MINT else Ui.STEEL)
    }

    private fun refreshChrome() {
        setWake(LunaService.running)
        val missing = Permissions.missing(this)
        permHint.visibility = if (missing.isEmpty()) View.GONE else View.VISIBLE
        permHint.text = if (missing.size == 1) "1 RECHT FEHLT  ›" else "${missing.size} RECHTE FEHLEN  ›"
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
        if (::wakeToggle.isInitialized) setWake(s.state != LunaState.OFF)
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
        wakeToggle.postDelayed({ refreshChrome() }, 400)
    }

    private fun hasMic() = checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    private fun askRuntimePermissions() {
        val need = Permissions.runtimeFor(this).filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (need.isNotEmpty()) requestPermissions(need.toTypedArray(), 1)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (hasMic() && prefs.wakeWanted && !LunaService.running) LunaService.start(this)
        refreshChrome()
    }
}

/** Alle Rechte, die Luna für „volle Kontrolle“ braucht. */
object Permissions {
    val RUNTIME: List<String> = buildList {
        add(Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
        add(Manifest.permission.READ_CONTACTS); add(Manifest.permission.CALL_PHONE); add(Manifest.permission.SEND_SMS)
        add(Manifest.permission.READ_CALENDAR); add(Manifest.permission.WRITE_CALENDAR)
    }

    fun runtimeFor(a: Activity): List<String> = RUNTIME + (if (wireguardInstalled(a)) listOf(PhoneTools.WG_PERMISSION) else emptyList())

    private fun wireguardInstalled(a: Activity) = try { a.packageManager.getPackageInfo("com.wireguard.android", 0); true } catch (_: Exception) { false }

    data class Item(val key: String, val title: String, val why: String, val granted: Boolean)

    fun all(a: Activity): List<Item> {
        val pm = a.getSystemService(android.os.PowerManager::class.java)
        fun rt(p: String) = a.checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED
        return listOf(
            Item("mic", "Mikrofon", "Damit Luna „Hey Luna“ hört.", rt(Manifest.permission.RECORD_AUDIO)),
            Item("runtime", "Kontakte, Anrufe, SMS, Kalender" + (if (wireguardInstalled(a)) ", VPN" else ""), "Anrufen, Nachrichten schreiben, Termine, VPN nach Hause.", runtimeFor(a).all { rt(it) }),
            Item("access", "Bedienungshilfe (Handy steuern)", "Tippen, scrollen, Bildschirm lesen, WhatsApp senden, sperren.", LunaAccessibilityService.enabled(a)),
            Item("notif", "Benachrichtigungen lesen", "Damit Luna dir neue Nachrichten vorliest.", NotificationStore.enabled(a)),
            Item("battery", "Akku-Optimierung aus", "Sonst schläfert Android Luna nachts ein.", pm.isIgnoringBatteryOptimizations(a.packageName)),
            Item("overlay", "Über anderen Apps", "Damit Luna Apps auch aus dem Hintergrund öffnen darf.", android.provider.Settings.canDrawOverlays(a)),
            Item("write", "Systemeinstellungen ändern", "Für die Helligkeit.", android.provider.Settings.System.canWrite(a)),
        )
    }

    fun missing(a: Activity) = all(a).filter { !it.granted && it.key != "write" }
}
