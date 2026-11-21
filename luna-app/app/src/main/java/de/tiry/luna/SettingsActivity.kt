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
        root.addView(FieldView(this).apply { calm = true }, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
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
        field("So spricht Luna deinen Namen aus", prefs.spokenName) { prefs.spokenName = it }
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
            "eleven_v3" to "v3 · Emotionen: lacht, seufzt, flüstert",
            "eleven_multilingual_v2" to "Multilingual v2 · Menschlich",
            "eleven_flash_v2_5" to "Flash v2.5 · Blitzschnell",
        ), prefs.elevenModel) { prefs.elevenModel = it }
        section("Handy-Stimme")
        hint("Ohne ElevenLabs spricht Luna mit einer Stimme deines Handys. Tippe eine an, um sie zu hören und auszuwählen. Mehr Stimmen: Einstellungen → Allgemeine Verwaltung → Text-zu-Sprache → Sprachdaten installieren.")
        val voiceBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        col.addView(voiceBox)
        if (speaker == null) speaker = Speaker(this, prefs)
        fun renderVoices(attempt: Int) {
            val sp = speaker ?: return
            if (!sp.ready) { if (attempt < 20) voiceBox.postDelayed({ renderVoices(attempt + 1) }, 300); return }
            voiceBox.removeAllViews()
            val voices = sp.germanVoices()
            if (voices.isEmpty()) { voiceBox.addView(Ui.text(this, "Keine deutsche Stimme installiert.", 13.5f, Ui.STEEL)); return }
            val current = prefs.ttsVoice.ifBlank { voices.first().name }
            val btns = mutableListOf<Pair<String, LightButton>>()
            voices.take(12).forEachIndexed { idx, v ->
                val g = when (Speaker.femaleScore(v.name)) { 2 -> "weiblich"; 0 -> "männlich"; else -> "" }
                val label = "Stimme ${idx + 1}" + (if (g.isNotEmpty()) " · $g" else "") + (if (v.isNetworkConnectionRequired) " · online" else "")
                val b = LightButton(this, label)
                b.selected2 = v.name == current
                b.setOnClickListener {
                    sp.useVoice(v.name)
                    btns.forEach { (n, x) -> x.selected2 = n == v.name }
                    sp.speak("Hallo ${prefs.userName}, so würde ich klingen.") {}
                }
                btns += v.name to b
                voiceBox.addView(b, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply { marginStart = dp((idx % 3) * 14) })
            }
        }
        renderVoices(0)

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
        toggle("Bei „Hey Luna“ Display einschalten", prefs.wakeScreen) { prefs.wakeScreen = it }
        toggle("Luna unterbrechen, wenn ich dazwischenrede", prefs.bargeIn) { prefs.bargeIn = it }

        section("Gedächtnis")
        val store = MemoryStore(java.io.File(filesDir, "memories"))
        val snap = store.snapshot(4000)
        hint("Luna führt ihr eigenes Gedächtnis: eine Datei über sich selbst (ich.md), eine über dich und ein Gesprächs-Tagebuch. " +
            "Alles liegt nur auf diesem Handy.")
        col.addView(Ui.text(this, snap.ifBlank { "Noch leer – startet mit dem ersten Gespräch." }, 12.5f, Ui.STEEL).apply {
            typeface = android.graphics.Typeface.MONOSPACE; setPadding(dp(6), dp(4), dp(6), dp(12)) })
        button("Gedächtnis komplett löschen") {
            java.io.File(filesDir, "memories").deleteRecursively(); prefs.memories = emptyList(); recreate()
        }

        section("Rechte")
        permBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        col.addView(permBox)
        hint("Android 13+: Wenn die Bedienungshilfe ausgegraut ist („Eingeschränkte Einstellung“): Einstellungen → Apps → Luna → oben rechts ⋮ → „Eingeschränkte Einstellungen zulassen“. Danach geht es.")
        button("App-Info von Luna öffnen") {
            startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
        }

        section("Über")
        button("Nach Updates suchen", filled = true) {
            Toast.makeText(this, "Suche …", Toast.LENGTH_SHORT).show()
            Thread {
                val msg = try { Updater.run(applicationContext, onlyIfNew = false) } catch (e: Exception) { "Fehler: ${e.message}" }
                runOnUiThread { Toast.makeText(this, msg, Toast.LENGTH_LONG).show() }
            }.start()
        }
        hint("Luna ${BuildConfig.VERSION_NAME} · Wake-Word offline (das Mikrofon-Audio verlässt beim Warten nie das Handy). Gesprochenes nach „Hey Luna“ geht an die Google-Spracherkennung und – mit Schlüssel – an Claude bzw. ElevenLabs.")
    }

    override fun onResume() { super.onResume(); renderPerms() }

    private fun renderPerms() {
        permBox.removeAllViews()
        for (p in Permissions.all(this)) {
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
                setPadding(dp(4), dp(12), dp(8), dp(12)); minimumHeight = dp(64)
                setOnClickListener { openPermission(p.key) }
            }
            // Lichtstab: Mint = erteilt, Bernstein = fehlt
            row.addView(View(this).apply { background = Ui.gradient(context, 2f, *(if (p.granted) intArrayOf(Ui.MINT, 0x10B9FFE4) else intArrayOf(Ui.AMBER, 0x10FFD58A))) },
                LinearLayout.LayoutParams(dp(3), dp(40)).apply { marginEnd = dp(16) })
            val texts = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
            texts.addView(Ui.text(this, p.title, 15.5f, Ui.TEXT, true))
            texts.addView(Ui.text(this, if (p.granted) "Erteilt" else p.why + " Antippen zum Freigeben.", 13f, Ui.STEEL).apply { setPadding(0, dp(3), 0, 0) })
            row.addView(texts, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
            permBox.addView(row, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { bottomMargin = dp(10) })
        }
    }

    private var smsAsked = false

    private fun openPermission(key: String) {
        val i = when (key) {
            "mic" -> { requestPermissions(Permissions.FIRST.toTypedArray(), 2); return }
            "runtime" -> { requestPermissions(Permissions.runtimeFor(this).toTypedArray(), 2); return }
            "sms" -> {
                if (shouldShowRequestPermissionRationale(android.Manifest.permission.SEND_SMS) || checkSelfPermission(android.Manifest.permission.SEND_SMS) != android.content.pm.PackageManager.PERMISSION_GRANTED && !smsAsked) {
                    smsAsked = true; requestPermissions(arrayOf(android.Manifest.permission.SEND_SMS), 3); return
                }
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName"))
            }
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
    private val chapters = 10

    /** Kapitel-Kopf: „03 / 10“ in Haarlinien-Pille + Titel in breiter Chrom-Schrift. */
    private fun section(t: String) {
        chapter++
        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        row.addView(HairlineView(this), LinearLayout.LayoutParams(dp(28), dp(1)).apply { marginEnd = dp(10) })
        row.addView(Ui.label(this, "%02d / %02d".format(chapter, chapters), 8.5f, Ui.ICE, 0.3f))
        col.addView(row, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply { topMargin = dp(38) })
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
            background = Ui.underline(context)
            setOnFocusChangeListener { v, f -> v.background = Ui.underline(context, f) }
            setPadding(dp(14), dp(12), dp(14), dp(16)); minHeight = dp(52)
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
            (v as LightButton).selected2 = k == selected
        }
        options.forEachIndexed { idx, (k, text) ->
            val v = Ui.pillButton(this, text) { selected = k; save(k); paint() }
            v.gravity = Gravity.CENTER_VERTICAL or Gravity.START
            views += k to v
            // gestaffelt statt Raster
            col.addView(v, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply { bottomMargin = dp(2); marginStart = dp(idx * 18) })
        }
        paint()
    }

    private fun button(t: String, filled: Boolean = false, click: () -> Unit) {
        col.addView(Ui.pillButton(this, t, filled) { click() }, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply { topMargin = dp(6); bottomMargin = dp(8) })
    }

    /** Zeile mit Energieknoten statt Schalter. */
    private fun toggle(t: String, value: Boolean, save: (Boolean) -> Unit) {
        val node = NodeToggle(this).apply { on = value }
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; minimumHeight = dp(56)
            setPadding(dp(6), dp(6), dp(4), dp(6)); isClickable = true; isFocusable = true
            contentDescription = t
            setOnClickListener { node.on = !node.on; save(node.on) }
        }
        row.addView(Ui.text(this, t, 15f, Ui.TEXT), LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
        row.addView(node, LinearLayout.LayoutParams(dp(34), dp(34)))
        col.addView(row, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
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
