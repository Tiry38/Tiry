package de.tiry.luna

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.ComponentName
import android.content.Context
import android.graphics.Path
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Bedienungshilfe: Damit kann Luna den Bildschirm lesen, tippen, scrollen, schreiben und Systemtasten drücken –
 * also das Handy „fernsteuern“, während es neben dir liegt.
 */
class LunaAccessibilityService : AccessibilityService() {

    companion object {
        @Volatile var instance: LunaAccessibilityService? = null
        fun enabled(ctx: Context): Boolean {
            val flat = Settings.Secure.getString(ctx.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: return false
            val me = ComponentName(ctx, LunaAccessibilityService::class.java).flattenToString()
            return flat.split(":").any { it.equals(me, true) }
        }
    }

    override fun onServiceConnected() { instance = this }
    override fun onDestroy() { instance = null; super.onDestroy() }
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {}
    override fun onInterrupt() {}

    fun global(action: String): String {
        val code = when (action) {
            "back" -> GLOBAL_ACTION_BACK; "home" -> GLOBAL_ACTION_HOME; "recents" -> GLOBAL_ACTION_RECENTS
            "notifications" -> GLOBAL_ACTION_NOTIFICATIONS; "quick_settings" -> GLOBAL_ACTION_QUICK_SETTINGS
            "power_menu" -> GLOBAL_ACTION_POWER_DIALOG
            "lock" -> if (Build.VERSION.SDK_INT >= 28) GLOBAL_ACTION_LOCK_SCREEN else return "Sperren geht erst ab Android 9."
            "screenshot" -> if (Build.VERSION.SDK_INT >= 28) GLOBAL_ACTION_TAKE_SCREENSHOT else return "Screenshot geht erst ab Android 9."
            else -> return "Unbekannte Aktion $action."
        }
        return if (performGlobalAction(code)) "Erledigt." else "Das hat nicht geklappt."
    }

    fun readScreen(): String {
        val root = rootInActiveWindow ?: return "Ich kann den Bildschirm gerade nicht lesen."
        val sb = StringBuilder("App: ${root.packageName}. ")
        val seen = HashSet<String>()
        fun walk(n: AccessibilityNodeInfo?, depth: Int) {
            if (n == null || depth > 40 || sb.length > 3500) return
            if (n.isVisibleToUser) {
                val t = (n.text ?: n.contentDescription)?.toString()?.trim()
                if (!t.isNullOrBlank() && seen.add(t)) sb.append(if (n.isClickable) "[Knopf] " else "").append(t.take(160)).append(" | ")
            }
            for (i in 0 until n.childCount) walk(n.getChild(i), depth + 1)
        }
        walk(root, 0)
        return sb.toString()
    }

    private fun findNodes(query: String): List<AccessibilityNodeInfo> {
        val root = rootInActiveWindow ?: return emptyList()
        val q = query.lowercase().trim()
        val out = mutableListOf<AccessibilityNodeInfo>()
        fun walk(n: AccessibilityNodeInfo?, depth: Int) {
            if (n == null || depth > 40) return
            val t = (n.text ?: "").toString().lowercase(); val d = (n.contentDescription ?: "").toString().lowercase()
            if (n.isVisibleToUser && (t == q || d == q || (q.length >= 3 && (t.contains(q) || d.contains(q))))) out += n
            for (i in 0 until n.childCount) walk(n.getChild(i), depth + 1)
        }
        walk(root, 0)
        return out.sortedBy { if ((it.text ?: it.contentDescription).toString().lowercase() == q) 0 else 1 }
    }

    private fun click(n: AccessibilityNodeInfo): Boolean {
        var cur: AccessibilityNodeInfo? = n
        while (cur != null) {
            if (cur.isClickable && cur.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return true
            cur = cur.parent
        }
        val r = Rect(); n.getBoundsInScreen(r)
        return tapAt(r.exactCenterX(), r.exactCenterY())
    }

    fun tapText(query: String): String {
        val n = findNodes(query).firstOrNull() ?: return "Ich sehe kein Element „$query“ auf dem Bildschirm."
        return if (click(n)) "Getippt auf „$query“." else "Tippen auf „$query“ hat nicht geklappt."
    }

    fun tapByIdOrDesc(ids: List<String>, descs: List<String>): Boolean {
        val root = rootInActiveWindow ?: return false
        for (id in ids) root.findAccessibilityNodeInfosByViewId(id)?.firstOrNull { it.isVisibleToUser }?.let { if (click(it)) return true }
        for (d in descs) findNodes(d).firstOrNull()?.let { if (click(it)) return true }
        return false
    }

    fun tapAt(x: Float, y: Float): Boolean {
        val p = Path().apply { moveTo(x, y) }
        return dispatchGesture(GestureDescription.Builder().addStroke(GestureDescription.StrokeDescription(p, 0, 60)).build(), null, null)
    }

    fun scroll(direction: String): String {
        val dm = resources.displayMetrics
        val w = dm.widthPixels.toFloat(); val h = dm.heightPixels.toFloat()
        val p = Path()
        when (direction) {
            "up" -> { p.moveTo(w / 2, h * 0.3f); p.lineTo(w / 2, h * 0.75f) }
            "left" -> { p.moveTo(w * 0.2f, h / 2); p.lineTo(w * 0.8f, h / 2) }
            "right" -> { p.moveTo(w * 0.8f, h / 2); p.lineTo(w * 0.2f, h / 2) }
            else -> { p.moveTo(w / 2, h * 0.75f); p.lineTo(w / 2, h * 0.3f) }
        }
        val ok = dispatchGesture(GestureDescription.Builder().addStroke(GestureDescription.StrokeDescription(p, 0, 350)).build(), null, null)
        return if (ok) "Gescrollt." else "Scrollen hat nicht geklappt."
    }

    fun typeText(text: String): String {
        val root = rootInActiveWindow ?: return "Kein Fenster aktiv."
        val field = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: run {
            var editable: AccessibilityNodeInfo? = null
            fun walk(n: AccessibilityNodeInfo?) { if (n == null || editable != null) return; if (n.isEditable && n.isVisibleToUser) editable = n; for (i in 0 until n.childCount) walk(n.getChild(i)) }
            walk(root); editable
        } ?: return "Ich finde kein Eingabefeld."
        val args = Bundle().apply { putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text) }
        return if (field.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)) "Text eingegeben." else "Schreiben hat nicht geklappt."
    }
}
