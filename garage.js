import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const $=s=>document.querySelector(s);
const key='aushiger-local-cars';
const builtins=[{id:'lada-21074-v1',name:'Lada 21074',url:'./cars/lada-21074.glb',thumbnail:'./cars/lada-21074.jpg',seat:{yaw:0,height:.90,forward:.02}},{id:'lada-kalina-v1',name:'Lada Kalina',url:'./cars/lada-kalina.glb',thumbnail:'./cars/lada-kalina.jpg',seat:{yaw:0,height:.86,forward:0}}];
async function carFiles(item){if(item.files)return item.files;const r=await fetch(item.url);if(!r.ok)throw new Error('Could not load the Lada. Reload the page to try again.');return [new File([await r.arrayBuffer()],item.id+'.glb')];}
function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open(key,1);r.onupgradeneeded=()=>r.result.createObjectStore('cars',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function records(action,value){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('cars',action==='getAll'?'readonly':'readwrite');const r=tx.objectStore('cars')[action](value);let result;r.onsuccess=()=>result=r.result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);});}finally{db.close();}}
function dispose(root){root?.traverse(o=>{o.geometry?.dispose();for(const m of [o.material].flat().filter(Boolean)){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}});}
const clean=s=>decodeURIComponent(s).replaceAll('\\','/').replace(/^\.\//,'');
export async function loadCar(files){
 const all=Array.from(files),main=all.find(f=>/\.glb$/i.test(f.name))||all.find(f=>/\.gltf$/i.test(f.name));
 if(!main)throw new Error('Choose a GLB file, or a folder containing a GLTF model and its textures. OBJ, FBX and Blender files need conversion first.');
 if(all.reduce((n,f)=>n+f.size,0)>250*1024*1024)throw new Error('This model is larger than 250 MB. Export a smaller GLB for web driving.');
 const urls=[];
 try{
  let data=await main.arrayBuffer();
  if(/\.gltf$/i.test(main.name)){
   const json=JSON.parse(new TextDecoder().decode(data)),base=clean(main.webkitRelativePath||main.name).split('/').slice(0,-1).join('/');
   for(const item of [...(json.buffers||[]),...(json.images||[])])if(item.uri&&!item.uri.startsWith('data:')){
    const wanted=clean((base?base+'/':'')+item.uri);let f=all.find(f=>clean(f.webkitRelativePath||f.name)===wanted);
    if(!f){const matches=all.filter(f=>f.name===clean(item.uri).split('/').at(-1));if(matches.length===1)f=matches[0];}
    if(!f)throw new Error('Missing model asset: '+item.uri+'. Select the complete model folder.');
    const url=URL.createObjectURL(f);urls.push(url);item.uri=url;
   }
   data=JSON.stringify(json);
  }
  const manager=new THREE.LoadingManager();manager.setURLModifier(url=>{if(url.startsWith('data:')||url.startsWith('blob:'))return url;throw new Error('The car references an external asset. Include all textures in the folder.');});
  const gltf=await new GLTFLoader(manager).parseAsync(data,'');
  const wrapper=new THREE.Group();wrapper.add(gltf.scene);wrapper.name='Selected vehicle';
  let bounds=new THREE.Box3().setFromObject(wrapper),size=bounds.getSize(new THREE.Vector3());
  if(size.x>size.z){gltf.scene.rotation.y+=Math.PI/2;wrapper.updateMatrixWorld(true);bounds.setFromObject(wrapper);size=bounds.getSize(new THREE.Vector3());}
  if(!Number.isFinite(size.z)||size.z<.00001)throw new Error('The model has no usable vehicle geometry.');
  wrapper.scale.setScalar(4.12/size.z);wrapper.updateMatrixWorld(true);bounds.setFromObject(wrapper);const center=bounds.getCenter(new THREE.Vector3());
  wrapper.position.set(-center.x,-bounds.min.y,-center.z);wrapper.updateMatrixWorld(true);
  const pivot=new THREE.Group();pivot.add(wrapper);bounds.setFromObject(pivot);size=bounds.getSize(new THREE.Vector3());
  pivot.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  const eyeMarker=pivot.getObjectByName('Lada_DriverEye'),driverEye=eyeMarker?eyeMarker.getWorldPosition(new THREE.Vector3()):null;
  return {root:pivot,size,driverEye,name:main.name.replace(/\.(glb|gltf)$/i,'')};
 }finally{urls.forEach(u=>URL.revokeObjectURL(u));}
}
export function createGarage(scene,onPause,onStart){
 const vehicle=new THREE.Group();scene.add(vehicle);vehicle.visible=false;
 let selected=null,loaded=null,items=[...builtins],busy=false,open=true;
 const settings=new Map(),seat=new THREE.Vector3(),position=new THREE.Vector3(),rotation=new THREE.Quaternion();
 // Independent showroom scene: clones share the actual selected model's geometry.
 const previewBox=$('#car-preview'),fallback=$('#car-preview-fallback'),previewLabel=$('#preview-label');
 let previewRenderer=null,previewScene=null,previewCamera=null,previewTurntable=null,previewFrame=0;
 try{
  previewRenderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  previewRenderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
  previewRenderer.outputColorSpace=THREE.SRGBColorSpace;
  previewRenderer.toneMapping=THREE.ACESFilmicToneMapping;
  previewBox.prepend(previewRenderer.domElement);
  previewScene=new THREE.Scene();previewCamera=new THREE.PerspectiveCamera(34,1,.1,100);
  previewCamera.position.set(6.7,3.4,7.3);previewCamera.lookAt(0,.65,0);
  previewScene.add(new THREE.HemisphereLight(0xe9f5ff,0x617462,2.1));
  const keyLight=new THREE.DirectionalLight(0xfff6df,3);keyLight.position.set(5,8,5);previewScene.add(keyLight);
  const rim=new THREE.DirectionalLight(0xb9dfff,2);rim.position.set(-5,3,-4);previewScene.add(rim);
  previewTurntable=new THREE.Group();previewScene.add(previewTurntable);
 }catch(error){console.warn('3D car preview unavailable:',error);previewRenderer=null;}
 function updatePreview(){
  if(!previewRenderer)return;
  previewTurntable.clear();
  if(loaded){const clone=loaded.root.clone(true);clone.rotation.y=0;previewTurntable.add(clone);fallback.hidden=true;previewLabel.textContent=loaded.name.toUpperCase()+' · 3D VIEW';}
  else{fallback.hidden=true;previewLabel.textContent='SELECT A CAR';}
 }
 function animatePreview(){
  if(!open||!previewRenderer){previewFrame=0;return;}
  const w=previewBox.clientWidth,h=previewBox.clientHeight;
  if(w&&h){const ratio=previewRenderer.getPixelRatio();if(previewRenderer.domElement.width!==Math.floor(w*ratio)||previewRenderer.domElement.height!==Math.floor(h*ratio)){previewRenderer.setSize(w,h,false);previewCamera.aspect=w/h;previewCamera.updateProjectionMatrix();}
   previewTurntable.rotation.y+=.006;previewRenderer.render(previewScene,previewCamera);}
  previewFrame=requestAnimationFrame(animatePreview);
 }
 function startPreview(){if(previewRenderer&&!previewFrame)previewFrame=requestAnimationFrame(animatePreview);}

 function message(s){$('#garage-message').textContent=s;}
 function saveSetting(){if(!selected)return;settings.set(selected,{yaw:Number($('#car-facing').value),height:Number($('#seat-height').value),forward:Number($('#seat-forward').value)});try{localStorage.setItem('aushiger-seat-'+selected,JSON.stringify(settings.get(selected)));}catch{}applySettings();}
 function applySettings(){if(!loaded)return;const s=settings.get(selected)||{yaw:0,height:.82,forward:-.08};loaded.root.rotation.y=s.yaw;seat.set(loaded.driverEye?.x??-loaded.size.x*.23,Math.max(.65,loaded.size.y*s.height),loaded.size.z*s.forward);}
 for(const id of ['#car-facing','#seat-height','#seat-forward'])$(id).addEventListener('input',saveSetting);
 async function choose(id){
  if(busy)return;selected=id;busy=true;$('#begin-drive').disabled=true;drawList();
  try{
   if(!id){dispose(loaded?.root);vehicle.clear();loaded=null;$('#seat-controls').hidden=true;message('Explore the road without a vehicle.');}
   else{
    message('Loading your car and its textures…');const item=items.find(i=>i.id===id),result=await loadCar(await carFiles(item));result.name=item.name;if(item.seat&&!settings.has(id))settings.set(id,result.driverEye?{yaw:0,height:result.driverEye.y/result.size.y,forward:result.driverEye.z/result.size.z}:item.seat);
    dispose(loaded?.root);vehicle.clear();loaded=result;vehicle.add(result.root);
    try{const s=JSON.parse(localStorage.getItem('aushiger-seat-'+id));if(s)settings.set(id,s);}catch{}
    const s=settings.get(id)||{yaw:0,height:.82,forward:-.08};$('#car-facing').value=String(s.yaw);$('#seat-height').value=String(s.height);$('#seat-forward').value=String(s.forward);applySettings();$('#seat-controls').hidden=false;message(result.name+' selected. Start driving to view its actual hood from the driver’s seat.');
   }
  }catch(e){selected=null;dispose(loaded?.root);vehicle.clear();loaded=null;$('#seat-controls').hidden=true;message(e.message);}
  finally{busy=false;$('#begin-drive').disabled=false;drawList();updatePreview();startPreview();}
 }
 function drawList(){const list=$('#car-list');list.replaceChildren();for(const item of [{id:null,name:'Explore without a car'},...items]){const b=document.createElement('button');b.type='button';b.className='car-card'+(item.id===selected?' selected':'');b.disabled=busy;if(item.thumbnail){const img=document.createElement('img');img.src=item.thumbnail;img.alt=item.name;img.width=160;img.height=90;b.append(img);}const label=document.createElement('span');label.textContent=item.name;b.append(label);b.setAttribute('aria-pressed',String(item.id===selected));b.onclick=()=>choose(item.id);list.append(b);}$('#begin-drive').textContent=loaded?'Drive '+loaded.name:'Explore the street';}
 async function importFiles(files){if(busy||!files.length)return;const list=Array.from(files);if(!list.some(f=>/\.(glb|gltf)$/i.test(f.name))){message('No GLB or GLTF found. Upload the model here or send its ZIP in chat for conversion.');return;}const id=crypto.randomUUID(),main=list.find(f=>/\.(glb|gltf)$/i.test(f.name));const item={id,name:main.name.replace(/\.(glb|gltf)$/i,''),files:list};items.push(item);await choose(id);if(selected===id){try{await records('put',item);}catch{message('Car loaded for this session. Your browser could not save it; select it again next time.');}}else items=items.filter(i=>i.id!==id);drawList();}
 $('#car-file').onchange=e=>importFiles(e.target.files);$('#car-folder').onchange=e=>importFiles(e.target.files);
 $('#open-garage').onclick=()=>show();$('#begin-drive').onclick=()=>{if(busy)return;open=false;$('#garage').hidden=true;document.body.classList.remove('garage-open');onStart();};
 function show(){open=true;onPause();document.exitPointerLock?.();document.body.classList.remove('minimal');$('#garage').hidden=false;document.body.classList.add('garage-open');drawList();startPreview();}
 function sync(p,q,free){position.copy(p);rotation.copy(q);vehicle.position.copy(p);vehicle.quaternion.copy(q);vehicle.visible=!!loaded&&!free;}
 function eye(){return loaded?seat.clone().applyQuaternion(rotation).add(position):position.clone().add(new THREE.Vector3(0,1.72,0));}
 records('getAll').then(saved=>{items=[...builtins,...saved];drawList();}).catch(()=>{});
 drawList();show();choose(builtins[0].id);return {get isOpen(){return open;},get hasCar(){return !!loaded;},show,sync,eye};
}
