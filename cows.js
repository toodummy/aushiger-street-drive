import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// Village cows. The model (models/cow.glb, built by tools/build-cow.cjs) is a smooth sculpted cow
// split into moving parts: Body, Neck (head), Tail, upper and lower legs. They wander along and
// across the road, graze, lift the tail to drop a pat or take a leak, step aside for cars, and die
// if you hit them fast: the cow is thrown, falls on its side and stays on the road.
// Positions are route coordinates: d = metres along the road, lat = metres right of centre.
const MAX_PATS=40,MAX_PUDDLES=10,MAX_COWS=8,FAR=32; // beyond FAR metres a light version of the cow is drawn
const COATS=[
  {base:'#5b3521',patch:'#efe6da',spots:.38},  // brown and white (Simmental-like)
  {base:'#f2eee6',patch:'#17130f',spots:.52},  // Holstein black and white
  {base:'#7b4628',patch:'#7b4628',spots:0},    // plain red-brown
  {base:'#26201b',patch:'#ece4d8',spots:.22},  // black with white
  {base:'#9b6a43',patch:'#ece2d2',spots:.3},   // light tan with white
  {base:'#6a5446',patch:'#6a5446',spots:0}     // Caucasian grey-brown
];

function coatMaterial(coat,seed){
  const m=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.86,metalness:0});
  m.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,{cBase:{value:new THREE.Color(coat.base)},cPatch:{value:new THREE.Color(coat.patch)},cSpots:{value:coat.spots},cSeed:{value:seed}});
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 cowPos; varying vec3 vCow;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCow=cowPos;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vCow; uniform vec3 cBase,cPatch; uniform float cSpots,cSeed;
      float ch(vec3 p){p=fract(p*.3183099+.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
      float cn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);
        return mix(mix(mix(ch(i),ch(i+vec3(1,0,0)),f.x),mix(ch(i+vec3(0,1,0)),ch(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(ch(i+vec3(0,0,1)),ch(i+vec3(1,0,1)),f.x),mix(ch(i+vec3(0,1,1)),ch(i+1.0),f.x),f.y),f.z);}
      float cf(vec3 p){return cn(p)*.55+cn(p*2.1)*.28+cn(p*4.3)*.17;}`)
    .replace('#include <color_fragment>',`#include <color_fragment>
      vec3 q=vCow+cSeed;
      // irregular patches with soft but clear edges
      float n=cf(q*vec3(2.2,2.6,2.0));
      float th=1.0-cSpots*.95;
      float patchMask=cSpots>0.0?smoothstep(th-.025,th+.025,n):0.0;
      // many coloured cows have a white face and white socks
      float face=cSpots>0.0?smoothstep(.10,.0,length((vCow-vec3(0,.95,-1.6))*vec3(1.6,1.0,.8))-.18):0.0;
      vec3 col=mix(cBase,cPatch,max(patchMask,face*.85));
      // hair: fine streaks along the body, slight sheen variation
      float hair=cn(vec3(vCow.x*90.0,vCow.y*14.0,vCow.z*90.0));
      col*=.88+.22*hair;
      col*=.9+.2*cn(vCow*7.0);
      // pink udder and teats, dark wet muzzle, inner ears, dark hooves, dusty lower legs
      float udder=smoothstep(.83,.75,vCow.y)*smoothstep(.40,.47,vCow.z)*smoothstep(.80,.74,vCow.z)*smoothstep(.15,.11,abs(vCow.x))*step(.5,vCow.y);
      col=mix(col,vec3(.80,.55,.50),udder*.85);
      float muzzle=smoothstep(.16,.07,length(vCow-vec3(0,.79,-1.77)));
      col=mix(col,vec3(.28,.22,.22),muzzle*.9);
      float hoof=smoothstep(.085,.06,vCow.y);
      col=mix(col,vec3(.10,.085,.075),hoof);
      col*=mix(.72,1.0,smoothstep(.05,.45,vCow.y));
      diffuseColor.rgb*=col;`)
    .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=mix(roughnessFactor,.3,smoothstep(.12,.06,length(vCow-vec3(0,.79,-1.77))));
      roughnessFactor=mix(roughnessFactor,.45,smoothstep(.085,.06,vCow.y));`);
  };
  m.customProgramCacheKey=()=>'aushiger-cow-coat-2';
  return m;
}

const extra={
  eye:new THREE.SphereGeometry(.027,12,8),
  pat:new THREE.SphereGeometry(.16,14,8),
  stream:new THREE.CylinderGeometry(.011,.018,1,6).translate(0,-.5,0),
  puddle:new THREE.CircleGeometry(1,24).rotateX(-Math.PI/2)
};
const mats={
  eye:new THREE.MeshStandardMaterial({color:'#0b0807',roughness:.08}),
  pat:new THREE.MeshStandardMaterial({color:'#3a2916',roughness:.38}),
  stream:new THREE.MeshStandardMaterial({color:'#e9d15a',roughness:.1,transparent:true,opacity:.72}),
  puddle:new THREE.MeshStandardMaterial({color:'#b59836',roughness:.06,metalness:.1,transparent:true,opacity:.5,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2})
};

const templatePromises={};
function loadTemplate(url){
  return templatePromises[url]||=new GLTFLoader().loadAsync(url).then(g=>{
    const root=g.scene;root.updateMatrixWorld(true);
    // rest-pose cow-space positions, so the coat pattern flows across the separate parts
    root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,a=new Float32Array(p.count*3),v=new THREE.Vector3();
      for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);a[i*3]=v.x;a[i*3+1]=v.y;a[i*3+2]=v.z;}
      o.geometry.setAttribute('cowPos',new THREE.BufferAttribute(a,3));});
    return root;
  });
}

function buildCow(template,i,farTemplate){
  const coat=COATS[i%COATS.length],hide=coatMaterial(coat,i*3.7+.5);
  const model=template.clone(true);
  let far=null;
  if(farTemplate){far=farTemplate.clone(true);far.traverse(o=>{if(o.isMesh){o.castShadow=true;if(o.material.name==='Hide')o.material=hide;}});far.visible=false;}
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material.name==='Hide')o.material=hide;}});
  const part=n=>model.getObjectByName(n);
  const neck=part('Neck');
  for(const s of [-1,1]){const e=new THREE.Mesh(extra.eye,mats.eye);e.position.set(s*.136,-.036,-.627);neck.add(e);}
  const legs=[['FrontUpperL','FrontLowerL',0,1],['FrontUpperR','FrontLowerR',Math.PI,1],['HindUpperL','HindLowerL',Math.PI,-1],['HindUpperR','HindLowerR',0,-1]]
    .map(([u,l,phase,front])=>({upper:part(u),lower:part(l),phase,front}));
  const stream=new THREE.Mesh(extra.stream,mats.stream);stream.position.set(0,1.06,1.02);stream.visible=false;model.add(stream);
  const holder=new THREE.Group();holder.name='Village cow';holder.add(model);if(far)holder.add(far);
  const farParts=far&&{model:far,neck:far.getObjectByName('Neck'),tail:far.getObjectByName('Tail'),legs:legs.map(l=>({upper:far.getObjectByName(l.upper.name),lower:far.getObjectByName(l.lower.name)}))};
  return {obj:holder,model,body:model,neck,tail:part('Tail'),legs,stream,farParts};
}

export function createCows(scene,sample,{onHit}={}){
  const cows=[],pats=[],puddles=[],up=new THREE.Vector3(0,1,0);
  const a=new THREE.Vector3(),b=new THREE.Vector3(),fwd=new THREE.Vector3(),right=new THREE.Vector3(),m4=new THREE.Matrix4();
  let herdClock=.5,built=0,template=null,farTemplate=null,first=true;
  const load=(tries=0)=>loadTemplate('./models/cow.glb?v=2').then(t=>template=t).catch(e=>{console.warn('Cow model failed',e);if(tries<3)setTimeout(()=>load(tries+1),3000);});
  load();loadTemplate('./models/cow-far.glb?v=1').then(t=>farTemplate=t).catch(()=>{});
  const rnd=(x,y)=>x+Math.random()*(y-x);
  function frame(d){a.copy(sample(d));b.copy(sample(d+1));fwd.copy(b).sub(a).normalize();right.crossVectors(fwd,up).normalize();return a;}
  function world(d,lat,out=new THREE.Vector3()){frame(d);return out.copy(a).addScaledVector(right,lat);}
  function spawnHerd(center){
    const n=2+Math.floor(Math.random()*3);
    for(let k=0;k<n;k++){
      let c=cows.find(c=>!c.active);
      if(!c){if(cows.length>=MAX_COWS)break;const m=buildCow(template,built++,farTemplate);scene.add(m.obj);c={...m};cows.push(c);}
      Object.assign(c,{active:true,dead:false,d:center+rnd(-18,18),lat:rnd(-4.5,4.5),heading:Math.random()*Math.PI*2,speed:0,state:'walk',timer:rnd(2,6),walk:Math.random()*6,acted:0,patDone:false,turn:rnd(-.3,.3),puddle:null,fall:0,vd:0,vl:0,spin:0,side:1,deadAge:0});
      c.model.position.set(0,0,0);c.model.rotation.set(0,0,0);c.obj.visible=true;
    }
  }
  // the light distant model copies the near model's pose; only one of them is drawn
  function syncFar(c,player){
    const f=c.farParts;if(!f)return;
    const far=Math.abs(c.d-player.distance)>FAR;
    c.model.visible=!far;f.model.visible=far;if(!far)return;
    f.model.position.copy(c.model.position);f.model.rotation.copy(c.model.rotation);
    f.neck.rotation.copy(c.neck.rotation);f.tail.rotation.copy(c.tail.rotation);
    c.legs.forEach((l,i)=>{f.legs[i].upper.rotation.copy(l.upper.rotation);f.legs[i].lower.rotation.copy(l.lower.rotation);});
  }
  function dropPat(c){
    const p=c.model.localToWorld(new THREE.Vector3(0,1.08,1.06));
    const pat=new THREE.Group();
    for(const [s,y] of [[1,0],[.75,.055],[.5,.1]]){const m=new THREE.Mesh(extra.pat,mats.pat);m.scale.set(s,.32*s,s*1.05);m.position.y=y;m.rotation.y=Math.random()*3;m.castShadow=true;pat.add(m);}
    pat.position.copy(p);pat.userData={vy:0,ground:world(c.d,c.lat).y+.02,landed:false};pat.scale.setScalar(.6);
    scene.add(pat);pats.push(pat);if(pats.length>MAX_PATS)scene.remove(pats.shift());
  }
  function startPuddle(c){
    const p=c.model.localToWorld(new THREE.Vector3(0,0,1.1));
    const pud=new THREE.Mesh(extra.puddle,mats.puddle.clone());pud.position.set(p.x,world(c.d,c.lat).y+.025,p.z);pud.scale.setScalar(.01);pud.receiveShadow=true;
    pud.userData={age:0};scene.add(pud);puddles.push(pud);c.puddle=pud;
    if(puddles.length>MAX_PUDDLES){const old=puddles.shift();scene.remove(old);old.material.dispose();}
  }
  function kill(c,player){
    c.dead=true;c.state='dead';c.stream.visible=false;
    const v=player.speed;c.vd=v*.75+Math.sign(v)*2;c.vl=(c.lat-player.lateral||(Math.random()-.5))*1.6+(Math.random()-.5)*2;
    c.spin=(Math.random()-.5)*3;c.side=Math.random()<.5?-1:1;c.fall=0;
    // the car keeps going, a bit slower and dented
    const amount=Math.min(.35,.05+Math.abs(v)/70);
    player.speed*=.72;
    const point=world(c.d,c.lat);point.y+=.7;onHit?.({point,amount,dir:fwd.clone().multiplyScalar(Math.sign(player.distance-c.d)||-1)});
  }

  return {
    get count(){return cows.filter(c=>c.active).length;},
    update(dt,player,cars=[]){
      dt=Math.min(dt,.05);if(!template)return;
      herdClock-=dt;
      if(herdClock<=0){
        // keep about two herds on the road ahead; the very first one close to the start
        const ahead=cows.filter(c=>c.active&&!c.dead&&c.d>player.distance-10);
        if(ahead.length<4){const furthest=Math.max(player.distance,...ahead.map(c=>c.d));const center=first?player.distance+rnd(70,110):Math.max(player.distance+90,furthest+rnd(60,150));if(center<1460){spawnHerd(center);first=false;}}
        herdClock=rnd(3,7);
      }
      const t=performance.now()/1000;
      for(const c of cows){
        if(!c.active)continue;
        if(c.dead){
          // thrown along the road, sliding to a stop, falling onto its side
          c.d+=c.vd*dt;c.lat+=c.vl*dt;c.heading+=c.spin*dt;
          const fr=Math.min(1,dt*2.2);c.vd*=1-fr;c.vl*=1-fr;c.spin*=1-fr;
          c.fall=Math.min(1,c.fall+dt*2.6);const ang=(1-Math.cos(c.fall*Math.PI))/2*Math.PI/2,w=.36;
          c.model.rotation.z=-c.side*ang;c.model.position.set(c.side*w*(1-Math.cos(ang)),-w*Math.sin(ang)*.0+0,0);
          c.model.position.y=0;c.model.position.x=c.side*w*(1-Math.cos(ang));
          for(const l of c.legs){l.upper.rotation.x*=.9;l.lower.rotation.x*=.9;l.upper.rotation.z+=(c.side*.25*ang-l.upper.rotation.z)*dt*3;}
          c.neck.rotation.x+=(-.2-c.neck.rotation.x)*dt*3;c.tail.rotation.x*=.95;
          c.deadAge+=dt;
          const p=world(c.d,c.lat),dir=fwd.clone().multiplyScalar(Math.cos(c.heading)).addScaledVector(right,Math.sin(c.heading));
          m4.lookAt(p,p.clone().add(dir),up);c.obj.position.copy(p);c.obj.quaternion.setFromRotationMatrix(m4);
          syncFar(c,player);
          if(c.d<player.distance-90||c.deadAge>120){c.active=false;c.obj.visible=false;}
          continue;
        }
        c.timer-=dt;
        if(c.timer<=0){
          const r=Math.random();
          if(c.state==='walk'&&r<.18&&!c.patDone){c.state='poop';c.timer=4.5;c.acted=0;}
          else if(c.state==='walk'&&r<.32){c.state='pee';c.timer=5.5;c.acted=0;c.puddle=null;}
          else if(c.state==='walk'&&r<.6){c.state='graze';c.timer=rnd(3,7);}
          else{c.state='walk';c.timer=rnd(4,9);c.turn=rnd(-.35,.35);if(Math.random()<.4)c.heading+=rnd(-1.4,1.4);}
          c.stream.visible=false;
        }
        if(Math.abs(c.lat)>4.8){const want=c.lat>0?-Math.PI/2:Math.PI/2;c.heading+=THREE.MathUtils.clamp(((want-c.heading+Math.PI*3)%(Math.PI*2))-Math.PI,-1,1)*dt*1.4;}
        const walking=c.state==='walk';
        c.speed+=((walking?.85:0)-c.speed)*Math.min(1,dt*2);
        if(walking)c.heading+=c.turn*dt*.3;
        const dd=c.d-player.distance,dl=c.lat-player.lateral;
        if(dd>0&&dd<12&&Math.abs(dl)<2&&Math.abs(player.speed)>1&&Math.abs(player.speed)<9)c.lat+=Math.sign(dl||1)*dt*.9;
        for(const car of cars){const g=(c.d-car.d)*car.dir;if(g>0&&g<14&&Math.abs(c.lat-car.lat)<2.2){c.lat+=Math.sign(c.lat-car.lat||1)*dt*1.1;if(c.state==='graze')c.timer=Math.min(c.timer,.5);}}
        c.d+=Math.cos(c.heading)*c.speed*dt;c.lat+=Math.sin(c.heading)*c.speed*dt;
        c.lat=THREE.MathUtils.clamp(c.lat,-5.4,5.4);
        // collision with the player's car: slow bump pushes, a real hit kills the cow
        if(Math.abs(c.d-player.distance)<3.0&&Math.abs(c.lat-player.lateral)<1.6){
          if(Math.abs(player.speed)>3.5){kill(c,player);continue;}
          player.speed=0;player.cruise=false;player.distance=c.d-Math.sign(c.d-player.distance||1)*3.0;
        }
        const p=world(c.d,c.lat),dir=fwd.clone().multiplyScalar(Math.cos(c.heading)).addScaledVector(right,Math.sin(c.heading));
        m4.lookAt(p,p.clone().add(dir),up);c.obj.position.copy(p);c.obj.quaternion.setFromRotationMatrix(m4);
        // walk cycle: diagonal pairs, front knees fold back, hind hocks fold forward
        c.walk+=dt*c.speed*4.4;const amp=Math.min(1,c.speed*1.4);
        for(const l of c.legs){const s=Math.sin(c.walk+l.phase),lift=Math.max(0,-Math.cos(c.walk+l.phase));
          l.upper.rotation.x=s*.32*amp;l.lower.rotation.x=(l.front>0?-1:1)*lift*.55*amp;}
        c.model.position.y=Math.abs(Math.sin(c.walk))*.02*amp;c.model.rotation.z=Math.sin(c.walk)*.015*amp;
        let neckTarget=walking?-.05+Math.sin(c.walk*.5)*.04:0,tailX=-.08+Math.sin(t*2.3+c.d)*.1,tailZ=Math.sin(t*1.7+c.lat)*.22;
        if(c.state==='graze')neckTarget=-.85+Math.sin(t*1.5)*.05;
        if(c.state==='poop'){c.acted+=dt;tailX=-1.2;tailZ=0;c.model.rotation.x=.03;if(c.acted>1.4&&!c.patDone){dropPat(c);c.patDone=true;}}
        else c.model.rotation.x*=.9;
        if(c.state==='pee'){
          c.acted+=dt;tailX=-.95;tailZ=0;
          const on=c.acted>.8&&c.acted<4.8;c.stream.visible=on;
          if(on){if(!c.puddle)startPuddle(c);
            const len=c.model.localToWorld(new THREE.Vector3(0,1.06,1.02)).y-p.y;c.stream.scale.set(1+Math.sin(t*40)*.15,len,1);
            c.puddle.scale.setScalar(Math.min(.42,c.puddle.scale.x+dt*.13));}
        }
        if(c.state!=='poop'&&c.state!=='pee')c.patDone=c.patDone&&Math.random()>dt*.02;
        c.neck.rotation.x+=(neckTarget-c.neck.rotation.x)*Math.min(1,dt*3);
        c.tail.rotation.x+=(tailX-c.tail.rotation.x)*Math.min(1,dt*5);c.tail.rotation.z+=(tailZ-c.tail.rotation.z)*Math.min(1,dt*4);
        syncFar(c,player);
        if(c.d<player.distance-90||c.d<2||c.d>1495){c.active=false;c.obj.visible=false;c.stream.visible=false;}
      }
      for(const pat of pats){const u=pat.userData;if(u.landed)continue;u.vy-=9.8*dt;pat.position.y+=u.vy*dt;pat.scale.setScalar(Math.min(1,pat.scale.x+dt*2));if(pat.position.y<=u.ground){pat.position.y=u.ground;u.landed=true;pat.scale.set(1.1,.85,1.1);}}
      for(const pud of puddles){pud.userData.age+=dt;if(pud.userData.age>40)pud.material.opacity=Math.max(0,.5-(pud.userData.age-40)*.02);}
    },
    obstacles(){return cows.filter(c=>c.active).map(c=>({d:c.d,lat:c.lat,dead:c.dead}));}
  };
}
