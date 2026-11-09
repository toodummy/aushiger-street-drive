import * as THREE from 'three';
const fract=x=>x-Math.floor(x),hash=(x,z)=>fract(Math.sin(x*127.1+z*311.7)*43758.5453);
function noise(x,z){const a=Math.floor(x),b=Math.floor(z);let u=x-a,v=z-b;u=u*u*(3-2*u);v=v*v*(3-2*v);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(a,b),hash(a+1,b),u),THREE.MathUtils.lerp(hash(a,b+1),hash(a+1,b+1),u),v);}
const fbm=(x,z)=>noise(x,z)*.55+noise(x*2.07,z*2.07)*.27+noise(x*4.13,z*4.13)*.18;
export const riverCenter=z=>-620+90*Math.sin(z*.0019)+36*Math.sin(z*.0041+.8);
export const riverLevel=z=>-34+z*.0008;
export const riverHalfWidth=z=>29+9*Math.sin(z*.0023+2)+5*Math.sin(z*.007);
function grid(name,nx,nz,point,color,material){
 const p=[],c=[],uv=[],idx=[];
 for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const v=point(i/nx,j/nz);p.push(...v);if(color)c.push(...color(v));uv.push(i/nx,j/nz);}
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;idx.push(a,b,c,b,d,c);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));if(color)g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.setIndex(idx);g.computeVertexNormals();g.computeBoundingSphere();const m=new THREE.Mesh(g,material);m.name=name;return m;
}
export function addLandscape(scene,world,packs){
 const group=new THREE.Group();group.name='Distant Caucasus and left valley river';scene.add(group);
 world.traverse(o=>{if(/Distant continuous mountain silhouette|Caucasus snowcap accents|Valley floor/.test(o.name))o.visible=false;});
 const haze=new THREE.Color('#a4bdcb');
 for(const [layer,depth,height,span] of [[0,9800,1380,17500],[1,6100,420,14500],[2,3600,135,12000]]){
  const rock=new THREE.Color(['#6b8296','#577d8b','#4a726d'][layer]),snow=new THREE.Color('#e4edf0');
  const range=grid('Distant mountain range '+layer,620,44,(u,v)=>{const x=(u-.5)*span*2,ridge=.39+.11*Math.sin(x*.00052+layer),flank=Math.max(0,1-Math.abs(v-ridge)/(v<ridge?ridge:1-ridge));const peak=height*(.37+.48*Math.pow(fbm(x*.0009,layer+11),.65)+.37*Math.abs(Math.sin(x*.00145+layer)*Math.sin(x*.00047+1)));return [x,-65+peak*Math.pow(flank,.9)+(noise(x*.005,v*20+layer)-.5)*height*.09*flank,-depth-v*(layer===0?3100:1800)];},p=>{let c=rock.clone().multiplyScalar(.73+.27*fbm(p[0]*.004,p[2]*.004));if(layer===0){const snowline=height*(.46+.12*noise(p[0]*.006,p[2]*.003));c.lerp(snow,THREE.MathUtils.clamp((p[1]-snowline)/110,0,1)*(.74+.26*noise(p[0]*.01,p[2]*.008)));}return c.lerp(haze,[.24,.19,.10][layer]).toArray();},new THREE.MeshBasicMaterial({vertexColors:true,fog:false,side:THREE.DoubleSide}));group.add(range);
 }
 const sections=[-4200,-2500,-1200,-500,-180,-90,-58,-45,-30,-14,0,14,30,45,58,90,180,320,480,700,1100,1900];
 const terrain=grid('Gravel banks and river floodplain',sections.length-1,480,(u,v)=>{const z=1400-v*7700,dx=sections[Math.round(u*(sections.length-1))],w=riverHalfWidth(z);const y=Math.abs(dx)<w?riverLevel(z)-2.8:riverLevel(z)+.8+Math.min(2.2,(Math.abs(dx)-w)*.045)+fbm(dx*.03,z*.03)*.8;return [riverCenter(z)+dx,y,z];},p=>{const d=Math.abs(p[0]-riverCenter(p[2])),w=riverHalfWidth(p[2]);return new THREE.Color(d<w?'#515e58':d<w+34?'#9b9684':'#8fb86a').multiplyScalar(.82+.36*fbm(p[0]*.04,p[2]*.04)).toArray();},new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}));terrain.receiveShadow=true;group.add(terrain);
 // Photo grass on the floodplain: metric UVs (4 m tiles) so it matches the street's grass up close.
 const grass=packs?.maps?.grass;
 if(grass){const tp=terrain.geometry.attributes.position,tuv=terrain.geometry.attributes.uv;for(let i=0;i<tp.count;i++)tuv.setXY(i,tp.getX(i)/4,-tp.getZ(i)/4);tuv.needsUpdate=true;
  Object.assign(terrain.material,{map:grass.map,normalMap:grass.normalMap,roughnessMap:grass.arm});terrain.material.normalScale.setScalar(.8);terrain.material.needsUpdate=true;}
 const time={value:0},mat=new THREE.MeshStandardMaterial({color:'#427f89',roughness:.24,metalness:.38,envMapIntensity:1.2,side:THREE.DoubleSide});
 mat.onBeforeCompile=s=>{s.uniforms.riverTime=time;s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 riverWorld;').replace('#include <begin_vertex>','#include <begin_vertex>\nriverWorld=(modelMatrix*vec4(position,1.0)).xyz;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 riverWorld; uniform float riverTime;').replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 float ripple=sin(riverWorld.x*2.4+riverWorld.z*.67+riverTime*2.5);float crosswave=sin(riverWorld.x*.71-riverWorld.z*1.23+riverTime*1.8);normal=normalize(normal+vec3(ripple*.13,crosswave*.09,0.0));`).replace('#include <color_fragment>',`#include <color_fragment>
 float current=sin(riverWorld.z*.28+riverTime*3.0+sin(riverWorld.x*.39)*2.0);diffuseColor.rgb*=.88+.12*current;`);};
 group.add(grid('Flowing mountain river',12,700,(u,v)=>{const z=1400-v*7700;return [riverCenter(z)+(u*2-1)*riverHalfWidth(z),riverLevel(z)+.08,z];},null,mat));
 const dummy=new THREE.Object3D();
 for(const [name,count,color,type] of [['Riverbank boulders',560,'#8d9186',0],['Riverbank tree belt',420,'#365331',1]]){const m=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({color,roughness:1}),count);m.name=name;for(let i=0;i<count;i++){const z=1000-hash(i,30)*6800,side=i%2?1:-1,d=riverHalfWidth(z)+(type?55:4)+hash(i,32)*(type?65:22);dummy.position.set(riverCenter(z)+side*d,riverLevel(z)+(type?7:1),z);dummy.scale.set(type?3+hash(i,33)*3:1+hash(i,33)*2.7,type?4+hash(i,34)*4:.7+hash(i,34)*1.4,type?3+hash(i,35)*3:1+hash(i,35)*2);dummy.rotation.set(0,hash(i,36)*6,0);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);}m.computeBoundingSphere();group.add(m);}
 return {group,update(dt){time.value+=dt;}};
}
