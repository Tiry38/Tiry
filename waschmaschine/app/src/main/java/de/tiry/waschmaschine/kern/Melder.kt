package de.tiry.waschmaschine.kern

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import de.tiry.waschmaschine.MainActivity
import de.tiry.waschmaschine.R
import de.tiry.waschmaschine.logik.Popup
import de.tiry.waschmaschine.logik.PopupArt
import de.tiry.waschmaschine.logik.Texte
import de.tiry.waschmaschine.logik.Zustand

/** Pop-ups aufs Handy. Jede Art hat einen eigenen Kanal – auch in den Android-Einstellungen einzeln abschaltbar. */
class Melder(private val ctx: Context) {
    private val nm = ctx.getSystemService(NotificationManager::class.java)

    init {
        val wichtig = NotificationManager.IMPORTANCE_HIGH
        listOf(
            NotificationChannel(kanal(PopupArt.FERTIG), "Wäsche fertig", wichtig),
            NotificationChannel(kanal(PopupArt.WAESCHE_WARTET), "Wäsche liegt noch drin", wichtig),
            NotificationChannel(kanal(PopupArt.FEHLER), "Fehler der Maschine", wichtig),
            NotificationChannel(kanal(PopupArt.VERBINDUNG_WEG), "Verbindung verloren", NotificationManager.IMPORTANCE_DEFAULT),
            NotificationChannel(kanal(PopupArt.NOCH_ZEHN), "Noch 10 Minuten", NotificationManager.IMPORTANCE_DEFAULT),
            NotificationChannel(LAUF, "Laufender Waschgang", NotificationManager.IMPORTANCE_LOW).apply { setShowBadge(false) },
        ).forEach(nm::createNotificationChannel)
    }

    private fun kanal(a: PopupArt) = "popup_" + a.name.lowercase()

    private fun oeffnen() = PendingIntent.getActivity(ctx, 0, Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE)

    fun darf() = android.os.Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    fun zeige(p: Popup) {
        if (!darf()) return
        val n = NotificationCompat.Builder(ctx, kanal(p.art))
            .setSmallIcon(R.drawable.ic_trommel)
            .setContentTitle(p.art.titel)
            .setContentText(p.text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(p.text))
            .setColor(0xFFD4FF3A.toInt())
            .setCategory(if (p.art == PopupArt.FEHLER) NotificationCompat.CATEGORY_ERROR else NotificationCompat.CATEGORY_STATUS)
            .setAutoCancel(true)
            .setContentIntent(oeffnen())
            .build()
        nm.notify(p.art.ordinal + 10, n)
    }

    /** Dauer-Benachrichtigung, solange der Hintergrund einen Waschgang begleitet. */
    fun laufend(z: Zustand?, weg: String): Notification {
        val titel = z?.let { "${it.programm ?: "Waschgang"} · ${it.status.wort}" } ?: "Verbinde mit der Waschmaschine …"
        val text = z?.restSek?.takeIf { it > 0 }?.let { r ->
            val um = java.text.SimpleDateFormat("HH:mm", java.util.Locale.GERMANY).format(java.util.Date(System.currentTimeMillis() + r * 1000))
            "noch ${Texte.dauer(r)} · fertig um $um · $weg"
        } ?: weg
        return NotificationCompat.Builder(ctx, LAUF)
            .setSmallIcon(R.drawable.ic_trommel)
            .setContentTitle(titel).setContentText(text)
            .setOngoing(true).setOnlyAlertOnce(true).setSilent(true)
            .setColor(0xFFD4FF3A.toInt())
            .setProgress(100, z?.fortschritt ?: 0, z?.fortschritt == null)
            .setContentIntent(oeffnen())
            .build()
    }

    companion object { const val LAUF = "lauf"; const val LAUF_ID = 1 }
}
