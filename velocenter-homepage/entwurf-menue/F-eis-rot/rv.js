(function(){const w=document.querySelector('.erl .errw');if(w&&!w.querySelector('.erx')){
 const x=document.createElement('i');x.className='erx';w.appendChild(x);
 const f=document.createElement('div');f.className='erinfo';
 f.innerHTML='<div class="ertk"><div class="rail"></div></div><div class="erkz"><div><b>300+</b><small>E-Bikes vor Ort</small></div><div><b>4,8<em>★</em></b><small>bei Google</small></div><div><b>1995</b><small>Familienbetrieb</small></div></div>';w.appendChild(f);
 const T=['Bosch Service Center','★ 4,8 bei Google · 221 Rezensionen','Über 300 E-Bikes vor Ort','Hartmannstraße 25 · Wörth am Rhein','Telefon 07271 78033'];
 function stat(){const p=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date());
  const g=k=>(p.find(z=>z.type===k)||{}).value||'';const D=['Mo','Di','Mi','Do','Fr','Sa','So'],d=D.indexOf(g('weekday').replace('.','')),m=+g('hour')*60+ +g('minute');
  const H=d=>d===5?[[540,720]]:(d===2||d===6||d<0)?[]:[[540,720],[870,1080]];const hh=v=>String(Math.floor(v/60)).padStart(2,'0')+':'+String(v%60).padStart(2,'0');
  const o=H(d).find(r=>m>=r[0]&&m<r[1]);if(o)return[1,'Jetzt geöffnet bis '+hh(o[1])];
  const n=H(d).find(r=>m<r[0]);if(n)return[0,'Geschlossen · heute ab '+hh(n[0])];
  for(let i=1;i<8;i++){const k=(d+i)%7,r=H(k);if(r.length)return[0,'Geschlossen · ab '+D[k]+' '+hh(r[0][0])]}return[0,'Geschlossen']}
 function fill(){const s=stat(),one='<span class="st'+(s[0]?'':' zu')+'"><i></i>'+s[1]+'</span>'+T.map(t=>'<span>'+t+'</span>').join('');f.querySelector('.rail').innerHTML=one+one}
 window.erStat=stat;fill();setInterval(fill,60000)}
})();
