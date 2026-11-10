import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {loadCar} from './garage.js?v=45';
import {crumple,ownGeometry} from './damage.js?v=1';

// Random village traffic: oncoming cars in the left lane, slow cars ahead you can pass,
// and faster cars that come up behind you and overtake when the other lane is clear.
// Everything works in route coordinates: d = metres along the road, lat = metres right of centre.
const LANE=1.7, CAR_LEN=4.3, CAR_W=1.75;
const PAINTS=['#ece9df','#9b1c1c','#1f3f75','#2f5d3a','#d9c9a2','#151618','#6d7f8e','#c4682a','#6e2338','#b8b8b0','#2a6f86'];
const MODELS=[
  {url:'./cars/lada-2106.glb?v=6',paint:/Lada_Beige/},
  {url:'./cars/lada-kalina.glb',paint:/Kalina_Blue/}
];

// Bake a loaded car into one mesh per material, so each traffic car costs ~20 draw calls, not 350.
function bake(root,paintRe){
  root.updateMatrixWorld(true);
  const inv=new THREE.Matrix4().copy(root.matrixWorld).invert(),byMat=new Map();
  root.traverse(o=>{
    if(!o.isMesh||!o.visible)return;
    const m4=new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld);
    let g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
    const mats=Array.isArray(o.material)?o.material:[o.material];
    const parts=Array.isArray(o.material)&&g.groups.length?g.groups.map(gr=>({mat:mats[gr.materialIndex],start:gr.start,count:gr.count})):[{mat:mats[0],start:0,count:g.attributes.position.count}];
    for(const part of parts){
      const sub=new THREE.BufferGeometry();
      for(const name of ['position','normal','uv']){
        const a=g.attributes[name];
        if(a)sub.setAttribute(name,new THREE.BufferAttribute(a.array.slice(part.start*a.itemSize,(part.start+part.count)*a.itemSize),a.itemSize));
        else if(name==='uv')sub.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(part.count*2),2));
      }
      if(!sub.attributes.normal)sub.computeVertexNormals();
      sub.applyMatrix4(m4);
      if(!byMat.has(part.mat))byMat.set(part.mat,[]);byMat.get(part.mat).push(sub);
    }
  });
  const group=new THREE.Group();let paint=null;
  for(const [mat,geos] of byMat){
    const merged=mergeGeometries(geos,false);if(!merged)continue;
    const mesh=new THREE.Mesh(merged,mat);mesh.castShadow=true;mesh.receiveShadow=true;
    if(paintRe.test(mat.name||''))paint=mesh;
    group.add(mesh);
  }
  return {group,paint};
}

export function createTraffic(scene,sample,{onPlayerHit}={}){
  const templates=[],cars=[],up=new THREE.Vector3(0,1,0),m4=new THREE.Matrix4();
  const tmpP=new THREE.Vector3(),tmpQ=new THREE.Vector3(),fwd=new THREE.Vector3(),right=new THREE.Vector3();
  let spawnClock=2,id=0;
  // Load in the background after the world is ready; traffic starts when the first model arrives.
  (async()=>{for(const m of MODELS){try{
    const r=await fetch(m.url);if(!r.ok)continue;
    const car=await loadCar([new File([await r.arrayBuffer()],m.url.split('/').pop().split('?')[0])]);
    templates.push(bake(car.root,m.paint));
  }catch(e){console.warn('Traffic model skipped',e);}}})();

  function make(){
    const t=templates[Math.floor(Math.random()*templates.length)];
    const obj=t.group.clone();
    if(t.paint){const i=t.group.children.indexOf(t.paint),mesh=obj.children[i];mesh.material=t.paint.material.clone();mesh.material.color.set(PAINTS[Math.floor(Math.random()*PAINTS.length)]);obj.userData.paint=mesh.material;}
    obj.name='Traffic car';scene.add(obj);return obj;
  }
  function spawn(kind,player){
    if(!templates.length)return;
    let d,dir,speed;
    if(kind==='oncoming'){d=player.distance+230+Math.random()*180;dir=-1;speed=11+Math.random()*6;if(d>1495)return;}
    else if(kind==='slow'){d=player.distance+170+Math.random()*120;dir=1;speed=7+Math.random()*4;if(d>1420)return;}
    else{if(player.distance<110||player.speed>17)return;d=player.distance-80-Math.random()*30;dir=1;speed=Math.max(player.speed+5,13+Math.random()*6);}
    const lat=dir*LANE;
    if(cars.some(c=>Math.abs(c.d-d)<25&&Math.sign(c.lat)===Math.sign(lat)))return;
    cars.push({id:id++,kind,d,dir,lat,targetLat:lat,speed,cruise:speed,baseCruise:speed,damage:0,hitCool:0,obj:make(),passing:null});
  }
  function place(c){
    const a=sample(c.d),b=sample(c.d+1);fwd.copy(b).sub(a).normalize();right.crossVectors(fwd,up).normalize();
    tmpP.copy(a).addScaledVector(right,c.lat);
    const look=tmpQ.copy(fwd).multiplyScalar(c.dir);
    // lean slightly into lane changes
    m4.lookAt(tmpP,tmpP.clone().add(look).addScaledVector(right,(c.targetLat-c.lat)*.08*c.dir),up);
    c.obj.position.copy(tmpP);c.obj.quaternion.setFromRotationMatrix(m4);
  }
  // nearest thing ahead of car c within its lane band
  function ahead(c,lat,player,cows){
    let best=null,gap=Infinity;
    const consider=(d,l,len,speedAlong,ref)=>{
      if(Math.abs(l-lat)>1.9||(d-c.d)*c.dir<=.5)return;const g=(d-c.d)*c.dir-(CAR_LEN+len)/2;
      if(g>-1&&g<gap){gap=g;best={gap:g,speed:speedAlong,ref,d};}
    };
    for(const o of cars)if(o!==c)consider(o.d,o.lat,CAR_LEN,o.speed*o.dir*c.dir,o);
    consider(player.distance,player.lateral,CAR_LEN,player.speed*c.dir,'player');
    for(const w of cows)consider(w.d,w.lat,2.4,0,'cow');
    return best;
  }
  function oncomingClear(c,len){return !cars.some(o=>o.dir!==c.dir&&(o.d-c.d)*c.dir>-5&&(o.d-c.d)*c.dir<len);}

  return {
    get count(){return cars.length;},
    update(dt,player,cows=[]){
      if(!templates.length)return;
      spawnClock-=dt;
      if(spawnClock<=0){
        const r=Math.random();
        if(cars.filter(c=>c.kind==='oncoming').length<3&&r<.5)spawn('oncoming',player);
        else if(cars.filter(c=>c.kind==='overtake').length<1&&r<.78)spawn('overtake',player);
        else if(cars.filter(c=>c.kind==='slow').length<1)spawn('slow',player);
        spawnClock=3+Math.random()*5;
      }
      for(const c of cars){
        // overtaking: a same-direction car stuck behind something slower pulls out when the other lane is clear
        const home=c.dir*LANE,other=-home;
        if(!c.passing){
          const blk=ahead(c,home,player,cows);
          const cowClear=!cows.some(w=>Math.abs(w.lat-other)<2.2&&(w.d-c.d)*c.dir>-3&&(w.d-c.d)*c.dir<45);
          // pass slower cars (same direction only), or ease around a cow standing in the lane
          const wantPass=blk&&(blk.ref==='cow'?blk.gap<14:(c.dir===1&&blk.gap<22&&blk.speed<c.cruise-2));
          if(wantPass&&oncomingClear(c,blk.ref==='cow'?80:170)&&cowClear){c.passing={ref:blk.ref,d:blk.d};c.targetLat=other;}
        }
        if(c.passing){
          const pd=c.passing.ref==='player'?player.distance:c.passing.ref==='cow'?c.passing.d:c.passing.ref.d;
          if((pd-c.d)*c.dir<-(CAR_LEN+7)||(!oncomingClear(c,60)&&(pd-c.d)*c.dir>2)){c.passing=null;c.targetLat=home;}
        }
        const blk=ahead(c,c.targetLat,player,cows,c.passing),blk2=c.targetLat!==c.lat?ahead(c,c.lat,player,cows):null;
        let target=c.cruise;
        for(const b of [blk,blk2])if(b&&b.gap<35)target=Math.min(target,Math.max(0,b.speed+(b.gap-3)*.45));
        c.speed+=THREE.MathUtils.clamp(target-c.speed,-8*dt,3*dt);
        c.lat+=THREE.MathUtils.clamp(c.targetLat-c.lat,-1.3*dt,1.3*dt);
        c.d+=c.speed*c.dir*dt;
        // collisions with the player: both cars take damage, share momentum and keep going (slower)
        c.hitCool=Math.max(0,c.hitCool-dt);
        const dd=player.distance-c.d,dl=player.lateral-c.lat;
        if(Math.abs(dd)<CAR_LEN&&Math.abs(dl)<CAR_W){
          const side=Math.sign(dd||1),vOther=c.speed*c.dir,closing=(vOther-player.speed)*side;
          if(closing>1.2&&c.hitCool<=0){
            const amount=Math.min(.55,.04+closing/45);c.hitCool=.8;
            const vMid=(player.speed+vOther)/2;
            player.speed=vMid-side*closing*.12;player.cruise=false;
            c.speed=Math.max(0,(vMid+side*closing*.12)*c.dir);
            c.damage=Math.min(1,c.damage+amount);c.cruise=c.damage>=.999?0:c.baseCruise*(.25+.75*(1-c.damage));
            const a=sample((player.distance+c.d)/2);fwd.copy(sample((player.distance+c.d)/2+1)).sub(a).normalize();right.crossVectors(fwd,up).normalize();
            const point=a.clone().addScaledVector(right,(player.lateral+c.lat)/2);point.y+=.6;
            const intoCar=fwd.clone().multiplyScalar(-side);
            ownGeometry(c.obj);crumple(c.obj,point,intoCar,1.0,.12+amount*.45);
            onPlayerHit?.({point,amount,dir:fwd.clone().multiplyScalar(side)});
          }
          player.distance=c.d+side*CAR_LEN;
        }
        place(c);
      }
      for(let i=cars.length-1;i>=0;i--){
        const c=cars[i],rel=(c.d-player.distance);
        if(rel<-140||rel>520||c.d<1||c.d>1499){scene.remove(c.obj);c.obj.userData.paint?.dispose();cars.splice(i,1);}
      }
    },
    obstacles(){return cars.map(c=>({d:c.d,lat:c.lat,dir:c.dir,speed:c.speed}));}
  };
}
