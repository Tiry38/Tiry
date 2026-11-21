package de.tiry.luna

import android.app.Activity
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast

/** Einstellungen: Name, KI, Stimme, Wake-Word, Gedächtnis, Rechte. */
class SettingsActivity : Activity() {

    private lateinit var prefs: Prefs
    private lateinit var col: LinearLayout
    private lateinit var permBox: LinearLayout
    private val savers = mutableListOf<() -> Unit>()
    private var speaker: Speaker? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = Prefs(this)
        window.statusBarColor = Ui.BLACK; window.navigationBarColor = Ui.BLACK
        val root = FrameLayout(this)
        root.addView(SpaceView(this), FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        val scroll = ScrollView(this)
        col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(20), dp(24), dp(20), dp(48)) }
        scroll.addView(col)
        root.addView(scroll, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        setContentView(root)
        build()
        if (intent.getStringExtra("focus") == "rechte") scroll.post { scroll.smoothScrollTo(0, permBox.top - dp(40)) }
    }

    private fun dp(v: Int) = Ui.dpi(this, v)

    private fun build() {
        col.addView(Ui.label(this, "Luna · System", 9f, Ui.ICE, 0.4f))
        val title = Ui.label(this, "Einstellungen", 22f, Ui.TEXT, 0.06f).apply { setPadding(0, dp(12), 0, dp(10)) }
        Ui.chrome(title)
        col.addView(title)
        col.addView(HairlineView(this), LinearLayout.LayoutParams(MATCH_PARENT, dp(1)).apply { bottomMargin = dp(12) })
        hint("Alles bleibt auf deinem Handy gespeichert.")

        section("Du")
        field("Wie soll Luna dich nennen?", prefs.userName) { prefs.userName = it }
        field("Wohnort (für Wetter)", prefs.homeCity) { prefs.homeCity = it }
        field("Über mich – damit Luna dich kennt und passende Tipps gibt", prefs.aboutMe, multi = true) { prefs.aboutMe = it }

        section("Gehirn (Claude)")
        hint("Ohne Schlüssel versteht Luna die wichtigsten Befehle offline. Mit Claude-Schlüssel (console.anthropic.com → API Keys) kann sie frei reden, mitdenken, im Netz suchen und fremde Apps bedienen. Haiku 5.5 ist eingestellt: am schnellsten, ideal fürs Handy-Steuern, Kosten deutlich unter 1 Cent pro Frage. Opus 5.5 grob 2–5 Cent.")
        field("Claude API-Key (sk-ant-…)", prefs.claudeKey, secret = true) { prefs.claudeKey = it }
        choice("Modell", listOf(
            Prefs.MODEL_HAIKU to "Haiku 5.5 · Empfohlen",
            Prefs.MODEL_SONNET to "Sonnet 5.5 · Ausgewogen",
            Prefs.MODEL_OPUS to "Opus 5.5 · Maximum",
        ), prefs.model) { prefs.model = it }

        section("Stimme")
        hint("Für eine Stimme, die wirklich wie ein Mensch klingt: kostenlosen ElevenLabs-Zugang anlegen (elevenlabs.io → Profil → API Keys; Gratis-Kontingent reicht für viele kurze Antworten). Ohne Schlüssel nutzt Luna die beste deutsche Stimme deines Handys.")
        field("ElevenLabs API-Key", prefs.elevenKey, secret = true) { prefs.elevenKey = it }
        field("Stimmen-ID (Standard: Sarah – warm & natürlich)", prefs.elevenVoice) { prefs.elevenVoice = it }
        choice("Sprachmodell", listOf(
            "eleven_multilingual_v2" to "Multilingual v2 · Menschlich",
            "eleven_flash_v2_5" to "Flash v2.5 · Blitzschnell",
        ), prefs.elevenModel) { prefs.elevenModel = it }
        button("Stimme testen", filled = true) {
            saveAll()
            if (speaker == null) speaker = Speaker(this, prefs)
            speaker?.speak("Hey ${prefs.userName}! So klinge ich. Wenn du mich brauchst, sag einfach Hey Luna.") {
                speaker?.lastError?.let { Toast.makeText(this, it, Toast.LENGTH_LONG).show() }
            }
        }

        section("Heimnetz – FRITZ!Box & PC")
        hint("Damit Luna die FRITZ!Box steuert und deinen PC einschaltet. In der FRITZ!Box einmal: Heimnetz → Netzwerk → Netzwerkeinstellungen → „Zugriff für Anwendungen zulassen“. Benutzer unter System → FRITZ!Box-Benutzer (Rechte: FRITZ!Box-Einstellungen).")
        field("FRITZ!Box-Adresse", prefs.fritzHost) { prefs.fritzHost = it }
        field("FRITZ!Box-Benutzer", prefs.fritzUser) { prefs.fritzUser = it }
        field("FRITZ!Box-Passwort", prefs.fritzPass, secret = true) { prefs.fritzPass = it }
        field("PC-Name (wie in der FRITZ!Box angezeigt)", prefs.pcName) { prefs.pcName = it }
        field("PC-MAC-Adresse (optional, z. B. AA:BB:CC:DD:EE:FF)", prefs.pcMac) { prefs.pcMac = it }
        hint("Am PC einmal Wake-on-LAN einschalten (BIOS/UEFI + Netzwerkkarte → Energieverwaltung „Gerät kann den Computer reaktivieren“). Für die Fernsteuerung z. B. RustDesk oder Chrome Remote Desktop auf PC und Handy installieren.")
        field("Fernsteuerungs-App (Paketname, leer = automatisch)", prefs.remoteApp) { prefs.remoteApp = it }
        hint("Unterwegs: In der FRITZ!Box unter Internet → Freigaben → VPN (WireGuard) eine Verbindung für dieses Handy anlegen und in der WireGuard-App importieren. In der WireGuard-App unter Einstellungen „Allow remote control apps“ (Fernsteuerung durch Apps) einschalten.")
        field("Name des WireGuard-Tunnels", prefs.vpnTunnel) { prefs.vpnTunnel = it }
        button("FRITZ!Box-Verbindung testen") {
            saveAll()
            Toast.makeText(this, "Teste …", Toast.LENGTH_SHORT).show()
            Thread {
                val msg = try { FritzBox(prefs.fritzHost, prefs.fritzUser, prefs.fritzPass).info() } catch (e: Exception) { "Fehler: ${e.message}" }
                runOnUiThread { Toast.makeText(this, msg, Toast.LENGTH_LONG).show() }
            }.start()
        }

        section("Luna als System-Assistent")
        hint("Mach Luna zum digitalen Assistenten von Android – dann startet sie statt Google Assistant, z. B. bei langem Druck auf die Power- oder Home-Taste, auch auf dem Sperrbildschirm. Dort „Digitaler Assistent“ bzw. „Assistent-App“ → Luna wählen.")
        button("Standard-Assistent festlegen", filled = true) {
            val tries = listOf(Intent(Settings.ACTION_VOICE_INPUT_SETTINGS), Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS), Intent(Settings.ACTION_SETTINGS))
            for (i in tries) { try { startActivity(i); break } catch (_: Exception) {} }
        }

        section("Aufwecken")
        slider("Empfindlichkeit für „Hey Luna“", prefs.sensitivity) { prefs.sensitivity = it }
        hint("Links = weniger Fehlalarme, rechts = reagiert schneller. Falls Luna bei Gesprächen im Raum anspringt: nach links oder „Nur mit Hey“ einschalten.")
        toggle("Nur mit „Hey“ davor", prefs.requireHey) { prefs.requireHey = it }
        toggle("Auch bei ausgeschaltetem Bildschirm zuhören", prefs.stayAwake) { prefs.stayAwake = it }
        toggle("Nachfragen ohne erneutes „Hey Luna“", prefs.followUp) { prefs.followUp = it }

        section("Gedächtnis")
        val mem = prefs.memories
        hint(if (mem.isEmpty()) "Luna hat sich noch nichts gemerkt. Sag z. B. „Merk dir, dass ich montags Beintag habe“."
             else mem.joinToString("\n") { "• $it" })
        if (mem.isNotEmpty()) button("Gedächtnis löschen") { prefs.memories = emptyList(); recreate() }

        section("Rechte")
        permBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        col.addView(permBox)
        hint("Android 13+: Wenn die Bedienungshilfe ausgegraut ist („Eingeschränkte Einstellung“): Einstellungen → Apps → Luna → oben rechts ⋮ → „Eingeschränkte Einstellungen zulassen“. Danach geht es.")
        button("App-Info von Luna öffnen") {
            startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
        }

        section("Über")
        hint("Luna ${BuildConfig.VERSION_NAME} · Wake-Word offline (das Mikrofon-Audio verlässt beim Warten nie das Handy). Gesprochenes nach „Hey Luna“ geht an die Google-Spracherkennung und – mit Schlüssel – an Claude bzw. ElevenLabs.")
    }

    override fun onResume() { super.onResume(); renderPerms() }

    private fun renderPerms() {
        permBox.removeAllViews()
        for (p in Permissions.all(this)) {
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
                setPadding(dp(18), dp(12), dp(18), dp(12)); minimumHeight = dp(64)
                background = Ui.ripple(Ui.hairline(context, 32f, if (p.granted) Ui.HAIR else 0x66FFD58A, 0x08FFFFFF))
                setOnClickListener { openPermission(p.key) }
            }
            row.addView(View(this).apply { background = Ui.circle(context, 0, if (p.granted) Ui.MINT else Ui.AMBER) },
                LinearLayout.LayoutParams(dp(14), dp(14)).apply { marginEnd = dp(14) })
            val texts = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
            texts.addView(Ui.text(this, p.title, 16f, Ui.TEXT, true))
            texts.addView(Ui.text(this, if (p.granted) "Erteilt" else p.why + " Antippen zum Freigeben.", 13f, Ui.MUTED))
            row.addView(texts, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
            permBox.addView(row, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { bottomMargin = dp(10) })
        }
    }

    private fun openPermission(key: String) {
        val i = when (key) {
            "mic", "runtime" -> { requestPermissions(Permissions.runtimeFor(this).toTypedArray(), 2); return }
            "access" -> Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            "notif" -> Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
            "battery" -> Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName"))
            "overlay" -> Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
            "write" -> Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS, Uri.parse("package:$packageName"))
            else -> return
        }
        try { startActivity(i) } catch (_: Exception) { startActivity(Intent(Settings.ACTION_SETTINGS)) }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults); renderPerms()
    }

    override fun onPause() { saveAll(); super.onPause() }
    override fun onDestroy() { speaker?.shutdown(); super.onDestroy() }

    private fun saveAll() {
        savers.forEach { it() }
        if (LunaService.running) LunaService.send(this, LunaService.ACTION_RELOAD)
    }

    // ---------- Bausteine ----------
    private var chapter = 0
    private val chapters = 9

    /** Kapitel-Kopf: „03 / 10“ in Haarlinien-Pille + Titel in breiter Chrom-Schrift. */
    private fun section(t: String) {
        chapter++
        col.addView(Ui.label(this, "%02d / %02d".format(chapter, chapters), 8.5f, Ui.STEEL, 0.3f).apply {
            setPadding(dp(12), dp(7), dp(12), dp(7)); background = Ui.hairline(context)
        }, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply { topMargin = dp(34) })
        val h = Ui.label(this, t, 14f, Ui.TEXT, 0.12f).apply { setPadding(dp(2), dp(14), 0, dp(10)) }
        Ui.chrome(h)
        col.addView(h)
    }

    private fun hint(t: String) {
        col.addView(Ui.text(this, t, 13.5f, Ui.STEEL).apply { setPadding(dp(4), dp(2), dp(4), dp(12)) })
    }

    private fun field(label: String, value: String, secret: Boolean = false, multi: Boolean = false, save: (String) -> Unit) {
        col.addView(Ui.text(this, label, 12.5f, Ui.DIM).apply { setPadding(dp(8), dp(6), 0, dp(7)) })
        val e = EditText(this).apply {
            setText(value); setTextColor(Ui.TEXT); setHintTextColor(Ui.DIM); textSize = 16f; typeface = Ui.sans(context, 400)
            background = Ui.hairline(context, if (multi) 26f else 999f)
            setOnFocusChangeListener { v, f -> v.background = if (f) Ui.hairline(context, if (multi) 26f else 999f, 0xB37FD4FF.toInt(), 0x147FD4FF) else Ui.hairline(context, if (multi) 26f else 999f) }
            setPadding(dp(20), dp(14), dp(20), dp(14)); minHeight = dp(52)
            inputType = when {
                secret -> InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
                multi -> InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
                else -> InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_WORDS
            }
            if (multi) { minLines = 3; gravity = Gravity.TOP or Gravity.START } else isSingleLine = true
        }
        col.addView(e, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { bottomMargin = dp(10) })
        savers += { save(e.text.toString()) }
    }

    private fun choice(label: String, options: List<Pair<String, String>>, current: String, save: (String) -> Unit) {
        col.addView(Ui.text(this, label, 12.5f, Ui.DIM).apply { setPadding(dp(8), dp(6), 0, dp(7)) })
        var selected = current
        val views = mutableListOf<Pair<String, TextView>>()
        fun paint() = views.forEach { (k, v) ->
            v.background = Ui.ripple(if (k == selected) Ui.hairline(this, 999f, 0xCC7FD4FF.toInt(), 0x1F7FD4FF) else Ui.hairline(this))
            v.setTextColor(if (k == selected) Ui.ICE else Ui.STEEL)
        }
        options.forEachIndexed { idx, (k, text) ->
            val v = Ui.pillButton(this, text) { selected = k; save(k); paint() }
            v.gravity = Gravity.CENTER_VERTICAL or Gravity.START
            views += k to v
            // gestaffelt statt Raster
            col.addView(v, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply { bottomMargin = dp(8); marginStart = dp(idx * 18) })
        }
        paint()
    }

    private fun button(t: String, filled: Boolean = false, click: () -> Unit) {
        col.addView(Ui.pillButton(this, t, filled) { click() }, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply { topMargin = dp(6); bottomMargin = dp(8) })
    }

    @Suppress("UseSwitchCompatOrMaterialCode")
    private fun toggle(t: String, value: Boolean, save: (Boolean) -> Unit) {
        val s = Switch(this).apply {
            text = t; isChecked = value; setTextColor(Ui.TEXT); textSize = 15f; minHeight = dp(56); typeface = Ui.sans(context, 400)
            setPadding(dp(22), dp(8), dp(16), dp(8)); background = Ui.hairline(context)
            thumbTintList = ColorStateList(arrayOf(intArrayOf(android.R.attr.state_checked), intArrayOf()), intArrayOf(Ui.ICE, 0xFF8C96A5.toInt()))
            trackTintList = ColorStateList(arrayOf(intArrayOf(android.R.attr.state_checked), intArrayOf()), intArrayOf(0x807FD4FF.toInt(), 0x33FFFFFF))
            setOnCheckedChangeListener { _, c -> save(c) }
        }
        col.addView(s, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { bottomMargin = dp(10) })
    }

    private fun slider(t: String, value: Int, save: (Int) -> Unit) {
        val label = Ui.text(this, "$t: $value", 14f, Ui.TEXT).apply { setPadding(dp(8), dp(6), 0, 0) }
        col.addView(label)
        col.addView(SeekBar(this).apply {
            max = 9; progress = value - 1; minimumHeight = dp(48)
            progressTintList = ColorStateList.valueOf(Ui.ICE); thumbTintList = ColorStateList.valueOf(Ui.TEXT)
            progressBackgroundTintList = ColorStateList.valueOf(0x40FFFFFF)
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(sb: SeekBar?, p: Int, fromUser: Boolean) { label.text = "$t: ${p + 1}"; save(p + 1) }
                override fun onStartTrackingTouch(sb: SeekBar?) {}
                override fun onStopTrackingTouch(sb: SeekBar?) {}
            })
        }, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
    }
}
