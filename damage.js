import * as THREE from 'three';

// Crash damage: dents the actual car mesh around the impact point, remembers the original shape
// so Restart can repair it, and drives a small engine-smoke effect once the car is badly hurt.
const tmp=new THREE.Vector3(),lp=new THREE.Vector3(),ld=new THREE.Vector3(),inv=new THREE.Matrix4();
const hash=i=>{const x=Math.sin(i*127.1)*43758.5453;return x-Math.floor(x);};

export function crumple(root,point,dir,radius=.9,depth=.18){
  if(!root)return;
  root.updateMatrixWorld(true);
  root.traverse(o=>{
    if(!o.isMesh||o.isSkinnedMesh)return;
    const g=o.geometry,pos=g.attributes.position;if(!pos)return;
    const scale=o.matrixWorld.getMaxScaleOnAxis()||1,r=radius/scale,dep=depth/scale;
    inv.copy(o.matrixWorld).invert();lp.copy(point).applyMatrix4(inv);
    ld.copy(dir).transformDirection(inv);
    if(!g.boundingSphere)g.computeBoundingSphere();
    if(g.boundingSphere.center.distanceTo(lp)>g.boundingSphere.radius+r)return;
    if(!g.userData.originalPositions){g.userData.originalPositions=pos.array.slice();}
    let moved=false;
    for(let i=0;i<pos.count;i++){
      tmp.fromBufferAttribute(pos,i);const d=tmp.distanceTo(lp);if(d>=r)continue;
      const f=(1-d/r)**2*(.55+.9*hash(i+Math.floor(point.x*13)));
      tmp.addScaledVector(ld,dep*f);
      // a little random crinkle so it reads as bent metal, not a smooth dent
      tmp.x+=(hash(i*3.1)-.5)*dep*.25*f;tmp.y+=(hash(i*5.7)-.5)*dep*.25*f;tmp.z+=(hash(i*7.3)-.5)*dep*.25*f;
      pos.setXYZ(i,tmp.x,tmp.y,tmp.z);moved=true;
    }
    if(moved){pos.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();}
  });
}
export function repair(root){
  root?.traverse(o=>{const g=o.geometry,orig=g?.userData.originalPositions;if(!orig)return;g.attributes.position.array.set(orig);g.attributes.position.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();delete g.userData.originalPositions;});
}
// Geometry of cloned traffic cars is shared with the template; give a car its own copy before denting it.
export function ownGeometry(root){
  if(root.userData.ownGeometry)return;root.userData.ownGeometry=true;
  root.traverse(o=>{if(o.isMesh)o.geometry=o.geometry.clone();});
}

function smokeTexture(){
  const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');
  const r=g.createRadialGradient(32,32,2,32,32,31);r.addColorStop(0,'rgba(255,255,255,.85)');r.addColorStop(.5,'rgba(255,255,255,.35)');r.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=r;g.fillRect(0,0,64,64);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
export function createSmoke(scene){
  const tex=smokeTexture(),puffs=[];let clock=0;
  for(let i=0;i<26;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,color:'#6b6b6b',transparent:true,opacity:0,depthWrite:false}));s.visible=false;s.userData={life:0,max:1};scene.add(s);puffs.push(s);}
  return {update(dt,source,amount,velocity){
    clock-=dt;
    if(source&&amount>.35&&clock<=0){
      clock=.16-amount*.1;const p=puffs.find(s=>!s.visible);
      if(p){p.visible=true;p.position.copy(source).add(tmp.set((Math.random()-.5)*.4,0,(Math.random()-.5)*.4));p.userData={life:0,max:1.6+Math.random(),vel:new THREE.Vector3((Math.random()-.5)*.3,.9+Math.random()*.5,(Math.random()-.5)*.3).addScaledVector(velocity||tmp.set(0,0,0),.15)};p.material.color.set(amount>.7?'#2e2e2e':'#7a7a76');}
    }
    for(const p of puffs){if(!p.visible)continue;const u=p.userData;u.life+=dt;const t=u.life/u.max;if(t>=1){p.visible=false;continue;}
      p.position.addScaledVector(u.vel,dt);p.scale.setScalar(.5+t*2.2);p.material.opacity=(1-t)*.55;}
  }};
}
