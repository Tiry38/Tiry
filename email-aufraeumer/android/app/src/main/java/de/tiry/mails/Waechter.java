package de.tiry.mails;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.SystemClock;

import org.json.JSONArray;
import org.json.JSONObject;

import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

/**
 * Der Wächter: läuft im Hintergrund (Android verlangt dafür das kleine Dauer-Symbol oben),
 * fragt alle 15 Sekunden bei Gmail nach Neuem (history.list – 2 Quoten-Einheiten) und meldet
 * neue wichtige/persönliche Mails mit eigenem Popup. Werbung, Newsletter, soziale Netzwerke und Spam bleiben still.
 * Schläft das Handy tief, weckt ihn ein Wecker spätestens jede Minute (soweit Android das zulässt).
 */
public class Waechter extends Service {
    static final String KANAL_DIENST = "waechter";
    static final String KANAL_MAIL = "neue-mail";
    static final String AKTION_TICK = "de.tiry.mails.TICK";
    private static final long TAKT_MS = 15_000;
    private static final String API = "https://gmail.googleapis.com/gmail/v1/users/me";

    private Handler handler;
    private PowerManager.WakeLock wach;
    private volatile boolean laeuft;
    private final Runnable schleife = new Runnable() {
        @Override public void run() { pruefen(); if (laeuft) handler.postDelayed(this, TAKT_MS); }
    };

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("waechter", Context.MODE_PRIVATE); }
    static boolean an(Context c) { return prefs(c).getBoolean("an", true); }

    static void starten(Context c) {
        if (!an(c) || !Anmeldung.von(c).angemeldet()) return;
        Intent i = new Intent(c, Waechter.class);
        try { c.startForegroundService(i); } catch (Exception ignored) { /* z. B. aus dem Hintergrund nicht erlaubt – nächster App-Start */ }
    }

    static void stoppen(Context c) {
        c.stopService(new Intent(c, Waechter.class));
        AlarmManager am = c.getSystemService(AlarmManager.class);
        if (am != null) am.cancel(weckIntent(c));
    }

    static void kanaele(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        NotificationChannel d = new NotificationChannel(KANAL_DIENST, "Wächter (läuft im Hintergrund)", NotificationManager.IMPORTANCE_MIN);
        d.setDescription("Zeigt nur, dass Tiry's Mails auf neue Mails wartet.");
        d.setShowBadge(false);
        nm.createNotificationChannel(d);
        NotificationChannel m = new NotificationChannel(KANAL_MAIL, "Neue Mails", NotificationManager.IMPORTANCE_HIGH);
        m.setDescription("Popup bei neuen wichtigen und persönlichen Mails.");
        m.enableVibration(true);
        nm.createNotificationChannel(m);
    }

    @Override public void onCreate() {
        super.onCreate();
        kanaele(this);
        HandlerThread t = new HandlerThread("waechter");
        t.start();
        handler = new Handler(t.getLooper());
        wach = getSystemService(PowerManager.class).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "tirysmails:abruf");
        wach.setReferenceCounted(false);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        Notification n = new Notification.Builder(this, KANAL_DIENST)
                .setSmallIcon(R.drawable.benachrichtigung)
                .setContentTitle("Tiry's Mails")
                .setOngoing(false)            // ab Android 14 wegwischbar
                .setShowWhen(false)
                .setVisibility(Notification.VISIBILITY_SECRET)
                .setContentIntent(PendingIntent.getActivity(this, 0, new Intent(this, Haupt.class), PendingIntent.FLAG_IMMUTABLE))
                .build();
        if (Build.VERSION.SDK_INT >= 34) startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(1, n);
        if (!laeuft) { laeuft = true; handler.post(schleife); }
        else if (intent != null && AKTION_TICK.equals(intent.getAction())) handler.post(this::pruefen);
        weckerStellen(this);
        return START_STICKY;
    }

    @Override public void onDestroy() { laeuft = false; handler.removeCallbacksAndMessages(null); handler.getLooper().quitSafely(); super.onDestroy(); }
    @Override public IBinder onBind(Intent intent) { return null; }

    private static PendingIntent weckIntent(Context c) {
        return PendingIntent.getBroadcast(c, 2, new Intent(c, Wecker.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** Wecker für den Tiefschlaf: Android lässt ihn im Ruhemodus höchstens etwa jede Minute (oder seltener) zu. */
    static void weckerStellen(Context c) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        if (am == null) return;
        long wann = SystemClock.elapsedRealtime() + 60_000;
        try {
            if (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()) am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, wann, weckIntent(c));
            else am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, wann, weckIntent(c));
        } catch (Exception ignored) { }
    }

    // ---------- Abruf ----------
    private synchronized void pruefen() {
        wach.acquire(25_000);
        try {
            String zugang = Anmeldung.von(this).zugang();
            if (zugang == null) { if (!Anmeldung.von(this).angemeldet()) stopSelf(); return; }
            SharedPreferences p = prefs(this);
            String hist = p.getString("historyId", null);
            if (hist == null) { p.edit().putString("historyId", holeJson(zugang, API + "/profile").getString("historyId")).apply(); return; }

            LinkedHashSet<String> neu = new LinkedHashSet<>();
            String seite = null, letzte = hist;
            do {
                JSONObject h;
                try {
                    h = holeJson(zugang, API + "/history?historyTypes=messageAdded&labelId=INBOX&startHistoryId=" + hist + (seite == null ? "" : "&pageToken=" + seite));
                } catch (HttpFehler e) {
                    if (e.status == 404) { p.edit().putString("historyId", holeJson(zugang, API + "/profile").getString("historyId")).apply(); return; }
                    throw e;
                }
                JSONArray arr = h.optJSONArray("history");
                if (arr != null) for (int i = 0; i < arr.length(); i++) {
                    JSONArray add = arr.getJSONObject(i).optJSONArray("messagesAdded");
                    if (add != null) for (int k = 0; k < add.length(); k++) neu.add(add.getJSONObject(k).getJSONObject("message").getString("id"));
                }
                letzte = h.optString("historyId", letzte);
                seite = h.optString("nextPageToken", null);
                if (seite != null && seite.isEmpty()) seite = null;
            } while (seite != null);
            p.edit().putString("historyId", letzte).apply();

            List<String> ids = new ArrayList<>(neu);
            if (ids.size() > 8) ids = ids.subList(ids.size() - 8, ids.size()); // nach langer Pause nicht 200 Popups
            for (String id : ids) melden(zugang, id);
        } catch (Exception ignored) {
            // kein Netz o. Ä. – nächste Runde
        } finally {
            if (wach.isHeld()) wach.release();
            weckerStellen(this);
        }
    }

    private void melden(String zugang, String id) throws Exception {
        JSONObject m;
        try {
            m = holeJson(zugang, API + "/messages/" + id + "?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=List-Unsubscribe&metadataHeaders=Precedence");
        } catch (HttpFehler e) { return; } // schon gelöscht/verschoben
        JSONArray l = m.optJSONArray("labelIds");
        List<String> labels = new ArrayList<>();
        if (l != null) for (int i = 0; i < l.length(); i++) labels.add(l.getString(i));
        if (!labels.contains("INBOX") || !labels.contains("UNREAD") || labels.contains("SENT")) return;
        for (String still : new String[]{"CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "CATEGORY_FORUMS", "SPAM", "TRASH"}) if (labels.contains(still)) return;
        String von = "", betreff = "", liste = "", vorrang = "";
        JSONArray kopf = m.getJSONObject("payload").optJSONArray("headers");
        if (kopf != null) for (int i = 0; i < kopf.length(); i++) {
            JSONObject x = kopf.getJSONObject(i);
            String n = x.optString("name").toLowerCase();
            if (n.equals("from")) von = x.optString("value");
            else if (n.equals("subject")) betreff = x.optString("value");
            else if (n.equals("list-unsubscribe")) liste = x.optString("value");
            else if (n.equals("precedence")) vorrang = x.optString("value").toLowerCase();
        }
        // Massenmails (Newsletter, Werbung) erkennt man am Abmelde-Kopf – die bleiben still
        if (!liste.isEmpty() || vorrang.equals("bulk") || vorrang.equals("list") || vorrang.equals("junk")) return;
        String name = von.replaceAll("\\s*<[^>]*>\\s*$", "").replaceAll("^\"|\"$", "").trim();
        if (name.isEmpty()) name = von;

        Intent oeffnen = new Intent(this, Haupt.class).setAction("oeffnen:" + id).putExtra("mail", id)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        Notification n = new Notification.Builder(this, KANAL_MAIL)
                .setSmallIcon(R.drawable.benachrichtigung)
                .setColor(0xFFF6C945)
                .setContentTitle(name)
                .setContentText(betreff.isEmpty() ? "(kein Betreff)" : betreff)
                .setStyle(new Notification.BigTextStyle().bigText((betreff.isEmpty() ? "(kein Betreff)" : betreff) + (m.optString("snippet").isEmpty() ? "" : "\n" + android.text.Html.fromHtml(m.optString("snippet"), 0))))
                .setCategory(Notification.CATEGORY_EMAIL)
                .setAutoCancel(true)
                .setWhen(Long.parseLong(m.optString("internalDate", String.valueOf(System.currentTimeMillis()))))
                .setShowWhen(true)
                .setContentIntent(PendingIntent.getActivity(this, id.hashCode(), oeffnen, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT))
                .setGroup("mails")
                .build();
        getSystemService(NotificationManager.class).notify(id.hashCode(), n);
    }

    static final class HttpFehler extends Exception { final int status; HttpFehler(int s) { super("HTTP " + s); status = s; } }

    static JSONObject holeJson(String zugang, String url) throws Exception {
        HttpURLConnection k = (HttpURLConnection) new URL(url).openConnection();
        k.setConnectTimeout(12000);
        k.setReadTimeout(15000);
        k.setRequestProperty("Authorization", "Bearer " + zugang);
        int st = k.getResponseCode();
        if (st >= 400) { Anmeldung.lesen(k.getErrorStream()); throw new HttpFehler(st); }
        return new JSONObject(Anmeldung.lesen(k.getInputStream()));
    }

}
