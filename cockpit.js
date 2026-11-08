import * as THREE from 'three';

// Compact, model-specific cockpit detail for the driver's view.
export function makeCockpit(isKalina) {
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
 return root;
}
