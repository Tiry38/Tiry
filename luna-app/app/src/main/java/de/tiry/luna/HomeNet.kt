package de.tiry.luna

import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Socket
import java.net.URL
import java.security.MessageDigest
import javax.xml.parsers.DocumentBuilderFactory
import org.w3c.dom.Element

/**
 * FRITZ!Box über die offizielle TR-064-Schnittstelle (wie die FRITZ!App von AVM).
 * Voraussetzung in der FRITZ!Box: Heimnetz → Netzwerk → Netzwerkeinstellungen → „Zugriff für Anwendungen zulassen“,
 * und ein FRITZ!Box-Benutzer mit Passwort (System → FRITZ!Box-Benutzer).
 * Unterwegs: per WireGuard-VPN der FRITZ!Box verbinden, dann funktioniert alles wie zu Hause.
 *
 * Reines Java/Kotlin (kein Android) → per JUnit gegen einen simulierten Router testbar.
 */
class FritzBox(private val host: String, private val user: String, private val pass: String, private val port: Int = 49000) {

    data class Service(val type: String, val controlUrl: String)
    data class Host(val name: String, val ip: String, val mac: String, val active: Boolean)

    private var services: Map<String, Service>? = null
    private val base get() = "http://$host:$port"

    /** Liest /tr64desc.xml und merkt sich, welcher Dienst unter welcher Adresse erreichbar ist. */
    private fun services(): Map<String, Service> {
        services?.let { return it }
        val xml = http("GET", "$base/tr64desc.xml", null, null).second
        val doc = parse(xml)
        val list = doc.getElementsByTagName("service")
        val map = HashMap<String, Service>()
        for (i in 0 until list.length) {
            val e = list.item(i) as Element
            val type = text(e, "serviceType") ?: continue
            val ctrl = text(e, "controlURL") ?: continue
            map[type] = Service(type, ctrl)
        }
        services = map
        return map
    }

    /** Führt eine TR-064-Aktion aus und liefert die Ausgabe-Argumente. */
    fun call(serviceType: String, action: String, args: Map<String, String> = emptyMap()): Map<String, String> {
        val all = services()
        // exakter Typ, sonst tolerant über den Kurznamen (z. B. „Hosts:1“)
        val short = serviceType.substringAfter("service:")
        val svc = all[serviceType] ?: all.entries.firstOrNull { it.key.endsWith(":$short") }?.value
            ?: throw IllegalStateException("Die FRITZ!Box kennt den Dienst $short nicht.")
        val type = svc.type
        val body = buildString {
            append("<?xml version=\"1.0\" encoding=\"utf-8\"?>")
            append("<s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\" s:encodingStyle=\"http://schemas.xmlsoap.org/soap/encoding/\"><s:Body>")
            append("<u:$action xmlns:u=\"$type\">")
            args.forEach { (k, v) -> append("<$k>").append(esc(v)).append("</$k>") }
            append("</u:$action></s:Body></s:Envelope>")
        }
        val (code, resp) = http("POST", base + svc.controlUrl, body, "\"$type#$action\"")
        if (code == 401) throw SecurityException("FRITZ!Box-Anmeldung abgelehnt – Benutzer/Passwort in Lunas Einstellungen prüfen.")
        if (code !in 200..299) {
            val err = Regex("<errorDescription>(.*?)</errorDescription>").find(resp)?.groupValues?.get(1) ?: "HTTP $code"
            throw IllegalStateException("FRITZ!Box: $action fehlgeschlagen ($err)")
        }
        val doc = parse(resp)
        val out = HashMap<String, String>()
        val respNode = doc.getElementsByTagNameNS("*", "${action}Response").item(0) ?: return out
        val kids = respNode.childNodes
        for (i in 0 until kids.length) {
            val n = kids.item(i)
            if (n is Element) out[n.localName ?: n.nodeName] = n.textContent ?: ""
        }
        return out
    }

    // ---------- Komfort-Funktionen ----------
    fun info(): String {
        val d = call(DEVICE_INFO, "GetInfo")
        val up = (d["NewUpTime"]?.toLongOrNull() ?: 0) / 3600
        val ip = try { call(WAN_IP, "GetExternalIPAddress")["NewExternalIPAddress"] } catch (_: Exception) { null }
        return "${d["NewModelName"] ?: "FRITZ!Box"}, FRITZ!OS ${d["NewSoftwareVersion"] ?: "?"}, läuft seit $up Stunden" +
            (if (!ip.isNullOrBlank()) ", Internet-Adresse $ip" else "") + "."
    }

    fun hosts(): List<Host> {
        val n = call(HOSTS, "GetHostNumberOfEntries")["NewHostNumberOfEntries"]?.toIntOrNull() ?: 0
        return (0 until n.coerceAtMost(250)).mapNotNull { i ->
            try {
                val h = call(HOSTS, "GetGenericHostEntry", mapOf("NewIndex" to i.toString()))
                Host(h["NewHostName"] ?: "", h["NewIPAddress"] ?: "", h["NewMACAddress"] ?: "", h["NewActive"] == "1")
            } catch (_: Exception) { null }
        }
    }

    fun findHost(nameOrMac: String): Host? {
        fun n(x: String) = x.lowercase().replace(Regex("[^a-z0-9äöüß]"), "")
        val q = n(nameOrMac)
        val all = hosts()
        return all.firstOrNull { it.mac.equals(nameOrMac, true) }
            ?: all.firstOrNull { n(it.name) == q }
            ?: all.firstOrNull { q.isNotEmpty() && n(it.name).contains(q) }
    }

    fun wake(mac: String) { call(HOSTS, "X_AVM-DE_WakeOnLANByMACAddress", mapOf("NewMACAddress" to mac)) }

    fun guestWifi(on: Boolean?): String {
        if (on != null) call(WLAN_GUEST, "SetEnable", mapOf("NewEnable" to if (on) "1" else "0"))
        val i = call(WLAN_GUEST, "GetInfo")
        return "Gast-WLAN „${i["NewSSID"] ?: "?"}“ ist " + (if (i["NewEnable"] == "1") "an." else "aus.")
    }

    fun reconnect() { call(WAN_IP, "ForceTermination") }

    fun callList(max: Int): String {
        val url = call(ON_TEL, "GetCallList")["NewCallListURL"] ?: return "Keine Anrufliste verfügbar."
        val xml = http("GET", url + (if (url.contains("?")) "&" else "?") + "max=$max", null, null).second
        val calls = parse(xml).getElementsByTagName("Call")
        if (calls.length == 0) return "Keine Anrufe."
        return (0 until calls.length).joinToString("; ") { i ->
            val c = calls.item(i) as Element
            val type = when (text(c, "Type")) { "1" -> "angenommen"; "2" -> "verpasst"; "3" -> "ausgehend"; "10" -> "abgelehnt"; else -> "Anruf" }
            val who = text(c, "Name")?.takeIf { it.isNotBlank() } ?: text(c, "Caller")?.takeIf { it.isNotBlank() } ?: text(c, "Called") ?: "unbekannt"
            "$type: $who am ${text(c, "Date") ?: "?"}"
        }
    }

    // ---------- HTTP mit Digest-Anmeldung ----------
    private fun http(method: String, url: String, body: String?, soapAction: String?): Pair<Int, String> {
        fun send(auth: String?): Pair<HttpURLConnection, Int> {
            val c = URL(url).openConnection() as HttpURLConnection
            c.requestMethod = method; c.connectTimeout = 6000; c.readTimeout = 15000
            if (soapAction != null) c.setRequestProperty("SOAPACTION", soapAction)
            if (body != null) c.setRequestProperty("Content-Type", "text/xml; charset=\"utf-8\"")
            if (auth != null) c.setRequestProperty("Authorization", auth)
            if (body != null) { c.doOutput = true; c.outputStream.use { it.write(body.toByteArray()) } }
            return c to c.responseCode
        }
        var (c, code) = send(null)
        if (code == 401 && (user.isNotEmpty() || pass.isNotEmpty())) {
            val chal = c.getHeaderField("WWW-Authenticate") ?: ""
            c.disconnect()
            val r = send(digest(chal, method, URL(url).let { it.path + (it.query?.let { q -> "?$q" } ?: "") }))
            c = r.first; code = r.second
        }
        val stream = if (code in 200..299) c.inputStream else c.errorStream
        val text = stream?.bufferedReader()?.use { it.readText() } ?: ""
        c.disconnect()
        return code to text
    }

    private fun digest(challenge: String, method: String, uri: String): String {
        fun p(k: String) = Regex("$k=\"?([^\",]*)\"?").find(challenge)?.groupValues?.get(1) ?: ""
        val realm = p("realm"); val nonce = p("nonce"); val qop = p("qop").split(',').firstOrNull { it.trim() == "auth" }?.trim()
        val cnonce = java.util.UUID.randomUUID().toString().replace("-", "").take(16); val nc = "00000001"
        val ha1 = md5("$user:$realm:$pass"); val ha2 = md5("$method:$uri")
        val response = if (qop != null) md5("$ha1:$nonce:$nc:$cnonce:$qop:$ha2") else md5("$ha1:$nonce:$ha2")
        return buildString {
            append("Digest username=\"$user\", realm=\"$realm\", nonce=\"$nonce\", uri=\"$uri\", response=\"$response\"")
            if (qop != null) append(", qop=$qop, nc=$nc, cnonce=\"$cnonce\"")
            p("opaque").takeIf { it.isNotEmpty() }?.let { append(", opaque=\"$it\"") }
            append(", algorithm=MD5")
        }
    }

    companion object {
        const val DEVICE_INFO = "urn:dslforum-org:service:DeviceInfo:1"
        const val HOSTS = "urn:dslforum-org:service:Hosts:1"
        const val WAN_IP = "urn:dslforum-org:service:WANIPConnection:1"
        const val WLAN_GUEST = "urn:dslforum-org:service:WLANConfiguration:3"
        const val ON_TEL = "urn:dslforum-org:service:X_AVM-DE_OnTel:1"

        fun md5(s: String) = MessageDigest.getInstance("MD5").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }
        private fun esc(s: String) = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        private fun parse(xml: String) = DocumentBuilderFactory.newInstance().apply { isNamespaceAware = true }
            .newDocumentBuilder().parse(xml.byteInputStream())
        private fun text(e: Element, tag: String): String? = e.getElementsByTagName(tag).item(0)?.textContent?.trim()

        /** Wake-on-LAN „Magic Packet“ direkt im WLAN (Fallback, wenn keine FRITZ!Box-Anmeldung eingerichtet ist). */
        fun magicPacket(mac: String, broadcast: String = "255.255.255.255") {
            val m = mac.split(':', '-').map { it.toInt(16).toByte() }
            require(m.size == 6) { "MAC-Adresse ungültig" }
            val data = ByteArray(6) { 0xFF.toByte() } + (0 until 16).flatMap { m }.toByteArray()
            DatagramSocket().use { s ->
                s.broadcast = true
                for (port in listOf(9, 7)) s.send(DatagramPacket(data, data.size, InetAddress.getByName(broadcast), port))
            }
        }

        /** Prüft, ob ein Rechner antwortet (RDP, SMB, RustDesk, SSH). */
        fun reachable(ip: String): Boolean = listOf(3389, 445, 21118, 22, 135).any { port ->
            try { Socket().use { it.connect(InetSocketAddress(ip, port), 700); true } } catch (_: Exception) { false }
        }
    }
}
