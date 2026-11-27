package de.tiry.mails;

import android.Manifest;
import android.app.Activity;
import android.content.ClipboardManager;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.Message;
import android.os.PowerManager;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.InputStream;
import java.io.OutputStream;

/**
 * Tiry's Mails – Hauptfenster: zeigt die Handy-App (immer die neueste Fassung von GitHub Pages)
 * und reicht ihr über „TirysNative“ die Dinge, die nur eine echte App kann: dauerhafte Anmeldung,
 * Popups im Hintergrund, Dateien speichern, Selbst-Update.
 */
public class Haupt extends Activity {
    static final String START = "https://tiry38.github.io/Tiry/mails/";
    private static final int WAHL_ZUGANG = 11, WAHL_DATEI = 12, ERLAUBNIS_POPUP = 13;

    private WebView web;
    private volatile String aktuelleUrl = "";
    private ValueCallback<Uri[]> dateiRueckruf;
    private final Handler ui = new Handler(Looper.getMainLooper());

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        Waechter.kanaele(this);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#1b1815"));
        setContentView(web);
        // Inhalt unter Statusleiste/Gestenleiste nicht verdecken (Android 15 zeichnet randlos)
        web.setOnApplyWindowInsetsListener((v, ins) -> {
            android.graphics.Insets r = ins.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
            v.setPadding(r.left, r.top, r.right, r.bottom);
            return WindowInsets.CONSUMED;
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setSupportMultipleWindows(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setUserAgentString(s.getUserAgentString() + " TirysMailsApp/" + Aktualisierer.eigeneVersion(this));
        web.addJavascriptInterface(new Bruecke(), "TirysNative");

        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) { return extern(r.getUrl()); }
            @Override public void onPageStarted(WebView v, String url, android.graphics.Bitmap f) { aktuelleUrl = url; }
            @Override public void onPageFinished(WebView v, String url) { aktuelleUrl = url; ausstehendAusfuehren(); }
            @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (!r.isForMainFrame()) return;
                v.loadDataWithBaseURL(null, "<!doctype html><meta name=viewport content='width=device-width'><body style='margin:0;background:#1b1815;color:#f4f0e7;font:600 19px system-ui;display:grid;place-items:center;min-height:100vh;text-align:center;padding:24px'>"
                        + "<div>Kein Internet.<br><span style='font-weight:400;font-size:16px;opacity:.75'>Tiry's Mails versucht es gleich wieder.</span></div>", "text/html", "utf-8", null);
                ui.postDelayed(() -> web.loadUrl(START), 5000);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            // Links mit target=_blank (z. B. aus Mails): im richtigen Browser öffnen
            @Override public boolean onCreateWindow(WebView v, boolean dialog, boolean geste, Message msg) {
                WebView fang = new WebView(Haupt.this);
                fang.setWebViewClient(new WebViewClient() {
                    @Override public boolean shouldOverrideUrlLoading(WebView w, WebResourceRequest r) { oeffneExtern(r.getUrl()); w.destroy(); return true; }
                });
                ((WebView.WebViewTransport) msg.obj).setWebView(fang);
                msg.sendToTarget();
                return true;
            }
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (dateiRueckruf != null) dateiRueckruf.onReceiveValue(null);
                dateiRueckruf = cb;
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*")
                        .putExtra(Intent.EXTRA_ALLOW_MULTIPLE, p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try { startActivityForResult(i, WAHL_DATEI); } catch (Exception e) { dateiRueckruf = null; return false; }
                return true;
            }
        });

        if (b == null) web.loadUrl(START + "?app=1");
        else web.restoreState(b);
        absichtVerarbeiten(getIntent());
        Waechter.starten(this);
        new Thread(() -> {
            String neu = Aktualisierer.neuere(this);
            if (neu != null) js("window.__nativeUpdate && window.__nativeUpdate(" + JSONObject.quote(neu) + ")");
        }).start();
    }

    @Override protected void onSaveInstanceState(Bundle b) { super.onSaveInstanceState(b); web.saveState(b); }
    @Override protected void onNewIntent(Intent i) { super.onNewIntent(i); absichtVerarbeiten(i); }

    @SuppressWarnings("deprecation")
    @Override public void onBackPressed() {
        // Ebenen der App (Mail offen, Schreiben) schließen per Verlauf, sonst App in den Hintergrund
        if (web.canGoBack()) web.goBack(); else moveTaskToBack(true);
    }

    private String ausstehend;
    private void absichtVerarbeiten(Intent i) {
        if (i == null) return;
        String mail = i.getStringExtra("mail");
        if (mail != null) ausstehend = "window.__oeffneMail(" + JSONObject.quote(mail) + ")";
        else if (Intent.ACTION_SENDTO.equals(i.getAction()) && i.getData() != null) ausstehend = "window.__schreibeAn(" + JSONObject.quote(i.getData().getSchemeSpecificPart()) + ")";
        ausstehendAusfuehren();
    }
    private void ausstehendAusfuehren() {
        if (ausstehend == null) return;
        String befehl = ausstehend; ausstehend = null;
        // warten, bis die App bereit ist
        js("(function t(n){ if (window.__bereit) { " + befehl + " } else if (n < 60) setTimeout(function(){ t(n+1) }, 250) })(0)");
    }

    private void js(String code) { ui.post(() -> web.evaluateJavascript(code, null)); }

    /** true = nicht in der App laden (fremde Seite → Browser, mailto → eigenes Schreibfenster). */
    private boolean extern(Uri u) {
        String url = u.toString();
        if (url.startsWith(START)) return false;
        if ("mailto".equals(u.getScheme())) { js("window.__schreibeAn(" + JSONObject.quote(u.getSchemeSpecificPart()) + ")"); return true; }
        oeffneExtern(u);
        return true;
    }
    private void oeffneExtern(Uri u) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) { }
    }

    @Override protected void onActivityResult(int code, int ergebnis, Intent daten) {
        super.onActivityResult(code, ergebnis, daten);
        if (code == WAHL_DATEI && dateiRueckruf != null) {
            Uri[] uris = null;
            if (ergebnis == RESULT_OK && daten != null) {
                if (daten.getClipData() != null) {
                    uris = new Uri[daten.getClipData().getItemCount()];
                    for (int k = 0; k < uris.length; k++) uris[k] = daten.getClipData().getItemAt(k).getUri();
                } else if (daten.getData() != null) uris = new Uri[]{daten.getData()};
            }
            dateiRueckruf.onReceiveValue(uris);
            dateiRueckruf = null;
        }
        if (code == WAHL_ZUGANG) {
            String fehler = "Keine Datei gewählt.";
            if (ergebnis == RESULT_OK && daten != null && daten.getData() != null) {
                try (InputStream in = getContentResolver().openInputStream(daten.getData())) {
                    fehler = Anmeldung.von(this).zugangsdateiUebernehmen(Anmeldung.lesen(in));
                } catch (Exception e) { fehler = "Die Datei konnte ich nicht öffnen."; }
            }
            js("window.__nativeDatei && window.__nativeDatei(" + JSONObject.quote(fehler == null ? "" : fehler) + ")");
        }
    }

    @Override public void onRequestPermissionsResult(int code, String[] p, int[] r) {
        super.onRequestPermissionsResult(code, p, r);
        if (code == ERLAUBNIS_POPUP) js("window.__nativeZustand && window.__nativeZustand()");
    }

    @Override protected void onResume() { super.onResume(); js("window.__nativeZustand && window.__nativeZustand()"); }

    /** Brücke für die Web-Oberfläche. Nur unsere eigene Seite darf sie benutzen. */
    final class Bruecke {
        private boolean erlaubt() { return aktuelleUrl.startsWith(START); }

        @JavascriptInterface public String version() { return String.valueOf(Aktualisierer.eigeneVersion(Haupt.this)); }
        @JavascriptInterface public boolean hatZugangsdatei() { return erlaubt() && Anmeldung.von(Haupt.this).hatZugangsdatei(); }
        @JavascriptInterface public boolean angemeldet() { return erlaubt() && Anmeldung.von(Haupt.this).angemeldet(); }
        @JavascriptInterface public String zugang() {
            if (!erlaubt()) return "";
            String z = Anmeldung.von(Haupt.this).zugang();
            return z == null ? "" : z;
        }
        @JavascriptInterface public String email() { return erlaubt() ? Anmeldung.von(Haupt.this).email() : ""; }
        @JavascriptInterface public void merkeEmail(String e) { if (erlaubt()) Anmeldung.von(Haupt.this).merkeEmail(e); }

        @JavascriptInterface public void zugangsdateiWaehlen() {
            if (!erlaubt()) return;
            Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
            ui.post(() -> { try { startActivityForResult(i, WAHL_ZUGANG); } catch (Exception ignored) { } });
        }
        @JavascriptInterface public void zugangsdateiText(String json) {
            if (!erlaubt()) return;
            String f = Anmeldung.von(Haupt.this).zugangsdateiUebernehmen(json);
            js("window.__nativeDatei && window.__nativeDatei(" + JSONObject.quote(f == null ? "" : f) + ")");
        }
        @JavascriptInterface public void anmelden() {
            if (!erlaubt()) return;
            Anmeldung.von(Haupt.this).anmelden(Haupt.this, (fehler) -> {
                if (fehler == null) { Waechter.prefs(Haupt.this).edit().remove("historyId").apply(); ui.post(() -> Waechter.starten(Haupt.this)); }
                js("window.__nativeAngemeldet && window.__nativeAngemeldet(" + JSONObject.quote(fehler == null ? "" : fehler) + ")");
            });
        }
        @JavascriptInterface public void abmelden() {
            if (!erlaubt()) return;
            Anmeldung.von(Haupt.this).abmelden();
            Waechter.stoppen(Haupt.this);
        }

        @JavascriptInterface public boolean waechterAn() { return Waechter.an(Haupt.this); }
        @JavascriptInterface public void waechter(boolean an) {
            if (!erlaubt()) return;
            Waechter.prefs(Haupt.this).edit().putBoolean("an", an).apply();
            ui.post(() -> { if (an) Waechter.starten(Haupt.this); else Waechter.stoppen(Haupt.this); });
        }
        @JavascriptInterface public boolean popupsErlaubt() {
            return checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        }
        @JavascriptInterface public void popupsAnfragen() {
            if (!erlaubt()) return;
            ui.post(() -> requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, ERLAUBNIS_POPUP));
        }
        @JavascriptInterface public void popupEinstellungen() {
            if (!erlaubt()) return;
            ui.post(() -> startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName())));
        }
        /** Öffnet direkt die Einstellung des Dauer-Hinweises, damit Tiry ihn ausschalten kann (der Wächter läuft trotzdem weiter). */
        @JavascriptInterface public void dauerHinweisAus() {
            if (!erlaubt()) return;
            ui.post(() -> startActivity(new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName()).putExtra(Settings.EXTRA_CHANNEL_ID, Waechter.KANAL_DIENST)));
        }
        @JavascriptInterface public boolean dauerHinweisSichtbar() {
            android.app.NotificationChannel k = getSystemService(android.app.NotificationManager.class).getNotificationChannel(Waechter.KANAL_DIENST);
            return k != null && k.getImportance() != android.app.NotificationManager.IMPORTANCE_NONE;
        }
        @JavascriptInterface public boolean akkuFrei() {
            return getSystemService(PowerManager.class).isIgnoringBatteryOptimizations(getPackageName());
        }
        @SuppressWarnings("BatteryLife")
        @JavascriptInterface public void akkuAnfragen() {
            if (!erlaubt()) return;
            ui.post(() -> {
                try { startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getPackageName()))); }
                catch (Exception e) { startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)); }
            });
        }

        /** Anhang in „Downloads“ speichern. */
        @JavascriptInterface public String speichern(String name, String mime, String base64) {
            if (!erlaubt()) return "nicht erlaubt";
            try {
                ContentValues v = new ContentValues();
                v.put(MediaStore.Downloads.DISPLAY_NAME, name);
                v.put(MediaStore.Downloads.MIME_TYPE, mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
                v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (u == null) return "Speichern nicht möglich";
                try (OutputStream o = getContentResolver().openOutputStream(u)) { o.write(Base64.decode(base64, Base64.DEFAULT)); }
                final Uri ziel = u;
                ui.post(() -> {
                    try { startActivity(new Intent(Intent.ACTION_VIEW).setDataAndType(ziel, mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)); }
                    catch (Exception ignored) { /* kein passendes Programm – liegt trotzdem in Downloads */ }
                });
                return "";
            } catch (Exception e) { return e.getMessage() == null ? "Fehler" : e.getMessage(); }
        }

        @JavascriptInterface public void extern(String url) { if (erlaubt()) ui.post(() -> oeffneExtern(Uri.parse(url))); }
        @JavascriptInterface public String zwischenablage() {
            try {
                ClipboardManager cm = getSystemService(ClipboardManager.class);
                return cm.hasPrimaryClip() ? String.valueOf(cm.getPrimaryClip().getItemAt(0).coerceToText(Haupt.this)) : "";
            } catch (Exception e) { return ""; }
        }

        @JavascriptInterface public void updateInstallieren() {
            if (!erlaubt()) return;
            if (!getPackageManager().canRequestPackageInstalls()) {
                ui.post(() -> startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName()))));
                js("window.__nativeUpdateFehler && window.__nativeUpdateFehler('Bitte „Aus dieser Quelle zulassen“ einschalten, dann noch einmal drücken.')");
                return;
            }
            new Thread(() -> {
                String f = Aktualisierer.installieren(Haupt.this);
                if (f != null) js("window.__nativeUpdateFehler && window.__nativeUpdateFehler(" + JSONObject.quote(f) + ")");
            }).start();
        }
    }

    @Override protected void onDestroy() { if (web != null) web.destroy(); super.onDestroy(); }

}
