package de.tiry.luna

import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/** Kompletter Werkzeug-Ablauf gegen einen simulierten Claude-Server: tool_use → Ausführung → tool_result → Antwort. */
class ClaudeBrainTest {
    private lateinit var server: MockWebServer

    private class FakeTools : ToolExecutor {
        val calls = mutableListOf<Pair<String, Map<String, Any?>>>()
        override var endRequested = false
        override fun run(name: String, a: Map<String, Any?>): String {
            calls += name to a
            if (name == "end_conversation") endRequested = true
            return if (name == "set_timer") "Timer über 10 Minuten läuft." else "ok"
        }
    }

    private fun json(body: String) = MockResponse().setHeader("Content-Type", "application/json").setBody(body)

    @Before fun up() { server = MockWebServer(); server.start() }
    @After fun down() { server.shutdown() }

    private val cfg = BrainConfig("sk-test", Prefs.MODEL_OPUS, "Tiry", "Ich bin Tiry.", "Wörth am Rhein", "--- /memories/tiry.md ---\n- Montag ist Beintag")

    @Test fun werkzeugSchleife() {
        server.enqueue(json("""{"id":"msg_1","type":"message","role":"assistant","model":"claude-opus-5-5",
            "content":[{"type":"thinking","thinking":"","signature":"sig123"},
                       {"type":"text","text":"Klar, mach ich."},
                       {"type":"tool_use","id":"toolu_1","name":"set_timer","input":{"seconds":600}}],
            "stop_reason":"tool_use","stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":5}}"""))
        server.enqueue(json("""{"id":"msg_2","type":"message","role":"assistant","model":"claude-opus-5-5",
            "content":[{"type":"text","text":"Dein Timer läuft, zehn Minuten."},
                       {"type":"tool_use","id":"toolu_2","name":"end_conversation","input":{}}],
            "stop_reason":"tool_use","stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":5}}"""))
        server.enqueue(json("""{"id":"msg_3","type":"message","role":"assistant","model":"claude-opus-5-5",
            "content":[{"type":"text","text":"Bis gleich!"}],
            "stop_reason":"end_turn","stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":5}}"""))

        val tools = FakeTools()
        val brain = ClaudeBrain({ cfg }, tools, server.url("/").toString().trimEnd('/'))
        val r = brain.reply("Timer zehn Minuten und dann ist gut", "Jetzt: Samstag", {})

        assertEquals(listOf("set_timer", "end_conversation"), tools.calls.map { it.first })
        assertEquals(600, (tools.calls[0].second["seconds"] as Number).toInt())
        assertTrue(r.end)
        assertEquals("Klar, mach ich. Dein Timer läuft, zehn Minuten. Bis gleich!", r.text)

        val first = JSONObject(server.takeRequest().body.readUtf8())
        assertEquals("claude-opus-5-5", first.getString("model"))
        assertEquals("low", first.getJSONObject("output_config").getString("effort"))
        assertEquals("default", first.getString("fallbacks"))
        assertTrue(first.has("thinking").not() || first.getJSONObject("thinking").getString("type") == "adaptive")
        val tools0 = first.getJSONArray("tools")
        assertTrue((0 until tools0.length()).any { tools0.getJSONObject(it).optString("type") == "web_search_20260209" })
        assertTrue((0 until tools0.length()).any { tools0.getJSONObject(it).optString("type") == "memory_20250818" })
        assertTrue(first.getJSONArray("system").getJSONObject(0).has("cache_control"))
        assertTrue(first.getJSONArray("system").getJSONObject(1).getString("text").contains("Beintag"))

        val second = JSONObject(server.takeRequest().body.readUtf8())
        val msgs = second.getJSONArray("messages")
        assertEquals(3, msgs.length())
        // Denkblock muss unverändert zurückgeschickt werden
        val asst = msgs.getJSONObject(1).getJSONArray("content")
        assertEquals("thinking", asst.getJSONObject(0).getString("type"))
        assertEquals("sig123", asst.getJSONObject(0).getString("signature"))
        val res = msgs.getJSONObject(2).getJSONArray("content").getJSONObject(0)
        assertEquals("tool_result", res.getString("type"))
        assertEquals("toolu_1", res.getString("tool_use_id"))
        assertTrue(server.takeRequest().getHeader("anthropic-beta")!!.contains("server-side-fallback"))
    }

    @Test fun screenshotAlsBild() {
        server.enqueue(json("""{"id":"m1","type":"message","role":"assistant","model":"claude-opus-5-5",
            "content":[{"type":"tool_use","id":"toolu_9","name":"look_at_screen","input":{}}],
            "stop_reason":"tool_use","stop_sequence":null,"usage":{"input_tokens":1,"output_tokens":1}}"""))
        server.enqueue(json("""{"id":"m2","type":"message","role":"assistant","model":"claude-opus-5-5",
            "content":[{"type":"text","text":"Ich sehe dein Spiel."}],"stop_reason":"end_turn","stop_sequence":null,"usage":{"input_tokens":1,"output_tokens":1}}"""))
        val tools = object : ToolExecutor {
            override var endRequested = false
            var img: String? = null
            override fun run(name: String, a: Map<String, Any?>): String { img = "AAAA"; return "Hier ist der Bildschirm." }
            override fun takeImage(): String? = img.also { img = null }
        }
        val r = ClaudeBrain({ cfg }, tools, server.url("/").toString().trimEnd('/')).reply("Guck mal", "x", {})
        assertEquals("Ich sehe dein Spiel.", r.text)
        server.takeRequest()
        val msgs = JSONObject(server.takeRequest().body.readUtf8()).getJSONArray("messages")
        val content = msgs.getJSONObject(2).getJSONArray("content").getJSONObject(0).getJSONArray("content")
        assertEquals("text", content.getJSONObject(0).getString("type"))
        val image = content.getJSONObject(1)
        assertEquals("image", image.getString("type"))
        assertEquals("image/jpeg", image.getJSONObject("source").getString("media_type"))
        assertEquals("AAAA", image.getJSONObject("source").getString("data"))
    }

    @Test fun gedaechtnisWerkzeug() {
        server.enqueue(json("""{"id":"m1","type":"message","role":"assistant","model":"claude-opus-5-5",
            "content":[{"type":"tool_use","id":"toolu_m","name":"memory","input":{"command":"str_replace","path":"/memories/ich.md","old_str":"a","new_str":"b"}}],
            "stop_reason":"tool_use","stop_sequence":null,"usage":{"input_tokens":1,"output_tokens":1}}"""))
        server.enqueue(json("""{"id":"m2","type":"message","role":"assistant","model":"claude-opus-5-5",
            "content":[{"type":"text","text":"Notiert."}],"stop_reason":"end_turn","stop_sequence":null,"usage":{"input_tokens":1,"output_tokens":1}}"""))
        var got: Map<String, Any?>? = null
        val tools = object : ToolExecutor {
            override var endRequested = false
            override fun run(name: String, a: Map<String, Any?>) = "falsch"
            override fun memory(a: Map<String, Any?>): String { got = a; return "Datei geändert." }
        }
        val r = ClaudeBrain({ cfg }, tools, server.url("/").toString().trimEnd('/')).reply("Merk dir was", "x", {})
        assertEquals("Notiert.", r.text)
        assertEquals("str_replace", got!!["command"]); assertEquals("/memories/ich.md", got!!["path"])
    }

    @Test fun falscherSchluessel() {
        server.enqueue(MockResponse().setResponseCode(401).setHeader("Content-Type", "application/json")
            .setBody("""{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}"""))
        val r = ClaudeBrain({ cfg }, FakeTools(), server.url("/").toString().trimEnd('/')).reply("Hallo", "x", {})
        assertTrue(r.text.contains("Schlüssel"))
    }

    @Test fun ohneFallbackWennUnbekannt() {
        server.enqueue(MockResponse().setResponseCode(400).setHeader("Content-Type", "application/json")
            .setBody("""{"type":"error","error":{"type":"invalid_request_error","message":"fallbacks: Extra inputs are not permitted"}}"""))
        server.enqueue(json("""{"id":"m","type":"message","role":"assistant","model":"claude-opus-5-5","content":[{"type":"text","text":"Hi Tiry!"}],
            "stop_reason":"end_turn","stop_sequence":null,"usage":{"input_tokens":1,"output_tokens":1}}"""))
        val r = ClaudeBrain({ cfg }, FakeTools(), server.url("/").toString().trimEnd('/')).reply("Hallo", "x", {})
        assertEquals("Hi Tiry!", r.text)
        server.takeRequest()
        assertTrue(!JSONObject(server.takeRequest().body.readUtf8()).has("fallbacks"))
    }
}
