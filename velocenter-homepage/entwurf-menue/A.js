(function(){const I={start:'i-heart',service:'i-wrench',marken:'i-star',lager:'i-box',isy:'i-bike',treffen:'i-spark',dreirad:'i-tri',kontakt:'i-pin'};
document.querySelectorAll('#nav a[data-r]').forEach(a=>{const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('class','vi');s.setAttribute('aria-hidden','true');s.innerHTML='<use href="#'+(I[a.dataset.r]||'i-spark')+'"/>';a.prepend(s)});
if(typeof hdrFit==='function')setTimeout(hdrFit,50)})();
