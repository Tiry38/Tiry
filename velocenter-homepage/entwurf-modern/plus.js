/* Vorlage „plus“: Handy-Kopf klappt beim Runterscrollen die Öffnungs-Zeile weg (beim Hochscrollen wieder da),
   Kopfhöhe als --plH für den Seitenanfang, Scroll-Wert --pl-sy für die Tiefenebenen. */
(function(){
 var lastH='',mn=document.getElementById('main'),de=document.documentElement,dp=document.querySelector('.pl-depth'),hdr=document.querySelector('.hdr'),mq=matchMedia('(max-width:980px)'),last=scrollY,acc=0,tk=0;
 function setH(){if(!hdr)return;var hide=de.classList.contains('pl-hide');if(hide)return;/* nur die volle Höhe zählt für den Seitenanfang */
  var v=Math.round(hdr.getBoundingClientRect().height)+'px';if(v===lastH||!mn)return;lastH=v;mn.style.setProperty('--plH',v)}/* Tempo 19.11.2026: nur an #main (@property ohne Vererbung) */
 function onScroll(){tk=0;var y=scrollY,d=y-last;last=y;
  if(dp)dp.style.setProperty('--pl-sy',Math.round(y));/* Tempo 19.11.2026: nur an .pl-depth, an der Wurzel rechnete jedes Scroll-Bild die ganze Seite neu */
  if(!mq.matches){de.classList.remove('pl-hide');return}
  if(y<60){de.classList.remove('pl-hide');acc=0;return}
  acc=(d>0)===(acc>0)?acc+d:d;
  if(acc>24)de.classList.add('pl-hide');else if(acc<-36)de.classList.remove('pl-hide')}
 addEventListener('scroll',function(){if(!tk){tk=1;requestAnimationFrame(onScroll)}},{passive:true});
 addEventListener('resize',setH);addEventListener('load',setH);setH();
 /* Seitenwechsel im Router: Kopf wieder voll zeigen */
 addEventListener('hashchange',function(){de.classList.remove('pl-hide');acc=0});
 if(window.ResizeObserver&&hdr)new ResizeObserver(setH).observe(hdr);
})();
