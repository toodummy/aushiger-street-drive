import {addLandscape} from './landscape.js?v=6';
import {createGarage} from './garage.js?v=15';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {textureWorld,upgradePhotographic,assetStatus} from './materials.js?v=6';
import {lightWorld} from './environment.js?v=6';
import {enrichWorld,batchTrees} from './detail.js?v=6';
import {createDriveState,stepDrive,mouseLook,clamp} from './driving.js?v=6';

const $=s=>document.querySelector(s);
let renderer;
try { renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'}); }
catch(error) { throw new Error('WebGL 2 is unavailable. Enable graphics acceleration in your browser settings, restart the browser, then reload this page.'); }
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.4));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.domElement.id='world';renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','3D street. Click to look around with the mouse.');
document.body.prepend(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.12,24000);
const state=createDriveState(),keys=new Set();
const forward=new THREE.Vector3(0,0,-1),up=new THREE.Vector3(0,1,0),right=new THREE.Vector3();
const viewQ=new THREE.Quaternion(),baseQ=new THREE.Quaternion(),freeBase=new THREE.Quaternion();
const lookMatrix=new THREE.Matrix4(),lookEuler=new THREE.Euler(0,0,0,'YXZ');
const freePosition=new THREE.Vector3();
let route,ready=false,lighting,details,world,packs,drag=null,quality='balanced',photoSky=false;
let composer,ssao,renderPass,outputPass,landscape,garage;
let frames=0,frameTime=0,fps=0,hudElapsed=0,driveView='interior';

function sample(d){
  d=clamp(d,0,1499.99);const i=Math.min(route.length-2,Math.floor(d/2)),a=route[i],b=route[i+1],f=(d-a[0])/(b[0]-a[0]);
  return new THREE.Vector3(a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f,-d);
}
function pose(dt=0){
  lookEuler.set(state.pitch,state.yaw,0,'YXZ');viewQ.setFromEuler(lookEuler);
  if(state.free){
    garage?.sync(sample(state.distance),baseQ,true);
    camera.quaternion.copy(freeBase).multiply(viewQ);
    camera.getWorldDirection(forward);right.crossVectors(forward,up).normalize();
    const fast=keys.has('ShiftLeft')||keys.has('ShiftRight'),speed=(fast?42:12)*dt;
    if(keys.has('KeyW')||keys.has('ArrowUp'))freePosition.addScaledVector(forward,speed);
    if(keys.has('KeyS')||keys.has('ArrowDown'))freePosition.addScaledVector(forward,-speed);
    if(keys.has('KeyA')||keys.has('ArrowLeft'))freePosition.addScaledVector(right,-speed);
    if(keys.has('KeyD')||keys.has('ArrowRight'))freePosition.addScaledVector(right,speed);
    if(keys.has('KeyE'))freePosition.y+=speed;if(keys.has('KeyQ'))freePosition.y-=speed;
    freePosition.y=Math.max(-25,freePosition.y);camera.position.copy(freePosition);
  }else{
    const p=sample(state.distance),q=sample(Math.min(1499.99,state.distance+5));
    forward.copy(q).sub(p).normalize();right.crossVectors(forward,up).normalize();
    const carPosition=p.clone().addScaledVector(right,state.lateral);
    lookMatrix.lookAt(carPosition,carPosition.clone().add(forward),up);baseQ.setFromRotationMatrix(lookMatrix);
    garage?.sync(carPosition,baseQ,false);
    camera.position.copy(garage?.eye(driveView)||carPosition.clone().add(new THREE.Vector3(0,1.72,0)));
    camera.quaternion.copy(baseQ).multiply(viewQ);
    if(driveView==='outside')camera.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.12,0,0)));
  }
  camera.updateMatrixWorld();
}
function updateControls(){
  $('#cruise').textContent=state.cruise?'Pause cruise':'Start cruise';$('#cruise').setAttribute('aria-pressed',String(state.cruise));
  $('#mode').textContent=state.free?'Return to road':'Free camera';$('#mode').setAttribute('aria-pressed',String(state.free));
  $('#cruise').disabled=state.free;$('#mode-label').textContent=state.free?'FREE CAMERA':'SOUTHBOUND';
}
function reset(distance=0){Object.assign(state,createDriveState(),{distance});keys.clear();camera.fov=68;camera.updateProjectionMatrix();pose();updateControls();}
function toggleFree(){
  if(!ready)return;
  if(!state.free){freePosition.copy(camera.position);freeBase.copy(camera.quaternion);state.yaw=state.pitch=0;state.cruise=false;state.speed=0;state.free=true;}
  else{state.free=false;state.yaw=state.pitch=0;}
  keys.clear();updateControls();
}
function toggleCruise(){if(!state.free&&ready&&!garage?.isOpen){state.cruise=!state.cruise;updateControls();}}
for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>{driveView=button.dataset.view;if(state.free)toggleFree();document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));state.yaw=state.pitch=0;pose();});
$('#cruise').onclick=toggleCruise;$('#reset').onclick=()=>reset();$('#mode').onclick=toggleFree;
$('#center').onclick=()=>{state.yaw=state.pitch=0;};
$('#location').onchange=e=>reset(Number(e.target.value));
$('#hide-ui').onclick=()=>document.body.classList.toggle('minimal');

async function captureMouse(){
  if(!ready||garage?.isOpen||document.pointerLockElement===renderer.domElement)return;
  try{await renderer.domElement.requestPointerLock();}
  catch(e){$('#look-hint').textContent='Drag the scene to look around · F centres the view';}
}
renderer.domElement.addEventListener('click',captureMouse);
document.addEventListener('pointerlockchange',()=>{
  const locked=document.pointerLockElement===renderer.domElement;
  document.body.classList.toggle('looking',locked);
  $('#look-hint').textContent=locked?'Mouse look active · Esc releases mouse':'Click the scene to look around';
  drag=null;
});
document.addEventListener('mousemove',e=>{
  if(document.pointerLockElement===renderer.domElement&&ready)mouseLook(state,e.movementX,e.movementY);
});
renderer.domElement.addEventListener('pointerdown',e=>{
  if(!document.pointerLockElement){drag={x:e.clientX,y:e.clientY,id:e.pointerId};renderer.domElement.setPointerCapture(e.pointerId);}
});
renderer.domElement.addEventListener('pointermove',e=>{
  if(!drag||document.pointerLockElement)return;
  mouseLook(state,e.clientX-drag.x,e.clientY-drag.y,e.pointerType==='touch'?.004:.0022);drag.x=e.clientX;drag.y=e.clientY;
});
renderer.domElement.addEventListener('pointerup',()=>drag=null);
renderer.domElement.addEventListener('pointercancel',()=>drag=null);
renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();camera.fov=clamp(camera.fov+e.deltaY*.025,40,85);camera.updateProjectionMatrix();},{passive:false});
addEventListener('keydown',e=>{
  if(['SELECT','INPUT','TEXTAREA'].includes(e.target.tagName)||garage?.isOpen)return;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  keys.add(e.code);if(e.repeat)return;
  if(e.code==='Space')toggleCruise();if(e.code==='KeyR')reset();
  if(e.code==='KeyF'){state.yaw=state.pitch=0;}
  if(e.code==='KeyV')toggleFree();if(e.code==='KeyH')document.body.classList.toggle('minimal');
});
addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>{keys.clear();drag=null;state.cruise=false;state.speed=0;updateControls();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();state.cruise=false;state.speed=0;updateControls();}});
for(const b of document.querySelectorAll('[data-key]')){
  b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);};
  b.onpointerup=b.onpointercancel=b.onlostpointercapture=()=>keys.delete(b.dataset.key);
}

function setQuality(value){
  quality=value;renderer.setPixelRatio(Math.min(devicePixelRatio,value==='high'?1.25:1));
  renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;
  if(lighting){const size=value==='high'?4096:2048;if(lighting.sun.shadow.mapSize.x!==size){lighting.sun.shadow.mapSize.set(size,size);lighting.sun.shadow.map?.dispose();lighting.sun.shadow.map=null;}}
  if(composer){ssao.enabled=value==='high';renderPass.enabled=true;composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(innerWidth,innerHeight);}
}
$('#quality').onchange=e=>setQuality(e.target.value);
function status(){
  $('#asset-status').textContent=`${assetStatus.localMaps} local texture maps · ${assetStatus.photoSets} photographic materials${photoSky?' · photographic sky':''}`;
}
const progress=(text,percent)=>{$('#progress').textContent=text;$('#loadbar').style.width=percent+'%';};
try{
  progress('Opening the north-to-south route',4);
  route=await fetch('route.json').then(r=>{if(!r.ok)throw new Error('Route unavailable');return r.json();});
  const chunks=[];
  for (const [i,url] of ['street.part0.0.bin', 'street.part0.1.bin', 'street.part0.2.bin', 'street.part1.0.bin', 'street.part1.1.bin', 'street.part1.2.bin', 'street.part2.bin'].entries()) {
    const response=await fetch(url+'?v=6');
    if(!response.ok)throw new Error('Terrain download failed ('+response.status+'). Reload to retry.');
    chunks.push(new Uint8Array(await response.arrayBuffer()));
    progress('Loading terrain and buildings',5+(i+1)/['street.part0.0.bin', 'street.part0.1.bin', 'street.part0.2.bin', 'street.part1.0.bin', 'street.part1.1.bin', 'street.part1.2.bin', 'street.part2.bin'].length*35);
  }
  const bytes=new Uint8Array(chunks.reduce((total,chunk)=>total+chunk.length,0));
  let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer,'');
  world=gltf.scene;scene.add(world);
  progress('Applying surface textures',42);
  packs=await textureWorld(world,renderer,count=>progress('Applying surface textures',42+count/45*25));
  lighting=await lightWorld(scene,renderer);
  progress('Planting roadside details',74);
  await new Promise(requestAnimationFrame);
  details=enrichWorld(scene,world,sample,packs);batchTrees(world);
  landscape=addLandscape(scene,world);
  garage=createGarage(scene,()=>{keys.clear();state.cruise=false;state.speed=0;updateControls();},()=>{state.free=false;state.yaw=state.pitch=0;keys.clear();pose();updateControls();});
  progress('Preparing daylight and shadows',90);
  composer=new EffectComposer(renderer);renderPass=new RenderPass(scene,camera);renderPass.enabled=true;
  ssao=new SSAOPass(scene,camera,innerWidth,innerHeight);ssao.kernelRadius=7;ssao.minDistance=.001;ssao.maxDistance=.06;
  outputPass=new OutputPass();composer.addPass(renderPass);composer.addPass(ssao);composer.addPass(outputPass);
  setQuality('balanced');
  ready=true;pose();lighting.update(camera,forward);status();updateControls();
  document.body.classList.add('ready');$('#load').remove();
  upgradePhotographic(packs,status);
  lighting.photoSky.then(ok=>{photoSky=ok;status();});
}catch(e){$('#progress').textContent='The world could not load: '+e.message;$('#retry').hidden=false;console.error(e);}
$('#retry')?.addEventListener('click',()=>location.reload());

const clock=new THREE.Clock();
renderer.setAnimationLoop(()=>{
  const elapsed=clock.getDelta(),dt=Math.min(elapsed,.05);if(!ready)return;
  const wasCruise=state.cruise;if(!state.free&&!garage?.isOpen)stepDrive(state,keys,dt);if(wasCruise!==state.cruise)updateControls();
  pose(garage?.isOpen?0:dt);lighting.update(camera,forward);landscape?.update(dt);
  if(quality==='high')composer.render();else renderer.render(scene,camera);
  frames++;frameTime+=elapsed;hudElapsed+=elapsed;
  if(frameTime>.7){fps=Math.round(frames/frameTime);frames=0;frameTime=0;}
  if(hudElapsed>.12){
    $('#speed').textContent=String(Math.round(Math.abs(state.speed)*3.6));
    $('#distance').textContent=`${Math.round(state.distance)} / 1,500 m`;
    $('#route-progress').style.width=(state.distance/1500*100)+'%';
    $('#segment').textContent=state.distance<160?'North entrance':state.distance<590?'Hillside descent':state.distance<700?'Village entrance':state.distance<935?'Village compounds':state.distance<1010?'Bus stop & crossing':'Village street';
    $('#fps').textContent=fps+' fps';hudElapsed=0;
    $('#diagnostics').textContent=JSON.stringify({ready,garage:garage?.isOpen,carLoaded:garage?.hasCar,quality,shadowMap:renderer.shadowMap.enabled,mouseLook:document.pointerLockElement===renderer.domElement,yaw:state.yaw,pitch:state.pitch,mode:state.free?'free':'drive',distance:state.distance,camera:camera.position.toArray(),textures:assetStatus,details,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles});
  }
});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer?.setSize(innerWidth,innerHeight);});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();$('#look-hint').textContent='Graphics paused. Reload to resume.';ready=false;});
