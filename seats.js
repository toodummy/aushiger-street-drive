import * as THREE from 'three';

// Lada 2106 interior: replaces the plain box seats with period-correct seats —
// red velour with pleated channels (vertical on the backs, across the cushions),
// maroon vinyl sides and edges, round maroon vinyl headrests on chrome posts,
// and a matching pleated rear bench. Built in the car's own coordinates
// (x forward, y up, z across) from the positions of the original seat boxes.

function velourTexture(){
  // fine pile noise so the cloth catches light like velour, not plastic
  const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');
  g.fillStyle='#808080';g.fillRect(0,0,256,256);
  for(let i=0;i<9000;i++){const v=110+Math.random()*60|0;g.fillStyle=`rgb(${v},${v},${v})`;g.fillRect(Math.random()*256,Math.random()*256,1,1+Math.random()*2);}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(6,6);return t;
}
let shared=null;
function materials(model){
  if(shared)return shared;
  const pile=velourTexture();
  let chrome=null;model.traverse(o=>{if(!chrome&&o.isMesh&&/chrome/i.test(o.material?.name||''))chrome=o.material;});
  shared={
    velour:new THREE.MeshPhysicalMaterial({name:'Seat_Velour',color:'#b5162f',roughness:.95,roughnessMap:pile,bumpMap:pile,bumpScale:.4,sheen:1,sheenColor:new THREE.Color('#ff8a96'),sheenRoughness:.35}),
    doorVinyl:new THREE.MeshPhysicalMaterial({name:'Door_Vinyl',color:'#8e1d2a',roughness:.5,clearcoat:.2,side:THREE.DoubleSide}),
    handle:new THREE.MeshStandardMaterial({name:'Door_Handle',color:'#151313',roughness:.45}),
    vinyl:new THREE.MeshPhysicalMaterial({name:'Seat_Vinyl',color:'#741a24',roughness:.4,clearcoat:.35,clearcoatRoughness:.4}),
    chrome:chrome||new THREE.MeshStandardMaterial({name:'Chrome',color:'#e6e8ea',metalness:1,roughness:.18})
  };
  return shared;
}

// rounded box: subdivided box whose vertices are pulled onto a rounded shape
function roundedBox(w,h,d,r,seg=4){
  const g=new THREE.BoxGeometry(w,h,d,seg*2,seg*2,seg*2),p=g.attributes.position,v=new THREE.Vector3(),inner=new THREE.Vector3(w/2-r,h/2-r,d/2-r);
  for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i);
    const c=new THREE.Vector3(THREE.MathUtils.clamp(v.x,-inner.x,inner.x),THREE.MathUtils.clamp(v.y,-inner.y,inner.y),THREE.MathUtils.clamp(v.z,-inner.z,inner.z));
    const n=v.clone().sub(c);if(n.lengthSq()>1e-12){n.setLength(r);v.copy(c).add(n);}
    p.setXYZ(i,v.x,v.y,v.z);
  }
  g.computeVertexNormals();return g;
}
// a puffy cloth panel with sewn channels; lies in XY, bulging toward +Z.
// channels run along Y (seams are spaced across X) — rotate it to suit.
function pleatedPanel(w,h,puff,channels,edge=.035,segX=96,segY=36){
  const g=new THREE.PlaneGeometry(w,h,segX,segY),p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i);
    const ex=Math.min(1,(w/2-Math.abs(x))/edge),ey=Math.min(1,(h/2-Math.abs(y))/edge);
    const round=Math.sqrt(Math.max(0,1-(1-Math.min(ex,ey))**2));            // rolled edges
    const f=((x/w+.5)*channels)%1,s=Math.min(f,1-f);                        // 0 at a seam, .5 mid-channel
    const seam=THREE.MathUtils.smoothstep(s,0,.09);                          // narrow sewn groove
    const channel=.6+.25*seam+.15*Math.sin(f*Math.PI);                       // flat-topped channels, slight crown
    const sag=1-.25*(y/h+.5)**2;                                            // slightly fuller low down
    p.setZ(i,puff*round*channel*sag);
  }
  g.computeVertexNormals();return g;
}

function bucketSeat(m,width,cushionDepth,backHeight,withHeadrest=true){
  const seat=new THREE.Group();seat.name='Seat 2106';
  const mesh=(g,mat,parent=seat)=>{const o=new THREE.Mesh(g,mat);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
  // cushion: vinyl base with a pleated velour top (seams run across the seat)
  const ch=.13;
  mesh(roundedBox(cushionDepth,ch,width,.04),m.vinyl).position.set(cushionDepth/2,-ch/2,0);
  const top=mesh(pleatedPanel(cushionDepth-.05,width-.07,.022,5,.04),m.velour);
  top.rotation.set(-Math.PI/2,0,0);top.position.set(cushionDepth/2+.005,.0,0);
  // front roll in velour
  const roll=mesh(new THREE.CylinderGeometry(.045,.045,width-.07,20,1),m.velour);roll.rotation.x=Math.PI/2;roll.position.set(cushionDepth-.035,-.03,0);
  // backrest, reclined, pivoting at its bottom-rear corner
  const back=new THREE.Group();back.rotation.z=.2;seat.add(back);
  const bt=.11;
  mesh(roundedBox(bt,backHeight,width,.045),m.vinyl,back).position.set(-bt/2,backHeight/2,0);
  const face=mesh(pleatedPanel(width-.08,backHeight-.09,.02,6,.04),m.velour,back);
  face.rotation.y=Math.PI/2;face.position.set(.0,backHeight/2-.02,0);
  if(withHeadrest){
    for(const s of [-1,1]){const post=mesh(new THREE.CylinderGeometry(.007,.007,.13,10),m.chrome,back);post.position.set(-bt/2,backHeight+.05,s*.075);}
    const hr=mesh(new THREE.CapsuleGeometry(.07,width*.42,8,20),m.vinyl,back);hr.rotation.x=Math.PI/2;hr.position.set(-bt/2+.005,backHeight+.15,0);hr.scale.set(1,1,.92);
  }
  return {seat,back};
}
function rearBench(m,width,cushionDepth,backHeight){
  const g=new THREE.Group();g.name='Rear bench 2106';
  const mesh=(geo,mat,parent=g)=>{const o=new THREE.Mesh(geo,mat);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
  const ch=.13;
  mesh(roundedBox(cushionDepth,ch,width,.04),m.vinyl).position.set(cushionDepth/2,-ch/2,0);
  const top=mesh(pleatedPanel(cushionDepth-.05,width-.07,.022,5,.04,64,60),m.velour);top.rotation.set(-Math.PI/2,0,0);top.position.set(cushionDepth/2+.005,0,0);
  const roll=mesh(new THREE.CylinderGeometry(.045,.045,width-.07,20,1),m.velour);roll.rotation.x=Math.PI/2;roll.position.set(cushionDepth-.035,-.03,0);
  const back=new THREE.Group();back.rotation.z=.26;g.add(back);
  const bt=.1;
  mesh(roundedBox(bt,backHeight,width,.045),m.vinyl,back).position.set(-bt/2,backHeight/2,0);
  // two outer seats and a narrow middle, like the real bench
  const wSide=(width-.1)*.4,wMid=(width-.1)*.2-.02;
  for(const [z,w,n] of [[-(wMid/2+wSide/2+.02),wSide,6],[0,wMid,3],[wMid/2+wSide/2+.02,wSide,6]]){
    const f=mesh(pleatedPanel(w,backHeight-.08,.02,n,.035,64,36),m.velour,back);f.rotation.y=Math.PI/2;f.position.set(0,backHeight/2-.02,z);
  }
  return g;
}

function openCabin(root,cabin){
  let beltline=Infinity;
  const inv=new THREE.Matrix4().copy(root.matrixWorld).invert(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),n=new THREE.Vector3(),t=new THREE.Vector3();
  root.traverse(o=>{
    if(!o.isMesh||!/^Body_/.test(o.name)||!/Beige/.test(o.material?.name||''))return;
    const m=new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld),g=o.geometry,p=g.attributes.position;
    const idx=g.index?Array.from(g.index.array):[...Array(p.count).keys()],keep=[];let low=Infinity;
    for(let i=0;i<idx.length;i+=3){
      a.fromBufferAttribute(p,idx[i]).applyMatrix4(m);b.fromBufferAttribute(p,idx[i+1]).applyMatrix4(m);c.fromBufferAttribute(p,idx[i+2]).applyMatrix4(m);
      t.copy(a).add(b).add(c).divideScalar(3);n.subVectors(b,a).cross(c.clone().sub(a)).normalize();
      if(cabin.containsPoint(t)&&Math.abs(n.y)>.75){low=Math.min(low,t.y);continue;}
      keep.push(idx[i],idx[i+1],idx[i+2]);
    }
    if(keep.length!==idx.length){g.setIndex(keep);beltline=Math.min(beltline,low);}
  });
  return beltline;
}
const ORIGINAL=/^(Seat_Front_|Seat_Rear_|RearSeat_|Headrest_)/;
function boxInRoot(root,objs){
  const box=new THREE.Box3(),inv=new THREE.Matrix4().copy(root.matrixWorld).invert(),b=new THREE.Box3();
  for(const o of objs){o.geometry.computeBoundingBox();b.copy(o.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld));box.union(b);}
  return box;
}
export function restyle2106Seats(root){
  root.updateMatrixWorld(true);
  const found={};root.traverse(o=>{if(o.isMesh&&ORIGINAL.test(o.name))found[o.name]=o;});
  const fc=[found.Seat_Front_Cushion_1,found['Seat_Front_Cushion_-1']].filter(Boolean);
  if(fc.length<2||!found.Seat_Rear_Cushion)return false;
  const m=materials(root),holder=new THREE.Group();holder.name='Velour interior 2106';
  // front buckets, placed where the old cushions and backs were
  for(const s of ['1','-1']){
    const cush=boxInRoot(root,[found['Seat_Front_Cushion_'+s]]),back=found['Seat_Front_Back_'+s]?boxInRoot(root,[found['Seat_Front_Back_'+s]]):null;
    const width=cush.max.z-cush.min.z,depth=cush.max.x-cush.min.x+.04,height=back?back.max.y-cush.max.y+.02:.6;
    const {seat}=bucketSeat(m,width,depth,height*.86);
    seat.position.set(back?back.max.x-.01:cush.min.x,cush.max.y,(cush.min.z+cush.max.z)/2);holder.add(seat);
  }
  const rc=boxInRoot(root,[found.Seat_Rear_Cushion]);
  const rb=[found.RearSeat_1,found['RearSeat_-1']].filter(Boolean);
  const rbox=rb.length?boxInRoot(root,rb):null;
  const bench=rearBench(m,rc.max.z-rc.min.z,rc.max.x-rc.min.x+.06,rbox?Math.max(.45,rbox.max.y-rc.max.y):.55);
  bench.position.set(rc.min.x-.04,rc.max.y,(rc.min.z+rc.max.z)/2);holder.add(bench);
  for(const o of Object.values(found))o.visible=false;
  // the body shell is closed at the window line; open it over the cabin so the seats are visible
  const fb=boxInRoot(root,[found.Seat_Front_Cushion_1,found['Seat_Front_Cushion_-1']]);
  const cabin=new THREE.Box3(new THREE.Vector3(rc.min.x-.08,fb.max.y+.08,rc.min.z-.06),new THREE.Vector3(fb.max.x+.45,(rbox?rbox.max.y:fb.max.y+.5)+.05,rc.max.z+.06));
  const belt=openCabin(root,cabin);
  // red vinyl door cards like the real car: horizontal pleats, chrome strip, black pull handle
  if(Number.isFinite(belt)){
    const x0=rc.min.x+.12,x1=fb.max.x+.3,y0=fb.min.y-.07,y1=belt-.015,len=x1-x0,hgt=y1-y0;
    for(const side of [-1,1]){
      const z=side*(rc.max.z+.03),door=new THREE.Group();door.position.set((x0+x1)/2,(y0+y1)/2,z);door.rotation.y=side>0?Math.PI:0;holder.add(door);
      const card=new THREE.Mesh(pleatedPanel(hgt,len,.008,7,.02,40,60),m.doorVinyl);card.rotation.z=Math.PI/2;card.receiveShadow=true;door.add(card);
      const strip=new THREE.Mesh(new THREE.BoxGeometry(len*.96,.012,.006),m.chrome);strip.position.set(0,hgt*.28,.012);door.add(strip);
      for(const cx of [-len*.27,len*.22]){
        const pull=new THREE.Mesh(roundedBox(.26,.035,.05,.012,2),m.handle);pull.position.set(cx,hgt*.05,.03);pull.rotation.z=.12;pull.castShadow=true;door.add(pull);
      }
    }
  }
  root.add(holder);
  return true;
}
