package de.tiry.luna

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import org.json.JSONArray
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Selbst-Update: holt die neueste „luna-v1.0.<n>“-Version von GitHub (öffentliches Repo) und installiert sie.
 * Erstes Update: Android fragt einmal nach. Ab Android 12 danach ohne Rückfrage (Luna ist dann ihr eigener Installer).
 */
object Updater {
    private const val API = "https://api.github.com/repos/Tiry38/Tiry/releases?per_page=15"

    data class Release(val versionCode: Int, val name: String, val apkUrl: String)

    /** „luna-v1.0.7“ → 7 (Versionscode = Build-Nummer). */
    fun codeOf(tag: String): Int? = Regex("^luna-v\\d+\\.\\d+\\.(\\d+)$").find(tag)?.groupValues?.get(1)?.toIntOrNull()

    /** Neueste Luna-Version aus der GitHub-Antwort (reines JSON → testbar). */
    fun newest(json: String): Release? {
        val arr = JSONArray(json)
        var best: Release? = null
        for (i in 0 until arr.length()) {
            val r = arr.getJSONObject(i)
            if (r.optBoolean("draft")) continue
            val code = codeOf(r.optString("tag_name")) ?: continue
            val assets = r.optJSONArray("assets") ?: continue
            val apk = (0 until assets.length()).map { assets.getJSONObject(it) }
                .firstOrNull { it.optString("name").endsWith(".apk") }?.optString("browser_download_url") ?: continue
            if (best == null || code > best.versionCode) best = Release(code, r.optString("name", "Luna"), apk)
        }
        return best
    }

    fun check(): Release? {
        val c = URL(API).openConnection() as HttpURLConnection
        c.connectTimeout = 10000; c.readTimeout = 15000
        c.setRequestProperty("Accept", "application/vnd.github+json")
        c.setRequestProperty("User-Agent", "Luna-Updater")
        if (c.responseCode != 200) return null
        val r = newest(c.inputStream.bufferedReader().use { it.readText() }) ?: return null
        return if (r.versionCode > BuildConfig.VERSION_CODE) r else null
    }

    /** Prüft, lädt und installiert. Hintergrund-Thread! Gibt einen Satz für Luna zurück. */
    fun run(ctx: Context, onlyIfNew: Boolean = true): String {
        val r = try { check() } catch (e: Exception) { return "Ich komme gerade nicht an GitHub ran." }
            ?: return if (onlyIfNew) "" else "Ich bin schon auf dem neuesten Stand, Version ${BuildConfig.VERSION_NAME}."
        if (!ctx.packageManager.canRequestPackageInstalls()) {
            ctx.startActivity(Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                android.net.Uri.parse("package:" + ctx.packageName)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            return "Es gibt ein Update auf Version 1.0.${r.versionCode}. Erlaube mir einmal, Apps zu installieren – dann mache ich das ab jetzt selbst."
        }
        val dir = File(ctx.cacheDir, "update").apply { mkdirs() }
        val apk = File(dir, "luna-${r.versionCode}.apk")
        val c = URL(r.apkUrl).openConnection() as HttpURLConnection
        c.instanceFollowRedirects = true; c.connectTimeout = 15000; c.readTimeout = 60000
        c.setRequestProperty("User-Agent", "Luna-Updater")
        c.inputStream.use { inp -> apk.outputStream().use { inp.copyTo(it) } }
        install(ctx, apk)
        return "Update auf Version 1.0.${r.versionCode} wird installiert. Bis gleich."
    }

    private fun install(ctx: Context, apk: File) {
        val pi = ctx.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
            setAppPackageName(ctx.packageName)
            if (Build.VERSION.SDK_INT >= 31) setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
        }
        val id = pi.createSession(params)
        pi.openSession(id).use { s ->
            s.openWrite("luna.apk", 0, apk.length()).use { out -> apk.inputStream().use { it.copyTo(out) }; s.fsync(out) }
            val status = PendingIntent.getBroadcast(ctx, id, Intent(ctx, UpdateReceiver::class.java),
                PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            s.commit(status.intentSender)
        }
    }

    /** Höchstens alle 6 Stunden automatisch prüfen. */
    fun due(ctx: Context): Boolean {
        val p = ctx.getSharedPreferences("luna", Context.MODE_PRIVATE)
        val last = p.getLong("update_check", 0)
        if (System.currentTimeMillis() - last < 6 * 3600_000L) return false
        p.edit().putLong("update_check", System.currentTimeMillis()).apply()
        return true
    }
}

/** Rückmeldung des Installers: Falls Android eine Bestätigung will, den Dialog zeigen. */
class UpdateReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        when (intent.getIntExtra(PackageInstaller.EXTRA_STATUS, -999)) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                @Suppress("DEPRECATION")
                val confirm = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT) ?: return
                ctx.startActivity(confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }
            PackageInstaller.STATUS_SUCCESS -> {}
            else -> android.widget.Toast.makeText(ctx, "Update: " + (intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE) ?: "fehlgeschlagen"), android.widget.Toast.LENGTH_LONG).show()
        }
    }
}

/** Nach dem Update Luna wieder starten (der Dienst wird beim Ersetzen der App beendet). */
class UpdatedReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        try { ctx.startActivity(Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (_: Exception) {}
    }
}
