package de.tiry.waschmaschine.protokoll

import org.bouncycastle.tls.BasicTlsPSKIdentity
import org.bouncycastle.tls.CipherSuite
import org.bouncycastle.tls.PSKTlsClient
import org.bouncycastle.tls.ProtocolVersion
import org.bouncycastle.tls.TlsClientProtocol
import org.bouncycastle.tls.crypto.impl.bc.BcTlsCrypto
import java.io.InputStream
import java.io.OutputStream
import java.net.Socket
import java.security.SecureRandom

/**
 * TLS 1.2 mit vorab geteiltem Schlüssel (PSK), wie ihn neuere Home-Connect-Geräte auf Port 443 sprechen.
 * Android selbst bietet kein brauchbares TLS-PSK an – deshalb BouncyCastle (reines Java).
 */
object PskTls {
    const val IDENTITAET = "HCCOM_Local_App"

    val CHIFFREN = intArrayOf(
        CipherSuite.TLS_ECDHE_PSK_WITH_CHACHA20_POLY1305_SHA256,
        CipherSuite.TLS_ECDHE_PSK_WITH_AES_128_CBC_SHA256,
        CipherSuite.TLS_ECDHE_PSK_WITH_AES_256_CBC_SHA,
        CipherSuite.TLS_PSK_WITH_AES_128_GCM_SHA256,
        CipherSuite.TLS_PSK_WITH_AES_256_GCM_SHA384,
        CipherSuite.TLS_PSK_WITH_AES_128_CBC_SHA256,
        CipherSuite.TLS_PSK_WITH_AES_128_CBC_SHA,
    )

    class Verbindung(val ein: InputStream, val aus: OutputStream, private val protokoll: TlsClientProtocol) {
        fun schliessen() = runCatching { protokoll.close() }
    }

    fun verbinde(socket: Socket, psk: ByteArray): Verbindung {
        val crypto = BcTlsCrypto(SecureRandom())
        val client = object : PSKTlsClient(crypto, BasicTlsPSKIdentity(IDENTITAET, psk)) {
            override fun getSupportedVersions(): Array<ProtocolVersion> = ProtocolVersion.TLSv12.only()
            override fun getSupportedCipherSuites(): IntArray = CHIFFREN
        }
        val proto = TlsClientProtocol(socket.getInputStream(), socket.getOutputStream())
        proto.connect(client)
        return Verbindung(proto.inputStream, proto.outputStream, proto)
    }
}
