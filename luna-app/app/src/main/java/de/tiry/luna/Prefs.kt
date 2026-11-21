package de.tiry.luna

import android.content.Context
import android.content.SharedPreferences

/** Alle Einstellungen von Luna. Liegt im privaten App-Speicher (kein anderes Programm kommt dran). */
class Prefs(context: Context) {
    private val p: SharedPreferences = context.getSharedPreferences("luna", Context.MODE_PRIVATE)

    var userName: String
        get() = p.getString("user_name", "Tiry")!!.ifBlank { "Tiry" }
        set(v) = p.edit().putString("user_name", v.trim()).apply()

    /** So spricht Luna den Namen aus (Schrift bleibt „Tiry“). */
    var spokenName: String
        get() = p.getString("spoken_name", "")!!.ifBlank { if (userName.equals("Tiry", true)) "Tiri" else userName }
        set(v) = p.edit().putString("spoken_name", v.trim()).apply()

    var claudeKey: String
        get() = Vault.read(p, "claude_key")
        set(v) = Vault.write(p, "claude_key", v)

    var model: String
        get() = p.getString("model", MODEL_HAIKU)!!
        set(v) = p.edit().putString("model", v).apply()

    var elevenKey: String
        get() = Vault.read(p, "eleven_key")
        set(v) = Vault.write(p, "eleven_key", v)

    var elevenVoice: String
        get() = p.getString("eleven_voice", DEFAULT_VOICE)!!.ifBlank { DEFAULT_VOICE }
        set(v) = p.edit().putString("eleven_voice", v.trim()).apply()

    var elevenModel: String
        // neuer Schlüssel: alle starten auf Eleven v4 (alte, evtl. still auf v2 zurückgefallene Werte zählen nicht mehr)
        get() = p.getString("eleven_model2", "eleven_v4")!!
        set(v) = p.edit().putString("eleven_model2", v).apply()

    /** Vom Stimm-Motor gelernte Einstellungen, die das Konto akzeptiert (siehe Speaker.fetchEleven). */
    var elevenTune: Int
        get() = p.getInt("eleven_tune", 0)
        set(v) = p.edit().putInt("eleven_tune", v).apply()

    /** Stimme kann Emotions-Tags ([laughs], [sighs] …) sprechen? Nur ElevenLabs v3. */
    /** Gefühls-Tags nur, wenn die Hauptstimme sie kann (Google Chirp kann es nicht → dann nur Pausen „…“). */
    val voiceTags get() = !cloudVoice && ((homeVoice && voiceServerTags.isNotBlank()) ||
        (elevenKey.isNotBlank() && (elevenModel == "eleven_v3" || elevenModel == "eleven_v4")))

    var aboutMe: String
        get() = p.getString("about_me", DEFAULT_ABOUT)!!
        set(v) = p.edit().putString("about_me", v.trim()).apply()

    /** 1 (streng, wenig Fehlalarme) … 10 (reagiert schon auf Andeutungen). */
    var sensitivity: Int
        get() = p.getInt("sensitivity", 6)
        set(v) = p.edit().putInt("sensitivity", v.coerceIn(1, 10)).apply()

    var requireHey: Boolean
        get() = p.getBoolean("require_hey", false)
        set(v) = p.edit().putBoolean("require_hey", v).apply()

    var wakeWanted: Boolean
        get() = p.getBoolean("wake_wanted", true)
        set(v) = p.edit().putBoolean("wake_wanted", v).apply()

    var stayAwake: Boolean
        get() = p.getBoolean("stay_awake", true)
        set(v) = p.edit().putBoolean("stay_awake", v).apply()

    /** Bei „Hey Luna“ Bildschirm einschalten und Luna zeigen (auch über dem Sperrbildschirm). */
    var wakeScreen: Boolean
        get() = p.getBoolean("wake_screen", true)
        set(v) = p.edit().putBoolean("wake_screen", v).apply()

    /** Gewählte Handy-Stimme (Name der Android-Stimme); leer = automatisch weiblich. */
    var ttsVoice: String
        get() = p.getString("tts_voice", "")!!
        set(v) = p.edit().putString("tts_voice", v).apply()

    /** Luna darf beim Sprechen unterbrochen werden. */
    var bargeIn: Boolean
        get() = p.getBoolean("barge_in", true)
        set(v) = p.edit().putBoolean("barge_in", v).apply()

    var followUp: Boolean
        get() = p.getBoolean("follow_up", true)
        set(v) = p.edit().putBoolean("follow_up", v).apply()

    var homeCity: String
        get() = p.getString("home_city", "Wörth am Rhein")!!.ifBlank { "Wörth am Rhein" }
        set(v) = p.edit().putString("home_city", v.trim()).apply()

    var lastBriefingDay: String
        get() = p.getString("last_briefing_day", "")!!
        set(v) = p.edit().putString("last_briefing_day", v).apply()

    // ---------- Heimnetz: FRITZ!Box, PC, VPN ----------
    private fun str(k: String, d: String = "") = p.getString(k, d)!!
    private fun put(k: String, v: String) = p.edit().putString(k, v.trim()).apply()

    /** Adresse der FRITZ!Box: zu Hause „fritz.box“ (über VPN auch unterwegs). */
    var fritzHost: String get() = str("fritz_host", "fritz.box").ifBlank { "fritz.box" }; set(v) = put("fritz_host", v)
    var fritzUser: String get() = str("fritz_user"); set(v) = put("fritz_user", v)
    var fritzPass: String get() = Vault.read(p, "fritz_pass"); set(v) = Vault.write(p, "fritz_pass", v)
    /** PC: Name, wie er in der FRITZ!Box heißt, und/oder MAC-Adresse. */
    var pcName: String get() = str("pc_name"); set(v) = put("pc_name", v)
    var pcMac: String get() = str("pc_mac"); set(v) = put("pc_mac", v)
    /** Fernsteuerungs-App (Paketname), z. B. RustDesk, Chrome Remote Desktop, Windows App. Leer = automatisch suchen. */
    var remoteApp: String get() = str("remote_app"); set(v) = put("remote_app", v)
    // ---------- Mobile Stimme: Google Cloud Chirp 3 HD ----------
    var googleKey: String get() = Vault.read(p, "google_tts_key"); set(v) = Vault.write(p, "google_tts_key", v)
    var googleVoice: String get() = str("google_voice", "Aoede").ifBlank { "Aoede" }; set(v) = put("google_voice", v)
    val cloudVoice get() = googleKey.isNotBlank()

    // ---------- Heim-Stimme: Stimm-Server auf Tirys PC (Kartoffel-Orpheus) ----------
    /** Adresse des Stimm-Servers, z. B. „tiry-pc.fritz.box“ (leer = aus). */
    var voiceHost: String get() = str("voice_host"); set(v) = put("voice_host", v)
    var voiceToken: String get() = Vault.read(p, "voice_token"); set(v) = Vault.write(p, "voice_token", v)
    var voiceName: String get() = str("voice_name"); set(v) = put("voice_name", v)
    /** Vom Server gemeldete Gefühls-Tags (kommagetrennt, z. B. „laugh,sigh“). */
    var voiceServerTags: String get() = str("voice_tags"); set(v) = put("voice_tags", v)
    val homeVoice get() = voiceHost.isNotBlank() && voiceToken.isNotBlank()

    /** Name des WireGuard-Tunnels zur FRITZ!Box (für unterwegs). */
    var vpnTunnel: String get() = str("vpn_tunnel"); set(v) = put("vpn_tunnel", v)

    /** Dinge, die Luna sich merken soll („Merk dir …“). */
    var memories: List<String>
        get() = p.getString("memories", "")!!.split('\n').filter { it.isNotBlank() }
        set(v) = p.edit().putString("memories", v.takeLast(60).joinToString("\n")).apply()

    fun addMemory(fact: String) { memories = memories + fact.replace('\n', ' ').trim() }

    companion object {
        const val MODEL_OPUS = "claude-opus-5-5"
        const val MODEL_SONNET = "claude-sonnet-5-5"
        const val MODEL_HAIKU = "claude-haiku-5-5"
        /** „Sarah“ – vorgefertigte ElevenLabs-Stimme, spricht mit multilingual_v2 natürliches Deutsch. */
        const val DEFAULT_VOICE = "EXAVITQu4vr4xnSDxMaL"
        const val DEFAULT_ABOUT = "Ich heiße Tiry, wohne in Wörth am Rhein und arbeite als Junior Manager und Mechaniker " +
            "im Fahrradgeschäft Velocenter Hessert, das ich in ein paar Jahren übernehmen will. " +
            "Ich trainiere jeden zweiten Tag mit Hanteln, will Muskeln ohne Fett aufbauen (mindestens 160 g Eiweiß am Tag). " +
            "Hobbys: E-Bike (KTM Macina Race), Angeln, Gaming (WoW, Elden Ring, GTA, Rocket League). Zwei Katzen: Cleo und Charly."
    }
}
