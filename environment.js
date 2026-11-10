import * as THREE from 'three';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';

export async function lightWorld(scene,renderer){
  const pmrem=new THREE.PMREMGenerator(renderer);
  const fallback=await new THREE.TextureLoader().loadAsync('textures/sky.png');
  fallback.mapping=THREE.EquirectangularReflectionMapping;fallback.colorSpace=THREE.SRGBColorSpace;
  scene.background=fallback;
  scene.environment=pmrem.fromEquirectangular(fallback).texture;
  scene.environmentIntensity=.5;
  scene.backgroundIntensity=.85;
  scene.backgroundRotation.y=.8;scene.environmentRotation.y=.8;
  scene.fog=new THREE.FogExp2('#b8cbd2',.00016);
  const ambient=new THREE.HemisphereLight('#dcecff','#71844a',.42);scene.add(ambient);
  const sun=new THREE.DirectionalLight('#fff4e0',3.1);
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  // tighter frustum = crisper shadows around the car
  Object.assign(sun.shadow.camera,{left:-65,right:65,top:65,bottom:-65,near:1,far:600});
  sun.shadow.bias=-.000045;sun.shadow.normalBias=.035;sun.shadow.radius=2;
  sun.shadow.camera.updateProjectionMatrix();scene.add(sun,sun.target);
  const direction=new THREE.Vector3(-.48,.76,.44).normalize();
  let currentEnv=scene.environment;
  // An actual sky photograph supplies clouds and physically plausible reflections.
  const photoSky=(async()=>{
    try{
      const r=await fetch('https://api.polyhaven.com/files/kloofendal_48d_partly_cloudy_puresky',{signal:AbortSignal.timeout(12000)});
      if(!r.ok)throw new Error(r.status);
      const files=await r.json();const url=files.hdri?.['2k']?.hdr?.url||files.hdri?.['1k']?.hdr?.url;
      if(!url)throw new Error('No HDR sky URL');
      const hdr=await new RGBELoader().loadAsync(url);hdr.mapping=THREE.EquirectangularReflectionMapping;
      scene.background=hdr;scene.environment=pmrem.fromEquirectangular(hdr).texture;
      currentEnv.dispose();currentEnv=scene.environment;
      scene.environmentIntensity=.5;scene.backgroundIntensity=.8;
      return true;
    }catch(e){return false;}
  })();
  return {sun,photoSky,update(camera,forward){
    const center=camera.position.clone().addScaledVector(forward,32);center.y-=8;
    const snap=130/sun.shadow.mapSize.x;center.x=Math.round(center.x/snap)*snap;center.z=Math.round(center.z/snap)*snap;
    sun.target.position.copy(center);sun.position.copy(center).addScaledVector(direction,260);
    sun.target.updateMatrixWorld();
  }};
}
