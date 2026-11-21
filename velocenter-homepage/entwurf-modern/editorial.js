(function(){
'use strict';
var $=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var lerp=function(a,b,t){return a+(b-a)*t},clamp=function(v,a,b){return Math.max(a,Math.min(b,v))};
var root=document.documentElement,body=document.body;
var fine=matchMedia('(pointer:fine)').matches;
var isMob=function(){return innerWidth<=900};
root.classList.add('pre');
var AR='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
var BESTAND=[];try{BESTAND=JSON.parse($('#bestand').textContent)}catch(e){}
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var eur=function(n){return n.toLocaleString('de-DE')+' €'};

/* ---------- Papierkorn ---------- */
(function(){try{var c=document.createElement('canvas');c.width=c.height=180;var x=c.getContext('2d'),d=x.createImageData(180,180);for(var i=0;i<d.data.length;i+=4){var v=Math.random()*255|0;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255}x.putImageData(d,0,0);$('.grain').style.backgroundImage='url('+c.toDataURL('image/png')+')'}catch(e){}})();

/* ---------- Daten ---------- */
var BRANDS=[
 {k:'i:SY',logo:'img/marke-isy.svg',img:'img/p-isy-1200.webp',t:'Kompakt-E-Bikes. Wir sind offizieller i:SY Experte.',href:'#isy'},
 {k:'KTM',logo:'img/marke-ktm.svg',img:'img/p-ktm-1200.webp',t:'Macina City, Tour, Style und Team im Laden.'},
 {k:'QiO',logo:'img/marke-qio.svg',img:'img/p-qio-eins-fineline-1200.webp',t:'Kompakte E-Bikes aus der EINS-Familie.'},
 {k:'Velo de Ville',logo:'img/marke-vdv.svg',img:'img/p-vdv-aebpro-1200.webp',t:'Zum Beispiel der AEB PRO.'},
 {k:'Van Raam',logo:'img/marke-vanraam.svg',img:'img/p-vanraam-1200.webp',t:'E-Dreiräder: Easy Rider Compact Plus und Easy Rider 3.',href:'#dreirad'},
 {k:'Gudereit',logo:'img/marke-gudereit.svg',img:'img/p-gudereit-1200.webp',t:'EC-35 Evo mit Bosch-Antrieb.'},
 {k:'Victoria',logo:'img/marke-victoria.svg',img:'img/p-victoria-veloa7-1200.webp',t:'Zum Beispiel Veloa 7 und Avyon 6.'},
 {k:'Stevens',logo:'img/marke-stevens.svg',img:'img/bestand/rest-05.webp',t:'E-Juke und E-Antelao.'}
];
var HB=[
 {w:'i:SY',src:'img/p-isy-orange-1200.webp',b:'i:SY',m:'N3.8 ZR CX Auto Comfort',alt:'i:SY N3.8 ZR CX Auto Comfort in Happy Orange'},
 {w:'KTM',src:'img/p-ktm-1200.webp',b:'KTM',m:'Macina',alt:'KTM Macina E-Bike'},
 {w:'QiO',src:'img/p-qio-eins-fineline-1200.webp',b:'QiO',m:'EINS P-E Fine Line',alt:'QiO EINS P-E Fine Line'},
 {w:'Velo de Ville',src:'img/p-vdv-aebpro-1200.webp',b:'Velo de Ville',m:'AEB PRO',alt:'Velo de Ville AEB PRO in French Lavender'},
 {w:'Victoria',src:'img/p-victoria-veloa7-1200.webp',b:'Victoria',m:'Veloa 7',alt:'Victoria Veloa 7'},
 {w:'Van Raam',src:'img/p-vanraam-1200.webp',b:'Van Raam',m:'Easy Rider 3 · E-Dreirad',alt:'Van Raam Easy Rider 3'}
];

/* ---------- Öffnungszeiten ---------- */
var HRS={1:[[540,720],[870,1080]],2:[[540,720],[870,1080]],4:[[540,720],[870,1080]],5:[[540,720],[870,1080]],6:[[540,720]]};
var DN=['So','Mo','Di','Mi','Do','Fr','Sa'],DL=['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
var hm=function(m){return String(m/60|0).padStart(2,'0')+':'+String(m%60).padStart(2,'0')};
function status(){
  var n=new Date(),d=n.getDay(),m=n.getHours()*60+n.getMinutes(),sl=HRS[d]||[];
  for(var i=0;i<sl.length;i++){if(m>=sl[i][0]&&m<sl[i][1])return{open:true,t:'Geöffnet',s:'bis '+hm(sl[i][1])+' Uhr'}}
  for(i=0;i<sl.length;i++){if(m<sl[i][0])return{open:false,t:i?'Mittagspause':'Geschlossen',s:'öffnet '+hm(sl[i][0])+' Uhr'}}
  for(var k=1;k<8;k++){var dd=(d+k)%7;if(HRS[dd])return{open:false,t:'Geschlossen',s:'öffnet '+(k===1?'morgen':DN[dd])+' '+hm(HRS[dd][0][0])+' Uhr'}}
}
function renderStatus(){var s=status(),st=$('#st');st.classList.toggle('open',s.open);$('#stTxt').innerHTML='<b>'+s.t+'</b><span class="lg"> · '+s.s+'</span>';
  $$('.hours').forEach(function(ul){var d=new Date().getDay(),order=[1,2,3,4,5,6,0];ul.innerHTML=order.map(function(x){var sl=HRS[x];var v=sl?sl.map(function(a){return hm(a[0])+'–'+hm(a[1])}).join(' · '):'geschlossen';return '<li class="'+(sl?'':'cl ')+(x===d?'today':'')+'"><b>'+DL[x]+(x===d?' · heute':'')+'</b><span>'+v+'</span></li>'}).join('')});
  $$('.vs-st').forEach(function(e){e.textContent=s.t+' · '+s.s});
}

/* ---------- Seiten-Router mit Vorhang ---------- */
var PAGES={};$$('.page').forEach(function(p){PAGES[p.dataset.page]=p});
var PXL=[],VSL=[],cur=null,pendingScroll=null,inited={},busy=false;
function pageName(){var h=decodeURIComponent(location.hash.slice(1));return PAGES[h]?h:'start'}
function show(name){sTgt=null;
  Object.keys(PAGES).forEach(function(k){PAGES[k].hidden=k!==name});
  $$('[data-nav]').forEach(function(a){if(a.dataset.nav===name)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  cur=name;document.title=(name==='start'?'':PAGES[name].dataset.title+' · ')+'Velocenter Editorial';
  if(!inited[name]){inited[name]=1;(INIT[name]||function(){})()}
  observeReveals(PAGES[name]);PXL=$$('.px,.motor img',PAGES[name]);VSL=$$('.vs-img',PAGES[name]);
  onResize();
  var tgt=pendingScroll&&document.getElementById(pendingScroll);pendingScroll=null;
  window.scrollTo(0,tgt?tgt.getBoundingClientRect().top+scrollY-70:0);
  introHeads(PAGES[name]);
  onScroll(true);
}
function go(name){
  if(busy)return;
  if(name===cur){var t=pendingScroll&&document.getElementById(pendingScroll);pendingScroll=null;if(t)scrollTo({top:t.getBoundingClientRect().top+scrollY-70,behavior:'smooth'});else scrollTo({top:0,behavior:'smooth'});return}
  busy=true;var ct=$('.ct'),lab=$('.ct span');
  var tt=PAGES[name].dataset.title;lab.innerHTML=esc(tt)+'<em>.</em>';
  ct.classList.remove('out');void ct.offsetWidth;ct.classList.add('in');
  setTimeout(function(){show(name);ct.classList.remove('in');ct.classList.add('out');setTimeout(function(){ct.classList.remove('out');busy=false},820)},760);
}
addEventListener('hashchange',function(){closeMenu();go(pageName())});
document.addEventListener('click',function(e){
  var a=e.target.closest('a[href^="#"]');if(!a)return;
  if(a.dataset.scroll)pendingScroll=a.dataset.scroll;
  if(a.dataset.brand){LADEN.f=a.dataset.brand;if(inited['im-laden'])renderGallery()}
  var h=a.getAttribute('href').slice(1)||'start';
  if(PAGES[h]&&(h===cur||('#'+h)===location.hash)){e.preventDefault();closeMenu();go(h)}
});
var LOADING=false;
function introHeads(p){if(LOADING){setTimeout(function(){introHeads(p)},1250);return}$$('.ln>span',p).forEach(function(s,i){s.animate([{transform:'translateY(105%)'},{transform:'none'}],{duration:1100,delay:180+i*90,easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'})})}

/* ---------- Kopf + Menü ---------- */
var hd=$('.hd'),lastY=0;
function closeMenu(){if(!body.classList.contains('mopen'))return;body.classList.remove('mopen');$('#mb').setAttribute('aria-expanded','false');$('#mn').setAttribute('aria-hidden','true')}
$('#mb').addEventListener('click',function(){var o=body.classList.toggle('mopen');this.setAttribute('aria-expanded',o);$('#mn').setAttribute('aria-hidden',!o);if(o){hd.classList.remove('hide');$$('.mn-list a').forEach(function(a,i){a.style.transitionDelay=(.25+i*.045)+'s'})}else $$('.mn-list a').forEach(function(a){a.style.transitionDelay='0s'})});
addEventListener('keydown',function(e){if(e.key==='Escape'){closeMenu();closeDetail()}});
(function(){var pv=$('#mnPrev');$$('.mn-list a').forEach(function(a,i){var im=new Image();im.alt='';im.loading='lazy';im.src=a.dataset.pv;if(a.dataset.ph)im.className='ph';pv.appendChild(im);a.addEventListener('mouseenter',function(){$$('img',pv).forEach(function(x,j){x.classList.toggle('on',j===i)})})});var f=$('img',pv);if(f)f.classList.add('on')})();

/* ---------- Cursor + Magnet ---------- */
var mx=innerWidth/2,my=innerHeight/2,cx=mx,cy=my;
var cu=$('.cu'),cuB=$('.cu b'),cuI=$('.cu i');
addEventListener('mousemove',function(e){mx=e.clientX;my=e.clientY},{passive:true});
if(fine){
  document.addEventListener('mouseover',function(e){var t=e.target;var lb=t.closest('[data-cursor]');var lk=t.closest('a,button,label');cu.classList.toggle('lb',!!lb);cu.classList.toggle('lk',!lb&&!!lk);cuB.textContent=lb?lb.dataset.cursor:''});
  $$('.btn,.rbtn,.mb').forEach(function(b){b.addEventListener('mousemove',function(e){var r=b.getBoundingClientRect();b.style.transform='translate('+((e.clientX-r.left-r.width/2)*.22)+'px,'+((e.clientY-r.top-r.height/2)*.3)+'px)'});b.addEventListener('mouseleave',function(){b.style.transform=''})});
}

/* ---------- Hover-Bild ---------- */
var hv=$('.hvimg'),hvI=$('.hvimg img'),hvx=0,hvy=0,hvOn=false;
function bindHover(list){if(!fine)return;$$('[data-img]',list).forEach(function(a){a.addEventListener('mouseenter',function(){hvI.src=a.dataset.img;hv.classList.toggle('bike',list.dataset.hv==='bike');hv.classList.add('on');hvOn=true});a.addEventListener('mouseleave',function(){hv.classList.remove('on');hvOn=false})})}
$$('[data-hv]').forEach(function(l){if(l.id!=='bi')bindHover(l)});

/* ---------- Hero ---------- */
var hi=0,bwB=$('#bwB'),bwF=$('#bwF'),tilt=$('#tilt'),bikeImg=$('#bikeImg'),refl=$('#bikeRefl'),stage=$('#stage'),ring=$('#bkRing');
HB.forEach(function(b){var i=new Image();i.src=b.src});
function chars(w){return w.split('').map(function(c,i){return '<span class="c" style="--i:'+i+'"><span style="transition-delay:'+(i*45)+'ms">'+(c===' '?'&nbsp;':esc(c))+'</span></span>'}).join('')}
function fitBW(){
  [bwB,bwF].forEach(function(w){w.parentNode.style.setProperty('--bwfs','100px')});
  var wd=bwB.scrollWidth||1,max=isMob()?innerWidth*.34:Math.min(innerWidth*.27,innerHeight*.5);
  var fs=Math.min(max,100*(innerWidth*(isMob()?.92:.94))/wd);
  [bwB,bwF].forEach(function(w){w.parentNode.style.setProperty('--bwfs',fs.toFixed(1)+'px')});
}
function setWord(w,anim){
  if(!anim){bwB.innerHTML=bwF.innerHTML=chars(w);fitBW();return}
  $$('.c',bwB).concat($$('.c',bwF)).forEach(function(c){c.classList.add('up')});
  setTimeout(function(){bwB.innerHTML=bwF.innerHTML=chars(w);$$('.c',bwB).concat($$('.c',bwF)).forEach(function(c){c.classList.add('dn')});fitBW();void bwB.offsetWidth;requestAnimationFrame(function(){$$('.c',bwB).concat($$('.c',bwF)).forEach(function(c){c.classList.remove('dn')})})},430);
}
function setMeta(b,i){$('#bkName').innerHTML=esc(b.b)+'<b>'+esc(b.m)+'</b>';$('#bkCnt').innerHTML=String(i+1).padStart(2,'0')+'<small>/ '+String(HB.length).padStart(2,'0')+'</small>'}
var heroBusy=false,heroT0=performance.now(),HERO_MS=6500;
function heroTo(n){
  if(heroBusy)return;heroBusy=true;n=(n+HB.length)%HB.length;var b=HB[n],dir=n>hi||(hi===HB.length-1&&n===0)?1:-1;hi=n;heroT0=performance.now();
  setWord(b.w,true);setMeta(b,n);
  bikeImg.animate([{opacity:1,transform:'none',filter:'drop-shadow(0 30px 30px rgba(19,20,23,.22)) blur(0)'},{opacity:0,transform:'translateX('+(-60*dir)+'px) scale(.97)',filter:'drop-shadow(0 30px 30px rgba(19,20,23,0)) blur(6px)'}],{duration:520,easing:'cubic-bezier(.77,0,.18,1)',fill:'forwards'});
  refl.animate([{opacity:1},{opacity:0}],{duration:400,fill:'forwards'});
  var N=11,strips=[];
  for(var i=0;i<N;i++){var s=document.createElement('div');s.className='slice';s.style.backgroundImage='url("'+b.src+'")';var t=(i*100/N).toFixed(3),bt=(100-(i+1)*100/N).toFixed(3);s.style.clipPath='inset('+t+'% 0 '+bt+'% 0)';tilt.appendChild(s);strips.push(s);
    s.animate([{transform:'translateX('+(90*dir*(i%2?1:.6))+'px)',opacity:0,filter:'brightness(1.8)'},{transform:'none',opacity:1,filter:'brightness(1)'}],{duration:900,delay:260+i*42,easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'})}
  setTimeout(function(){bikeImg.src=b.src;bikeImg.alt=b.alt;refl.src=b.src;bikeImg.getAnimations().forEach(function(a){a.cancel()});refl.getAnimations().forEach(function(a){a.cancel()});strips.forEach(function(s){s.remove()});heroBusy=false},260+N*42+920);
}
$('#bkNext').addEventListener('click',function(){heroTo(hi+1)});
$('#bkPrev').addEventListener('click',function(){heroTo(hi-1)});
stage.addEventListener('click',function(){heroTo(hi+1)});
var tx=0,ty=0,tX=0,tY=0;
$('#hero').addEventListener('mousemove',function(e){tX=(e.clientX/innerWidth-.5);tY=(e.clientY/innerHeight-.5)});
$('#hero').addEventListener('mouseleave',function(){tX=tY=0});
var sx0=0;(function(){var t0=null;stage.addEventListener('touchstart',function(e){t0=e.touches[0].clientX},{passive:true});stage.addEventListener('touchend',function(e){if(t0==null)return;var d=e.changedTouches[0].clientX-t0;if(Math.abs(d)>40)heroTo(hi+(d<0?1:-1));t0=null},{passive:true})})();

/* ---------- Laufband ---------- */
(function(){var h=BRANDS.map(function(b){return '<a href="'+(b.href||'#marken')+'" aria-label="'+esc(b.k)+'"><img src="'+b.logo+'" alt="'+esc(b.k)+'" loading="lazy"></a>'}).join('');$('#mqT').innerHTML=h+h.replace(/aria-label="[^"]*"/g,'aria-hidden="true" tabindex="-1"')})();

/* ---------- Statement: Wort für Wort ---------- */
function wrapWords(p){
  var out='';p.childNodes.forEach(function(n){var r=n.nodeType===1&&n.classList.contains('r');var tx=n.textContent;tx.split(/(\s+)/).forEach(function(w){if(!w)return;if(/^\s+$/.test(w)){out+=' ';return}out+='<span class="wd'+(r?' r':'')+'">'+esc(w)+'</span>'})});p.innerHTML=out;
}
$$('.wfill').forEach(wrapWords);

/* ---------- Showroom ---------- */
(function(){$('#srTrack').innerHTML=BRANDS.map(function(b,i){return '<article class="sp"><div class="sp-txt"><span class="eyebrow">'+String(i+1).padStart(2,'0')+' / 08</span><h3>'+esc(b.k)+'</h3><p>'+esc(b.t)+'</p><a class="lnk" href="'+(b.href||'#im-laden')+'"'+(b.href?'':' data-brand="'+esc(b.k)+'"')+'>'+(b.href?'Mehr erfahren':'Im Laden ansehen')+' '+AR.replace('<svg','<svg width="14" height="14"')+'</a></div><div class="sp-img"><img src="'+b.img+'" alt="'+esc(b.k)+' E-Bike" loading="lazy" decoding="async"></div><span class="sp-n">'+String(i+1).padStart(2,'0')+'</span></article>'}).join('')})();

/* ---------- Zahlen ---------- */
function countUp(el){if(el.dataset.done)return;el.dataset.done=1;var to=parseFloat(el.dataset.count),dec=+el.dataset.dec||0,sep=el.dataset.sep,t0=performance.now(),D=1600;
  (function f(t){var p=clamp((t-t0)/D,0,1),e=1-Math.pow(1-p,4),v=to*e;var s=dec?v.toFixed(dec).replace('.',','):(sep?Math.round(v).toLocaleString('de-DE'):String(Math.round(v)));el.textContent=s;if(p<1)requestAnimationFrame(f)})(t0)}

/* ---------- Einblenden ---------- */
var io='IntersectionObserver' in window?new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('seen');$$('[data-count]',e.target).forEach(countUp);if(e.target.dataset.count)countUp(e.target);io.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px'}):null;
function observeReveals(p){if(!io){$$('.rv-in',p).forEach(function(e){e.classList.add('seen')});return}$$('.rv-in,.num',p).forEach(function(e,i){if(!e.classList.contains('seen')){e.style.transitionDelay=((i%3)*90)+'ms';io.observe(e)}})}

/* ---------- Stimmen ---------- */
(function(){var qs=$$('#rvQ blockquote'),ds=$$('#rvDots button'),k=0,tm;function set(n){k=n;qs.forEach(function(q,i){q.classList.toggle('on',i===n)});ds.forEach(function(d,i){d.classList.toggle('on',i===n)})}ds.forEach(function(d,i){d.addEventListener('click',function(){set(i);clearInterval(tm);tm=setInterval(nx,7000)})});function nx(){set((k+1)%qs.length)}tm=setInterval(nx,7000)})();

/* ---------- Countdown ---------- */
var END=new Date(2027,1,28,23,59,59).getTime();
function cd(){var d=Math.max(0,END-Date.now()),v=[d/864e5|0,d/36e5%24|0,d/6e4%60|0,d/1e3%60|0];$$('.cd').forEach(function(c){$$('b',c).forEach(function(b,i){var s=String(v[i]).padStart(2,'0');if(b.textContent!==s)b.textContent=s})})}

/* ---------- Kopieren / Formular ---------- */
document.addEventListener('click',function(e){var b=e.target.closest('[data-copy]');if(!b)return;var t=b.dataset.copy,done=function(){var o=b.textContent;b.textContent='Kopiert ✓';setTimeout(function(){b.textContent=o},1600)};
  try{navigator.clipboard.writeText(t).then(done,function(){selTxt(b)})}catch(err){selTxt(b)}});
function selTxt(b){var el=b.parentNode.querySelector('b')||b.previousSibling;if(!el||!el.nodeType)return;try{var r=document.createRange();r.selectNodeContents(el.nodeType===1?el:el.parentNode);var s=getSelection();s.removeAllRanges();s.addRange(r);b.textContent='Markiert'}catch(e){}}
$('#fm').addEventListener('submit',function(e){e.preventDefault();this.classList.add('sent')});
$('#fmBack').addEventListener('click',function(){$('#fm').classList.remove('sent')});

/* ---------- Seiten-Inits ---------- */
var LADEN={f:'Alle'};
function renderGallery(){
  var ms=['Alle'].concat(BESTAND.map(function(b){return b.m}).filter(function(m,i,a){return a.indexOf(m)===i}));
  $('#flt').innerHTML=ms.map(function(m){return '<button class="'+(m===LADEN.f?'on':'')+'" data-f="'+esc(m)+'" aria-pressed="'+(m===LADEN.f)+'">'+esc(m)+'</button>'}).join('');
  var L=BESTAND.map(function(b,i){b.i=i;return b}).filter(function(b){return LADEN.f==='Alle'||b.m===LADEN.f});
  $('#gl').innerHTML=L.map(function(b){return '<button class="bk rv-in" data-i="'+b.i+'" data-cursor="Ansehen"><div class="im">'+(b.a?'<span class="tag">Angebot</span>':'')+'<img src="'+esc(b.b)+'" alt="'+esc(b.m+' '+b.mo)+'" loading="lazy" decoding="async"></div><div class="ti"><div><small>'+esc(b.m)+'</small><b>'+esc(b.mo)+'</b><span>'+esc(b.fa)+'</span></div><div class="pr">'+(b.a?'<s>'+eur(b.p)+'</s><b class="deal">'+eur(b.a)+'</b>':'<b>'+eur(b.p)+'</b>')+'</div></div></button>'}).join('');
  observeReveals($('#gl'));
}
document.addEventListener('click',function(e){var f=e.target.closest('#flt button');if(f){LADEN.f=f.dataset.f;renderGallery();return}var b=e.target.closest('#gl .bk');if(b)openDetail(BESTAND[+b.dataset.i])});
function openDetail(b){var dt=$('#dt');$('#dtImg').src=b.b;$('#dtImg').alt=b.m+' '+b.mo;
  var rows=[['Farbe',b.fa],['Modelljahr',b.j],['Rahmen',b.ra],['Rahmenhöhe',b.gr],['Motor',b.mot],['Akku',b.ak],['Schaltung',b.sc]].filter(function(r){return r[1]});
  $('#dtTx').innerHTML='<span class="eyebrow">'+esc(b.m)+' · im Laden</span><h2>'+esc(b.mo)+'</h2><div class="pr" style="text-align:left">'+(b.a?'<s>'+eur(b.p)+'</s><b class="deal" style="font-size:40px">'+eur(b.a)+'</b>':'<b style="font-size:40px">'+eur(b.p)+'</b>')+'</div><dl>'+rows.map(function(r){return '<dt>'+r[0]+'</dt><dd>'+esc(r[1])+'</dd>'}).join('')+'</dl>'+(b.a?'<p class="fine" style="margin:0">Angebotspreis gilt nicht bei Leasing &amp; Finanzierung.</p>':'')+'<div class="ctas"><a class="btn btn-red" href="#service" data-scroll="termin"><span class="roll"><span data-t="Probefahrt anfragen">Probefahrt anfragen</span></span><span class="ar">'+AR+'</span></a></div>';
  dt.classList.add('on');$('#dtX').hidden=false;body.style.overflow='hidden';}
function closeDetail(){var dt=$('#dt');if(!dt.classList.contains('on'))return;dt.classList.remove('on');$('#dtX').hidden=true;body.style.overflow=''}
$('#dtX').addEventListener('click',closeDetail);
$('#dt').addEventListener('click',function(e){if(e.target.closest('a'))closeDetail()});

var SPEC=[
 {big:'32 cm',sub:'Einstiegshöhe · kompakt und voll ausgestattet',v:['32 cm','173 cm','63–81 cm','16″ / 20″','100 kg','bis 25 km/h','✓','Ø 50 km','10 kg','möglich']},
 {big:'140 kg',sub:'max. Fahrergewicht · der Klassiker',v:['35 cm','225 cm','65–108 cm (Rahmen M und L)','20″ / 20″','140 kg, verstärkt 180 kg','bis 25 km/h','✓','Ø 50 km','20 kg','✓']}
];
var SPK=['Einstiegshöhe','Länge','Innenbeinlänge','Räder vorne / hinten','Max. Fahrergewicht','Elektrische Tretunterstützung','Rückwärts fahren','Reichweite (Standard-Akku)','Gepäck max.','Teilbarer Rahmen'];
function setDr(n,anim){var s=SPEC[n];$('#drBig').textContent=s.big;$('#drSub').textContent=s.sub;$('#spec').innerHTML=SPK.map(function(k,i){return '<li><span>'+k+'</span><b class="'+(anim?'ch':'')+'" style="animation-delay:'+(i*35)+'ms">'+esc(n===0&&i===9?'–':s.v[i])+'</b></li>'}).join('');
  $$('#sw button').forEach(function(b,i){b.classList.toggle('on',i===n);b.setAttribute('aria-selected',i===n)});var on=$$('#sw button')[n],sw=$('#sw i');sw.style.left=on.offsetLeft+'px';sw.style.width=on.offsetWidth+'px';
  $('#dr0').classList.toggle('off',n!==0);$('#dr1').classList.toggle('off',n!==1)}

var INIT={
 start:function(){setWord(HB[0].w,false);setMeta(HB[0],0)},
 marken:function(){var l=$('#bi');l.innerHTML=BRANDS.map(function(b){return '<li><a href="'+(b.href||'#im-laden')+'"'+(b.href?'':' data-brand="'+esc(b.k)+'"')+' data-img="'+b.img+'"><span class="lg"><img src="'+b.logo+'" alt="" loading="lazy"></span><div><h3>'+esc(b.k)+'</h3><p>'+esc(b.t)+'</p></div><span class="go">'+AR+'</span></a></li>'}).join('');bindHover(l)},
 'im-laden':function(){renderGallery()},
 dreirad:function(){$$('#sw button').forEach(function(b){b.addEventListener('click',function(){setDr(+b.dataset.m,true)})});requestAnimationFrame(function(){setDr(0,false)})},
 treffen:function(){var f=$('#film'),dn=false,x0=0,s0=0;f.addEventListener('mousedown',function(e){dn=true;x0=e.clientX;s0=f.scrollLeft;f.style.scrollSnapType='none';f.style.cursor='grabbing'});addEventListener('mouseup',function(){if(!dn)return;dn=false;f.style.scrollSnapType='';f.style.cursor=''});addEventListener('mousemove',function(e){if(dn)f.scrollLeft=s0-(e.clientX-x0)})}
};

/* ---------- Scroll-Szenen ---------- */
var vh=innerHeight,sr=$('#sr'),srT=$('#srTrack'),srDist=0;
function onResize(){vh=innerHeight;
  if(cur==='start'){fitBW();if(!isMob()){srDist=Math.max(0,srT.scrollWidth-innerWidth);sr.style.height=(srDist+vh)+'px'}else{sr.style.height='';srT.style.transform=''}}
  var wm=$('#wm');wm.style.setProperty('--wmfs','100px');var w=wm.scrollWidth||1;wm.style.setProperty('--wmfs',(100*(wm.parentNode.clientWidth)/w*.99).toFixed(1)+'px');
  if(cur==='dreirad'&&inited.dreirad){var on=$('#sw .on'),sw=$('#sw i');if(on){sw.style.left=on.offsetLeft+'px';sw.style.width=on.offsetWidth+'px'}}
}
addEventListener('resize',function(){clearTimeout(onResize.t);onResize.t=setTimeout(onResize,120)});
var sy=scrollY,ssy=scrollY;
function onScroll(force){
  var y=scrollY;
  if(y>30!==hd.classList.contains('sc'))hd.classList.toggle('sc',y>30);
  if(!body.classList.contains('mopen')){if(y>lastY+6&&y>500)hd.classList.add('hide');else if(y<lastY-6)hd.classList.remove('hide')}
  lastY=y;
}
addEventListener('scroll',function(){onScroll()},{passive:true});

function vis(el){var r=el.getBoundingClientRect();return r.bottom>-50&&r.top<vh+50?r:null}
function frame(t){
  requestAnimationFrame(frame);smooth();
  sy=scrollY;ssy=lerp(ssy,sy,.12);if(Math.abs(ssy-sy)<.1)ssy=sy;
  /* Cursor */
  if(fine){cx=lerp(cx,mx,.18);cy=lerp(cy,my,.18);cu.style.transform='translate3d('+mx+'px,'+my+'px,0)';cuB.style.translate=(cx-mx).toFixed(1)+'px '+(cy-my).toFixed(1)+'px';
    if(hvOn){hvx=lerp(hvx,mx,.14);hvy=lerp(hvy,my,.14);hv.style.left=hvx+'px';hv.style.top=hvy+'px'}else{hvx=mx;hvy=my}}
  if(cur==='start'){
    var p=clamp(sy/vh,0,1.2);
    tx=lerp(tx,tX,.07);ty=lerp(ty,tY,.07);
    if(p<1.1){
      tilt.style.transform='rotateY('+(tx*14).toFixed(2)+'deg) rotateX('+(-ty*8).toFixed(2)+'deg) translate3d('+(tx*18).toFixed(1)+'px,'+(ty*10).toFixed(1)+'px,0)';
      var bwT='translate3d('+(-tx*26-p*innerWidth*.12).toFixed(1)+'px,'+(p*60).toFixed(1)+'px,0)';
      bwB.style.transform=bwF.style.transform=bwT;
      if(!isMob())stage.style.transform='translate(-50%,-50%) translate3d(0,'+(p*110).toFixed(1)+'px,0) scale('+(1+p*.12).toFixed(3)+')';
      $('.hero-foot').style.transform='translate3d(0,'+(p*-40).toFixed(1)+'px,0)';$('.hero-foot').style.opacity=(1-p*1.1).toFixed(3);
    }
    /* Ring */
    var hr=heroBusy?0:clamp((performance.now()-heroT0)/HERO_MS,0,1);ring.style.strokeDashoffset=(176*(1-hr)).toFixed(1);
    if(hr>=1&&!heroBusy&&p<.8&&!document.hidden&&!body.classList.contains('mopen'))heroTo(hi+1);
    /* Statement */
    var st=$('.stmt p'),r=vis(st);if(r){var pr=clamp((vh*.85-r.top)/(r.height+vh*.35),0,1),ws=st.children,n=Math.round(pr*ws.length);for(var i=0;i<ws.length;i++){var on=i<n;if(ws[i].classList.contains('on')!==on)ws[i].classList.toggle('on',on)}}
    /* Showroom */
    if(!isMob()&&srDist){var rr=sr.getBoundingClientRect(),q=clamp(-rr.top/(rr.height-vh),0,1);srT.style.transform='translate3d('+(-q*srDist).toFixed(1)+'px,0,0)';$('#srProg').style.transform='scaleX('+q.toFixed(4)+')'}
  }
  /* Parallax-Bilder */
  PXL.forEach(function(im){var r=vis(im.parentNode);if(r){var c=(r.top+r.height/2-vh/2)/vh;im.style.setProperty('--py',(c*-8).toFixed(2)+'%')}});
  VSL.forEach(function(v){var r=vis(v);if(r){var q=clamp((vh-r.top)/(vh*.9),0,1);v.style.setProperty('--ci',((1-q)*10).toFixed(2)+'%');v.style.setProperty('--cs',(1.18-q*.18).toFixed(3))}});
  if(cur==='isy'){var bus=$('#bus'),br=vis(bus);if(br){var q2=clamp((vh-br.top)/(vh+br.height),0,1);$('#bus img').style.setProperty('--bx',(30-q2*70).toFixed(2)+'%')}}
}

/* ---------- Weiches Scrollen (Mausrad, Desktop) ---------- */
var sTgt=null;
if(fine){addEventListener('wheel',function(e){
  if(e.ctrlKey||busy||body.classList.contains('mopen')||$('#dt').classList.contains('on'))return;
  if(e.target.closest('.film,.sr-track,textarea'))return;
  e.preventDefault();
  var max=root.scrollHeight-innerHeight;var d=e.deltaMode===1?e.deltaY*40:e.deltaY;
  sTgt=clamp((sTgt==null?scrollY:sTgt)+d,0,max);
},{passive:false});
['keydown','mousedown','touchstart'].forEach(function(t){addEventListener(t,function(){sTgt=null},{passive:true})})}
function smooth(){if(sTgt==null)return;var y=scrollY,ny=lerp(y,sTgt,.1);if(Math.abs(sTgt-ny)<.6){ny=sTgt;sTgt=null}window.scrollTo(0,ny)}

/* ---------- Start ---------- */
renderStatus();setInterval(renderStatus,30000);cd();setInterval(cd,1000);
var first=pageName();
function boot(){show(first);requestAnimationFrame(frame)}
var skipLoader=false;try{skipLoader=sessionStorage.getItem('vcEd')==='1';sessionStorage.setItem('vcEd','1')}catch(e){}
if(skipLoader){boot()}else{
  LOADING=true;var ld=document.createElement('div');ld.className='ld';ld.innerHTML='<img src="img/velocenter-logo.svg" alt=""><span class="ld-t">Velocenter Hessert<br>Wörth am Rhein · seit 1995</span><span class="ld-n"><span id="ldn">0</span><sup>%</sup></span>';body.appendChild(ld);
  var t0=performance.now();(function f(t){var p=clamp((t-t0)/1300,0,1),e=1-Math.pow(1-p,3);$('#ldn').textContent=Math.round(e*100);if(p<1)requestAnimationFrame(f);else{boot();setTimeout(function(){LOADING=false;ld.classList.add('go');setTimeout(function(){ld.remove()},1100)},120)}})(t0);
}
})();
