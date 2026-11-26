package de.tiry.waschmaschine.netz

import android.content.Context
import com.wireguard.android.backend.GoBackend
import com.wireguard.android.backend.Tunnel as WgTunnel
import com.wireguard.config.Config
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * WireGuard direkt in der App (offizielle Bibliothek, Android-VpnService).
 * Nur die Heimnetze und nur der Verkehr DIESER App laufen durch den Tunnel.
 */
class Tunnel(private val ctx: Context) {
    private val backend by lazy { GoBackend(ctx.applicationContext) }
    private val tunnel = object : WgTunnel {
        override fun getName() = "zuhause"
        override fun onStateChange(newState: WgTunnel.State) {}
    }

    /** Hat der Nutzer dem VPN einmal zugestimmt? (sonst null = ok) */
    fun zustimmungNoetig(): android.content.Intent? = GoBackend.VpnService.prepare(ctx)

    val istOben get() = runCatching { backend.getState(tunnel) == WgTunnel.State.UP }.getOrDefault(false)

    suspend fun hoch(konfig: String): Boolean = withContext(Dispatchers.IO) {
        if (zustimmungNoetig() != null) return@withContext false
        runCatching {
            val c = Config.parse(konfig.byteInputStream())
            backend.setState(tunnel, WgTunnel.State.UP, c) == WgTunnel.State.UP
        }.getOrDefault(false)
    }

    suspend fun runter() = withContext(Dispatchers.IO) { runCatching { backend.setState(tunnel, WgTunnel.State.DOWN, null) } }

    /** Wann kam der letzte Handschlag der FRITZ!Box? (0 = noch nie) */
    fun letzterHandschlagMs(): Long = runCatching { backend.getStatistics(tunnel).peers().firstOrNull()?.let { backend.getStatistics(tunnel).peer(it)?.latestHandshakeEpochMillis } ?: 0L }.getOrDefault(0L)
}
