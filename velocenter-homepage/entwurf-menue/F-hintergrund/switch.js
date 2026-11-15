(function(){const V=[['1','Perle','linear-gradient(115deg,#F7F2EA,#E4EEF7 35%,#E0F2EF 55%,#F6EDDF)'],['2','Gletscher','linear-gradient(170deg,#C9DFF2,#A9CBEA)'],['3','Eis & Rot','linear-gradient(115deg,#DCE8F4 52%,#fff 52% 55%,#A3102A 55%,#5E0B1A)'],['4','Kristall','linear-gradient(115deg,#F6F8FA 0 30%,#D2E3F1 30% 55%,#EAF1F7 55% 75%,#D9E7F3 75%)'],['5','Stahl','linear-gradient(180deg,#A9BACB,#F1F3F5)']];
let cur='1';try{cur=localStorage.getItem('bgv')||'1'}catch(_){}
const d=document.createElement('div');d.className='bgsw';d.setAttribute('role','group');d.setAttribute('aria-label','Hintergrund wählen');
d.innerHTML='<span class="lab"><small>Stil</small><b class="nm"></b></span>'+V.map(v=>`<button type="button" data-v="${v[0]}" style="--sw:${v[2]}" title="${v[1]}" aria-label="Hintergrund ${v[0]}: ${v[1]}">${v[0]}</button>`).join('');
document.body.appendChild(d);
function set(v){cur=v;document.documentElement.setAttribute('data-bgv',v);d.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===v));d.querySelector('.nm').textContent=V.find(x=>x[0]===v)[1];try{localStorage.setItem('bgv',v)}catch(_){}}
d.addEventListener('click',e=>{const b=e.target.closest('button');if(b)set(b.dataset.v)});
addEventListener('keydown',e=>{if(/^[1-5]$/.test(e.key)&&!/INPUT|TEXTAREA|SELECT/.test((e.target||{}).tagName||''))set(e.key)});
set(cur)})();
