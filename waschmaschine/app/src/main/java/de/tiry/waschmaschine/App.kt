package de.tiry.waschmaschine

import android.app.Application
import android.net.ConnectivityManager
import android.net.Network
import de.tiry.waschmaschine.kern.Planer
import de.tiry.waschmaschine.kern.Zentrale

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        // Absturzbericht: wird beim nächsten Start angezeigt, damit man den Grund ohne Kabel/PC sieht
        val vorher = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { t, e ->
            runCatching {
                java.io.File(filesDir, "absturz.txt").writeText(
                    "Version ${packageManager.getPackageInfo(packageName, 0).versionName} · Android ${android.os.Build.VERSION.RELEASE} · ${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL}\n\n" +
                        android.util.Log.getStackTraceString(e))
            }
            vorher?.uncaughtException(t, e)
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
