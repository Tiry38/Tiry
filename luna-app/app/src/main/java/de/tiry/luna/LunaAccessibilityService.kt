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

    /** Verkleinerungsfaktor des letzten Screenshots (Bild-Koordinaten → Bildschirm-Koordinaten). */
    @Volatile var lastShotScale = 1f

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

    /** Echte Bildschirmgröße in Pixeln (inkl. Navigationsleiste) – Grundlage für Gesten. */
    private fun screenSize(): Pair<Int, Int> {
        if (Build.VERSION.SDK_INT >= 30) {
            val b = getSystemService(android.view.WindowManager::class.java).currentWindowMetrics.bounds
            return b.width() to b.height()
        }
        val dm = resources.displayMetrics
        return dm.widthPixels to dm.heightPixels
    }

    /** Gleicher Maßstab wie beim Screenshot (längste Seite = 1280 px) → Koordinaten aus read_screen und look_at_screen passen zusammen. */
    fun imageScale(): Float { val (w, h) = screenSize(); return minOf(1f, 1280f / maxOf(w, h)) }

    fun readScreen(): String {
        val root = rootInActiveWindow ?: return "Ich kann den Bildschirm gerade nicht lesen."
        val sc = imageScale(); lastShotScale = sc
        val sb = StringBuilder("App: ${root.packageName}. Koordinaten @x,y passen zu tap_at/long_press/swipe. ")
        val seen = HashSet<String>()
        val r = Rect()
        fun walk(n: AccessibilityNodeInfo?, depth: Int) {
            if (n == null || depth > 45 || sb.length > 6000) return
            if (n.isVisibleToUser) {
                val t = (n.text ?: n.contentDescription ?: n.hintText)?.toString()?.trim()
                val interactive = n.isClickable || n.isLongClickable || n.isEditable || n.isCheckable
                if (!t.isNullOrBlank() && seen.add(t + n.isClickable)) {
                    n.getBoundsInScreen(r)
                    if (n.isEditable) sb.append("[Eingabe] ") else if (n.isCheckable) sb.append(if (n.isChecked) "[An] " else "[Aus] ") else if (interactive) sb.append("[Knopf] ")
                    sb.append(t.take(140))
                    if (interactive) sb.append(" @").append((r.exactCenterX() * sc).toInt()).append(',').append((r.exactCenterY() * sc).toInt())
                    sb.append(" | ")
                } else if (t.isNullOrBlank() && interactive) {
                    n.getBoundsInScreen(r)
                    sb.append("[Knopf ohne Text] @").append((r.exactCenterX() * sc).toInt()).append(',').append((r.exactCenterY() * sc).toInt()).append(" | ")
                }
            }
            for (i in 0 until n.childCount) walk(n.getChild(i), depth + 1)
        }
        walk(root, 0)
        return sb.toString()
    }

    private fun gesture(p: Path, ms: Long): Boolean {
        val latch = java.util.concurrent.CountDownLatch(1)
        var ok = false
        val sent = dispatchGesture(GestureDescription.Builder().addStroke(GestureDescription.StrokeDescription(p, 0, ms)).build(),
            object : GestureResultCallback() {
                override fun onCompleted(g: GestureDescription?) { ok = true; latch.countDown() }
                override fun onCancelled(g: GestureDescription?) { latch.countDown() }
            }, null)
        if (!sent) return false
        latch.await(ms + 2000, java.util.concurrent.TimeUnit.MILLISECONDS)
        return ok
    }

    /** Koordinaten im Bild-Maßstab (wie read_screen/look_at_screen). */
    fun longPressAt(x: Float, y: Float): Boolean = gesture(Path().apply { moveTo(x / lastShotScale, y / lastShotScale) }, 900)

    fun swipe(x1: Float, y1: Float, x2: Float, y2: Float, ms: Long = 400): Boolean {
        val s = lastShotScale
        return gesture(Path().apply { moveTo(x1 / s, y1 / s); lineTo(x2 / s, y2 / s) }, ms.coerceIn(80, 3000))
    }

    fun longPressText(q: String): String {
        val n = findNodes(q).firstOrNull() ?: return "Ich sehe kein Element „$q“."
        var cur: AccessibilityNodeInfo? = n
        while (cur != null) { if (cur.isLongClickable && cur.performAction(AccessibilityNodeInfo.ACTION_LONG_CLICK)) return "Lange gedrückt: „$q“."; cur = cur.parent }
        val r = Rect(); n.getBoundsInScreen(r)
        return if (gesture(Path().apply { moveTo(r.exactCenterX(), r.exactCenterY()) }, 900)) "Lange gedrückt: „$q“." else "Lange drücken hat nicht geklappt."
    }

    fun pressEnter(): String {
        val f = rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: return "Kein Eingabefeld aktiv."
        if (Build.VERSION.SDK_INT >= 30 && f.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_IME_ENTER.id)) return "Enter gedrückt."
        return "Enter geht hier nicht – tippe besser auf den Senden-/Suchen-Knopf."
    }

    /** Schnelleinstellungen (WLAN, Bluetooth, Flugmodus, Hotspot, Standort, Bitte nicht stören …) per Kachel umschalten. */
    fun quickSetting(name: String): String {
        performGlobalAction(GLOBAL_ACTION_QUICK_SETTINGS)
        Thread.sleep(900)
        var n = findNodes(name).firstOrNull()
        if (n == null) { scroll("left"); Thread.sleep(600); n = findNodes(name).firstOrNull() }
        if (n == null) { performGlobalAction(GLOBAL_ACTION_BACK); return "Die Kachel „$name“ habe ich in den Schnelleinstellungen nicht gefunden." }
        val ok = click(n)
        Thread.sleep(500)
        val state = ((if (Build.VERSION.SDK_INT >= 30) n.stateDescription else null) ?: n.contentDescription ?: "").toString()
        performGlobalAction(GLOBAL_ACTION_BACK); performGlobalAction(GLOBAL_ACTION_BACK)
        return if (ok) "„$name“ umgeschaltet.${if (state.isNotBlank()) " Zustand: $state" else ""}" else "Umschalten von „$name“ hat nicht geklappt."
    }

    fun openNotification(q: String): String {
        performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS)
        Thread.sleep(800)
        val n = findNodes(q).firstOrNull() ?: run { performGlobalAction(GLOBAL_ACTION_BACK); return "Keine Benachrichtigung mit „$q“ gefunden." }
        return if (click(n)) "Benachrichtigung „$q“ geöffnet." else "Öffnen hat nicht geklappt."
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

    /** Screenshot als JPEG (Base64, max. 1280 px), für „Guck mal da“. Ab Android 11. Blockiert bis zu 5 s – nicht auf dem Haupt-Thread aufrufen. */
    fun screenshotJpeg(): String? {
        if (Build.VERSION.SDK_INT < 30) return null
        val latch = java.util.concurrent.CountDownLatch(1)
        var out: String? = null
        takeScreenshot(android.view.Display.DEFAULT_DISPLAY, mainExecutor, object : TakeScreenshotCallback {
            override fun onSuccess(r: ScreenshotResult) {
                try {
                    val hw = android.graphics.Bitmap.wrapHardwareBuffer(r.hardwareBuffer, r.colorSpace)
                    val soft = hw?.copy(android.graphics.Bitmap.Config.ARGB_8888, false)
                    r.hardwareBuffer.close()
                    if (soft != null) {
                        val scale = 1280f / maxOf(soft.width, soft.height)
                        lastShotScale = if (scale < 1f) scale else 1f
                        val bmp = if (scale < 1f) android.graphics.Bitmap.createScaledBitmap(soft, (soft.width * scale).toInt(), (soft.height * scale).toInt(), true) else soft
                        val bos = java.io.ByteArrayOutputStream()
                        bmp.compress(android.graphics.Bitmap.CompressFormat.JPEG, 75, bos)
                        out = android.util.Base64.encodeToString(bos.toByteArray(), android.util.Base64.NO_WRAP)
                    }
                } catch (_: Exception) {}
                latch.countDown()
            }
            override fun onFailure(errorCode: Int) { latch.countDown() }
        })
        latch.await(5, java.util.concurrent.TimeUnit.SECONDS)
        return out
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
