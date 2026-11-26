package de.tiry.waschmaschine.speicher

import android.content.Context
import de.tiry.waschmaschine.logik.Laufbuch
import de.tiry.waschmaschine.logik.PopupEinstellungen
import de.tiry.waschmaschine.protokoll.GeraeteProfil
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json

@Serializable
data class VerlaufEintrag(val programm: String, val startMs: Long?, val endeMs: Long, val temperatur: String? = null, val schleudern: String? = null)

@Serializable
data class Favorit(val name: String, val programmUid: Int, val optionen: Map<Int, Long> = emptyMap())

@Serializable
data class TunnelDaten(val konfig: String, val heimnetze: List<String>, val endpunkt: String)

/** Alles Gespeicherte an einem Ort. Geheimes → Tresor, Harmloses → SharedPreferences. */
class Ablage(ctx: Context) {
    private val tresor = Tresor(ctx)
    private val prefs = ctx.getSharedPreferences("waschmaschine", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    var profil: GeraeteProfil?
        get() = tresor.lies("geraet")?.let { runCatching { GeraeteProfil.ausJson(it) }.getOrNull() }
        set(v) { if (v == null) tresor.loesche("geraet") else tresor.schreibe("geraet", v.alsJson()) }

    var tunnel: TunnelDaten?
        get() = tresor.lies("tunnel")?.let { runCatching { json.decodeFromString(TunnelDaten.serializer(), it) }.getOrNull() }
        set(v) { if (v == null) tresor.loesche("tunnel") else tresor.schreibe("tunnel", json.encodeToString(TunnelDaten.serializer(), v)) }

    var popups: PopupEinstellungen
        get() = prefs.getString("popups", null)?.let { runCatching { json.decodeFromString(PopupEinstellungen.serializer(), it) }.getOrNull() } ?: PopupEinstellungen()
        set(v) = prefs.edit().putString("popups", json.encodeToString(PopupEinstellungen.serializer(), v)).apply()

    var laufbuch: Laufbuch
        get() = prefs.getString("laufbuch", null)?.let { runCatching { json.decodeFromString(Laufbuch.serializer(), it) }.getOrNull() } ?: Laufbuch()
        set(v) = prefs.edit().putString("laufbuch", json.encodeToString(Laufbuch.serializer(), v)).apply()

    var verlauf: List<VerlaufEintrag>
        get() = prefs.getString("verlauf", null)?.let { runCatching { json.decodeFromString(ListSerializer(VerlaufEintrag.serializer()), it) }.getOrNull() } ?: emptyList()
        set(v) = prefs.edit().putString("verlauf", json.encodeToString(ListSerializer(VerlaufEintrag.serializer()), v.take(200))).apply()

    var favoriten: List<Favorit>
        get() = prefs.getString("favoriten", null)?.let { runCatching { json.decodeFromString(ListSerializer(Favorit.serializer()), it) }.getOrNull() } ?: emptyList()
        set(v) = prefs.edit().putString("favoriten", json.encodeToString(ListSerializer(Favorit.serializer()), v)).apply()

    var fernstartBestaetigt: Boolean
        get() = prefs.getBoolean("fernstartBestaetigt", false)
        set(v) = prefs.edit().putBoolean("fernstartBestaetigt", v).apply()

    var unterwegsUebersprungen: Boolean
        get() = prefs.getBoolean("unterwegsUebersprungen", false)
        set(v) = prefs.edit().putBoolean("unterwegsUebersprungen", v).apply()
}
