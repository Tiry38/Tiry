package de.tiry.luna

import android.content.Context
import android.content.res.AssetManager
import org.json.JSONArray
import org.json.JSONObject
import org.vosk.Model
import org.vosk.Recognizer
import org.vosk.android.RecognitionListener
import org.vosk.android.SpeechService
import java.io.File

/**
 * Lauscht dauerhaft und komplett offline auf „Hey Luna“ (Vosk, deutsches Modell, eingeschränkte Grammatik).
 * Es wird nichts aufgezeichnet oder hochgeladen – das Audio bleibt im Handy.
 *
 * Hinweis: „Luna“ steht nicht im Wortschatz des deutschen Modells, deshalb wird es lautlich als „lu na“ gesucht.
 * Damit normale Gespräche nicht fälschlich als „Luna“ gelten, enthält die Grammatik zusätzlich ~2900 häufige
 * deutsche Wörter (assets/wake_words.txt) als „Ablenker“. Getestet: 24/24 Treffer, 4/120 Fehlalarme
 * (fast nur bei klanggleichen Sätzen wie „Lou, na komm“).
 */
class WakeWordEngine(private val ctx: Context, private val prefs: Prefs) {

    interface Callback {
        fun onWake(heard: String)
        fun onWakeError(msg: String)
    }

    private var model: Model? = null
    private var service: SpeechService? = null
    private var recognizer: Recognizer? = null
    private var grammar: String = buildGrammar(emptyList())
    var ready = false; private set

    /** Entpackt das Modell beim ersten Start in den App-Speicher und lädt es (dauert einige Sekunden). Hintergrund-Thread! */
    fun load() {
        if (model != null) return
        val target = File(ctx.filesDir, "model-de")
        val marker = File(target, ".luna-version")
        val version = ctx.packageManager.getPackageInfo(ctx.packageName, 0).lastUpdateTime.toString()
        if (!marker.exists() || marker.readText() != version) {
            target.deleteRecursively()
            copyAssets(ctx.assets, "model-de", target)
            marker.writeText(version)
        }
        if (!File(target, "am/final.mdl").exists()) throw IllegalStateException("Sprachmodell fehlt in der App (assets/model-de).")
        grammar = buildGrammar(ctx.assets.open("wake_words.txt").bufferedReader().use { it.readLines() })
        model = Model(target.absolutePath)
        ready = true
    }

    private fun copyAssets(am: AssetManager, path: String, out: File) {
        val list = am.list(path) ?: emptyArray()
        if (list.isEmpty()) {
            out.parentFile?.mkdirs()
            am.open(path).use { i -> out.outputStream().use { i.copyTo(it) } }
        } else {
            out.mkdirs()
            list.forEach { copyAssets(am, "$path/$it", File(out, it)) }
        }
    }

    fun start(cb: Callback) {
        val m = model ?: return cb.onWakeError("Sprachmodell noch nicht geladen.")
        stop()
        try {
            lastSpeechEnd = -99.0
            val rec = Recognizer(m, 16000f, grammar)
            rec.setWords(true)
            recognizer = rec
            val svc = SpeechService(rec, 16000f)
            service = svc
            svc.startListening(object : RecognitionListener {
                override fun onPartialResult(hypothesis: String?) {}
                override fun onResult(hypothesis: String?) { check(hypothesis, cb) }
                override fun onFinalResult(hypothesis: String?) { check(hypothesis, cb) }
                override fun onError(e: Exception?) { cb.onWakeError(e?.message ?: "Mikrofonfehler") }
                override fun onTimeout() {}
            })
        } catch (e: Exception) {
            cb.onWakeError(e.message ?: "Mikrofon nicht verfügbar")
        }
    }

    /** Ende des letzten gehörten Wortes (Sekunden im Audiostrom) – um laufende Gespräche zu erkennen. */
    private var lastSpeechEnd = -99.0

    private fun check(json: String?, cb: Callback) {
        if (json.isNullOrBlank()) return
        val o = try { JSONObject(json) } catch (_: Exception) { return }
        val words: JSONArray? = o.optJSONArray("result")
        val text = o.optString("text", "")
        val firstStart = words?.optJSONObject(0)?.optDouble("start", -1.0) ?: -1.0
        val gap = if (firstStart >= 0) firstStart - lastSpeechEnd else 99.0
        if (words != null && words.length() > 0) lastSpeechEnd = words.optJSONObject(words.length() - 1)?.optDouble("end", lastSpeechEnd) ?: lastSpeechEnd
        if (isWake(text, words, prefs.sensitivity, prefs.requireHey, gap)) cb.onWake(text)
    }

    fun stop() {
        try { service?.stop(); service?.shutdown() } catch (_: Exception) {}
        service = null
        try { recognizer?.close() } catch (_: Exception) {}
        recognizer = null
    }

    fun release() { stop(); try { model?.close() } catch (_: Exception) {}; model = null; ready = false }

    companion object {
        private val WAKE = listOf("hey lu na", "hallo lu na", "lu na")
        private val HEY = setOf("hey", "hallo", "he", "ey", "hi", "high", "okay", "ok")

        fun buildGrammar(distractors: List<String>): String =
            JSONArray(WAKE + listOf("ok lu na") + distractors.map { it.trim() }.filter { it.isNotEmpty() && it != "lu" } + "[unk]").toString()

        /**
         * Entscheidet, ob Luna wirklich GEMEINT ist – nicht nur erwähnt:
         *  - „Luna“ muss am Satzanfang stehen oder direkt nach „Hey/Hallo/Okay“ (mitten im Satz = über sie geredet → nein).
         *  - Wurde unmittelbar davor geredet (Pause < 1,5 s, also laufendes Gespräch), reicht „Luna“ allein nicht – dann nur „Hey Luna“.
         *  - Ohne „Hey“ nur „Luna“ allein (mit Pause). Geht der Satz weiter („Luna ist eine App …“), ist es eine Erzählung → nein.
         *    Getestet mit Vosk + synthetischen Stimmen: 20/24 Treffer (fehlend nur „Luna, mach …“ ohne Hey – gewollt), 3/36 Fehlalarme.
         *  - Sicherheit der Erkennung je nach Empfindlichkeit (1..10 → 0.95 … 0.50).
         * Pures Kotlin → per JUnit getestet.
         */
        fun isWake(text: String, words: JSONArray?, sensitivity: Int, requireHey: Boolean, gapSec: Double = 99.0): Boolean {
            val need = 0.95 - (sensitivity.coerceIn(1, 10) - 1) * 0.05
            val w: List<Pair<String, Double>> = if (words != null && words.length() > 0)
                (0 until words.length()).mapNotNull { words.optJSONObject(it) }.map { it.optString("word") to it.optDouble("conf", 1.0) }
            else text.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }.map { it to 1.0 }
            val i = (0 until w.size - 1).firstOrNull { w[it].first == "lu" && w[it + 1].first == "na" } ?: return false
            val before = w.subList(0, i).map { it.first }.filter { it != "[unk]" || i > 1 }
            val hasHey = before.size == 1 && before[0] in HEY
            if (before.isNotEmpty() && !hasHey) return false               // mitten im Satz → nur erwähnt
            if (requireHey && !hasHey) return false
            if (!hasHey && gapSec < 1.5) return false                       // laufendes Gespräch → „Hey Luna“ nötig
            val after = w.size - (i + 2)
            if (!hasHey && after > 1) return false                          // „Luna ist …“ = Erzählung; Befehl im Satz nur mit „Hey Luna, …“
            val conf = (w[i].second + w[i + 1].second) / 2
            return conf >= need - (if (hasHey) 0.1 else 0.0)                // mit „Hey“ etwas toleranter
        }
    }
}
