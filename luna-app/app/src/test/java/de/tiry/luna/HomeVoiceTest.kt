package de.tiry.luna

import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import okio.Buffer
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File
import java.nio.file.Files

/** Simulierter „Luna-Stimmserver v1“ (Vertrag mit der AIVOX-Sitzung). */
class HomeVoiceTest {
    private lateinit var server: MockWebServer
    private var lastBody = ""

    @Before fun up() {
        server = MockWebServer()
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(r: RecordedRequest): MockResponse {
                if (r.getHeader("Authorization") != "Bearer geheim") return MockResponse().setResponseCode(401).setBody("""{"error":"auth"}""")
                return when (r.path) {
                    "/health" -> MockResponse().setBody("""{"ok":true,"engine":"kartoffel-orpheus","voices":["Lena","Mia"],"tags":["laugh","sigh","chuckle"],"version":"1"}""")
                    "/tts" -> { lastBody = r.body.readUtf8(); MockResponse().setHeader("Content-Type", "audio/wav").setBody(Buffer().write(ByteArray(4000) { 1 })) }
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }
        server.start()
    }
    @After fun down() { server.shutdown() }

    private fun url() = server.url("/").toString().trimEnd('/')

    @Test fun gesundheitUndStimmen() {
        val h = HomeVoice(url(), "geheim").health()
        assertEquals("kartoffel-orpheus", h.engine); assertEquals(listOf("Lena", "Mia"), h.voices); assertTrue("laugh" in h.tags)
    }

    @Test fun spracheErzeugen() {
        val out = File(Files.createTempDirectory("hv").toFile(), "a.wav")
        HomeVoice(url(), "geheim").tts("Hallo Tiri.", "Mia", out, "Vorher.")
        assertEquals(4000L, out.length())
        val b = JSONObject(lastBody)
        assertEquals("Mia", b.getString("voice")); assertEquals("wav", b.getString("format")); assertEquals("Vorher.", b.getString("previous_text"))
    }

    @Test(expected = SecurityException::class) fun falscherSchluessel() { HomeVoice(url(), "falsch").health() }

    @Test fun tagsUmwandeln() {
        val tags = listOf("laugh", "sigh", "chuckle")
        assertEquals("<laugh> Na klar. <sigh> Wenn's sein muss.", HomeVoice.convertTags("[laughs] Na klar. [sighs] Wenn's sein muss.", tags))
        assertEquals("<chuckle> Wecker steht.", HomeVoice.convertTags("[chuckles] Wecker steht.", tags))
        assertEquals("Oh ja.", HomeVoice.convertTags("[sarcastic] Oh ja.", tags))         // kann der Server nicht → weg
        assertEquals("http://tiry-pc.fritz.box:5055", HomeVoice.urlFor("tiry-pc.fritz.box"))
    }
}
