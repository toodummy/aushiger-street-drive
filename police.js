import * as THREE from 'three';
import {makeCar} from './carfactory.js?v=2';
import {crumple,repair} from './damage.js?v=1';

// Police: after a crash a patrol car (white, blue stripe, "ПОЛИЦИЯ", flashing light bar) comes
// from behind with the siren on, overtakes you from the side, cuts in front and brakes you to a
// stop, swerving to block you if you try to get past. After a few seconds stopped it drives off. Route coordinates: d along the road, lat across.
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
  const red=new THREE.MeshStandardMaterial({color:'#ff2020',emissive:'#ff0000',emissiveIntensity:0});
  const blu=new THREE.MeshStandardMaterial({color:'#2060ff',emissive:'#0040ff',emissiveIntensity:0});
  const l=new THREE.Mesh(new THREE.BoxGeometry(.52,.09,.26),red),r=new THREE.Mesh(new THREE.BoxGeometry(.52,.09,.26),blu);
  l.position.set(-.3,.07,0);r.position.set(.3,.07,0);bar.add(l,r);
  const glow=new THREE.PointLight('#ff2020',0,22,1.6);glow.position.set(0,.4,0);bar.add(glow);
  // solid dark glass on the patrol car, so it never looks see-through
  root.traverse(o=>{if(o.isMesh&&o.material?.name==='Glass'){o.material=o.material.clone();o.material.transparent=false;o.material.opacity=1;o.material.color.set('#151b20');}});
  return {root,red,blu,glow};
}

export function createPolice(scene,sample,{onBump}={}){
  let car=null,state='idle',d=0,lat=-1.7,speed=0,timer=0,siren=false,flash=0,hold=0,bumpCool=0,brakeTo=99,damage=0,hitCool=0,wreckAge=0,cars=[];
  const up=new THREE.Vector3(0,1,0),a=new THREE.Vector3(),b=new THREE.Vector3(),fwd=new THREE.Vector3(),right=new THREE.Vector3(),m4=new THREE.Matrix4();
  const LEN=4.7,WID=1.85;
  function ensure(){if(!car){car=buildPoliceCar();scene.add(car.root);car.root.visible=false;}}
  function place(){
    a.copy(sample(d));b.copy(sample(d+1));fwd.copy(b).sub(a).normalize();right.crossVectors(fwd,up).normalize();
    const p=a.clone().addScaledVector(right,lat);m4.lookAt(p,p.clone().add(fwd),up);car.root.position.copy(p);car.root.quaternion.setFromRotationMatrix(m4);
  }
  // the lane the patrol car uses to come past: well clear of the driver, on the side with more room
  // the player rammed the patrol car (side 1: from behind, -1: it ran into the player)
  function hurtFromPlayer(player,impact,side){
    a.copy(sample((d+player.distance)/2));b.copy(sample((d+player.distance)/2+1));fwd.copy(b).sub(a).normalize();right.crossVectors(fwd,up).normalize();
    const point=a.clone().addScaledVector(right,(lat+player.lateral)/2);point.y+=.6;
    hurt({point,amount:Math.min(.4,.04+impact/45),dir:fwd.clone().multiplyScalar(side)});
  }
  const passLat=p=>p.lateral>0?Math.max(-2.8,p.lateral-3.3):Math.min(2.8,p.lateral+3.3);
  // dents the patrol car; enough hits wreck it and it stops where it is
  function hurt({point,amount,dir,stop}){
    if(!car||state==='idle'||hitCool>0)return;hitCool=.5;if(stop)speed=0;
    crumple(car.root,point,dir,1.0,.1+amount*.5);damage=Math.min(1,damage+amount);speed*=.6;
    if(damage>=1&&state!=='wrecked'){state='wrecked';siren=false;wreckAge=0;}
  }
  // is an oncoming car in this lane close ahead?
  const laneBlocked=(l,range)=>cars.some(c=>c.dir<0&&Math.abs(c.lat-l)<2&&c.d-d>-2&&c.d-d<range);
  const steer=(to,rate,dt)=>{lat+=THREE.MathUtils.clamp(to-lat,-rate*dt,rate*dt);lat=THREE.MathUtils.clamp(lat,-2.8,2.8);};
  return {
    get active(){return state!=='idle';},
    get state(){return state;},
    // call when the player crashes into something
    report(player){
      ensure();
      if(state==='wrecked')return;
      if(state==='idle'||state==='leave'){
        if(state==='idle'){repair(car.root);damage=0;}
        d=Math.max(1,player.distance-150);lat=passLat(player);speed=Math.max(24,player.speed+12);state='approach';hold=0;car.root.visible=true;
      }
      timer=Math.max(timer,30);siren=true;
    },
    update(dt,player,traffic=[]){
      if(state==='idle'||!car)return;cars=traffic;
      dt=Math.min(dt,.05);bumpCool=Math.max(0,bumpCool-dt);hitCool=Math.max(0,hitCool-dt);
      const fit=1-damage*.55;                            // a dented patrol car is slower
      const gap=d-player.distance;                       // > 0: police is ahead of the driver
      if(state==='approach'){
        // race up alongside in the other lane and overtake
        // don't pull out into an oncoming car: wait behind the driver until the lane is clear
        const pl=passLat(player),blocked=gap>-25&&gap<3&&laneBlocked(pl,70);
        steer(blocked?(gap<-6?player.lateral:lat):(gap>-12?pl:lat),2.4,dt);
        const want=(blocked?Math.max(0,player.speed+(gap+9)*.8):Math.max(22,player.speed+(gap<-30?14:7)))*fit;
        speed+=THREE.MathUtils.clamp(want-speed,-8*dt,7*dt);
        if(gap>LEN+2.5){state='block';brakeTo=Math.max(player.speed,speed*.8);}
      }else if(state==='block'){
        timer-=dt;
        if(gap<0){state='approach';}
        else{
          // cut in right in front of the driver and mirror every swerve, so there's no way past
          const close=gap<LEN+9;
          steer(player.lateral,close?3.6:2.4,dt);
          // brake the driver to a stop: stay just ahead, a little slower than them
          // once in front, ease down to a stop whatever the driver does
          const G=LEN+2.2;if(gap<G+5)brakeTo=Math.max(0,brakeTo-2.6*dt);
          const want=Math.max(0,Math.min(brakeTo,player.speed+(G-gap)*.8));
          speed+=THREE.MathUtils.clamp(want-speed,-5.5*dt,4*dt);
          if(Math.abs(player.speed)<.6&&speed<.6)hold+=dt;else hold=Math.max(0,hold-dt*.5);
        }
        if(hold>6||timer<=0){state='leave';siren=false;}
      }else if(state==='wrecked'){
        speed*=Math.max(0,1-dt*2.5);if(speed<.3)speed=0;wreckAge+=dt;
        if(wreckAge>45||Math.abs(gap)>260){state='idle';car.root.visible=false;car.glow.intensity=0;}
      }else if(state==='leave'){
        steer(gap>0?1.7:-1.7,1.4,dt);
        speed+=THREE.MathUtils.clamp(Math.max(18,player.speed+6)-speed,-6*dt,3.5*dt);
        if(Math.abs(gap)>320||d>1494){state='idle';car.root.visible=false;car.glow.intensity=0;}
      }
      if(state==='idle')return;
      d=Math.min(1495,d+speed*dt);
      // solid car: the driver can't drive through the patrol car
      const g2=d-player.distance;
      if(Math.abs(g2)<LEN&&Math.abs(player.lateral-lat)<WID){
        if(g2>0){const impact=player.speed-speed;player.distance=d-LEN;if(player.speed>speed){player.speed=Math.max(0,speed-.5);player.cruise=false;}
          if(impact>2.5&&bumpCool<=0){bumpCool=1;onBump?.(impact);hurtFromPlayer(player,impact,1);}}
        else{const impact=speed-player.speed;d=player.distance-LEN;speed=Math.min(speed,Math.max(0,player.speed));
          if(impact>2.5&&bumpCool<=0){bumpCool=1;onBump?.(impact);hurtFromPlayer(player,impact,-1);}}
      }
      place();
      // flashing: red and blue alternate in quick double bursts
      flash+=dt;const phase=(flash*2.2)%1,burst=(x)=>((x%.5)<.08||((x%.5)>.14&&(x%.5)<.22))?1:0;
      const on=state!=='leave'&&state!=='wrecked';
      const r=on?burst(phase):0,bl=on?burst((phase+.5)%1):0;
      car.red.emissiveIntensity=r*4;car.blu.emissiveIntensity=bl*4;
      car.glow.color.set(r?'#ff2020':'#2050ff');car.glow.intensity=(r||bl)?6:0;
    },
    sound(){return state!=='idle'&&siren?{d,lat}:null;},
    get damage(){return damage;},
    // for traffic (solid car), dogs and cows (it runs them down), all reporting damage back
    obstacle(){return state!=='idle'?{d,lat,dir:1,speed,len:LEN,w:WID,onHit:hurt}:null;}
  };
}
