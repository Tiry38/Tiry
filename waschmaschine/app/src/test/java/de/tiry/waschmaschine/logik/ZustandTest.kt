package de.tiry.waschmaschine.logik

import de.tiry.waschmaschine.protokoll.Testgeraet as T
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Test

class ZustandTest {
    private fun b() = ZustandsBauer(T.profil)
    private fun w(vararg p: Pair<Int, Any>) = p.associate { (u, v) -> u to (if (v is Number) JsonPrimitive(v) else JsonPrimitive(v.toString())) }

    @Test fun statusUebersetzung() {
        val bau = b()
        assertEquals(Status.AUS, bau.uebernimm(w(T.OPERATION to 0, T.POWER to 1)).status)
        assertEquals(Status.BEREIT, bau.uebernimm(w(T.OPERATION to 1, T.POWER to 2)).status)
        assertEquals(Status.LAEUFT, bau.uebernimm(w(T.OPERATION to 3)).status)
        assertEquals(Status.PAUSE, bau.uebernimm(w(T.OPERATION to 4)).status)
        assertEquals(Status.FERTIG, bau.uebernimm(w(T.OPERATION to 6)).status)
        assertEquals(Status.FEHLER, bau.uebernimm(w(T.OPERATION to 7)).status)
    }

    @Test fun aquastopIstFehlerAuchWennBetriebsartLaeuft() {
        val z = b().uebernimm(w(T.OPERATION to 3, T.AQUASTOP to 1))
        assertEquals(Status.FEHLER, z.status); assertEquals(listOf("AquaStopOccured"), z.fehler)
        assertEquals(emptyList<String>(), b().uebernimm(w(T.OPERATION to 3, T.AQUASTOP to 0)).fehler)
    }

    @Test fun fertigUmUndTexte() {
        val z = b().uebernimm(w(T.OPERATION to 3, T.REST to 3600, T.AKTIV to T.BAUMWOLLE, T.TEMP to 60, T.SCHLEUDER to 0))
        assertEquals(1_000L + 3_600_000L, z.fertigUm(1_000L))
        assertEquals("Baumwolle", z.programm); assertEquals("60 °C", z.temperatur); assertEquals("ohne", z.schleudern)
        assertEquals("1:00 h", Texte.dauer(3600)); assertEquals("9 min", Texte.dauer(530))
        assertEquals("Power Speed 59'", Texte.programm("LaundryCare.Washer.Program.PowerSpeed59"))
        assertEquals("Dunkle Wäsche", Texte.programm("LaundryCare.Washer.Program.DarkWash"))
    }
}
