package de.tiry.luna

import android.content.Context
import android.content.SharedPreferences

/** Alle Einstellungen von Luna. Liegt im privaten App-Speicher (kein anderes Programm kommt dran). */
class Prefs(context: Context) {
    private val p: SharedPreferences = context.getSharedPreferences("luna", Context.MODE_PRIVATE)

    var userName: String
        get() = p.getString("user_name", "Tiry")!!.ifBlank { "Tiry" }
        set(v) = p.edit().putString("user_name", v.trim()).apply()

    var claudeKey: String
        get() = p.getString("claude_key", "")!!
        set(v) = p.edit().putString("claude_key", v.trim()).apply()

    var model: String
        get() = p.getString("model", MODEL_OPUS)!!
        set(v) = p.edit().putString("model", v).apply()

    var elevenKey: String
        get() = p.getString("eleven_key", "")!!
        set(v) = p.edit().putString("eleven_key", v.trim()).apply()

    var elevenVoice: String
        get() = p.getString("eleven_voice", DEFAULT_VOICE)!!.ifBlank { DEFAULT_VOICE }
        set(v) = p.edit().putString("eleven_voice", v.trim()).apply()

    var elevenModel: String
        get() = p.getString("eleven_model", "eleven_multilingual_v2")!!
        set(v) = p.edit().putString("eleven_model", v).apply()

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

    var followUp: Boolean
        get() = p.getBoolean("follow_up", true)
        set(v) = p.edit().putBoolean("follow_up", v).apply()

    var homeCity: String
        get() = p.getString("home_city", "Wörth am Rhein")!!.ifBlank { "Wörth am Rhein" }
        set(v) = p.edit().putString("home_city", v.trim()).apply()

    var lastBriefingDay: String
        get() = p.getString("last_briefing_day", "")!!
        set(v) = p.edit().putString("last_briefing_day", v).apply()

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
