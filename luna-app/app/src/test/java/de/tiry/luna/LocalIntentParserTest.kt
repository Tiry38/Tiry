package de.tiry.luna

import org.json.JSONArray
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LocalIntentParserTest {
    private fun p(s: String) = LocalIntentParser.parse(s)

    @Test fun zeit() { assertEquals("get_time", p("Wie spät ist es?")!!.tool) }
    @Test fun akku() { assertEquals("get_device_status", p("Wie voll ist mein Akku")!!.tool) }

    @Test fun taschenlampe() {
        assertEquals(true, p("Taschenlampe an")!!.args["on"])
        assertEquals(false, p("Mach die Taschenlampe aus")!!.args["on"])
    }

    @Test fun timer() {
        assertEquals(600, p("Stell einen Timer auf 10 Minuten")!!.args["seconds"])
        assertEquals(600, p("Timer zehn Minuten")!!.args["seconds"])
        assertEquals(1800, p("Timer halbe Stunde")!!.args["seconds"])
        assertEquals(5400, p("Timer 1 Stunde 30 Minuten")!!.args["seconds"])
    }

    @Test fun wecker() {
        val c = p("Weck mich morgen um 6:30")!!
        assertEquals("set_alarm", c.tool); assertEquals(6, c.args["hour"]); assertEquals(30, c.args["minute"])
        assertEquals(7, p("Stell den Wecker auf 7 Uhr")!!.args["hour"])
        val h = p("Wecker auf halb acht")!!
        assertEquals(7, h.args["hour"]); assertEquals(30, h.args["minute"])
    }

    @Test fun anrufen() {
        assertEquals("mama", p("Ruf Mama an")!!.args["name"])
        assertEquals("stefan", p("Stefan anrufen")!!.args["name"])
    }

    @Test fun apps() {
        assertEquals("whatsapp", p("Öffne WhatsApp")!!.args["name"])
        assertEquals("spotify", p("Spotify öffnen")!!.args["name"])
        assertEquals("youtube", p("Starte mal YouTube")!!.args["name"])
    }

    @Test fun musik() {
        assertEquals("next", p("Nächstes Lied")!!.args["action"])
        assertEquals("pause", p("Pause")!!.args["action"])
        assertEquals("play_music", p("Spiel Linkin Park")!!.tool)
    }

    @Test fun lautstaerke() {
        assertEquals(40, p("Lautstärke auf 40")!!.args["level"])
        assertEquals("up", p("Mach lauter")!!.args["change"])
    }

    @Test fun erinnerung() {
        val c = p("Erinnere mich in 20 Minuten an die Wäsche")!!
        assertEquals("set_reminder", c.tool); assertEquals(20, c.args["in_minutes"]); assertEquals("die wäsche", c.args["text"])
    }

    @Test fun navigation() { assertEquals("karlsruhe", p("Navigiere nach Karlsruhe")!!.args["destination"]) }
    @Test fun wetter() {
        assertEquals("get_weather", p("Wie wird das Wetter morgen")!!.tool)
        assertEquals("berlin", p("Wie ist das Wetter in Berlin")!!.args["location"])
    }
    @Test fun ende() { assertEquals("end_conversation", p("Danke Luna")!!.tool); assertEquals("end_conversation", p("Passt, danke")!!.tool) }
    @Test fun merken() { assertEquals("ich habe montags beintag", p("Merk dir, ich habe montags Beintag")!!.args["fact"]) }
    @Test fun system() {
        assertEquals("lock", p("Sperr das Handy")!!.args["action"])
        assertEquals("screenshot", p("Mach einen Screenshot")!!.args["action"])
        assertEquals("back", p("Zurück")!!.args["action"])
    }
    @Test fun heimnetz() {
        assertEquals("pc_wake", p("Mach meinen PC an")!!.tool)
        assertEquals("pc_wake", p("Fahr den Rechner hoch")!!.tool)
        assertEquals("pc_remote", p("Ich will meinen PC fernsteuern")!!.tool)
        assertEquals("pc_remote", p("Mach den PC an und verbinde mich per Remote")!!.tool)
        assertEquals("pc_status", p("Ist mein PC an?")!!.tool)
        assertEquals(true, p("Gast-WLAN an")!!.args["on"])
        assertEquals(false, p("Schalte das Gastwlan aus")!!.args["on"])
        assertEquals("fritz_devices", p("Wer ist im WLAN?")!!.tool)
        assertEquals("fritz_calls", p("Wer hat mich angerufen")!!.tool)
        assertEquals(true, p("Verbinde VPN")!!.args["on"])
    }

    @Test fun unbekannt() { assertNull(p("Erklär mir Quantenphysik in einfachen Worten")) }

    @Test fun wakeWord() {
        fun w(text: String, conf: Double) = JSONArray(text.split(" ").map { mapOf("word" to it, "conf" to conf) })
        assertTrue(WakeWordEngine.isWake("hey lu na", w("hey lu na", 0.9), 6, false))
        assertTrue(WakeWordEngine.isWake("lu na", w("lu na", 0.85), 6, false))
        assertFalse(WakeWordEngine.isWake("lu na", w("lu na", 0.85), 6, true))      // „Hey“ Pflicht
        assertFalse(WakeWordEngine.isWake("lu na", w("lu na", 0.5), 6, false))      // zu unsicher
        assertTrue(WakeWordEngine.isWake("hey lu na", w("hey lu na", 0.65), 6, false)) // mit Hey toleranter
        assertFalse(WakeWordEngine.isWake("[unk]", null, 10, false))
        assertFalse(WakeWordEngine.isWake("lu ey na", w("lu ey na", 1.0), 10, false))     // nicht direkt hintereinander
        assertFalse(WakeWordEngine.isWake("hallo zusammen", w("hallo zusammen", 1.0), 10, false))
        // Nur erwähnt statt angesprochen → Luna bleibt still
        assertFalse(WakeWordEngine.isWake("ich hab lu na gebaut", w("ich hab lu na gebaut", 1.0), 6, false))
        assertFalse(WakeWordEngine.isWake("also hey lu na mach", w("also hey lu na mach", 0.9), 6, false))
        // Gezielt angesprochen
        assertFalse(WakeWordEngine.isWake("lu na ist echt cool geworden", w("lu na ist echt cool geworden", 0.9), 6, false))
        assertTrue(WakeWordEngine.isWake("hey lu na mach das licht an", w("hey lu na mach das licht an", 0.9), 6, false))
        assertTrue(WakeWordEngine.isWake("ok lu na", w("ok lu na", 0.9), 6, true))
        // Laufendes Gespräch (Pause < 1,5 s): „Luna“ allein reicht nicht, „Hey Luna“ schon
        assertFalse(WakeWordEngine.isWake("lu na", w("lu na", 0.95), 6, false, gapSec = 0.6))
        assertTrue(WakeWordEngine.isWake("hey lu na", w("hey lu na", 0.95), 6, false, gapSec = 0.6))
        // Lange Erzählung über Luna ohne „Hey“
        assertFalse(WakeWordEngine.isWake("lu na ist eine app die ich selbst gebaut habe", w("lu na ist eine app die ich selbst gebaut habe", 1.0), 6, false))
    }

    @Test fun updateErkennen() {
        assertEquals("update_luna", p("Luna, update dich")!!.tool)
        assertEquals(7, Updater.codeOf("luna-v1.0.7"))
        assertEquals(null, Updater.codeOf("v1.0.3"))
        val json = """[{"tag_name":"v1.0.3","assets":[{"name":"x.exe","browser_download_url":"u"}]},
            {"tag_name":"luna-v1.0.6","name":"Luna 1.0.6","assets":[{"name":"Luna-1.0.6.apk","browser_download_url":"https://a/6.apk"}]},
            {"tag_name":"luna-v1.0.12","name":"Luna 1.0.12","assets":[{"name":"Luna-1.0.12.apk","browser_download_url":"https://a/12.apk"}]}]"""
        val r = Updater.newest(json)!!
        assertEquals(12, r.versionCode); assertEquals("https://a/12.apk", r.apkUrl)
    }

    @Test fun weiblicheStimmeErkennen() {
        assertEquals(2, Speaker.femaleScore("de-DE-SMTf00"))
        assertEquals(0, Speaker.femaleScore("de-DE-SMTm00"))
        assertEquals(2, Speaker.femaleScore("de-de-x-deb#female_1-local"))
        assertEquals(0, Speaker.femaleScore("de-de-x-deb#male_2-local"))
        assertEquals(1, Speaker.femaleScore("de-de-x-dea-network"))
    }

    @Test fun unterbrechenErkennen() {
        // Echo von Lunas Stimme (gleichmäßig ~400) → nie Unterbrechung
        val echo = BargeIn.Detector()
        assertFalse((0 until 300).any { echo.feed(380.0 + (it % 7) * 10) })
        // Tiry redet dazwischen: deutlich lauter, länger als 0,2 s → Unterbrechung
        val talk = BargeIn.Detector()
        repeat(40) { talk.feed(400.0) }
        assertFalse((0 until 5).any { talk.feed(2500.0) })      // kurzer Knall/Klopfen reicht nicht
        repeat(3) { talk.feed(400.0) }
        assertTrue((0 until 12).any { talk.feed(2500.0) })
    }

    @Test fun emotionsTags() {
        assertEquals("Oh ja, natürlich. Wecker steht.", Speaker.stripTags("[sarcastic] Oh ja, natürlich. [chuckles] Wecker steht."))
        assertEquals("Hallo", Speaker.stripTags("Hallo"))
    }

    @Test fun sprachTextBereinigen() {
        assertEquals("Hallo Tiry! Super.", Speaker.clean("**Hallo** Tiry! 😀 Super."))
    }
}
