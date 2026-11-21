package de.tiry.luna

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

class MemoryStoreTest {
    private fun store(): Pair<MemoryStore, File> {
        val dir = Files.createTempDirectory("mem").toFile()
        return MemoryStore(File(dir, "memories")) to dir
    }

    @Test fun startausstattungUndAlteNotizen() {
        val (m, _) = store()
        m.seed("Tiry", listOf("Montag ist Beintag"))
        val snap = m.snapshot()
        assertTrue(snap.contains("/memories/ich.md"))
        assertTrue(snap.indexOf("ich.md") < snap.indexOf("tiry.md"))   // Lunas Ich zuerst
        assertTrue(snap.contains("Montag ist Beintag"))
    }

    @Test fun befehle() {
        val (m, _) = store()
        assertTrue(m.handle(mapOf("command" to "create", "path" to "/memories/notizen/a.md", "file_text" to "eins\nzwei\n")).contains("gespeichert"))
        assertTrue(m.handle(mapOf("command" to "view", "path" to "/memories/notizen/a.md")).contains("2\tzwei"))
        assertTrue(m.handle(mapOf("command" to "str_replace", "path" to "/memories/notizen/a.md", "old_str" to "zwei", "new_str" to "drei")).contains("geändert"))
        m.handle(mapOf("command" to "insert", "path" to "/memories/notizen/a.md", "insert_line" to 0, "insert_text" to "null"))
        assertEquals("null\neins\ndrei\n", File(Files.createTempDirectory("x").toFile(), "y").let { m.handle(mapOf("command" to "view", "path" to "/memories/notizen/a.md")) }
            .lines().joinToString("\n") { it.substringAfter('\t') } + "\n")
        assertTrue(m.handle(mapOf("command" to "rename", "old_path" to "/memories/notizen/a.md", "new_path" to "/memories/b.md")).contains("Umbenannt"))
        assertTrue(m.handle(mapOf("command" to "view", "path" to "/memories")).contains("/memories/b.md"))
        assertTrue(m.handle(mapOf("command" to "delete", "path" to "/memories/b.md")).contains("gelöscht"))
        assertTrue(m.handle(mapOf("command" to "str_replace", "path" to "/memories/fehlt.md", "old_str" to "x", "new_str" to "y")).startsWith("Fehler"))
    }

    @Test fun keinZugriffAusserhalb() {
        val (m, dir) = store()
        File(dir, "geheim.txt").writeText("PIN 1234")
        assertTrue(m.handle(mapOf("command" to "view", "path" to "/memories/../geheim.txt")).startsWith("Fehler"))
        assertTrue(m.handle(mapOf("command" to "create", "path" to "/etc/passwd", "file_text" to "x")).startsWith("Fehler"))
        assertTrue(m.handle(mapOf("command" to "delete", "path" to "/memories")).startsWith("Fehler"))
        assertFalse(File(dir, "geheim.txt").readText().isEmpty())
    }
}
