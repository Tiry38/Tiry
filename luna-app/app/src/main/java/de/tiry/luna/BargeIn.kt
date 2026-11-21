package de.tiry.luna

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.NoiseSuppressor
import kotlin.math.sqrt

/**
 * Hört mit, während Luna spricht – damit du ihr ins Wort fallen kannst wie einem Menschen.
 * Mikrofon im „Sprachanruf“-Modus mit Echo-Unterdrückung (rechnet Lunas eigene Stimme heraus) + Rauschunterdrückung.
 * Ein lernender Pegel merkt sich, wie laut das Rest-Echo ist; erst deutlich lautere, anhaltende Sprache zählt als Unterbrechung.
 */
class BargeIn {
    @Volatile private var running = false
    private var thread: Thread? = null

    @SuppressLint("MissingPermission")
    fun start(onBargeIn: () -> Unit) {
        stop()
        running = true
        thread = Thread {
            val rate = 16000
            val frame = 320                                     // 20 ms
            val min = AudioRecord.getMinBufferSize(rate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
            val rec = try {
                AudioRecord(MediaRecorder.AudioSource.VOICE_COMMUNICATION, rate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, maxOf(min, frame * 8))
            } catch (_: Exception) { return@Thread }
            if (rec.state != AudioRecord.STATE_INITIALIZED) { rec.release(); return@Thread }
            val aec = if (AcousticEchoCanceler.isAvailable()) AcousticEchoCanceler.create(rec.audioSessionId)?.apply { enabled = true } else null
            val ns = if (NoiseSuppressor.isAvailable()) NoiseSuppressor.create(rec.audioSessionId)?.apply { enabled = true } else null
            val buf = ShortArray(frame)
            val det = Detector()
            try {
                rec.startRecording()
                while (running) {
                    val n = rec.read(buf, 0, frame)
                    if (n <= 0) continue
                    var sum = 0.0
                    for (i in 0 until n) sum += buf[i] * buf[i].toDouble()
                    if (det.feed(sqrt(sum / n))) { running = false; onBargeIn() }
                }
            } catch (_: Exception) {
            } finally {
                try { rec.stop() } catch (_: Exception) {}
                rec.release(); aec?.release(); ns?.release()
            }
        }.apply { name = "luna-barge"; start() }
    }

    /** Stoppt und gibt das Mikrofon frei (blockiert kurz, damit die Spracherkennung danach freie Bahn hat). */
    fun stop() {
        running = false
        thread?.join(400)
        thread = null
    }

    /**
     * Entscheidungslogik, rein rechnerisch (per JUnit getestet):
     * 25 Frames (0,5 s) Einlernen des Echo-Pegels, danach zählt Sprache, die 10 Frames (0,2 s) lang
     * mindestens 3× lauter als der gelernte Pegel und über einer Mindestlautstärke liegt.
     */
    class Detector(private val factor: Double = 3.0, private val minRms: Double = 700.0, private val holdFrames: Int = 10) {
        private var frames = 0
        private var base = 0.0
        private var loud = 0
        fun feed(rms: Double): Boolean {
            frames++
            if (frames <= 25) { base = if (frames == 1) rms else base * 0.85 + rms * 0.15; return false }
            val trigger = rms > maxOf(base * factor, minRms)
            if (trigger) loud++ else { loud = 0; base = base * 0.97 + rms * 0.03 }
            return loud >= holdFrames
        }
    }
}
