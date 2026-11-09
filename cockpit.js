import * as THREE from 'three';


function make2106(){
 const root=new THREE.Group();
 const mat=(color,roughness=.72,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
 const black=mat(0x17191a,.86), padded=mat(0x292c2e,.87), edge=mat(0x090b0c,.65), red=mat(0x7d1522,.82), chrome=mat(0x9fa5a5,.35,.12), face=mat(0x121819,.8);
 const mesh=(geo,m,x,y,z)=>{let o=new THREE.Mesh(geo,m);o.position.set(x,y,z);root.add(o);return o};
 const box=(w,h,d,x,y,z,m)=>mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z);
 const disk=(r,x,y,z,m)=>mesh(new THREE.CircleGeometry(r,48),m,x,y,z);
 const ring=(r,t,x,y,z,m)=>mesh(new THREE.TorusGeometry(r,t,10,64),m,x,y,z);
 const woodCanvas=document.createElement('canvas');woodCanvas.width=512;woodCanvas.height=128;
 const w=woodCanvas.getContext('2d');w.fillStyle='#603516';w.fillRect(0,0,512,128);
 for(let i=0;i<75;i++){let y=(i*47)%128;w.strokeStyle=i%3===0?'#a97539':'#3a200f';w.globalAlpha=.12+(i%4)*.035;w.lineWidth=i%4===0?2:1;w.beginPath();w.moveTo(0,y);w.bezierCurveTo(140,y+Math.sin(i)*7,340,y-Math.cos(i)*7,512,y+2);w.stroke()}w.globalAlpha=1;
 const woodtex=new THREE.CanvasTexture(woodCanvas);woodtex.colorSpace=THREE.SRGBColorSpace;
 const wood=new THREE.MeshStandardMaterial({map:woodtex,roughness:.43,metalness:.04});
 // Dashboard and the broad veneer strip characteristic of the 2106.
 box(2.2,.29,.30,.39,-.50,-1.00,padded);
 box(2.15,.035,.16,.39,-.335,-1.01,black);
 box(2.04,.12,.035,.38,-.56,-.83,wood);
 box(2.05,.009,.02,.38,-.625,-.806,chrome);
 box(.79,.31,.09,-.04,-.445,-.81,black);
 box(.76,.23,.025,-.04,-.47,-.755,wood);
 function gauge(x,y,r,max,unit){
  disk(r*1.13,x,y,-.728,edge);ring(r*1.03,.006,x,y,-.716,chrome);disk(r*.96,x,y,-.709,face);
  const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.translate(128,128);
  ctx.fillStyle='#e2e5de';ctx.strokeStyle='#e5e7dd';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 17px Arial';ctx.lineWidth=3;
  for(let i=0;i<=10;i++){const a=Math.PI*.75+i*Math.PI*1.5/10;let sx=Math.cos(a),sy=Math.sin(a);ctx.beginPath();ctx.moveTo(sx*98,sy*98);ctx.lineTo(sx*(i%2?86:78),sy*(i%2?86:78));ctx.stroke();if(!(i%2))ctx.fillText(String(Math.round(max*i/10)),sx*61,sy*61)}
  ctx.font='12px Arial';ctx.fillText(unit,0,37);ctx.strokeStyle='#e7b49b';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(7,-5);ctx.lineTo(-48,48);ctx.stroke();ctx.fillStyle='#ddd';ctx.beginPath();ctx.arc(0,0,6,0,7);ctx.fill();
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const p=mesh(new THREE.PlaneGeometry(r*1.8,r*1.8),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}),x,y,-.700);return p;
 }
 gauge(-.29,-.47,.052,100,'');gauge(-.17,-.47,.052,100,'');gauge(-.055,-.47,.052,100,'');
 gauge(.08,-.45,.096,80,'x100');gauge(.285,-.45,.096,180,'km/h');
 // Two oval top vents, center clock, radio and horizontal heater controls.
 for(let x of [.54,.75]){let outer=ring(.060,.006,x,-.385,-.805,chrome);outer.scale.y=.70;let ins=disk(.053,x,-.385,-.800,edge);ins.scale.y=.70;for(let y of [-.405,-.39,-.375])box(.075,.003,.008,x,y,-.792,chrome)}
 gauge(.65,-.49,.043,12,'');
 box(.40,.105,.04,.65,-.68,-.83,edge);
 for(let y of [-.65,-.67,-.69])box(.32,.005,.012,.65,y,-.802,chrome);
 box(.23,.055,.03,.65,-.765,-.83,black);for(let x of [.56,.62,.68,.74])disk(.014,x,-.765,-.807,chrome);
 // Thin, near-circular two-spoke steering wheel with a long horn bar.
 const wheel=new THREE.Group();wheel.position.set(0,-.48,-.49);root.add(wheel);
 let wr=new THREE.Mesh(new THREE.TorusGeometry(.265,.012,12,96),edge);wheel.add(wr);
 let wr2=new THREE.Mesh(new THREE.TorusGeometry(.251,.003,8,96),chrome);wr2.position.z=.007;wheel.add(wr2);
 let horn=new THREE.Mesh(new THREE.BoxGeometry(.43,.055,.035),chrome);horn.position.set(0,0,.012);wheel.add(horn);
 let hornpad=new THREE.Mesh(new THREE.BoxGeometry(.30,.044,.042),black);hornpad.position.set(0,0,.03);wheel.add(hornpad);
 let emblem=new THREE.Mesh(new THREE.BoxGeometry(.038,.034,.008),chrome);emblem.position.set(0,0,.056);wheel.add(emblem);
 // Cream body surround, black roof and red door trim are separate from
 // the solid shell used for the exterior model.
 const pillar=mat(0xa49d89,.75), lining=mat(0x292827,.94);
 box(2.35,.12,.95,.22,.43,-.53,lining);
 box(2.18,.065,.09,.19,.365,-.92,black);
 const lp=box(.09,.98,.12,-.80,-.03,-.85,pillar);lp.rotation.z=-.22;
 const rp=box(.09,.98,.12,1.13,-.03,-.85,pillar);rp.rotation.z=.22;
 const ls=box(.025,.97,.14,-.74,-.03,-.855,edge);ls.rotation.z=-.22;
 const rs=box(.025,.97,.14,1.07,-.03,-.855,edge);rs.rotation.z=.22;
 box(.08,.56,1.35,-.92,-.58,-.20,red);box(.08,.56,1.35,1.25,-.58,-.20,red);
 box(.09,.08,1.35,-.92,-.30,-.20,black);box(.09,.08,1.35,1.25,-.30,-.20,black);
 for(let y of [-.43,-.53,-.63]){box(.012,.006,1.13,-.873,y,-.20,chrome);box(.012,.006,1.13,1.203,y,-.20,chrome)}
 // Upholstered floor, transmission tunnel and seats.
 const carpet=mat(0x68111c,.98),seatFabric=mat(0xb21d31,.94),seatInset=mat(0x8d1727,.96),stitch=mat(0xcf4653,.95);
 box(2.05,.08,2.25,.16,-1.08,-.10,carpet);
 box(2.15,.66,.07,.19,-.85,-.91,carpet);
 box(.28,.20,1.35,.36,-.96,-.20,black);
 for(let sx of [-.02,.82]){
  box(.64,.17,.68,sx,-.88,.06,seatFabric);
  box(.54,.025,.55,sx,-.785,.06,seatInset);
  for(let k=-2;k<=2;k++)box(.007,.007,.52,sx+k*.09,-.769,.06,stitch);
  box(.64,.70,.14,sx,-.52,.43,seatFabric);
  box(.52,.54,.02,sx,-.52,.345,seatInset);
  for(let k=-2;k<=2;k++)box(.007,.50,.005,sx+k*.09,-.52,.331,stitch);
  box(.25,.16,.12,sx,-.08,.43,seatFabric);
 }
 // Console, gear lever and pedal set.
 box(.36,.24,.22,.59,-.80,-.75,black);
 const lever=box(.035,.28,.035,.45,-.83,-.49,chrome);lever.rotation.x=-.22;
 mesh(new THREE.SphereGeometry(.055,24,16),edge,.45,-.69,-.52);
 for(let px of [-.24,-.09,.07]){const pedal=box(.085,.16,.025,px,-.96,-.79,edge);pedal.rotation.x=-.18}
 // Extend the red door and its window frame to meet the dash and roof.
 box(.10,.54,.45,-.91,-.57,-.88,red);
 box(.10,.075,.47,-.91,-.30,-.88,black);
 const sill=box(.09,.10,1.85,-.91,-.88,-.15,black);
 const backPillar=box(.085,1.1,.10,-.91,-.03,.56,pillar);backPillar.rotation.z=-.02;
 box(.11,.08,1.65,-.89,.36,-.10,black);
 wheel.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.depthTest=false;o.material.depthWrite=false;o.renderOrder=100;}});
 return root;
}

function makePolo(){
 const root=new THREE.Group();
 const mat=(color,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
 const dash=mat(0x2b2c2e,.9), dark=mat(0x141516,.7), gloss=mat(0x060707,.18,.1), chrome=mat(0xb9bec2,.28,.35), rubber=mat(0x101112,.95);
 const leather=mat(0x111213,.62), pillar=mat(0x8f8b84,.88), headliner=mat(0xa8a59e,.95), door=mat(0x333436,.86), fabric=mat(0x2c2e31,.97), insert=mat(0x222427,.98), carpet=mat(0x17181a,1);
 const mesh=(geo,m,x,y,z,parent=root)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);parent.add(o);return o};
 const box=(w,h,d,x,y,z,m,parent)=>mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z,parent);
 const disk=(r,x,y,z,m,parent)=>mesh(new THREE.CircleGeometry(r,48),m,x,y,z,parent);
 const ring=(r,t,x,y,z,m,parent)=>mesh(new THREE.TorusGeometry(r,t,10,64),m,x,y,z,parent);
 const canvasTex=(w,h,draw)=>{const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t};
 const label=(w,h,x,y,z,tex,parent)=>mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,transparent:true}),x,y,z,parent);
 const frame=(w,h,t,x,y,z,m)=>{box(w,t,.012,x,y+h/2,z,m);box(w,t,.012,x,y-h/2,z,m);box(t,h,.012,x-w/2,y,z,m);box(t,h,.012,x+w/2,y,z,m)};

 // Soft-touch dashboard: a deep flat top running to the windscreen, knee panel below.
 box(2.30,.30,.42,.40,-.52,-1.03,dash);
 box(2.30,.05,.50,.40,-.385,-1.30,dash);
 box(2.24,.012,.02,.40,-.372,-.823,dark);
 box(.62,.30,.10,-.02,-.78,-.84,dash);
 box(.012,.008,.40,1.18,-.37,-1.15,dark);for(let k=0;k<6;k++)box(.08,.004,.012,1.35,-.362,-.86-k*.018,dark);
 // Glovebox seam and passenger airbag panel.
 box(.62,.006,.006,1.02,-.60,-.817,dark);box(.006,.20,.006,.71,-.70,-.817,dark);box(.006,.20,.006,1.33,-.70,-.817,dark);

 // Instrument binnacle: a half-tube hood over two round dials and a centre display.
 const hood=mesh(new THREE.CylinderGeometry(.235,.235,.22,40,1,true,-Math.PI/2,Math.PI),dash,0,-.43,-.79);
 hood.rotation.x=-Math.PI/2;hood.scale.set(1,1,.62);hood.material=hood.material.clone();hood.material.side=THREE.DoubleSide;
 box(.47,.20,.03,0,-.45,-.81,gloss);
 function dial(x,y,r,draw){
  disk(r*1.08,x,y,-.791,dark);ring(r*1.04,.0045,x,y,-.787,chrome);
  label(r*2,r*2,x,y,-.785,canvasTex(320,320,(c,w)=>{c.translate(w/2,w/2);c.fillStyle='#0b0c0d';c.beginPath();c.arc(0,0,w/2,0,7);c.fill();draw(c)}));
  const needle=new THREE.Group();needle.position.set(x,y,-.781);root.add(needle);
  const n=box(r*.86,.0042,.002,r*.36,0,0,new THREE.MeshBasicMaterial({color:0xe5321e}),needle);
  disk(r*.13,0,0,.002,dark,needle);return needle;
 }
 function scale(c,from,to,major,minor,labels,red){
  const at=t=>Math.PI*.75+t*Math.PI*1.5;
  c.strokeStyle='#f1f1ee';c.fillStyle='#f1f1ee';c.textAlign='center';c.textBaseline='middle';
  for(let v=from;v<=to+1e-6;v+=minor){const t=(v-from)/(to-from),a=at(t),isMajor=Math.abs(v/major-Math.round(v/major))<1e-6;
   c.strokeStyle=red&&v>=red?'#e33a2b':'#f1f1ee';c.lineWidth=isMajor?4:2;c.beginPath();c.moveTo(Math.cos(a)*148,Math.sin(a)*148);c.lineTo(Math.cos(a)*(isMajor?122:134),Math.sin(a)*(isMajor?122:134));c.stroke();
   if(isMajor&&labels){c.font='bold 26px Arial';c.fillStyle='#f1f1ee';c.fillText(labels(v),Math.cos(a)*96,Math.sin(a)*96)}}
 }
 const tach=dial(-.112,-.445,.074,c=>{scale(c,0,8,1,.5,v=>String(v),6.5);c.font='15px Arial';c.fillText('1/min x1000',0,58)});
 const speedo=dial(.112,-.445,.074,c=>{scale(c,0,240,20,10,v=>v%40===0||v<=40?String(v):'');c.font='15px Arial';c.fillText('km/h',0,58)});
 label(.07,.095,0,-.445,-.786,canvasTex(140,190,(c,w,h)=>{c.fillStyle='#050607';c.fillRect(0,0,w,h);c.fillStyle='#d9e2e8';c.textAlign='center';c.font='bold 30px Arial';c.fillText('12:00',w/2,42);c.font='24px Arial';c.fillText('18°C',w/2,88);c.font='20px Arial';c.fillText('33466 km',w/2,130);c.fillRect(20,150,100,4);c.fillStyle='#7b8790';c.fillRect(20,162,60,10)}));
 for(const x of [-.20,.20]){const m=box(.012,.012,.004,x,-.38,-.782,new THREE.MeshBasicMaterial({color:0x34c55a}));m.rotation.z=Math.PI/4}

 // Chrome-ringed vents: one at the driver's door, a pair above the centre stack.
 function vent(x,y,w,h){
  box(w,h,.03,x,y,-.83,gloss);frame(w,h,.009,x,y,-.812,chrome);
  for(let k=1;k<5;k++)box(w*.94,.004,.01,x,y-h/2+k*h/5,-.807,dark);
  for(let k=1;k<6;k++)box(.004,h*.9,.008,x-w/2+k*w/6,y,-.81,dark);
  box(.035,.01,.012,x,y,-.80,chrome);
 }
 vent(-.47,-.43,.15,.105);vent(.405,-.43,.18,.11);vent(.655,-.43,.18,.11);
 for(const x of [.515,.545]){box(.014,.07,.02,x,-.43,-.815,dark);box(.016,.02,.022,x,-.42,-.81,chrome)}
 // Switch strip with the red hazard button in the middle.
 box(.47,.05,.03,.53,-.515,-.83,gloss);
 for(let k=-3;k<=3;k++){box(.058,.038,.012,.53+k*.064,-.515,-.812,dark)}
 const tri=new THREE.Shape();tri.moveTo(-.012,-.008);tri.lineTo(.012,-.008);tri.lineTo(0,.012);tri.closePath();
 mesh(new THREE.ShapeGeometry(tri),new THREE.MeshBasicMaterial({color:0xd8261c}),.53,-.515,-.804);

 // Radio head unit in a chrome surround.
 box(.39,.19,.04,.53,-.65,-.83,gloss);frame(.37,.17,.008,.53,-.65,-.807,chrome);
 label(.35,.155,.53,-.65,-.806,canvasTex(560,248,(c,w,h)=>{
  c.fillStyle='#0b0c0d';c.fillRect(0,0,w,h);c.fillStyle='#0f1a2b';c.fillRect(150,26,260,118);
  c.fillStyle='#e6eef7';c.textAlign='center';c.font='bold 40px Arial';c.fillText('FM  106.4',280,82);c.font='20px Arial';c.fillText('MHz',280,118);
  c.fillStyle='#c9cdd0';c.font='17px Arial';const top=['PHONE','LIST','◀','▶','↩'],bot=['FM','AM','MEDIA','MUTE','SETUP'];
  top.forEach((s,i)=>{c.strokeStyle='#3a3d40';c.strokeRect(100+i*72,160,70,34);c.fillText(s,135+i*72,177)});
  bot.forEach((s,i)=>{c.strokeRect(100+i*72,198,70,34);c.fillText(s,135+i*72,215)});
  for(let i=0;i<4;i++){c.strokeRect(40,26+i*30,80,26);c.strokeRect(440,26+i*30,80,26)}}));
 for(const x of [.385,.675]){const k=mesh(new THREE.CylinderGeometry(.017,.019,.02,24),chrome,x,-.705,-.80);k.rotation.x=Math.PI/2}
 // Climate panel: three knobs with chrome rings.
 box(.36,.10,.04,.53,-.81,-.83,gloss);
 label(.34,.09,.53,-.81,-.808,canvasTex(500,132,(c,w,h)=>{c.fillStyle='#0d0e0f';c.fillRect(0,0,w,h);
  [[95,'#4a8fe0','#e04a3a'],[250,'#9aa0a5','#9aa0a5'],[405,'#9aa0a5','#9aa0a5']].forEach(([x,a,b])=>{for(let i=0;i<9;i++){const t=Math.PI*.8+i*Math.PI*1.4/8;c.fillStyle=i<4?a:b;c.fillRect(x+Math.cos(t)*52-3,62+Math.sin(t)*52-3,6,6)}});
  c.fillStyle='#b9bec2';c.font='15px Arial';c.textAlign='center';['A/C','REC','AUTO'].forEach((s,i)=>c.fillText(s,175+i*75,120))}));
 for(const x of [.445,.53,.615]){const k=mesh(new THREE.CylinderGeometry(.027,.029,.028,28),dark,x,-.808,-.795);k.rotation.x=Math.PI/2;ring(.028,.003,x,-.808,-.781,chrome);box(.006,.03,.006,x,-.808,-.779,chrome)}
 // Rotary light switch left of the wheel.
 disk(.045,-.60,-.56,-.815,gloss);ring(.04,.004,-.60,-.56,-.81,chrome);box(.012,.05,.02,-.60,-.56,-.80,chrome);

 // Centre console, gear lever and pedals.
 box(.30,.30,.62,.53,-1.0,-.60,dash);
 box(.20,.012,.30,.53,-.845,-.48,gloss);
 const lever=box(.022,.17,.022,.53,-.77,-.45,chrome);lever.rotation.x=-.18;
 mesh(new THREE.SphereGeometry(.04,24,16),leather,.53,-.68,-.465).scale.set(1,1.25,1);
 box(.25,.18,.04,.53,-1.04,-.46,rubber);
 for(const px of [-.20,-.06,.08]){const p=box(.075,.12,.018,px,-1.0,-.80,rubber);p.rotation.x=-.25}
 box(2.30,.05,2.5,.40,-1.12,-.30,carpet);
 // Footwell bulkhead and kick panels close the space under the dash.
 box(2.30,.56,.05,.40,-.88,-1.40,carpet);
 box(2.30,.30,.60,.40,-.84,-1.12,dash);
 for(const x of [-.86,1.66])box(.06,.50,.70,x,-.88,-1.05,door);

 // Pillars, headliner, mirror and doors.
 box(2.35,.10,1.0,.22,.45,-.50,headliner);
 box(2.18,.07,.10,.20,.37,-.92,dark);
 const lp=box(.11,1.1,.13,-.98,-.03,-.80,pillar);lp.rotation.z=-.42;
 const rp=box(.10,1.0,.13,1.16,-.03,-.86,pillar);rp.rotation.z=.24;
 box(.25,.075,.03,.38,.27,-.76,dark);box(.23,.058,.005,.38,.27,-.744,mat(0x8e98a0,.12,.6));box(.02,.08,.02,.38,.34,-.77,dark);
 for(const [x,s] of [[-.92,1],[1.28,-1]]){
  box(.08,.56,1.40,x,-.62,-.22,door);
  box(.09,.05,1.40,x,-.32,-.22,dark);
  box(.12,.04,.40,x+s*.03,-.62,-.18,dash);
  box(.014,.03,.08,x+s*.045,-.44,-.48,chrome);
  const tri2=box(.06,.12,.10,x+s*.01,-.34,-.84,gloss);tri2.rotation.x=.2;
 }

 // Passenger seat (the driver's own seat sits behind the camera).
 box(.56,.15,.60,.82,-.90,.04,fabric);box(.40,.02,.46,.82,-.82,.04,insert);
 box(.56,.68,.14,.82,-.52,.40,fabric);box(.38,.50,.02,.82,-.52,.325,insert);
 box(.26,.17,.12,.82,-.06,.42,fabric);
 for(const y of [-.18,-.04])box(.012,.08,.012,.82+(y<-.1?-.08:.08),y-.04,.42,chrome);

 // Three-spoke VW wheel: leather rim, shield-shaped airbag pad, chrome-trimmed spokes.
 const wheel=new THREE.Group();wheel.position.set(0,-.49,-.50);wheel.rotation.x=-.34;root.add(wheel);
 mesh(new THREE.TorusGeometry(.19,.021,14,96),leather,0,0,0,wheel);
 const pad=new THREE.Shape();pad.moveTo(-.085,.055);pad.quadraticCurveTo(-.09,.075,-.06,.075);pad.lineTo(.06,.075);pad.quadraticCurveTo(.09,.075,.085,.055);pad.lineTo(.07,-.03);pad.quadraticCurveTo(.055,-.075,0,-.08);pad.quadraticCurveTo(-.055,-.075,-.07,-.03);pad.closePath();
 const padMesh=mesh(new THREE.ExtrudeGeometry(pad,{depth:.04,bevelEnabled:true,bevelThickness:.01,bevelSize:.008,bevelSegments:3}),leather,0,.005,-.005,wheel);
 for(const s of [-1,1]){
  box(.095,.05,.03,s*.13,-.005,.005,gloss,wheel);
  box(.09,.005,.008,s*.13,-.034,.022,chrome,wheel);
  for(const dy of [.012,-.012])box(.016,.014,.008,s*.12,dy,.024,dark,wheel);
  disk(.009,s*.15,0,.022,chrome,wheel);
 }
 for(const s of [-1,1]){const b=box(.03,.11,.028,s*.035,-.13,.0,gloss,wheel);b.rotation.z=s*.28}
 box(.075,.006,.008,0,-.165,.016,chrome,wheel);
 ring(.033,.0045,0,.0,.053,chrome,wheel);
 label(.06,.06,0,0,.054,canvasTex(128,128,c=>{c.strokeStyle='#d7dbde';c.lineWidth=7;c.beginPath();c.moveTo(34,28);c.lineTo(64,72);c.lineTo(94,28);c.stroke();c.beginPath();c.moveTo(22,52);c.lineTo(42,104);c.lineTo(64,70);c.lineTo(86,104);c.lineTo(106,52);c.stroke()}),wheel);
 // Steering column shroud and stalks.
 const col=box(.11,.09,.26,0,-.58,-.66,dash);col.rotation.x=-.34;
 for(const s of [-1,1]){const st=mesh(new THREE.CylinderGeometry(.007,.007,.17,10),dark,s*.13,-.53,-.62);st.rotation.z=Math.PI/2+s*.25}
 wheel.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.depthTest=false;o.material.depthWrite=false;o.renderOrder=100;}});

 // Live needles: speed in m/s, with a rough five-speed rev curve.
 root.userData.setSpeed=v=>{
  const kmh=Math.abs(v)*3.6,angle=t=>-(Math.PI*.75+Math.min(1,Math.max(0,t))*Math.PI*1.5);
  speedo.rotation.z=angle(kmh/240);
  const gear=Math.min(5,Math.floor(kmh/28)+1),rpm=kmh<1?850:1300+(kmh-(gear-1)*28)/28*2700+(gear===5?Math.max(0,kmh-140)*20:0);
  tach.rotation.z=angle(rpm/8000);
 };
 root.userData.setSpeed(0);
 // Sit the dash a little higher and closer than the generic cockpit, as in the photos.
 root.position.set(0,.07,.05);
 const outer=new THREE.Group();outer.add(root);outer.userData=root.userData;
 return outer;
}

// Compact, model-specific cockpit detail for the driver's view.
export function makeCockpit(isKalina, is2106=false, isPolo=false) {
 if(is2106)return make2106();
 if(isPolo)return makePolo();
 const root=new THREE.Group();
 const plastic=new THREE.MeshStandardMaterial({color:isKalina?0x383b3c:0x222321,roughness:.87});
 const dark=new THREE.MeshStandardMaterial({color:0x101211,roughness:.78});
 const trim=new THREE.MeshStandardMaterial({color:isKalina?0x676b6a:0x51463a,roughness:.63,metalness:.08});
 const pale=new THREE.MeshStandardMaterial({color:0xa4a8a2,roughness:.6});
 function box(w,h,d,x,y,z,mat=plastic){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);root.add(m);return m}
 function disk(r,x,y,z,mat=dark){const m=new THREE.Mesh(new THREE.CircleGeometry(r,48),mat);m.position.set(x,y,z);root.add(m);return m}
 function ring(r,t,x,y,z,mat=dark){const m=new THREE.Mesh(new THREE.TorusGeometry(r,t,12,64),mat);m.position.set(x,y,z);root.add(m);return m}
 // The eye is the origin; forward is negative Z.
 box(2.08,.26,.36,.39,-.54,-1.02);
 box(1.04,.12,.28,.02,-.37,-1.05,dark);
 const fascia=box(isKalina?.76:.84,.31,.10,.03,-.48,-.81,dark);
 if(isKalina)fascia.scale.y=.9;
 function gauge(x,y,r,max){
   disk(r,x,y,-.744);ring(r,.008,x,y,-.735,trim);
   const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
   const ctx=canvas.getContext('2d');ctx.clearRect(0,0,256,256);ctx.translate(128,128);
   ctx.strokeStyle='#d8dfd5';ctx.fillStyle='#e1e4dd';ctx.lineWidth=3;ctx.font='bold 18px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
   for(let i=0;i<=10;i++){const angle=Math.PI*.75+i*Math.PI*1.5/10;const sx=Math.cos(angle),sy=Math.sin(angle);ctx.beginPath();ctx.moveTo(sx*91,sy*91);ctx.lineTo(sx*(i%2?80:72),sy*(i%2?80:72));ctx.stroke();if(i%2===0)ctx.fillText(String(Math.round(max*i/10)),sx*55,sy*55)}
   ctx.strokeStyle='#d85b3e';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-48,46);ctx.stroke();ctx.fillStyle='#ddd';ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill();
   const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
   const face=new THREE.Mesh(new THREE.PlaneGeometry(r*1.8,r*1.8),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}));
   face.position.set(x,y,-.726);root.add(face);
 }
 gauge(-.16,-.48,.125,180);gauge(.14,-.48,.125,isKalina?8:80);
 if(!isKalina){gauge(.32,-.48,.064,100);gauge(-.34,-.48,.064,100)}
 // Distinctive steering wheel rim, hub, and spokes.
 const wheel=new THREE.Group();wheel.position.set(0,-.49,-.49);root.add(wheel);
 const rim=new THREE.Mesh(new THREE.TorusGeometry(.205,.022,14,64),dark);wheel.add(rim);
 const hub=new THREE.Mesh(new THREE.CylinderGeometry(.074,.08,.035,32),plastic);hub.rotation.x=Math.PI/2;hub.position.z=.018;wheel.add(hub);
 function spoke(x,y,ang){const m=new THREE.Mesh(new THREE.BoxGeometry(.14,.035,.024),plastic);m.position.set(x,y,0);m.rotation.z=ang;wheel.add(m)}
 spoke(-.12,0,0);spoke(.12,0,0);spoke(0,-.12,Math.PI/2);
 const badge=new THREE.Mesh(new THREE.CircleGeometry(.025,24),trim);badge.position.z=.04;wheel.add(badge);
 // Air vents and simple center-console controls.
 for(const x of [.53,.73]){
  if(isKalina){disk(.066,x,-.44,-.815,dark);ring(.062,.01,x,-.44,-.802,trim);box(.08,.008,.01,x,-.44,-.79,trim)}
  else {box(.16,.085,.02,x,-.44,-.805,dark);for(let i=-1;i<=1;i++)box(.14,.006,.01,x,-.44+i*.022,-.79,trim)}
 }
 box(.39,.18,.04,.63,-.68,-.82,dark);
 if(isKalina){for(const x of [.51,.63,.75]){disk(.034,x,-.68,-.79,trim);disk(.02,x,-.68,-.78,dark)}}
 else {for(const y of [-.63,-.68,-.73]){box(.28,.008,.012,.63,y,-.79,trim);box(.025,.026,.02,.57,y,-.77,pale)}}
 if(is2106){
  // The source model's cabin is a solid block, so build a separate open
  // windshield surround for the driver's camera while preserving the body.
  const lining=new THREE.MeshStandardMaterial({color:0x252725,roughness:.9});
  const pillar=new THREE.MeshStandardMaterial({color:0xb3ad98,roughness:.8});
  const rubber=new THREE.MeshStandardMaterial({color:0x171b1a,roughness:.8});
  box(2.35,.12,.95,.22,.43,-.53,lining);
  box(2.18,.075,.09,.19,.365,-.92,rubber);
  const left=box(.09,.98,.12,-.80,-.03,-.85,pillar);left.rotation.z=-.22;
  const right=box(.09,.98,.12,1.13,-.03,-.85,pillar);right.rotation.z=.22;
  const leftSeal=box(.026,.97,.14,-.74,-.03,-.855,rubber);leftSeal.rotation.z=-.22;
  const rightSeal=box(.026,.97,.14,1.07,-.03,-.855,rubber);rightSeal.rotation.z=.22;
  box(.10,.37,1.25,-.91,-.65,-.22,plastic);
  box(.10,.37,1.25,1.25,-.65,-.22,plastic);
  wheel.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.depthTest=false;o.material.depthWrite=false;o.renderOrder=100;}});
 }
 return root;
}
