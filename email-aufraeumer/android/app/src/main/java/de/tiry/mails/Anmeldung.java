package de.tiry.mails;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URL;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;

/**
 * Google-Anmeldung wie beim PC-Programm: Desktop-Zugang (client_secret_….json), Browser öffnet Google,
 * Google schickt den Code an eine Adresse auf dem Handy selbst (127.0.0.1) – kein fremder Server.
 * Ergebnis ist ein dauerhafter Schlüssel (refresh_token), mit dem der Wächter im Hintergrund arbeiten darf.
 * Nur Scope gmail.modify – nie endgültig löschen, nie mail.google.com.
 */
final class Anmeldung {
    static final String SCOPE = "https://www.googleapis.com/auth/gmail.modify";
    private final Tresor tresor;
    private String zugang;
    private long ablauf;

    private static Anmeldung einzig;
    static synchronized Anmeldung von(Context c) { if (einzig == null) einzig = new Anmeldung(c.getApplicationContext()); return einzig; }
    private Anmeldung(Context c) { tresor = new Tresor(c); }

    boolean hatZugangsdatei() { return tresor.lies("client_id") != null && tresor.lies("client_secret") != null; }
    boolean angemeldet() { return hatZugangsdatei() && tresor.lies("refresh") != null; }
    String email() { String e = tresor.lies("email"); return e == null ? "" : e; }
    void merkeEmail(String e) { tresor.setze("email", e); }

    /** Liest die bei Google heruntergeladene JSON-Datei (Desktop-App oder Webanwendung). Fehlertext oder null. */
    String zugangsdateiUebernehmen(String json) {
        try {
            JSONObject j = new JSONObject(json);
            JSONObject k = j.has("installed") ? j.getJSONObject("installed") : j.has("web") ? j.getJSONObject("web") : j;
            String id = k.optString("client_id", ""), geheim = k.optString("client_secret", "");
            if (!id.endsWith(".apps.googleusercontent.com") || geheim.isEmpty()) return "Das ist nicht die richtige Datei. Sie heißt meistens client_secret_….json.";
            if (!j.has("installed")) return "Das ist ein Zugang vom Typ „Webanwendung“. Bitte bei Google einen Zugang vom Typ „Desktop-App“ anlegen.";
            tresor.setze("client_id", id);
            tresor.setze("client_secret", geheim);
            return null;
        } catch (Exception e) {
            return "Die Datei konnte ich nicht lesen.";
        }
    }

    void abmelden() { tresor.setze("refresh", null); zugang = null; ablauf = 0; }

    private static String zufall(int bytes) {
        byte[] b = new byte[bytes];
        new SecureRandom().nextBytes(b);
        return Base64.encodeToString(b, Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
    }

    private static String enc(String s) {
        try { return URLEncoder.encode(s, "UTF-8"); } catch (Exception e) { return s; }
    }

    interface Ergebnis { void fertig(String fehler); }

    /** Startet die Anmeldung im Browser; wartet im Hintergrund auf Googles Antwort an 127.0.0.1. */
    void anmelden(Context c, Ergebnis ergebnis) {
        new Thread(() -> {
            ServerSocket server = null;
            try {
                server = new ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"));
                server.setSoTimeout(10 * 60 * 1000);
                String rueck = "http://127.0.0.1:" + server.getLocalPort();
                String verifier = zufall(48);
                String challenge = Base64.encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII)),
                        Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
                String state = zufall(16);
                String url = "https://accounts.google.com/o/oauth2/v2/auth?client_id=" + enc(tresor.lies("client_id"))
                        + "&redirect_uri=" + enc(rueck) + "&response_type=code&scope=" + enc(SCOPE)
                        + "&access_type=offline&prompt=consent&code_challenge=" + challenge + "&code_challenge_method=S256&state=" + state
                        + (email().isEmpty() ? "" : "&login_hint=" + enc(email()));
                Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                c.startActivity(i);

                String code = null, fehler = null;
                while (code == null && fehler == null) {
                    try (Socket s = server.accept()) {
                        BufferedReader r = new BufferedReader(new InputStreamReader(s.getInputStream(), StandardCharsets.UTF_8));
                        String zeile = r.readLine();
                        if (zeile == null || !zeile.startsWith("GET ")) continue;
                        String pfad = zeile.split(" ")[1];
                        Uri u = Uri.parse("http://127.0.0.1" + pfad);
                        if (u.getQueryParameter("code") == null && u.getQueryParameter("error") == null) { antworte(s, 404, ""); continue; }
                        if (!state.equals(u.getQueryParameter("state"))) fehler = "Anmeldung nicht bestätigt.";
                        else if (u.getQueryParameter("error") != null) fehler = "Google hat abgelehnt: " + u.getQueryParameter("error");
                        else code = u.getQueryParameter("code");
                        antworte(s, 200, "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'>"
                                + "<body style='margin:0;background:#1b1815;color:#f4f0e7;font:600 20px system-ui;display:grid;place-items:center;min-height:100vh;text-align:center;padding:24px'>"
                                + (fehler == null ? "<div><div style='font-size:56px'>✓</div>Angemeldet.<br><span style='font-weight:400;font-size:16px;opacity:.75'>Du kannst dieses Fenster schließen – Tiry's Mails ist offen.</span></div>"
                                : "<div>Hat nicht geklappt.<br><span style='font-weight:400;font-size:16px'>Zurück zur App und noch einmal versuchen.</span></div>"));
                    }
                }
                if (fehler != null) { ergebnis.fertig(fehler); return; }

                JSONObject t = tokenAnfrage("code=" + enc(code) + "&client_id=" + enc(tresor.lies("client_id")) + "&client_secret=" + enc(tresor.lies("client_secret"))
                        + "&redirect_uri=" + enc(rueck) + "&grant_type=authorization_code&code_verifier=" + verifier);
                if (!t.has("refresh_token")) { ergebnis.fertig("Google hat keinen dauerhaften Schlüssel geschickt. Bitte noch einmal anmelden."); return; }
                tresor.setze("refresh", t.getString("refresh_token"));
                zugang = t.getString("access_token");
                ablauf = System.currentTimeMillis() + t.optLong("expires_in", 3600) * 1000;
                // App wieder nach vorne holen
                c.startActivity(new Intent(c, Haupt.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT));
                ergebnis.fertig(null);
            } catch (java.net.SocketTimeoutException e) {
                ergebnis.fertig("Zeit abgelaufen – bitte noch einmal anmelden.");
            } catch (Exception e) {
                ergebnis.fertig("Anmeldung fehlgeschlagen: " + e.getMessage());
            } finally {
                try { if (server != null) server.close(); } catch (Exception ignored) { }
            }
        }, "anmeldung").start();
    }

    private static void antworte(Socket s, int status, String html) throws Exception {
        byte[] b = html.getBytes(StandardCharsets.UTF_8);
        OutputStream o = s.getOutputStream();
        o.write(("HTTP/1.1 " + status + " OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: " + b.length + "\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
        o.write(b);
        o.flush();
    }

    private static JSONObject tokenAnfrage(String body) throws Exception {
        HttpURLConnection k = (HttpURLConnection) new URL("https://oauth2.googleapis.com/token").openConnection();
        k.setRequestMethod("POST");
        k.setDoOutput(true);
        k.setConnectTimeout(15000);
        k.setReadTimeout(20000);
        k.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
        k.getOutputStream().write(body.getBytes(StandardCharsets.UTF_8));
        int st = k.getResponseCode();
        String antwort = lesen(st < 400 ? k.getInputStream() : k.getErrorStream());
        JSONObject j = new JSONObject(antwort.isEmpty() ? "{}" : antwort);
        if (st >= 400) {
            String fehler = j.optString("error", "http_" + st);
            throw new TokenFehler(fehler);
        }
        return j;
    }

    static final class TokenFehler extends Exception { final String art; TokenFehler(String a) { super(a); art = a; } }

    static String lesen(InputStream in) throws Exception {
        if (in == null) return "";
        StringBuilder sb = new StringBuilder();
        BufferedReader r = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
        char[] buf = new char[8192];
        int n;
        while ((n = r.read(buf)) > 0) sb.append(buf, 0, n);
        return sb.toString();
    }

    /** Gültiger Zugangsschlüssel (1 h), bei Bedarf still erneuert. null = abgemeldet / Schlüssel ungültig. */
    synchronized String zugang() {
        if (zugang != null && System.currentTimeMillis() < ablauf - 120_000) return zugang;
        String refresh = tresor.lies("refresh");
        if (refresh == null) return null;
        try {
            JSONObject t = tokenAnfrage("refresh_token=" + enc(refresh) + "&client_id=" + enc(tresor.lies("client_id"))
                    + "&client_secret=" + enc(tresor.lies("client_secret")) + "&grant_type=refresh_token");
            zugang = t.getString("access_token");
            ablauf = System.currentTimeMillis() + t.optLong("expires_in", 3600) * 1000;
            return zugang;
        } catch (TokenFehler e) {
            // invalid_grant = Schlüssel widerrufen/abgelaufen → neu anmelden nötig
            if ("invalid_grant".equals(e.art)) tresor.setze("refresh", null);
            return null;
        } catch (Exception e) {
            return null; // kein Netz – später wieder
        }
    }

    static String dekodiere(String s) {
        try { return URLDecoder.decode(s, "UTF-8"); } catch (Exception e) { return s; }
    }
}
