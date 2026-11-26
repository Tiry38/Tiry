package de.tiry.waschmaschine.netz

import android.content.Context
import android.net.ConnectivityManager
import android.net.LinkProperties
import android.net.Network
import android.net.NetworkCapabilities
import java.net.Inet4Address
import java.net.InetSocketAddress
import java.net.Socket
import javax.net.SocketFactory

/** Netz-Hilfen: Heim-WLAN erkennen und gezielt über WLAN bzw. Tunnel verbinden. */
class Netz(ctx: Context) {
    private val cm = ctx.getSystemService(ConnectivityManager::class.java)

    /** Das WLAN-Netz (nicht das VPN), falls verbunden. */
    fun wlan(): Network? = cm.allNetworks.firstOrNull { n ->
        val c = cm.getNetworkCapabilities(n) ?: return@firstOrNull false
        c.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) && !c.hasTransport(NetworkCapabilities.TRANSPORT_VPN)
    }

    fun imWlan() = wlan() != null

    fun hatInternet(): Boolean = cm.allNetworks.any { n ->
        val c = cm.getNetworkCapabilities(n) ?: return@any false
        !c.hasTransport(NetworkCapabilities.TRANSPORT_VPN) && c.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    /** Sockets, die garantiert über das WLAN gehen (am Tunnel vorbei). */
    fun wlanSockets(): SocketFactory? = wlan()?.socketFactory

    /** IPv4-Netze des WLANs, z. B. 192.168.178.23/24. */
    fun wlanAdressen(): List<Pair<Inet4Address, Int>> {
        val lp: LinkProperties = wlan()?.let { cm.getLinkProperties(it) } ?: return emptyList()
        return lp.linkAddresses.mapNotNull { la -> (la.address as? Inet4Address)?.let { it to la.prefixLength } }
    }

    companion object {
        fun erreichbar(adresse: String, port: Int, ms: Int, sockets: SocketFactory = SocketFactory.getDefault()): Boolean = runCatching {
            sockets.createSocket().use { s: Socket -> s.connect(InetSocketAddress(adresse, port), ms); true }
        }.getOrDefault(false)

        /** Alle Adressen eines /24 (bzw. der ersten 254 Adressen eines größeren Netzes). */
        fun kandidaten(netz: String): List<String> {
            val basis = netz.substringBefore('/').split('.').map { it.toInt() }
            return (1..254).map { "${basis[0]}.${basis[1]}.${basis[2]}.$it" }
        }
    }
}
