// Ambient sound, synthesised with Web Audio (no sound files): birdsong, dog barks, cow moos,
// a soft wind bed, a police siren and crash thuds. Everything is mixed low; animals are louder
// when close and panned to their side of the road. Phones only allow audio after a tap, so the
// context starts on the first touch, click or key press. A Sound on/off switch is remembered.
export function createAudio(){
  let ctx=null,master=null,ambience=null,musicBus=null,enabled=true,musicOn=true,noiseBuf=null,wind=null,siren=null,unlockEl=null;
  try{enabled=localStorage.getItem('aushiger-sound')!=='off';musicOn=localStorage.getItem('aushiger-music')!=='off';}catch(e){}
  // iPhones mute Web Audio when the ring/silent switch is on. Asking for a "playback" audio session
  // (Safari 16.4+) and playing a silent <audio> loop from the first tap moves the game onto the media
  // channel, so it's heard like a video is.
  function silentWav(){
    const n=800,b=new ArrayBuffer(44+n),v=new DataView(b),w=(o,t)=>{for(let i=0;i<t.length;i++)v.setUint8(o+i,t.charCodeAt(i));};
    w(0,'RIFF');v.setUint32(4,36+n,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
    v.setUint32(24,8000,true);v.setUint32(28,8000,true);v.setUint16(32,1,true);v.setUint16(34,8,true);w(36,'data');v.setUint32(40,n,true);
    for(let i=0;i<n;i++)v.setUint8(44+i,128);
    return URL.createObjectURL(new Blob([b],{type:'audio/wav'}));
  }
  function unlock(){
    try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch(e){}
    try{if(!unlockEl){unlockEl=document.createElement('audio');unlockEl.src=silentWav();unlockEl.loop=true;unlockEl.setAttribute('playsinline','');unlockEl.volume=.01;}
      if(unlockEl.paused)unlockEl.play().catch(()=>{});}catch(e){}
  }
  const rnd=(a,b)=>a+Math.random()*(b-a);
  function start(){
    if(!enabled)return;
    unlock();
    if(ctx){if(ctx.state!=='running')ctx.resume().catch(()=>{});if(musicOn&&!musicTimer)startMusic();return;}
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    ctx=new AC();master=ctx.createGain();master.gain.value=enabled?.9:0;master.connect(ctx.destination);
    ambience=ctx.createGain();ambience.gain.value=1;ambience.connect(master);
    musicBus=ctx.createGain();musicBus.gain.value=musicOn?MUSIC_VOL:0;musicBus.connect(master);
    if(ctx.state!=='running')ctx.resume().catch(()=>{});
    loadSamples();if(musicOn)startMusic();
    noiseBuf=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const d=noiseBuf.getChannelData(0);let b=0;
    for(let i=0;i<d.length;i++){const w=Math.random()*2-1;b=.97*b+.03*w;d[i]=w*.5+b*2.5;}
    // wind: filtered noise, very low and slowly breathing
    const src=ctx.createBufferSource();src.buffer=noiseBuf;src.loop=true;
    const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=420;
    const g=ctx.createGain();g.gain.value=.03;src.connect(lp).connect(g).connect(ambience);src.start();wind={g,lp};
  }
  for(const ev of ['pointerdown','touchstart','touchend','keydown','click'])addEventListener(ev,start,{passive:true,capture:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&ctx&&enabled)ctx.resume().catch(()=>{});});
  const panner=pan=>{const p=ctx.createStereoPanner?ctx.createStereoPanner():null;if(p){p.pan.value=Math.max(-1,Math.min(1,pan));}return p;};
  const out=(node,pan)=>{const p=panner(pan);if(p){node.connect(p).connect(ambience);}else node.connect(ambience);};
  const near=(dist,range)=>Math.max(0,1-dist/range)**1.6;

  // Real recordings (CC0 field recordings via the ESC-50 dataset, see sounds/CREDITS.txt):
  // six dogs, six cows (also used, pitched down, for the buffaloes), roosters and crows.
  const SAMPLES={dog:[1,2,3,4,5,6],cow:[1,2,3,4,5,6],rooster:[1,2],crow:[1,2]},bufs={};let loading=false;
  function decode(ab){return new Promise((res,rej)=>{const p=ctx.decodeAudioData(ab,res,rej);if(p&&p.then)p.then(res,rej);});}
  function loadSamples(){
    if(loading)return;loading=true;
    for(const [kind,ids] of Object.entries(SAMPLES)){bufs[kind]=[];
      for(const i of ids)fetch(`./sounds/${kind}${i}.mp3?v=1`).then(r=>r.ok?r.arrayBuffer():Promise.reject(r.status)).then(decode).then(b=>bufs[kind].push(b)).catch(e=>console.warn('sound',kind,i,e));}
  }
  const last={};
  function playSample(kind,vol,pan,{rate=1,lowpass=0}={}){
    const list=bufs[kind];if(!list?.length)return false;
    // never the same clip twice in a row
    let i=Math.floor(Math.random()*list.length);if(list.length>1&&i===last[kind])i=(i+1)%list.length;last[kind]=i;
    const src=ctx.createBufferSource();src.buffer=list[i];src.playbackRate.value=rate;
    const g=ctx.createGain();g.gain.value=vol;let node=src;
    if(lowpass){const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=lowpass;node.connect(lp);node=lp;}
    node.connect(g);out(g,pan);src.start();return true;
  }

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
  function growl(vol,pan){
    const t=ctx.currentTime+.02,len=rnd(.5,.9),n=ctx.createBufferSource();n.buffer=noiseBuf;
    const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=rnd(85,110);
    const am=ctx.createOscillator(),ag=ctx.createGain();am.frequency.value=rnd(24,32);ag.gain.value=.5;
    const e=ctx.createGain();e.gain.value=0;const v=ctx.createGain();v.gain.setValueAtTime(0,t);v.gain.linearRampToValueAtTime(vol,t+.08);v.gain.setValueAtTime(vol,t+len*.7);v.gain.exponentialRampToValueAtTime(.0001,t+len);
    am.connect(ag).connect(e.gain);const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=600;
    const mix=ctx.createGain();mix.gain.value=.4;o.connect(lp);n.connect(mix).connect(lp);lp.connect(e).connect(v);out(v,pan);
    o.start(t);am.start(t);n.start(t,Math.random());for(const x of [o,am,n])x.stop(t+len+.05);
  }

  // ---- Background music: the "Аушыджэр сити" track, looped quietly under the game sounds.
  // An <audio> element streams it (no 4-minute decode in memory) and feeds the music volume control.
  const MUSIC_VOL=.32;
  let musicEl=null,musicNode=null,musicTimer=null;
  function startMusic(){
    if(!ctx)return;
    if(!musicEl){
      musicEl=new Audio('./music/aushiger-city.mp3?v=1');musicEl.loop=true;musicEl.preload='auto';musicEl.setAttribute('playsinline','');
      try{musicNode=ctx.createMediaElementSource(musicEl);musicNode.connect(musicBus);}catch(e){musicEl.volume=MUSIC_VOL;}
    }
    musicTimer=true;musicEl.play().catch(()=>{musicTimer=null;});
  }
  function stopMusic(){musicEl?.pause();musicTimer=null;}

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

  let birdClock=1.5,barkClock=6,mooClock=12,roosterClock=40,crowClock=20;
  return {
    get enabled(){return enabled;},
    get music(){return musicOn;},
    setEnabled(on){enabled=on;try{localStorage.setItem('aushiger-sound',on?'on':'off');}catch(e){}if(master)master.gain.setTargetAtTime(on?.9:0,ctx.currentTime,.1);if(on)start();else stopMusic();},
    setMusic(on){musicOn=on;try{localStorage.setItem('aushiger-music',on?'on':'off');}catch(e){}if(musicBus)musicBus.gain.setTargetAtTime(on?MUSIC_VOL:0,ctx.currentTime,.3);if(on)start();else stopMusic();},
    get running(){return !!ctx&&ctx.state==='running';},
    crash(amount){if(ctx&&enabled)thud(Math.min(.9,.25+amount*1.5));},
    update(dt,{player,cows=[],dogs=[],police=null,paused=false}){
      if(!ctx||ctx.state!=='running')return;
      if(musicOn&&enabled&&!musicTimer)startMusic();
      if(wind){wind.g.gain.value=.022+.012*Math.sin(performance.now()/4300)+Math.min(.03,Math.abs(player.speed)*.0012);}
      // police siren: louder as it gets close, panned to its side
      if(police&&!paused){sirenOn();const dist=Math.hypot(police.d-player.distance,police.lat-player.lateral);
        siren.g.gain.setTargetAtTime(.13*Math.max(.08,1-dist/260),ctx.currentTime,.1);if(siren.p)siren.p.pan.value=Math.max(-1,Math.min(1,(police.lat-player.lateral)/6));}
      else sirenOff();
      if(paused)return;
      birdClock-=dt;if(birdClock<=0){birdClock=rnd(3,8);chirpSong(rnd(.03,.07),rnd(-.8,.8));if(Math.random()<.35)setTimeout(()=>ctx&&chirpSong(rnd(.02,.05),rnd(-.8,.8)),rnd(200,700));}
      // dogs: an occasional bark from a nearby dog; a dog chasing the car barks more, but not nonstop
      barkClock-=dt;
      if(barkClock<=0){
        const live=dogs.filter(g=>!g.dead).map(g=>({g,dist:Math.hypot(g.d-player.distance,g.lat-player.lateral)})).filter(x=>x.dist<75).sort((a,b)=>a.dist-b.dist);
        const chasing=live.find(x=>x.g.chase),pick=chasing||live[0];
        barkClock=chasing?rnd(1.8,3.5):rnd(12,26);
        if(pick)playSample('dog',(chasing?.55:.4)*near(pick.dist,75)+.03,(pick.g.lat-player.lateral)/8,{rate:rnd(.94,1.06)});
        else barkClock=rnd(6,12);
      }
      // cows and buffaloes: a moo now and then (buffaloes are the same voice, deeper and darker)
      mooClock-=dt;
      if(mooClock<=0){
        mooClock=rnd(25,50);
        const live=cows.filter(c=>!c.dead).map(c=>({c,dist:Math.hypot(c.d-player.distance,c.lat-player.lateral)})).filter(x=>x.dist<160);
        if(live.length){const x=live[Math.floor(Math.random()*live.length)],pan=(x.c.lat-player.lateral)/8,v=.4*near(x.dist,160)+.03;
          if(x.c.buffalo)playSample('cow',v*1.15,pan,{rate:rnd(.7,.78),lowpass:1100});else playSample('cow',v,pan,{rate:rnd(.93,1.05)});}
        else mooClock=rnd(10,20);
      }
      // village life far off: a rooster sometimes, crows overhead
      roosterClock-=dt;if(roosterClock<=0){roosterClock=rnd(70,150);if(player.distance>420)playSample('rooster',rnd(.05,.09),rnd(-.9,.9),{lowpass:3500});}
      crowClock-=dt;if(crowClock<=0){crowClock=rnd(35,80);playSample('crow',rnd(.04,.08),rnd(-.9,.9));}
    }
  };
}
