package de.tiry.luna

import android.app.Notification
import android.content.ComponentName
import android.content.Context
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/** Merkt sich die letzten Benachrichtigungen, damit Luna sie vorlesen kann. */
object NotificationStore {
    data class Item(val app: String, val title: String, val text: String, val time: Long)
    private val items = ArrayDeque<Item>()

    @Synchronized fun add(i: Item) {
        items.removeAll { it.app == i.app && it.title == i.title && it.text == i.text }
        items.addFirst(i)
        while (items.size > 40) items.removeLast()
    }

    @Synchronized fun recent(n: Int) = items.take(n)

    fun enabled(ctx: Context): Boolean {
        val flat = Settings.Secure.getString(ctx.contentResolver, "enabled_notification_listeners") ?: return false
        val me = ComponentName(ctx, NotificationService::class.java).flattenToString()
        return flat.split(":").any { it == me }
    }

    fun describe(ctx: Context, n: Int): String {
        if (!enabled(ctx)) return "Ich habe noch keinen Zugriff auf Benachrichtigungen. Tiry kann ihn in Lunas Einstellungen unter Rechte freigeben."
        val list = recent(n.coerceIn(1, 20))
        if (list.isEmpty()) return "Keine neuen Benachrichtigungen."
        return list.joinToString(" | ") { "${it.app}: ${it.title}${if (it.text.isNotBlank()) " – " + it.text.take(220) else ""}" }
    }
}

class NotificationService : NotificationListenerService() {
    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName == packageName || sbn.isOngoing) return
        val n = sbn.notification ?: return
        if (n.flags and Notification.FLAG_GROUP_SUMMARY != 0) return
        val ex = n.extras
        val title = ex.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
        val text = (ex.getCharSequence(Notification.EXTRA_BIG_TEXT) ?: ex.getCharSequence(Notification.EXTRA_TEXT))?.toString() ?: ""
        if (title.isBlank() && text.isBlank()) return
        val app = try { packageManager.getApplicationLabel(packageManager.getApplicationInfo(sbn.packageName, 0)).toString() } catch (_: Exception) { sbn.packageName }
        NotificationStore.add(NotificationStore.Item(app, title, text, sbn.postTime))
    }

    override fun onListenerConnected() {
        try { activeNotifications?.sortedBy { it.postTime }?.forEach { onNotificationPosted(it) } } catch (_: Exception) {}
    }
}
