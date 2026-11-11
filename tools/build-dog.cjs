// Builds models/dog.glb (village dog) — same method as tools/build-cow.cjs.
// Originally: builds models/cow.glb: a smooth, anatomically shaped cow sculpted from blended
// signed-distance primitives (barrel, chest, hips, pin bones, udder, dewlap, tapered head...).
// Each moving part is its own node so the game can animate it: Body, Neck (with head), Tail,
// four upper legs and four lower legs, plus horns. Every vertex also stores its rest-pose
// position in cow space (_COWPOS) so the coat pattern stays continuous across parts.
// Run: npm i isosurface@1.0.0 && node tools/build-cow.cjs models/cow.glb && COARSE=2.4 node tools/build-cow.cjs models/cow-far.glb
//   (front of the cow = -Z, metres)
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

// ---------- parts (each in its own pivot frame), a medium village dog, front = -Z ----------
const PIVOTS={
  Body:[0,0,0],Neck:[0,.6,-.36],Tail:[0,.57,.36],
  FrontUpperL:[-.075,.47,-.22],FrontUpperR:[.075,.47,-.22],HindUpperL:[-.07,.48,.26],HindUpperR:[.07,.48,.26],
  FrontLowerL:[-.075,.25,-.22],FrontLowerR:[.075,.25,-.22],HindLowerL:[-.07,.28,.33],HindLowerR:[.07,.28,.33]
};
function body(p){
  const q=mx(p);
  let d=ell(p,[0,.50,-.19],[.12,.15,.19]);                         // deep chest
  d=smin(d,ell(p,[0,.42,-.22],[.085,.10,.11]),.06);                 // brisket
  d=smin(d,ell(p,[0,.51,.04],[.10,.11,.26]),.08);                   // ribs, narrowing to the waist
  d=smin(d,ell(p,[0,.49,.10],[.075,.075,.16]),.05);                 // tucked belly
  d=smin(d,ell(p,[0,.52,.26],[.095,.10,.13]),.08);                  // hips and rump
  d=smin(d,cone(p,[0,.585,-.28],[0,.575,.32],.055,.05),.09);         // topline
  d=smin(d,ell(q,[.07,.53,-.23],[.045,.09,.07]),.05);               // shoulder blades
  d=smin(d,ell(q,[.065,.47,.27],[.05,.10,.09]),.05);                // thighs top
  d=smin(d,cone(p,[0,.56,-.3],[0,.63,-.42],.085,.065),.06);          // neck base
  return d;
}
function neck(p){ // origin at the neck joint; head forward, slightly up
  const q=mx(p);
  let d=cone(p,[0,0,0],[0,.09,-.1],.072,.058);
  d=smin(d,ell(p,[0,.13,-.15],[.07,.065,.08]),.04);                // skull
  d=smin(d,ell(q,[.04,.10,-.17],[.04,.045,.06]),.03);               // cheeks
  d=smin(d,cone(p,[0,.115,-.2],[0,.09,-.33],.045,.028),.03);         // muzzle
  d=smin(d,ell(p,[0,.065,-.25],[.035,.025,.07]),.02);               // lower jaw
  d=smin(d,ell(p,[0,.095,-.335],[.022,.018,.015]),.01);             // nose
  // pointed, upright ears (flattened cones)
  const e=[q[0],q[1],(q[2]+.12)*2.0-.12];
  d=smin(d,cone(e,[.05,.15,-.12],[.078,.275,-.11],.048,.006),.014);
  d=smax(d,-ell(p,[0,.06,-.3],[.026,.004,.04]),.004);              // mouth line
  return d;
}
function tail(p){ // curled up over the back, typical of village dogs
  let d=cone(p,[0,0,0],[0,.08,.07],.034,.03);
  d=smin(d,cone(p,[0,.08,.07],[0,.16,.075],.03,.023),.02);
  d=smin(d,cone(p,[0,.16,.075],[0,.215,.025],.023,.012),.015);
  return d;
}
function frontUpper(p){return smin(cone(p,[0,.06,0],[0,-.22,0],.058,.031),ell(p,[0,-.22,0],[.028,.028,.03]),.02);}
function frontLower(p){let d=cone(p,[0,0,0],[0,-.19,.005],.026,.021);d=smin(d,ell(p,[0,-.205,-.014],[.031,.022,.04]),.015);return smax(d,-(p[1]+.222),.006);}
function hindUpper(p){let d=cone(p,[0,.06,-.03],[0,-.2,.07],.072,.03);return smin(d,ell(p,[0,-.2,.07],[.026,.03,.032]),.02);}
function hindLower(p){let d=cone(p,[0,0,0],[0,-.24,-.03],.025,.02);d=smin(d,ell(p,[0,-.262,-.052],[.031,.022,.04]),.015);return smax(d,-(p[1]+.28),.006);}

const PARTS=[
  ['Body',body,[[-.2,.24,-.5],[.2,.72,.46]],.017,'Body'],
  ['Neck',neck,[[-.13,-.05,-.4],[.13,.32,.1]],.0105,'Neck'],
  ['Tail',tail,[[-.05,-.05,-.05],[.05,.28,.16]],.0095,'Tail'],
  ['FrontUpperL',frontUpper,[[-.08,-.27,-.08],[.08,.13,.08]],.011,'FrontUpperL'],['FrontUpperR',frontUpper,[[-.08,-.27,-.08],[.08,.13,.08]],.011,'FrontUpperR'],
  ['FrontLowerL',frontLower,[[-.05,-.25,-.07],[.05,.04,.04]],.0095,'FrontLowerL'],['FrontLowerR',frontLower,[[-.05,-.25,-.07],[.05,.04,.04]],.0095,'FrontLowerR'],
  ['HindUpperL',hindUpper,[[-.1,-.25,-.12],[.1,.15,.12]],.011,'HindUpperL'],['HindUpperR',hindUpper,[[-.1,-.25,-.12],[.1,.15,.12]],.011,'HindUpperR'],
  ['HindLowerL',hindLower,[[-.05,-.31,-.1],[.05,.04,.04]],.0095,'HindLowerL'],['HindLowerR',hindLower,[[-.05,-.31,-.1],[.05,.04,.04]],.0095,'HindLowerR']
];

const COARSE=Number(process.env.COARSE||1); // e.g. COARSE=2.4 builds the distant (low-detail) cow
function build([name,f,bounds,step0,pivotName]){const step=step0*COARSE;
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
const gltf={asset:{version:'2.0',generator:'aushiger build-dog'},scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],materials:[{name:'Hide',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.85}},{name:'Horn',pbrMetallicRoughness:{baseColorFactor:[.86,.80,.66,1],metallicFactor:0,roughnessFactor:.45}}],accessors,bufferViews:views,buffers:[]};
const nodeIndex={};
// hierarchy: Body root; Neck, Tail, upper legs under Body; lower legs under upper legs; Horns under Neck
const parentOf={Neck:'Body',Tail:'Body',FrontUpperL:'Body',FrontUpperR:'Body',HindUpperL:'Body',HindUpperR:'Body',FrontLowerL:'FrontUpperL',FrontLowerR:'FrontUpperR',HindLowerL:'HindUpperL',HindLowerR:'HindUpperR'};
for(const m of meshes){
  const prim={attributes:{POSITION:addVec3(m.positions),NORMAL:addVec3(m.normals)},indices:addIdx(m.tris,m.positions.length),material:0};
  gltf.meshes.push({name:m.name,primitives:[prim]});
  const parent=parentOf[m.name],pp=parent?(parent==='Neck'||m.name==='Horns'?PIVOTS.Neck:PIVOTS[parent]):[0,0,0];
  const own=m.name==='Horns'?PIVOTS.Neck:PIVOTS[m.name];
  const t=[own[0]-pp[0],own[1]-pp[1],own[2]-pp[2]];
  gltf.nodes.push({name:m.name,mesh:gltf.meshes.length-1,translation:t});nodeIndex[m.name]=gltf.nodes.length-1;
}
for(const m of meshes){const p=parentOf[m.name];if(!p){gltf.scenes[0].nodes.push(nodeIndex[m.name]);continue;}const par=gltf.nodes[nodeIndex[p]];(par.children||(par.children=[])).push(nodeIndex[m.name]);}
// Horns: geometry is in neck space already, so zero translation relative to Neck

const bin=Buffer.concat(chunks);gltf.buffers.push({byteLength:bin.length});
let json=Buffer.from(JSON.stringify(gltf));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]);
const head=Buffer.alloc(12);head.writeUInt32LE(0x46546C67,0);head.writeUInt32LE(2,4);head.writeUInt32LE(12+8+json.length+8+bin.length,8);
const jh=Buffer.alloc(8);jh.writeUInt32LE(json.length,0);jh.writeUInt32LE(0x4E4F534A,4);
const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004E4942,4);
const out=process.argv[2]||'models/dog.glb';fs.mkdirSync(require('path').dirname(out),{recursive:true});
fs.writeFileSync(out,Buffer.concat([head,jh,json,bh,bin]));console.log('wrote',out,(head.length+jh.length+json.length+bh.length+bin.length)/1024|0,'KB');
