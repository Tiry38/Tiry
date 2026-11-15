(function(){const E={start:'Home',service:'Werkstatt',marken:'Hersteller',lager:'Live · 300+',isy:'seit 2015',treffen:'Weltrekord',dreirad:'3 Räder',kontakt:'Wörth'};
document.querySelectorAll('#nav a[data-r]').forEach(a=>{a.dataset.e=E[a.dataset.r]||'';const t=[...a.childNodes].find(x=>x.nodeType===3&&x.textContent.trim());if(t){const s=document.createElement('span');s.className='vt';s.textContent=t.textContent.trim();a.replaceChild(s,t)}});
if(typeof hdrFit==='function')setTimeout(hdrFit,50)})();
