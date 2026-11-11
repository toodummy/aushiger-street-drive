import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// Stray village dogs (models/dog.glb, built by tools/build-dog.cjs). They trot along the road and
// shoulders, sniff, sit, lie down, dart across the road, and sometimes chase a passing car.
// Any car that hits one — yours or traffic — kills it: the dog is thrown and stays on the road.
// Route coordinates: d = metres along the road, lat = metres right of centre.
const MAX_DOGS=6;
const COATS=[
  {base:'#b98a55',back:'#7a5532',belly:'#e6cfa8'},   // fawn / ginger
  {base:'#1c1a18',back:'#0f0e0d',belly:'#a87a4a'},   // black and tan
  {base:'#d9d2c5',back:'#a79d8c',belly:'#f1ece2'},   // off-white
  {base:'#6b6660',back:'#3f3b37',belly:'#b9b2a6'},   // grey wolf-like
  {base:'#8a5a32',back:'#4a2f1a',belly:'#d2b08a'},   // brown
  {base:'#e8e2d6',back:'#2a2420',belly:'#f4efe6',patchy:1} // white with dark patches
];

function coatMaterial(coat,seed){
  const m=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.9});
  m.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,{dBase:{value:new THREE.Color(coat.base)},dBack:{value:new THREE.Color(coat.back)},dBelly:{value:new THREE.Color(coat.belly)},dPatch:{value:coat.patchy||0},dSeed:{value:seed}});
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 dogPos; varying vec3 vDog;').replace('#include <begin_vertex>','#include <begin_vertex>\nvDog=dogPos;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vDog; uniform vec3 dBase,dBack,dBelly; uniform float dPatch,dSeed;
      float dh(vec3 p){p=fract(p*.3183099+.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
      float dn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);
        return mix(mix(mix(dh(i),dh(i+vec3(1,0,0)),f.x),mix(dh(i+vec3(0,1,0)),dh(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(dh(i+vec3(0,0,1)),dh(i+vec3(1,0,1)),f.x),mix(dh(i+vec3(0,1,1)),dh(i+1.0),f.x),f.y),f.z);}`)
    .replace('#include <color_fragment>',`#include <color_fragment>
      // darker saddle along the back and tail top, pale belly, chest and legs; dark muzzle tip
      float saddle=smoothstep(.50,.60,vDog.y)*smoothstep(-.42,-.3,vDog.z);
      float belly=smoothstep(.47,.38,vDog.y)*step(.3,vDog.y)+smoothstep(.22,.1,vDog.y);
      vec3 col=mix(dBase,dBack,saddle*.75);
      col=mix(col,dBelly,clamp(belly,0.0,1.0)*.8);
      float pn=dn((vDog+dSeed)*vec3(7.0,8.0,6.0))*.7+dn((vDog+dSeed)*16.0)*.3;
      col=mix(col,dBack,dPatch*smoothstep(.56,.6,pn));
      float muzzle=smoothstep(.012,.0,length((vDog-vec3(0,.695,-.7))*vec3(1.0,1.1,1.6))-.012);
      col=mix(col,col*.55,smoothstep(.05,.0,length((vDog-vec3(0,.68,-.66))*vec3(1.0,1.2,.6))-.02)*.6);
      col=mix(col,vec3(.07,.06,.055),muzzle);
      float fur=dn(vec3(vDog.x*160.0,vDog.y*40.0,vDog.z*160.0));
      col*=.86+.24*fur;col*=.92+.16*dn(vDog*25.0);
      diffuseColor.rgb*=col;`)
    .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=mix(roughnessFactor,.25,smoothstep(.03,.0,length(vDog-vec3(0,.695,-.695))-.01));`);
  };
  m.customProgramCacheKey=()=>'aushiger-dog-coat-2';
  return m;
}

let templatePromise=null;
function loadTemplate(){
  return templatePromise||=new GLTFLoader().loadAsync('./models/dog.glb?v=1').then(g=>{
    const root=g.scene;root.updateMatrixWorld(true);
    root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,a=new Float32Array(p.count*3),v=new THREE.Vector3();
      for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);a[i*3]=v.x;a[i*3+1]=v.y;a[i*3+2]=v.z;}
      o.geometry.setAttribute('dogPos',new THREE.BufferAttribute(a,3));});
    return root;
  });
}
const eyeGeo=new THREE.SphereGeometry(.013,10,8),eyeMat=new THREE.MeshStandardMaterial({color:'#120d08',roughness:.08});

function buildDog(template,i){
  const coat=COATS[i%COATS.length],mat=coatMaterial(coat,i*2.3+.7),model=template.clone(true);
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.material=mat;}});
  const part=n=>model.getObjectByName(n),neck=part('Neck');
  for(const s of [-1,1]){const e=new THREE.Mesh(eyeGeo,eyeMat);e.position.set(s*.042,.138,-.215);neck.add(e);}
  const legs=[['FrontUpperL','FrontLowerL',0,1],['FrontUpperR','FrontLowerR',Math.PI,1],['HindUpperL','HindLowerL',Math.PI,-1],['HindUpperR','HindLowerR',0,-1]]
    .map(([u,l,phase,front])=>({upper:part(u),lower:part(l),phase,front}));
  const holder=new THREE.Group();holder.name='Village dog';holder.add(model);
  return {obj:holder,model,neck,tail:part('Tail'),legs};
}

export function createDogs(scene,sample,{onHit}={}){
  const dogs=[],up=new THREE.Vector3(0,1,0);
  const a=new THREE.Vector3(),b=new THREE.Vector3(),fwd=new THREE.Vector3(),right=new THREE.Vector3(),m4=new THREE.Matrix4();
  let clock=2,built=0,template=null;
  const load=(n=0)=>loadTemplate().then(t=>template=t).catch(e=>{console.warn('Dog model failed',e);templatePromise=null;if(n<3)setTimeout(()=>load(n+1),3000);});
  load();
  const rnd=(x,y)=>x+Math.random()*(y-x);
  function world(d,lat,out=new THREE.Vector3()){a.copy(sample(d));b.copy(sample(d+1));fwd.copy(b).sub(a).normalize();right.crossVectors(fwd,up).normalize();return out.copy(a).addScaledVector(right,lat);}
  function spawn(player){
    const n=Math.random()<.35?2:1,center=player.distance+rnd(80,260);if(center>1470)return;
    for(let k=0;k<n;k++){
      let g=dogs.find(x=>!x.active);
      if(!g){if(dogs.length>=MAX_DOGS)return;const m=buildDog(template,built++);scene.add(m.obj);g={...m};dogs.push(g);}
      Object.assign(g,{active:true,dead:false,d:center+rnd(-6,6),lat:(Math.random()<.5?-1:1)*rnd(3.2,5.2),heading:Math.random()*Math.PI*2,speed:0,
        state:'trot',timer:rnd(2,5),walk:Math.random()*6,fall:0,vd:0,vl:0,spin:0,side:1,deadAge:0,chase:0,target:null});
      g.model.position.set(0,0,0);g.model.rotation.set(0,0,0);g.obj.visible=true;
    }
  }
  function kill(g,vAlong,carLat){
    g.dead=true;g.state='dead';
    g.vd=vAlong*.8+Math.sign(vAlong||1)*1.5;g.vl=(g.lat-carLat||(Math.random()-.5))*2.2+(Math.random()-.5)*2;
    g.spin=(Math.random()-.5)*6;g.side=Math.random()<.5?-1:1;g.fall=0;
  }
  const angleTo=(from,to)=>((to-from+Math.PI*3)%(Math.PI*2))-Math.PI;

  return {
    get count(){return dogs.filter(g=>g.active).length;},
    update(dt,player,cars=[]){
      dt=Math.min(dt,.05);if(!template)return;
      clock-=dt;
      if(clock<=0){if(dogs.filter(g=>g.active&&!g.dead&&g.d>player.distance-10).length<3)spawn(player);clock=rnd(4,9);}
      const t=performance.now()/1000;
      for(const g of dogs){
        if(!g.active)continue;
        if(g.dead){
          g.d+=g.vd*dt;g.lat+=g.vl*dt;g.heading+=g.spin*dt;const fr=Math.min(1,dt*2.6);g.vd*=1-fr;g.vl*=1-fr;g.spin*=1-fr;
          g.fall=Math.min(1,g.fall+dt*4);const ang=(1-Math.cos(g.fall*Math.PI))/2*Math.PI/2,w=.12;
          g.model.rotation.z=-g.side*ang;g.model.position.set(g.side*w*(1-Math.cos(ang)),0,0);
          for(const l of g.legs){l.upper.rotation.x*=.9;l.lower.rotation.x*=.9;}
          g.neck.rotation.x+=(-.15-g.neck.rotation.x)*dt*3;g.tail.rotation.x*=.95;g.tail.rotation.z*=.9;
          g.deadAge+=dt;place(g);
          if(g.d<player.distance-80||g.deadAge>120){g.active=false;g.obj.visible=false;}
          continue;
        }
        g.timer-=dt;
        if(g.timer<=0){
          const r=Math.random();
          if(r<.12){g.state='dart';g.timer=rnd(2.5,4);g.heading=g.lat>0?-Math.PI/2+rnd(-.3,.3):Math.PI/2+rnd(-.3,.3);}     // run across the road
          else if(r<.3){g.state='sniff';g.timer=rnd(2,5);}
          else if(r<.45){g.state='sit';g.timer=rnd(3,8);}
          else if(r<.52){g.state='lie';g.timer=rnd(6,14);}
          else{g.state='trot';g.timer=rnd(3,7);g.heading+=rnd(-1,1);}
        }
        // sometimes a dog chases a passing car for a few seconds, barking
        const dd=g.d-player.distance,dl=g.lat-player.lateral;
        if(g.state!=='chase'&&g.state!=='lie'&&Math.abs(dd)<12&&Math.abs(player.speed)>4&&Math.random()<dt*.25){g.state='chase';g.timer=rnd(3,6);}
        let want=0;
        if(g.state==='trot')want=1.4;else if(g.state==='dart')want=5.5;else if(g.state==='sniff')want=.25;
        if(g.state==='chase'){
          want=Math.min(9,Math.abs(player.speed)+1.5);const target=Math.atan2(player.lateral+Math.sign(dl||1)*1.6-g.lat,(player.distance+1.5)-g.d);
          g.heading+=angleTo(g.heading,target)*Math.min(1,dt*4);
        }
        // keep near the road
        if(g.state!=='dart'&&g.state!=='chase'&&Math.abs(g.lat)>6){g.heading+=angleTo(g.heading,g.lat>0?-Math.PI/2:Math.PI/2)*dt*2;}
        if(g.state==='dart'&&Math.abs(g.lat)>5.5&&Math.sign(g.lat)===Math.sign(Math.sin(g.heading))){g.state='sniff';g.timer=rnd(2,4);}
        g.speed+=(want-g.speed)*Math.min(1,dt*(want>g.speed?4:3));
        g.d+=Math.cos(g.heading)*g.speed*dt;g.lat=THREE.MathUtils.clamp(g.lat+Math.sin(g.heading)*g.speed*dt,-7,7);
        // collisions with the player and with traffic
        if(Math.abs(g.d-player.distance)<2.3&&Math.abs(g.lat-player.lateral)<1.05){
          if(Math.abs(player.speed)>1.8){kill(g,player.speed,player.lateral);player.speed*=.95;const p=world(g.d,g.lat);p.y+=.4;onHit?.({point:p,amount:.02,dir:fwd.clone().multiplyScalar(Math.sign(player.distance-g.d)||-1)});continue;}
          g.lat+=Math.sign(g.lat-player.lateral||1)*dt*2;
        }
        for(const c of cars){if(Math.abs(g.d-c.d)<2.3&&Math.abs(g.lat-c.lat)<1.05&&c.speed>1.8){kill(g,c.speed*c.dir,c.lat);break;}}
        if(g.dead)continue;
        place(g);animate(g,t,dt);
        if(g.d<player.distance-80||g.d<2||g.d>1495){g.active=false;g.obj.visible=false;}
      }
    },
    obstacles(){return dogs.filter(g=>g.active).map(g=>({d:g.d,lat:g.lat,dead:g.dead,small:true,chase:g.state==='chase'}));}
  };
  function place(g){
    const p=world(g.d,g.lat),dir=fwd.clone().multiplyScalar(Math.cos(g.heading)).addScaledVector(right,Math.sin(g.heading));
    m4.lookAt(p,p.clone().add(dir),up);g.obj.position.copy(p);g.obj.quaternion.setFromRotationMatrix(m4);
  }
  function animate(g,t,dt){
    const moving=g.speed>.15,gallop=g.speed>3.2,amp=Math.min(1,g.speed*.9);
    g.walk+=dt*(gallop?g.speed*2.4:g.speed*7.5);
    for(const l of g.legs){
      // trot: diagonal pairs; gallop: front and hind pairs together
      const ph=gallop?(l.front>0?0:Math.PI*.8)+(l.phase>0?.25:0):l.phase;
      const s=Math.sin(g.walk+ph),lift=Math.max(0,-Math.cos(g.walk+ph));
      l.upper.rotation.x=s*(gallop?.6:.42)*amp;l.lower.rotation.x=(l.front>0?-1:1)*lift*.7*amp;
    }
    let body=0,neckT=0,tailX=-.1,tailZ=Math.sin(t*(g.state==='chase'?14:6)+g.d)*(g.state==='sit'?.25:.4),y=moving?Math.abs(Math.sin(g.walk))*.02*amp:0;
    if(gallop)body=Math.sin(g.walk)*.08;
    if(g.state==='sniff'){neckT=-.7+Math.sin(t*5)*.05;}
    if(g.state==='chase'){neckT=.15+Math.sin(t*16)*.12;}              // barking head bob
    if(g.state==='sit'){body=.42;y=-.1;for(const l of g.legs){if(l.front<0){l.upper.rotation.x=.55;l.lower.rotation.x=-1.6;}else{l.upper.rotation.x=-.42;l.lower.rotation.x=0;}}neckT=-.3;}
    if(g.state==='lie'){y=-.27;for(const l of g.legs){l.upper.rotation.x=l.front>0?1.25:1.0;l.lower.rotation.x=l.front>0?-.25:-1.7;}neckT=.15;tailZ*=.3;}
    g.model.position.y+=(y-g.model.position.y)*Math.min(1,dt*6);
    g.model.rotation.x+=(body-g.model.rotation.x)*Math.min(1,dt*6);
    g.neck.rotation.x+=(neckT-g.neck.rotation.x)*Math.min(1,dt*6);
    g.tail.rotation.x+=(tailX-g.tail.rotation.x)*Math.min(1,dt*6);g.tail.rotation.z=tailZ;
  }
}
