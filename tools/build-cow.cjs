// Builds cars/../models/cow.glb: a smooth, anatomically shaped cow sculpted from blended
// signed-distance primitives (barrel, chest, hips, pin bones, udder, dewlap, tapered head...).
// Each moving part is its own node so the game can animate it: Body, Neck (with head), Tail,
// four upper legs and four lower legs, plus horns. Every vertex also stores its rest-pose
// position in cow space (_COWPOS) so the coat pattern stays continuous across parts.
// Run: npm i isosurface@1.0.0 && node tools/build-cow.cjs   (front of the cow = -Z, metres)
const {surfaceNets}=require('isosurface');
const fs=require('fs');

const len=(x,y,z)=>Math.hypot(x,y,z);
function ell(p,c,r){const x=(p[0]-c[0])/r[0],y=(p[1]-c[1])/r[1],z=(p[2]-c[2])/r[2];const k0=len(x,y,z),k1=len(x/r[0],y/r[1],z/r[2]);return k1?k0*(k0-1)/k1:-Math.min(...r);}
function cone(p,a,b,r1,r2){ // round cone (iq), tapered capsule from a (r1) to b (r2)
  const ba=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],pa=[p[0]-a[0],p[1]-a[1],p[2]-a[2]];
  const l2=ba[0]**2+ba[1]**2+ba[2]**2,rr=r1-r2,a2=l2-rr*rr,il2=1/l2;
  const y=pa[0]*ba[0]+pa[1]*ba[1]+pa[2]*ba[2],z=y-l2;
  const xv=[pa[0]*l2-ba[0]*y,pa[1]*l2-ba[1]*y,pa[2]*l2-ba[2]*y],x2=xv[0]**2+xv[1]**2+xv[2]**2,y2=y*y*l2,z2=z*z*l2;
  const k=Math.sign(rr)*rr*rr*x2;
  if(Math.sign(z)*a2*z2>k)return Math.sqrt(x2+z2)*il2-r2;
  if(Math.sign(y)*a2*y2<k)return Math.sqrt(x2+y2)*il2-r1;
  return (Math.sqrt(x2*a2*il2)+y*rr)*il2-r1;
}
const smin=(a,b,k)=>{const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;};
const smax=(a,b,k)=>-smin(-a,-b,k);
const mx=p=>[Math.abs(p[0]),p[1],p[2]]; // mirror in x

// ---------- parts (each in its own pivot frame) ----------
const PIVOTS={
  Body:[0,0,0],Neck:[0,1.2,-.86],Tail:[0,1.30,1.02],
  FrontUpperL:[-.19,.96,-.62],FrontUpperR:[.19,.96,-.62],HindUpperL:[-.2,.96,.70],HindUpperR:[.2,.96,.70],
  FrontLowerL:[-.19,.51,-.62],FrontLowerR:[.19,.51,-.62],HindLowerL:[-.2,.54,.80],HindLowerR:[.2,.54,.80]
};
function body(p){
  const q=mx(p);
  let d=ell(p,[0,1.02,.02],[.35,.40,.80]);                       // barrel (ribs)
  d=smin(d,ell(p,[0,1.11,-.58],[.30,.40,.36]),.16);               // chest and shoulders
  d=smin(d,ell(p,[0,.86,-.80],[.15,.20,.16]),.12);                // brisket
  d=smin(d,cone(p,[0,1.27,-.60],[0,1.29,.78],.11,.12),.24);        // spine, a soft ridge
  d=smin(d,ell(p,[0,1.33,-.55],[.12,.10,.25]),.10);               // withers
  d=smin(d,ell(q,[.21,1.25,.55],[.12,.10,.14]),.12);              // hook (hip) bones
  d=smin(d,ell(p,[0,1.15,.70],[.27,.28,.31]),.18);                // rump
  d=smin(d,ell(p,[0,1.28,.98],[.10,.09,.10]),.08);                // tail head
  d=smin(d,ell(q,[.11,1.21,.99],[.07,.07,.07]),.06);              // pin bones
  d=smin(d,ell(p,[0,.86,.02],[.35,.25,.52]),.24);                 // belly
  d=smin(d,ell(q,[.20,.93,.67],[.14,.34,.24]),.12);               // hindquarter muscle
  d=smin(d,ell(q,[.19,.84,-.62],[.11,.22,.14]),.10);              // top of forearm
  d=smin(d,ell(p,[0,.71,.58],[.17,.14,.18]),.09);                 // udder
  for(const [x,z] of [[.07,.52],[.07,.66]])d=smin(d,cone(q,[x,.64,z],[x,.54,z+.01],.024,.018),.03); // teats
  d=smin(d,cone(p,[0,1.2,-.74],[0,1.18,-.98],.25,.21),.12);       // neck stump
  d=smax(d,-ell(q,[.40,.84,.42],[.09,.2,.16]),.12);              // flank tuck in front of the hind leg
  d=smax(d,-ell(q,[.40,1.2,-.25],[.05,.12,.25]),.1);              // slight hollow behind the shoulder
  return d;
}
function neck(p){ // origin at the neck joint; head points forward and down
  const q=mx(p);
  let d=cone(p,[0,0,0],[0,-.02,-.44],.23,.16);                     // neck
  d=smin(d,ell(p,[0,-.21,-.18],[.07,.16,.24]),.10);               // dewlap
  d=smin(d,ell(p,[0,.02,-.56],[.15,.13,.15]),.10);                // poll and skull
  d=smin(d,cone(p,[0,-.02,-.60],[0,-.36,-.86],.135,.098),.08);     // face
  d=smin(d,ell(q,[.08,-.13,-.67],[.08,.10,.10]),.07);             // cheeks
  d=smin(d,ell(p,[0,-.42,-.90],[.12,.085,.09]),.06);              // muzzle
  d=smin(d,ell(q,[.12,-.03,-.62],[.045,.04,.045]),.04);           // brow over the eyes
  d=smin(d,ell(q,[.23,.0,-.52],[.13,.032,.065]),.05);             // ears
  d=smax(d,-ell(q,[.045,-.42,-.985],[.022,.017,.03]),.02);        // nostrils
  d=smax(d,-ell(p,[0,-.485,-.92],[.10,.008,.07]),.01);            // mouth line
  return d;
}
function horns(p){const q=mx(p);let d=cone(q,[.085,.07,-.53],[.19,.15,-.57],.032,.014);return smin(d,cone(q,[.19,.15,-.57],[.205,.22,-.63],.014,.005),.02);}
function tail(p){let d=cone(p,[0,0,0],[0,-.76,.05],.036,.017);return smin(d,ell(p,[0,-.84,.05],[.05,.14,.05]),.05);}
function frontUpper(p){return smin(cone(p,[0,.04,0],[0,-.45,0],.13,.066),ell(p,[0,-.45,0],[.062,.06,.064]),.07);}
function frontLower(p){let d=cone(p,[0,0,0],[0,-.34,.01],.06,.047);d=smin(d,ell(p,[0,-.36,.01],[.05,.05,.055]),.04);d=smin(d,cone(p,[0,-.36,.01],[0,-.44,-.03],.045,.05),.03);d=smin(d,cone(p,[0,-.44,-.03],[0,-.49,-.05],.055,.066),.02);return smax(d,-(p[1]+.51),.01);}
function hindUpper(p){let d=cone(p,[0,.04,-.02],[0,-.42,.10],.15,.062);d=smin(d,ell(p,[0,-.42,.10],[.05,.062,.072]),.07);return smin(d,ell(p,[0,-.40,.15],[.03,.045,.035]),.03);}
function hindLower(p){let d=cone(p,[0,0,0],[0,-.38,-.06],.06,.047);d=smin(d,ell(p,[0,-.40,-.06],[.055,.055,.06]),.04);d=smin(d,cone(p,[0,-.40,-.06],[0,-.47,-.09],.045,.05),.03);d=smin(d,cone(p,[0,-.47,-.09],[0,-.52,-.11],.055,.066),.02);return smax(d,-(p[1]+.54),.01);}

const PARTS=[
  ['Body',body,[[-.48,.45,-1.12],[.48,1.48,1.15]],.03,'Body'],
  ['Neck',neck,[[-.4,-.58,-1.05],[.4,.3,.12]],.02,'Neck'],
  ['Horns',horns,[[-.25,0,-.7],[.25,.26,-.47]],.011,'Neck'],
  ['Tail',tail,[[-.08,-1.0,-.06],[.08,.05,.12]],.016,'Tail'],
  ['FrontUpperL',frontUpper,[[-.14,-.54,-.14],[.14,.18,.14]],.017,'FrontUpperL'],['FrontUpperR',frontUpper,[[-.14,-.54,-.14],[.14,.18,.14]],.017,'FrontUpperR'],
  ['FrontLowerL',frontLower,[[-.09,-.53,-.14],[.09,.06,.08]],.015,'FrontLowerL'],['FrontLowerR',frontLower,[[-.09,-.53,-.14],[.09,.06,.08]],.015,'FrontLowerR'],
  ['HindUpperL',hindUpper,[[-.16,-.52,-.18],[.16,.19,.24]],.017,'HindUpperL'],['HindUpperR',hindUpper,[[-.16,-.52,-.18],[.16,.19,.24]],.017,'HindUpperR'],
  ['HindLowerL',hindLower,[[-.09,-.56,-.2],[.09,.06,.08]],.015,'HindLowerL'],['HindLowerR',hindLower,[[-.09,-.56,-.2],[.09,.06,.08]],.015,'HindLowerR']
];

function build([name,f,bounds,step,pivotName]){
  const dims=[0,1,2].map(i=>Math.ceil((bounds[1][i]-bounds[0][i])/step));
  const m=surfaceNets(dims,(x,y,z)=>f([x,y,z]),bounds);
  // relax a little (Taubin smoothing) then project normals from the SDF gradient
  const P=m.positions.map(v=>v.slice()),nb=P.map(()=>new Set());
  const tris=[];for(const c of m.cells){if(c.length===4){tris.push([c[0],c[1],c[2]],[c[0],c[2],c[3]]);}else tris.push(c);}
  for(const t of tris)for(let i=0;i<3;i++){nb[t[i]].add(t[(i+1)%3]);nb[t[i]].add(t[(i+2)%3]);}
  for(const lam of [.5,-.52,.5,-.52]){const N=P.map((v,i)=>{const s=[0,0,0];for(const j of nb[i]){s[0]+=P[j][0];s[1]+=P[j][1];s[2]+=P[j][2];}const n=nb[i].size||1;return [v[0]+lam*(s[0]/n-v[0]),v[1]+lam*(s[1]/n-v[1]),v[2]+lam*(s[2]/n-v[2])];});for(let i=0;i<P.length;i++)P[i]=N[i];}
  const e=step*.35,nrm=P.map(v=>{const g=[0,1,2].map(i=>{const a=v.slice(),b=v.slice();a[i]+=e;b[i]-=e;return f(a)-f(b);});const l=len(...g)||1;return g.map(x=>x/l);});
  // outward winding
  for(const t of tris){const [a,b,c]=t.map(i=>P[i]);const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],w=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];const n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];if(n[0]*nrm[t[0]][0]+n[1]*nrm[t[0]][1]+n[2]*nrm[t[0]][2]<0){const s=t[1];t[1]=t[2];t[2]=s;}}
  const piv=PIVOTS[pivotName];
  return {name,pivot:name==='Horns'?[0,0,0]:piv,parent:name==='Horns'?'Neck':null,positions:P,normals:nrm,cowpos:P.map(v=>[v[0]+piv[0],v[1]+piv[1],v[2]+piv[2]]),tris};
}

const meshes=PARTS.map(build);
for(const m of meshes)console.log(m.name,m.positions.length,'verts',m.tris.length,'tris');

// ---------- minimal GLB writer ----------
const chunks=[];let offset=0;const views=[],accessors=[];
function addView(buf,target){const pad=(4-buf.length%4)%4;chunks.push(buf,Buffer.alloc(pad));views.push({buffer:0,byteOffset:offset,byteLength:buf.length,...(target?{target}:{})});offset+=buf.length+pad;return views.length-1;}
function addVec3(arr){const f=new Float32Array(arr.length*3);arr.forEach((v,i)=>f.set(v,i*3));const mn=[0,1,2].map(k=>Math.min(...arr.map(v=>v[k]))),mxv=[0,1,2].map(k=>Math.max(...arr.map(v=>v[k])));accessors.push({bufferView:addView(Buffer.from(f.buffer),34962),componentType:5126,count:arr.length,type:'VEC3',min:mn,max:mxv});return accessors.length-1;}
function addIdx(tris,n){const big=n>65535,a=big?new Uint32Array(tris.length*3):new Uint16Array(tris.length*3);tris.forEach((t,i)=>a.set(t,i*3));accessors.push({bufferView:addView(Buffer.from(a.buffer),34963),componentType:big?5125:5123,count:a.length,type:'SCALAR'});return accessors.length-1;}
const gltf={asset:{version:'2.0',generator:'aushiger build-cow'},scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],materials:[{name:'Hide',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.85}},{name:'Horn',pbrMetallicRoughness:{baseColorFactor:[.86,.80,.66,1],metallicFactor:0,roughnessFactor:.45}}],accessors,bufferViews:views,buffers:[]};
const nodeIndex={};
// hierarchy: Body root; Neck, Tail, upper legs under Body; lower legs under upper legs; Horns under Neck
const parentOf={Neck:'Body',Tail:'Body',FrontUpperL:'Body',FrontUpperR:'Body',HindUpperL:'Body',HindUpperR:'Body',FrontLowerL:'FrontUpperL',FrontLowerR:'FrontUpperR',HindLowerL:'HindUpperL',HindLowerR:'HindUpperR',Horns:'Neck'};
for(const m of meshes){
  const prim={attributes:{POSITION:addVec3(m.positions),NORMAL:addVec3(m.normals)},indices:addIdx(m.tris,m.positions.length),material:m.name==='Horns'?1:0};
  gltf.meshes.push({name:m.name,primitives:[prim]});
  const parent=parentOf[m.name],pp=parent?(parent==='Neck'||m.name==='Horns'?PIVOTS.Neck:PIVOTS[parent]):[0,0,0];
  const own=m.name==='Horns'?PIVOTS.Neck:PIVOTS[m.name];
  const t=[own[0]-pp[0],own[1]-pp[1],own[2]-pp[2]];
  gltf.nodes.push({name:m.name,mesh:gltf.meshes.length-1,translation:t});nodeIndex[m.name]=gltf.nodes.length-1;
}
for(const m of meshes){const p=parentOf[m.name];if(!p){gltf.scenes[0].nodes.push(nodeIndex[m.name]);continue;}const par=gltf.nodes[nodeIndex[p]];(par.children||(par.children=[])).push(nodeIndex[m.name]);}
// Horns: geometry is in neck space already, so zero translation relative to Neck
gltf.nodes[nodeIndex.Horns].translation=[0,0,0];
const bin=Buffer.concat(chunks);gltf.buffers.push({byteLength:bin.length});
let json=Buffer.from(JSON.stringify(gltf));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]);
const head=Buffer.alloc(12);head.writeUInt32LE(0x46546C67,0);head.writeUInt32LE(2,4);head.writeUInt32LE(12+8+json.length+8+bin.length,8);
const jh=Buffer.alloc(8);jh.writeUInt32LE(json.length,0);jh.writeUInt32LE(0x4E4F534A,4);
const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004E4942,4);
const out=process.argv[2]||'models/cow.glb';fs.mkdirSync(require('path').dirname(out),{recursive:true});
fs.writeFileSync(out,Buffer.concat([head,jh,json,bh,bin]));console.log('wrote',out,(head.length+jh.length+json.length+bh.length+bin.length)/1024|0,'KB');
