package de.tiry.waschmaschine

import android.app.Application
import android.net.ConnectivityManager
import android.net.Network
import de.tiry.waschmaschine.kern.Planer
import de.tiry.waschmaschine.kern.Zentrale
import org.bouncycastle.jce.provider.BouncyCastleProvider
import java.security.Security

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        if (Security.getProvider("BC")?.javaClass != BouncyCastleProvider::class.java) {
            Security.removeProvider("BC"); Security.addProvider(BouncyCastleProvider())
        }
        val z = Zentrale.von(this)
        if (z.ablage.profil != null) Planer.regelmaessig(this)
        // Netzwechsel (WLAN ↔ Mobil) → sofort neu wählen: Zuhause oder Unterwegs
        // Nur echtes WLAN beobachten (nicht den eigenen Tunnel), sonst würde der Tunnel selbst ein Neuverbinden auslösen
        val wlan = android.net.NetworkRequest.Builder().addTransportType(android.net.NetworkCapabilities.TRANSPORT_WIFI).build()
        getSystemService(ConnectivityManager::class.java).registerNetworkCallback(wlan, object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(n: Network) = z.neuVerbinden()
            override fun onLost(n: Network) = z.neuVerbinden()
        })
    }
}
