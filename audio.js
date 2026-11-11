// Ambient sound, synthesised with Web Audio (no sound files): birdsong, dog barks, cow moos,
// a soft wind bed, a police siren and crash thuds. Everything is mixed low; animals are louder
// when close and panned to their side of the road. Phones only allow audio after a tap, so the
// context starts on the first touch, click or key press. A Sound on/off switch is remembered.
export function createAudio(){
  let ctx=null,master=null,ambience=null,enabled=true,noiseBuf=null,wind=null,siren=null;
  try{enabled=localStorage.getItem('aushiger-sound')!=='off';}catch(e){}
  const rnd=(a,b)=>a+Math.random()*(b-a);
  function start(){
    if(ctx){if(ctx.state==='suspended')ctx.resume();return;}
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    ctx=new AC();master=ctx.createGain();master.gain.value=enabled?.55:0;master.connect(ctx.destination);
    ambience=ctx.createGain();ambience.gain.value=1;ambience.connect(master);
    noiseBuf=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const d=noiseBuf.getChannelData(0);let b=0;
    for(let i=0;i<d.length;i++){const w=Math.random()*2-1;b=.97*b+.03*w;d[i]=w*.5+b*2.5;}
    // wind: filtered noise, very low and slowly breathing
    const src=ctx.createBufferSource();src.buffer=noiseBuf;src.loop=true;
    const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=420;
    const g=ctx.createGain();g.gain.value=.018;src.connect(lp).connect(g).connect(ambience);src.start();wind={g,lp};
  }
  for(const ev of ['pointerdown','touchstart','keydown','click'])addEventListener(ev,start,{passive:true});
  const panner=pan=>{const p=ctx.createStereoPanner?ctx.createStereoPanner():null;if(p){p.pan.value=Math.max(-1,Math.min(1,pan));}return p;};
  const out=(node,pan)=>{const p=panner(pan);if(p){node.connect(p).connect(ambience);}else node.connect(ambience);};
  const near=(dist,range)=>Math.max(0,1-dist/range)**1.6;

  function chirpSong(vol,pan){
    // a short phrase: a few quick sweeping notes, sometimes a trill
    const t0=ctx.currentTime+.02,notes=Math.floor(rnd(2,7)),base=rnd(2600,4800),trill=Math.random()<.35;
    const g=ctx.createGain();g.gain.value=0;out(g,pan);
    let t=t0;
    for(let i=0;i<notes;i++){
      const o=ctx.createOscillator();o.type='sine';const f=base*rnd(.85,1.25),len=trill?.045:rnd(.06,.16);
      o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*rnd(.7,1.45),t+len);
      const e=ctx.createGain();e.gain.setValueAtTime(0,t);e.gain.linearRampToValueAtTime(vol,t+.01);e.gain.exponentialRampToValueAtTime(.0001,t+len);
      o.connect(e).connect(g);o.start(t);o.stop(t+len+.02);t+=len+(trill?.015:rnd(.04,.14));
    }
    g.gain.setValueAtTime(1,t0);
  }
  function bark(vol,pan,count=1){
    let t=ctx.currentTime+.02;
    for(let i=0;i<count;i++){
      const len=rnd(.11,.18),f=rnd(260,420);
      const o=ctx.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(f*1.25,t);o.frequency.exponentialRampToValueAtTime(f*.7,t+len);
      const n=ctx.createBufferSource();n.buffer=noiseBuf;
      const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=rnd(700,1100);bp.Q.value=1.4;
      const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=2200;
      const e=ctx.createGain();e.gain.setValueAtTime(0,t);e.gain.linearRampToValueAtTime(vol,t+.012);e.gain.exponentialRampToValueAtTime(.0001,t+len);
      const mix=ctx.createGain();mix.gain.value=.6;o.connect(lp);n.connect(mix).connect(lp);lp.connect(bp).connect(e);out(e,pan);
      o.start(t);o.stop(t+len+.02);n.start(t,Math.random());n.stop(t+len+.02);
      t+=len+rnd(.12,.3);
    }
  }
  function moo(vol,pan){
    const t=ctx.currentTime+.02,len=rnd(1.1,1.9),f=rnd(95,130);
    const o=ctx.createOscillator();o.type='sawtooth';
    o.frequency.setValueAtTime(f*.9,t);o.frequency.linearRampToValueAtTime(f*1.12,t+len*.35);o.frequency.linearRampToValueAtTime(f*.82,t+len);
    const vib=ctx.createOscillator(),vg=ctx.createGain();vib.frequency.value=5.5;vg.gain.value=2.5;vib.connect(vg).connect(o.frequency);
    // the "m-oo" vowel: a formant that opens then closes
    const f1=ctx.createBiquadFilter();f1.type='bandpass';f1.Q.value=3;f1.frequency.setValueAtTime(260,t);f1.frequency.linearRampToValueAtTime(620,t+len*.3);f1.frequency.linearRampToValueAtTime(380,t+len);
    const f2=ctx.createBiquadFilter();f2.type='lowpass';f2.frequency.value=900;
    const e=ctx.createGain();e.gain.setValueAtTime(0,t);e.gain.linearRampToValueAtTime(vol,t+.18);e.gain.setValueAtTime(vol,t+len*.75);e.gain.exponentialRampToValueAtTime(.0001,t+len);
    o.connect(f1).connect(f2).connect(e);out(e,pan);o.start(t);vib.start(t);o.stop(t+len+.05);vib.stop(t+len+.05);
  }
  function thud(vol){
    const t=ctx.currentTime+.01,n=ctx.createBufferSource();n.buffer=noiseBuf;
    const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.setValueAtTime(900,t);lp.frequency.exponentialRampToValueAtTime(120,t+.35);
    const e=ctx.createGain();e.gain.setValueAtTime(vol,t);e.gain.exponentialRampToValueAtTime(.0001,t+.45);
    n.connect(lp).connect(e).connect(master);n.start(t,Math.random());n.stop(t+.5);
  }
  function sirenOn(){
    if(siren)return;
    const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=900;
    const lfo=ctx.createOscillator(),lg=ctx.createGain();lfo.type='sine';lfo.frequency.value=.35;lg.gain.value=330;lfo.connect(lg).connect(o.frequency);
    const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1800;
    const g=ctx.createGain();g.gain.value=0;const p=panner(0);
    o.connect(lp).connect(g);if(p)g.connect(p).connect(master);else g.connect(master);
    o.start();lfo.start();siren={o,lfo,g,p};
  }
  function sirenOff(){if(!siren)return;const s=siren;siren=null;const t=ctx.currentTime;s.g.gain.setTargetAtTime(0,t,.3);setTimeout(()=>{try{s.o.stop();s.lfo.stop();}catch(e){}},1500);}

  let birdClock=1.5,barkClock=4,mooClock=6;
  return {
    get enabled(){return enabled;},
    setEnabled(on){enabled=on;try{localStorage.setItem('aushiger-sound',on?'on':'off');}catch(e){}if(master)master.gain.setTargetAtTime(on?.55:0,ctx.currentTime,.1);if(on)start();},
    crash(amount){if(ctx&&enabled)thud(Math.min(.9,.25+amount*1.5));},
    update(dt,{player,cows=[],dogs=[],police=null,paused=false}){
      if(!ctx||ctx.state!=='running')return;
      if(wind){wind.g.gain.value=.012+.008*Math.sin(performance.now()/4300)+Math.min(.02,Math.abs(player.speed)*.0008);}
      // police siren: louder as it gets close, panned to its side
      if(police&&!paused){sirenOn();const dist=Math.hypot(police.d-player.distance,police.lat-player.lateral);
        siren.g.gain.setTargetAtTime(.16*Math.max(.08,1-dist/260),ctx.currentTime,.1);if(siren.p)siren.p.pan.value=Math.max(-1,Math.min(1,(police.lat-player.lateral)/6));}
      else sirenOff();
      if(paused)return;
      birdClock-=dt;if(birdClock<=0){birdClock=rnd(1.2,4.5);chirpSong(rnd(.012,.03),rnd(-.8,.8));if(Math.random()<.3)setTimeout(()=>ctx&&chirpSong(rnd(.008,.02),rnd(-.8,.8)),rnd(200,700));}
      barkClock-=dt;
      if(barkClock<=0){
        barkClock=rnd(3,9);
        const live=dogs.filter(g=>!g.dead).map(g=>({g,dist:Math.hypot(g.d-player.distance,g.lat-player.lateral)})).filter(x=>x.dist<90).sort((a,b)=>a.dist-b.dist);
        const chasing=live.find(x=>x.g.chase);
        const pick=chasing||live[0];
        if(pick)bark(.22*near(pick.dist,90)+.02,(pick.g.lat-player.lateral)/8,chasing?Math.floor(rnd(2,5)):Math.floor(rnd(1,3)));
        if(chasing)barkClock=rnd(.8,1.8);
      }
      mooClock-=dt;
      if(mooClock<=0){
        mooClock=rnd(8,20);
        const live=cows.filter(c=>!c.dead).map(c=>({c,dist:Math.hypot(c.d-player.distance,c.lat-player.lateral)})).filter(x=>x.dist<160);
        if(live.length){const x=live[Math.floor(Math.random()*live.length)];moo(.2*near(x.dist,160)+.02,(x.c.lat-player.lateral)/8);}
      }
    }
  };
}
