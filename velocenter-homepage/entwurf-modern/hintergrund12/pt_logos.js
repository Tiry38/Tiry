/* Einmalig/bei neuen Logos: Markenlogos (SVG) im Browser in Partikel zerlegen → pt/marke-*.bin + pt/logos.json (Prüfsummen).
   Aufruf: node pt_logos.js <ordner mit img/marke-*.svg>   (gleiche Regel wie partikel.py, 650 Punkte) */
const {chromium}=require('playwright');const fs=require('fs'),path=require('path'),crypto=require('crypto');
const Q=process.argv[2],OUT=path.join(__dirname,'pt');
(async()=>{const b=await chromium.launch();const p=await b.newPage();const L={};
 for(const f of fs.readdirSync(path.join(Q,'img')).filter(x=>/^marke-.*\.svg$/.test(x)).sort()){
  const svg=fs.readFileSync(path.join(Q,'img',f));L[f]=crypto.createHash('sha256').update(svg).digest('hex').slice(0,16);
  const arr=await p.evaluate(async([d,seed])=>{const im=new Image();im.src='data:image/svg+xml;base64,'+d;await im.decode();
   let s=0;for(const c of seed)s=(s*31+c.charCodeAt(0))>>>0;s=s||1;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
   const k=400/Math.max(im.naturalWidth,im.naturalHeight),cw=Math.max(2,Math.round(im.naturalWidth*k)),ch=Math.max(2,Math.round(im.naturalHeight*k));
   const c=document.createElement('canvas');c.width=cw;c.height=ch;const x=c.getContext('2d');x.drawImage(im,0,0,cw,ch);const D=x.getImageData(0,0,cw,ch).data,P=[];
   for(let j=0;j<ch;j++)for(let i=0;i<cw;i++){const o=(j*cw+i)*4;if(D[o+3]>140)P.push([(i+.2+rnd()*.6)/cw,(j+.2+rnd()*.6)/ch,D[o],D[o+1],D[o+2]])}
   if(!P.length)P.push([.5,.5,128,128,128]);for(let i=P.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[P[i],P[j]]=[P[j],P[i]]}
   const N=650,out=P.length>=N?P.slice(0,N):Array.from({length:N},()=>P[Math.floor(rnd()*P.length)]);
   const buf=new DataView(new ArrayBuffer(N*7));out.forEach((q,i)=>{buf.setUint16(i*7,Math.min(65535,Math.floor(q[0]*65535)),true);buf.setUint16(i*7+2,Math.min(65535,Math.floor(q[1]*65535)),true);buf.setUint8(i*7+4,q[2]);buf.setUint8(i*7+5,q[3]);buf.setUint8(i*7+6,q[4])});
   return Array.from(new Uint8Array(buf.buffer))},[svg.toString('base64'),f]);
  fs.writeFileSync(path.join(OUT,f.replace(/\.svg$/,'.bin')),Buffer.from(arr));console.log(f,arr.length)}
 fs.writeFileSync(path.join(OUT,'logos.json'),JSON.stringify(L,null,1)+'\n');await b.close()})();
