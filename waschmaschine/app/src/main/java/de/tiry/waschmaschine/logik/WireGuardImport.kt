package de.tiry.waschmaschine.logik

/**
 * Nimmt die WireGuard-Konfiguration der FRITZ!Box (QR-Code oder .conf) und macht daraus einen
 * reinen Heimnetz-Tunnel: nur private Netze, nur Verkehr dieser App, kein fremder DNS.
 */
object WireGuardImport {
    data class Ergebnis(val konfig: String, val heimnetze: List<String>, val endpunkt: String)

    class Fehler(meldung: String) : Exception(meldung)

    fun alsSplitTunnel(roh: String, paket: String): Ergebnis {
        val text = roh.replace("\uFEFF", "").replace("\r", "").trim()
        if (!text.contains("[Interface]", true) || !text.contains("[Peer]", true))
            throw Fehler("Das ist keine WireGuard-Konfiguration. Bitte den QR-Code aus der FRITZ!Box scannen.")
        val abschnitte = ArrayList<Pair<String, MutableList<Pair<String, String>>>>()
        for (zeile in text.lines()) {
            val z = zeile.substringBefore('#').trim()
            if (z.isEmpty()) continue
            if (z.startsWith("[")) { abschnitte += z to mutableListOf(); continue }
            val k = z.substringBefore('=').trim(); val v = z.substringAfter('=', "").trim()
            abschnitte.lastOrNull()?.second?.add(k to v) ?: throw Fehler("Konfiguration beginnt nicht mit [Interface].")
        }
        val iface = abschnitte.firstOrNull { it.first.equals("[Interface]", true) }?.second ?: throw Fehler("[Interface] fehlt.")
        val peer = abschnitte.firstOrNull { it.first.equals("[Peer]", true) }?.second ?: throw Fehler("[Peer] fehlt.")
        fun werte(l: List<Pair<String, String>>, k: String) = l.filter { it.first.equals(k, true) }.flatMap { it.second.split(',') }.map { it.trim() }.filter { it.isNotEmpty() }

        val privat = werte(iface, "PrivateKey").firstOrNull() ?: throw Fehler("PrivateKey fehlt.")
        val adressen = werte(iface, "Address")
        if (adressen.isEmpty()) throw Fehler("Address fehlt.")
        val pub = werte(peer, "PublicKey").firstOrNull() ?: throw Fehler("PublicKey der FRITZ!Box fehlt.")
        val endpunkt = werte(peer, "Endpoint").firstOrNull() ?: throw Fehler("Endpoint fehlt – in der FRITZ!Box MyFRITZ! oder DynDNS aktivieren.")
        val psk = werte(peer, "PresharedKey").firstOrNull()
        val keep = werte(peer, "PersistentKeepalive").firstOrNull()

        val netze = werte(peer, "AllowedIPs").filter(::istPrivat).toMutableList()
        if (netze.none { !it.contains(':') }) adressen.filter { !it.contains(':') }.mapNotNull(::netzVon).forEach { netze += it }
        val heim = netze.distinct()
        if (heim.isEmpty()) throw Fehler("Kein Heimnetz in der Konfiguration gefunden.")

        val k = buildString {
            appendLine("[Interface]")
            appendLine("PrivateKey = $privat")
            appendLine("Address = ${adressen.joinToString(", ")}")
            appendLine("IncludedApplications = $paket")
            appendLine()
            appendLine("[Peer]")
            appendLine("PublicKey = $pub")
            if (psk != null) appendLine("PresharedKey = $psk")
            appendLine("AllowedIPs = ${heim.joinToString(", ")}")
            appendLine("Endpoint = $endpunkt")
            appendLine("PersistentKeepalive = ${keep ?: "25"}")
        }
        return Ergebnis(k, heim, endpunkt)
    }

    fun istPrivat(cidr: String): Boolean {
        val ip = cidr.substringBefore('/')
        if (ip.contains(':')) return ip.lowercase().let { it.startsWith("fd") || it.startsWith("fc") }
        val o = ip.split('.').mapNotNull { it.toIntOrNull() }
        if (o.size != 4) return false
        val praefix = cidr.substringAfter('/', "32").toIntOrNull() ?: 32
        if (praefix < 8) return false
        return o[0] == 10 || (o[0] == 172 && o[1] in 16..31) || (o[0] == 192 && o[1] == 168)
    }

    /** 192.168.178.201/24 → 192.168.178.0/24 */
    fun netzVon(adresse: String): String? {
        val ip = adresse.substringBefore('/')
        val p = adresse.substringAfter('/', "24").toIntOrNull() ?: 24
        val o = ip.split('.').mapNotNull { it.toIntOrNull() }
        if (o.size != 4 || p !in 8..30) return null
        val zahl = o.fold(0L) { a, b -> (a shl 8) or b.toLong() }
        val maske = (0xffffffffL shl (32 - p)) and 0xffffffffL
        val n = zahl and maske
        return "${(n shr 24) and 255}.${(n shr 16) and 255}.${(n shr 8) and 255}.${n and 255}/$p".takeIf { istPrivat(it) }
    }
}
