package de.tiry.waschmaschine.protokoll

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.io.Closeable
import java.util.Base64

/** Ein Nachrichten-Kanal zur Maschine (Text-JSON rein/raus). */
interface Kanal : Closeable {
    fun sende(json: String)
    /** Blockiert; null = Verbindung zu. */
    fun empfange(): String?
    /** Lebenszeichen, damit tote Verbindungen auffallen. */
    fun ping() {}
}

/**
 * Das Home-Connect-Sitzungsprotokoll (Port von hcpy/HCDevice.py):
 * Gerät meldet /ei/initialValues → wir antworten, fragen Dienste ab, melden deviceReady,
 * holen alle Pflichtwerte; danach schickt das Gerät Änderungen als NOTIFY /ro/values.
 */
class HcSitzung(
    private val kanal: Kanal,
    private val geraeteName: String = "Waschmaschine-App",
    private val geraeteId: String = "7a5c0b1e",
    private val beiWerten: (Map<Int, JsonElement>) -> Unit,
    private val beiZugriff: (uid: Int, zugriff: String?, verfuegbar: Boolean?) -> Unit = { _, _, _ -> },
    private val beiFehlerCode: (resource: String, code: Int) -> Unit = { _, _ -> },
) {
    private var sid: Long? = null
    private var msgId: Long = 0
    private val dienste = HashMap<String, Int>()
    @Volatile var bereit = false
        private set

    private val json = Json { ignoreUnknownKeys = true }

    /** Liest bis zum Verbindungsende. Wirft bei Fehlern. */
    fun lauf() {
        while (true) {
            val text = kanal.empfange() ?: return
            verarbeite(text)
        }
    }

    internal fun verarbeite(text: String) {
        val msg = json.parseToJsonElement(text).jsonObject
        val resource = msg["resource"]?.jsonPrimitive?.content ?: return
        val aktion = msg["action"]?.jsonPrimitive?.content
        val version = msg["version"]?.jsonPrimitive?.intOrNull ?: 1
        msg["code"]?.jsonPrimitive?.intOrNull?.let { beiFehlerCode(resource, it); return }
        val daten = (msg["data"] as? JsonArray).orEmpty()
        when (aktion) {
            "POST" -> if (resource == "/ei/initialValues") {
                sid = msg["sID"]!!.jsonPrimitive.content.toLong()
                msgId = daten[0].jsonObject["edMsgID"]!!.jsonPrimitive.content.toLong()
                antworte(msg, buildJsonObject {
                    if (version == 1) put("deviceType", 2) else put("deviceType", "Application")
                    put("deviceName", geraeteName)
                    put("deviceID", geraeteId)
                })
                hole("/ci/services")
            }
            "RESPONSE", "NOTIFY" -> when (resource) {
                "/ci/services" -> {
                    daten.forEach { d -> dienste[d.jsonObject["service"]!!.jsonPrimitive.content] = d.jsonObject["version"]!!.jsonPrimitive.int }
                    danachVerbinden()
                }
                "/ro/allMandatoryValues", "/ro/values" -> {
                    val werte = LinkedHashMap<Int, JsonElement>()
                    daten.forEach { d -> val o = d.jsonObject; val u = o["uid"]?.jsonPrimitive?.intOrNull; val v = o["value"]; if (u != null && v != null) werte[u] = v }
                    if (resource == "/ro/allMandatoryValues") bereit = true
                    if (werte.isNotEmpty()) beiWerten(werte)
                }
                "/ro/descriptionChange", "/ro/allDescriptionChanges" -> {
                    val werte = LinkedHashMap<Int, JsonElement>()
                    daten.forEach { d ->
                        val o = d.jsonObject; val u = o["uid"]?.jsonPrimitive?.intOrNull ?: return@forEach
                        beiZugriff(u, o["access"]?.jsonPrimitive?.content, o["available"]?.jsonPrimitive?.content?.toBooleanStrictOrNull())
                        o["value"]?.let { werte[u] = it }
                    }
                    if (werte.isNotEmpty()) beiWerten(werte)
                }
                else -> Unit
            }
        }
    }

    private fun danachVerbinden() {
        if ("iz" in dienste) hole("/iz/info")
        else {
            val nonce = Base64.getUrlEncoder().withoutPadding().encodeToString(HcAesKanal.zufallsBytes(32))
            hole("/ci/authentication", version = 2, daten = buildJsonObject { put("nonce", nonce) })
            hole("/ci/info")
        }
        hole("/ei/deviceReady", version = 2, aktion = "NOTIFY")
        if ("ni" in dienste) hole("/ni/info")
        hole("/ro/allMandatoryValues")
        hole("/ro/allDescriptionChanges")
    }

    private fun antworte(msg: JsonObject, antwort: JsonObject) {
        kanal.sende(buildJsonObject {
            put("sID", msg["sID"]!!); put("msgID", msg["msgID"]!!)
            put("resource", msg["resource"]!!); put("version", msg["version"]!!)
            put("action", "RESPONSE"); put("data", buildJsonArray { add(antwort) })
        }.toString())
    }

    @Synchronized
    fun hole(resource: String, version: Int? = null, aktion: String = "GET", daten: JsonElement? = null) {
        val dienst = resource.split('/').getOrNull(1)
        val v = version ?: dienste[dienst] ?: 1
        val m = buildJsonObject {
            put("sID", sid ?: 0); put("msgID", msgId); put("resource", resource); put("version", v); put("action", aktion)
            if (daten != null) put("data", daten as? JsonArray ?: buildJsonArray { add(daten) })
        }
        msgId++
        kanal.sende(m.toString())
    }

    /** Einen Wert schreiben, z. B. Pause/Abbruch. uid muss zuerst stehen (Gerät verlangt das). */
    fun setzeWert(uid: Int, wert: JsonElement) =
        hole("/ro/values", aktion = "POST", daten = buildJsonObject { put("uid", uid); put("value", wert) })

    fun starteProgramm(programm: Int, optionen: Map<Int, JsonElement>) =
        hole("/ro/activeProgram", aktion = "POST", daten = buildJsonObject {
            put("program", programm)
            put("options", buildJsonArray { optionen.forEach { (u, w) -> add(buildJsonObject { put("uid", u); put("value", w) }) } })
        })

    fun waehleProgramm(programm: Int, optionen: Map<Int, JsonElement>) =
        hole("/ro/selectedProgram", aktion = "POST", daten = buildJsonObject {
            put("program", programm)
            put("options", buildJsonArray { optionen.forEach { (u, w) -> add(buildJsonObject { put("uid", u); put("value", w) }) } })
        })

    companion object { fun JsonPrimitive.alsLong() = content.toLongOrNull() }
}
