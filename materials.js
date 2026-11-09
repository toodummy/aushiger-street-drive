import * as THREE from 'three';

const loader = new THREE.TextureLoader();
// [tile width m, tile height m, normal strength]
const settings = {
  asphalt: [3.2, 3.2, .9], gravel: [2.6, 2.6, 1.1], grass: [3, 3, 1.0],
  clay: [3.5, 3.5, 1.2], stone: [1.6, 1.6, 1.0], plaster: [2.4, 2.4, .7],
  brick: [1.8, 1.8, 1.0], blocks: [2.6, 2.6, .8],
  roof_red: [2.4, 2.4, .8], roof_grey: [2.4, 2.4, .7],
  roof_old: [2.4, 2.4, .8], roof_green: [2.4, 2.4, .7],
  bark: [1.4, 1.4, 1.0], metal: [.6, .6, .15], leaf: [.3, .3, .2]
};
// 2K/1K photographic Poly Haven sets (CC0) shipped as JPG colour, OpenGL normal and roughness maps.
const photo = new Set(['asphalt','gravel','grass','clay','stone','plaster','brick','blocks','bark']);
// Ground is sampled twice at different scales and angles, blended by large-scale noise, so repeats do not show.
const antiTiled = new Set(['asphalt','gravel','grass','clay']);
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

function macroVariation(m, type) {
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
      vec4 antiTile(sampler2D t,vec2 uv){
        vec2 uv2=mat2(.8,-.6,.6,.8)*uv*.43+vec2(.31,.17);
        float b=smoothstep(.28,.72,terrainNoise(vSurfaceWorld.xz*.06+terrainNoise(vSurfaceWorld.xz*.21)*.6));
        return mix(texture2D(t,uv),texture2D(t,uv2),b);
      }`);
    if(antiTiled.has(type)){
      shader.fragmentShader=shader.fragmentShader
        .replace('texture2D( map, vMapUv )','antiTile( map, vMapUv )')
        .replace('texture2D( normalMap, vNormalMapUv )','antiTile( normalMap, vNormalMapUv )')
        .replace('texture2D( roughnessMap, vRoughnessMapUv )','antiTile( roughnessMap, vRoughnessMapUv )');
    }
    let code = '';
    if(type==='clay'||type==='gravel') code=`
      float soilPatch=terrainNoise(vSurfaceWorld.xz*.05)*.7+terrainNoise(vSurfaceWorld.xz*.4)*.3;
      diffuseColor.rgb*=.86+.26*soilPatch;`;
    if(type==='grass') code=`
      float macro=terrainNoise(vSurfaceWorld.xz*.045)*.65+terrainNoise(vSurfaceWorld.xz*.31)*.35;
      diffuseColor.rgb *= mix(vec3(.68,.77,.60),vec3(1.17,1.15,.91),macro);
      float dry=smoothstep(.70,.88,terrainNoise(vSurfaceWorld.xz*.18));
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.26,1.01,.76),dry*.6);`;
    if(type==='asphalt') code=`
      float weather=terrainNoise(vSurfaceWorld.xz*.3);
      diffuseColor.rgb*=.91+.18*weather;`;
    if(type==='plaster'||type==='brick'||type==='blocks') code=`
      float stain=terrainNoise(vec2(vSurfaceWorld.x+vSurfaceWorld.z,vSurfaceWorld.y*.13)*2.0);
      diffuseColor.rgb*=.85+.19*stain;`;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+code);
  };
  m.customProgramCacheKey=()=>`aushiger-surface-${type}-5`;
}

export async function textureWorld(root, renderer, onProgress) {
  const anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());
  const maps={};
  await Promise.all(Object.keys(settings).map(async name=>{
    const hd=photo.has(name);
    const [map,normalMap,arm]=await Promise.all(['color','normal',hd?'rough':'arm'].map(async channel=>{
      const t=await loader.loadAsync(`textures/${name}_${channel}.${hd?'jpg':'png'}`);
      assetStatus.localMaps++;onProgress?.(assetStatus.localMaps);
      return configure(t,channel==='color',anisotropy);
    }));
    maps[name]={map,normalMap,arm,hd,materials:[]};
    if(hd)assetStatus.photoSets++;
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
      m.map=pack.map;m.normalMap=pack.normalMap;m.roughnessMap=pack.arm;
      if(pack.hd)m.aoMap=null;else{m.aoMap=pack.arm;m.aoMap.channel=0;m.aoMapIntensity=.6;}
      m.normalScale.setScalar(settings[t][2]);m.roughness=1;
      if(t==='plaster') {
        if(/cream/i.test(m.name))m.color.set('#d4bd94');
        else if(/dark brown/i.test(m.name))m.color.set('#43372d');
        else if(/concrete/i.test(m.name))m.color.set('#aaa99c');
        else m.color.set('#f2f1e8');
      } else m.color.set('#ffffff');
      if(t==='grass')m.color.set('#b6dc8e');   // leafy_grass is earthy: pull it to spring green
      if(t==='asphalt'&&/repairs/i.test(m.name))m.color.set('#939591');
      if(t==='metal'){m.metalness=.78;m.roughness=.65;}
      if(t==='leaf'){m.side=THREE.DoubleSide;m.shadowSide=THREE.DoubleSide;}
      if(['grass','asphalt','clay','gravel','stone','plaster','brick','blocks'].includes(t))macroVariation(m,t);
      pack.materials.push(m);m.needsUpdate=true;
    }
  });
  return {maps,anisotropy};
}

// Optional photographic maps upgrade the already working local materials.
// The public API supplies current, authoritative URLs. Failure leaves local maps intact.
export async function upgradePhotographic(packs,onStatus) {
  const requests=[];   // the 2K Poly Haven sets now ship with the game, so nothing is fetched at runtime
  await Promise.allSettled(requests.map(async([type,id])=>{
    try{
      const response=await fetch(`https://api.polyhaven.com/files/${id}`,{signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw new Error(response.status);
      const files=await response.json();
      const pick=key=>files[key]?.['2k']?.jpg?.url||files[key]?.['1k']?.jpg?.url;
      const urls=[pick('diff'),pick('nor_gl'),pick('arm')||pick('rough')];
      if(urls.some(u=>!u))throw new Error('Incomplete material maps');
      const incoming=await Promise.all(urls.map((url,i)=>loader.loadAsync(url).then(t=>configure(t,i===0,packs.anisotropy))));
      const pack=packs.maps[type];
      pack.map=incoming[0];pack.normalMap=incoming[1];pack.arm=incoming[2];
      for(const m of pack.materials){m.map=incoming[0];m.normalMap=incoming[1];m.roughnessMap=incoming[2];
        if(pick('arm')){m.aoMap=incoming[2];m.aoMap.channel=0;}else m.aoMap=null;
        m.needsUpdate=true;
      }
      assetStatus.photoSets++;
    }catch(error){assetStatus.photoFailures.push(id);}
    onStatus?.();
  }));
}
