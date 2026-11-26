package de.tiry.waschmaschine.protokoll

import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test

/** Läuft nur mit KREUZTEST=1: prüft unseren TLS-PSK-Client gegen einen OpenSSL-Server (wie im Gerät). */
class OpenSslKreuzTest {
    @Test fun bouncyCastleKlientSprichtMitOpenSsl() {
        assumeTrue(System.getenv("KREUZTEST") == "1")
        val k = Verbindung.oeffne(Testgeraet.profil, "127.0.0.1", port = 47443)
        val erste = k.empfange()!!
        assertTrue(erste.contains("/ei/initialValues"))
        k.sende("""{"sID":1,"msgID":2,"resource":"/ei/initialValues","version":2,"action":"RESPONSE","data":[{"deviceType":"Application"}]}""")
        Thread.sleep(300); k.close()
    }
}
