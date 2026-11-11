import {makeCockpit} from './cockpit.js?v=14';
import * as THREE from 'three';
import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const $=s=>document.querySelector(s);
const key='aushiger-local-cars';
const builtins=[{id:'lada-2106-v1',name:'Lada 2106',top:60,url:'./cars/lada-2106.glb?v=7',seat:{yaw:0,height:.90,forward:.02}},{id:'lada-21074-v1',name:'Lada 2107',top:80,url:'./cars/lada-21074.glb?v=3',thumbnail:'./cars/lada-21074.jpg',seat:{yaw:0,height:.90,forward:.02}},{id:'lada-kalina-v1',name:'Lada Kalina',top:100,url:'./cars/lada-kalina.glb?v=2',thumbnail:'./cars/lada-kalina.jpg',seat:{yaw:0,height:.86,forward:0}},{id:'vw-polo-2017',name:'Volkswagen Polo',top:120,url:'./cars/vw-polo.glb?v=5',seat:{yaw:0,height:.88,forward:0}}];
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
  if(main.name==='vw-polo-2017.glb'){for(const name of ['Ground','ArchCut_FL','ArchCut_FR','ArchCut_RL','ArchCut_RR']){const helper=gltf.scene.getObjectByName(name);if(helper)helper.removeFromParent();}}
  // Lada 2107: the body's smoothed normals bend across the boot lid and rear panel, which looks like a dent; recompute them with sharp creases
  if(/lada-21074/i.test(main.name))gltf.scene.traverse(o=>{if(o.isMesh&&/^Body_Lower/.test(o.name))o.geometry=toCreasedNormals(o.geometry,Math.PI/5);});
  const wrapper=new THREE.Group();wrapper.add(gltf.scene);wrapper.name='Selected vehicle';
  let bounds=new THREE.Box3().setFromObject(wrapper),size=bounds.getSize(new THREE.Vector3());
  if(size.x>size.z){gltf.scene.rotation.y+=Math.PI/2;wrapper.updateMatrixWorld(true);bounds.setFromObject(wrapper);size=bounds.getSize(new THREE.Vector3());}
  if(!Number.isFinite(size.z)||size.z<.00001)throw new Error('The model has no usable vehicle geometry.');
  wrapper.scale.setScalar(4.12/size.z);wrapper.updateMatrixWorld(true);bounds.setFromObject(wrapper);const center=bounds.getCenter(new THREE.Vector3());
  wrapper.position.set(-center.x,-bounds.min.y,-center.z);wrapper.updateMatrixWorld(true);
  const pivot=new THREE.Group();pivot.add(wrapper);bounds.setFromObject(pivot);size=bounds.getSize(new THREE.Vector3());
  pivot.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  keepInteriorOutOfWheels(pivot);
  const eyeMarker=pivot.getObjectByName('Lada_DriverEye'),driverEye=eyeMarker?eyeMarker.getWorldPosition(new THREE.Vector3()):null;
  return {root:pivot,size,driverEye,name:main.name.replace(/\.(glb|gltf)$/i,'')};
 }finally{urls.forEach(u=>URL.revokeObjectURL(u));}
}
// Interior pieces (floor, sills, door cards) must not reach into the wheel wells, where they show
// through the arches or cut across the wheels. Pull any such vertex back inboard of the tyre.
function keepInteriorOutOfWheels(pivot){
  pivot.updateMatrixWorld(true);
  const tyres=[];pivot.traverse(o=>{if(o.isMesh&&/Wheel_.*Tyre|Tyre|Tire/i.test(o.name))tyres.push(new THREE.Box3().setFromObject(o).expandByVector(new THREE.Vector3(.0,.12,.06)));});
  if(!tyres.length)return;
  // black wheel-well liners: an arched shell over each tyre and a closed inner side, like the real car
  const linerMat=new THREE.MeshStandardMaterial({name:'Wheel_Well_Liner',color:'#0d0d0d',roughness:.95,side:THREE.DoubleSide});
  const inv0=new THREE.Matrix4().copy(pivot.matrixWorld).invert();
  for(const t of tyres){
    const c=t.getCenter(new THREE.Vector3()),r=(t.max.y-t.min.y)/2+.13,len=(t.max.x-t.min.x)+.03,side=Math.sign(c.x)||1;
    const shell=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,28,1,true,.12,Math.PI-.24).rotateZ(Math.PI/2),linerMat);
    const cap=new THREE.Mesh(new THREE.CircleGeometry(r,28,.12,Math.PI-.24).rotateY(Math.PI/2),linerMat);
    cap.position.x=-side*len/2;
    const liner=new THREE.Group();liner.name='Wheel well liner';liner.add(shell,cap);
    liner.position.copy(c).applyMatrix4(inv0);liner.position.y+=0;pivot.add(liner);liner.updateMatrixWorld(true);
  }
  // trim interior pieces lengthways so they stop at the arch edge nearest the cabin
  const arches=tyres.map(t=>{const c=t.getCenter(new THREE.Vector3()),r=(t.max.y-t.min.y)/2+.13;return {c,r,edge:c.z>0?c.z-r:c.z+r};});
  const v=new THREE.Vector3(),inv=new THREE.Matrix4();
  pivot.traverse(o=>{
    if(!o.isMesh||!/^Int_/i.test(o.name))return;
    const b=new THREE.Box3().setFromObject(o);
    if(!arches.some(a=>b.max.z>a.c.z-a.r&&b.min.z<a.c.z+a.r&&b.min.y<a.c.y+a.r&&Math.max(Math.abs(b.min.x),Math.abs(b.max.x))>.3))return;
    const g=o.geometry=o.geometry.clone(),p=g.attributes.position;inv.copy(o.matrixWorld).invert();let moved=false;
    for(let i=0;i<p.count;i++){
      v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);
      for(const a of arches){
        if(Math.abs(v.x)<.3||v.y>a.c.y+a.r||Math.sign(v.x)!==Math.sign(a.c.x))continue;
        if(v.z>a.c.z-a.r&&v.z<a.c.z+a.r){v.z=a.edge;moved=true;}
      }
      v.applyMatrix4(inv);p.setXYZ(i,v.x,v.y,v.z);
    }
    if(moved){p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();g.computeBoundingBox();}
  });
}
const UP=new THREE.Vector3(0,1,0);
// Rough five-speed rev curve (x1000 rpm) for the Polo's modelled rev counter.
const polRpm=kmh=>kmh<1?.85:1.3+(kmh-Math.min(4,Math.floor(kmh/28))*28)/28*2.7;
export function createGarage(scene,onPause,onStart){
 const vehicle=new THREE.Group();scene.add(vehicle);vehicle.visible=false;
 let selected=null,loaded=null,items=[...builtins],busy=false,open=true,cockpit=null;
 const settings=new Map(),seat=new THREE.Vector3(),position=new THREE.Vector3(),rotation=new THREE.Quaternion();
 // Independent showroom scene: clones share the actual selected model's geometry.
 const previewBox=$('#car-preview'),fallback=$('#car-preview-fallback'),previewLabel=$('#preview-label');
 let previewRenderer=null,previewScene=null,previewCamera=null,previewTurntable=null,previewFrame=0,dragPointer=null,lastDragX=0;
 try{
  previewRenderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  previewRenderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
  previewRenderer.outputColorSpace=THREE.SRGBColorSpace;
  previewRenderer.toneMapping=THREE.ACESFilmicToneMapping;
  previewBox.prepend(previewRenderer.domElement);
  previewScene=new THREE.Scene();
  // The original metallic wheels and body need something bright to reflect.
  const studioCanvas=document.createElement('canvas');studioCanvas.width=1024;studioCanvas.height=512;
  const studio=studioCanvas.getContext('2d');const gradient=studio.createLinearGradient(0,0,0,512);
  gradient.addColorStop(0,'#e3e8ee');gradient.addColorStop(.45,'#a5b0ba');gradient.addColorStop(.52,'#69757c');gradient.addColorStop(1,'#353e44');
  studio.fillStyle=gradient;studio.fillRect(0,0,1024,512);
  studio.fillStyle='#ffffff';studio.fillRect(100,80,210,100);studio.fillRect(580,100,240,90);
  const reflection=new THREE.CanvasTexture(studioCanvas);reflection.mapping=THREE.EquirectangularReflectionMapping;reflection.colorSpace=THREE.SRGBColorSpace;
  previewScene.environment=reflection;if(!scene.environment)scene.environment=reflection;
  previewRenderer.shadowMap.enabled=true;previewRenderer.shadowMap.type=THREE.PCFSoftShadowMap;
  previewCamera=new THREE.PerspectiveCamera(17.4,1,.1,100);
  previewCamera.position.set(5.4,2.7,6.0);previewCamera.lookAt(0,.65,0);
  previewScene.add(new THREE.HemisphereLight(0xe9f5ff,0x617462,2.1));
  const keyLight=new THREE.DirectionalLight(0xfff6df,3);keyLight.position.set(5,8,5);keyLight.castShadow=true;keyLight.shadow.mapSize.set(1024,1024);keyLight.shadow.camera.left=-4;keyLight.shadow.camera.right=4;keyLight.shadow.camera.top=4;keyLight.shadow.camera.bottom=-4;keyLight.shadow.bias=-0.0003;previewScene.add(keyLight);
  const rim=new THREE.DirectionalLight(0xb9dfff,2);rim.position.set(-5,3,-4);previewScene.add(rim);
  const contactShadow=new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.ShadowMaterial({opacity:.22}));contactShadow.rotation.x=-Math.PI/2;contactShadow.position.y=-.015;contactShadow.receiveShadow=true;previewScene.add(contactShadow);
  previewTurntable=new THREE.Group();previewScene.add(previewTurntable);
 }catch(error){console.warn('3D car preview unavailable:',error);previewRenderer=null;}
 function updatePreview(){
  if(!previewRenderer)return;
  previewTurntable.clear();
  if(loaded){const clone=loaded.root.clone(true);clone.rotation.y=0;previewTurntable.add(clone);fallback.hidden=true;previewLabel.textContent='DRAG TO ROTATE · '+loaded.name.toUpperCase();}
  else{fallback.hidden=true;previewLabel.textContent='SELECT A CAR';}
 }
 function animatePreview(){
  if(!open||!previewRenderer){previewFrame=0;return;}
  const w=previewBox.clientWidth,h=previewBox.clientHeight;
  if(w&&h){const ratio=previewRenderer.getPixelRatio();if(previewRenderer.domElement.width!==Math.floor(w*ratio)||previewRenderer.domElement.height!==Math.floor(h*ratio)){previewRenderer.setSize(w,h,false);previewCamera.aspect=w/h;previewCamera.updateProjectionMatrix();}
   if(dragPointer===null)previewTurntable.rotation.y+=.006;previewRenderer.render(previewScene,previewCamera);}
  previewFrame=requestAnimationFrame(animatePreview);
 }
 function startPreview(){if(previewRenderer&&!previewFrame)previewFrame=requestAnimationFrame(animatePreview);}
 previewBox.addEventListener('pointerdown',e=>{if(!previewTurntable||e.button!==0)return;dragPointer=e.pointerId;lastDragX=e.clientX;previewBox.setPointerCapture(e.pointerId);previewBox.classList.add('dragging');e.preventDefault();});
 previewBox.addEventListener('pointermove',e=>{if(e.pointerId!==dragPointer)return;previewTurntable.rotation.y+=(e.clientX-lastDragX)*.012;lastDragX=e.clientX;});
 function endPreviewDrag(e){if(e.pointerId!==dragPointer)return;dragPointer=null;previewBox.classList.remove('dragging');}
 previewBox.addEventListener('pointerup',endPreviewDrag);previewBox.addEventListener('pointercancel',endPreviewDrag);previewBox.addEventListener('lostpointercapture',endPreviewDrag);

 function message(s){$('#garage-message').textContent=s;}
 function saveSetting(){if(!selected)return;settings.set(selected,{yaw:Number($('#car-facing').value),height:Number($('#seat-height').value),forward:Number($('#seat-forward').value)});try{localStorage.setItem('aushiger-seat-'+selected,JSON.stringify(settings.get(selected)));}catch{}applySettings();}
 function applySettings(){if(!loaded)return;const s=settings.get(selected)||{yaw:0,height:.82,forward:-.08};loaded.root.rotation.y=s.yaw;seat.set(loaded.driverEye?.x??-loaded.size.x*.23,Math.max(.65,loaded.size.y*s.height),loaded.size.z*s.forward);if(cockpit)cockpit.position.copy(seat).add(new THREE.Vector3(0,.24,-.22));}
 for(const id of ['#car-facing','#seat-height','#seat-forward'])$(id).addEventListener('input',saveSetting);
 async function choose(id){
  if(busy)return;selected=id;busy=true;$('#begin-drive').disabled=true;drawList();
  try{
   if(!id){dispose(loaded?.root);vehicle.clear();loaded=null;$('#seat-controls').hidden=true;message('Explore the road without a vehicle.');}
   else{
    message('Loading your car and its textures…');const item=items.find(i=>i.id===id),result=await loadCar(await carFiles(item));result.name=item.name;if(item.seat&&!settings.has(id))settings.set(id,result.driverEye?{yaw:0,height:result.driverEye.y/result.size.y,forward:result.driverEye.z/result.size.z}:item.seat);
    dispose(loaded?.root);if(cockpit)dispose(cockpit);vehicle.clear();loaded=result;vehicle.add(result.root);cockpit=makeCockpit(id==='lada-kalina-v1',id==='lada-2106-v1',id==='vw-polo-2017'||id==='lada-21074-v1'||id==='lada-kalina-v1'||id==='lada-2106-v1');vehicle.add(cockpit);
    try{const s=JSON.parse(localStorage.getItem('aushiger-seat-'+id));if(s)settings.set(id,s);}catch{}
    const s=settings.get(id)||{yaw:0,height:.82,forward:-.08};$('#car-facing').value=String(s.yaw);$('#seat-height').value=String(s.height);$('#seat-forward').value=String(s.forward);applySettings();$('#seat-controls').hidden=false;message(result.name+' selected. Start driving to view its actual hood from the driver’s seat.');
   }
  }catch(e){selected=null;dispose(loaded?.root);vehicle.clear();loaded=null;$('#seat-controls').hidden=true;message(e.message);}
  finally{busy=false;$('#begin-drive').disabled=false;drawList();updatePreview();startPreview();}
 }
 function drawList(){const list=$('#car-list');list.replaceChildren();for(const item of items){const b=document.createElement('button');b.type='button';b.className='car-card'+(item.id===selected?' selected':'');b.disabled=busy;const label=document.createElement('span');label.textContent=item.name;b.append(label);b.setAttribute('aria-pressed',String(item.id===selected));b.onclick=()=>choose(item.id);list.append(b);}$('#begin-drive').textContent=loaded?'DRIVE '+loaded.name.toUpperCase()+'  →':'LOADING CAR…';const counter=document.querySelector('.selection-label span');if(counter)counter.textContent=String(Math.max(0,items.findIndex(i=>i.id===selected))+1).padStart(2,'0')+' / '+String(items.length).padStart(2,'0');}
 async function importFiles(files){if(busy||!files.length)return;const list=Array.from(files);if(!list.some(f=>/\.(glb|gltf)$/i.test(f.name))){message('No GLB or GLTF found. Upload the model here or send its ZIP in chat for conversion.');return;}const id=crypto.randomUUID(),main=list.find(f=>/\.(glb|gltf)$/i.test(f.name));const item={id,name:main.name.replace(/\.(glb|gltf)$/i,''),files:list};items.push(item);await choose(id);if(selected===id){try{await records('put',item);}catch{message('Car loaded for this session. Your browser could not save it; select it again next time.');}}else items=items.filter(i=>i.id!==id);drawList();}
 
 $('#open-garage').onclick=()=>show();$('#begin-drive').onclick=()=>{if(busy)return;open=false;$('#garage').hidden=true;document.body.classList.remove('garage-open');onStart();};
 function show(){open=true;if(loaded){loaded.root.visible=true;loaded.root.traverse(o=>{if(/steer/i.test(o.name)||(selected==='lada-2106-v1'&&/^(Body_Cabin|Glass_|DripRail|CPillar_|BPillar_|Divider_)/.test(o.name))||((selected==='vw-polo-2017'||selected==='lada-kalina-v1')&&/^(Glass_|Windscreen|Rear_Screen|Window_Frame|Body_Shell)/.test(o.name))||(selected==='lada-21074-v1'&&/^(Body_Cabin|Glass_|DripRail|CPillar_)/.test(o.name)))o.visible=true;});}onPause();document.exitPointerLock?.();document.body.classList.remove('minimal');$('#garage').hidden=false;document.body.classList.add('garage-open');drawList();startPreview();}
 function sync(p,q,free){position.copy(p);rotation.copy(q);vehicle.position.copy(p);vehicle.quaternion.copy(q);vehicle.visible=!!loaded&&!free;}
 function eye(view='interior'){
  const interior=view==='interior'&&!open;
  if(cockpit)cockpit.visible=interior;
  if(loaded){loaded.root.visible=true;loaded.root.traverse(o=>{if(/steer/i.test(o.name)||(selected==='lada-2106-v1'&&/^(Body_Cabin|Glass_|DripRail|CPillar_|BPillar_|Divider_)/.test(o.name))||((selected==='vw-polo-2017'||selected==='lada-kalina-v1')&&/^(Glass_|Windscreen|Rear_Screen|Window_Frame|Body_Shell)/.test(o.name))||(selected==='lada-21074-v1'&&/^(Body_Cabin|Glass_|DripRail|CPillar_)/.test(o.name)))o.visible=!interior;});}
  if(!loaded){const fallback=view==='outside'?new THREE.Vector3(0,3.1,7):new THREE.Vector3(0,1.72,0);return fallback.applyQuaternion(rotation).add(position);}
  if(view==='interior')return seat.clone().applyQuaternion(rotation).add(position);
  const yaw=settings.get(selected)?.yaw||0;
  const local=view==='hood'?new THREE.Vector3(0,loaded.size.y*.94,-loaded.size.z*.25):new THREE.Vector3(0,loaded.size.y*1.9,loaded.size.z*1.75);
  local.applyAxisAngle(new THREE.Vector3(0,1,0),yaw);return local.applyQuaternion(rotation).add(position);
 }
 
 drawList();show();choose(builtins[0].id);return {get isOpen(){return open;},setSpeed(v){cockpit?.userData.setSpeed?.(v);const kmh=Math.abs(v)*3.6;for(const [name,t] of [['Int_Needle_Speed_Hand',kmh/({'lada-2106-v1':180,'lada-21074-v1':180,'lada-kalina-v1':200}[selected]||240)],['Int_Needle_Tach_Hand',polRpm(kmh)/8]]){const hand=loaded?.root.getObjectByName(name);if(hand)hand.quaternion.setFromAxisAngle(UP,(225-270*Math.min(1,Math.max(0,t)))*Math.PI/180);}},get topSpeed(){return (items.find(i=>i.id===selected)?.top??80)/3.6;},get hasCar(){return !!loaded;},get carRoot(){return loaded?.root;},show,sync,eye};
}
