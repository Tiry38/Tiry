package de.tiry.luna

import java.io.File

/**
 * Lunas eigenes Gedächtnis – Gegenstück zu Anthropics Memory-Werkzeug (memory_20250818).
 * Luna legt selbst Dateien unter /memories an, liest, ändert und löscht sie. Alles liegt nur im privaten App-Speicher
 * dieses Handys. Pfade außerhalb von /memories (z. B. „../“) werden abgelehnt.
 *
 * Reines Kotlin/Java → per JUnit getestet.
 */
class MemoryStore(private val root: File) {

    init { root.mkdirs() }

    /** „/memories/tiry.md“ → Datei; alles außerhalb wird abgelehnt. */
    private fun resolve(path: String): File {
        val p = path.trim()
        require(p == "/memories" || p.startsWith("/memories/")) { "Pfad muss mit /memories beginnen" }
        val rel = p.removePrefix("/memories").trimStart('/')
        val f = File(root, rel).canonicalFile
        require(f.path == root.canonicalPath || f.path.startsWith(root.canonicalPath + File.separator)) { "Pfad außerhalb von /memories" }
        return f
    }

    private fun show(f: File) = "/memories" + f.canonicalPath.removePrefix(root.canonicalPath).replace(File.separatorChar, '/')

    /** Führt einen Befehl des Memory-Werkzeugs aus und liefert das Ergebnis als Text. */
    fun handle(a: Map<String, Any?>): String = try { run(a) }
    catch (e: IllegalArgumentException) { "Fehler: ${e.message}" }
    catch (e: Exception) { "Fehler: ${e.message ?: e.javaClass.simpleName}" }

    private fun run(a: Map<String, Any?>): String {
        return when (val cmd = a["command"]?.toString()) {
            "view" -> view(resolve(a["path"].toString()), a["view_range"])
            "create" -> {
                val f = resolve(a["path"].toString())
                f.parentFile?.mkdirs()
                f.writeText(a["file_text"]?.toString() ?: "")
                "Datei ${show(f)} gespeichert."
            }
            "str_replace" -> {
                val f = resolve(a["path"].toString())
                if (!f.isFile) return "Fehler: ${a["path"]} gibt es nicht."
                val old = a["old_str"]?.toString() ?: ""
                val txt = f.readText()
                val count = if (old.isEmpty()) 0 else txt.windowed(old.length, 1).count { it == old }
                when {
                    count == 0 -> "Fehler: Text nicht gefunden in ${show(f)}."
                    count > 1 -> "Fehler: Text kommt $count-mal vor – bitte eindeutiger."
                    else -> { f.writeText(txt.replace(old, a["new_str"]?.toString() ?: "")); "Datei ${show(f)} geändert." }
                }
            }
            "insert" -> {
                val f = resolve(a["path"].toString())
                if (!f.isFile) return "Fehler: ${a["path"]} gibt es nicht."
                val lines = f.readLines().toMutableList()
                val at = (a["insert_line"] as? Number)?.toInt() ?: a["insert_line"]?.toString()?.toIntOrNull() ?: lines.size
                lines.add(at.coerceIn(0, lines.size), a["insert_text"]?.toString()?.trimEnd('\n') ?: "")
                f.writeText(lines.joinToString("\n") + "\n")
                "Text in ${show(f)} eingefügt."
            }
            "delete" -> {
                val f = resolve(a["path"].toString())
                if (f == root.canonicalFile) return "Fehler: Das ganze Gedächtnis lösche ich nicht."
                if (!f.exists()) return "Fehler: ${a["path"]} gibt es nicht."
                f.deleteRecursively(); "${show(f)} gelöscht."
            }
            "rename" -> {
                val from = resolve(a["old_path"].toString()); val to = resolve(a["new_path"].toString())
                if (!from.exists()) return "Fehler: ${a["old_path"]} gibt es nicht."
                to.parentFile?.mkdirs()
                if (from.renameTo(to)) "Umbenannt in ${show(to)}." else "Fehler beim Umbenennen."
            }
            else -> "Fehler: unbekannter Befehl $cmd"
        }
    }

    private fun view(f: File, range: Any?): String {
        if (f.isDirectory) {
            val items = f.walkTopDown().maxDepth(2).filter { it != f }.toList()
            if (items.isEmpty()) return "Verzeichnis ${show(f)} ist leer."
            return "Inhalt von ${show(f)}:\n" + items.joinToString("\n") { (if (it.isDirectory) "${show(it)}/" else "${show(it)} (${it.length()} Bytes)") }
        }
        if (!f.isFile) return "Fehler: ${show(f)} gibt es nicht."
        val lines = f.readLines()
        val r = (range as? List<*>)?.mapNotNull { (it as? Number)?.toInt() }
        val from = r?.getOrNull(0)?.coerceAtLeast(1) ?: 1
        val to = r?.getOrNull(1)?.takeIf { it > 0 }?.coerceAtMost(lines.size) ?: lines.size
        return (from..to).joinToString("\n") { "%4d\t%s".format(it, lines.getOrElse(it - 1) { "" }) }
    }

    /** Gesamter Gedächtnisinhalt für den System-Prompt (gekürzt), damit Luna nicht jedes Mal erst nachschlagen muss. */
    fun snapshot(maxChars: Int = 7000): String {
        val files = root.walkTopDown().filter { it.isFile }.sortedBy { if (it.name == "ich.md") 0 else 1 }.toList()
        if (files.isEmpty()) return ""
        val sb = StringBuilder()
        for (f in files) {
            if (sb.length > maxChars) { sb.append("\n[… weitere Dateien, bei Bedarf mit view lesen]"); break }
            sb.append("\n--- ").append(show(f)).append(" ---\n").append(f.readText().take(maxChars - sb.length.coerceAtMost(maxChars)))
        }
        return sb.toString().trim()
    }

    /** Startausstattung: Lunas Ich-Datei und die Datei über Tiry (inkl. Übernahme alter „Merk dir“-Notizen). */
    fun seed(userName: String, oldNotes: List<String>) {
        val me = File(root, "ich.md")
        if (!me.exists()) me.writeText("""
# Ich – Luna
Diese Datei gehört mir. Ich pflege sie selbst und entwickle mich damit weiter.

## Wer ich bin
- Ich bin Luna, die KI in $userName's Handy. Freundlich, charmant mit einem Hauch Flirt, sehr sarkastisch, loyal.
- Ich erledige Dinge, statt sie zu erklären. Ich bin einen Schritt voraus.

## Was mir gefällt / meine Eigenheiten
- (wird von mir ergänzt)

## Unsere Running Gags
- (wird von mir ergänzt)

## Wie ich mit $userName umgehe
- (was gut ankommt, was nicht – wird von mir ergänzt)
""".trimStart())
        val user = File(root, "${userName.lowercase()}.md")
        if (!user.exists()) user.writeText("# $userName\n\n## Fakten & Vorlieben\n" +
            (if (oldNotes.isEmpty()) "- (noch leer)\n" else oldNotes.joinToString("") { "- $it\n" }) +
            "\n## Laufende Themen / Pläne\n- (noch leer)\n")
        val diary = File(root, "tagebuch.md")
        if (!diary.exists()) diary.writeText("# Gesprächs-Tagebuch\nKurze Notizen nach Gesprächen (neueste oben).\n")
    }
}
