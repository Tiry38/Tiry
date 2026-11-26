package de.tiry.waschmaschine.speicher

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Geräteschlüssel und VPN-Schlüssel liegen nur hier: AES-256-GCM mit einem Schlüssel aus dem
 * Android Keystore (verlässt die Hardware nie). Keine Sicherung in die Cloud (siehe backup-Regeln).
 */
class Tresor(private val ctx: Context) {
    private val alias = "waschmaschine-tresor"
    private fun schluessel(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(alias, null) as? SecretKey)?.let { return it }
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        gen.init(
            KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256).build()
        )
        return gen.generateKey()
    }

    private fun datei(name: String) = File(ctx.noBackupFilesDir, "$name.tresor")

    fun schreibe(name: String, text: String) {
        val c = Cipher.getInstance("AES/GCM/NoPadding"); c.init(Cipher.ENCRYPT_MODE, schluessel())
        val daten = c.doFinal(text.toByteArray(Charsets.UTF_8))
        val tmp = File(datei(name).path + ".neu")
        tmp.writeBytes(byteArrayOf(c.iv.size.toByte()) + c.iv + daten)
        tmp.renameTo(datei(name))
    }

    fun lies(name: String): String? {
        val f = datei(name); if (!f.exists()) return null
        return runCatching {
            val b = f.readBytes(); val n = b[0].toInt()
            val c = Cipher.getInstance("AES/GCM/NoPadding")
            c.init(Cipher.DECRYPT_MODE, schluessel(), GCMParameterSpec(128, b.copyOfRange(1, 1 + n)))
            String(c.doFinal(b.copyOfRange(1 + n, b.size)), Charsets.UTF_8)
        }.getOrNull()
    }

    fun loesche(name: String) { datei(name).delete() }
}
