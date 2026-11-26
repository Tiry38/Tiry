package de.tiry.waschmaschine.protokoll

import de.tiry.waschmaschine.logik.Status
import de.tiry.waschmaschine.logik.Tuer
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ProtokollTest {
    private fun hex(s: String) = s.chunked(2).map { it.toInt(16).toByte() }.toByteArray()

    // Referenzwerte erzeugt mit hcpy-Algorithmus in Python/pycryptodome (Polster = Nullen)
    @Test fun aesKanalStimmtBitgenauMitHcpyUeberein() {
        val k = HcAesKanal(HcAesKanal.b64(Testgeraet.SCHLUESSEL), HcAesKanal.b64(Testgeraet.IV), zufall = { ByteArray(it) })
        assertEquals("ce500b5518ec0899e8476ae35a2d3303374765ebe7890c3a33532a5417a9a24d1a925a34413dee2020df02f474fe53bf",
            k.verschluesseln("""{"sID":1,"msgID":5}""").toHex())
        assertEquals("656e109e30382e9caf013df120331c76c6eccba9623ae2ce5d5d54068313fb70e1c06a8b4b1fe3842e876603b70ff847",
            k.verschluesseln("x".repeat(15)).toHex())
        assertEquals("df690ca5b236fec6d5ca4db86568b2946fa0c939d0d8e82bc6d4ac1d455650a6398e1fb7eee55e10b60990c8d34e8652",
            k.verschluesseln("Waschmaschine läuft").toHex())
        assertEquals("""{"resource":"/ei/initialValues"}""",
            k.entschluesseln(hex("95ca9e819f471cfa3cac1ff64bf4976d33457fe8cbd8a80561978f7e0b250c1b2ae58f9d62fe4f4090491e57ffb836d763010798d3c568c8cf0f9e06cde9b234")))
        assertEquals("zwei", k.entschluesseln(hex("619fc82646f8746fd5dc63f5f0084dd677c35b128c6a48fcac5cb39486961454")))
    }

    @Test fun manipulierteNachrichtWirdVerworfen() {
        val k = HcAesKanal(HcAesKanal.b64(Testgeraet.SCHLUESSEL), HcAesKanal.b64(Testgeraet.IV))
        val b = hex("619fc82646f8746fd5dc63f5f0084dd677c35b128c6a48fcac5cb39486961454"); b[3] = (b[3] + 1).toByte()
        assertNull(k.entschluesseln(b))
    }

    @Test fun beschreibungWirdGelesen() {
        val p = Testgeraet.profil
        assertEquals("BSH.Common.Status.OperationState", p.merkmale[Testgeraet.OPERATION]!!.name)
        assertEquals("BSH.Common.EnumType.OperationState.Run", p.merkmale[Testgeraet.OPERATION]!!.werte!![3])
        assertEquals(listOf(Testgeraet.BAUMWOLLE, Testgeraet.PFLEGELEICHT), p.programme.map { it.uid })
        assertEquals(listOf(Testgeraet.TEMP, Testgeraet.SCHLEUDER), p.programme[0].optionen)
        assertEquals(Testgeraet.PAUSE, p.uidVon("PauseProgram"))
        assertEquals(p, GeraeteProfil.ausJson(p.alsJson()))
    }

    private fun startwerte() = mutableMapOf<Int, Any>(
        Testgeraet.OPERATION to 1, Testgeraet.TUER to 1, Testgeraet.POWER to 2, Testgeraet.REST to 0,
        Testgeraet.GEWAEHLT to Testgeraet.BAUMWOLLE, Testgeraet.TEMP to 40, Testgeraet.SCHLEUDER to 1400,
        Testgeraet.WASSERDRUCK to 0, Testgeraet.FERNSTART to true,
    )

    @Test fun tlsPskEndeZuEndeMitSimulierterMaschine() = endeZuEnde(Testgeraet.profil)
    @Test fun aesHmacEndeZuEndeMitSimulierterMaschine() = endeZuEnde(Testgeraet.profilAes)

    private fun endeZuEnde(profil: GeraeteProfil) {
        val werte = startwerte()
        SimulierteMaschine(profil.copy(), werte).use { sim ->
            val p = profil.copy()
            val m = Maschine.verbinde(p, "127.0.0.1", port = sim.port)
            m.use {
                val z = m.warteAufZustand()!!
                assertEquals(Status.BEREIT, z.status)
                assertEquals(Tuer.ZU, z.tuer)
                assertEquals("Baumwolle", z.programm)
                assertEquals("40 °C", z.temperatur)
                assertEquals("1400 U/min", z.schleudern)
                assertTrue(z.fernstartErlaubt)

                // Handschlag wie hcpy: Antwort auf initialValues, Dienste, deviceReady (v2), Pflichtwerte
                val antwort = sim.warteAufAnfrage("/ei/initialValues")
                assertEquals("RESPONSE", antwort["action"]!!.jsonPrimitive.content)
                assertEquals(900, antwort["msgID"]!!.jsonPrimitive.int)
                assertEquals(1200, sim.warteAufAnfrage("/ci/services")["msgID"]!!.jsonPrimitive.int)
                assertEquals(2, sim.warteAufAnfrage("/ei/deviceReady")["version"]!!.jsonPrimitive.int)
                sim.warteAufAnfrage("/iz/info")

                // Gerät startet → Läuft mit Restzeit
                sim.aendere(Testgeraet.OPERATION to 3, Testgeraet.TUER to 2, Testgeraet.AKTIV to Testgeraet.BAUMWOLLE, Testgeraet.REST to 5400, Testgeraet.FORTSCHRITT to 12)
                val l = warte(m) { it.status == Status.LAEUFT && it.restSek == 5400L }
                assertEquals(Tuer.VERRIEGELT, l.tuer); assertEquals(12, l.fortschritt)

                // Befehl Pause geht als POST /ro/values mit uid zuerst
                m.pause()
                val post = sim.warteAufAnfrage("/ro/values")
                assertEquals("POST", post["action"]!!.jsonPrimitive.content)
                val d = post["data"]!!.jsonArray[0].jsonObject
                assertEquals(listOf("uid", "value"), d.keys.toList())
                assertEquals(Testgeraet.PAUSE, d["uid"]!!.jsonPrimitive.int)

                // Programm starten
                m.starte(Testgeraet.PFLEGELEICHT, mapOf(Testgeraet.TEMP to 40L))
                val s = sim.warteAufAnfrage("/ro/activeProgram")["data"]!!.jsonArray[0].jsonObject
                assertEquals(Testgeraet.PFLEGELEICHT, s["program"]!!.jsonPrimitive.int)

                // Fertig
                sim.aendere(Testgeraet.OPERATION to 6, Testgeraet.REST to 0, Testgeraet.FORTSCHRITT to 100, Testgeraet.TUER to 1)
                warte(m) { it.status == Status.FERTIG }
            }
        }
    }

    @Test fun falscherSchluesselScheitertSauber() {
        SimulierteMaschine(Testgeraet.profil, startwerte()).use { sim ->
            sim.falscherSchluessel = true
            val r = runCatching { Maschine.verbinde(Testgeraet.profil, "127.0.0.1", port = sim.port).use { it.warteAufZustand(2000) } }
            assertTrue(r.isFailure || r.getOrNull() == null)
        }
    }

    private fun warte(m: Maschine, bed: (de.tiry.waschmaschine.logik.Zustand) -> Boolean): de.tiry.waschmaschine.logik.Zustand {
        val ende = System.currentTimeMillis() + 5000
        while (System.currentTimeMillis() < ende) { m.zustand.value?.takeIf(bed)?.let { return it }; Thread.sleep(20) }
        error("Zustand nicht erreicht: ${m.zustand.value}")
    }

    private fun ByteArray.toHex() = joinToString("") { "%02x".format(it) }
}
