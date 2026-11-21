package de.tiry.luna

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/** Hauptbildschirm: Orb, was du gesagt hast, was Luna antwortet, großer Mikro-Knopf. */
class MainActivity : Activity(), LunaBus.Listener {

    private lateinit var prefs: Prefs
    private lateinit var orb: OrbView
    private lateinit var status: TextView
    private lateinit var userText: TextView
    private lateinit var lunaText: TextView
    private lateinit var wakeToggle: TextView
    private lateinit var permHint: TextView

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

    private fun build(): View {
        val root = FrameLayout(this)
        root.addView(AuroraView(this), FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(Ui.dpi(context, 20), Ui.dpi(context, 44), Ui.dpi(context, 20), Ui.dpi(context, 28))
        }
        root.addView(col, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        root.setOnApplyWindowInsetsListener { _, ins ->
            @Suppress("DEPRECATION")
            col.setPadding(Ui.dpi(this, 20), ins.systemWindowInsetTop + Ui.dpi(this, 12), Ui.dpi(this, 20), ins.systemWindowInsetBottom + Ui.dpi(this, 20))
            ins
        }

        // Kopfzeile
        val head = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        val title = Ui.text(this, "LUNA", 26f, Ui.TEXT, true).apply { letterSpacing = 0.42f }
        Ui.gradientText(title, Ui.CYAN, Ui.VIOLET, Ui.PINK)
        head.addView(title, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
        head.addView(ImageView(this).apply {
            setImageResource(R.drawable.ic_settings); contentDescription = "Einstellungen"
            setPadding(Ui.dpi(context, 14), Ui.dpi(context, 14), Ui.dpi(context, 14), Ui.dpi(context, 14))
            background = Ui.ripple(Ui.glass(context))
            setOnClickListener { startActivity(Intent(context, SettingsActivity::class.java)) }
        }, LinearLayout.LayoutParams(Ui.dpi(this, 52), Ui.dpi(this, 52)))
        col.addView(head, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))

        // Orb
        orb = OrbView(this).apply {
            contentDescription = "Luna – antippen zum Sprechen"
            setOnClickListener { talk() }
        }
        col.addView(orb, LinearLayout.LayoutParams(MATCH_PARENT, 0, 1.25f))

        status = Ui.text(this, "", 14f, Ui.TEXT, true).apply {
            gravity = Gravity.CENTER
            setPadding(Ui.dpi(context, 18), Ui.dpi(context, 8), Ui.dpi(context, 18), Ui.dpi(context, 8))
            background = Ui.glass(context)
        }
        col.addView(status, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT))

        // Dialog
        val talkBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_HORIZONTAL }
        userText = Ui.text(this, "", 15f, Ui.MUTED).apply { gravity = Gravity.CENTER; setPadding(0, Ui.dpi(context, 16), 0, Ui.dpi(context, 6)) }
        lunaText = Ui.text(this, "", 20f, Ui.TEXT).apply { gravity = Gravity.CENTER }
        talkBox.addView(userText); talkBox.addView(lunaText)
        col.addView(ScrollView(this).apply { isVerticalScrollBarEnabled = false; addView(talkBox) }, LinearLayout.LayoutParams(MATCH_PARENT, 0, 0.75f))

        permHint = Ui.pillButton(this, "", false) { startActivity(Intent(this, SettingsActivity::class.java).putExtra("focus", "rechte")) }.apply {
            setTextColor(0xFFFDE68A.toInt()); textSize = 14f
        }
        col.addView(permHint, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply { bottomMargin = Ui.dpi(this@MainActivity, 14) })

        // Steuerleiste: Wachmodus-Pille + großer Mikro-Kreis
        val bar = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        wakeToggle = Ui.pillButton(this, "", false) { toggleWake() }
        bar.addView(wakeToggle, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f).apply { marginEnd = Ui.dpi(this@MainActivity, 16) })
        val mic = ImageView(this).apply {
            setImageResource(R.drawable.ic_mic); contentDescription = "Jetzt sprechen"
            setPadding(Ui.dpi(context, 24), Ui.dpi(context, 24), Ui.dpi(context, 24), Ui.dpi(context, 24))
            background = Ui.ripple(Ui.gradient(context, 999f, Ui.CYAN, Ui.VIOLET, Ui.PINK))
            elevation = Ui.dp(context, 10f)
            setOnClickListener { talk() }
        }
        bar.addView(mic, LinearLayout.LayoutParams(Ui.dpi(this, 80), Ui.dpi(this, 80)))
        col.addView(bar, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        return root
    }

    override fun onResume() {
        super.onResume()
        LunaBus.add(this)
        if (prefs.wakeWanted && !LunaService.running && hasMic()) LunaService.start(this)
        refreshChrome()
    }

    override fun onPause() { LunaBus.remove(this); super.onPause() }

    private fun refreshChrome() {
        wakeToggle.text = if (LunaService.running) "●  Wachmodus an" else "○  Wachmodus aus"
        wakeToggle.setTextColor(if (LunaService.running) Ui.GREEN else Ui.MUTED)
        val missing = Permissions.missing(this)
        permHint.visibility = if (missing.isEmpty()) View.GONE else View.VISIBLE
        permHint.text = if (missing.size == 1) "1 Recht fehlt noch – antippen" else "${missing.size} Rechte fehlen noch – antippen"
        if (!LunaService.running && LunaBus.current.state == LunaState.OFF) {
            status.text = if (hasMic()) "Luna schläft" else "Mikrofon-Recht fehlt"
            orb.state = LunaState.OFF
            if (lunaText.text.isBlank()) lunaText.text = "Hey ${prefs.userName}! Schalte den Wachmodus an und sag einfach „Hey Luna“."
        }
    }

    override fun onLuna(s: LunaBus.Snapshot) {
        orb.state = s.state
        orb.level = s.level
        if (s.status.isNotBlank()) status.text = s.status
        userText.text = if (s.userText.isBlank()) "" else "„${s.userText}“"
        if (s.lunaText.isNotBlank()) lunaText.text = s.lunaText
        if (::wakeToggle.isInitialized) {
            wakeToggle.text = if (s.state != LunaState.OFF) "●  Wachmodus an" else "○  Wachmodus aus"
            wakeToggle.setTextColor(if (s.state != LunaState.OFF) Ui.GREEN else Ui.MUTED)
        }
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
        val need = Permissions.RUNTIME.filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
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

    data class Item(val key: String, val title: String, val why: String, val granted: Boolean)

    fun all(a: Activity): List<Item> {
        val pm = a.getSystemService(android.os.PowerManager::class.java)
        fun rt(p: String) = a.checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED
        return listOf(
            Item("mic", "Mikrofon", "Damit Luna „Hey Luna“ hört.", rt(Manifest.permission.RECORD_AUDIO)),
            Item("runtime", "Kontakte, Anrufe, SMS, Kalender", "Anrufen, Nachrichten schreiben, Termine.", RUNTIME.all { rt(it) }),
            Item("access", "Bedienungshilfe (Handy steuern)", "Tippen, scrollen, Bildschirm lesen, WhatsApp senden, sperren.", LunaAccessibilityService.enabled(a)),
            Item("notif", "Benachrichtigungen lesen", "Damit Luna dir neue Nachrichten vorliest.", NotificationStore.enabled(a)),
            Item("battery", "Akku-Optimierung aus", "Sonst schläfert Android Luna nachts ein.", pm.isIgnoringBatteryOptimizations(a.packageName)),
            Item("overlay", "Über anderen Apps", "Damit Luna Apps auch aus dem Hintergrund öffnen darf.", android.provider.Settings.canDrawOverlays(a)),
            Item("write", "Systemeinstellungen ändern", "Für die Helligkeit.", android.provider.Settings.System.canWrite(a)),
        )
    }

    fun missing(a: Activity) = all(a).filter { !it.granted && it.key != "write" }
}
