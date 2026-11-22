/* Federn: Scroll-Tempo und Zeiger kippen die Bänder, eine gedämpfte Feder bringt sie zurück (mit leichtem Nachschwingen) */
(function(){var A={x:-1.6,v:0},B={x:1.3,v:0},YA={x:0,v:0},YB={x:0,v:0};
function spr(s,goal,dt){s.v+=((goal-s.x)*120-s.v*11)*dt;s.x+=s.v*dt}
LB('lb3',function(st,dt){var n=Math.max(1,Math.round(dt/.008)),h=dt/n,lean=st.over?(st.px-.5):0,mv=st.over?(st.py-.5):0;
 for(var i=0;i<n;i++){spr(A,-1.6-st.v*1.4-lean*1.2,h);spr(B,1.3+st.v*1.2-lean*.8,h);spr(YA,-st.v*4+mv*6,h);spr(YB,st.v*4-mv*4,h)}
 var a=st.bt.querySelector('.band.a'),b=st.bt.querySelector('.band.b');
 if(a){a.style.setProperty('--ra',A.x.toFixed(3)+'deg');a.style.setProperty('--ya',YA.x.toFixed(2)+'px')}
 if(b){b.style.setProperty('--rb',B.x.toFixed(3)+'deg');b.style.setProperty('--yb',YB.x.toFixed(2)+'px')}});
})();
