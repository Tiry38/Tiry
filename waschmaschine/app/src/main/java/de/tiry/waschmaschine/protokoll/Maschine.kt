package de.tiry.waschmaschine.protokoll

import de.tiry.waschmaschine.logik.Zustand
import de.tiry.waschmaschine.logik.ZustandsBauer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.json.JsonPrimitive
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import javax.net.SocketFactory
import kotlin.concurrent.thread

/**
 * Eine offene Verbindung zur Waschmaschine: liest im Hintergrund, hält den aktuellen [Zustand]
 * und bietet die Steuerbefehle an. Schließen mit [close].
 */
class Maschine private constructor(private val profil: GeraeteProfil, private val kanal: Kanal) : AutoCloseable {
    private val bauer = ZustandsBauer(profil)
    private val _zustand = MutableStateFlow<Zustand?>(null)
    val zustand: StateFlow<Zustand?> = _zustand
    private val bereit = CountDownLatch(1)
    @Volatile var beendetMit: Throwable? = null; private set
    @Volatile var offen = true; private set
    private val schreibbar = HashMap<Int, Boolean>()
    @Volatile var letzterFehlerCode: Int? = null; private set

    private val sitzung = HcSitzung(
        kanal,
        beiWerten = { w -> _zustand.value = bauer.uebernimm(w); bereit.countDown() },
        beiZugriff = { uid, zugriff, verfuegbar -> synchronized(schreibbar) { if (zugriff != null) schreibbar[uid] = zugriff.lowercase().contains("write") && verfuegbar != false } },
        beiFehlerCode = { _, code -> letzterFehlerCode = code },
    )

    private fun starte() {
        thread(isDaemon = true, name = "maschine-lesen") {
            try { sitzung.lauf() } catch (t: Throwable) { beendetMit = t } finally { offen = false; bereit.countDown(); runCatching { kanal.close() } }
        }
        thread(isDaemon = true, name = "maschine-ping") {
            while (offen) { Thread.sleep(25_000); if (offen) runCatching { kanal.ping() }.onFailure { close() } }
        }
    }

    /** Wartet, bis die ersten Werte da sind. */
    fun warteAufZustand(ms: Long = 10_000): Zustand? { bereit.await(ms, TimeUnit.MILLISECONDS); return _zustand.value }

    fun darfSchreiben(uid: Int) = synchronized(schreibbar) { schreibbar[uid] ?: true }

    private fun befehl(name: String) {
        val uid = profil.uidVon(name) ?: error("Die Maschine kennt den Befehl $name nicht.")
        sitzung.setzeWert(uid, JsonPrimitive(true))
    }
    fun pause() = befehl("BSH.Common.Command.PauseProgram")
    fun fortsetzen() = befehl("BSH.Common.Command.ResumeProgram")
    fun abbrechen() = befehl("BSH.Common.Command.AbortProgram")
    fun starte(programm: Int, optionen: Map<Int, Long>) = sitzung.starteProgramm(programm, optionen.mapValues { JsonPrimitive(it.value) })
    fun waehle(programm: Int, optionen: Map<Int, Long>) = sitzung.waehleProgramm(programm, optionen.mapValues { JsonPrimitive(it.value) })

    override fun close() { offen = false; runCatching { kanal.close() } }

    companion object {
        fun verbinde(profil: GeraeteProfil, adresse: String, sockets: SocketFactory = SocketFactory.getDefault(), zeitlimitMs: Int = 4000, port: Int = profil.port): Maschine =
            Maschine(profil, Verbindung.oeffne(profil, adresse, sockets, zeitlimitMs, port)).also { it.starte() }

        fun ueber(profil: GeraeteProfil, kanal: Kanal) = Maschine(profil, kanal).also { it.starte() }
    }
}
