/* Umschalter der Vorlage: Wie jetzt / Verwandlung + „Nächstes Rad“ (Taste V schaltet, Taste N = nächstes Rad) */
(function(){const K='vc_vm';const w=document.createElement('div');w.className='vms';w.setAttribute('role','group');w.setAttribute('aria-label','Rad-Wechsel umschalten');
 w.innerHTML='<small>Rad-Wechsel</small><div class="sg"><i aria-hidden="true"></i><button type="button">Wie jetzt</button><button type="button">Verwandlung</button></div><button type="button" class="nx" aria-label="Nächstes Rad"><svg viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6"/></svg></button>';
 document.body.appendChild(w);const b=[...w.querySelectorAll('.sg button')];
 const set=on=>{VM.on=on;document.documentElement.classList.toggle('vmon',on);try{localStorage.setItem(K,on?'1':'0')}catch(_){}b.forEach((x,i)=>x.setAttribute('aria-pressed',String(i===(on?1:0))))};
 b[0].addEventListener('click',()=>set(false));b[1].addEventListener('click',()=>set(true));
 const next=()=>{const v=(document.querySelector('.view:not([hidden])')||{}).dataset;if(v&&v.v==='marken'){const n=document.getElementById('m-sn');if(n)n.click()}else if(window.VMhero)VMhero(true)};
 w.querySelector('.nx').addEventListener('click',next);
 addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName||''))return;if(e.key==='v')set(!VM.on);if(e.key==='n')next()});
 let on=true;try{on=localStorage.getItem(K)!=='0'}catch(_){}set(on);
 if(!VM.ok){w.querySelector('small').textContent='Kein WebGL – nur „Wie jetzt“'}})();
