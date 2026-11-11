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
export function addLandscape(scene,world){
 const group=new THREE.Group();group.name='Distant Caucasus and left valley river';scene.add(group);
 world.traverse(o=>{if(/Distant continuous mountain silhouette|Caucasus snowcap accents|Valley floor/.test(o.name))o.visible=false;});
 const haze=new THREE.Color('#a4bdcb');
 // Distant ranges: denser ridged geometry plus a shader that adds rock strata, crags (bump),
 // snow that slides off steep faces, forested lower slopes on the nearer ranges, sun shading and haze.
 const phone=matchMedia('(max-width:820px)').matches||matchMedia('(pointer:coarse)').matches;
 const ridged=(x,z)=>1-Math.abs(noise(x,z)*2-1);
 const crags=(x,z)=>ridged(x*.0032,z*.0032)*.55+ridged(x*.0085,z*.0085)*.3+ridged(x*.021,z*.021)*.15-.5;
 const sunDir=new THREE.Vector3(-.48,.76,.44).normalize();
 for(const [layer,depth,height,span] of [[0,9800,1380,17500],[1,6100,420,14500],[2,3600,135,12000],[3,2300,85,9000]]){
  const rock=new THREE.Color(['#6b8296','#577d8b','#4a726d','#4f6e4a'][layer]),snow=new THREE.Color('#e4edf0');
  const cols=Math.round([1150,900,700,560][layer]*(phone?.62:1)),rows=Math.round([84,60,46,34][layer]*(phone?.7:1));
  const material=new THREE.MeshBasicMaterial({vertexColors:true,fog:false,side:THREE.DoubleSide});
  const u={mtnSun:{value:sunDir},mtnHaze:{value:haze},mtnHazeAmt:{value:[.2,.12,.06,.04][layer]},mtnHeight:{value:height},mtnLayer:{value:layer},
    mtnRockA:{value:new THREE.Color(['#4a5868','#44524f','#3f4a3c','#4a4a3c'][layer])},mtnRockB:{value:new THREE.Color(['#7a8490','#6f7268','#6d6a58','#7a7560'][layer])},mtnGreen:{value:new THREE.Color(['#4d5e45','#3e5a32','#3b5a2c','#3d5c2a'][layer])}};
  material.onBeforeCompile=sh=>{
   Object.assign(sh.uniforms,u);
   sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vMtnW; varying vec3 vMtnN;')
    .replace('#include <project_vertex>','#include <project_vertex>\nvMtnW=(modelMatrix*vec4(transformed,1.0)).xyz; vMtnN=normalize(mat3(modelMatrix)*normal);');
   sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
    varying vec3 vMtnW; varying vec3 vMtnN;
    uniform vec3 mtnSun,mtnHaze,mtnRockA,mtnRockB,mtnGreen; uniform float mtnHazeAmt,mtnHeight,mtnLayer;
    float mH(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float mN(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mH(i),mH(i+vec2(1,0)),f.x),mix(mH(i+vec2(0,1)),mH(i+1.0),f.x),f.y);}
    float mR(vec2 p){return 1.0-abs(mN(p)*2.0-1.0);}
    float mF(vec2 p){return mR(p)*.5+mR(p*2.13)*.3+mR(p*4.37)*.2;}`)
   .replace('#include <color_fragment>',`#include <color_fragment>
    vec3 n=normalize(vMtnN); if(n.y<0.0)n=-n;
    // crag bump from ridged noise, via screen-space derivatives
    float bumpH=mF(vMtnW.xz*.011+vMtnW.y*.004)*mtnHeight*.035+mN(vMtnW.xz*.05)*mtnHeight*.006;
    vec3 sx=dFdx(vMtnW),sy=dFdy(vMtnW),r1=cross(sy,n),r2=cross(n,sx);float det=dot(sx,r1);
    vec3 grad=sign(det)*(dFdx(bumpH)*r1+dFdy(bumpH)*r2);
    n=normalize(abs(det)*n-grad); if(n.y<0.0)n=-n;
    float slope=1.0-n.y;
    float h=vMtnW.y/mtnHeight;
    // layered rock with horizontal strata and weathering
    float strata=mN(vec2(vMtnW.x*.0012,vMtnW.y*.045+mN(vMtnW.xz*.002)*3.0));
    float gully=mR(vec2(vMtnW.x*.006+mN(vMtnW.xz*.004)*2.0,vMtnW.y*.0015));
    vec3 rockCol=mix(mtnRockA,mtnRockB,strata*.3+mF(vMtnW.xz*.006)*.45+gully*.25);
    rockCol*=.82+.36*mN(vMtnW.xz*.03);
    // forest and meadow on gentle low slopes (nearer ranges mostly)
    float veg=(1.0-smoothstep(.18,.42,slope))*(1.0-smoothstep(.25+mtnLayer*.2,.55+mtnLayer*.25,h));
    // nearer ranges: dark conifer forest in patches, lighter spring meadows between, tree-crown speckle
    float forest=smoothstep(.42,.6,mF(vMtnW.xz*.0045+3.0));
    float crowns=mN(vMtnW.xz*.09)*.6+mN(vMtnW.xz*.23)*.4;
    vec3 meadow=mix(mtnGreen*1.35,vec3(.42,.52,.26),.35)*(.85+.3*mN(vMtnW.xz*.015));
    vec3 woods=vec3(.13,.22,.12)*(.6+.75*crowns);
    vec3 greenCover=mix(meadow,woods,forest);
    vec3 albedo=mix(rockCol,mtnLayer>0.5?greenCover:mtnGreen*(.8+.4*mN(vMtnW.xz*.02)),veg*(mtnLayer>0.5?.92:.45));
    // snow from the existing snowline colours, kept off steep faces, broken by wind-blown streaks
    float snowSrc=smoothstep(.62,.86,dot(diffuseColor.rgb,vec3(.333)));
    float snowHold=1.0-smoothstep(.38,.72,slope+(mN(vMtnW.xz*.02)-.5)*.25);
    float snow=snowSrc*snowHold;
    albedo=mix(albedo,vec3(.93,.95,.97),snow);
    float lit=max(dot(n,normalize(mtnSun)),0.0);
    vec3 col=albedo*(vec3(.50,.55,.62)+vec3(1.0,.96,.88)*lit*.78);
    float hz=mtnHazeAmt+(1.0-smoothstep(.05,.55,h))*(mtnLayer<0.5?.3:.05);
    diffuseColor.rgb=mix(col,mtnHaze*vec3(.94,.98,1.04),clamp(hz,0.0,.72));`);
  };
  material.customProgramCacheKey=()=>'aushiger-mountains-3';
  const range=grid('Distant mountain range '+layer,cols,rows,(u,v)=>{const x=(u-.5)*span*2,ridge=.39+.11*Math.sin(x*.00052+layer),flank=Math.max(0,1-Math.abs(v-ridge)/(v<ridge?ridge:1-ridge));const peak=height*(.37+.48*Math.pow(fbm(x*.0009,layer+11),.65)+.37*Math.abs(Math.sin(x*.00145+layer)*Math.sin(x*.00047+1)));const z=-depth-v*(layer===0?3100:1800);return [x,-65+peak*Math.pow(flank,.9)+(noise(x*.005,v*20+layer)-.5)*height*.09*flank+crags(x,z)*height*.16*Math.pow(flank,1.3),z];},p=>{let c=rock.clone().multiplyScalar(.73+.27*fbm(p[0]*.004,p[2]*.004));if(layer===0){const snowline=height*(.46+.12*noise(p[0]*.006,p[2]*.003));c.lerp(snow,THREE.MathUtils.clamp((p[1]-snowline)/110,0,1)*(.74+.26*noise(p[0]*.01,p[2]*.008)));}return c.toArray();},material);group.add(range);
 }
 const sections=[-4200,-2500,-1200,-500,-180,-90,-58,-45,-30,-14,0,14,30,45,58,90,180,320,480,700,1100,1900];
 const terrain=grid('Gravel banks and river floodplain',sections.length-1,480,(u,v)=>{const z=1400-v*7700,dx=sections[Math.round(u*(sections.length-1))],w=riverHalfWidth(z);const y=Math.abs(dx)<w?riverLevel(z)-2.8:riverLevel(z)+.8+Math.min(2.2,(Math.abs(dx)-w)*.045)+fbm(dx*.03,z*.03)*.8;return [riverCenter(z)+dx,y,z];},p=>{const d=Math.abs(p[0]-riverCenter(p[2])),w=riverHalfWidth(p[2]);return new THREE.Color(d<w?'#515e58':d<w+34?'#9b9684':'#536b35').multiplyScalar(.82+.36*fbm(p[0]*.04,p[2]*.04)).toArray();},new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}));terrain.receiveShadow=true;group.add(terrain);
 const time={value:0},mat=new THREE.MeshStandardMaterial({color:'#2f6fae',roughness:.16,metalness:.12,envMapIntensity:.9,side:THREE.DoubleSide});
 mat.onBeforeCompile=s=>{s.uniforms.riverTime=time;s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 riverWorld;').replace('#include <begin_vertex>','#include <begin_vertex>\nriverWorld=(modelMatrix*vec4(position,1.0)).xyz;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 riverWorld; uniform float riverTime;').replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 float ripple=sin(riverWorld.x*2.4+riverWorld.z*.67+riverTime*2.5);float crosswave=sin(riverWorld.x*.71-riverWorld.z*1.23+riverTime*1.8);normal=normalize(normal+vec3(ripple*.13,crosswave*.09,0.0));`).replace('#include <color_fragment>',`#include <color_fragment>
 float current=sin(riverWorld.z*.28+riverTime*3.0+sin(riverWorld.x*.39)*2.0);diffuseColor.rgb*=.88+.12*current;
 // clear mountain water: deep blue in the channel, lighter blue-turquoise toward the banks, white flecks where it runs fast
 float across=abs(sin(riverWorld.x*.05+riverWorld.z*.004));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.30,.58,.78),smoothstep(.55,1.0,across)*.35);
 float foam=smoothstep(.93,1.0,sin(riverWorld.x*1.7+riverWorld.z*.9+riverTime*4.0)*sin(riverWorld.z*.31-riverTime*2.2));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.86,.92,.96),foam*.45);`);};
 group.add(grid('Flowing mountain river',12,700,(u,v)=>{const z=1400-v*7700;return [riverCenter(z)+(u*2-1)*riverHalfWidth(z),riverLevel(z)+.08,z];},null,mat));
 const dummy=new THREE.Object3D();
 for(const [name,count,color,type] of [['Riverbank boulders',560,'#8d9186',0],['Riverbank tree belt',420,'#365331',1]]){const m=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({color,roughness:1}),count);m.name=name;for(let i=0;i<count;i++){const z=1000-hash(i,30)*6800,side=i%2?1:-1,d=riverHalfWidth(z)+(type?55:4)+hash(i,32)*(type?65:22);dummy.position.set(riverCenter(z)+side*d,riverLevel(z)+(type?7:1),z);dummy.scale.set(type?3+hash(i,33)*3:1+hash(i,33)*2.7,type?4+hash(i,34)*4:.7+hash(i,34)*1.4,type?3+hash(i,35)*3:1+hash(i,35)*2);dummy.rotation.set(0,hash(i,36)*6,0);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);}m.computeBoundingSphere();group.add(m);}
 return {group,update(dt){time.value+=dt;}};
}
