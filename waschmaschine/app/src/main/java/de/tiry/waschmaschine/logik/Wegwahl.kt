package de.tiry.waschmaschine.logik

enum class Weg(val wort: String) { ZUHAUSE("Zuhause"), UNTERWEGS("Unterwegs"), KEINER("Keine Verbindung") }

data class WegEntscheidung(val weg: Weg, val hinweis: String? = null)

/**
 * Wählt den Weg zur Maschine: im Heim-WLAN direkt, sonst über den eingebauten WireGuard-Tunnel.
 * Die Prüfungen sind Funktionen, damit die Entscheidung ohne Netz testbar ist.
 */
class Wegwahl(
    private val imWlan: () -> Boolean,
    private val direktErreichbar: () -> Boolean,
    private val tunnelEingerichtet: () -> Boolean,
    private val tunnelHoch: () -> Boolean,
    private val ueberTunnelErreichbar: () -> Boolean,
    private val hatInternet: () -> Boolean,
) {
    fun waehle(): WegEntscheidung {
        if (imWlan() && direktErreichbar()) return WegEntscheidung(Weg.ZUHAUSE)
        if (!hatInternet()) return WegEntscheidung(Weg.KEINER, "Das Handy ist offline. Sobald Netz da ist, verbinde ich neu.")
        if (!tunnelEingerichtet()) return WegEntscheidung(
            Weg.KEINER,
            if (imWlan()) "Maschine im WLAN nicht gefunden. Ist sie eingeschaltet und mit dem WLAN verbunden?"
            else "Unterwegs ist noch nicht eingerichtet. Einmal den FRITZ!Box-QR-Code scannen."
        )
        if (!tunnelHoch()) return WegEntscheidung(Weg.KEINER, "Der Tunnel nach Hause steht nicht. Ist die FRITZ!Box online? Ich versuche es weiter.")
        if (!ueberTunnelErreichbar()) return WegEntscheidung(Weg.KEINER, "Zuhause erreicht, aber die Maschine antwortet nicht. Ist sie eingeschaltet?")
        return WegEntscheidung(Weg.UNTERWEGS)
    }
}
