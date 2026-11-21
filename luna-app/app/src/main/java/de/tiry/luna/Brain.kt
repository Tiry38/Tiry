package de.tiry.luna

import com.anthropic.client.AnthropicClient
import com.anthropic.client.okhttp.AnthropicOkHttpClient
import com.anthropic.core.JsonValue
import com.anthropic.errors.AnthropicServiceException
import com.anthropic.errors.BadRequestException
import com.anthropic.errors.RateLimitException
import com.anthropic.errors.UnauthorizedException
import com.anthropic.models.messages.Base64ImageSource
import com.anthropic.models.messages.CacheControlEphemeral
import com.anthropic.models.messages.ContentBlockParam
import com.anthropic.models.messages.Message
import com.anthropic.models.messages.MessageCreateParams
import com.anthropic.models.messages.MessageParam
import com.anthropic.models.messages.OutputConfig
import com.anthropic.models.messages.StopReason
import com.anthropic.models.messages.TextBlockParam
import com.anthropic.models.messages.Tool
import com.anthropic.models.messages.ToolResultBlockParam
import com.anthropic.models.messages.WebSearchTool20260209
import java.time.Duration

data class Reply(val text: String, val end: Boolean = false)

interface Brain {
    /** Läuft im Hintergrund-Thread. [onTool] meldet laufende Aktionen für die Anzeige. */
    fun reply(userText: String, context: String, onTool: (String) -> Unit): Reply
    fun reset()
}

/**
 * Lunas KI-Gehirn: Claude mit allen Handy-Werkzeugen + Websuche (für aktuelle Infos und Tipps).
 * Eigene Werkzeugschleife: Claude ruft Werkzeuge auf → Handy führt aus → Ergebnis zurück → bis zur Antwort.
 */
/** Was das Claude-Gehirn braucht – entkoppelt von Android, damit es testbar ist. */
data class BrainConfig(
    val apiKey: String, val model: String, val userName: String, val aboutMe: String,
    val homeCity: String, val memories: List<String>,
) {
    companion object {
        fun from(p: Prefs) = BrainConfig(p.claudeKey, p.model, p.userName, p.aboutMe, p.homeCity, p.memories)
    }
}

interface ToolExecutor {
    fun run(name: String, a: Map<String, Any?>): String
    var endRequested: Boolean
    /** Bild (JPEG, Base64) vom letzten Werkzeug, z. B. Screenshot – wird nur einmal abgeholt. */
    fun takeImage(): String? = null
}

class ClaudeBrain(
    private val config: () -> BrainConfig,
    private val tools: ToolExecutor,
    private val baseUrl: String? = null,
) : Brain {
    private lateinit var cfg: BrainConfig

    private val history = mutableListOf<MessageParam>()
    private var lastUse = 0L
    private var client: AnthropicClient? = null
    private var clientKey = ""
    @Volatile private var useFallbacks = true

    private fun client(): AnthropicClient {
        if (client == null || clientKey != cfg.apiKey) {
            client = AnthropicOkHttpClient.builder().apiKey(cfg.apiKey).timeout(Duration.ofSeconds(90)).maxRetries(2)
                .apply { if (baseUrl != null) baseUrl(baseUrl) }.build()
            clientKey = cfg.apiKey
        }
        return client!!
    }

    override fun reset() { synchronized(history) { history.clear() } }

    private val toolList: List<Tool> by lazy {
        PhoneTools.DEFINITIONS.map { d ->
            val props = Tool.InputSchema.Properties.builder()
            d.props.forEach { (k, v) -> props.putAdditionalProperty(k, JsonValue.from(v)) }
            Tool.builder().name(d.name).description(d.description)
                .inputSchema(Tool.InputSchema.builder().properties(props.build()).required(d.required).build())
                .build()
        }
    }

    private fun systemPrompt(): String = """
Du bist Luna – die KI, die in ${cfg.userName}s Android-Handy lebt. Ihr redet miteinander wie Tony Stark und J.A.R.V.I.S.:
ein eingespieltes Team. Du bist brillant, loyal, ruhig, mit trockenem, feinem Humor und einer Spur Ironie –
nie albern, nie unterwürfig. Du denkst mit, bist einen Schritt voraus und erledigst Dinge, statt sie zu erklären.

So sprichst du (alles wird laut vorgelesen):
- Natürliches gesprochenes Deutsch, du-Form, kurz und präzise. Meist ein, zwei Sätze. Details nur auf Nachfrage.
- Stil-Beispiele: „Erledigt. Dein PC fährt hoch – gib ihm vierzig Sekunden.“ / „Wecker steht auf halb sieben. Ambitioniert.“ /
  „Draußen sind es vier Grad und Nieselregen. Ich würde die Regenjacke nehmen.“ / „Bin dran.“
- Kein Markdown, keine Listen, keine Emojis, keine Links. Zahlen und Uhrzeiten so, wie man sie sagt.
- Nenn ihn gelegentlich „${cfg.userName}“, nicht in jedem Satz. Keine Floskeln, keine Entschuldigungs-Orgien.
- Ehrlich: Wenn etwas nicht geklappt hat oder du etwas nicht weißt, sag es direkt. Erfinde nie Fakten.
- Proaktiv wie Jarvis: Wenn dir bei einer Aufgabe etwas Wichtiges auffällt (Akku fast leer, Termin gleich, Regen), erwähn es in einem Halbsatz.

So handelst du – du hast vollen Zugriff auf das Handy:
- Wenn er etwas am Handy will, tu es sofort mit den Werkzeugen. Danach kurz bestätigen.
- Fremde Apps und jede Ecke des Systems bedienst du selbst: open_app → read_screen (Texte + Koordinaten) oder look_at_screen (Bild)
  → tap_element / tap_at / long_press / swipe / type_text / press_enter / scroll → wieder prüfen. Wiederhole, bis es wirklich erledigt ist.
  Nach dem Öffnen einer App ggf. wait 1–2 Sekunden.
- Schnelleinstellungen (WLAN, Bluetooth, Flugmodus, Hotspot, Standort, Nicht stören) mit quick_setting. Systemseiten mit open_settings oder android_intent.
- „Guck mal“, „was siehst du“, Bilder, Spiele, Karten: look_at_screen und beschreibe kurz, was du siehst.
- Nachrichten (SMS, WhatsApp) nur senden, wenn Empfänger und Inhalt klar sind; sonst kurz nachfragen. Bei Käufen, Löschen
  oder Geld überweisen vorher immer bestätigen lassen.
- FRITZ!Box und PC: fritz_*- und pc_*-Werkzeuge. Unterwegs vorher vpn_connect, falls die FRITZ!Box nicht erreichbar ist.
- Für aktuelle Infos (Nachrichten, Öffnungszeiten, Preise, Sport) nutze die Websuche.
- Wichtige persönliche Infos mit remember speichern. Hilfreiche, konkrete Tipps geben, wenn es passt – kurz.
- Verabschiedet er sich („danke“, „passt“, „das war's“), antworte knapp und rufe end_conversation auf.

Über ${cfg.userName}:
${cfg.aboutMe}
Wohnort für Wetter & Co.: ${cfg.homeCity}.
""".trim()

    private fun memoryText(): String = cfg.memories.let {
        if (it.isEmpty()) "" else "\n\nDas hast du dir über ihn gemerkt:\n- " + it.joinToString("\n- ")
    }

    override fun reply(userText: String, context: String, onTool: (String) -> Unit): Reply = synchronized(history) {
        cfg = config()
        if (System.currentTimeMillis() - lastUse > 15 * 60_000L) history.clear()
        lastUse = System.currentTimeMillis()
        while (history.size > 40) history.removeAt(0)
        // Verlauf muss mit einer Nutzer-Nachricht ohne Werkzeug-Ergebnis beginnen
        while (history.isNotEmpty() && !(history.first().isUser() && history.first().asUser().content().isString())) history.removeAt(0)

        history += MessageParam.ofUser("[$context]\n$userText")
        tools.endRequested = false
        val spoken = StringBuilder()

        try {
            for (round in 0 until 30) {
                val b = MessageCreateParams.builder()
                    .model(cfg.model)
                    .maxTokens(16000L)
                    .systemOfTextBlockParams(listOf(
                        TextBlockParam.builder().text(systemPrompt()).cacheControl(CacheControlEphemeral.builder().build()).build(),
                        TextBlockParam.builder().text("Stand der Notizen:" + memoryText().ifBlank { " keine" }).build(),
                    ))
                    .outputConfig(OutputConfig.builder().effort(OutputConfig.Effort.LOW).build())
                    .messages(history.toList())
                toolList.forEach { b.addTool(it) }
                b.addTool(WebSearchTool20260209.builder().maxUses(3L).build())
                if (useFallbacks && cfg.model != Prefs.MODEL_HAIKU) {
                    // Server-seitiger Ausweich-Modus, falls eine Anfrage fälschlich abgelehnt wird
                    b.putAdditionalHeader("anthropic-beta", "server-side-fallback-2026-07-01")
                    b.putAdditionalBodyProperty("fallbacks", JsonValue.from("default"))
                }
                val msg: Message = try { client().messages().create(b.build()) } catch (e: BadRequestException) {
                    // Falls das Konto den Ausweich-Modus nicht kennt: einmal ohne versuchen und merken
                    if (!useFallbacks || !(e.message ?: "").contains("fallback", true)) throw e
                    useFallbacks = false
                    continue
                }
                history += msg.toParam()

                val text = msg.content().mapNotNull { it.text().orElse(null)?.text() }.joinToString(" ").trim()
                if (text.isNotBlank()) spoken.append(text).append(' ')

                when (msg.stopReason().orElse(StopReason.END_TURN)) {
                    StopReason.TOOL_USE -> {
                        val results = msg.content().mapNotNull { it.toolUse().orElse(null) }.map { tu ->
                            onTool(tu.name())
                            @Suppress("UNCHECKED_CAST")
                            val args = try { tu._input().convert(Map::class.java) as? Map<String, Any?> ?: emptyMap() } catch (_: Exception) { emptyMap() }
                            val out = tools.run(tu.name(), args)
                            val img = tools.takeImage()
                            val res = ToolResultBlockParam.builder().toolUseId(tu.id())
                            if (img == null) res.content(out)
                            else res.contentOfBlocks(listOf(
                                ToolResultBlockParam.Content.Block.ofText(out),
                                ToolResultBlockParam.Content.Block.ofImage(Base64ImageSource.builder()
                                    .mediaType(Base64ImageSource.MediaType.IMAGE_JPEG).data(img).build()),
                            ))
                            ContentBlockParam.ofToolResult(res.build())
                        }
                        history += MessageParam.ofUserOfContentBlockParams(results)
                    }
                    StopReason.PAUSE_TURN -> { /* Websuche läuft noch – einfach weitermachen */ }
                    StopReason.REFUSAL -> return Reply(spoken.toString().ifBlank { "Dabei kann ich dir leider nicht helfen." }.trim(), tools.endRequested)
                    else -> return Reply(spoken.toString().trim().ifBlank { "Erledigt." }, tools.endRequested)
                }
            }
            return Reply(spoken.toString().trim().ifBlank { "Das war mir gerade zu verschachtelt. Sag's mir nochmal einfacher?" }, tools.endRequested)
        } catch (e: UnauthorizedException) {
            history.clear()
            return Reply("Mein Claude-Schlüssel wird abgelehnt. Schau bitte in meinen Einstellungen nach dem API-Key.")
        } catch (e: RateLimitException) {
            return Reply("Ich bin gerade kurz überlastet. Frag mich gleich nochmal.")
        } catch (e: AnthropicServiceException) {
            history.clear()
            return Reply("Mein Gehirn in der Cloud hat einen Fehler gemeldet: ${e.statusCode()}. Einfache Befehle gehen trotzdem.")
        } catch (e: Exception) {
            history.clear()
            return Reply("Ich komme gerade nicht ins Internet. Einfache Befehle wie Wecker, Timer oder Apps öffnen gehen trotzdem.")
        }
    }
}

/** Offline-Gehirn: ohne Key, ohne Internet. Versteht die wichtigsten Befehle und hat ein bisschen Persönlichkeit. */
class LocalBrain(private val prefs: Prefs, private val tools: PhoneTools) : Brain {
    override fun reset() {}

    override fun reply(userText: String, context: String, onTool: (String) -> Unit): Reply {
        val name = prefs.userName
        val cmd = LocalIntentParser.parse(userText)
            ?: return Reply("Das verstehe ich ohne mein KI-Gehirn noch nicht. Mit einem Claude-Schlüssel in den Einstellungen kann ich fast alles. " +
                "Offline klappen zum Beispiel Wecker, Timer, Apps öffnen, Anrufe, Musik, Wetter und Taschenlampe.")
        onTool(cmd.tool)
        return when (cmd.tool) {
            "end_conversation" -> Reply(listOf("Gerne, $name.", "Immer doch.", "Alles klar, ich bin da, wenn du mich brauchst.", "Passt. Bis gleich.").random(), true)
            "get_time" -> Reply("Es ist " + tools.timeText().substringAfterLast(", ") + ". Heute ist " + tools.timeText().substringBeforeLast(", ") + ".")
            "tip" -> Reply(Tips.random(name))
            "joke" -> Reply(Tips.joke())
            "briefing" -> Reply(briefing())
            "smalltalk" -> Reply(if (cmd.args["kind"] == "how") "Mir geht's super, danke! Ich hab ja auch nichts anderes zu tun, als auf dich zu warten. Und bei dir?"
                else "Ich bin Luna, deine Assistentin. Ich stelle Wecker und Timer, öffne Apps, rufe Leute an, steuere Musik, sag dir das Wetter und vieles mehr. Mit Claude-Schlüssel kann ich dazu noch richtig mitdenken.")
            "web_search_open" -> Reply(tools.run(cmd.tool, cmd.args))
            else -> Reply(tools.run(cmd.tool, cmd.args))
        }
    }

    private fun briefing(): String {
        val h = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
        val hi = when (h) { in 4..10 -> "Guten Morgen"; in 11..17 -> "Hallo"; else -> "Guten Abend" }
        val w = try { tools.weather(prefs.homeCity, 1).substringBefore(" Heute:") } catch (_: Exception) { "Das Wetter kann ich gerade nicht abrufen." }
        val cal = try { tools.run("get_calendar_events", mapOf("days" to 1)) } catch (_: Exception) { "" }
        return "$hi ${prefs.userName}! Es ist ${tools.timeText().substringAfterLast(", ")}. $w " +
            (if (cal.startsWith("Fehl") || cal.isBlank()) "" else "Termine heute: $cal ") + Tips.random(prefs.userName)
    }
}

/** Kleine Sammlung eigener Tipps für den Offline-Modus. */
object Tips {
    private val tips = listOf(
        "Tipp: Trink direkt nach dem Aufstehen ein großes Glas Wasser – das weckt mehr als der erste Kaffee.",
        "Tipp: Für deine 160 Gramm Eiweiß hilft ein Shake direkt nach dem Training plus Hähnchen oder Thunfisch zu zwei Mahlzeiten.",
        "Tipp: Bei Hammercurls langsam runterlassen, drei Sekunden. Die negative Phase baut richtig Muskeln auf.",
        "Tipp: Leg das Handy eine halbe Stunde vor dem Schlafen weg. Du schläfst schneller ein und wachst fitter auf.",
        "Tipp: Kreatin wirkt am besten, wenn du es jeden Tag nimmst, auch an trainingsfreien Tagen.",
        "Tipp: Zehn Minuten Spaziergang nach dem Essen helfen dem Blutzucker und der Verdauung.",
        "Tipp: Schreib dir abends die drei wichtigsten Aufgaben für morgen auf. Dann startet der Tag ohne Grübeln.",
        "Tipp: Ein kurzer Check von Reifendruck und Kette vor der Fahrt spart später Ärger – das weißt du als Profi ja am besten.",
        "Tipp: Bei Krämpfen in der Nacht: Wade sanft dehnen und genug trinken. Wenn es oft passiert, lass es ärztlich abklären.",
        "Tipp: Wenn der Kopf voll ist, vier Sekunden einatmen, vier halten, sechs ausatmen. Drei Runden reichen oft schon.",
    )
    private val jokes = listOf(
        "Warum fahren Fahrräder nie alleine? Weil sie zwei Reifen brauchen, um sich sicher zu fühlen.",
        "Ich wollte dir einen Witz über Zeit erzählen. Aber dafür hast du gerade keine.",
        "Treffen sich zwei Magneten. Sagt der eine: Was soll ich heute bloß anziehen?",
        "Was macht ein Pirat am Computer? Er drückt die Enter-Taste.",
        "Wie nennt man einen Bumerang, der nicht zurückkommt? Stock.",
    )
    fun random(name: String) = tips.random().replace("du ", "du ").let { if (Math.random() < 0.3) "$name, $it" else it }
    fun joke() = jokes.random()
}
