package de.tiry.luna

import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/** Simulierte FRITZ!Box: Beschreibungsdatei, Digest-Anmeldung, Hosts-Liste, Wake-on-LAN, Gast-WLAN. */
class FritzBoxTest {
    private lateinit var server: MockWebServer
    val calls = mutableListOf<String>()

    private val desc = """<?xml version="1.0"?><root xmlns="urn:dslforum-org:device-1-0"><device><serviceList>
        <service><serviceType>urn:dslforum-org:service:DeviceInfo:1</serviceType><controlURL>/upnp/control/deviceinfo</controlURL></service>
        </serviceList><deviceList><device><serviceList>
        <service><serviceType>urn:dslforum-org:service:Hosts:1</serviceType><controlURL>/upnp/control/hosts</controlURL></service>
        <service><serviceType>urn:dslforum-org:service:WLANConfiguration:3</serviceType><controlURL>/upnp/control/wlanconfig3</controlURL></service>
        </serviceList></device></deviceList></device></root>"""

    private fun soap(action: String, body: String) = MockResponse().setHeader("Content-Type", "text/xml").setBody(
        """<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>
           <u:${action}Response xmlns:u="urn:x">$body</u:${action}Response></s:Body></s:Envelope>""")

    @Before fun up() {
        server = MockWebServer()
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(r: RecordedRequest): MockResponse {
                if (r.path == "/tr64desc.xml") return MockResponse().setBody(desc)
                val auth = r.getHeader("Authorization")
                if (auth == null) return MockResponse().setResponseCode(401)
                    .setHeader("WWW-Authenticate", "Digest realm=\"HTTPS Access\", nonce=\"ABC123\", algorithm=MD5, qop=\"auth\"")
                // Digest prüfen wie die echte Box
                fun p(k: String) = Regex("$k=\"?([^\",]*)\"?").find(auth)!!.groupValues[1]
                val ha1 = FritzBox.md5("tiry:HTTPS Access:geheim"); val ha2 = FritzBox.md5("POST:${r.path}")
                val ok = p("response") == FritzBox.md5("$ha1:ABC123:${p("nc")}:${p("cnonce")}:auth:$ha2")
                if (!ok) return MockResponse().setResponseCode(401)
                val action = r.getHeader("SOAPACTION")!!.trim('"').substringAfter('#')
                val body = r.body.readUtf8()
                calls += action + " " + Regex("<(New\\w+)>([^<]*)<").findAll(body).joinToString(",") { it.groupValues[1] + "=" + it.groupValues[2] }
                return when (action) {
                    "GetHostNumberOfEntries" -> soap(action, "<NewHostNumberOfEntries>2</NewHostNumberOfEntries>")
                    "GetGenericHostEntry" -> if (body.contains("<NewIndex>0<"))
                        soap(action, "<NewIPAddress>192.168.178.20</NewIPAddress><NewMACAddress>AA:BB:CC:DD:EE:FF</NewMACAddress><NewHostName>Tiry-PC</NewHostName><NewActive>0</NewActive>")
                        else soap(action, "<NewIPAddress>192.168.178.30</NewIPAddress><NewMACAddress>11:22:33:44:55:66</NewMACAddress><NewHostName>Handy</NewHostName><NewActive>1</NewActive>")
                    "X_AVM-DE_WakeOnLANByMACAddress" -> soap(action, "")
                    "SetEnable" -> soap(action, "")
                    "GetInfo" -> soap(action, "<NewEnable>1</NewEnable><NewSSID>Tiry-Gast</NewSSID>")
                    else -> MockResponse().setResponseCode(500).setBody("<errorDescription>Invalid Action</errorDescription>")
                }
            }
        }
        server.start()
    }

    @After fun down() { server.shutdown() }

    private fun box(pass: String = "geheim") = FritzBox(server.hostName, "tiry", pass, server.port)

    @Test fun geraeteUndWecken() {
        val b = box()
        val pc = b.findHost("tiry pc")!!
        assertEquals("AA:BB:CC:DD:EE:FF", pc.mac)
        assertEquals(false, pc.active)
        b.wake(pc.mac)
        assertTrue(calls.contains("X_AVM-DE_WakeOnLANByMACAddress NewMACAddress=AA:BB:CC:DD:EE:FF"))
    }

    @Test fun gastWlan() {
        assertEquals("Gast-WLAN „Tiry-Gast“ ist an.", box().guestWifi(true))
        assertTrue(calls.contains("SetEnable NewEnable=1"))
    }

    @Test(expected = SecurityException::class) fun falschesPasswort() { box("falsch").hosts() }

    @Test fun magicPacketFormat() {
        // darf ohne Netzwerkfehler einen gültigen Aufbau erzeugen; ungültige MAC wird abgelehnt
        try { FritzBox.magicPacket("zz"); throw AssertionError() } catch (_: Exception) {}
    }
}
