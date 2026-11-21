package de.tiry.luna

import android.os.Handler
import android.os.Looper

enum class LunaState { OFF, LOADING, WAITING, LISTENING, THINKING, SPEAKING, ERROR }

/** Kleiner Nachrichtenkanal zwischen Dienst und Oberfläche (alles auf dem Haupt-Thread). */
object LunaBus {
    data class Snapshot(
        val state: LunaState = LunaState.OFF,
        val status: String = "",
        val userText: String = "",
        val lunaText: String = "",
        val level: Float = 0f,
    )

    interface Listener { fun onLuna(s: Snapshot) }

    private val main = Handler(Looper.getMainLooper())
    private val listeners = mutableSetOf<Listener>()
    @Volatile var current = Snapshot(); private set

    fun add(l: Listener) { listeners += l; l.onLuna(current) }
    fun remove(l: Listener) { listeners -= l }

    fun update(f: (Snapshot) -> Snapshot) {
        main.post {
            current = f(current)
            listeners.toList().forEach { it.onLuna(current) }
        }
    }
}
