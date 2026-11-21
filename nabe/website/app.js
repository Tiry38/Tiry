(() => {
  'use strict';
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const $ = (s, el = document) => el.querySelector(s);

  /* ---------- Theme ---------- */
  try { const t = localStorage.getItem('nabe-theme'); if (t) root.dataset.theme = t; } catch (e) { /* ohne Speicher */ }
  const isLight = () => root.dataset.theme ? root.dataset.theme === 'light' : matchMedia('(prefers-color-scheme: light)').matches;
  if (!root.dataset.theme) root.dataset.theme = isLight() ? 'light' : 'dark';
  $('.theme').addEventListener('click', () => {
    root.dataset.theme = isLight() ? 'dark' : 'light';
    try { localStorage.setItem('nabe-theme', root.dataset.theme); } catch (e) { /* egal */ }
  });

  /* ---------- Speichen der Nabe ---------- */
  const spokes = $('.spokes');
  const NS = 'http://www.w3.org/2000/svg';
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r1 = 222, r2 = i % 2 ? 242 : 248;
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('x1', 300 + Math.cos(a) * r1); l.setAttribute('y1', 300 + Math.sin(a) * r1);
    l.setAttribute('x2', 300 + Math.cos(a) * r2); l.setAttribute('y2', 300 + Math.sin(a) * r2);
    spokes.appendChild(l);
    if (i % 6 === 0) {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', 300 + Math.cos(a) * 250); c.setAttribute('cy', 300 + Math.sin(a) * 250); c.setAttribute('r', 3.5);
      spokes.appendChild(c);
    }
  }

  /* ---------- Einblenden ---------- */
  document.querySelectorAll('.eyebrow, .lede, .cta-row, .price-note, .proof-list li').forEach((el, i) => {
    el.classList.add('reveal'); el.style.transitionDelay = (0.45 + i * 0.08) + 's';
  });
  document.querySelectorAll('.title .word').forEach((w, i) => { w.style.transitionDelay = (0.08 + i * 0.09) + 's'; });
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('ready')));

  /* ---------- Cursor + magnetische Buttons + Parallax ---------- */
  const stage = $('.stage');
  if (fine && !reduce) {
    const cur = $('.cursor'), label = $('.cursor-label');
    let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
    cur.classList.add('hidden');
    addEventListener('pointermove', (e) => { if (!e.clientX && !e.clientY) return; x = e.clientX; y = e.clientY; cur.classList.remove('hidden'); cur.classList.add('on'); }, { passive: true });
    document.addEventListener('pointerleave', () => cur.classList.add('hidden'));
    document.addEventListener('pointerenter', () => cur.classList.remove('hidden'));
    (function loop() {
      cx += (x - cx) * 0.2; cy += (y - cy) * 0.2;
      cur.style.transform = `translate(${cx}px, ${cy}px)`;
      const r = stage.getBoundingClientRect();
      const nx = (x - (r.left + r.width / 2)) / innerWidth, ny = (y - (r.top + r.height / 2)) / innerHeight;
      stage.style.setProperty('--ry', (nx * 14).toFixed(2) + 'deg');
      stage.style.setProperty('--rx', (-ny * 14).toFixed(2) + 'deg');
      stage.style.setProperty('--ox', (nx * 26).toFixed(1) + 'px');
      stage.style.setProperty('--oy', (ny * 26).toFixed(1) + 'px');
      requestAnimationFrame(loop);
    })();
    document.querySelectorAll('[data-cursor], a, button').forEach((el) => {
      el.addEventListener('pointerenter', () => { if (el.dataset.cursor) { cur.classList.add('big'); label.textContent = el.dataset.cursor; } });
      el.addEventListener('pointerleave', () => { cur.classList.remove('big'); });
    });
    document.querySelectorAll('.magnetic').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', ((e.clientX - r.left - r.width / 2) * 0.28).toFixed(1) + 'px');
        el.style.setProperty('--my', ((e.clientY - r.top - r.height / 2) * 0.38).toFixed(1) + 'px');
      });
      el.addEventListener('pointerleave', () => { el.style.setProperty('--mx', '0px'); el.style.setProperty('--my', '0px'); });
    });
  }

  /* ---------- Orb (WebGL-Shader) ---------- */
  const canvas = $('.orb');
  const orb = { amp: 0.15, target: 0.15, light: 0 };
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: true });
  if (!gl) { root.classList.add('no-webgl'); }
  else {
    const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const fs = `precision highp float;
uniform vec2 uRes;uniform float uTime;uniform float uAmp;uniform float uLight;
float h(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return v;}
void main(){
vec2 uv=(gl_FragCoord.xy*2.-uRes)/min(uRes.x,uRes.y);uv*=1.18;
float ang=atan(uv.y,uv.x);float t=uTime;
float wob=(n(vec3(cos(ang)*1.6,sin(ang)*1.6,t*.9))-.5)*.09*(.4+uAmp*1.6);
float R=.9+wob+uAmp*.035;float r=length(uv)/R;
vec3 copper=vec3(.93,.53,.29),ember=vec3(.9,.3,.18),gold=vec3(.98,.82,.5),petrol=vec3(.12,.5,.58),deep=vec3(.07,.09,.12);
vec3 col=vec3(0.);float a=0.;
if(r<1.){
vec3 nr=vec3(uv/R,sqrt(max(0.,1.-r*r)));
vec3 q=nr*1.15+vec3(0.,0.,t*.16);
float w=fbm(q+fbm(q*1.2+t*.1)*1.8);
float w2=fbm(nr*2.2-vec3(t*.12,t*.05,0.));
col=mix(ember,copper,smoothstep(.28,.72,w));
col=mix(col,gold,smoothstep(.55,.85,w2)*.9);
float band=sin((nr.y*1.3+nr.x*.4+w*2.2)*7.-t*1.4)*.5+.5;
col+=smoothstep(.82,1.,band)*gold*(.28+uAmp*.4);
vec3 L=normalize(vec3(-.45,.55,.75));float dif=max(dot(nr,L),0.);
col=mix(col,mix(petrol,deep,.35),(1.-dif)*.62);
col*=.72+.5*dif;
col+=pow(nr.z,4.)*.22*gold;
float spec=pow(max(dot(reflect(-L,nr),vec3(0,0,1)),0.),28.);
col+=spec*.4*vec3(1.,.93,.8);
float fr=pow(1.-nr.z,2.4);col+=fr*mix(copper,gold,.55)*(.6+uAmp*.7);
a=smoothstep(1.,.985,r);
}
float g=exp(-max(r-1.,0.)*(7.-uAmp*2.5))*(.32+uAmp*.38);
vec3 gc=mix(copper,ember,.3);
col=col*a+gc*g*(1.-a)*(1.-uLight*.35);
float al=max(a,g*(1.-a)*(1.-uLight*.25));
gl_FragColor=vec4(col,al);}`;
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { root.classList.add('no-webgl'); }
    else {
      gl.useProgram(prog);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const U = (k) => gl.getUniformLocation(prog, k);
      const uRes = U('uRes'), uTime = U('uTime'), uAmp = U('uAmp'), uLight = U('uLight');
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      const size = () => {
        const d = Math.min(devicePixelRatio || 1, 2), w = canvas.clientWidth * d;
        if (canvas.width !== w) { canvas.width = w; canvas.height = w; }
        gl.viewport(0, 0, canvas.width, canvas.height);
      };
      let last = performance.now(), time = 0, visible = true;
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
      const frame = (now) => {
        const dt = Math.min((now - last) / 1000, 0.05); last = now;
        orb.amp += (orb.target - orb.amp) * Math.min(dt * 5, 1);
        orb.light += ((isLight() ? 1 : 0) - orb.light) * Math.min(dt * 4, 1);
        time += dt * (reduce ? 0.15 : 0.55 + orb.amp * 1.4);
        if (visible) {
          size();
          gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
          gl.uniform2f(uRes, canvas.width, canvas.height); gl.uniform1f(uTime, time);
          gl.uniform1f(uAmp, orb.amp); gl.uniform1f(uLight, orb.light);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }
  }

  /* ---------- Hörprobe ---------- */
  const SCRIPT = [
    { who: 'ki', name: 'NABE', text: 'Radwerkstatt am Markt, guten Tag! Hier spricht die digitale Assistenz – ich bin eine KI. Wie kann ich helfen?' },
    { who: 'kunde', name: 'Anrufer', text: 'Hallo, mein E-Bike braucht eine Inspektion. Geht diese Woche noch was?' },
    { who: 'ki', name: 'NABE', text: 'Gern. Donnerstag um 10:30 Uhr ist noch frei. Soll ich den Termin für Sie eintragen?' },
    { who: 'kunde', name: 'Anrufer', text: 'Ja, perfekt.' },
    { who: 'ki', name: 'NABE', text: 'Erledigt. Sie bekommen gleich eine Bestätigung per E-Mail. Einen schönen Tag noch!', booked: true },
  ];
  const btn = $('.play'), btnText = $('.play-text'), list = $('.transcript'), timeEl = $('.call-time');
  const stateText = $('.state-text'), booked = $('.booked');
  const STATES = { idle: ['Bereit', 0.15], listening: ['Hört zu', 0.32], thinking: ['Denkt nach', 0.24], speaking: ['Spricht', 0.75] };
  const setState = (s) => { stage.dataset.state = s; stateText.textContent = STATES[s][0]; orb.target = STATES[s][1]; };
  setState('idle');

  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  let voice = null;
  const pickVoice = () => {
    if (!synth) return;
    const vs = synth.getVoices().filter((v) => /^de/i.test(v.lang));
    voice = vs.find((v) => /natural|neural|google|online/i.test(v.name)) || vs[0] || null;
  };
  if (synth) { pickVoice(); synth.addEventListener('voiceschanged', pickVoice); }

  let run = 0, clock = null, started = 0;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const say = (line, id) => new Promise((resolve) => {
    const fallback = () => wait(Math.max(1400, line.text.length * 55)).then(resolve);
    if (!synth || !voice) return fallback();
    const u = new SpeechSynthesisUtterance(line.text);
    u.voice = voice; u.lang = voice.lang; u.rate = line.who === 'ki' ? 1.04 : 1.0; u.pitch = line.who === 'ki' ? 1.05 : 0.85;
    let done = false; const fin = () => { if (!done) { done = true; resolve(); } };
    u.onend = fin; u.onerror = fin;
    u.onboundary = () => { if (id === run && line.who === 'ki') orb.amp = Math.min(orb.amp + 0.25, 1.1); };
    synth.speak(u);
    setTimeout(fin, line.text.length * 110 + 2500);
  });
  const addLine = (line) => {
    const li = document.createElement('li'); li.className = line.who;
    const w = document.createElement('span'); w.className = 'who'; w.textContent = line.name;
    li.append(w, document.createTextNode(line.text)); list.appendChild(li);
    while (list.children.length > 3) list.firstElementChild.remove();
  };
  const stop = () => {
    run++; if (synth) synth.cancel(); clearInterval(clock);
    btn.setAttribute('aria-pressed', 'false'); btnText.textContent = 'Hörprobe abspielen'; setState('idle');
  };
  btn.addEventListener('click', async () => {
    if (btn.getAttribute('aria-pressed') === 'true') return stop();
    const id = ++run;
    btn.setAttribute('aria-pressed', 'true'); btnText.textContent = 'Hörprobe stoppen';
    list.textContent = ''; booked.classList.remove('show');
    started = performance.now(); clearInterval(clock);
    clock = setInterval(() => {
      const s = Math.floor((performance.now() - started) / 1000);
      timeEl.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }, 250);
    for (const line of SCRIPT) {
      if (id !== run) return;
      if (line.who === 'ki') { setState('thinking'); await wait(500); if (id !== run) return; setState('speaking'); }
      else setState('listening');
      addLine(line);
      await say(line, id);
      if (line.booked && id === run) booked.classList.add('show');
    }
    if (id === run) { await wait(600); stop(); }
  });
  /* Idle-Atmen, damit der Orb nie tot wirkt */
  if (!reduce) setInterval(() => { if (stage.dataset.state === 'idle') orb.target = 0.12 + Math.random() * 0.08; }, 1800);
})();
