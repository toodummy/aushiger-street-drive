import * as THREE from 'three';

// Builds traffic cars from side profiles: German (boxy executive saloon, sporty saloon, compact
// hatchback) and Japanese (family saloon, big 4x4). Body and cabin are extruded profiles with
// rounded edges and a little tumblehome; glass cabin with painted roof and pillars; lights,
// grille, bumpers, mirrors, door seams, alloy wheels and a Russian-style number plate.
// No brand badges. Front = -Z, ground at y = 0, metres.
export const STYLES={
  de_exec:  {label:'German executive saloon',L:4.75,W:1.74,belt:.92,roof:1.42,hood:1.25,trunk:.95,wsTop:.62,rearTop:.5,wheelR:.32,clear:.3,wb:2.80,grille:'chrome',lamps:'wide',colors:['#c9ccd0','#151719','#1d2a44','#e9e7e1','#6b6252','#3a4a3c']},
  de_sport: {label:'German sports saloon',L:4.78,W:1.80,belt:.88,roof:1.40,hood:1.3,trunk:.9,wsTop:.82,rearTop:.62,wheelR:.33,clear:.28,wb:2.83,grille:'kidney',lamps:'twin',colors:['#0f1012','#2b3e5c','#8e9399','#5b0f16','#e8e8e6']},
  de_hatch: {label:'German hatchback',L:4.05,W:1.74,belt:.90,roof:1.42,hood:.95,trunk:.12,wsTop:.72,rearTop:.62,wheelR:.31,clear:.3,wb:2.52,grille:'bar',lamps:'wide',colors:['#c22a22','#1c3e78','#d6d8da','#1a1a1a','#2f5c3c','#d9c76a']},
  jp_sedan: {label:'Japanese saloon',L:4.82,W:1.82,belt:.95,roof:1.47,hood:1.2,trunk:.85,wsTop:.86,rearTop:.74,wheelR:.33,clear:.3,wb:2.78,grille:'wide',lamps:'swept',colors:['#e8e8e6','#121314','#8f9396','#3b3022','#5d6a75','#7a1a1f']},
  jp_suv:   {label:'Japanese 4x4',L:4.9,W:1.94,belt:1.2,roof:1.86,hood:1.15,trunk:.06,wsTop:.5,rearTop:.12,wheelR:.40,clear:.45,wb:2.85,grille:'bars',lamps:'square',suv:true,colors:['#e8e8e6','#141516','#8b9196','#2c3a2c','#4a3a2a','#20314f']}
};

const shared={};
function mats(){
  if(shared.glass)return shared;
  Object.assign(shared,{
    glass:new THREE.MeshPhysicalMaterial({name:'Glass',color:'#1b2228',roughness:.06,metalness:.2,transparent:true,opacity:.86,clearcoat:1}),
    black:new THREE.MeshStandardMaterial({name:'Trim_Black',color:'#121314',roughness:.6}),
    chrome:new THREE.MeshStandardMaterial({name:'Chrome',color:'#dfe3e6',metalness:1,roughness:.15}),
    rubber:new THREE.MeshStandardMaterial({name:'Rubber',color:'#151515',roughness:.85}),
    rim:new THREE.MeshStandardMaterial({name:'Rim',color:'#b9bec3',metalness:.85,roughness:.28}),
    head:new THREE.MeshStandardMaterial({name:'Headlight',color:'#e9eef2',emissive:'#9aa4ad',emissiveIntensity:.15,metalness:.4,roughness:.1}),
    tail:new THREE.MeshStandardMaterial({name:'Taillight',color:'#9e1018',emissive:'#5a0006',emissiveIntensity:.4,roughness:.25}),
    amber:new THREE.MeshStandardMaterial({name:'Indicator',color:'#e08a1e',emissive:'#5a2c00',emissiveIntensity:.3,roughness:.3}),
    seam:new THREE.MeshBasicMaterial({name:'Seam',color:'#0b0b0b'})
  });
  return shared;
}
let plateId=0;
function plateTexture(){
  const c=document.createElement('canvas');c.width=256;c.height=56;const g=c.getContext('2d');
  g.fillStyle='#f4f4f0';g.fillRect(0,0,256,56);g.strokeStyle='#111';g.lineWidth=3;g.strokeRect(2,2,252,52);
  const L='АВЕКМНОРСТУХ',r=n=>L[Math.floor(Math.random()*L.length)];
  g.fillStyle='#111';g.font='bold 34px Arial';g.textBaseline='middle';
  g.fillText(`${r()} ${String(100+Math.floor(Math.random()*899))} ${r()}${r()}`,12,30);
  g.beginPath();g.moveTo(196,4);g.lineTo(196,52);g.stroke();g.font='bold 22px Arial';g.fillText(['07','05','15','06','26'][plateId++%5],206,24);
  g.font='9px Arial';g.fillText('RUS',212,46);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function spokeTexture(n){
  const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
  g.fillStyle='#2a2c2e';g.beginPath();g.arc(64,64,62,0,7);g.fill();
  g.fillStyle='#c3c8cc';g.beginPath();g.arc(64,64,62,0,7);g.arc(64,64,52,0,7,true);g.fill();
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2;g.save();g.translate(64,64);g.rotate(a);g.fillStyle='#c9cdd1';g.beginPath();g.moveTo(-7,10);g.lineTo(7,10);g.lineTo(11,54);g.lineTo(-11,54);g.closePath();g.fill();g.restore();}
  g.fillStyle='#b5babf';g.beginPath();g.arc(64,64,16,0,7);g.fill();g.fillStyle='#55595d';g.beginPath();g.arc(64,64,5,0,7);g.fill();
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

// extrude a side profile (s = along the car, front negative; y up) across the width
function extrudeProfile(points,width,bevel,taper){
  const sh=new THREE.Shape();points.forEach(([s,y],i)=>i?sh.lineTo(s,y):sh.moveTo(s,y));sh.closePath();
  return finish(sh,width,bevel,taper);
}
function finish(sh,width,bevel,taper){
  const g=new THREE.ExtrudeGeometry(sh,{depth:width-bevel*2,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:4,curveSegments:16,steps:1});
  g.rotateY(-Math.PI/2);g.translate((width-bevel*2)/2,0,0);
  if(taper){const p=g.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i);p.setX(i,p.getX(i)*taper(y));}}
  g.computeVertexNormals();return g;
}

export function makeCar(styleKey,color){
  const S=STYLES[styleKey],M=mats(),car=new THREE.Group();car.name='Traffic '+S.label;
  const paint=new THREE.MeshPhysicalMaterial({name:'Paint',color:color||S.colors[Math.floor(Math.random()*S.colors.length)],metalness:.45,roughness:.32,clearcoat:1,clearcoatRoughness:.12});
  const add=(geo,mat,x=0,y=0,z=0,parent=car)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  const L=S.L,W=S.W,hl=L/2,R=S.wheelR,fz=-S.wb/2,rz=S.wb/2,cy=R,arch=R+.05,sill=S.clear;
  const tumble=y=>y<S.belt?1-Math.max(0,S.belt-.25-y)*.04:1-(y-S.belt)/(S.roof-S.belt)*.16;
  // ---- lower body: bumpers rounded in, hood sloping to the windscreen, boot/hatch, wheel arches cut out
  const front=-hl,rear=hl,hoodEnd=front+S.hood,bootStart=rear-S.trunk;
  const sh=new THREE.Shape();
  sh.moveTo(front+.06,sill+.02);
  sh.lineTo(front,sill+.14);sh.lineTo(front-.01,S.belt-.16);sh.quadraticCurveTo(front+.02,S.belt-.06,front+.18,S.belt-.05);
  sh.lineTo(hoodEnd,S.belt);                                   // hood
  sh.lineTo(bootStart,S.belt+.01);                              // beltline under the cabin
  if(S.trunk>.3){sh.lineTo(rear-.08,S.belt-.02);sh.quadraticCurveTo(rear,S.belt-.03,rear+.01,S.belt-.14);}else{sh.lineTo(rear,S.belt);}
  sh.lineTo(rear,sill+.14);sh.lineTo(rear-.06,sill+.02);
  sh.lineTo(rz+arch,sill+.02);sh.absarc(rz,cy,arch,0,Math.PI,false);       // rear arch
  sh.lineTo(fz+arch,sill+.02);sh.absarc(fz,cy,arch,0,Math.PI,false);        // front arch
  sh.closePath();
  const body=add(finish(sh,W,.06,tumble),paint);body.name='Body';
  // ---- cabin: glass block with painted roof and pillars
  const aBase=hoodEnd-.02,aTop=hoodEnd+S.wsTop,cBase=S.trunk>.3?bootStart+.05:rear-.04,cTop=cBase-S.rearTop,roofH=S.roof;
  const glass=extrudeProfile([[aBase,S.belt],[aTop,roofH-.04],[cTop,roofH-.04],[cBase,S.belt]],W-.12,.035,tumble);add(glass,M.glass).name='Glass';
  const roofShape=[[aTop-.03,roofH-.06],[aTop+.05,roofH],[cTop-.05,roofH],[cTop+.03,roofH-.06]];
  add(extrudeProfile(roofShape,W-.14,.04,tumble),paint).name='Roof';
  const pillar=(s0,y0,s1,y1,thick=.075)=>{
    for(const side of [-1,1]){
      const x0=side*(W/2-.075)*tumble(y0),x1=side*(W/2-.075)*tumble(y1),a=new THREE.Vector3(x0,y0,s0),b=new THREE.Vector3(x1,y1,s1),len=a.distanceTo(b);
      const m=add(new THREE.BoxGeometry(.05,thick,len),paint);m.position.copy(a).add(b).multiplyScalar(.5);m.lookAt(b);
    }
  };
  pillar(aBase+.02,S.belt,aTop,roofH-.02);
  pillar(cBase-.02,S.belt,cTop,roofH-.02,S.trunk>.3?.12:.16);
  const bS=(aTop+cTop)/2+(S.suv?-.05:.08);pillar(bS,S.belt,bS-.03,roofH-.02,.08);
  if(S.suv){pillar(bS+.75,S.belt,bS+.75,roofH-.02,.07);}
  // window frames: black strip along the top of the side windows
  for(const side of [-1,1]){const m=add(new THREE.BoxGeometry(.02,.03,cTop-aTop),M.black,side*(W/2-.07)*tumble(roofH-.06),roofH-.06,(aTop+cTop)/2);}
  // ---- front: lights, grille, bumper
  const fy=S.belt-.22,fzF=front-.05;
  const lampW=S.lamps==='wide'?.42:S.lamps==='square'?.26:S.lamps==='swept'?.38:.2;
  for(const side of [-1,1]){
    if(S.lamps==='twin'){for(const k of [0,1]){const l=add(new THREE.CylinderGeometry(.075,.075,.04,20).rotateX(Math.PI/2),M.head,side*(W/2-.22-k*.17),fy,fzF);}}
    else{const l=add(new THREE.BoxGeometry(lampW,S.lamps==='swept'?.13:.15,.05),M.head,side*(W/2-.08-lampW/2),fy,fzF);if(S.lamps==='swept')l.rotation.y=side*.18;}
    add(new THREE.BoxGeometry(.12,.06,.04),M.amber,side*(W/2-.1),fy-.16,fzF);
    // mirrors
    const mir=add(new THREE.BoxGeometry(.16,.11,.08),paint,side*(W/2+.06),S.belt+.08,aBase+.18);
    add(new THREE.BoxGeometry(.1,.04,.04),M.black,side*(W/2),S.belt+.05,aBase+.2);
  }
  const gW=S.grille==='kidney'?0:S.grille==='bar'?W-.9:W-.75-(S.lamps==='twin'?.4:0);
  if(S.grille==='chrome'){add(new THREE.BoxGeometry(.42,.2,.06),M.chrome,0,fy+.01,fzF-.01);add(new THREE.BoxGeometry(.36,.15,.065),M.black,0,fy+.01,fzF-.012);for(let i=-3;i<=3;i++)add(new THREE.BoxGeometry(.012,.15,.07),M.chrome,i*.05,fy+.01,fzF-.013);
    add(new THREE.BoxGeometry(gW*.5,.06,.05),M.black,0,fy-.1,fzF);}
  else if(S.grille==='kidney'){for(const side of [-1,1]){add(new THREE.BoxGeometry(.15,.13,.06),M.chrome,side*.09,fy,fzF-.01);add(new THREE.BoxGeometry(.12,.1,.065),M.black,side*.09,fy,fzF-.012);}}
  else{add(new THREE.BoxGeometry(gW,S.grille==='bars'?.2:.1,.05),M.black,0,fy+.01,fzF-.005);if(S.grille==='bars')for(let i=0;i<4;i++)add(new THREE.BoxGeometry(gW,.012,.06),M.chrome,0,fy-.07+i*.05,fzF-.008);}
  const bumper=(z,dir)=>{const b=add(new THREE.BoxGeometry(W+.02,.2,.16),S.suv?M.black:paint,0,sill+.13,z);const strip=add(new THREE.BoxGeometry(W+.03,.05,.17),M.black,0,sill+.14,z);return b;};
  bumper(front+.02,-1);bumper(rear-.02,1);
  // plate front and rear
  const plateMat=new THREE.MeshStandardMaterial({map:plateTexture(),roughness:.4});
  add(new THREE.PlaneGeometry(.52,.115).rotateY(Math.PI),plateMat,0,sill+.14,front-.075);
  add(new THREE.PlaneGeometry(.52,.115),plateMat,0,S.trunk>.3?S.belt-.3:sill+.42,rear+.075);
  // ---- rear: tail lights
  const ty=S.trunk>.3?S.belt-.18:S.suv?S.belt-.15:S.belt-.12;
  for(const side of [-1,1]){
    if(S.suv)add(new THREE.BoxGeometry(.12,.42,.05),M.tail,side*(W/2-.08),ty-.1,rear+.04);
    else add(new THREE.BoxGeometry(S.lamps==='twin'?.36:.42,.13,.05),M.tail,side*(W/2-.08-.2),ty,rear+.045);
  }
  if(S.suv){ // spare wheel on the tailgate, roof rails, fender flares
    const spare=new THREE.Group();spare.position.set(.18,.95,rear+.18);car.add(spare);
    add(new THREE.CylinderGeometry(R,R,.22,28).rotateX(Math.PI/2),M.rubber,0,0,0,spare);add(new THREE.CylinderGeometry(R*.82,R*.82,.24,24).rotateX(Math.PI/2),paint,0,0,0,spare);
    for(const side of [-1,1]){add(new THREE.BoxGeometry(.04,.04,cTop-aTop-.2),M.black,side*(W/2-.2),roofH+.05,(aTop+cTop)/2);
      for(const wz of [fz,rz]){const f=add(new THREE.TorusGeometry(arch+.02,.035,6,20,Math.PI),M.black,side*(W/2+.01),cy,wz);f.rotation.y=Math.PI/2;}}
  }
  // door seams and handles
  for(const side of [-1,1]){
    const x=side*(W/2+.003);
    for(const s of [aBase+.05,bS,S.suv?bS+.75:cBase-.12])add(new THREE.BoxGeometry(.005,S.belt-sill-.12,.006),M.seam,x,(S.belt+sill)/2,s);
    add(new THREE.BoxGeometry(.005,.006,cBase-aBase),M.seam,x,sill+.2,(aBase+cBase)/2);
    for(const s of [bS-.18,bS+.55])add(new THREE.BoxGeometry(.03,.025,.12),M.black,side*(W/2+.01),S.belt-.1,s);
  }
  // ---- wheels
  const spokes=spokeTexture(5+Math.floor(Math.random()*3)),rimFace=new THREE.MeshStandardMaterial({name:'RimFace',map:spokes,metalness:.7,roughness:.3});
  for(const [wx,wz,name] of [[-1,fz,'FL'],[1,fz,'FR'],[-1,rz,'RL'],[1,rz,'RR']]){
    const w=new THREE.Group();w.name='Wheel_'+name;w.position.set(wx*(W/2-.13),cy,wz);car.add(w);
    add(new THREE.CylinderGeometry(R,R,.21,30).rotateZ(Math.PI/2),M.rubber,0,0,0,w);
    add(new THREE.TorusGeometry(R-.035,.04,8,30).rotateY(Math.PI/2),M.rubber,0,0,0,w).scale.set(1.6,1,1);
    add(new THREE.CircleGeometry(R*.68,30).rotateY(wx*Math.PI/2),rimFace,wx*.108,0,0,w);
  }
  // under-car shadow plate so the car sits on the road
  const under=add(new THREE.BoxGeometry(W-.15,.05,L-.5),M.black,0,sill+.05,0);under.castShadow=false;
  return {root:car,paint};
}
export const STYLE_KEYS=Object.keys(STYLES);

// ---- Trucks: cab-over lorries (dump truck and box van), 7.4 m long, three axles, exhaust stack.
export const TRUCKS={
  truck_dump:{label:'Dump truck',L:7.4,W:2.45,colors:['#e06a1a','#1d4f8f','#c22a22','#2f6b3a','#d8b21c'],bed:'dump'},
  truck_box: {label:'Box truck',L:7.4,W:2.45,colors:['#e8e8e2','#1d4f8f','#c22a22','#3a3d40'],bed:'box'}
};
export const TRUCK_KEYS=Object.keys(TRUCKS);
export function makeTruck(key,color){
  const T=TRUCKS[key],M=mats(),car=new THREE.Group();car.name='Traffic '+T.label;
  const paint=new THREE.MeshPhysicalMaterial({name:'Paint',color:color||T.colors[Math.floor(Math.random()*T.colors.length)],metalness:.25,roughness:.45,clearcoat:.6,clearcoatRoughness:.3});
  const add=(geo,mat,x=0,y=0,z=0,parent=car)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  const W=T.W,hl=T.L/2,R=.5,front=-hl,cabBack=front+1.95,frame=new THREE.MeshStandardMaterial({name:'Frame',color:'#1c1d1f',roughness:.7});
  const grey=new THREE.MeshStandardMaterial({name:'Bed',color:'#6a6d70',roughness:.7,metalness:.2});
  const boxMat=new THREE.MeshStandardMaterial({name:'Box',color:'#d9dadb',roughness:.55});
  // chassis rails and bumper
  for(const side of [-1,1])add(new THREE.BoxGeometry(.14,.26,T.L-.5),frame,side*.45,.82,.15);
  add(new THREE.BoxGeometry(W,.32,.22),frame,0,.62,front+.08);
  // cab: side profile, slightly raked front, rounded edges
  const sh=new THREE.Shape();sh.moveTo(front,.95);sh.lineTo(front-.02,1.75);sh.lineTo(front+.12,2.95);sh.lineTo(cabBack,3.0);sh.lineTo(cabBack,.95);sh.closePath();
  const cab=add(finish(sh,W,.09),paint);cab.name='Cab';
  // windscreen, side windows, grille, lights
  const ws=add(new THREE.PlaneGeometry(W-.3,.82).rotateY(Math.PI),M.glass,0,2.38,front-.075);ws.rotation.x=.11;
  for(const side of [-1,1]){
    add(new THREE.PlaneGeometry(.95,.7).rotateY(side*Math.PI/2),M.glass,side*(W/2+.005),2.38,front+.75);
    add(new THREE.BoxGeometry(.03,.22,.07),M.black,side*(W/2+.01),1.55,front+1.0);                 // door handle recess
    add(new THREE.BoxGeometry(.005,1.85,.006),M.seam,side*(W/2+.006),1.95,front+1.55);
    const arm=add(new THREE.BoxGeometry(.32,.04,.04),M.black,side*(W/2+.16),2.55,front+.25);
    add(new THREE.BoxGeometry(.06,.36,.18),M.black,side*(W/2+.32),2.45,front+.25);                 // mirror
    add(new THREE.BoxGeometry(.38,.2,.06),M.head,side*(W/2-.35),.74,front-.04);                     // headlight
    add(new THREE.BoxGeometry(.14,.1,.06),M.amber,side*(W/2-.08),.74,front-.04);
    add(new THREE.BoxGeometry(.5,.05,.25),frame,side*(W/2-.25),.62,front+.55);                      // step
    add(new THREE.BoxGeometry(.5,.05,.25),frame,side*(W/2-.25),.98,front+.55).position.y=.38;
    // fender over the front wheel
    const f=add(new THREE.CylinderGeometry(R+.1,R+.1,.42,20,1,true,-Math.PI/2,Math.PI),frame,side*(W/2-.22),R,front+1.05);f.rotation.z=Math.PI/2;f.rotation.y=Math.PI/2;
  }
  add(new THREE.BoxGeometry(W-1.1,.42,.05),M.black,0,1.42,front-.085);
  for(let i=0;i<5;i++)add(new THREE.BoxGeometry(W-1.12,.025,.06),M.chrome,0,1.25+i*.085,front-.095);
  add(new THREE.BoxGeometry(W-.2,.1,.4),M.black,0,3.04,front+.95);                                    // roof cap
  for(const x of [-.4,-.13,.13,.4])add(new THREE.BoxGeometry(.12,.06,.06),M.amber,x,3.0,front+.08);    // roof marker lights
  // fuel tank and exhaust stack behind the cab
  const tank=add(new THREE.CylinderGeometry(.3,.3,1.0,18).rotateX(Math.PI/2),M.chrome,-(W/2-.4),.82,cabBack+.7);
  add(new THREE.CylinderGeometry(.07,.07,2.5,12),M.black,W/2-.25,1.95,cabBack+.12);
  add(new THREE.CylinderGeometry(.075,.075,.25,12),M.chrome,W/2-.25,3.25,cabBack+.12);
  car.userData.exhaust=new THREE.Vector3(W/2-.25,3.4,cabBack+.12);car.userData.diesel=true;
  // load body
  if(T.bed==='dump'){
    const z0=cabBack+.35,z1=hl-.05,len=z1-z0,zc=(z0+z1)/2,y0=1.15,h=1.05;
    add(new THREE.BoxGeometry(W-.05,.1,len),grey,0,y0,zc);
    for(const side of [-1,1]){add(new THREE.BoxGeometry(.07,h,len),grey,side*(W/2-.06),y0+h/2,zc);for(let i=1;i<5;i++)add(new THREE.BoxGeometry(.09,h,.06),frame,side*(W/2-.03),y0+h/2,z0+i*len/5);}
    add(new THREE.BoxGeometry(W-.05,h+.25,.08),grey,0,y0+(h+.25)/2,z0);add(new THREE.BoxGeometry(W-.05,h,.08),grey,0,y0+h/2,z1);
    // a load of gravel
    const g=add(new THREE.SphereGeometry(1,16,8,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:'#8a7f70',roughness:1}),0,y0+.4,zc);g.scale.set(W/2-.15,.7,len/2-.1);
  }else{
    const z0=cabBack+.15,z1=hl-.02,len=z1-z0,zc=(z0+z1)/2;
    add(new THREE.BoxGeometry(W+.05,2.35,len),boxMat,0,1.1+2.35/2,zc);
    for(const side of [-1,1])add(new THREE.BoxGeometry(.01,.12,len-.1),paint,side*(W/2+.03),1.45,zc);
    add(new THREE.BoxGeometry(.03,2.2,.006),M.seam,0,1.1+1.15,z1+.005);
    for(const x of [-.35,.35])add(new THREE.BoxGeometry(.04,2.1,.05),M.chrome,x,2.25,z1+.02);
  }
  // rear: lights, under-run bar, mud flaps, plate
  for(const side of [-1,1]){add(new THREE.BoxGeometry(.3,.12,.05),M.tail,side*(W/2-.3),.78,hl+.03);add(new THREE.BoxGeometry(.5,.55,.02),M.rubber,side*(W/2-.35),.55,hl-.2);}
  add(new THREE.BoxGeometry(W-.3,.1,.1),frame,0,.5,hl);
  add(new THREE.PlaneGeometry(.52,.115),new THREE.MeshStandardMaterial({map:plateTexture(),roughness:.4}),0,.75,hl+.06);
  add(new THREE.PlaneGeometry(.52,.115).rotateY(Math.PI),new THREE.MeshStandardMaterial({map:plateTexture(),roughness:.4}),0,.62,front-.04);
  // wheels: one steering axle under the cab, two driven axles at the back (wide twin tyres)
  const hub=new THREE.MeshStandardMaterial({name:'Hub',color:'#8a1c1c',roughness:.5,metalness:.3});
  for(const [z,wide,name] of [[front+1.05,.36,'F'],[hl-2.35,.55,'R1'],[hl-1.05,.55,'R2']]){
    for(const side of [-1,1]){
      const w=new THREE.Group();w.name='Wheel_'+name+(side<0?'L':'R');w.position.set(side*(W/2-.2-(wide>.4?.08:0)),R,z);car.add(w);
      add(new THREE.CylinderGeometry(R,R,wide,28).rotateZ(Math.PI/2),M.rubber,0,0,0,w);
      add(new THREE.CircleGeometry(R*.62,24).rotateY(side*Math.PI/2),hub,side*(wide/2+.005),0,0,w);
      add(new THREE.CircleGeometry(R*.25,16).rotateY(side*Math.PI/2),M.chrome,side*(wide/2+.01),0,0,w);
    }
  }
  const under=add(new THREE.BoxGeometry(W-.4,.05,T.L-.6),M.black,0,.4,0);under.castShadow=false;
  return {root:car,paint};
}
// exhaust pipe of a generated car, in its local space (rear right, low)
export function carExhaust(key){const S=STYLES[key];return new THREE.Vector3(S.W/2-.38,S.clear+.08,S.L/2+.06);}
