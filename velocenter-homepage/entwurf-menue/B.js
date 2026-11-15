(function(){const n=document.getElementById('nav'),w=document.querySelector('.hdr .owrap');if(!n||!w)return;
n.querySelectorAll('a[data-r]').forEach(a=>{const t=[...a.childNodes].find(x=>x.nodeType===3&&x.textContent.trim());if(t){const s=document.createElement('span');s.className='vt';s.textContent=t.textContent.trim();a.replaceChild(s,t)}});
const m=document.createElement('div');m.className='lmd';m.innerHTML='<div class="lmc"></div>';m.firstChild.appendChild(w);
const after=n.querySelector('a[data-r=lager]');after.after(m);
if(typeof hdrFit==='function')setTimeout(hdrFit,50)})();
