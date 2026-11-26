package de.tiry.waschmaschine.protokoll

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.bouncycastle.tls.CipherSuite
import org.bouncycastle.tls.PSKTlsServer
import org.bouncycastle.tls.ProtocolVersion
import org.bouncycastle.tls.TlsPSKIdentityManager
import org.bouncycastle.tls.TlsServerProtocol
import org.bouncycastle.tls.crypto.impl.bc.BcTlsCrypto
import java.net.ServerSocket
import java.security.SecureRandom
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

/**
 * Simulierte Home-Connect-Waschmaschine auf localhost – spricht dasselbe Protokoll wie das echte Gerät
 * (TLS-PSK oder AES-HMAC, WebSocket, /ei/initialValues …). Nur für Tests.
 */
class SimulierteMaschine(private val profil: GeraeteProfil, private val werte: MutableMap<Int, Any>) : AutoCloseable {
    private val server = ServerSocket(0)
    val port get() = server.localPort
    val empfangen = CopyOnWriteArrayList<JsonObject>()
    private val ausgang = LinkedBlockingQueue<String>()
    @Volatile private var sender: ((String) -> Unit)? = null
    @Volatile var falscherSchluessel = false

    init {
        thread(isDaemon = true) {
            while (!server.isClosed) {
                val s = runCatching { server.accept() }.getOrNull() ?: break
                thread(isDaemon = true) { runCatching { bediene(s) } }
            }
        }
    }

    private fun bediene(s: java.net.Socket) {
        val psk = HcAesKanal.b64(profil.schluessel).let { if (falscherSchluessel) it.reversedArray() else it }
        val (ein, aus) = if (profil.nutztTls) {
            val crypto = BcTlsCrypto(SecureRandom())
            val mgr = object : TlsPSKIdentityManager {
                override fun getHint(): ByteArray = PskTls.IDENTITAET.toByteArray()
                override fun getPSK(identity: ByteArray): ByteArray? = if (String(identity) == PskTls.IDENTITAET) psk else null
            }
            val srv = object : PSKTlsServer(crypto, mgr) {
                override fun getSupportedVersions(): Array<ProtocolVersion> = ProtocolVersion.TLSv12.only()
                override fun getSupportedCipherSuites() = intArrayOf(CipherSuite.TLS_ECDHE_PSK_WITH_CHACHA20_POLY1305_SHA256)
            }
            val p = TlsServerProtocol(s.getInputStream(), s.getOutputStream()); p.accept(srv)
            p.inputStream to p.outputStream
        } else s.getInputStream() to s.getOutputStream()
        val ws = WebSocket.annehmen(ein, aus)
        val aes = if (profil.nutztTls) null else HcAesKanal(psk, HcAesKanal.b64(profil.iv!!), alsGeraet = true)
        val senden: (String) -> Unit = { t -> if (aes == null) ws.sendeText(t) else ws.sendeBinaer(aes.verschluesseln(t)) }
        sender = senden
        senden("""{"sID":4711,"msgID":900,"resource":"/ei/initialValues","version":2,"action":"POST","data":[{"edMsgID":1200}]}""")
        while (true) {
            val r = ws.lies() ?: break
            val text = when (r) {
                is WebSocket.Rahmen.Text -> r.text
                is WebSocket.Rahmen.Binaer -> aes!!.entschluesseln(r.daten) ?: break
            }
            val m = Json.parseToJsonElement(text).jsonObject
            empfangen += m
            val res = m["resource"]!!.jsonPrimitive.content
            val id = m["msgID"]!!.jsonPrimitive.content
            when (res) {
                "/ci/services" -> senden("""{"sID":4711,"msgID":$id,"resource":"/ci/services","version":1,"action":"RESPONSE","data":[{"service":"ci","version":3},{"service":"ei","version":2},{"service":"iz","version":1},{"service":"ro","version":1},{"service":"ni","version":1}]}""")
                "/ro/allMandatoryValues" -> senden("""{"sID":4711,"msgID":$id,"resource":"/ro/allMandatoryValues","version":1,"action":"RESPONSE","data":[${werteJson()}]}""")
                "/ro/values" -> if (m["action"]!!.jsonPrimitive.content == "POST") senden("""{"sID":4711,"msgID":$id,"resource":"/ro/values","version":1,"action":"RESPONSE"}""")
                "/ro/activeProgram" -> senden("""{"sID":4711,"msgID":$id,"resource":"/ro/activeProgram","version":1,"action":"RESPONSE"}""")
            }
        }
    }

    private fun werteJson() = synchronized(werte) { werte.entries.joinToString(",") { (u, v) -> """{"uid":$u,"value":${if (v is String) "\"$v\"" else v}}""" } }

    /** Ändert Werte und schickt sie wie das Gerät als NOTIFY. */
    fun aendere(vararg w: Pair<Int, Any>) {
        synchronized(werte) { w.forEach { werte[it.first] = it.second } }
        val d = w.joinToString(",") { (u, v) -> """{"uid":$u,"value":${if (v is String) "\"$v\"" else v}}""" }
        (sender ?: error("nicht verbunden"))("""{"sID":4711,"msgID":1,"resource":"/ro/values","version":1,"action":"NOTIFY","data":[$d]}""")
    }

    fun warteAufAnfrage(resource: String, ms: Long = 5000): JsonObject {
        val ende = System.currentTimeMillis() + ms
        while (System.currentTimeMillis() < ende) {
            empfangen.firstOrNull { it["resource"]?.jsonPrimitive?.content == resource }?.let { return it }
            Thread.sleep(20)
        }
        error("Keine Anfrage $resource erhalten – bekam: ${empfangen.map { it["resource"] }}")
    }

    override fun close() { server.close() }

}
