import * as THREE from 'three';

function randomSource(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}

// Sample the existing Blender hillside triangles, so added plants sit on its actual surface.
function groundSampler(root){
  const bins=new Map(),v=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];
  root.updateMatrixWorld(true);
  root.traverse(o=>{
    if(!o.isMesh||!/escarpment|valley.slope/i.test(o.name))return;
    const g=o.geometry,p=g.attributes.position,ix=g.index;
    for(let i=0;i<(ix?ix.count:p.count);i+=3){
      for(let k=0;k<3;k++)v[k].fromBufferAttribute(p,ix?ix.getX(i+k):i+k).applyMatrix4(o.matrixWorld);
      const tri=v.map(p=>[p.x,p.y,p.z]);
      const minX=Math.min(...v.map(p=>p.x)),maxX=Math.max(...v.map(p=>p.x));
      const minZ=Math.min(...v.map(p=>p.z)),maxZ=Math.max(...v.map(p=>p.z));
      if(minX>200||maxX< -140)continue;
      for(let x=Math.floor(minX/16);x<=Math.floor(maxX/16);x++)for(let z=Math.floor(minZ/16);z<=Math.floor(maxZ/16);z++){
        const key=x+','+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(tri);
      }
    }
  });
  return (x,z)=>{
    const candidates=bins.get(Math.floor(x/16)+','+Math.floor(z/16))||[];
    for(const [a,b,c] of candidates){
      const det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
      if(Math.abs(det)<1e-8)continue;
      const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det;
      const w=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det;
      const t=1-u-w;
      if(u>=-.001&&w>=-.001&&t>=-.001)return a[1]*u+b[1]*w+c[1]*t;
    }
    return null;
  };
}

function instance(scene,geo,mat,items,name,shadow=true){
  const mesh=new THREE.InstancedMesh(geo,mat,items.length),o=new THREE.Object3D();mesh.name=name;
  items.forEach((p,i)=>{o.position.set(p[0],p[1],p[2]);o.rotation.set(p[6]||0,p[4]||0,p[7]||0);o.scale.setScalar(p[3]||1);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);if(p[5])mesh.setColorAt(i,new THREE.Color(p[5]));});
  mesh.castShadow=shadow;mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);return mesh;
}

function bladeGeometry(rand){
  const positions=[],colors=[];
  for(let j=0;j<7;j++){
    const a=rand()*Math.PI*2,ox=(rand()-.5)*.23,oz=(rand()-.5)*.23,w=.012+rand()*.015,h=.12+rand()*.21;
    const dx=Math.cos(a)*w,dz=Math.sin(a)*w,bend=(rand()-.5)*.16;
    const points=[[ox-dx,0,oz-dz],[ox+dx,0,oz+dz],[ox+dx*.5+bend,h*.58,oz+dz*.5],[ox-dx,0,oz-dz],[ox+dx*.5+bend,h*.58,oz+dz*.5],[ox-dx*.5+bend,h*.58,oz-dz*.5],[ox-dx*.5+bend,h*.58,oz-dz*.5],[ox+dx*.5+bend,h*.58,oz+dz*.5],[ox+bend*1.7,h,oz+.025]];
    for(const p of points){positions.push(...p);const t=p[1]/h;colors.push(.10+t*.24,.26+t*.34,.035+t*.07);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}

function foliageTexture(rand){
  const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');
  for(let k=0;k<270;k++){
    const a=rand()*Math.PI*2,r=Math.sqrt(rand())*106,px=128+Math.cos(a)*r,py=128+Math.sin(a)*r*.92;
    const hue=90+rand()*26,light=24+rand()*24;
    ctx.fillStyle=`hsl(${hue} 52% ${light}%)`;ctx.beginPath();ctx.ellipse(px,py,3+rand()*5,2+rand()*3,a,0,Math.PI*2);ctx.fill();
  }
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

export function enrichWorld(scene,root,sample,packs){
  const rand=randomSource(236),ground=groundSampler(root),grass=[];const stone=[],flowers=[];
  const up=new THREE.Vector3(0,1,0);
  const point=(u,s)=>{const p=sample(s),next=sample(Math.min(1499,s+1)),r=new THREE.Vector3(-(next.z-p.z),0,next.x-p.x).normalize();return p.addScaledVector(r,u);};
  for(let i=0;i<30000;i++){
    const s=rand()*1495+2,side=rand()<.5?-1:1;
    const u=side*(5.8+Math.pow(rand(),2)*17),p=point(u,s),h=ground(p.x,p.z);
    if(h===null||u>7.1&&u<8.7&&s>178&&s<596||s>680&&Math.abs(u)>9)continue;
    grass.push([p.x,h+.015,p.z,.55+rand()*.8,rand()*Math.PI*2]);
    if(i%10===0)flowers.push([p.x,h+.12,p.z,.7+rand()*.7,rand()*Math.PI*2]);
  }
  const grassMat=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.95});
  const grassGeo=bladeGeometry(rand);
  // Separate chunks allow culling vegetation behind and far away from the driver.
  for(let j=0;j<15;j++)instance(scene,grassGeo,grassMat,grass.filter(p=>-p[2]>=j*100&&-p[2]<(j+1)*100),'Roadside grass clumps '+j,false);
  const flowerMat=new THREE.MeshStandardMaterial({color:'#d3b72e',roughness:1});
  instance(scene,new THREE.IcosahedronGeometry(.025,0),flowerMat,flowers,'Spring dandelions',false);
  for(let i=0;i<450;i++){
    const s=80+rand()*570,p=point(10+rand()*26,s),h=ground(p.x,p.z);if(h===null)continue;
    stone.push([p.x,h-.06,p.z,.15+rand()*.4,rand()*Math.PI*2]);
  }
  const rockMat=new THREE.MeshStandardMaterial({map:packs.maps.stone.map,normalMap:packs.maps.stone.normalMap,roughness:1,color:'#bcb3a2'});
  instance(scene,new THREE.DodecahedronGeometry(1,1),rockMat,stone,'Exposed hillside stones');

  // Fine guardrail fasteners, joining plates and post-end caps catch the daylight.
  const bolts=[],seams=[];
  for(const [side,start,end] of [[1,0,652],[-1,325,930]])for(let s=start;s<end;s+=4){
    for(const dz of [.57,.73]){const p=point(side*5.44,s);bolts.push([p.x,p.y+dz,p.z,1,0]);}
    if(s%12<4){const p=point(side*5.49,s);seams.push([p.x,p.y+.67,p.z,1,0]);}
  }
  const boltMat=new THREE.MeshStandardMaterial({color:'#b5b9b8',metalness:.82,roughness:.32});
  const boltGeo=new THREE.CylinderGeometry(.026,.026,.04,6);boltGeo.rotateZ(Math.PI/2);
  instance(scene,boltGeo,boltMat,bolts,'Guardrail hex bolts',false);
  instance(scene,new THREE.BoxGeometry(.025,.34,.12),boltMat,seams,'Guardrail joints',false);

  // Dense clusters fill gaps between the already modeled branches and individual leaves.
  const clusters=[],seenTrees=new Set();
  root.traverse(o=>{
    if(!o.isMesh||!/broadleaf.tree|hillside.shrub/i.test(o.name)||!/leaves/i.test(o.material.name))return;
    const base=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion();o.matrixWorld.decompose(base,rotation,scale);
    const key=base.toArray().map(v=>v.toFixed(2)).join(',');if(seenTrees.has(key))return;seenTrees.add(key);
    for(let i=0;i<22;i++){
      const a=rand()*Math.PI*2,r=Math.sqrt(rand())*2.0*scale.x;
      clusters.push([base.x+Math.cos(a)*r,base.y+(3.7+rand()*2.5)*scale.y,base.z+Math.sin(a)*r,(.85+rand()*.75)*scale.x,rand()*Math.PI*2,null,(rand()-.5)*1.5]);
    }
  });
  const leafMap=foliageTexture(rand),leafMat=new THREE.MeshStandardMaterial({map:leafMap,alphaTest:.45,side:THREE.DoubleSide,roughness:.9});
  instance(scene,new THREE.PlaneGeometry(1.5,1.5),leafMat,clusters,'Fine canopy leaf clusters');

  // Visible domestic details: drainpipes, wall brackets and satellite dishes.
  const pipes=[],dishes=[],brackets=[];
  const roofs=[];
  root.traverse(o=>{if(o.isMesh&&/metal.*roof|asbestos.*cement/i.test(o.material?.name||'')&&!/valley.context/i.test(o.name)){
    const b=new THREE.Box3().setFromObject(o),size=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3());
    if(size.x>5&&size.z>7&&size.y>1&&size.y<5&&c.z<-500)roofs.push({b,c,size});
  }});
  for(const {b,c,size} of roofs){
    const side=c.x>sample(-c.z).x?-1:1,x=side<0?b.min.x:b.max.x,z=b.min.z+.8;
    const h=ground(x,z)??sample(-z).y,roofY=b.min.y;
    const tube=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,Math.max(.5,roofY-h),8),boltMat);
    tube.position.set(x+side*.02,(roofY+h)/2,z);tube.castShadow=true;scene.add(tube);
    if(rand()>.62){dishes.push([x+side*.4,roofY-.6,c.z,1,side*Math.PI/2,null,.3]);brackets.push([x+side*.2,roofY-.85,c.z,1,0]);}
  }
  const dishGeo=new THREE.SphereGeometry(.37,20,12,0,Math.PI*2,0,.65);dishGeo.rotateX(Math.PI/2);
  const dishMat=new THREE.MeshStandardMaterial({color:'#c6c7bf',side:THREE.DoubleSide,metalness:.2,roughness:.6});
  instance(scene,dishGeo,dishMat,dishes,'Satellite dishes');
  instance(scene,new THREE.BoxGeometry(.4,.06,.06),boltMat,brackets,'Dish mounting brackets');
  return {grassClumps:grass.length,flowers:flowers.length,canopyClusters:clusters.length,bolts:bolts.length,rocks:stone.length,drainpipes:roofs.length};
}

// Repeated tree geometry is rendered in batches instead of hundreds of draw calls.
export function batchTrees(root){
  const groups=new Map(),remove=[];
  root.updateMatrixWorld(true);
  root.traverse(o=>{
    if(!o.isMesh||!/broadleaf.tree|hillside.shrub/i.test(o.name))return;
    const key=o.geometry.uuid+'|'+o.material.uuid;
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o);remove.push(o);
  });
  for(const objects of groups.values()){
    // Split longitudinally so only nearby tree batches enter the shadow pass.
    for(let section=0;section<15;section++){
      const rows=objects.filter(o=>{const z=o.matrixWorld.elements[14];return -z>=section*100&&-z<(section+1)*100;});
      if(!rows.length)continue;
      const src=rows[0],mesh=new THREE.InstancedMesh(src.geometry,src.material,rows.length);
      rows.forEach((o,i)=>mesh.setMatrixAt(i,o.matrixWorld));
      mesh.castShadow=true;mesh.receiveShadow=true;mesh.name='Tree batch '+section;mesh.computeBoundingSphere();root.add(mesh);
    }
  }
  for(const o of remove)o.removeFromParent();
}
