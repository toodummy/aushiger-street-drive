export const START=20; // start 20 m in, so the end of the road model is never in view
// Driving and mouse look stay separate: looking sideways does not steer the car.
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function createDriveState(){return {distance:START,speed:0,lateral:1.7,cruise:false,yaw:0,pitch:0,free:false,damage:0};}
export function stepDrive(state,keys,dt,end=1490,top=22.2){
  dt=clamp(dt,0,.05);
  // a damaged car is slower, accelerates worse and pulls to one side
  const dmg=state.damage||0;top*=1-.6*dmg;
  const throttle=keys.has('KeyW')||keys.has('ArrowUp');
  const brake=keys.has('KeyS')||keys.has('ArrowDown');
  if(brake)state.cruise=false;
  if(state.cruise)state.speed+=(11.1*(1-.4*dmg)-state.speed)*Math.min(1,dt*1.3);
  if(throttle)state.speed+=3*(1-.5*dmg)*dt;
  if(brake)state.speed-=6*dt;
  if(!throttle&&!brake&&!state.cruise)state.speed*=Math.max(0,1-dt*.25);
  state.speed=clamp(state.speed,-3,top);
  const right=(keys.has('KeyD')||keys.has('ArrowRight'))?1:0;
  const left=(keys.has('KeyA')||keys.has('ArrowLeft'))?1:0;
  state.lateral=clamp(state.lateral+(right-left)*dt*(.7+Math.abs(state.speed)*.1)+dmg*.35*dt*Math.min(1,Math.abs(state.speed)/5),-3.1,3.1);
  state.distance=clamp(state.distance+state.speed*dt,START,end);
  if(state.distance>=end||state.distance<=0&&state.speed<0){state.speed=0;state.cruise=false;}
}
export function mouseLook(state,dx,dy,sensitivity=.0022){
  state.yaw-=dx*sensitivity;
  state.yaw=((state.yaw+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;
  state.pitch=clamp(state.pitch-dy*sensitivity,-1.25,1.25);
}
