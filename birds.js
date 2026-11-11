import * as THREE from 'three';

// Birds: a few flocks (crows, swallows, pigeons) circling and gliding over the valley,
// plus small groups that fly across the road in front of the car. Bodies and wings are
// instanced meshes, so even ~90 birds cost three draw calls; wings flap per bird.
const MAX=96;

function bodyGeometry(){
  // small streamlined body with a tail, front = -Z
  const g=new THREE.SphereGeometry(.5,10,8);g.scale(.16,.14,.5);
  const tail=new THREE.ConeGeometry(.11,.32,4,1).rotateX(Math.PI/2).translate(0,0,.36);tail.scale(1,.35,1);
  const head=new THREE.SphereGeometry(.09,8,6).translate(0,.04,-.25);
  const beak=new THREE.ConeGeometry(.03,.1,5).rotateX(-Math.PI/2).translate(0,.03,-.36);
  const parts=[g,tail,head,beak].map(x=>x.index?x.toNonIndexed():x);
  const pos=[];for(const p of parts)pos.push(...p.attributes.position.array);
  const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));out.computeVertexNormals();return out;
}
function wingGeometry(){
  // one wing (right side), hinged at x=0; swept back, pointed tip
  const s=new THREE.Shape();s.moveTo(0,-.12);s.lineTo(.22,-.16);s.lineTo(.62,-.02);s.lineTo(.5,.1);s.lineTo(.2,.14);s.lineTo(0,.12);s.closePath();
  const g=new THREE.ShapeGeometry(s);g.rotateX(-Math.PI/2);return g;
}

export function createBirds(scene){
  const bodyMat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.8,vertexColors:false});
  const wingMat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.85,side:THREE.DoubleSide});
  const bodies=new THREE.InstancedMesh(bodyGeometry(),bodyMat,MAX),wingsL=new THREE.InstancedMesh(wingGeometry(),wingMat,MAX),wingsR=new THREE.InstancedMesh(wingGeometry(),wingMat,MAX);
  for(const m of [bodies,wingsL,wingsR]){m.frustumCulled=false;m.castShadow=false;m.name='Birds';scene.add(m);}
  const KINDS=[
    {name:'crow',color:'#151517',size:1.0,flap:7,speed:11,glide:.35},
    {name:'swallow',color:'#22283a',size:.55,flap:13,speed:16,glide:.15},
    {name:'pigeon',color:'#7d8188',size:.8,flap:9,speed:13,glide:.25}
  ];
  const birds=[],flocks=[];
  const rnd=(a,b)=>a+Math.random()*(b-a);
  function addFlock(center,kind,n,mode){
    const f={center:center.clone(),kind,mode,radius:rnd(25,70),height:center.y,angle:Math.random()*6.28,dir:Math.random()<.5?1:-1,vel:new THREE.Vector3(),life:mode==='cross'?14:Infinity,members:[]};
    for(let i=0;i<n&&birds.length<MAX;i++){
      const b={kind,flock:f,offset:new THREE.Vector3(rnd(-8,8),rnd(-3,3),rnd(-8,8)),phase:Math.random()*6.28,pos:center.clone(),prev:center.clone(),gliding:0};
      birds.push(b);f.members.push(b);
    }
    flocks.push(f);return f;
  }
  const col=new THREE.Color();
  function paint(i,kind){col.set(kind.color).multiplyScalar(.85+Math.random()*.3);bodies.setColorAt(i,col);wingsL.setColorAt(i,col);wingsR.setColorAt(i,col);}
  let crossClock=6;
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),qw=new THREE.Quaternion(),s=new THREE.Vector3(),look=new THREE.Matrix4(),up=new THREE.Vector3(0,1,0),tmp=new THREE.Vector3(),side=new THREE.Vector3(),wingPos=new THREE.Vector3(),Z=new THREE.Vector3(0,0,1),mirror=new THREE.Vector3();
  let seeded=false;
  return {
    update(dt,camera,carPos,carForward){
      dt=Math.min(dt,.05);const t=performance.now()/1000;
      if(!seeded&&carPos){
        seeded=true;
        // circling flocks around the valley, ahead and to the sides of the start
        for(let k=0;k<4;k++){const kind=KINDS[k%3];addFlock(new THREE.Vector3(carPos.x+rnd(-160,160),carPos.y+rnd(35,90),carPos.z-rnd(60,500)),kind,Math.round(rnd(7,14)),'circle');}
      }
      if(!carPos)return;
      // keep circling flocks loosely near the driver as the car moves on
      for(const f of flocks){
        if(f.mode==='circle'){
          if(f.center.distanceTo(carPos)>650){f.center.set(carPos.x+rnd(-180,180),carPos.y+rnd(35,90),carPos.z+carForward.z*rnd(250,500)+rnd(-80,80));}
          f.angle+=dt*f.kind.speed/f.radius*f.dir;
          f.target=(f.target||new THREE.Vector3()).set(f.center.x+Math.cos(f.angle)*f.radius,f.height+Math.sin(f.angle*2.3)*4,f.center.z+Math.sin(f.angle)*f.radius);
        }else{f.center.addScaledVector(f.vel,dt);f.life-=dt;f.target=f.center;}
      }
      // now and then a small group flies low across the road ahead
      crossClock-=dt;
      if(crossClock<=0&&birds.length<MAX-6){
        crossClock=rnd(10,22);
        const ahead=carPos.clone().addScaledVector(carForward,rnd(40,90)),across=new THREE.Vector3(-carForward.z,0,carForward.x).normalize(),sgn=Math.random()<.5?1:-1;
        const kind=KINDS[Math.floor(Math.random()*3)],f=addFlock(ahead.clone().addScaledVector(across,-60*sgn).setY(carPos.y+rnd(6,16)),kind,Math.round(rnd(3,7)),'cross');
        f.vel.copy(across).multiplyScalar(sgn*kind.speed).setY(rnd(.5,2));
      }
      for(let i=flocks.length-1;i>=0;i--){const f=flocks[i];if(f.life<=0){for(const b of f.members)birds.splice(birds.indexOf(b),1);flocks.splice(i,1);}}
      birds.forEach((b,i)=>{
        const k=b.kind;b.prev.copy(b.pos);
        tmp.copy(b.flock.target||b.flock.center).add(b.offset);
        b.pos.lerp(tmp,Math.min(1,dt*1.6));
        // heading from motion; glide some of the time
        const vel=tmp.copy(b.pos).sub(b.prev);if(vel.lengthSq()<1e-6)vel.set(0,0,-1);
        look.lookAt(b.pos,b.pos.clone().add(vel),up);q.setFromRotationMatrix(look);
        b.gliding=Math.max(0,b.gliding-dt);if(Math.random()<dt*k.glide)b.gliding=rnd(.6,2);
        const flap=b.gliding>0?.18:Math.sin(t*k.flap+b.phase)*.75;
        s.setScalar(k.size);
        m.compose(b.pos,q,s);bodies.setMatrixAt(i,m);
        // wings hinge at the shoulders; the left wing is the right one mirrored
        wingPos.set(0,.03*k.size,-.02*k.size).applyQuaternion(q).add(b.pos);
        qw.setFromAxisAngle(Z,flap);m.compose(wingPos,q.clone().multiply(qw),s);wingsR.setMatrixAt(i,m);
        qw.setFromAxisAngle(Z,-flap);m.compose(wingPos,q.clone().multiply(qw),mirror.set(-k.size,k.size,k.size));wingsL.setMatrixAt(i,m);
        if(!b.painted||b.paintedIndex!==i){paint(i,k);b.painted=true;b.paintedIndex=i;}
      });
      for(const mesh of [bodies,wingsL,wingsR]){mesh.count=birds.length;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
    }
  };
}
