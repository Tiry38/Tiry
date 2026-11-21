package de.tiry.luna

import android.Manifest
import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.SearchManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.provider.AlarmClock
import android.provider.CalendarContract
import android.provider.ContactsContract
import android.provider.MediaStore
import android.provider.Settings
import android.telephony.SmsManager
import android.view.KeyEvent
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Lunas „Hände“: alles, was sie auf dem Handy tun kann. Dieselben Werkzeuge nutzen Claude (KI-Modus)
 * und der Offline-Modus. Jede Funktion liefert einen kurzen deutschen Ergebnistext zurück.
 */
class PhoneTools(private val ctx: Context, private val prefs: Prefs) : ToolExecutor {

    data class ToolDef(
        val name: String,
        val description: String,
        val props: Map<String, Map<String, Any>> = emptyMap(),
        val required: List<String> = emptyList(),
    )

    @Volatile private var pendingImage: String? = null
    override fun takeImage(): String? = pendingImage.also { pendingImage = null }

    /** Wird nach einem Werkzeug gesetzt, wenn Luna das Gespräch beenden soll. */
    @Volatile override var endRequested = false

    companion object {
        const val WG_PERMISSION = "com.wireguard.android.permission.CONTROL_TUNNELS"
        private fun s(desc: String) = mapOf("type" to "string", "description" to desc)
        private fun i(desc: String) = mapOf("type" to "integer", "description" to desc)
        private fun b(desc: String) = mapOf("type" to "boolean", "description" to desc)
        private fun e(desc: String, vararg values: String) = mapOf("type" to "string", "enum" to values.toList(), "description" to desc)

        val DEFINITIONS = listOf(
            ToolDef("get_time", "Aktuelle Uhrzeit, Datum und Wochentag."),
            ToolDef("get_device_status", "Akku, Ladezustand, Netzwerk, Klingelmodus, Lautstärke und freier Speicher des Handys."),
            ToolDef("open_app", "Öffnet eine installierte App anhand ihres Namens (z. B. WhatsApp, Spotify, Kamera, Einstellungen).",
                mapOf("name" to s("Name der App")), listOf("name")),
            ToolDef("call_contact", "Ruft einen Kontakt aus dem Adressbuch oder eine Telefonnummer an.",
                mapOf("name" to s("Kontaktname oder Telefonnummer")), listOf("name")),
            ToolDef("send_sms", "Sendet eine SMS. Vorher Empfänger und Text kurz bestätigen lassen, außer Tiry hat es ausdrücklich so diktiert.",
                mapOf("recipient" to s("Kontaktname oder Nummer"), "text" to s("Nachrichtentext")), listOf("recipient", "text")),
            ToolDef("send_whatsapp", "Schreibt eine WhatsApp-Nachricht an einen Kontakt und drückt auf Senden (braucht die Bedienungshilfe).",
                mapOf("recipient" to s("Kontaktname oder Nummer"), "text" to s("Nachrichtentext")), listOf("recipient", "text")),
            ToolDef("set_alarm", "Stellt einen Wecker.",
                mapOf("hour" to i("Stunde 0-23"), "minute" to i("Minute 0-59"), "label" to s("Optionale Beschriftung")), listOf("hour", "minute")),
            ToolDef("set_timer", "Startet einen Timer.",
                mapOf("seconds" to i("Dauer in Sekunden"), "label" to s("Optionale Beschriftung")), listOf("seconds")),
            ToolDef("set_reminder", "Erinnert Tiry später per Sprache und Benachrichtigung an etwas.",
                mapOf("text" to s("Woran erinnert werden soll"), "in_minutes" to i("In wie vielen Minuten"),
                    "at" to s("Alternativ fester Zeitpunkt, Format yyyy-MM-dd HH:mm")), listOf("text")),
            ToolDef("flashlight", "Schaltet die Taschenlampe ein oder aus.", mapOf("on" to b("true = an")), listOf("on")),
            ToolDef("set_volume", "Ändert die Medien-Lautstärke: entweder level (0-100 %) oder change (up/down).",
                mapOf("level" to i("Lautstärke in Prozent"), "change" to e("Schrittweise ändern", "up", "down"))),
            ToolDef("set_ringer_mode", "Klingelmodus: normal, vibrate oder silent.", mapOf("mode" to e("Modus", "normal", "vibrate", "silent")), listOf("mode")),
            ToolDef("media_control", "Steuert die laufende Musik/Videos.", mapOf("action" to e("Aktion", "play", "pause", "next", "previous")), listOf("action")),
            ToolDef("play_music", "Spielt Musik, einen Künstler, eine Playlist oder einen Podcast über die Musik-App (bevorzugt Spotify).",
                mapOf("query" to s("Was gespielt werden soll")), listOf("query")),
            ToolDef("navigate", "Startet die Navigation in Google Maps.",
                mapOf("destination" to s("Ziel"), "mode" to e("Fortbewegung", "drive", "bike", "walk")), listOf("destination")),
            ToolDef("web_search_open", "Öffnet eine Google-Suche im Browser auf dem Bildschirm.", mapOf("query" to s("Suchbegriff")), listOf("query")),
            ToolDef("open_url", "Öffnet eine Webseite.", mapOf("url" to s("Vollständige URL")), listOf("url")),
            ToolDef("get_weather", "Wetter jetzt und die nächsten Tage (Standard: Tirys Wohnort).",
                mapOf("location" to s("Ort, optional"), "days" to i("Anzahl Tage 1-7, optional"))),
            ToolDef("read_notifications", "Liest die neuesten Benachrichtigungen (WhatsApp, Mails, …).", mapOf("limit" to i("Anzahl, Standard 8"))),
            ToolDef("get_calendar_events", "Termine aus dem Kalender.", mapOf("days" to i("Wie viele Tage ab heute, Standard 1"))),
            ToolDef("create_calendar_event", "Trägt einen Termin in den Kalender ein.",
                mapOf("title" to s("Titel"), "start" to s("Beginn yyyy-MM-dd HH:mm"), "duration_minutes" to i("Dauer, Standard 60"),
                    "location" to s("Ort, optional")), listOf("title", "start")),
            ToolDef("screen_action", "Systemaktion: back, home, recents, notifications, quick_settings, lock, screenshot, power_menu.",
                mapOf("action" to e("Aktion", "back", "home", "recents", "notifications", "quick_settings", "lock", "screenshot", "power_menu")), listOf("action")),
            ToolDef("read_screen", "Liest alle sichtbaren Texte und Knöpfe des aktuellen Bildschirms (zum Steuern fremder Apps)."),
            ToolDef("tap_element", "Tippt auf einen Knopf/Text auf dem Bildschirm (Text oder Beschreibung des Elements).",
                mapOf("text" to s("Sichtbarer Text oder Beschreibung")), listOf("text")),
            ToolDef("look_at_screen", "Macht einen Screenshot und zeigt ihn dir als Bild – für „guck mal“, Bilder, Spiele, Apps ohne lesbaren Text."),
            ToolDef("tap_at", "Tippt auf eine Stelle im zuletzt mit look_at_screen gesehenen Bild (Pixel-Koordinaten im Bild).",
                mapOf("x" to i("x im Bild"), "y" to i("y im Bild")), listOf("x", "y")),
            ToolDef("scroll", "Scrollt den Bildschirm.", mapOf("direction" to e("Richtung", "up", "down", "left", "right")), listOf("direction")),
            ToolDef("type_text", "Schreibt Text in das gerade ausgewählte Eingabefeld.", mapOf("text" to s("Text")), listOf("text")),
            ToolDef("open_settings", "Öffnet eine Einstellungsseite: wifi, bluetooth, internet, volume, display, battery, location, nfc, apps, all.",
                mapOf("page" to e("Seite", "wifi", "bluetooth", "internet", "volume", "display", "battery", "location", "nfc", "apps", "all")), listOf("page")),
            ToolDef("set_brightness", "Bildschirmhelligkeit in Prozent.", mapOf("level" to i("0-100")), listOf("level")),
            ToolDef("fritz_status", "FRITZ!Box: Modell, FRITZ!OS, Laufzeit, Internet-Adresse."),
            ToolDef("fritz_devices", "FRITZ!Box: welche Geräte gerade im Heimnetz online sind.", mapOf("all" to b("true = auch offline Geräte"))),
            ToolDef("fritz_guest_wifi", "FRITZ!Box: Gast-WLAN an/aus oder Status (on weglassen = nur Status).", mapOf("on" to b("an/aus"))),
            ToolDef("fritz_reconnect", "FRITZ!Box: Internet neu verbinden (neue IP). Nur auf ausdrücklichen Wunsch – Internet ist kurz weg."),
            ToolDef("fritz_calls", "FRITZ!Box: letzte Anrufe am Festnetz.", mapOf("max" to i("Anzahl, Standard 5"))),
            ToolDef("fritz_wake_device", "Weckt ein Gerät im Heimnetz per Wake-on-LAN (Name aus der FRITZ!Box oder MAC).", mapOf("device" to s("Gerätename oder MAC")), listOf("device")),
            ToolDef("pc_wake", "Schaltet Tirys PC per Wake-on-LAN ein (auch unterwegs über VPN)."),
            ToolDef("pc_status", "Prüft, ob Tirys PC an ist."),
            ToolDef("pc_remote", "PC fernsteuern: PC einschalten (falls aus), warten bis er da ist, dann die Fernsteuerungs-App öffnen."),
            ToolDef("vpn_connect", "Verbindet/trennt das WireGuard-VPN zur FRITZ!Box (für Zugriff von unterwegs).", mapOf("on" to b("true = verbinden")), listOf("on")),
            ToolDef("remember", "Merkt sich dauerhaft eine Info über Tiry (Vorlieben, Termine, Fakten).", mapOf("fact" to s("Was gemerkt werden soll")), listOf("fact")),
            ToolDef("forget", "Löscht gemerkte Infos, die diesen Text enthalten.", mapOf("match" to s("Suchtext")), listOf("match")),
            ToolDef("end_conversation", "Beendet das Gespräch nach deiner Antwort (Tiry sagt tschüss/danke/passt). Danach wartet Luna wieder auf „Hey Luna“."),
        )
    }

    override fun run(name: String, a: Map<String, Any?>): String = try {
        when (name) {
            "get_time" -> timeText()
            "get_device_status" -> deviceStatus()
            "open_app" -> openApp(str(a, "name"))
            "call_contact" -> call(str(a, "name"))
            "send_sms" -> sms(str(a, "recipient"), str(a, "text"))
            "send_whatsapp" -> whatsapp(str(a, "recipient"), str(a, "text"))
            "set_alarm" -> alarm(int(a, "hour") ?: 7, int(a, "minute") ?: 0, a["label"]?.toString())
            "set_timer" -> timer(int(a, "seconds") ?: 60, a["label"]?.toString())
            "set_reminder" -> reminder(str(a, "text"), int(a, "in_minutes"), a["at"]?.toString())
            "flashlight" -> torch(a["on"]?.toString()?.toBooleanStrictOrNull() ?: true)
            "set_volume" -> volume(int(a, "level"), a["change"]?.toString())
            "set_ringer_mode" -> ringer(str(a, "mode"))
            "media_control" -> media(str(a, "action"))
            "play_music" -> playMusic(str(a, "query"))
            "navigate" -> navigate(str(a, "destination"), a["mode"]?.toString() ?: "drive")
            "web_search_open" -> startView(Intent(Intent.ACTION_WEB_SEARCH).putExtra(SearchManager.QUERY, str(a, "query")),
                Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/search?q=" + enc(str(a, "query")))), "Suche nach ${str(a, "query")} geöffnet.")
            "open_url" -> startView(Intent(Intent.ACTION_VIEW, Uri.parse(str(a, "url").let { if (it.startsWith("http")) it else "https://$it" })), null, "Seite geöffnet.")
            "get_weather" -> weather(a["location"]?.toString()?.takeIf { it.isNotBlank() } ?: prefs.homeCity, int(a, "days") ?: 2)
            "read_notifications" -> NotificationStore.describe(ctx, int(a, "limit") ?: 8)
            "get_calendar_events" -> calendarEvents(int(a, "days") ?: 1)
            "create_calendar_event" -> createEvent(str(a, "title"), str(a, "start"), int(a, "duration_minutes") ?: 60, a["location"]?.toString())
            "screen_action" -> acc { it.global(str(a, "action")) }
            "read_screen" -> acc { it.readScreen() }
            "look_at_screen" -> acc { svc ->
                val img = svc.screenshotJpeg()
                if (img == null) "Screenshot ging nicht (braucht Android 11+ und die Bedienungshilfe)." else { pendingImage = img; "Hier ist der aktuelle Bildschirm." }
            }
            "tap_at" -> acc { svc ->
                val sc = svc.lastShotScale
                if (svc.tapAt((int(a, "x") ?: 0) / sc, (int(a, "y") ?: 0) / sc)) "Getippt." else "Tippen hat nicht geklappt."
            }
            "tap_element" -> acc { it.tapText(str(a, "text")) }
            "scroll" -> acc { it.scroll(str(a, "direction")) }
            "type_text" -> acc { it.typeText(str(a, "text")) }
            "fritz_status" -> fritz().info()
            "fritz_devices" -> fritz().hosts().filter { it.active || a["all"]?.toString() == "true" }.let { l ->
                if (l.isEmpty()) "Keine Geräte gefunden." else "${l.count { it.active }} Geräte online: " + l.joinToString(", ") { it.name + (if (it.active) "" else " (offline)") } }
            "fritz_guest_wifi" -> fritz().guestWifi(a["on"]?.toString()?.toBooleanStrictOrNull())
            "fritz_reconnect" -> { fritz().reconnect(); "Die FRITZ!Box verbindet sich neu. Das Internet ist ein paar Sekunden weg." }
            "fritz_calls" -> fritz().callList(int(a, "max") ?: 5)
            "fritz_wake_device" -> wakeDevice(str(a, "device"))
            "pc_wake" -> pcWake()
            "pc_status" -> if (pcOnline()) "Dein PC ist an." else "Dein PC ist aus oder nicht erreichbar."
            "pc_remote" -> pcRemote()
            "vpn_connect" -> vpn(a["on"]?.toString()?.toBooleanStrictOrNull() ?: true)
            "open_settings" -> openSettings(str(a, "page"))
            "set_brightness" -> brightness(int(a, "level") ?: 50)
            "remember" -> { prefs.addMemory(str(a, "fact")); "Gemerkt." }
            "list_memories" -> prefs.memories.let { if (it.isEmpty()) "Noch nichts gemerkt." else it.joinToString("; ") }
            "forget" -> { val m = str(a, "match").lowercase(); val before = prefs.memories.size
                prefs.memories = prefs.memories.filterNot { it.lowercase().contains(m) }; "${before - prefs.memories.size} Einträge gelöscht." }
            "end_conversation" -> { endRequested = true; "Gespräch wird nach der Antwort beendet." }
            else -> "Unbekanntes Werkzeug $name."
        }
    } catch (e: SecurityException) {
        "Fehlende Berechtigung: ${e.message ?: "bitte in Lunas Einstellungen unter Rechte freigeben"}."
    } catch (e: Exception) {
        "Fehler bei $name: ${e.message ?: e.javaClass.simpleName}"
    }

    // ---------- Helfer ----------
    private fun str(a: Map<String, Any?>, k: String) = a[k]?.toString()?.trim() ?: ""
    private fun int(a: Map<String, Any?>, k: String): Int? = when (val v = a[k]) {
        is Number -> v.toInt(); is String -> v.trim().toDoubleOrNull()?.toInt(); else -> null
    }
    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")
    private fun has(p: String) = ctx.checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED
    private fun launch(i: Intent) { ctx.startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    private fun startView(i: Intent, fallback: Intent?, ok: String): String = try { launch(i); ok } catch (e: Exception) {
        if (fallback != null) { launch(fallback); ok } else throw e
    }
    private fun acc(f: (LunaAccessibilityService) -> String): String =
        LunaAccessibilityService.instance?.let(f) ?: "Die Bedienungshilfe für Luna ist nicht aktiv. Tiry muss sie einmal in Lunas Einstellungen unter Rechte einschalten."

    private val de = Locale.GERMANY

    fun timeText(): String = SimpleDateFormat("EEEE, d. MMMM yyyy, HH:mm 'Uhr'", de).format(Date())

    fun batteryPercent(): Int = (ctx.getSystemService(Context.BATTERY_SERVICE) as BatteryManager).getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)

    fun deviceStatus(): String {
        val bm = ctx.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        val charging = bm.isCharging
        val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val vol = am.getStreamVolume(AudioManager.STREAM_MUSIC) * 100 / am.getStreamMaxVolume(AudioManager.STREAM_MUSIC).coerceAtLeast(1)
        val ringer = when (am.ringerMode) { AudioManager.RINGER_MODE_SILENT -> "lautlos"; AudioManager.RINGER_MODE_VIBRATE -> "Vibration"; else -> "Ton an" }
        val cm = ctx.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val caps = cm.getNetworkCapabilities(cm.activeNetwork)
        val net = when {
            caps == null -> "kein Internet"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "WLAN"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "mobile Daten"
            else -> "verbunden"
        }
        val st = StatFs(Environment.getDataDirectory().path)
        val freeGb = st.availableBytes / 1_000_000_000.0
        return "Akku ${batteryPercent()} %${if (charging) ", lädt gerade" else ""}. Netz: $net. Klingelmodus: $ringer. " +
            "Medienlautstärke $vol %. Freier Speicher: ${"%.1f".format(de, freeGb)} GB."
    }

    // ---------- Apps ----------
    private val aliases = mapOf(
        "einstellungen" to Settings.ACTION_SETTINGS, "settings" to Settings.ACTION_SETTINGS,
        "kamera" to MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA, "camera" to MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA,
        "video" to MediaStore.INTENT_ACTION_VIDEO_CAMERA,
    )

    data class AppHit(val label: String, val pkg: String, val score: Int)

    fun findApp(query: String): AppHit? {
        val q = norm(query)
        if (q.isBlank()) return null
        val pm = ctx.packageManager
        val main = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val apps = pm.queryIntentActivities(main, 0)
        return apps.map {
            val label = it.loadLabel(pm).toString()
            val l = norm(label)
            val score = when {
                l == q -> 100
                l.startsWith(q) || q.startsWith(l) -> 80
                l.contains(q) || q.contains(l) && l.length >= 3 -> 60
                it.activityInfo.packageName.contains(q.replace(" ", "")) -> 50
                levenshtein(l, q) <= maxOf(1, q.length / 4) -> 40
                else -> 0
            }
            AppHit(label, it.activityInfo.packageName, score)
        }.filter { it.score > 0 }.maxByOrNull { it.score }
    }

    private fun openApp(name: String): String {
        aliases[norm(name)]?.let { launch(Intent(it)); return "$name geöffnet." }
        val hit = findApp(name) ?: return "Ich habe keine App namens „$name“ gefunden."
        val i = ctx.packageManager.getLaunchIntentForPackage(hit.pkg) ?: return "${hit.label} lässt sich nicht starten."
        launch(i)
        return "${hit.label} geöffnet."
    }

    private fun norm(s: String) = s.lowercase(de).replace(Regex("[^a-z0-9äöüß ]"), "").replace(Regex("\\s+"), " ").trim()

    private fun levenshtein(a: String, b: String): Int {
        val d = IntArray(b.length + 1) { it }
        for (i in 1..a.length) {
            var prev = d[0]; d[0] = i
            for (j in 1..b.length) {
                val tmp = d[j]
                d[j] = minOf(d[j] + 1, d[j - 1] + 1, prev + if (a[i - 1] == b[j - 1]) 0 else 1)
                prev = tmp
            }
        }
        return d[b.length]
    }

    // ---------- Kontakte / Telefon ----------
    data class Contact(val name: String, val number: String)

    @SuppressLint("Range")
    fun findContact(query: String): Contact? {
        val digits = query.replace(Regex("[^0-9+]"), "")
        if (digits.length >= 5) return Contact(query, digits)
        if (!has(Manifest.permission.READ_CONTACTS)) throw SecurityException("Kontakte lesen ist nicht erlaubt")
        val q = norm(query).removePrefix("meine ").removePrefix("meinen ").removePrefix("meinem ").removePrefix("den ").removePrefix("die ")
        val list = mutableListOf<Contact>()
        ctx.contentResolver.query(
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
            arrayOf(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME, ContactsContract.CommonDataKinds.Phone.NUMBER),
            null, null, null,
        )?.use { c -> while (c.moveToNext()) list += Contact(c.getString(0) ?: "", c.getString(1) ?: "") }
        val best = list.map { c ->
            val n = norm(c.name)
            val score = when {
                n == q -> 100
                n.split(" ").any { it == q } -> 85
                n.startsWith(q) -> 75
                n.contains(q) -> 60
                n.split(" ").any { levenshtein(it, q) <= 1 } -> 45
                else -> 0
            }
            c to score
        }.filter { it.second > 0 }.maxByOrNull { it.second }
        return best?.first
    }

    private fun call(who: String): String {
        val c = findContact(who) ?: return "Ich finde „$who“ nicht in deinen Kontakten."
        val uri = Uri.parse("tel:" + Uri.encode(c.number))
        return if (has(Manifest.permission.CALL_PHONE)) { launch(Intent(Intent.ACTION_CALL, uri)); "Rufe ${c.name} an." }
        else { launch(Intent(Intent.ACTION_DIAL, uri)); "Wählfeld für ${c.name} geöffnet (Anruf-Recht fehlt)." }
    }

    private fun sms(who: String, text: String): String {
        val c = findContact(who) ?: return "Ich finde „$who“ nicht in deinen Kontakten."
        if (!has(Manifest.permission.SEND_SMS)) throw SecurityException("SMS senden ist nicht erlaubt")
        @Suppress("DEPRECATION")
        val sm = if (Build.VERSION.SDK_INT >= 31) ctx.getSystemService(SmsManager::class.java) else SmsManager.getDefault()
        sm.sendMultipartTextMessage(c.number, null, sm.divideMessage(text), null, null)
        return "SMS an ${c.name} gesendet."
    }

    private fun intlNumber(n: String): String {
        var d = n.replace(Regex("[^0-9+]"), "")
        if (d.startsWith("+")) return d.drop(1)
        if (d.startsWith("00")) return d.drop(2)
        if (d.startsWith("0")) d = "49" + d.drop(1)
        return d
    }

    private fun whatsapp(who: String, text: String): String {
        val c = findContact(who) ?: return "Ich finde „$who“ nicht in deinen Kontakten."
        val uri = Uri.parse("https://api.whatsapp.com/send?phone=${intlNumber(c.number)}&text=${enc(text)}")
        val pkg = listOf("com.whatsapp", "com.whatsapp.w4b").firstOrNull { installed(it) }
            ?: return "WhatsApp ist nicht installiert."
        launch(Intent(Intent.ACTION_VIEW, uri).setPackage(pkg))
        val acc = LunaAccessibilityService.instance ?: return "WhatsApp mit der Nachricht an ${c.name} ist offen. Zum automatischen Senden brauche ich die Bedienungshilfe – bitte einmal auf Senden tippen."
        for (attempt in 0 until 8) {
            Thread.sleep(700)
            if (acc.tapByIdOrDesc(listOf("com.whatsapp:id/send", "com.whatsapp.w4b:id/send"), listOf("Senden", "Send"))) return "WhatsApp an ${c.name} gesendet."
        }
        return "WhatsApp an ${c.name} ist vorbereitet, den Senden-Knopf habe ich nicht gefunden."
    }

    private fun installed(pkg: String) = try { ctx.packageManager.getPackageInfo(pkg, 0); true } catch (_: Exception) { false }

    // ---------- Zeit ----------
    private fun alarm(h: Int, m: Int, label: String?): String {
        launch(Intent(AlarmClock.ACTION_SET_ALARM).putExtra(AlarmClock.EXTRA_HOUR, h).putExtra(AlarmClock.EXTRA_MINUTES, m)
            .putExtra(AlarmClock.EXTRA_SKIP_UI, true).apply { if (!label.isNullOrBlank()) putExtra(AlarmClock.EXTRA_MESSAGE, label) })
        return "Wecker auf %d:%02d Uhr gestellt.".format(h, m)
    }

    private fun timer(sec: Int, label: String?): String {
        launch(Intent(AlarmClock.ACTION_SET_TIMER).putExtra(AlarmClock.EXTRA_LENGTH, sec.coerceIn(1, 86399))
            .putExtra(AlarmClock.EXTRA_SKIP_UI, true).apply { if (!label.isNullOrBlank()) putExtra(AlarmClock.EXTRA_MESSAGE, label) })
        return "Timer über ${durationText(sec)} läuft."
    }

    fun durationText(sec: Int): String {
        val h = sec / 3600; val m = (sec % 3600) / 60; val s = sec % 60
        return listOfNotNull(
            if (h > 0) "$h ${if (h == 1) "Stunde" else "Stunden"}" else null,
            if (m > 0) "$m ${if (m == 1) "Minute" else "Minuten"}" else null,
            if (s > 0) "$s ${if (s == 1) "Sekunde" else "Sekunden"}" else null,
        ).joinToString(" und ")
    }

    private fun reminder(text: String, inMin: Int?, at: String?): String {
        val whenMs = when {
            !at.isNullOrBlank() -> SimpleDateFormat("yyyy-MM-dd HH:mm", de).parse(at)?.time
            inMin != null -> System.currentTimeMillis() + inMin * 60_000L
            else -> null
        } ?: return "Wann soll ich dich erinnern?"
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = PendingIntent.getBroadcast(ctx, (whenMs / 1000).toInt(),
            Intent(ctx, ReminderReceiver::class.java).putExtra("text", text),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        if (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, whenMs, pi)
        else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, whenMs, pi)
        return "Erinnerung gesetzt für " + SimpleDateFormat("EEEE HH:mm 'Uhr'", de).format(Date(whenMs)) + "."
    }

    // ---------- Hardware ----------
    private fun torch(on: Boolean): String {
        val cm = ctx.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val id = cm.cameraIdList.firstOrNull { cm.getCameraCharacteristics(it).get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true }
            ?: return "Dieses Handy hat keine Taschenlampe."
        cm.setTorchMode(id, on)
        return if (on) "Taschenlampe an." else "Taschenlampe aus."
    }

    private fun volume(level: Int?, change: String?): String {
        val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        when {
            level != null -> am.setStreamVolume(AudioManager.STREAM_MUSIC, (level.coerceIn(0, 100) * max + 50) / 100, 0)
            change == "down" -> repeat(2) { am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_LOWER, 0) }
            else -> repeat(2) { am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_RAISE, 0) }
        }
        return "Lautstärke jetzt ${am.getStreamVolume(AudioManager.STREAM_MUSIC) * 100 / max.coerceAtLeast(1)} Prozent."
    }

    private fun ringer(mode: String): String {
        val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val nm = ctx.getSystemService(NotificationManager::class.java)
        if (!nm.isNotificationPolicyAccessGranted && mode != "normal") {
            launch(Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS))
            return "Dafür brauche ich den Zugriff auf „Bitte nicht stören“. Ich habe die Einstellung geöffnet – bitte Luna erlauben."
        }
        am.ringerMode = when (mode) { "silent" -> AudioManager.RINGER_MODE_SILENT; "vibrate" -> AudioManager.RINGER_MODE_VIBRATE; else -> AudioManager.RINGER_MODE_NORMAL }
        return when (mode) { "silent" -> "Handy ist lautlos."; "vibrate" -> "Handy ist auf Vibration."; else -> "Ton ist wieder an." }
    }

    private fun media(action: String): String {
        val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val code = when (action) {
            "pause" -> KeyEvent.KEYCODE_MEDIA_PAUSE; "next" -> KeyEvent.KEYCODE_MEDIA_NEXT
            "previous" -> KeyEvent.KEYCODE_MEDIA_PREVIOUS; else -> KeyEvent.KEYCODE_MEDIA_PLAY
        }
        am.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, code))
        am.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_UP, code))
        return when (action) { "pause" -> "Pausiert."; "next" -> "Nächster Titel."; "previous" -> "Vorheriger Titel."; else -> "Läuft." }
    }

    private fun playMusic(q: String): String {
        val i = Intent(MediaStore.INTENT_ACTION_MEDIA_PLAY_FROM_SEARCH)
            .putExtra(SearchManager.QUERY, q).putExtra(MediaStore.EXTRA_MEDIA_FOCUS, "vnd.android.cursor.item/*")
        listOf("com.spotify.music", "com.google.android.apps.youtube.music", "com.amazon.mp3", "deezer.android.app")
            .firstOrNull { installed(it) }?.let { i.setPackage(it) }
        return try { launch(i); "Spiele $q." } catch (_: Exception) {
            launch(Intent(Intent.ACTION_VIEW, Uri.parse("https://www.youtube.com/results?search_query=" + enc(q)))); "Ich habe $q auf YouTube gesucht."
        }
    }

    private fun navigate(dest: String, mode: String): String {
        val m = when (mode) { "bike" -> "b"; "walk" -> "w"; else -> "d" }
        return startView(Intent(Intent.ACTION_VIEW, Uri.parse("google.navigation:q=${enc(dest)}&mode=$m")),
            Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=${enc(dest)}")), "Navigation nach $dest gestartet.")
    }

    private fun openSettings(page: String): String {
        val action = when (page) {
            "wifi" -> if (Build.VERSION.SDK_INT >= 29) Settings.Panel.ACTION_WIFI else Settings.ACTION_WIFI_SETTINGS
            "internet" -> if (Build.VERSION.SDK_INT >= 29) Settings.Panel.ACTION_INTERNET_CONNECTIVITY else Settings.ACTION_WIRELESS_SETTINGS
            "volume" -> if (Build.VERSION.SDK_INT >= 29) Settings.Panel.ACTION_VOLUME else Settings.ACTION_SOUND_SETTINGS
            "nfc" -> if (Build.VERSION.SDK_INT >= 29) Settings.Panel.ACTION_NFC else Settings.ACTION_NFC_SETTINGS
            "bluetooth" -> Settings.ACTION_BLUETOOTH_SETTINGS
            "display" -> Settings.ACTION_DISPLAY_SETTINGS
            "battery" -> Intent.ACTION_POWER_USAGE_SUMMARY
            "location" -> Settings.ACTION_LOCATION_SOURCE_SETTINGS
            "apps" -> Settings.ACTION_APPLICATION_SETTINGS
            else -> Settings.ACTION_SETTINGS
        }
        launch(Intent(action))
        return "Einstellungen geöffnet."
    }

    private fun brightness(level: Int): String {
        if (!Settings.System.canWrite(ctx)) {
            launch(Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS, Uri.parse("package:" + ctx.packageName)))
            return "Für die Helligkeit brauche ich einmal das Recht „Systemeinstellungen ändern“. Ich habe es geöffnet."
        }
        Settings.System.putInt(ctx.contentResolver, Settings.System.SCREEN_BRIGHTNESS_MODE, Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL)
        Settings.System.putInt(ctx.contentResolver, Settings.System.SCREEN_BRIGHTNESS, (level.coerceIn(0, 100) * 255 / 100).coerceAtLeast(1))
        return "Helligkeit auf $level Prozent."
    }

    // ---------- Kalender ----------
    private fun calendarEvents(days: Int): String {
        if (!has(Manifest.permission.READ_CALENDAR)) throw SecurityException("Kalender lesen ist nicht erlaubt")
        val start = Calendar.getInstance().apply { set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0) }
        val end = (start.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, days.coerceIn(1, 14)) }
        val uri = CalendarContract.Instances.CONTENT_URI.buildUpon().let {
            android.content.ContentUris.appendId(it, start.timeInMillis); android.content.ContentUris.appendId(it, end.timeInMillis); it.build()
        }
        val out = mutableListOf<String>()
        val f = SimpleDateFormat("EEE HH:mm", de)
        ctx.contentResolver.query(uri, arrayOf(CalendarContract.Instances.TITLE, CalendarContract.Instances.BEGIN, CalendarContract.Instances.ALL_DAY,
            CalendarContract.Instances.EVENT_LOCATION), null, null, CalendarContract.Instances.BEGIN + " ASC")?.use { c ->
            while (c.moveToNext() && out.size < 15) {
                val title = c.getString(0) ?: "Termin"
                val allDay = c.getInt(2) == 1
                val loc = c.getString(3)?.takeIf { it.isNotBlank() }?.let { " ($it)" } ?: ""
                out += (if (allDay) "ganztägig" else f.format(Date(c.getLong(1)))) + ": " + title + loc
            }
        }
        return if (out.isEmpty()) "Keine Termine." else out.joinToString("; ")
    }

    private fun createEvent(title: String, start: String, dur: Int, loc: String?): String {
        if (!has(Manifest.permission.WRITE_CALENDAR)) throw SecurityException("Kalender schreiben ist nicht erlaubt")
        val begin = SimpleDateFormat("yyyy-MM-dd HH:mm", de).parse(start)?.time ?: return "Ungültiger Zeitpunkt."
        var calId: Long? = null
        ctx.contentResolver.query(CalendarContract.Calendars.CONTENT_URI, arrayOf(CalendarContract.Calendars._ID, CalendarContract.Calendars.IS_PRIMARY,
            CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL), "${CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL} >= ${CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR}",
            null, null)?.use { c -> while (c.moveToNext()) { if (calId == null || c.getInt(1) == 1) calId = c.getLong(0) } }
        val id = calId ?: return "Kein beschreibbarer Kalender gefunden."
        val v = ContentValues().apply {
            put(CalendarContract.Events.CALENDAR_ID, id); put(CalendarContract.Events.TITLE, title)
            put(CalendarContract.Events.DTSTART, begin); put(CalendarContract.Events.DTEND, begin + dur * 60_000L)
            put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().id)
            if (!loc.isNullOrBlank()) put(CalendarContract.Events.EVENT_LOCATION, loc)
        }
        ctx.contentResolver.insert(CalendarContract.Events.CONTENT_URI, v)
        return "Termin „$title“ eingetragen: " + SimpleDateFormat("EEEE, d. MMMM HH:mm", de).format(Date(begin)) + "."
    }

    // ---------- Heimnetz: FRITZ!Box, PC, VPN ----------
    private fun fritz(): FritzBox {
        if (prefs.fritzPass.isBlank()) throw IllegalStateException("Die FRITZ!Box ist noch nicht eingerichtet. Tiry muss in Lunas Einstellungen unter Heimnetz Benutzer und Passwort eintragen.")
        return FritzBox(prefs.fritzHost, prefs.fritzUser, prefs.fritzPass)
    }

    private fun wakeDevice(dev: String): String {
        val mac = if (Regex("([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}").matches(dev)) dev
            else fritz().findHost(dev)?.mac ?: return "Ich finde kein Gerät „$dev“ in der FRITZ!Box."
        fritz().wake(mac)
        return "Weckruf an $dev gesendet."
    }

    private fun pcMac(): String? = prefs.pcMac.ifBlank { null }
        ?: if (prefs.pcName.isNotBlank() && prefs.fritzPass.isNotBlank()) fritz().findHost(prefs.pcName)?.mac else null

    private fun pcIp(): String? = if (prefs.fritzPass.isNotBlank() && prefs.pcName.isNotBlank())
        try { fritz().findHost(prefs.pcName)?.ip?.ifBlank { null } } catch (_: Exception) { null } else null

    fun pcOnline(): Boolean {
        if (prefs.fritzPass.isNotBlank() && prefs.pcName.isNotBlank()) {
            val h = try { fritz().findHost(prefs.pcName) } catch (_: Exception) { null }
            if (h != null) return h.active || (h.ip.isNotBlank() && FritzBox.reachable(h.ip))
        }
        return pcIp()?.let { FritzBox.reachable(it) } ?: false
    }

    private fun pcWake(): String {
        val mac = pcMac() ?: return "Ich kenne deinen PC noch nicht. Trag in Lunas Einstellungen unter Heimnetz den PC-Namen oder die MAC-Adresse ein."
        return if (prefs.fritzPass.isNotBlank()) { fritz().wake(mac); "Dein PC wird geweckt. Das dauert meist 20 bis 60 Sekunden." }
        else { FritzBox.magicPacket(mac); "Weckruf an deinen PC gesendet (funktioniert so nur im WLAN zu Hause)." }
    }

    private val remoteApps = listOf(
        "com.carriez.flutter_hbb" to "RustDesk", "com.google.chromeremotedesktop" to "Chrome Remote Desktop",
        "com.microsoft.rdc.androidx" to "Windows App", "com.anydesk.anydeskandroid" to "AnyDesk",
        "com.teamviewer.teamviewer.market.mobile" to "TeamViewer",
    )

    private fun pcRemote(): String {
        var woke = false
        if (!pcOnline()) {
            pcWake(); woke = true
            val until = System.currentTimeMillis() + 120_000
            while (System.currentTimeMillis() < until && !pcOnline()) Thread.sleep(5000)
            if (!pcOnline()) return "Ich habe den PC geweckt, aber er meldet sich noch nicht. Gib ihm noch eine Minute und frag nochmal."
        }
        val pkg = prefs.remoteApp.ifBlank { null }?.takeIf { installed(it) } ?: remoteApps.firstOrNull { installed(it.first) }?.first
            ?: return (if (woke) "Dein PC ist jetzt an. " else "Dein PC ist an. ") + "Es ist aber keine Fernsteuerungs-App installiert – ich empfehle RustDesk oder Chrome Remote Desktop."
        ctx.packageManager.getLaunchIntentForPackage(pkg)?.let { launch(it) }
        val name = remoteApps.firstOrNull { it.first == pkg }?.second ?: "die Fernsteuerung"
        return (if (woke) "Dein PC ist hochgefahren. " else "Dein PC läuft. ") + "Ich habe $name geöffnet."
    }

    private fun vpn(on: Boolean): String {
        val tunnel = prefs.vpnTunnel.ifBlank { return "Trag in Lunas Einstellungen unter Heimnetz den Namen deines WireGuard-Tunnels ein." }
        if (!installed("com.wireguard.android")) return "Die WireGuard-App ist nicht installiert."
        if (ctx.checkSelfPermission(WG_PERMISSION) != PackageManager.PERMISSION_GRANTED)
            return "Mir fehlt das Recht, WireGuard zu steuern. Bitte in Lunas Einstellungen unter Rechte freigeben."
        ctx.sendBroadcast(Intent(if (on) "com.wireguard.android.action.SET_TUNNEL_UP" else "com.wireguard.android.action.SET_TUNNEL_DOWN")
            .setPackage("com.wireguard.android").putExtra("tunnel", tunnel))
        if (on) Thread.sleep(2500)
        return if (on) "VPN nach Hause ist verbunden (falls in WireGuard „Allow remote control apps“ an ist)." else "VPN getrennt."
    }

    // ---------- Wetter (Open-Meteo, kostenlos, ohne Key) ----------
    private fun httpGet(url: String): String {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 8000; c.readTimeout = 8000
        return c.inputStream.bufferedReader().use { it.readText() }
    }

    fun weather(place: String, days: Int): String {
        val geo = JSONObject(httpGet("https://geocoding-api.open-meteo.com/v1/search?count=1&language=de&name=" + enc(place.replace(" am Rhein", ""))))
        val r = geo.optJSONArray("results")?.optJSONObject(0) ?: return "Ich kenne den Ort „$place“ nicht."
        val lat = r.getDouble("latitude"); val lon = r.getDouble("longitude"); val name = r.optString("name", place)
        val d = days.coerceIn(1, 7)
        val w = JSONObject(httpGet("https://api.open-meteo.com/v1/forecast?latitude=$lat&longitude=$lon&timezone=auto&forecast_days=$d" +
            "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation" +
            "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"))
        val cur = w.getJSONObject("current")
        val sb = StringBuilder("$name jetzt: ${cur.getDouble("temperature_2m").toInt()} Grad, gefühlt ${cur.getDouble("apparent_temperature").toInt()}, " +
            "${wmo(cur.getInt("weather_code"))}, Wind ${cur.getDouble("wind_speed_10m").toInt()} km/h.")
        val daily = w.getJSONObject("daily")
        val names = listOf("Heute", "Morgen", "Übermorgen")
        val dates = daily.getJSONArray("time")
        for (k in 0 until dates.length()) {
            val label = names.getOrNull(k) ?: SimpleDateFormat("EEEE", de).format(SimpleDateFormat("yyyy-MM-dd", de).parse(dates.getString(k))!!)
            sb.append(" $label: ${wmo(daily.getJSONArray("weather_code").getInt(k))}, ${daily.getJSONArray("temperature_2m_min").getDouble(k).toInt()} bis " +
                "${daily.getJSONArray("temperature_2m_max").getDouble(k).toInt()} Grad, Regenrisiko ${daily.getJSONArray("precipitation_probability_max").optInt(k)} %.")
        }
        return sb.toString()
    }

    private fun wmo(c: Int) = when (c) {
        0 -> "klar"; 1 -> "überwiegend klar"; 2 -> "teils bewölkt"; 3 -> "bedeckt"; 45, 48 -> "neblig"
        51, 53, 55 -> "Nieselregen"; 56, 57 -> "gefrierender Niesel"; 61 -> "leichter Regen"; 63 -> "Regen"; 65 -> "starker Regen"
        66, 67 -> "gefrierender Regen"; 71 -> "leichter Schneefall"; 73 -> "Schneefall"; 75 -> "starker Schneefall"; 77 -> "Schneegriesel"
        80 -> "leichte Schauer"; 81 -> "Schauer"; 82 -> "heftige Schauer"; 85, 86 -> "Schneeschauer"; 95 -> "Gewitter"; 96, 99 -> "Gewitter mit Hagel"
        else -> "wechselhaft"
    }
}
