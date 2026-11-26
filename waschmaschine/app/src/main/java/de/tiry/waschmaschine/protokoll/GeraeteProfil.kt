package de.tiry.waschmaschine.protokoll

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.w3c.dom.Element
import org.w3c.dom.Node
import java.io.ByteArrayInputStream
import java.util.zip.ZipInputStream
import javax.xml.parsers.DocumentBuilderFactory

@Serializable
data class Merkmal(
    val name: String,
    val werte: Map<Int, String>? = null,
    val zugriff: String? = null,
    val min: Long? = null,
    val max: Long? = null,
    val refCID: String? = null,
    val refDID: String? = null,
)

@Serializable
data class ProgrammInfo(val uid: Int, val optionen: List<Int> = emptyList())

/** Alles, was die App einmalig über die Maschine wissen muss. Liegt nur verschlüsselt auf dem Handy. */
@Serializable
data class GeraeteProfil(
    val haId: String,
    val marke: String,
    val typ: String,
    val vib: String = "",
    /** base64url: TLS-PSK-Schlüssel bzw. AES-Schlüssel. */
    val schluessel: String,
    /** base64url-IV – nur bei Geräten ohne TLS (Port 80). */
    val iv: String? = null,
    /** Zuletzt bekannte LAN-Adresse. */
    val adresse: String? = null,
    val merkmale: Map<Int, Merkmal> = emptyMap(),
    val programme: List<ProgrammInfo> = emptyList(),
) {
    val nutztTls get() = iv == null
    val port get() = if (nutztTls) 443 else 80

    fun uidVon(name: String): Int? = merkmale.entries.firstOrNull { it.value.name == name }?.key
        ?: merkmale.entries.firstOrNull { it.value.name.endsWith(".$name") }?.key

    fun alsJson(): String = json.encodeToString(serializer(), this)

    companion object {
        val json = Json { ignoreUnknownKeys = true; encodeDefaults = false }
        fun ausJson(s: String): GeraeteProfil = json.decodeFromString(serializer(), s)
    }
}

/** Liest FeatureMapping.xml und DeviceDescription.xml (Port von hcpy/HCxml2json.py). */
object GeraeteBeschreibung {
    data class Ergebnis(val merkmale: Map<Int, Merkmal>, val programme: List<ProgrammInfo>, val info: Map<String, String>)

    fun ausZip(zip: ByteArray, haId: String): Ergebnis {
        var mapping: ByteArray? = null
        var beschreibung: ByteArray? = null
        ZipInputStream(ByteArrayInputStream(zip)).use { z ->
            while (true) {
                val e = z.nextEntry ?: break
                when {
                    e.name.endsWith("_FeatureMapping.xml") -> mapping = z.readBytes()
                    e.name.endsWith("_DeviceDescription.xml") -> beschreibung = z.readBytes()
                }
            }
        }
        return lies(
            mapping ?: error("FeatureMapping fehlt im Paket für $haId"),
            beschreibung ?: error("DeviceDescription fehlt im Paket für $haId"),
        )
    }

    private fun dom(b: ByteArray): Element = DocumentBuilderFactory.newInstance().apply { isNamespaceAware = true }
        .newDocumentBuilder().parse(ByteArrayInputStream(b)).documentElement

    private fun Node.tag() = localName ?: nodeName.substringAfter(':')
    private fun Element.alle(tag: String): List<Element> {
        val l = getElementsByTagNameNS("*", tag)
        return (0 until l.length).map { l.item(it) as Element }
    }
    private fun hex(s: String) = s.trim().toInt(16)

    fun lies(mappingXml: ByteArray, beschreibungXml: ByteArray): Ergebnis {
        val fm = dom(mappingXml)
        val namen = HashMap<Int, String>()
        fm.alle("feature").forEach { namen[hex(it.getAttribute("refUID"))] = it.textContent.trim() }
        val enums = HashMap<Int, Map<Int, String>>()
        fm.alle("enumDescription").forEach { e ->
            val w = LinkedHashMap<Int, String>()
            e.alle("enumMember").forEach { m -> w[m.getAttribute("refValue").trim().toInt()] = m.textContent.trim() }
            enums[hex(e.getAttribute("refENID"))] = w
        }
        val attrs = HashMap<Int, MutableMap<String, String>>()
        val programme = ArrayList<ProgrammInfo>()
        val beschr = dom(beschreibungXml)
        fun lauf(el: Element) {
            if (el.hasAttribute("uid")) {
                val uid = hex(el.getAttribute("uid"))
                val m = attrs.getOrPut(uid) { HashMap() }
                for (i in 0 until el.attributes.length) { val a = el.attributes.item(i); m[a.nodeName] = a.nodeValue }
                if (el.tag() == "program") {
                    val opt = el.alle("option").mapNotNull { o -> o.getAttribute("refUID").takeIf { it.isNotBlank() }?.let(::hex) }
                    programme += ProgrammInfo(uid, opt)
                }
            }
            val k = el.childNodes
            for (i in 0 until k.length) (k.item(i) as? Element)?.let(::lauf)
        }
        lauf(beschr)
        val info = HashMap<String, String>()
        beschr.alle("description").firstOrNull()?.let { d ->
            val k = d.childNodes
            for (i in 0 until k.length) (k.item(i) as? Element)?.let { info[it.tag()] = it.textContent.trim() }
        }
        val merkmale = namen.mapValues { (uid, name) ->
            val a = attrs[uid].orEmpty()
            Merkmal(
                name = name,
                werte = a["enumerationType"]?.let { enums[hex(it)] },
                zugriff = a["access"],
                min = a["min"]?.toLongOrNull(), max = a["max"]?.toLongOrNull(),
                refCID = a["refCID"], refDID = a["refDID"],
            )
        }
        return Ergebnis(merkmale, programme.distinctBy { it.uid }, info)
    }
}
