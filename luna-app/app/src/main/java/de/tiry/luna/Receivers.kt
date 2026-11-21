package de.tiry.luna

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat

/** Feuert bei einer Erinnerung: Benachrichtigung + Luna sagt es laut. */
class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        val text = intent.getStringExtra("text") ?: return
        LunaService.ensureChannels(ctx)
        val n = NotificationCompat.Builder(ctx, LunaService.CH_REMINDER)
            .setSmallIcon(R.drawable.ic_stat_luna).setContentTitle("Luna erinnert dich")
            .setContentText(text).setPriority(NotificationCompat.PRIORITY_HIGH).setAutoCancel(true).build()
        ctx.getSystemService(NotificationManager::class.java).notify(text.hashCode(), n)
        val prefs = Prefs(ctx)
        try {
            ctx.startService(Intent(ctx, LunaService::class.java).setAction(LunaService.ACTION_SAY)
                .putExtra("text", "${prefs.userName}, kurze Erinnerung: $text"))
        } catch (_: Exception) { /* Dienst läuft nicht → nur Benachrichtigung */ }
    }
}

/** Nach dem Neustart: Android 14+ erlaubt keinen Mikrofon-Dienst aus dem Hintergrund – dann Hinweis statt Start. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        if (!Prefs(ctx).wakeWanted) return
        val micOk = ctx.checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) == android.content.pm.PackageManager.PERMISSION_GRANTED
        if (android.os.Build.VERSION.SDK_INT >= 34 || !micOk) { LunaService.postStartHint(ctx); return }
        try { LunaService.start(ctx) } catch (_: Exception) { LunaService.postStartHint(ctx) }
    }
}
