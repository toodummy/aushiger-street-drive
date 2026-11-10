import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const settings = {
  asphalt: [3, 3, .75], gravel: [2, 2, .8], grass: [3.5, 3.5, .85],
  clay: [3, 3, 1.1], stone: [1.2, 1.2, .7], plaster: [2, 2, .3],
  brick: [1.5, 1.02, .8], blocks: [2.1, 1.32, .65],
  roof_red: [2.4, 2.4, .8], roof_grey: [2.4, 2.4, .7],
  roof_old: [2.4, 2.4, .8], roof_green: [2.4, 2.4, .7],
  bark: [1.2, 2, .8], metal: [.6, .6, .15], leaf: [.3, .3, .2]
};
export const assetStatus = {localMaps: 0, photoSets: 0, photoFailures: [], materials: 0};

function configure(t, color, anisotropy) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = anisotropy;
  return t;
}

function family(n) {
  if (/asphalt|road repairs/i.test(n)) return 'asphalt';
  if (/spring grass|valley vegetation/i.test(n)) return 'grass';
  if (/exposed hillside/i.test(n)) return 'clay';
  if (/gravel and dust/i.test(n)) return 'gravel';
  if (/old yellow red brick/i.test(n)) return 'brick';
  if (/concrete blocks/i.test(n)) return 'blocks';
  if (/limestone|gabion stone/i.test(n)) return 'stone';
  if (/burgundy/i.test(n)) return 'roof_red';
  if (/slate grey/i.test(n)) return 'roof_grey';
  if (/asbestos/i.test(n)) return 'roof_old';
  if (/turquoise/i.test(n)) return 'roof_green';
  if (/bark|timber/i.test(n)) return 'bark';
  if (/galvanized/i.test(n)) return 'metal';
  if (/leaves/i.test(n)) return 'leaf';
  if (/plaster|render|plinth/i.test(n)) return 'plaster';
  return null;
}

// Metric box projection: textures retain their real size on merged Blender meshes.
function uvProject(mesh, type) {
  let g = mesh.geometry;
  if (g.userData.projected) return;
  // Exported hard edges already separate normals. Terrain uses horizontal projection.
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  const [sx, sy] = settings[type];
  const ground = ['grass', 'asphalt', 'gravel', 'clay'].includes(type);
  for (let i = 0; i < p.count; i++) {
    const px=p.getX(i), py=p.getY(i), pz=p.getZ(i);
    const nx=Math.abs(n.getX(i)), ny=Math.abs(n.getY(i)), nz=Math.abs(n.getZ(i));
    let u,v;
    if (ground || ny >= Math.max(nx,nz)) {u=px;v=-pz;}
    else if (nx>nz) {u=-pz;v=py;}
    else {u=px;v=py;}
    uv[i*2]=u/sx;uv[i*2+1]=v/sy;
  }
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  g.userData.projected=true;
}

// Surface shader: (1) breaks visible tiling by blending two randomly shifted copies of every map,
// chosen by a slow noise over the surface (no more identical cracks every few metres);
// (2) adds large-scale colour variation; (3) grades grass to fresh spring green.
const NO_TILE=['asphalt','grass','clay','gravel','stone','plaster','brick','blocks','roof_red','roof_grey','roof_old','roof_green','bark'];
function chunk(name,sampler,uv){return THREE.ShaderChunk[name].split(`texture2D( ${sampler}, ${uv} )`).join(`texNoTile( ${sampler}, ${uv} )`);}
function surfaceShader(m, type) {
  const noTile=NO_TILE.includes(type);
  m.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSurfaceWorld;');
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec4 surfaceLocal = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
      surfaceLocal = instanceMatrix * surfaceLocal;
      #endif
      vSurfaceWorld = (modelMatrix * surfaceLocal).xyz;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vSurfaceWorld;
      float terrainHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float terrainNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(terrainHash(i),terrainHash(i+vec2(1,0)),f.x),mix(terrainHash(i+vec2(0,1)),terrainHash(i+1.0),f.x),f.y);}
      vec4 texNoTile(sampler2D s, vec2 uv){
        float k=terrainNoise(uv*.55)*.7+terrainNoise(uv*1.9+17.0)*.3;
        vec2 dx=dFdx(uv), dy=dFdy(uv);
        float l=k*9.0, i=floor(l), f=fract(l);
        vec2 oa=sin(vec2(3.0,7.0)*i), ob=sin(vec2(3.0,7.0)*(i+1.0));
        vec4 a=textureGrad(s,uv+oa,dx,dy), b=textureGrad(s,uv+ob,dx,dy);
        return mix(a,b,smoothstep(.2,.8,f-.1*dot(a.rgb-b.rgb,vec3(1.0))));
      }`);
    if(noTile){
      shader.fragmentShader=shader.fragmentShader
        .replace('#include <map_fragment>',chunk('map_fragment','map','vMapUv'))
        .replace('#include <normal_fragment_maps>',chunk('normal_fragment_maps','normalMap','vNormalMapUv'))
        .replace('#include <roughnessmap_fragment>',chunk('roughnessmap_fragment','roughnessMap','vRoughnessMapUv'))
        .replace('#include <metalnessmap_fragment>',chunk('metalnessmap_fragment','metalnessMap','vMetalnessMapUv'))
        .replace('#include <aomap_fragment>',chunk('aomap_fragment','aoMap','vAoMapUv'));
    }
    let code = '';
    if(type==='grass') code=`
      float lum=dot(diffuseColor.rgb,vec3(.299,.587,.114));
      vec3 spring=mix(vec3(.042,.105,.016),vec3(.25,.43,.09),smoothstep(.015,.30,lum));
      float macro=terrainNoise(vSurfaceWorld.xz*.045)*.65+terrainNoise(vSurfaceWorld.xz*.31)*.35;
      spring*=mix(vec3(.84,.92,.80),vec3(1.12,1.08,.90),macro);
      float meadow=smoothstep(.62,.85,terrainNoise(vSurfaceWorld.xz*.07+5.0));
      spring=mix(spring,spring*vec3(1.18,1.10,.72),meadow*.45);
      float soil=smoothstep(.78,.93,terrainNoise(vSurfaceWorld.xz*.16));
      diffuseColor.rgb=mix(spring,diffuseColor.rgb*vec3(1.0,.95,.82),.12+soil*.3);`;
    if(type==='clay') code=`
      float green=smoothstep(.35,.7,terrainNoise(vSurfaceWorld.xz*.09));
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.72,1.05,.55),green*.55);`;
    if(type==='asphalt') code=`
      float weather=terrainNoise(vSurfaceWorld.xz*.3)*.6+terrainNoise(vSurfaceWorld.xz*.05)*.4;
      diffuseColor.rgb*=.88+.22*weather;`;
    if(type==='gravel') code=`
      diffuseColor.rgb*=.9+.2*terrainNoise(vSurfaceWorld.xz*.2);`;
    if(type==='plaster'||type==='brick'||type==='blocks') code=`
      float stain=terrainNoise(vec2(vSurfaceWorld.x+vSurfaceWorld.z,vSurfaceWorld.y*.13)*2.0);
      diffuseColor.rgb*=.85+.19*stain;`;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+code);
  };
  m.customProgramCacheKey=()=>`aushiger-surface-${type}-5`;
}

export async function textureWorld(root, renderer, onProgress) {
  const anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const maps={};
  await Promise.all(Object.keys(settings).map(async name=>{
    const [map,normalMap,arm]=await Promise.all(['color','normal','arm'].map(async channel=>{
      const t=await loader.loadAsync(`textures/${name}_${channel}.png`);
      assetStatus.localMaps++;onProgress?.(assetStatus.localMaps);
      return configure(t,channel==='color',anisotropy);
    }));
    maps[name]={map,normalMap,arm,materials:[]};
  }));
  const done=new Set();
  root.traverse(o=>{
    if(!o.isMesh)return;
    const mats=Array.isArray(o.material)?o.material:[o.material];
    const type=family(mats[0]?.name||'');
    if(type)uvProject(o,type);
    o.receiveShadow=true;
    // Hairline cables and fine gabion cages alias badly in a shadow map.
    o.castShadow=!/wires|cables|mesh horizontal|mesh vertical|mountain|valley floor|snowcap/i.test(o.name);
    for(const m of mats){
      if(done.has(m))continue;done.add(m);assetStatus.materials++;
      const t=family(m.name);if(!t)continue;
      const pack=maps[t];
      m.map=pack.map;m.normalMap=pack.normalMap;m.roughnessMap=pack.arm;m.aoMap=pack.arm;m.aoMap.channel=0;
      m.aoMapIntensity=.6;m.normalScale.setScalar(settings[t][2]);m.roughness=1;
      if(t==='plaster') {
        if(/cream/i.test(m.name))m.color.set('#d4bd94');
        else if(/dark brown/i.test(m.name))m.color.set('#43372d');
        else if(/concrete/i.test(m.name))m.color.set('#aaa99c');
        else m.color.set('#f2f1e8');
      } else m.color.set('#ffffff');
      if(t==='grass')m.color.set('#ffffff');
      if(t==='asphalt'&&/repairs/i.test(m.name))m.color.set('#939591');
      if(t==='metal'){m.metalness=.78;m.roughness=.65;}
      if(t==='leaf'){m.side=THREE.DoubleSide;m.shadowSide=THREE.DoubleSide;}
      if(t!=='leaf'&&t!=='metal')surfaceShader(m,t);
      pack.materials.push(m);m.needsUpdate=true;
    }
  });
  return {maps,anisotropy};
}

// Optional photographic maps upgrade the already working local materials.
// Every surface family gets a matching CC0 Poly Haven scan, loaded in the player's browser.
// width = the scan's real-world width in metres, so bricks, tiles and gravel keep true size.
// Phones and low-memory devices get 1K maps, everything else 2K. Failure leaves local maps intact.
const PHOTO_SETS=[
  // ground first: it fills most of the screen
  {type:'asphalt',id:'asphalt_04',width:4},
  {type:'grass',id:'leafy_grass',width:2},
  {type:'clay',id:'brown_mud'},
  {type:'gravel',id:'gravel_ground_01',width:3},
  // buildings
  {type:'plaster',id:'painted_plaster_wall',width:2},
  {type:'brick',id:'brick_wall_006',width:3},
  {type:'blocks',id:'t_concrete_wall_002',width:3},
  {type:'stone',id:'rock_wall_10',width:1.8},
  // corrugated roofs (the local maps are painted ribbed metal)
  {type:'roof_red',id:'box_profile_metal_sheet',width:2},
  {type:'roof_grey',id:'corrugated_iron_02',width:2.7,metal:.55},
  {type:'roof_old',id:'corrugated_iron',width:1.1,tint:'#c9cbbf',metal:.35},
  {type:'roof_green',id:'corrugated_iron_03',width:2,tint:'#4fae9e',metal:.25},
  {type:'bark',id:'bark_brown_02',width:1}
];
function photoResolution(){
  const phone=matchMedia('(max-width:820px)').matches||matchMedia('(pointer:coarse)').matches;
  const lowMem=(navigator.deviceMemory||8)<=4;
  return phone||lowMem?'1k':'2k';
}
export async function upgradePhotographic(packs,onStatus) {
  const res=photoResolution();
  const queue=[...PHOTO_SETS].filter(r=>packs.maps[r.type]);
  const worker=async()=>{for(let r;(r=queue.shift());)await upgradeOne(packs,r,res,onStatus);};
  await Promise.allSettled([worker(),worker(),worker()]);
}
async function upgradeOne(packs,{type,id,width,tint,metal},res,onStatus){
    try{
      const response=await fetch(`https://api.polyhaven.com/files/${id}`,{signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error(response.status);
      const files=await response.json();
      const pick=key=>files[key]?.[res]?.jpg?.url||files[key]?.['1k']?.jpg?.url;
      const urls=[pick('diff')||pick('Diffuse'),pick('nor_gl'),pick('arm')||pick('rough')];
      if(urls.some(u=>!u))throw new Error('Incomplete material maps');
      const incoming=await Promise.all(urls.map((url,i)=>loader.loadAsync(url).then(t=>configure(t,i===0,packs.anisotropy))));
      if(width){const [sx,sy]=settings[type];for(const t of incoming)t.repeat.set(sx/width,sy/width);}
      const pack=packs.maps[type];
      pack.map=incoming[0];pack.normalMap=incoming[1];pack.arm=incoming[2];
      const hasArm=!!pick('arm');
      for(const m of pack.materials){m.map=incoming[0];m.normalMap=incoming[1];m.roughnessMap=incoming[2];
        if(hasArm){m.aoMap=incoming[2];m.aoMap.channel=0;}else m.aoMap=null;
        if(tint)m.color.set(tint);
        if(metal!==undefined){m.metalness=metal;if(hasArm){m.metalnessMap=incoming[2];}}
        m.needsUpdate=true;
      }
      assetStatus.photoSets++;
    }catch(error){assetStatus.photoFailures.push(id);}
    onStatus?.();
}
