package de.tiry.waschmaschine.netz

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Build
import de.tiry.waschmaschine.protokoll.GeraeteProfil
import de.tiry.waschmaschine.protokoll.Verbindung
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.util.concurrent.Executors
import javax.net.SocketFactory
import kotlin.coroutines.resume

/**
 * Findet die Waschmaschine automatisch: zuerst per mDNS (_homeconnect._tcp), sonst durch Abklopfen
 * des Heimnetzes. Bestätigt wird nur ein Gerät, das mit UNSEREM Schlüssel den Handschlag schafft.
 */
class Suche(private val ctx: Context, private val netz: Netz) {

    suspend fun finde(profil: GeraeteProfil, fortschritt: (String) -> Unit = {}): String? = withContext(Dispatchers.IO) {
        val sockets = netz.wlanSockets() ?: SocketFactory.getDefault()
        profil.adresse?.let { if (bestaetige(profil, it, sockets)) return@withContext it }
        fortschritt("Suche im WLAN …")
        mdns(profil)?.let { if (bestaetige(profil, it, sockets)) return@withContext it }
        fortschritt("Klopfe das Heimnetz ab …")
        val netze = netz.wlanAdressen().map { (a, p) -> a.hostAddress!! + "/" + p }
        for (n in netze) abklopfen(profil, Netz.kandidaten(n), sockets)?.let { return@withContext it }
        null
    }

    /** Über den Tunnel im Heimnetz suchen (falls sich die IP geändert hat). */
    suspend fun findeUeberTunnel(profil: GeraeteProfil, heimnetze: List<String>): String? = withContext(Dispatchers.IO) {
        for (n in heimnetze.filter { !it.contains(':') }) abklopfen(profil, Netz.kandidaten(n), SocketFactory.getDefault())?.let { return@withContext it }
        null
    }

    private suspend fun abklopfen(profil: GeraeteProfil, adressen: List<String>, sockets: SocketFactory): String? = coroutineScope {
        val tor = Semaphore(48)
        val offen = adressen.map { a -> async { tor.withPermit { a.takeIf { Netz.erreichbar(it, profil.port, 350, sockets) } } } }.awaitAll().filterNotNull()
        offen.firstOrNull { bestaetige(profil, it, sockets) }
    }

    fun bestaetige(profil: GeraeteProfil, adresse: String, sockets: SocketFactory): Boolean = runCatching {
        Verbindung.oeffne(profil, adresse, sockets, 1500).use { k -> k.empfange()?.contains("/ei/initialValues") == true }
    }.getOrDefault(false)

    /** Für den Assistenten: Ist IRGENDEIN Home-Connect-Gerät im WLAN zu sehen? Liefert dessen Namen. */
    @Suppress("DEPRECATION")
    suspend fun homeConnectImWlan(ms: Long = 8000): String? = withTimeoutOrNull(ms) {
        val nsd = ctx.getSystemService(NsdManager::class.java)
        suspendCancellableCoroutine<String?> { k ->
            val l = object : NsdManager.DiscoveryListener {
                override fun onServiceFound(s: NsdServiceInfo) { runCatching { nsd.stopServiceDiscovery(this) }; if (k.isActive) k.resume(s.serviceName) }
                override fun onDiscoveryStarted(t: String) {}
                override fun onDiscoveryStopped(t: String) {}
                override fun onServiceLost(s: NsdServiceInfo) {}
                override fun onStartDiscoveryFailed(t: String, e: Int) { if (k.isActive) k.resume(null) }
                override fun onStopDiscoveryFailed(t: String, e: Int) {}
            }
            nsd.discoverServices("_homeconnect._tcp", NsdManager.PROTOCOL_DNS_SD, l)
            k.invokeOnCancellation { runCatching { nsd.stopServiceDiscovery(l) } }
        }
    }

    @Suppress("DEPRECATION")
    private suspend fun mdns(profil: GeraeteProfil): String? = withTimeoutOrNull(6000) {
        val nsd = ctx.getSystemService(NsdManager::class.java)
        val gefunden = suspendCancellableCoroutine<NsdServiceInfo?> { k ->
            val l = object : NsdManager.DiscoveryListener {
                override fun onServiceFound(s: NsdServiceInfo) {
                    val n = s.serviceName.lowercase()
                    if (n.contains(profil.haId.lowercase().takeLast(12)) || n.contains("washer") || n.contains(profil.typ.lowercase())) {
                        runCatching { nsd.stopServiceDiscovery(this) }; if (k.isActive) k.resume(s)
                    }
                }
                override fun onDiscoveryStarted(t: String) {}
                override fun onDiscoveryStopped(t: String) {}
                override fun onServiceLost(s: NsdServiceInfo) {}
                override fun onStartDiscoveryFailed(t: String, e: Int) { if (k.isActive) k.resume(null) }
                override fun onStopDiscoveryFailed(t: String, e: Int) {}
            }
            nsd.discoverServices("_homeconnect._tcp", NsdManager.PROTOCOL_DNS_SD, l)
            k.invokeOnCancellation { runCatching { nsd.stopServiceDiscovery(l) } }
        } ?: return@withTimeoutOrNull null
        suspendCancellableCoroutine<String?> { k ->
            val cb = object : NsdManager.ResolveListener {
                override fun onResolveFailed(s: NsdServiceInfo, e: Int) { if (k.isActive) k.resume(null) }
                override fun onServiceResolved(s: NsdServiceInfo) {
                    val a = if (Build.VERSION.SDK_INT >= 34) s.hostAddresses.firstOrNull { it is java.net.Inet4Address } ?: s.hostAddresses.firstOrNull() else s.host
                    if (k.isActive) k.resume(a?.hostAddress)
                }
            }
            if (Build.VERSION.SDK_INT >= 34) nsd.resolveService(gefunden, Executors.newSingleThreadExecutor(), cb) else nsd.resolveService(gefunden, cb)
        }
    }
}
