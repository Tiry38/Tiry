package de.tiry.mails;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Speichert Zugangsdaten verschlüsselt: der Schlüssel liegt im Android-Keystore und verlässt das Handy nie. */
final class Tresor {
    private static final String ALIAS = "tirysmails-tresor";
    private final SharedPreferences prefs;

    Tresor(Context c) { prefs = c.getSharedPreferences("tresor", Context.MODE_PRIVATE); }

    private static SecretKey schluessel() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (ks.containsAlias(ALIAS)) return ((KeyStore.SecretKeyEntry) ks.getEntry(ALIAS, null)).getSecretKey();
        KeyGenerator g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        g.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256).build());
        return g.generateKey();
    }

    synchronized void setze(String name, String wert) {
        if (wert == null) { prefs.edit().remove(name).apply(); return; }
        try {
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, schluessel());
            byte[] iv = c.getIV();
            byte[] daten = c.doFinal(wert.getBytes(StandardCharsets.UTF_8));
            byte[] alles = new byte[iv.length + daten.length];
            System.arraycopy(iv, 0, alles, 0, iv.length);
            System.arraycopy(daten, 0, alles, iv.length, daten.length);
            prefs.edit().putString(name, Base64.encodeToString(alles, Base64.NO_WRAP)).apply();
        } catch (Exception e) {
            throw new RuntimeException("Tresor: " + e.getMessage(), e);
        }
    }

    synchronized String lies(String name) {
        String roh = prefs.getString(name, null);
        if (roh == null) return null;
        try {
            byte[] alles = Base64.decode(roh, Base64.NO_WRAP);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, schluessel(), new GCMParameterSpec(128, alles, 0, 12));
            return new String(c.doFinal(alles, 12, alles.length - 12), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }
}
