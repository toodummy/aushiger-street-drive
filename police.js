import * as THREE from 'three';
import {makeCar} from './carfactory.js?v=1';

// Police: after a crash a patrol car (white, blue stripe, "ПОЛИЦИЯ", flashing light bar) comes
// from behind with the siren on, pulls up behind you and stays; if you drive off it follows you
// for a while, then it overtakes and leaves. Route coordinates: d along the road, lat across.
function letteringTexture(text,w=512,h=96,size=58){
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
  g.clearRect(0,0,w,h);g.fillStyle='#173a8c';g.font=`bold ${size}px Arial`;g.textAlign='center';g.textBaseline='middle';g.fillText(text,w/2,h/2+2);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function buildPoliceCar(){
  const {root}=makeCar('jp_sedan','#f2f2ef');root.name='Police car';
  const blue=new THREE.MeshStandardMaterial({color:'#1d4fb0',roughness:.35,metalness:.2});
  const W=1.82,belt=.95,roof=1.47;
  // side stripe and lettering
  for(const side of [-1,1]){
    const stripe=new THREE.Mesh(new THREE.BoxGeometry(.01,.11,3.9),blue);stripe.position.set(side*(W/2+.012),belt-.26,.05);root.add(stripe);
    const word=new THREE.Mesh(new THREE.PlaneGeometry(1.25,.24),new THREE.MeshBasicMaterial({map:letteringTexture('ПОЛИЦИЯ'),transparent:true}));
    word.position.set(side*(W/2+.02),belt-.1,-.15);word.rotation.y=side*Math.PI/2;root.add(word);
  }
  const hood=new THREE.Mesh(new THREE.PlaneGeometry(.9,.2),new THREE.MeshBasicMaterial({map:letteringTexture('ДПС',256,64,48),transparent:true}));
  hood.rotation.x=-Math.PI/2;hood.position.set(0,belt+.012,-1.85);root.add(hood);
  // light bar
  const bar=new THREE.Group();bar.position.set(0,roof+.06,.15);root.add(bar);
  const base=new THREE.Mesh(new THREE.BoxGeometry(1.2,.06,.3),new THREE.MeshStandardMaterial({color:'#222',roughness:.5}));bar.add(base);
  const red=new THREE.MeshStandardMaterial({color:'#ff2020',emissive:'#ff0000',emissiveIntensity:0,transparent:true,opacity:.92});
  const blu=new THREE.MeshStandardMaterial({color:'#2060ff',emissive:'#0040ff',emissiveIntensity:0,transparent:true,opacity:.92});
  const l=new THREE.Mesh(new THREE.BoxGeometry(.52,.09,.26),red),r=new THREE.Mesh(new THREE.BoxGeometry(.52,.09,.26),blu);
  l.position.set(-.3,.07,0);r.position.set(.3,.07,0);bar.add(l,r);
  const glow=new THREE.PointLight('#ff2020',0,22,1.6);glow.position.set(0,.4,0);bar.add(glow);
  return {root,red,blu,glow};
}

export function createPolice(scene,sample){
  let car=null,state='idle',d=0,lat=-1.7,speed=0,timer=0,siren=false,flash=0;
  const up=new THREE.Vector3(0,1,0),a=new THREE.Vector3(),b=new THREE.Vector3(),fwd=new THREE.Vector3(),right=new THREE.Vector3(),m4=new THREE.Matrix4();
  function ensure(){if(!car){car=buildPoliceCar();scene.add(car.root);car.root.visible=false;}}
  function place(){
    a.copy(sample(d));b.copy(sample(d+1));fwd.copy(b).sub(a).normalize();right.crossVectors(fwd,up).normalize();
    const p=a.clone().addScaledVector(right,lat);m4.lookAt(p,p.clone().add(fwd),up);car.root.position.copy(p);car.root.quaternion.setFromRotationMatrix(m4);
  }
  return {
    get active(){return state!=='idle';},
    // call when the player crashes into something
    report(player){
      ensure();
      if(state==='idle'||state==='leave'){
        d=Math.max(1,player.distance-170);lat=-1.7;speed=26;state='approach';car.root.visible=true;
      }
      timer=28;siren=true;
    },
    update(dt,player){
      if(state==='idle'||!car)return;
      dt=Math.min(dt,.05);const gapNow=player.distance-d;
      if(state==='approach'){
        // come up fast in the other lane, then tuck in behind the driver
        const close=gapNow<40;
        lat+=THREE.MathUtils.clamp((close?player.lateral:-1.7)-lat,-1.6*dt,1.6*dt);
        const want=close?Math.max(0,player.speed+(gapNow-9)*.8):Math.max(26,player.speed+10);
        speed+=THREE.MathUtils.clamp(want-speed,-9*dt,5*dt);
        if(close&&Math.abs(gapNow-9)<3)state='escort';
      }else if(state==='escort'){
        timer-=dt;
        lat+=THREE.MathUtils.clamp(player.lateral-lat,-1.2*dt,1.2*dt);
        const want=Math.max(0,player.speed+(gapNow-9)*.9);speed+=THREE.MathUtils.clamp(want-speed,-9*dt,5*dt);
        if(timer<=0){state='leave';siren=false;}
      }else if(state==='leave'){
        lat+=THREE.MathUtils.clamp(-1.7-lat,-1.4*dt,1.4*dt);
        speed+=THREE.MathUtils.clamp(Math.max(20,player.speed+8)-speed,-6*dt,4*dt);
        if(d>player.distance+320||d>1495){state='idle';car.root.visible=false;car.glow.intensity=0;}
      }
      d=Math.min(1495,d+speed*dt);
      if(Math.abs(player.distance-d)<4.5&&Math.abs(player.lateral-lat)<1.8){d=player.distance-4.5*Math.sign(player.distance-d||1);speed=Math.min(speed,Math.abs(player.speed));}
      place();
      // flashing: red and blue alternate in quick double bursts
      flash+=dt;const phase=(flash*2.2)%1,burst=(x)=>((x%.5)<.08||((x%.5)>.14&&(x%.5)<.22))?1:0;
      const on=state!=='leave'||timer>-1;
      const r=on?burst(phase):0,bl=on?burst((phase+.5)%1):0;
      car.red.emissiveIntensity=r*4;car.blu.emissiveIntensity=bl*4;
      car.glow.color.set(r?'#ff2020':'#2050ff');car.glow.intensity=(r||bl)?(on?6:0):0;
    },
    sound(){return state!=='idle'&&siren?{d,lat}:null;},
    obstacle(){return state!=='idle'?{d,lat}:null;}
  };
}
