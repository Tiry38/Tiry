package de.tiry.waschmaschine.protokoll

import java.net.InetSocketAddress
import java.net.Socket
import javax.net.SocketFactory

/** Baut die verschlüsselte Verbindung zur Maschine auf – TLS-PSK (443) oder AES-HMAC (80). */
object Verbindung {
    fun oeffne(
        profil: GeraeteProfil,
        adresse: String,
        sockets: SocketFactory = SocketFactory.getDefault(),
        zeitlimitMs: Int = 4000,
        port: Int = profil.port,
    ): Kanal {
        val psk = HcAesKanal.b64(profil.schluessel)
        val s: Socket = sockets.createSocket()
        try {
            s.tcpNoDelay = true
            s.keepAlive = true
            s.connect(InetSocketAddress(adresse, port), zeitlimitMs)
            s.soTimeout = 15000
            return if (profil.nutztTls) {
                val tls = PskTls.verbinde(s, psk)
                val ws = WebSocket.verbinde(tls.ein, tls.aus, adresse)
                s.soTimeout = 75_000
                object : Kanal {
                    override fun sende(json: String) = ws.sendeText(json)
                    override fun ping() = ws.sendePing()
                    override fun empfange(): String? = when (val r = ws.lies()) {
                        is WebSocket.Rahmen.Text -> r.text
                        is WebSocket.Rahmen.Binaer -> String(r.daten, Charsets.UTF_8)
                        null -> null
                    }
                    override fun close() { ws.schliessen(); tls.schliessen(); runCatching { s.close() } }
                }
            } else {
                val aes = HcAesKanal(psk, HcAesKanal.b64(profil.iv!!))
                val ws = WebSocket.verbinde(s.getInputStream(), s.getOutputStream(), adresse)
                s.soTimeout = 75_000
                object : Kanal {
                    override fun sende(json: String) = ws.sendeBinaer(aes.verschluesseln(json))
                    override fun ping() = ws.sendePing()
                    override fun empfange(): String? {
                        while (true) {
                            return when (val r = ws.lies()) {
                                is WebSocket.Rahmen.Binaer -> aes.entschluesseln(r.daten) ?: throw java.io.IOException("Nachricht nicht entschlüsselbar – falscher Schlüssel?")
                                is WebSocket.Rahmen.Text -> continue
                                null -> null
                            }
                        }
                    }
                    override fun close() { ws.schliessen(); runCatching { s.close() } }
                }
            }
        } catch (t: Throwable) {
            runCatching { s.close() }
            throw t
        }
    }
}
