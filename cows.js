import * as THREE from 'three';

// Village cows: they wander along and across the road and shoulders, stop to graze,
// now and then lift the tail and drop a pat (which stays on the asphalt) or take a leak.
// Positions are in route coordinates: d = metres along the road, lat = metres right of centre.
const MAX_PATS=40, MAX_PUDDLES=10;
const COATS=[
  {base:'#5a3420',patch:'#efe7dc',spots:.35},  // brown with white
  {base:'#f1ece4',patch:'#1b1714',spots:.55},  // black and white
  {base:'#7a4526',patch:'#7a4526',spots:0},    // plain red-brown
  {base:'#2a211c',patch:'#ece4d8',spots:.25},  // dark with white
  {base:'#a7744a',patch:'#efe5d6',spots:.3}    // light tan
];

function coatTexture(coat,seed){
  const c=document.createElement('canvas');c.width=256;c.height=128;const g=c.getContext('2d');
  g.fillStyle=coat.base;g.fillRect(0,0,256,128);
  let s=seed;const r=()=>(s=(s*16807)%2147483647)/2147483647;
  g.fillStyle=coat.patch;
  for(let i=0;i<coat.spots*22;i++){g.beginPath();const x=r()*256,y=r()*128,rx=10+r()*34,ry=8+r()*22;g.ellipse(x,y,rx,ry,r()*3,0,Math.PI*2);g.fill();}
  // hair noise
  for(let i=0;i<1600;i++){g.fillStyle=`rgba(${r()<.5?0:255},${r()<.5?0:255},${r()<.5?0:255},.05)`;g.fillRect(r()*256,r()*128,1+r()*2,1);}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
}

function taperedHead(){
  // a cow head: broad forehead narrowing to the muzzle, built from a subdivided box
  const g=new THREE.BoxGeometry(.32,.34,.56,3,3,4),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const z=p.getZ(i),t=(z+.28)/.56; // 0 at muzzle end (-z), 1 at forehead
    p.setX(i,p.getX(i)*(.72+.28*t));p.setY(i,p.getY(i)*(.68+.32*t)-(1-t)*.04);}
  g.computeVertexNormals();return g;
}
const geo={
  body:new THREE.CapsuleGeometry(.43,1.55,6,16).rotateX(Math.PI/2),
  belly:new THREE.SphereGeometry(.47,14,10),
  neck:new THREE.CylinderGeometry(.17,.27,.62,12).rotateX(Math.PI/2).translate(0,0,-.31),
  head:taperedHead(),
  muzzle:new THREE.SphereGeometry(.15,14,10).scale(1.05,.8,.75),
  ear:new THREE.BoxGeometry(.2,.05,.11),
  horn:new THREE.ConeGeometry(.04,.2,8),
  eye:new THREE.SphereGeometry(.035,8,6),
  upperLeg:new THREE.CylinderGeometry(.1,.08,.48,8).translate(0,-.24,0),
  lowerLeg:new THREE.CylinderGeometry(.065,.06,.44,8).translate(0,-.22,0),
  hoof:new THREE.CylinderGeometry(.075,.085,.08,8),
  tail:new THREE.CylinderGeometry(.025,.02,.72,6).translate(0,-.36,0),
  tuft:new THREE.SphereGeometry(.07,8,6).scale(1,1.8,1),
  udder:new THREE.SphereGeometry(.17,10,8).scale(1.1,.8,1),
  pat:new THREE.SphereGeometry(.16,12,8),
  stream:new THREE.CylinderGeometry(.012,.02,1,6).translate(0,-.5,0),
  puddle:new THREE.CircleGeometry(1,20).rotateX(-Math.PI/2)
};
const mats={
  hoof:new THREE.MeshStandardMaterial({color:'#2a2420',roughness:.7}),
  horn:new THREE.MeshStandardMaterial({color:'#e3d6b8',roughness:.5}),
  muzzle:new THREE.MeshStandardMaterial({color:'#c9958a',roughness:.75}),
  eye:new THREE.MeshStandardMaterial({color:'#0d0a08',roughness:.2}),
  udder:new THREE.MeshStandardMaterial({color:'#e2a99c',roughness:.7}),
  pat:new THREE.MeshStandardMaterial({color:'#3b2a17',roughness:.42,metalness:0}),
  stream:new THREE.MeshStandardMaterial({color:'#e8cf55',roughness:.1,transparent:true,opacity:.75}),
  puddle:new THREE.MeshStandardMaterial({color:'#b89a36',roughness:.06,metalness:.1,transparent:true,opacity:.55,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2})
};

function buildCow(i){
  const coat=COATS[i%COATS.length],hide=new THREE.MeshStandardMaterial({map:coatTexture(coat,1234+i*97),roughness:.88});
  const head=new THREE.MeshStandardMaterial({map:hide.map,roughness:.88});
  const cow=new THREE.Group(),body=new THREE.Group();cow.add(body);
  const add=(parent,g,m,x,y,z)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;parent.add(o);return o;};
  add(body,geo.body,hide,0,1.12,0).scale.set(1,1.1,1);
  add(body,geo.belly,hide,0,.98,.1).scale.set(1.02,.88,1.9);
  add(body,geo.udder,mats.udder,0,.64,.55);
  const neckPivot=new THREE.Group();neckPivot.position.set(0,1.28,-.92);body.add(neckPivot);
  neckPivot.add(Object.assign(new THREE.Mesh(geo.neck,hide),{castShadow:true}));neckPivot.rotation.x=.3;
  const headG=new THREE.Group();headG.position.set(0,-.22,-.55);headG.rotation.x=-.95;neckPivot.add(headG);
  add(headG,geo.head,head,0,0,-.22);
  add(headG,geo.muzzle,mats.muzzle,0,-.05,-.5);
  for(const s of [-1,1]){
    add(headG,geo.ear,hide,s*.22,.08,-.02).rotation.z=s*-.25;
    add(headG,geo.horn,mats.horn,s*.13,.2,0).rotation.z=s*-.7;
    add(headG,geo.eye,mats.eye,s*.155,.06,-.2);
  }
  const legs=[];
  for(const [x,z] of [[-.24,-.72],[.24,-.72],[-.24,.74],[.24,.74]]){
    const hip=new THREE.Group();hip.position.set(x,.95,z);body.add(hip);
    add(hip,geo.upperLeg,hide,0,0,0);
    const knee=new THREE.Group();knee.position.y=-.48;hip.add(knee);
    add(knee,geo.lowerLeg,hide,0,0,0);add(knee,geo.hoof,mats.hoof,0,-.44,0);
    legs.push({hip,knee,phase:(x<0)===(z<0)?0:Math.PI});
  }
  const tail=new THREE.Group();tail.position.set(0,1.38,1.18);body.add(tail);
  add(tail,geo.tail,hide,0,0,0);add(tail,geo.tuft,mats.hoof,0,-.74,0);
  const stream=new THREE.Mesh(geo.stream,mats.stream);stream.position.set(0,1.0,1.15);stream.visible=false;body.add(stream);
  cow.name='Village cow';
  return {obj:cow,body,legs,tail,neck:neckPivot,stream};
}

export function createCows(scene,sample){
  const cows=[],pats=[],puddles=[],up=new THREE.Vector3(0,1,0);
  const a=new THREE.Vector3(),b=new THREE.Vector3(),fwd=new THREE.Vector3(),right=new THREE.Vector3(),m4=new THREE.Matrix4();
  let herdClock=0,built=0;
  const rnd=(x,y)=>x+Math.random()*(y-x);

  function frame(d){a.copy(sample(d));b.copy(sample(d+1));fwd.copy(b).sub(a).normalize();right.crossVectors(fwd,up).normalize();return a;}
  function world(d,lat,out=new THREE.Vector3()){frame(d);return out.copy(a).addScaledVector(right,lat);}
  function spawnHerd(center){
    const n=2+Math.floor(Math.random()*3);
    for(let k=0;k<n&&cows.length<6;k++){
      const c=cows.find(c=>!c.active)||(()=>{const m=buildCow(built++);scene.add(m.obj);const c={...m};cows.push(c);return c;})();
      Object.assign(c,{active:true,d:center+rnd(-18,18),lat:rnd(-4.5,4.5),heading:Math.random()*Math.PI*2,speed:0,state:'walk',timer:rnd(2,6),walk:0,acted:0,patDone:false,turn:rnd(-.3,.3)});
      c.obj.visible=true;
    }
  }
  function dropPat(c){
    const p=c.body.localToWorld(new THREE.Vector3(0,1.15,1.22));
    const pat=new THREE.Group();
    for(const [s,y] of [[1,0],[.75,.055],[.5,.1]]){const m=new THREE.Mesh(geo.pat,mats.pat);m.scale.set(s,.32*s,s*1.05);m.position.y=y;m.rotation.y=Math.random()*3;m.castShadow=true;pat.add(m);}
    pat.position.copy(p);pat.userData={vy:0,ground:world(c.d,c.lat).y+.02,landed:false,scale:0};pat.scale.setScalar(.6);
    scene.add(pat);pats.push(pat);
    if(pats.length>MAX_PATS)scene.remove(pats.shift());
  }
  function startPuddle(c){
    const p=c.body.localToWorld(new THREE.Vector3(0,0,1.25));
    const pud=new THREE.Mesh(geo.puddle,mats.puddle.clone());pud.position.set(p.x,world(c.d,c.lat).y+.025,p.z);pud.scale.setScalar(.01);pud.receiveShadow=true;
    pud.userData={age:0};scene.add(pud);puddles.push(pud);c.puddle=pud;
    if(puddles.length>MAX_PUDDLES){const old=puddles.shift();scene.remove(old);old.material.dispose();}
  }

  return {
    get count(){return cows.filter(c=>c.active).length;},
    update(dt,player,cars=[]){
      dt=Math.min(dt,.05);
      // keep a herd somewhere ahead of the driver
      herdClock-=dt;
      if(herdClock<=0){
        if(cows.filter(c=>c.active&&c.d>player.distance-20).length<2){const center=player.distance+rnd(110,320);if(center<1460)spawnHerd(center);}
        herdClock=rnd(6,12);
      }
      for(const c of cows){
        if(!c.active)continue;
        c.timer-=dt;
        if(c.timer<=0){
          // pick the next thing to do
          const r=Math.random();
          if(c.state==='walk'&&r<.18&&!c.patDone){c.state='poop';c.timer=4.5;c.acted=0;}
          else if(c.state==='walk'&&r<.32){c.state='pee';c.timer=5.5;c.acted=0;c.puddle=null;}
          else if(c.state==='walk'&&r<.6){c.state='graze';c.timer=rnd(3,7);}
          else{c.state='walk';c.timer=rnd(4,9);c.turn=rnd(-.35,.35);if(Math.random()<.4)c.heading+=rnd(-1.4,1.4);}
          c.stream.visible=false;
        }
        // stay around the road and shoulders
        if(Math.abs(c.lat)>4.8){const want=c.lat>0?-Math.PI/2:Math.PI/2;c.heading+=THREE.MathUtils.clamp(((want-c.heading+Math.PI*3)%(Math.PI*2))-Math.PI,-1,1)*dt*1.4;}
        const walking=c.state==='walk';
        c.speed+=((walking?.85:0)-c.speed)*Math.min(1,dt*2);
        if(walking)c.heading+=c.turn*dt*.3;
        // cows step aside if the player's car is about to hit them
        const dd=c.d-player.distance,dl=c.lat-player.lateral;
        if(dd>0&&dd<12&&Math.abs(dl)<2&&Math.abs(player.speed)>1){c.lat+=Math.sign(dl||1)*dt*.9;}
        // ...and for traffic waiting behind them
        for(const car of cars){const g=(c.d-car.d)*car.dir;if(g>0&&g<14&&Math.abs(c.lat-car.lat)<2.2){c.lat+=Math.sign(c.lat-car.lat||1)*dt*1.1;if(c.state==='graze')c.timer=Math.min(c.timer,.5);}}
        c.d+=Math.cos(c.heading)*c.speed*dt;c.lat+=Math.sin(c.heading)*c.speed*dt;
        c.lat=THREE.MathUtils.clamp(c.lat,-5.4,5.4);
        // the car cannot drive through a cow
        if(Math.abs(c.d-player.distance)<3.2&&Math.abs(c.lat-player.lateral)<1.7){
          player.speed=0;player.cruise=false;player.distance=c.d-Math.sign(c.d-player.distance||1)*3.2;
        }
        // pose on the road
        const p=world(c.d,c.lat);
        const dir=fwd.clone().multiplyScalar(Math.cos(c.heading)).addScaledVector(right,Math.sin(c.heading));
        m4.lookAt(p,p.clone().add(dir),up);c.obj.position.copy(p);c.obj.quaternion.setFromRotationMatrix(m4);
        // animation
        c.walk+=dt*c.speed*4.2;
        for(const l of c.legs){const s=Math.sin(c.walk+l.phase);l.hip.rotation.x=s*.38*Math.min(1,c.speed*1.4);l.knee.rotation.x=Math.max(0,-Math.cos(c.walk+l.phase))*.5*Math.min(1,c.speed*1.4);}
        c.body.position.y=Math.abs(Math.sin(c.walk))*.025;
        const t=performance.now()/1000;
        let neckTarget=walking?.05+Math.sin(c.walk*.5)*.05:.0,tailX=.12+Math.sin(t*2.3+c.d)*.15,tailZ=Math.sin(t*1.7+c.lat)*.2;
        if(c.state==='graze')neckTarget=.95+Math.sin(t*1.5)*.05;
        if(c.state==='poop'){
          c.acted+=dt;tailX=-1.15;tailZ=0;c.body.rotation.x=-.04;
          if(c.acted>1.4&&!c.patDone){dropPat(c);c.patDone=true;}
        }else c.body.rotation.x*=.9;
        if(c.state==='pee'){
          c.acted+=dt;tailX=-.9;tailZ=0;
          const on=c.acted>.8&&c.acted<4.8;c.stream.visible=on;
          if(on){
            if(!c.puddle)startPuddle(c);
            const len=c.body.localToWorld(new THREE.Vector3(0,1.0,1.15)).y-p.y;c.stream.scale.set(1+Math.sin(t*40)*.15,len,1);
            c.puddle.scale.setScalar(Math.min(.42,c.puddle.scale.x+dt*.13));
          }
        }
        if(c.state!=='poop'&&c.state!=='pee')c.patDone=c.patDone&&Math.random()>dt*.02;
        c.neck.rotation.x+=(.3-neckTarget*1.1-c.neck.rotation.x)*Math.min(1,dt*3);
        c.tail.rotation.x+=(tailX-c.tail.rotation.x)*Math.min(1,dt*5);c.tail.rotation.z+=(tailZ-c.tail.rotation.z)*Math.min(1,dt*4);
        if(c.d<player.distance-90||c.d<2||c.d>1495){c.active=false;c.obj.visible=false;c.stream.visible=false;}
      }
      // pats fall and settle with a little squash
      for(const pat of pats){
        const u=pat.userData;if(u.landed)continue;
        u.vy-=9.8*dt;pat.position.y+=u.vy*dt;pat.scale.setScalar(Math.min(1,pat.scale.x+dt*2));
        if(pat.position.y<=u.ground){pat.position.y=u.ground;u.landed=true;pat.scale.set(1.1,.85,1.1);}
      }
      for(const pud of puddles){pud.userData.age+=dt;if(pud.userData.age>40)pud.material.opacity=Math.max(0,.55-(pud.userData.age-40)*.02);}
    },
    obstacles(){return cows.filter(c=>c.active).map(c=>({d:c.d,lat:c.lat}));}
  };
}
