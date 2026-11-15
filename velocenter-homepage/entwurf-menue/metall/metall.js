(function(){const H=document.documentElement,K='vc_mtl';
 const set=on=>{H.classList.toggle('mtl',on);try{localStorage.setItem(K,on?'1':'0')}catch(_){}b.forEach((x,i)=>x.setAttribute('aria-pressed',String(i===(on?1:0))))};
 const w=document.createElement('div');w.className='mts';w.setAttribute('role','group');w.setAttribute('aria-label','Rote Fläche umschalten');
 w.innerHTML='<small>Rote Fläche</small><div class="sg"><i aria-hidden="true"></i><button type="button">Wie jetzt</button><button type="button">Metall gebürstet</button></div>';
 document.body.appendChild(w);const b=[...w.querySelectorAll('button')];
 b[0].addEventListener('click',()=>set(false));b[1].addEventListener('click',()=>set(true));
 addEventListener('keydown',e=>{if(e.key==='m'&&!/INPUT|TEXTAREA|SELECT/.test((e.target.tagName||'')))set(!H.classList.contains('mtl'))});
 let on=true;try{on=localStorage.getItem(K)!=='0'}catch(_){}set(on)})();
