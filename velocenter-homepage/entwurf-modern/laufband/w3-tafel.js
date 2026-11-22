(function(){var MO=null;function num(bt){var tk=bt.querySelector('.band.a .tk');if(!tk)return;var n=(tk.closest('.band').querySelector('.tk').dataset.t||'').split('|').length||1;
 [].forEach.call(tk.children,function(s,i){var v=String(i%n+1);if(s.getAttribute('data-n')!==(v.length<2?'0'+v:v))s.setAttribute('data-n',v.length<2?'0'+v:v)})}
LBV.push({name:'Präzisions-Tafel',info:'Anzeigetafel mit roter Schiene, Positionsnummern, Zeiger markiert',
 on:function(bt){num(bt);if(!MO){MO=new MutationObserver(function(){num(bt)});MO.observe(bt.querySelector('.band.a .tk'),{childList:true})}}});})();
