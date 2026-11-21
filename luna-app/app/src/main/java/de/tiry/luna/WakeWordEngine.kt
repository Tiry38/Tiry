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

    private fun check(json: String?, cb: Callback) {
        if (json.isNullOrBlank()) return
        val o = try { JSONObject(json) } catch (_: Exception) { return }
        val words: JSONArray? = o.optJSONArray("result")
        val text = o.optString("text", "")
        if (isWake(text, words, prefs.sensitivity, prefs.requireHey)) cb.onWake(text)
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
        private val HEY = setOf("hey", "hallo", "he", "ey", "hi", "high")

        fun buildGrammar(distractors: List<String>): String =
            JSONArray(WAKE + distractors.map { it.trim() }.filter { it.isNotEmpty() && it != "lu" } + "[unk]").toString()

        /**
         * Entscheidet, ob das Gehörte „Hey Luna“ war: „lu“ direkt gefolgt von „na“ mit genug Sicherheit.
         * Empfindlichkeit 1..10 → nötige Sicherheit 0.95 … 0.50. Pures Kotlin → per JUnit getestet.
         */
        fun isWake(text: String, words: JSONArray?, sensitivity: Int, requireHey: Boolean): Boolean {
            val need = 0.95 - (sensitivity.coerceIn(1, 10) - 1) * 0.05
            if (words == null || words.length() == 0) {
                val t = " ${text.trim()} "
                return t.contains(" lu na ") && (!requireHey || HEY.any { t.contains(" $it lu na ") })
            }
            val w = (0 until words.length()).mapNotNull { words.optJSONObject(it) }
            for (i in 0 until w.size - 1) {
                if (w[i].optString("word") != "lu" || w[i + 1].optString("word") != "na") continue
                val hasHey = i > 0 && w[i - 1].optString("word") in HEY
                if (requireHey && !hasHey) continue
                val conf = (w[i].optDouble("conf", 1.0) + w[i + 1].optDouble("conf", 1.0)) / 2
                // Mit „Hey“ davor darf die Sicherheit etwas niedriger sein (weniger Verwechslungsgefahr)
                if (conf >= need - (if (hasHey) 0.1 else 0.0)) return true
            }
            return false
        }
    }
}
