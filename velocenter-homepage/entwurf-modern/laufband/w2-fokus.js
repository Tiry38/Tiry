(function(){var F=null,K=null,MO=null;function sync(bt){var a=bt.querySelector('.band.a'),tk=a&&a.querySelector('.tk:not(.tkf)');if(!tk)return;
 if(!F){F=document.createElement('div');F.className='lbF';F.setAttribute('aria-hidden','true');K=document.createElement('div');K.className='tk tkf';F.appendChild(K);a.appendChild(F)}
 K.innerHTML=tk.innerHTML;requestAnimationFrame(function(){var o=tk.getAnimations&&tk.getAnimations()[0],c=K.getAnimations&&K.getAnimations()[0];if(o&&c){c.currentTime=o.currentTime;c.playbackRate=o.playbackRate}})}
LBV.push({name:'Fokus-Zone',info:'Große Umriss-Schrift, in der Bildmitte füllt sie sich rot',
 on:function(bt){sync(bt);F.style.display='';if(!MO){MO=new MutationObserver(function(){sync(bt)});MO.observe(bt.querySelector('.band.a .tk'),{childList:true})}},
 off:function(){if(F)F.style.display='none'},
 tick:function(st){if(!F||!K)return;var tk=st.bt.querySelector('.band.a .tk:not(.tkf)'),o=tk.getAnimations&&tk.getAnimations()[0],c=K.getAnimations&&K.getAnimations()[0];
  if(o&&c&&Math.abs((c.currentTime||0)-(o.currentTime||0))>30)c.currentTime=o.currentTime}});})();
