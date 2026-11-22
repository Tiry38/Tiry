(function(){var D=null,MO=null;function sync(bt){var a=bt.querySelector('.band.a'),tk=a&&a.querySelector('.tk');if(!tk)return;
 if(!D){D=document.createElement('div');D.className='tkd';D.setAttribute('aria-hidden','true');a.insertBefore(D,a.firstChild)}D.innerHTML=tk.innerHTML}
LBV.push({name:'Glas-Monolith',info:'Gerade Glasschiene, rote Tiefe dahinter, Lichtleiter unten',
 on:function(bt){sync(bt);D.style.display='';if(!MO){MO=new MutationObserver(function(){sync(bt)});MO.observe(bt.querySelector('.band.a .tk'),{childList:true})}},
 off:function(){if(D)D.style.display='none'}});})();
