package de.tiry.waschmaschine.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.GenericShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp

/** Schräg angeschnittene Kante statt Pille: wie ein gestanzter Blechstreifen. */
val Gestanzt = GenericShape { s, _ ->
    val k = s.height * 0.38f
    moveTo(0f, 0f); lineTo(s.width - k, 0f); lineTo(s.width, k); lineTo(s.width, s.height); lineTo(0f, s.height); close()
}

/** Haupthandlung: voller Akzent-Streifen, Text links, Pfeil rechts. Mind. 64 dp hoch. */
@Composable
fun Haupttaste(text: String, modifier: Modifier = Modifier, aktiv: Boolean = true, onClick: () -> Unit) {
    Row(
        modifier.fillMaxWidth().defaultMinSize(minHeight = 64.dp)
            .background(if (aktiv) Farbe.Akzent else Farbe.Linie, Gestanzt)
            .clickable(enabled = aktiv, role = Role.Button, onClick = onClick)
            .padding(horizontal = 20.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text, style = Schrift.Mittel.copy(color = if (aktiv) Farbe.AufAkzent else Farbe.Nebel, fontWeight = androidx.compose.ui.text.font.FontWeight(500)), modifier = Modifier.weight(1f))
        Text("→", style = Schrift.Gross.copy(color = if (aktiv) Farbe.AufAkzent else Farbe.Nebel))
    }
}

/** Nebenhandlung: unterstrichener Text, Tippfläche ≥ 48 dp. */
@Composable
fun Textaktion(text: String, modifier: Modifier = Modifier, farbe: Color = Farbe.Tinte, onClick: () -> Unit) {
    Box(modifier.defaultMinSize(minHeight = 48.dp, minWidth = 48.dp).clickable(role = Role.Button, onClick = onClick), contentAlignment = Alignment.CenterStart) {
        Text(text, style = Schrift.Text.copy(color = farbe, fontWeight = androidx.compose.ui.text.font.FontWeight(700), letterSpacing = 1.sp),
            modifier = Modifier.drawBehind { drawLine(farbe, Offset(0f, size.height + 3.dp.toPx()), Offset(size.width, size.height + 3.dp.toPx()), 1.5.dp.toPx()) })
    }
}

private val Int.sp get() = androidx.compose.ui.unit.TextUnit(this.toFloat(), androidx.compose.ui.unit.TextUnitType.Sp)

/** Etikett mit Zählnummer – editoriale Gliederung statt Karten. */
@Composable
fun Etikett(nummer: String, text: String, modifier: Modifier = Modifier, farbe: Color = Farbe.Nebel) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        Text(nummer, style = Schrift.Etikett.copy(color = Farbe.Akzent))
        Spacer(Modifier.width(10.dp))
        Box(Modifier.width(18.dp).height(1.dp).background(Farbe.Linie))
        Spacer(Modifier.width(10.dp))
        Text(text.uppercase(), style = Schrift.Etikett.copy(color = farbe))
    }
}

@Composable
fun Punkt(farbe: Color, modifier: Modifier = Modifier) { Box(modifier.size(8.dp).background(farbe)) }

@Composable
fun Auswahlzeile(werte: List<Pair<String, Boolean>>, stil: TextStyle = Schrift.Text, onWahl: (Int) -> Unit) {
    androidx.compose.foundation.lazy.LazyRow {
        items(werte.size) { i ->
            val (t, an) = werte[i]
            Box(Modifier.defaultMinSize(minHeight = 48.dp).clickable(role = Role.RadioButton) { onWahl(i) }.padding(end = 22.dp), contentAlignment = Alignment.CenterStart) {
                Text(t, style = stil.copy(color = if (an) Farbe.Akzent else Farbe.Nebel, fontWeight = androidx.compose.ui.text.font.FontWeight(if (an) 700 else 400)),
                    modifier = if (an) Modifier.drawBehind { drawLine(Farbe.Akzent, Offset(0f, size.height + 4.dp.toPx()), Offset(size.width, size.height + 4.dp.toPx()), 2.dp.toPx()) } else Modifier)
            }
        }
    }
}
