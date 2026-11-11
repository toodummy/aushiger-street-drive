import * as THREE from 'three';

// Exhaust smoke: soft puffs from the tailpipes of every car (one draw call for all of them).
// Petrol cars leave a faint pale haze; diesel trucks puff darker smoke from their stacks,
// thicker when they pull away. Each puff drifts up, spreads and fades in a second or two.
export function createExhaust(scene,MAX=420){
  const pos=new Float32Array(MAX*3),size=new Float32Array(MAX),alpha=new Float32Array(MAX),shade=new Float32Array(MAX);
  const vel=new Float32Array(MAX*3),life=new Float32Array(MAX),maxLife=new Float32Array(MAX).fill(1),s0=new Float32Array(MAX),grow=new Float32Array(MAX),a0=new Float32Array(MAX);
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize',new THREE.BufferAttribute(size,1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aAlpha',new THREE.BufferAttribute(alpha,1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aShade',new THREE.BufferAttribute(shade,1).setUsage(THREE.DynamicDrawUsage));
  const mat=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,uniforms:{uScale:{value:600}},
    vertexShader:`attribute float aSize;attribute float aAlpha;attribute float aShade;uniform float uScale;varying float vA;varying float vS;varying float vSeed;
      void main(){vA=aAlpha;vS=aShade;vSeed=fract(position.x*3.1+position.z*1.7);vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aAlpha>0.?aSize*uScale/max(.2,-mv.z):0.;}`,
    fragmentShader:`varying float vA;varying float vS;varying float vSeed;
      void main(){vec2 c=gl_PointCoord-.5;float r=length(c)*2.;if(r>1.)discard;
        float lumpy=.82+.18*sin(c.x*11.+vSeed*20.)*sin(c.y*9.-vSeed*13.);
        float a=(1.-r*r)*(1.-r*r)*vA*lumpy;gl_FragColor=vec4(vec3(vS),a);}`
  });
  const pts=new THREE.Points(geo,mat);pts.frustumCulled=false;pts.renderOrder=5;pts.name='Exhaust smoke';scene.add(pts);
  let next=0,live=0;
  return {
    // p: world position of the pipe, v: car velocity (world), opts: size, alpha, shade (0 black..1 white), life
    emit(p,v,{size:sz=.22,spread=1.3,alpha:al=.18,shade:sh=.78,life:lf=1.6,rise=.35}={}){
      const i=next;next=(next+1)%MAX;
      pos[i*3]=p.x+(Math.random()-.5)*.06;pos[i*3+1]=p.y;pos[i*3+2]=p.z+(Math.random()-.5)*.06;
      vel[i*3]=(v?v.x*.25:0)+(Math.random()-.5)*.35;vel[i*3+1]=rise+Math.random()*.25;vel[i*3+2]=(v?v.z*.25:0)+(Math.random()-.5)*.35;
      life[i]=0;maxLife[i]=lf*(.75+Math.random()*.5);s0[i]=sz;grow[i]=spread*(.8+Math.random()*.4);a0[i]=al;shade[i]=sh+(Math.random()-.5)*.06;
    },
    update(dt,camera,heightPx){
      mat.uniforms.uScale.value=heightPx/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2));
      dt=Math.min(dt,.05);const drag=Math.max(0,1-dt*1.8);
      for(let i=0;i<MAX;i++){
        if(life[i]>=maxLife[i]){alpha[i]=0;continue;}
        life[i]+=dt;const t=Math.min(1,life[i]/maxLife[i]);
        vel[i*3]*=drag;vel[i*3+2]*=drag;vel[i*3+1]=vel[i*3+1]*Math.max(0,1-dt*.6)+dt*.12;
        pos[i*3]+=vel[i*3]*dt;pos[i*3+1]+=vel[i*3+1]*dt;pos[i*3+2]+=vel[i*3+2]*dt;
        size[i]=s0[i]+grow[i]*Math.sqrt(t);alpha[i]=a0[i]*(1-t)*Math.min(1,t*10);
      }
      for(const n of ['position','aSize','aAlpha','aShade'])geo.attributes[n].needsUpdate=true;
    }
  };
}
