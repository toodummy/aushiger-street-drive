export const START=20; // start 20 m in, so the end of the road model is never in view
// Driving and mouse look stay separate: looking sideways does not steer the car.
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// heading: the car's angle to the road (radians, + = pointing right); steer: the steering wheel (-1..1)
export function createDriveState(){return {distance:START,speed:0,lateral:1.7,cruise:false,yaw:0,pitch:0,free:false,damage:0,heading:0,steer:0,wheelAngle:0,roll:0};}
const WHEELBASE=2.42,MAX_WHEEL=.62,ROAD_EDGE=3.1;
// Car steering like a real car (bicycle model): turning the wheel turns the front wheels, the front of
// the car swings round first and the car then travels the way it points. The faster you go, the
// quicker it turns for the same wheel angle, and the less the wheel can be turned.
// input: keys (W/S/A/D or arrows) and/or analog {throttle:-1..1, steer:-1..1} from the touch stick.
// boost: multiplies top speed and pulling power (Imrashka's car is three times faster).
export function stepDrive(state,keys,dt,end=1490,top=22.2,{analog=null,boost=1}={}){
  dt=clamp(dt,0,.05);
  // a damaged car is slower, accelerates worse and pulls to one side
  const dmg=state.damage||0,health=1-dmg;
  let steerIn=((keys.has('KeyD')||keys.has('ArrowRight'))?1:0)-((keys.has('KeyA')||keys.has('ArrowLeft'))?1:0);
  let gas=(keys.has('KeyW')||keys.has('ArrowUp'))?1:0,back=(keys.has('KeyS')||keys.has('ArrowDown'))?1:0;
  if(analog){if(Math.abs(analog.steer)>.04)steerIn=clamp(analog.steer,-1,1);if(analog.throttle>.08)gas=Math.max(gas,analog.throttle);if(analog.throttle<-.08)back=Math.max(back,-analog.throttle);}
  // the steering wheel turns at a hand's pace and springs back to centre when let go
  const rate=steerIn===0?3.2:2.4;state.steer+=clamp(steerIn-state.steer,-rate*dt,rate*dt);
  const v=state.speed,av=Math.abs(v);
  state.wheelAngle=clamp(state.steer*MAX_WHEEL/(1+(av/6)**2)+dmg*.012,-MAX_WHEEL,MAX_WHEEL);
  // at 0% condition the car is wrecked: the engine is dead, it rolls to a stop and will not drive until repaired
  if(health<=.001){state.cruise=false;state.wrecked=true;state.speed*=Math.max(0,1-dt*1.6);if(Math.abs(state.speed)<.3)state.speed=0;
    move(state,dt,end);return;}
  state.wrecked=false;top*=(.25+.75*health)*boost;
  if(back)state.cruise=false;
  const pull=3*(1-.5*dmg)*boost;
  if(state.cruise)state.speed+=(Math.min(11.1*boost,top)-state.speed)*Math.min(1,dt*1.3);
  if(gas){state.speed+=(state.speed<-.2?9:pull*gas)*dt;}                      // going forward again brakes a reversing car hard
  if(back){state.speed-=(state.speed>.2?7:2.4*boost)*back*dt;}                 // brake, then reverse
  if(!gas&&!back&&!state.cruise)state.speed*=Math.max(0,1-dt*.25);
  state.speed=clamp(state.speed,-5*Math.min(boost,1.6),top);
  move(state,dt,end);
}
function move(state,dt,end){
  const v=state.speed;
  // yaw rate from the front-wheel angle; the car pivots about the rear axle, so the nose leads
  state.heading+=v*Math.tan(state.wheelAngle)/WHEELBASE*dt;
  // when you let go of the wheel the car settles gently to the line of the road (a small driving aid)
  if(Math.abs(state.steer)<.05)state.heading*=Math.max(0,1-dt*1.1*Math.min(1,Math.abs(v)/4));
  state.heading=clamp(state.heading,-1.25,1.25);
  state.distance=clamp(state.distance+v*Math.cos(state.heading)*dt,START,end);
  state.lateral+=v*Math.sin(state.heading)*dt;
  state.roll+=v*dt;
  // the road edge / guard rail: scrape along it, lose speed, straighten up
  if(Math.abs(state.lateral)>ROAD_EDGE){
    const side=Math.sign(state.lateral);state.lateral=side*ROAD_EDGE;
    if(Math.sign(state.heading)===side*Math.sign(v||1)){const hit=Math.abs(Math.sin(state.heading));state.speed*=Math.max(.15,1-hit*.9);state.heading*=.35;}
  }
  if(state.distance>=end||state.distance<=START&&v<0){state.speed=0;state.cruise=false;}
}
export function mouseLook(state,dx,dy,sensitivity=.0022){
  state.yaw-=dx*sensitivity;
  state.yaw=((state.yaw+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;
  state.pitch=clamp(state.pitch-dy*sensitivity,-1.25,1.25);
}
