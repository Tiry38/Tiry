package de.tiry.waschmaschine.logik

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WegUndTunnelTest {
    private fun wahl(wlan: Boolean, direkt: Boolean, tunnel: Boolean = true, hoch: Boolean = true, ueber: Boolean = true, netz: Boolean = true) =
        Wegwahl({ wlan }, { direkt }, { tunnel }, { hoch }, { ueber }, { netz }).waehle()

    @Test fun zuhauseImWlanDirekt() = assertEquals(Weg.ZUHAUSE, wahl(wlan = true, direkt = true).weg)
    @Test fun unterwegsUeberTunnel() = assertEquals(Weg.UNTERWEGS, wahl(wlan = false, direkt = false).weg)
    @Test fun fremdesWlanNimmtTunnel() = assertEquals(Weg.UNTERWEGS, wahl(wlan = true, direkt = false).weg)

    @Test fun umschaltenZuhauseUnterwegsUndZurueck() {
        var wlan = true; var direkt = true; var tunnelGefragt = 0
        val w = Wegwahl({ wlan }, { direkt }, { true }, { tunnelGefragt++; true }, { true }, { true })
        assertEquals(Weg.ZUHAUSE, w.waehle().weg); assertEquals(0, tunnelGefragt)
        wlan = false; direkt = false
        assertEquals(Weg.UNTERWEGS, w.waehle().weg); assertEquals(1, tunnelGefragt)
        wlan = true; direkt = true
        assertEquals(Weg.ZUHAUSE, w.waehle().weg); assertEquals(1, tunnelGefragt)
    }

    @Test fun klareSaetzeWennNichtsGeht() {
        assertEquals("Unterwegs ist noch nicht eingerichtet. Einmal den FRITZ!Box-QR-Code scannen.", wahl(false, false, tunnel = false).hinweis)
        assertTrue(wahl(false, false, netz = false).hinweis!!.contains("offline"))
        assertTrue(wahl(false, false, hoch = false).hinweis!!.contains("FRITZ!Box"))
        assertTrue(wahl(false, false, ueber = false).hinweis!!.contains("eingeschaltet"))
    }

    private val fritz = """
        [Interface]
        PrivateKey = cGxhY2Vob2xkZXJwcml2YXRla2V5cGxhY2Vob2xkZXI=
        Address = 192.168.178.201/24
        DNS = 192.168.178.1
        DNS = fritz.box

        [Peer]
        PublicKey = cGxhY2Vob2xkZXJwdWJsaWNrZXlwbGFjZWhvbGRlcjE=
        PresharedKey = cGxhY2Vob2xkZXJwcmVzaGFyZWRrZXlwbGFjZWhvbGQ=
        AllowedIPs = 192.168.178.0/24,0.0.0.0/0
        Endpoint = abcdefghijkl.myfritz.net:51820
        PersistentKeepalive = 25
    """.trimIndent()

    @Test fun fritzBoxKonfigWirdZumSplitTunnelNurFuerDieseApp() {
        val e = WireGuardImport.alsSplitTunnel(fritz, "de.tiry.waschmaschine")
        assertEquals(listOf("192.168.178.0/24"), e.heimnetze)
        assertFalse(e.konfig.contains("0.0.0.0/0"))
        assertFalse(e.konfig.contains("DNS"))
        assertTrue(e.konfig.contains("IncludedApplications = de.tiry.waschmaschine"))
        assertTrue(e.konfig.contains("PresharedKey = "))
        assertEquals("abcdefghijkl.myfritz.net:51820", e.endpunkt)
    }

    @Test fun vollerTunnelOhneHeimnetzBekommtNetzAusAdresse() {
        val e = WireGuardImport.alsSplitTunnel(fritz.replace("AllowedIPs = 192.168.178.0/24,0.0.0.0/0", "AllowedIPs = 0.0.0.0/0, ::/0"), "x")
        assertEquals(listOf("192.168.178.0/24"), e.heimnetze)
    }

    @Test fun unsinnWirdVerstaendlichAbgelehnt() {
        val f = runCatching { WireGuardImport.alsSplitTunnel("https://example.org", "x") }.exceptionOrNull()
        assertTrue(f is WireGuardImport.Fehler && f.message!!.contains("QR-Code"))
        val ohneEndpunkt = runCatching { WireGuardImport.alsSplitTunnel(fritz.lines().filterNot { it.startsWith("Endpoint") }.joinToString("\n"), "x") }.exceptionOrNull()
        assertTrue(ohneEndpunkt!!.message!!.contains("MyFRITZ"))
    }

    @Test fun kompakteSchreibweiseUndBomWerdenGelesen() {
        val kompakt = "\uFEFF" + fritz.lines().joinToString("\r\n") { it.replace(" = ", "=") }
        val e = WireGuardImport.alsSplitTunnel(kompakt, "x")
        assertEquals(listOf("192.168.178.0/24"), e.heimnetze)
        assertEquals("abcdefghijkl.myfritz.net:51820", e.endpunkt)
    }

    @Test fun privateNetze() {
        assertTrue(WireGuardImport.istPrivat("10.0.0.0/8")); assertTrue(WireGuardImport.istPrivat("172.20.1.0/24"))
        assertFalse(WireGuardImport.istPrivat("0.0.0.0/0")); assertFalse(WireGuardImport.istPrivat("8.8.8.8/32"))
        assertEquals("192.168.0.0/16", WireGuardImport.netzVon("192.168.5.7/16"))
    }
}
