import * as THREE from 'three';


function make2106(){
 const root=new THREE.Group();
 const mat=(color,roughness=.72,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
 const black=mat(0x17191a,.86), padded=mat(0x292c2e,.87), edge=mat(0x090b0c,.65), red=mat(0x7d1522,.82), chrome=mat(0x9fa5a5,.35,.12), face=mat(0x121819,.8);
 const mesh=(geo,m,x,y,z)=>{let o=new THREE.Mesh(geo,m);o.position.set(x,y,z);root.add(o);return o};
 const box=(w,h,d,x,y,z,m)=>mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z);
 const disk=(r,x,y,z,m)=>mesh(new THREE.CircleGeometry(r,48),m,x,y,z);
 const ring=(r,t,x,y,z,m)=>mesh(new THREE.TorusGeometry(r,t,10,64),m,x,y,z);
 const woodCanvas=document.createElement('canvas');woodCanvas.width=512;woodCanvas.height=128;
 const w=woodCanvas.getContext('2d');w.fillStyle='#603516';w.fillRect(0,0,512,128);
 for(let i=0;i<75;i++){let y=(i*47)%128;w.strokeStyle=i%3===0?'#a97539':'#3a200f';w.globalAlpha=.12+(i%4)*.035;w.lineWidth=i%4===0?2:1;w.beginPath();w.moveTo(0,y);w.bezierCurveTo(140,y+Math.sin(i)*7,340,y-Math.cos(i)*7,512,y+2);w.stroke()}w.globalAlpha=1;
 const woodtex=new THREE.CanvasTexture(woodCanvas);woodtex.colorSpace=THREE.SRGBColorSpace;
 const wood=new THREE.MeshStandardMaterial({map:woodtex,roughness:.43,metalness:.04});
 // Dashboard and the broad veneer strip characteristic of the 2106.
 box(2.2,.29,.30,.39,-.50,-1.00,padded);
 box(2.15,.035,.16,.39,-.335,-1.01,black);
 box(2.04,.12,.035,.38,-.56,-.83,wood);
 box(2.05,.009,.02,.38,-.625,-.806,chrome);
 box(.79,.31,.09,-.04,-.445,-.81,black);
 box(.76,.23,.025,-.04,-.47,-.755,wood);
 function gauge(x,y,r,max,unit){
  disk(r*1.13,x,y,-.728,edge);ring(r*1.03,.006,x,y,-.716,chrome);disk(r*.96,x,y,-.709,face);
  const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.translate(128,128);
  ctx.fillStyle='#e2e5de';ctx.strokeStyle='#e5e7dd';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 17px Arial';ctx.lineWidth=3;
  for(let i=0;i<=10;i++){const a=Math.PI*.75+i*Math.PI*1.5/10;let sx=Math.cos(a),sy=Math.sin(a);ctx.beginPath();ctx.moveTo(sx*98,sy*98);ctx.lineTo(sx*(i%2?86:78),sy*(i%2?86:78));ctx.stroke();if(!(i%2))ctx.fillText(String(Math.round(max*i/10)),sx*61,sy*61)}
  ctx.font='12px Arial';ctx.fillText(unit,0,37);ctx.strokeStyle='#e7b49b';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(7,-5);ctx.lineTo(-48,48);ctx.stroke();ctx.fillStyle='#ddd';ctx.beginPath();ctx.arc(0,0,6,0,7);ctx.fill();
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const p=mesh(new THREE.PlaneGeometry(r*1.8,r*1.8),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}),x,y,-.700);return p;
 }
 gauge(-.29,-.47,.052,100,'');gauge(-.17,-.47,.052,100,'');gauge(-.055,-.47,.052,100,'');
 gauge(.08,-.45,.096,80,'x100');gauge(.285,-.45,.096,180,'km/h');
 // Two oval top vents, center clock, radio and horizontal heater controls.
 for(let x of [.54,.75]){let outer=ring(.060,.006,x,-.385,-.805,chrome);outer.scale.y=.70;let ins=disk(.053,x,-.385,-.800,edge);ins.scale.y=.70;for(let y of [-.405,-.39,-.375])box(.075,.003,.008,x,y,-.792,chrome)}
 gauge(.65,-.49,.043,12,'');
 box(.40,.105,.04,.65,-.68,-.83,edge);
 for(let y of [-.65,-.67,-.69])box(.32,.005,.012,.65,y,-.802,chrome);
 box(.23,.055,.03,.65,-.765,-.83,black);for(let x of [.56,.62,.68,.74])disk(.014,x,-.765,-.807,chrome);
 // Thin, near-circular two-spoke steering wheel with a long horn bar.
 const wheel=new THREE.Group();wheel.position.set(0,-.48,-.49);root.add(wheel);
 let wr=new THREE.Mesh(new THREE.TorusGeometry(.265,.012,12,96),edge);wheel.add(wr);
 let wr2=new THREE.Mesh(new THREE.TorusGeometry(.251,.003,8,96),chrome);wr2.position.z=.007;wheel.add(wr2);
 let horn=new THREE.Mesh(new THREE.BoxGeometry(.43,.055,.035),chrome);horn.position.set(0,0,.012);wheel.add(horn);
 let hornpad=new THREE.Mesh(new THREE.BoxGeometry(.30,.044,.042),black);hornpad.position.set(0,0,.03);wheel.add(hornpad);
 let emblem=new THREE.Mesh(new THREE.BoxGeometry(.038,.034,.008),chrome);emblem.position.set(0,0,.056);wheel.add(emblem);
 // Cream body surround, black roof and red door trim are separate from
 // the solid shell used for the exterior model.
 const pillar=mat(0xa49d89,.75), lining=mat(0x292827,.94);
 box(2.35,.12,.95,.22,.43,-.53,lining);
 box(2.18,.065,.09,.19,.365,-.92,black);
 const lp=box(.09,.98,.12,-.80,-.03,-.85,pillar);lp.rotation.z=-.22;
 const rp=box(.09,.98,.12,1.13,-.03,-.85,pillar);rp.rotation.z=.22;
 const ls=box(.025,.97,.14,-.74,-.03,-.855,edge);ls.rotation.z=-.22;
 const rs=box(.025,.97,.14,1.07,-.03,-.855,edge);rs.rotation.z=.22;
 box(.08,.56,1.35,-.92,-.58,-.20,red);box(.08,.56,1.35,1.25,-.58,-.20,red);
 box(.09,.08,1.35,-.92,-.30,-.20,black);box(.09,.08,1.35,1.25,-.30,-.20,black);
 for(let y of [-.43,-.53,-.63]){box(.012,.006,1.13,-.873,y,-.20,chrome);box(.012,.006,1.13,1.203,y,-.20,chrome)}
 // Upholstered floor, transmission tunnel and seats.
 const carpet=mat(0x68111c,.98),seatFabric=mat(0xb21d31,.94),seatInset=mat(0x8d1727,.96),stitch=mat(0xcf4653,.95);
 box(2.05,.08,2.25,.16,-1.08,-.10,carpet);
 box(.28,.20,1.35,.36,-.96,-.20,black);
 for(let sx of [-.02,.82]){
  box(.64,.17,.68,sx,-.88,.06,seatFabric);
  box(.54,.025,.55,sx,-.785,.06,seatInset);
  for(let k=-2;k<=2;k++)box(.007,.007,.52,sx+k*.09,-.769,.06,stitch);
  box(.64,.70,.14,sx,-.52,.43,seatFabric);
  box(.52,.54,.02,sx,-.52,.345,seatInset);
  for(let k=-2;k<=2;k++)box(.007,.50,.005,sx+k*.09,-.52,.331,stitch);
  box(.25,.16,.12,sx,-.08,.43,seatFabric);
 }
 // Console, gear lever and pedal set.
 box(.36,.24,.22,.59,-.80,-.75,black);
 const lever=box(.035,.28,.035,.45,-.83,-.49,chrome);lever.rotation.x=-.22;
 mesh(new THREE.SphereGeometry(.055,24,16),edge,.45,-.69,-.52);
 for(let px of [-.24,-.09,.07]){const pedal=box(.085,.16,.025,px,-.96,-.79,edge);pedal.rotation.x=-.18}
 // Extend the red door and its window frame to meet the dash and roof.
 box(.10,.54,.45,-.91,-.57,-.88,red);
 box(.10,.075,.47,-.91,-.30,-.88,black);
 const sill=box(.09,.10,1.85,-.91,-.88,-.15,black);
 const backPillar=box(.085,1.1,.10,-.91,-.03,.56,pillar);backPillar.rotation.z=-.02;
 box(.11,.08,1.65,-.89,.36,-.10,black);
 wheel.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.depthTest=false;o.material.depthWrite=false;o.renderOrder=100;}});
 return root;
}

// Compact, model-specific cockpit detail for the driver's view.
export function makeCockpit(isKalina, is2106=false) {
 if(is2106)return make2106();
 const root=new THREE.Group();
 const plastic=new THREE.MeshStandardMaterial({color:isKalina?0x383b3c:0x222321,roughness:.87});
 const dark=new THREE.MeshStandardMaterial({color:0x101211,roughness:.78});
 const trim=new THREE.MeshStandardMaterial({color:isKalina?0x676b6a:0x51463a,roughness:.63,metalness:.08});
 const pale=new THREE.MeshStandardMaterial({color:0xa4a8a2,roughness:.6});
 function box(w,h,d,x,y,z,mat=plastic){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);root.add(m);return m}
 function disk(r,x,y,z,mat=dark){const m=new THREE.Mesh(new THREE.CircleGeometry(r,48),mat);m.position.set(x,y,z);root.add(m);return m}
 function ring(r,t,x,y,z,mat=dark){const m=new THREE.Mesh(new THREE.TorusGeometry(r,t,12,64),mat);m.position.set(x,y,z);root.add(m);return m}
 // The eye is the origin; forward is negative Z.
 box(2.08,.26,.36,.39,-.54,-1.02);
 box(1.04,.12,.28,.02,-.37,-1.05,dark);
 const fascia=box(isKalina?.76:.84,.31,.10,.03,-.48,-.81,dark);
 if(isKalina)fascia.scale.y=.9;
 function gauge(x,y,r,max){
   disk(r,x,y,-.744);ring(r,.008,x,y,-.735,trim);
   const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
   const ctx=canvas.getContext('2d');ctx.clearRect(0,0,256,256);ctx.translate(128,128);
   ctx.strokeStyle='#d8dfd5';ctx.fillStyle='#e1e4dd';ctx.lineWidth=3;ctx.font='bold 18px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
   for(let i=0;i<=10;i++){const angle=Math.PI*.75+i*Math.PI*1.5/10;const sx=Math.cos(angle),sy=Math.sin(angle);ctx.beginPath();ctx.moveTo(sx*91,sy*91);ctx.lineTo(sx*(i%2?80:72),sy*(i%2?80:72));ctx.stroke();if(i%2===0)ctx.fillText(String(Math.round(max*i/10)),sx*55,sy*55)}
   ctx.strokeStyle='#d85b3e';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-48,46);ctx.stroke();ctx.fillStyle='#ddd';ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill();
   const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
   const face=new THREE.Mesh(new THREE.PlaneGeometry(r*1.8,r*1.8),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}));
   face.position.set(x,y,-.726);root.add(face);
 }
 gauge(-.16,-.48,.125,180);gauge(.14,-.48,.125,isKalina?8:80);
 if(!isKalina){gauge(.32,-.48,.064,100);gauge(-.34,-.48,.064,100)}
 // Distinctive steering wheel rim, hub, and spokes.
 const wheel=new THREE.Group();wheel.position.set(0,-.49,-.49);root.add(wheel);
 const rim=new THREE.Mesh(new THREE.TorusGeometry(.205,.022,14,64),dark);wheel.add(rim);
 const hub=new THREE.Mesh(new THREE.CylinderGeometry(.074,.08,.035,32),plastic);hub.rotation.x=Math.PI/2;hub.position.z=.018;wheel.add(hub);
 function spoke(x,y,ang){const m=new THREE.Mesh(new THREE.BoxGeometry(.14,.035,.024),plastic);m.position.set(x,y,0);m.rotation.z=ang;wheel.add(m)}
 spoke(-.12,0,0);spoke(.12,0,0);spoke(0,-.12,Math.PI/2);
 const badge=new THREE.Mesh(new THREE.CircleGeometry(.025,24),trim);badge.position.z=.04;wheel.add(badge);
 // Air vents and simple center-console controls.
 for(const x of [.53,.73]){
  if(isKalina){disk(.066,x,-.44,-.815,dark);ring(.062,.01,x,-.44,-.802,trim);box(.08,.008,.01,x,-.44,-.79,trim)}
  else {box(.16,.085,.02,x,-.44,-.805,dark);for(let i=-1;i<=1;i++)box(.14,.006,.01,x,-.44+i*.022,-.79,trim)}
 }
 box(.39,.18,.04,.63,-.68,-.82,dark);
 if(isKalina){for(const x of [.51,.63,.75]){disk(.034,x,-.68,-.79,trim);disk(.02,x,-.68,-.78,dark)}}
 else {for(const y of [-.63,-.68,-.73]){box(.28,.008,.012,.63,y,-.79,trim);box(.025,.026,.02,.57,y,-.77,pale)}}
 if(is2106){
  // The source model's cabin is a solid block, so build a separate open
  // windshield surround for the driver's camera while preserving the body.
  const lining=new THREE.MeshStandardMaterial({color:0x252725,roughness:.9});
  const pillar=new THREE.MeshStandardMaterial({color:0xb3ad98,roughness:.8});
  const rubber=new THREE.MeshStandardMaterial({color:0x171b1a,roughness:.8});
  box(2.35,.12,.95,.22,.43,-.53,lining);
  box(2.18,.075,.09,.19,.365,-.92,rubber);
  const left=box(.09,.98,.12,-.80,-.03,-.85,pillar);left.rotation.z=-.22;
  const right=box(.09,.98,.12,1.13,-.03,-.85,pillar);right.rotation.z=.22;
  const leftSeal=box(.026,.97,.14,-.74,-.03,-.855,rubber);leftSeal.rotation.z=-.22;
  const rightSeal=box(.026,.97,.14,1.07,-.03,-.855,rubber);rightSeal.rotation.z=.22;
  box(.10,.37,1.25,-.91,-.65,-.22,plastic);
  box(.10,.37,1.25,1.25,-.65,-.22,plastic);
  wheel.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.depthTest=false;o.material.depthWrite=false;o.renderOrder=100;}});
 }
 return root;
}
