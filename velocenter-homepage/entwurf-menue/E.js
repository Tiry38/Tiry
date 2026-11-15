(function(){const n=document.getElementById('nav');if(!n)return;
n.querySelectorAll('a[data-r]').forEach(a=>{if(a.querySelector('.bt'))return;const s=document.createElement('span');s.className='bt';while(a.firstChild)s.appendChild(a.firstChild);a.appendChild(s)});
if(typeof hdrFit==='function')setTimeout(hdrFit,60)})();
