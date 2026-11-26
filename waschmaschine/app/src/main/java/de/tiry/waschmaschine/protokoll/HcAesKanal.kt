package de.tiry.waschmaschine.protokoll

import java.security.SecureRandom
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Verschlüsselung der Home-Connect-Geräte ohne TLS (Port 80, ältere Waschmaschinen).
 * Nachgebaut nach hcpy (HCSocket.py): AES-256-CBC mit fortlaufendem Zustand,
 * HMAC-SHA256 (gekürzt auf 16 Byte), verkettet mit der letzten HMAC und der Richtung (E/C).
 */
class HcAesKanal(
    psk: ByteArray,
    private val iv: ByteArray,
    private val zufall: (Int) -> ByteArray = ::zufallsBytes,
    /** true = Geräteseite (nur für die simulierte Maschine in Tests). */
    alsGeraet: Boolean = false,
) {
    private val tx: Byte = if (alsGeraet) 0x43 else 0x45
    private val rx: Byte = if (alsGeraet) 0x45 else 0x43
    private val encKey = hmac(psk, "ENC".toByteArray())
    private val macKey = hmac(psk, "MAC".toByteArray())
    private var lastRx = ByteArray(16)
    private var lastTx = ByteArray(16)
    private val enc: Cipher = Cipher.getInstance("AES/CBC/NoPadding").apply {
        init(Cipher.ENCRYPT_MODE, SecretKeySpec(encKey, "AES"), IvParameterSpec(this@HcAesKanal.iv))
    }
    private val dec: Cipher = Cipher.getInstance("AES/CBC/NoPadding").apply {
        init(Cipher.DECRYPT_MODE, SecretKeySpec(encKey, "AES"), IvParameterSpec(this@HcAesKanal.iv))
    }

    private fun macNachricht(richtung: Byte, letzte: ByteArray, daten: ByteArray): ByteArray =
        hmac(macKey, iv + byteArrayOf(richtung) + letzte + daten).copyOf(16)

    fun verschluesseln(text: String): ByteArray {
        val klar = text.toByteArray(Charsets.UTF_8)
        var pad = 16 - (klar.size % 16)
        if (pad == 1) pad += 16
        val polster = byteArrayOf(0) + zufall(pad - 2) + byteArrayOf(pad.toByte())
        val chiffre = enc.update(klar + polster)
        lastTx = macNachricht(tx, lastTx, chiffre)
        return chiffre + lastTx
    }

    /** Gibt null zurück, wenn die Nachricht manipuliert oder kaputt ist. */
    fun entschluesseln(buf: ByteArray): String? {
        if (buf.size < 32 || (buf.size - 16) % 16 != 0) return null
        val chiffre = buf.copyOfRange(0, buf.size - 16)
        val ihre = buf.copyOfRange(buf.size - 16, buf.size)
        val unsere = macNachricht(rx, lastRx, chiffre)
        if (!java.security.MessageDigest.isEqual(ihre, unsere)) return null
        lastRx = ihre
        val klar = dec.update(chiffre)
        val pad = klar.last().toInt() and 0xff
        if (pad > klar.size) return null
        return String(klar, 0, klar.size - pad, Charsets.UTF_8)
    }

    companion object {
        fun hmac(key: ByteArray, msg: ByteArray): ByteArray =
            Mac.getInstance("HmacSHA256").run { init(SecretKeySpec(key, "HmacSHA256")); doFinal(msg) }
        private val rnd = SecureRandom()
        fun zufallsBytes(n: Int) = ByteArray(n).also { rnd.nextBytes(it) }
        /** base64url ohne Auffüllung, wie in der Geräte-Konfiguration. */
        fun b64(s: String): ByteArray = Base64.getUrlDecoder().decode(s.trim().trimEnd('='))
    }
}
