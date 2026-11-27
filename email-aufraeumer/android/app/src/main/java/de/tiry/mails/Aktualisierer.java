package de.tiry.mails;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;

import org.json.JSONObject;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Selbst-Update der Android-Hülle (die Oberfläche selbst kommt ohnehin immer frisch aus dem Netz):
 * schaut im GitHub-Release „tirys-mails-android“ nach version.json, lädt die neue APK und übergibt sie dem Android-Installer.
 */
final class Aktualisierer {
    static final String AKTION_STATUS = "de.tiry.mails.UPDATE_STATUS";
    static final String BASIS = "https://github.com/Tiry38/Tiry/releases/download/tirys-mails-android/";

    static long eigeneVersion(Context c) {
        try { return c.getPackageManager().getPackageInfo(c.getPackageName(), 0).getLongVersionCode(); } catch (Exception e) { return 0; }
    }

    /** Neuere Version auf GitHub? Liefert ihren Namen (z. B. „1.7“) oder null. Blockiert – nicht im Haupt-Thread aufrufen. */
    static String neuere(Context c) {
        try {
            HttpURLConnection k = (HttpURLConnection) new URL(BASIS + "version.json").openConnection();
            k.setConnectTimeout(10000); k.setReadTimeout(10000);
            k.setInstanceFollowRedirects(true);
            if (k.getResponseCode() != 200) return null;
            JSONObject j = new JSONObject(Anmeldung.lesen(k.getInputStream()));
            return j.optLong("code", 0) > eigeneVersion(c) ? j.optString("name", "neu") : null;
        } catch (Exception e) { return null; }
    }

    /** Lädt die APK und startet die Installation (Android fragt einmal nach). Fehlertext oder null. Blockiert. */
    static String installieren(Context c) {
        try {
            HttpURLConnection k = (HttpURLConnection) new URL(BASIS + "Tirys-Mails.apk").openConnection();
            k.setConnectTimeout(15000); k.setReadTimeout(60000);
            k.setInstanceFollowRedirects(true);
            if (k.getResponseCode() != 200) return "Download fehlgeschlagen (" + k.getResponseCode() + ")";
            PackageInstaller pi = c.getPackageManager().getPackageInstaller();
            PackageInstaller.SessionParams p = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
            p.setAppPackageName(c.getPackageName());
            int id = pi.createSession(p);
            try (PackageInstaller.Session s = pi.openSession(id)) {
                try (InputStream in = k.getInputStream(); OutputStream out = s.openWrite("tirys-mails.apk", 0, -1)) {
                    byte[] buf = new byte[65536]; int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                    s.fsync(out);
                }
                // Rückmeldung geht an das offene Hauptfenster (darf das Bestätigungsfenster sicher öffnen) – Ersatz: Installiert-Empfänger
                Intent an = new Intent(AKTION_STATUS).setPackage(c.getPackageName());
                PendingIntent rueck = PendingIntent.getBroadcast(c, 7, an, PendingIntent.FLAG_MUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
                s.commit(rueck.getIntentSender());
            }
            return null;
        } catch (Exception e) { return "Update fehlgeschlagen: " + e.getMessage(); }
    }
}
