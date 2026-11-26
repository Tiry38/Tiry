package de.tiry.waschmaschine.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import de.tiry.waschmaschine.logik.PopupEinstellungen
import de.tiry.waschmaschine.logik.Status
import de.tiry.waschmaschine.logik.Tuer
import de.tiry.waschmaschine.logik.Weg
import de.tiry.waschmaschine.logik.WegEntscheidung
import de.tiry.waschmaschine.logik.Zustand
import de.tiry.waschmaschine.protokoll.Testgeraet
import de.tiry.waschmaschine.speicher.Favorit
import de.tiry.waschmaschine.speicher.VerlaufEintrag
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** Echte Bildschirmfotos der App (Robolectric, natives Rendering) – Handy 412 dp. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w412dp-h915dp-xxhdpi")
class BildschirmTest {
    @get:Rule val regel = createComposeRule()

    private val jetzt = 1_764_158_400_000L // 26.11.2026 ~13:00
    private val favs = listOf(Favorit("Baumwolle · 40 °C · 1400 U/min", 1, emptyMap()), Favorit("Pflegeleicht · 30 °C", 2, emptyMap()))

    private fun foto(name: String, ms: Long = 1400, inhalt: @Composable () -> Unit) {
        Darstellung.gpuWasser = false
        regel.mainClock.autoAdvance = false
        regel.setContent(inhalt)
        regel.mainClock.advanceTimeBy(ms)
        regel.onRoot().captureRoboImage("../bildschirme/$name.png")
    }

    @Test fun laeuftZuhause() = foto("01-laeuft-zuhause", 2600) {
        Startseite(Zustand(Status.LAEUFT, "Run", Tuer.VERRIEGELT, "Baumwolle", 1, 47 * 60, 58, temperatur = "40 °C", schleudern = "1400 U/min", eingeschaltet = true, fernstartErlaubt = true),
            WegEntscheidung(Weg.ZUHAUSE), false, "WM14UR5EM2", favs, java.util.TimeZone.getDefault().let { jetzt })
    }

    @Test fun fertigUnterwegs() = foto("02-fertig-unterwegs") {
        Startseite(Zustand(Status.FERTIG, "Finished", Tuer.ZU, "Pflegeleicht", 2, 0, 100, temperatur = "30 °C", schleudern = "1000 U/min", eingeschaltet = true),
            WegEntscheidung(Weg.UNTERWEGS), false, "WM14UR5EM2", favs, jetzt)
    }

    @Test fun fehler() = foto("03-fehler") {
        Startseite(Zustand(Status.FEHLER, "Error", Tuer.VERRIEGELT, "Baumwolle", 1, 1500, 31, fehler = listOf("LowWaterPressure"), eingeschaltet = true),
            WegEntscheidung(Weg.ZUHAUSE), false, "WM14UR5EM2", favs, jetzt)
    }

    @Test fun keineVerbindung() = foto("04-keine-verbindung") {
        Startseite(null, WegEntscheidung(Weg.KEINER, "Unterwegs ist noch nicht eingerichtet. Einmal den FRITZ!Box-QR-Code scannen."), false, "WM14UR5EM2", emptyList(), jetzt)
    }

    @Test fun bereit() = foto("05-bereit") {
        Startseite(Zustand(Status.BEREIT, "Ready", Tuer.ZU, "Baumwolle", 1, null, null, temperatur = "40 °C", schleudern = "1400 U/min", eingeschaltet = true, fernstartErlaubt = true),
            WegEntscheidung(Weg.ZUHAUSE), false, "WM14UR5EM2", favs, jetzt)
    }

    @Test fun steuern() = foto("06-steuern") { Steuern(Testgeraet.profil, false, {}, {}, {}) }

    @Test fun einrichtung1() = foto("07-einrichtung-1") { Einrichtung(EinrichtungsStand(1), {}, {}, {}, {}) }

    @Test fun einrichtung2() = foto("08-einrichtung-2") {
        Einrichtung(EinrichtungsStand(2, meldung = "Verbunden: SIEMENS WM14UR5EM2 unter 192.168.178.47."), {}, {}, {}, {})
    }

    @Test fun einstellungen() = foto("09-einstellungen") {
        Einstellungen(PopupEinstellungen(), {}, {}, true, {}, {}, "192.168.178.47")
    }

    @Test fun absturz() = foto("13-absturzbericht") {
        Absturzbericht("Version 1.0.2 · Android 15 · samsung SM-S921B\n\njava.lang.IllegalStateException: Beispiel\n\tat de.tiry.waschmaschine.MainActivity.onCreate(MainActivity.kt:42)", {}, {})
    }

    @Test fun verlauf() = foto("10-verlauf") {
        Verlauf(listOf(
            VerlaufEintrag("Baumwolle", jetzt - 3 * 3600_000, jetzt - 3600_000, "40 °C", "1400 U/min"),
            VerlaufEintrag("Pflegeleicht", jetzt - 30 * 3600_000, jetzt - 28 * 3600_000, "30 °C", "1000 U/min"),
            VerlaufEintrag("Super 15'", jetzt - 50 * 3600_000, jetzt - 49 * 3600_000 - 45 * 60_000, "30 °C", "800 U/min"),
        )) {}
    }
}

/** Kleines Handy (360 dp) – nichts darf abgeschnitten werden oder horizontal scrollen. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w360dp-h740dp-xhdpi")
class KleinesHandyTest {
    @get:Rule val regel = createComposeRule()
    @Test fun laeuftKlein() {
        Darstellung.gpuWasser = false
        regel.mainClock.autoAdvance = false
        regel.setContent {
            Startseite(Zustand(Status.LAEUFT, "Run", Tuer.VERRIEGELT, "Baumwolle", 1, 47 * 60, 58, temperatur = "40 °C", schleudern = "1400 U/min", eingeschaltet = true),
                WegEntscheidung(Weg.UNTERWEGS), false, "WM14UR5EM2", emptyList(), 1_764_158_400_000L)
        }
        regel.mainClock.advanceTimeBy(2000)
        regel.onRoot().captureRoboImage("../bildschirme/11-klein-360dp.png")
    }
}

/** Tablet hochkant (800 dp) als „großer Bildschirm“. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w800dp-h1280dp-xhdpi")
class TabletTest {
    @get:Rule val regel = createComposeRule()
    @Test fun laeuftTablet() {
        Darstellung.gpuWasser = false
        regel.mainClock.autoAdvance = false
        regel.setContent {
            Startseite(Zustand(Status.LAEUFT, "Run", Tuer.VERRIEGELT, "Baumwolle", 1, 47 * 60, 58, temperatur = "40 °C", schleudern = "1400 U/min", eingeschaltet = true),
                WegEntscheidung(Weg.ZUHAUSE), false, "WM14UR5EM2", emptyList(), 1_764_158_400_000L)
        }
        regel.mainClock.advanceTimeBy(2000)
        regel.onRoot().captureRoboImage("../bildschirme/12-tablet-800dp.png")
    }
}
