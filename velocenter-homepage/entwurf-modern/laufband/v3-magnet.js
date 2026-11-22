/* 3 · Magnet-Lettern – jeder Buchstabe ist ein eigener Körper: in der Nähe des Zeigers hebt er sich, kippt in 3D zum Zeiger
   und glüht (Feder-Physik pro Buchstabe). Scrollen schickt eine Welle durch alle Buchstaben. Band: rot gebürstetes Metall. */
(function(){var on=false,MO=null,L=[];
function split(tk){var out=[];(function w(n){[].slice.call(n.childNodes).forEach(function(c){
  if(c.nodeType===3){if(!c.nodeValue.trim()&&c.nodeValue.length<2)return;var f=document.createDocumentFragment();
   c.nodeValue.split('').forEach(function(ch){var i=document.createElement('i');i.className='lt';i.textContent=ch===' '?'\u00A0':ch;f.appendChild(i)});c.parentNode.replaceChild(f,c)}
  else if(c.nodeType===1&&c.tagName!=='EM'){if(c.tagName==='I'&&c.parentNode.classList.contains('tkg')){c.classList.add('lt');return}w(c)}})})(tk)}
function prep(bt){L=[];bt.querySelectorAll('.band .tk').forEach(function(tk){if(!tk.querySelector('.lt'))split(tk);
  var band=tk.closest('.band'),fr=band.classList.contains('a');tk.querySelectorAll('.lt').forEach(function(e){L.push({e:e,tk:tk,fr:fr,ox:0,y:0,vy:0,s:0,vs:0,r:0,vr:0,act:false})})});
 var tks={};L.forEach(function(o){var k=o.tk;if(!k._r)k._r=k.getBoundingClientRect();o.ox=o.e.getBoundingClientRect().left-k._r.left+o.e.offsetWidth/2});
 bt.querySelectorAll('.band .tk').forEach(function(k){k._r=null})}
LBV.push({name:'Magnet-Lettern',info:'Jeder Buchstabe federt zur Maus, Scrollen schickt eine Welle',
 on:function(bt){on=true;prep(bt);if(!MO){MO=new MutationObserver(function(){if(on)setTimeout(function(){prep(bt)},30)});
  bt.querySelectorAll('.band .tk').forEach(function(t){MO.observe(t,{childList:true})})}},
 off:function(){on=false;L.forEach(function(o){o.e.style.transform='';o.e.style.textShadow='';o.e.style.color=''})},
 tick:function(st,dt){if(!on||!L.length)return;var bt=st.bt,R={},n=Math.max(1,Math.round(dt/.008)),h=dt/n,vw=innerWidth;
  bt.querySelectorAll('.band .tk').forEach(function(k){var r=k.getBoundingClientRect(),b=k.closest('.band').getBoundingClientRect();k._x=r.left;k._cy=b.top+b.height/2});
  for(var j=0;j<L.length;j++){var o=L[j],x=o.tk._x+o.ox;if(x<-60||x>vw+60){if(o.act){o.e.style.transform='';o.e.style.textShadow='';o.act=false;o.y=o.s=o.r=o.vy=o.vs=o.vr=0}continue}
   var dx=x-st.cx,dy=o.tk._cy-st.cy,d=Math.sqrt(dx*dx+dy*dy*1.6),f=Math.max(0,1-d/170);f=f*f*(3-2*f);
   var wave=Math.sin(x*.018-st.T*9)*Math.min(1,st.v*.6)*(o.fr?7:5);
   var gy=-f*(o.fr?16:11)+wave,gs=f*(o.fr?.42:.3),gr=f*Math.max(-1,Math.min(1,dx/90))*-28;
   if(!o.act&&Math.abs(gy)<.05&&gs<.002&&Math.abs(o.y)<.05&&Math.abs(o.s)<.002)continue;
   for(var i=0;i<n;i++){o.vy+=((gy-o.y)*210-o.vy*13)*h;o.y+=o.vy*h;o.vs+=((gs-o.s)*210-o.vs*13)*h;o.s+=o.vs*h;o.vr+=((gr-o.r)*170-o.vr*12)*h;o.r+=o.vr*h}
   o.act=Math.abs(o.y)>.05||Math.abs(o.s)>.002||Math.abs(o.r)>.1||f>0;
   o.e.style.transform=o.act?'translateY('+o.y.toFixed(2)+'px) scale('+(1+o.s).toFixed(3)+') rotateY('+o.r.toFixed(1)+'deg)':'';
   o.e.style.textShadow=o.act&&o.s>.02?(o.fr?'0 0 '+(6+o.s*40).toFixed(0)+'px rgba(255,255,255,'+Math.min(.95,o.s*2.4).toFixed(2)+'),0 '+(2+o.s*20).toFixed(0)+'px '+(6+o.s*30).toFixed(0)+'px rgba(70,0,14,.5)':'0 0 '+(6+o.s*40).toFixed(0)+'px rgba(255,70,85,'+Math.min(.9,o.s*2.6).toFixed(2)+')'):''}}});
})();
