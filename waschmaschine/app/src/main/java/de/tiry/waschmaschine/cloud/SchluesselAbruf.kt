package de.tiry.waschmaschine.cloud

import de.tiry.waschmaschine.protokoll.GeraeteBeschreibung
import de.tiry.waschmaschine.protokoll.GeraeteProfil
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64

/**
 * EINMALIGER Abruf des Geräteschlüssels (Port von hcpy/hc-login.py).
 * Der Schlüssel wird von BSH beim Koppeln vergeben und liegt nur dort – lokal gibt die Maschine ihn nicht heraus.
 * Danach spricht die App ausschließlich lokal mit der Maschine; das Konto wird nie wieder benutzt.
 */
class SchluesselAbruf {
    companion object {
        const val CLIENT_ID = "9B75AC9EC512F36C84256AC47D813E2C1DD0D6520DF774B020E1E6E2EB29B1F3"
        const val REDIRECT = "hcauth://auth/prod"
        private const val OAUTH = "https://api.home-connect.com/security/oauth/"
        private val REGIONEN = listOf("https://eu.services.home-connect.com/", "https://na.services.home-connect.com/")
        private fun b64(b: ByteArray) = Base64.getUrlEncoder().withoutPadding().encodeToString(b)
        private fun zufall(n: Int) = ByteArray(n).also { SecureRandom().nextBytes(it) }
    }

    private val json = Json { ignoreUnknownKeys = true }
    val verifier = b64(zufall(32))
    val state = b64(zufall(16))

    val anmeldeAdresse: String get() {
        val q = linkedMapOf(
            "response_type" to "code", "prompt" to "login",
            "code_challenge" to b64(MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray())),
            "code_challenge_method" to "S256", "client_id" to CLIENT_ID, "scope" to "ReadOrigApi",
            "nonce" to b64(zufall(16)), "state" to state, "redirect_uri" to REDIRECT,
        )
        return OAUTH + "authorize?" + q.entries.joinToString("&") { "${it.key}=${URLEncoder.encode(it.value, "UTF-8")}" }
    }

    /** Aus der Rücksprung-Adresse hcauth://auth/prod?code=…&state=… den Code holen. */
    fun codeAus(rueckAdresse: String): String {
        val q = rueckAdresse.substringAfter('?', "").split('&').associate { it.substringBefore('=') to java.net.URLDecoder.decode(it.substringAfter('=', ""), "UTF-8") }
        q["error"]?.let { throw IllegalStateException("Anmeldung abgelehnt: $it") }
        return q["code"] ?: throw IllegalStateException("Kein Anmelde-Code erhalten.")
    }

    data class Fund(val profil: GeraeteProfil, val istWaschmaschine: Boolean)

    /** Code → Token → gekoppelte Geräte → Schlüssel + Gerätebeschreibung. */
    fun hole(code: String, http: (String, String, Map<String, String>, String?) -> Pair<Int, ByteArray> = ::anfrage): List<Fund> {
        val form = mapOf("grant_type" to "authorization_code", "client_id" to CLIENT_ID, "code_verifier" to verifier, "code" to code, "redirect_uri" to REDIRECT)
            .entries.joinToString("&") { "${it.key}=${URLEncoder.encode(it.value, "UTF-8")}" }
        val (st, tok) = http("POST", OAUTH + "token", mapOf("Content-Type" to "application/x-www-form-urlencoded"), form)
        if (st != 200) throw IllegalStateException("Anmeldung fehlgeschlagen ($st). Bitte noch einmal versuchen – der Code ist nur kurz gültig.")
        val token = json.parseToJsonElement(String(tok)).jsonObject["access_token"]!!.jsonPrimitive.content
        val sub = json.parseToJsonElement(String(Base64.getUrlDecoder().decode(token.split('.')[1].trimEnd('=')))).jsonObject["sub"]!!.jsonPrimitive.content
        val kopf = mapOf("Authorization" to "Bearer $token")
        var basis: String? = null; var geraete: JsonObject? = null
        for (r in REGIONEN) {
            val (s, b) = http("GET", r + "api/account/v2/accounts/$sub/paired-appliances", kopf, null)
            if (s == 200) { basis = r; geraete = json.parseToJsonElement(String(b)).jsonObject; break }
        }
        if (basis == null || geraete == null) throw IllegalStateException("Keine gekoppelten Geräte im Konto gefunden.")
        return geraete["appliances"]!!.jsonArray.mapNotNull { a ->
            val o = a.jsonObject
            val haId = o["haId"]!!.jsonPrimitive.content
            val marke = o["brand"]?.jsonPrimitive?.content ?: ""
            val typ = o["haType"]?.jsonPrimitive?.content ?: ""
            val vib = o["vib"]?.jsonPrimitive?.content ?: ""
            val (s1, enc) = http("GET", basis + "api/appliance/v2/appliances/$haId/encryption-information", kopf, null)
            if (s1 != 200) return@mapNotNull null
            val e = json.parseToJsonElement(String(enc)).jsonObject
            val tls = e["tls"]?.jsonObject; val aes = e["aes"]?.jsonObject
            val (schluessel, iv) = when {
                tls != null -> tls["key"]!!.jsonPrimitive.content to null
                aes != null -> aes["key"]!!.jsonPrimitive.content to aes["iv"]!!.jsonPrimitive.content
                else -> return@mapNotNull null
            }
            val (s2, zip) = http("GET", basis + "api/iddf/v1/iddf/$haId", kopf, null)
            val beschr = if (s2 == 200) GeraeteBeschreibung.ausZip(zip, haId) else null
            Fund(
                GeraeteProfil(haId, marke, typ, vib, schluessel, iv, null, beschr?.merkmale.orEmpty(), beschr?.programme.orEmpty()),
                typ.equals("Washer", true) || typ.equals("WasherDryer", true),
            )
        }
    }

    private fun anfrage(methode: String, adresse: String, kopf: Map<String, String>, rumpf: String?): Pair<Int, ByteArray> {
        val c = URL(adresse).openConnection() as HttpURLConnection
        c.requestMethod = methode; c.instanceFollowRedirects = false; c.connectTimeout = 15000; c.readTimeout = 30000
        kopf.forEach { (k, v) -> c.setRequestProperty(k, v) }
        if (rumpf != null) { c.doOutput = true; c.outputStream.use { it.write(rumpf.toByteArray()) } }
        val s = c.responseCode
        val b = (if (s < 400) c.inputStream else c.errorStream)?.use { it.readBytes() } ?: ByteArray(0)
        return s to b
    }
}
