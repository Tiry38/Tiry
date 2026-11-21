package de.tiry.luna

import android.content.SharedPreferences
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Tresor für Geheimnisse (API-Schlüssel, FRITZ!Box-Passwort): AES-256-GCM mit einem Schlüssel im Android-Keystore.
 * Der Schlüssel verlässt nie die Sicherheits-Hardware des Handys und ist an genau dieses Gerät gebunden –
 * selbst ein kopierter App-Speicher ist auf einem anderen Gerät wertlos.
 */
object Vault {
    private const val ALIAS = "luna_vault_v1"
    private const val PREFIX = "enc1:"

    private fun key(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        gen.init(KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256).build())
        return gen.generateKey()
    }

    fun encrypt(plain: String): String {
        if (plain.isEmpty()) return ""
        val c = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
        val out = c.iv + c.doFinal(plain.toByteArray())
        return PREFIX + Base64.encodeToString(out, Base64.NO_WRAP)
    }

    fun decrypt(stored: String): String {
        if (stored.isEmpty()) return ""
        if (!stored.startsWith(PREFIX)) return stored            // alter Klartext-Wert (wird beim Lesen migriert)
        return try {
            val raw = Base64.decode(stored.removePrefix(PREFIX), Base64.NO_WRAP)
            val c = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, raw, 0, 12)) }
            String(c.doFinal(raw, 12, raw.size - 12))
        } catch (_: Exception) { "" }
    }

    /** Liest ein Geheimnis; Klartext aus älteren Versionen wird dabei sofort verschlüsselt. */
    fun read(p: SharedPreferences, k: String): String {
        val raw = p.getString(k, "")!!
        if (raw.isNotEmpty() && !raw.startsWith(PREFIX)) {
            try { p.edit().putString(k, encrypt(raw)).apply() } catch (_: Exception) {}
            return raw
        }
        return decrypt(raw)
    }

    fun write(p: SharedPreferences, k: String, v: String) {
        val value = v.trim()
        p.edit().putString(k, try { encrypt(value) } catch (_: Exception) { value }).apply()
    }
}
