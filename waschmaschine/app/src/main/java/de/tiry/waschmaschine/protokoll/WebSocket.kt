package de.tiry.waschmaschine.protokoll

import java.io.ByteArrayOutputStream
import java.io.EOFException
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64

/** Schlanker WebSocket-Client (RFC 6455) über beliebige Ströme – hier über TCP oder TLS-PSK. */
class WebSocket private constructor(private val ein: InputStream, private val aus: OutputStream) {
    sealed interface Rahmen {
        data class Text(val text: String) : Rahmen
        class Binaer(val daten: ByteArray) : Rahmen
    }

    private val rnd = SecureRandom()
    private val schreibSperre = Any()

    fun sendeText(text: String) = sende(0x1, text.toByteArray(Charsets.UTF_8))
    fun sendeBinaer(daten: ByteArray) = sende(0x2, daten)
    fun sendePing() = sende(0x9, ByteArray(0))

    private fun sende(opcode: Int, nutz: ByteArray) = synchronized(schreibSperre) {
        val kopf = ByteArrayOutputStream()
        kopf.write(0x80 or opcode)
        val n = nutz.size
        when {
            n < 126 -> kopf.write(0x80 or n)
            n < 65536 -> { kopf.write(0x80 or 126); kopf.write(n shr 8); kopf.write(n and 0xff) }
            else -> { kopf.write(0x80 or 127); for (i in 7 downTo 0) kopf.write(((n.toLong() shr (8 * i)) and 0xff).toInt()) }
        }
        val maske = ByteArray(4).also { rnd.nextBytes(it) }
        kopf.write(maske)
        val maskiert = ByteArray(n) { (nutz[it].toInt() xor maske[it % 4].toInt()).toByte() }
        aus.write(kopf.toByteArray() + maskiert)
        aus.flush()
    }

    /** Liest den nächsten Daten-Rahmen; beantwortet Pings selbst. null = Verbindung geschlossen. */
    fun lies(): Rahmen? {
        val puffer = ByteArrayOutputStream()
        var typ = -1
        while (true) {
            val b0 = ein.read(); if (b0 < 0) return null
            val b1 = lesByte()
            val fin = b0 and 0x80 != 0
            val op = b0 and 0x0f
            var len = (b1 and 0x7f).toLong()
            if (len == 126L) len = ((lesByte() shl 8) or lesByte()).toLong()
            else if (len == 127L) { len = 0; repeat(8) { len = (len shl 8) or lesByte().toLong() } }
            val maske = if (b1 and 0x80 != 0) ByteArray(4) { lesByte().toByte() } else null
            if (len > 4_000_000) throw IOException("Rahmen zu groß")
            val daten = lesVoll(len.toInt())
            if (maske != null) for (i in daten.indices) daten[i] = (daten[i].toInt() xor maske[i % 4].toInt()).toByte()
            when (op) {
                0x8 -> { runCatching { sende(0x8, ByteArray(0)) }; return null }
                0x9 -> { sende(0xA, daten); continue }
                0xA -> continue
                0x0, 0x1, 0x2 -> {
                    if (op != 0) typ = op
                    puffer.write(daten)
                    if (fin) {
                        val alles = puffer.toByteArray()
                        return if (typ == 0x1) Rahmen.Text(String(alles, Charsets.UTF_8)) else Rahmen.Binaer(alles)
                    }
                }
                else -> throw IOException("Unbekannter Opcode $op")
            }
        }
    }

    fun schliessen() { runCatching { sende(0x8, ByteArray(0)) } }

    private fun lesByte(): Int { val b = ein.read(); if (b < 0) throw EOFException(); return b }
    private fun lesVoll(n: Int): ByteArray {
        val b = ByteArray(n); var o = 0
        while (o < n) { val r = ein.read(b, o, n - o); if (r < 0) throw EOFException(); o += r }
        return b
    }

    companion object {
        /** HTTP-Upgrade durchführen und den WebSocket zurückgeben. */
        fun verbinde(ein: InputStream, aus: OutputStream, host: String, pfad: String = "/homeconnect"): WebSocket {
            val schluessel = Base64.getEncoder().encodeToString(ByteArray(16).also { SecureRandom().nextBytes(it) })
            val anfrage = "GET $pfad HTTP/1.1\r\nHost: $host\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
                "Sec-WebSocket-Key: $schluessel\r\nSec-WebSocket-Version: 13\r\n\r\n"
            aus.write(anfrage.toByteArray(Charsets.US_ASCII)); aus.flush()
            val kopf = StringBuilder()
            while (!kopf.endsWith("\r\n\r\n")) {
                val b = ein.read(); if (b < 0) throw EOFException("Gerät hat den Handschlag abgebrochen")
                kopf.append(b.toChar())
                if (kopf.length > 8192) throw IOException("Antwortkopf zu lang")
            }
            val zeilen = kopf.split("\r\n")
            if (!zeilen[0].contains(" 101")) throw IOException("Kein WebSocket: ${zeilen[0]}")
            val erwartet = Base64.getEncoder().encodeToString(
                MessageDigest.getInstance("SHA-1").digest((schluessel + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").toByteArray())
            )
            val accept = zeilen.firstOrNull { it.lowercase().startsWith("sec-websocket-accept:") }?.substringAfter(':')?.trim()
            if (accept != erwartet) throw IOException("WebSocket-Handschlag ungültig")
            return WebSocket(ein, aus)
        }

        /** Server-Seite – nur für die simulierte Maschine in Tests. */
        fun annehmen(ein: InputStream, aus: OutputStream): WebSocket {
            val kopf = StringBuilder()
            while (!kopf.endsWith("\r\n\r\n")) { val b = ein.read(); if (b < 0) throw EOFException(); kopf.append(b.toChar()) }
            val key = kopf.split("\r\n").first { it.lowercase().startsWith("sec-websocket-key:") }.substringAfter(':').trim()
            val accept = Base64.getEncoder().encodeToString(
                MessageDigest.getInstance("SHA-1").digest((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").toByteArray())
            )
            aus.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: $accept\r\n\r\n".toByteArray())
            aus.flush()
            return WebSocket(ein, aus)
        }
    }
}
