package de.tiry.luna

import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File
import java.nio.file.Files
import java.util.Base64

class CloudVoiceTest {
    private lateinit var server: MockWebServer
    @Before fun up() { server = MockWebServer(); server.start() }
    @After fun down() { server.shutdown() }

    private fun ok() = MockResponse().setBody(JSONObject().put("audioContent", Base64.getEncoder().encodeToString(ByteArray(3000) { 7 })).toString())
    private fun out() = File(Files.createTempDirectory("cv").toFile(), "a.mp3")

    @Test fun anfrageWieGoogleDoku() {
        server.enqueue(ok())
        val f = out()
        CloudVoice("key123", "de.tiry.luna", "ABCD", server.url("/v1/text:synthesize").toString()).tts("[sighs] Na gut… Wecker steht.", "Kore", f)
        assertEquals(3000L, f.length())
        val r = server.takeRequest()
        assertEquals("key123", r.getHeader("x-goog-api-key"))
        assertEquals("de.tiry.luna", r.getHeader("X-Android-Package")); assertEquals("ABCD", r.getHeader("X-Android-Cert"))
        val b = JSONObject(r.body.readUtf8())
        assertEquals("[pause] Na gut… Wecker steht.", b.getJSONObject("input").getString("markup"))
        assertEquals("de-DE-Chirp3-HD-Kore", b.getJSONObject("voice").getString("name"))
        assertEquals("de-DE", b.getJSONObject("voice").getString("languageCode"))
        assertEquals("MP3", b.getJSONObject("audioConfig").getString("audioEncoding"))
    }

    @Test fun rueckfallAufTextWennMarkupAbgelehnt() {
        server.enqueue(MockResponse().setResponseCode(400).setBody("""{"error":{"message":"Invalid input: markup is not supported"}}"""))
        server.enqueue(ok())
        CloudVoice("k", endpoint = server.url("/x").toString()).tts("[laughs] Hallo.", "Aoede", out())
        server.takeRequest()
        val b = JSONObject(server.takeRequest().body.readUtf8())
        assertEquals("Hallo.", b.getJSONObject("input").getString("text"))
    }

    @Test fun falscherSchluessel() {
        server.enqueue(MockResponse().setResponseCode(403).setBody("""{"error":{"message":"API key not valid"}}"""))
        try { CloudVoice("x", endpoint = server.url("/x").toString()).tts("Hi", "Aoede", out()); throw AssertionError() }
        catch (e: SecurityException) { assertTrue(e.message!!.contains("abgelehnt")) }
    }
}
