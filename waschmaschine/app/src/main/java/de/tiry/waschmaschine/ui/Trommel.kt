package de.tiry.waschmaschine.ui

import android.graphics.RuntimeShader
import android.os.Build
import androidx.annotation.RequiresApi
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.ShaderBrush
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.input.pointer.pointerInput
import de.tiry.waschmaschine.logik.Status
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin

/** Schalter für Tests: Robolectric kann keine GPU-Shader zeichnen → dort den Rückfall zeigen. */
object Darstellung { @Volatile var gpuWasser = true }

/** Wasser und Lochblech der Trommel – live auf der GPU gerechnet (Android 13+). */
private const val WASSER_AGSL = """
uniform float2 mitte; uniform float radius; uniform float zeit; uniform float pegel; uniform float drehung; uniform float bewegung;
uniform half4 akzent;
float h(float2 p){ return fract(sin(dot(p, float2(127.1,311.7)))*43758.5453); }
float rauschen(float2 p){ float2 i=floor(p); float2 f=fract(p); float2 u=f*f*(3.0-2.0*f);
  return mix(mix(h(i),h(i+float2(1,0)),u.x), mix(h(i+float2(0,1)),h(i+float2(1,1)),u.x), u.y); }
half4 main(float2 fc){
  float2 p=(fc-mitte)/radius; float d=length(p);
  if(d>1.0) return half4(0.0);
  float ca=cos(drehung); float sa=sin(drehung);
  float2 q=float2(ca*p.x-sa*p.y, sa*p.x+ca*p.y);
  float w=atan(q.y,q.x); float ringe=fract(d*10.0); float teil=fract(w/6.28318*floor(14.0+d*46.0));
  float loch=smoothstep(0.2,0.08,length(float2(ringe-0.5,teil-0.5)));
  float3 innen=mix(float3(0.10,0.13,0.16), float3(0.035,0.05,0.065), d);
  innen+=float3(loch*0.07*(1.0-d*0.6));
  float y=-p.y;
  float flaeche=(pegel*2.0-1.0)
    +0.045*sin(p.x*4.5+zeit*2.1)*bewegung
    +0.025*sin(p.x*10.0-zeit*3.4)*bewegung
    +(rauschen(float2(p.x*3.0+zeit*0.7, zeit*0.35))-0.5)*0.09*bewegung
    +p.x*0.10*bewegung;
  float nass=smoothstep(0.01,-0.01,y-flaeche);
  float tief=clamp(flaeche-y,0.0,2.0);
  float3 wasser=float3(0.06,0.115,0.14)*(1.0-tief*0.3);
  float k=rauschen(p*7.0+float2(zeit*0.8,-zeit*0.55))*rauschen(p*3.0-float2(zeit*0.3,zeit*0.2));
  wasser+=float3(akzent.rgb)*smoothstep(0.42,0.6,k)*0.22*nass;
  float kante=smoothstep(0.018,0.0,abs(y-flaeche));
  float3 farbe=mix(innen,wasser,nass)+float3(akzent.rgb)*kante*0.75;
  farbe*=1.0-smoothstep(0.72,1.0,d)*0.65;
  return half4(half3(farbe),1.0);
}
"""

/**
 * SIGNATUR: die Trommel als lebendige Live-Anzeige. Sie dreht sich mit Feder-Physik (Masse, Trägheit),
 * schwappt mit echtem Wasser-Shader, der Chromrand ist die Fortschrittsskala. Man kann sie mit dem Finger anwerfen.
 */
@Composable
fun Trommel(
    status: Status,
    fortschritt: Float?,
    restSek: Long?,
    modifier: Modifier = Modifier,
    ruhig: Boolean = wenigBewegung(),
) {
    val zielTempo = when {
        ruhig -> 0f
        status == Status.LAEUFT && restSek != null && restSek in 1..420 -> 11f   // Schleudern am Ende
        status == Status.LAEUFT -> 2.3f
        else -> 0f
    }
    val tempo = remember { Animatable(0f) }
    var winkel by remember { mutableFloatStateOf(0.6f) }
    var zeit by remember { mutableFloatStateOf(0f) }
    val pegelZiel = when (status) { Status.LAEUFT -> if (restSek != null && restSek in 1..420) 0.08f else 0.34f; Status.PAUSE -> 0.3f; Status.FEHLER -> 0.3f; else -> 0.05f }
    val pegel = remember { Animatable(0.05f) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(zielTempo) { tempo.animateTo(zielTempo, spring(dampingRatio = 0.32f, stiffness = 6f)) }
    LaunchedEffect(pegelZiel) { pegel.animateTo(pegelZiel, spring(dampingRatio = 0.5f, stiffness = 3f)) }
    LaunchedEffect(ruhig) {
        if (ruhig) return@LaunchedEffect
        var vorher = 0L
        while (true) withFrameNanos { t ->
            if (vorher != 0L) { val dt = ((t - vorher) / 1e9f).coerceAtMost(0.05f); winkel += tempo.value * dt; zeit += dt }
            vorher = t
        }
    }

    val shader = remember { if (Build.VERSION.SDK_INT >= 33 && Darstellung.gpuWasser) runCatching { RuntimeShader(WASSER_AGSL) }.getOrNull() else null }

    Canvas(modifier.pointerInput(ruhig) {
        if (ruhig) return@pointerInput
        var letzt = 0f
        detectDragGestures(
            onDragStart = { o -> letzt = atan2(o.y - size.height / 2f, o.x - size.width / 2f) },
            onDragEnd = { scope.launch { tempo.animateTo(zielTempo, spring(dampingRatio = 0.32f, stiffness = 6f)) } },
        ) { ch, _ ->
            val a = atan2(ch.position.y - size.height / 2f, ch.position.x - size.width / 2f)
            var d = a - letzt; if (d > PI) d -= (2 * PI).toFloat(); if (d < -PI) d += (2 * PI).toFloat()
            letzt = a; winkel += d
            scope.launch { tempo.snapTo((tempo.value * 0.6f + d * 60f * 0.4f).coerceIn(-25f, 25f)) }
        }
    }) {
        val r = size.minDimension / 2f
        val m = Offset(size.width / 2f, size.height / 2f)
        val innenR = r * 0.80f
        // Chromrand: Material aus Sweep-Verlauf
        drawCircle(
            Brush.sweepGradient(listOf(Color(0xFF2A3743), Color(0xFF9AA8B4), Color(0xFF1A242E), Color(0xFF5C6B78), Color(0xFF141C24), Color(0xFFB9C5CF), Color(0xFF2A3743)), m),
            r * 0.985f, m,
        )
        drawCircle(Farbe.Tiefe, r * 0.86f, m)
        drawCircle(Color(0xFF26323D), r * 0.86f, m, style = Stroke(r * 0.012f))
        // Skala: 100 Striche, Fortschritt in Akzent
        val f = fortschritt?.coerceIn(0f, 1f)
        for (i in 0 until 100) {
            val w = (-PI / 2 + i * 2 * PI / 100).toFloat()
            val lang = if (i % 10 == 0) 0.05f else 0.025f
            val aktiv = f != null && i < (f * 100).toInt()
            val c = if (aktiv) Farbe.Akzent else Color(0x66EAF0F3)
            drawLine(c, m + Offset(cos(w), sin(w)) * (r * 0.905f), m + Offset(cos(w), sin(w)) * (r * (0.905f + lang)), strokeWidth = if (aktiv) r * 0.012f else r * 0.006f, cap = StrokeCap.Butt)
        }
        // Innenraum: Shader oder Rückfall
        val innen = Path().apply { addOval(androidx.compose.ui.geometry.Rect(m, innenR)) }
        clipPath(innen) {
            val gpu = shader != null && Build.VERSION.SDK_INT >= 33 && Darstellung.gpuWasser && runCatching {
                zeichneShader(shader!!, m, innenR, zeit, pegel.value, winkel, if (ruhig) 0f else (0.4f + (tempo.value / 11f)).coerceAtMost(1.4f))
            }.onFailure { Darstellung.gpuWasser = false }.isSuccess
            if (!gpu) zeichneRueckfall(m, innenR, zeit, pegel.value, winkel)
            zeichneWaesche(m, innenR, winkel, tempo.value)
        }
        // Glas: ein einziger harter Lichtreflex, kein Glow
        rotate(-28f, m) {
            drawArc(Color(0x22EAF0F3), 200f, 70f, false, topLeft = m - Offset(innenR * 0.88f, innenR * 0.88f), size = Size(innenR * 1.76f, innenR * 1.76f), style = Stroke(innenR * 0.05f, cap = StrokeCap.Round))
        }
        drawCircle(Color(0xFF0E151C), innenR, m, style = Stroke(r * 0.03f))
    }
}

@RequiresApi(33)
private fun DrawScope.zeichneShader(s: RuntimeShader, m: Offset, r: Float, zeit: Float, pegel: Float, winkel: Float, bewegung: Float) {
    s.setFloatUniform("mitte", m.x, m.y); s.setFloatUniform("radius", r); s.setFloatUniform("zeit", zeit)
    s.setFloatUniform("pegel", pegel); s.setFloatUniform("drehung", winkel); s.setFloatUniform("bewegung", bewegung)
    s.setFloatUniform("akzent", 0.83f, 1f, 0.23f, 1f)
    drawRect(ShaderBrush(s))
}

private fun DrawScope.zeichneRueckfall(m: Offset, r: Float, zeit: Float, pegel: Float, winkel: Float) {
    drawCircle(Brush.radialGradient(listOf(Color(0xFF1A2129), Farbe.Tiefe), m, r), r, m)
    rotate(winkel * 57.3f, m) {
        for (ring in 1..9) for (k in 0 until 14 + ring * 5) {
            val w = k * 2 * PI / (14 + ring * 5); val rr = r * ring / 10f
            drawCircle(Color(0x1FEAF0F3), r * 0.011f, m + Offset(cos(w).toFloat(), sin(w).toFloat()) * rr)
        }
    }
    val flaecheY = m.y + r - pegel * 2 * r
    fun welle(x: Float) = flaecheY + sin(x / r * 4.5f + zeit * 2.1f) * r * 0.035f + sin(x / r * 10f - zeit * 3.4f) * r * 0.015f + x / r * r * 0.05f
    val p = Path().apply {
        moveTo(m.x - r, m.y + r); lineTo(m.x - r, welle(-r))
        var x = -r; while (x <= r) { lineTo(m.x + x, welle(x)); x += r / 32 }
        lineTo(m.x + r, m.y + r); close()
    }
    drawPath(p, Brush.verticalGradient(listOf(Color(0xFF12262D), Color(0xFF07131A)), flaecheY, m.y + r))
    // Lichtnetz im Wasser (Kaustik) – sparsam im Akzent
    for (i in 0 until 7) {
        val y0 = flaecheY + (i + 1) * (m.y + r - flaecheY) / 9f
        val linie = Path().apply {
            var x = -r; moveTo(m.x + x, y0)
            while (x <= r) { lineTo(m.x + x, y0 + sin(x / r * (6f + i) + zeit * (1.2f + i * 0.2f) + i) * r * 0.018f); x += r / 24 }
        }
        drawPath(linie, Farbe.Akzent.copy(alpha = 0.07f), style = Stroke(r * 0.006f))
    }
    val kante = Path().apply { var x = -r; moveTo(m.x + x, welle(x)); while (x <= r) { lineTo(m.x + x, welle(x)); x += r / 32 } }
    drawPath(kante, Farbe.Akzent.copy(alpha = 0.8f), style = Stroke(r * 0.012f))
}

/** Wäschestücke als Stoffbahnen: werden von der Trommel mitgenommen und fallen oben herunter. */
private fun DrawScope.zeichneWaesche(m: Offset, r: Float, winkel: Float, tempo: Float) {
    val n = 4
    for (i in 0 until n) {
        val versatz = i * 2 * PI.toFloat() / n + 0.4f
        var w = ((winkel + versatz) % (2 * PI.toFloat()) + 2 * PI.toFloat()) % (2 * PI.toFloat())
        val anWand = tempo > 7f
        var rr = r * (if (anWand) 0.84f else 0.6f)
        if (!anWand && w in 3.6f..5.6f) { val t = (w - 3.6f) / 2f; rr = r * (0.6f - 0.45f * sin(t * PI.toFloat())); w = 3.6f + t * 2f }
        val pos = m + Offset(cos(w), sin(w)) * rr
        val laenge = r * (0.42f + 0.08f * (i % 2)); val dicke = r * (0.07f + 0.015f * (i % 3))
        rotate(w * 57.3f + 90f + i * 23f, pos) {
            val bahn = Path(); val falte = Path()
            var x = -laenge / 2; bahn.moveTo(pos.x + x, pos.y); falte.moveTo(pos.x + x, pos.y + dicke * 0.25f)
            while (x <= laenge / 2) {
                val y = sin(x / laenge * 5f + i) * dicke * 0.7f
                bahn.lineTo(pos.x + x, pos.y + y); falte.lineTo(pos.x + x, pos.y + y + dicke * 0.25f); x += laenge / 18
            }
            drawPath(bahn, Color(0x66EAF0F3), style = Stroke(dicke, cap = StrokeCap.Round))
            drawPath(falte, Color(0x2A0A0F14), style = Stroke(dicke * 0.18f, cap = StrokeCap.Round))
        }
    }
}
