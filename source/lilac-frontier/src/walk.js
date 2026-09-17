export const ROOM = {floor:3.34,minX:-10.15,maxX:10.10,minY:-19.35,maxY:-2.2,radius:.36};
export const OBSTACLES = [
  {minX:-10.9,maxX:-7.3,minY:-4.4,maxY:0},
  {minX:5.5,maxX:8.8,minY:-2.4,maxY:0},
  {minX:-3.1,maxX:3.1,minY:-21,maxY:-19.25},
];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

export class WalkMotion {
  constructor(settings){this.settings=settings;this.keys=new Set();this.reset()}
  reset(){this.x=0;this.y=-14.8;this.yaw=0;this.pitch=.065;this.vx=0;this.vy=0;this.lastTime=null;this.active=false;this.locked=false;this.moving=false;this.lookDirty=false;this.keys.clear()}
  stop(){this.keys.clear();this.vx=0;this.vy=0;this.moving=false;this.lastTime=null}
  look(dx,dy){this.yaw+=dx*.002*this.settings.lookSensitivity;this.pitch=clamp(this.pitch-dy*.002*this.settings.lookSensitivity,-1.35,1.35);this.lookDirty=true}
  move(dx,dy){
    // Small steps and separate axes allow sliding without tunnelling through cabinets.
    const count=Math.max(1,Math.ceil(Math.hypot(dx,dy)/.1));
    for(let i=0;i<count;i++){
      let x=clamp(this.x+dx/count,ROOM.minX,ROOM.maxX);
      for(const box of OBSTACLES)if(this.y>box.minY-ROOM.radius&&this.y<box.maxY+ROOM.radius&&x>box.minX-ROOM.radius&&x<box.maxX+ROOM.radius)x=dx>0?box.minX-ROOM.radius:box.maxX+ROOM.radius;
      this.x=clamp(x,ROOM.minX,ROOM.maxX);
      let y=clamp(this.y+dy/count,ROOM.minY,ROOM.maxY);
      for(const box of OBSTACLES)if(this.x>box.minX-ROOM.radius&&this.x<box.maxX+ROOM.radius&&y>box.minY-ROOM.radius&&y<box.maxY+ROOM.radius)y=dy>0?box.minY-ROOM.radius:box.maxY+ROOM.radius;
      this.y=clamp(y,ROOM.minY,ROOM.maxY);
    }
  }
  step(time){
    const dt=this.lastTime===null?1/60:clamp((time-this.lastTime)/1000,0,.05);this.lastTime=time;
    if(!this.active||this.settings.viewMode!=='walk'){this.stop();return false}
    const old=[this.x,this.y,this.yaw,this.pitch],lookChanged=this.lookDirty;this.lookDirty=false;
    const side=Number(this.keys.has('KeyD'))-Number(this.keys.has('KeyA'));
    const forward=Number(this.keys.has('KeyW'))-Number(this.keys.has('KeyS'));
    const norm=Math.max(1,Math.hypot(side,forward));
    const speed=this.settings.walkSpeed*(this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')?1.7:1);
    const vx=(Math.cos(this.yaw)*side+Math.sin(this.yaw)*forward)/norm*speed;
    const vy=(-Math.sin(this.yaw)*side+Math.cos(this.yaw)*forward)/norm*speed;
    const blend=1-Math.exp(-dt/0.075);
    this.vx+=(vx-this.vx)*blend;this.vy+=(vy-this.vy)*blend;
    if(Math.abs(this.vx)<.001)this.vx=0;if(Math.abs(this.vy)<.001)this.vy=0;
    this.move(this.vx*dt,this.vy*dt);
    const turn=Number(this.keys.has('ArrowRight'))-Number(this.keys.has('ArrowLeft'));
    const tilt=Number(this.keys.has('ArrowUp'))-Number(this.keys.has('ArrowDown'));
    this.yaw+=turn*1.35*dt;this.pitch=clamp(this.pitch+tilt*.9*dt,-1.35,1.35);
    this.moving=!!(this.vx||this.vy||turn||tilt||lookChanged);
    return lookChanged||old.some((v,i)=>v!==[this.x,this.y,this.yaw,this.pitch][i]);
  }
  snapshot(){return {x:this.x,y:this.y,z:ROOM.floor+this.settings.eyeHeight,yaw:this.yaw,pitch:this.pitch,active:this.active,locked:this.locked,moving:this.moving,keys:[...this.keys]}}
}

export function bindWalk(canvas,walk,wake,status,win=window,doc=document){
  let drag=null,lockPending=false,wantsControl=false;
  const enabled=()=>walk.settings.viewMode==='walk';
  const releaseDrag=()=>{if(drag&&canvas.hasPointerCapture(drag.id))canvas.releasePointerCapture(drag.id);drag=null};
  const stop=()=>{wantsControl=false;walk.stop();walk.active=false;releaseDrag();if(doc.pointerLockElement===canvas)doc.exitPointerLock();if(enabled())status('Click the scene to explore · WASD + mouse · Esc to release');wake()};
  const fallback=error=>{lockPending=false;if(error?.message||!canvas.dataset.pointerLockError)canvas.dataset.pointerLockError=error?.message||error?.type||'unavailable';canvas.dataset.pointerLockStatus='unavailable';if(wantsControl&&enabled()&&doc.activeElement===canvas){walk.active=true;status('Mouse capture unavailable · click to retry · hold and drag to look')}wake()};
  const enter=()=>{
    if(!enabled())return;
    releaseDrag();canvas.focus({preventScroll:true});wantsControl=true;walk.active=true;walk.lastTime=null;
    if(!canvas.requestPointerLock){fallback();return}
    if(doc.pointerLockElement!==canvas&&!lockPending){
      lockPending=true;
      canvas.dataset.pointerLockStatus='requesting';delete canvas.dataset.pointerLockError;
      canvas.dataset.pointerLockRequest=JSON.stringify({focused:doc.hasFocus?.(),activation:win.navigator?.userActivation?.isActive});
      try{const attempt=canvas.requestPointerLock();attempt?.catch(fallback)}catch(error){fallback(error)}
    }
    wake();
  };
  canvas.addEventListener('pointerdown',event=>{
    if(!enabled()||event.button!==0||event.isPrimary===false)return;
    canvas.classList.add('pointer-focused');
    // Native locking begins on the completed click, after the mouse button is up.
    // Pointer capture is only a fallback and must not compete with pointer lock.
    if(doc.pointerLockElement!==canvas&&walk.active&&canvas.dataset.pointerLockStatus==='unavailable'){
      drag={id:event.pointerId,x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);
    }
  });
  canvas.addEventListener('click',event=>{if(event.button===0&&doc.pointerLockElement!==canvas)enter()});
  doc.addEventListener('mousemove',event=>{
    if(!enabled()||!walk.active)return;
    if(doc.pointerLockElement===canvas){walk.look(event.movementX,event.movementY);wake()}
  });
  doc.addEventListener('pointermove',event=>{
    if(!enabled()||!walk.active||doc.pointerLockElement===canvas||!drag||event.pointerId!==drag.id)return;
    walk.look(event.clientX-drag.x,event.clientY-drag.y);drag.x=event.clientX;drag.y=event.clientY;wake();
  });
  doc.addEventListener('pointerup',event=>{if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);drag=null});
  canvas.addEventListener('pointercancel',stop);
  doc.addEventListener('pointerlockchange',()=>{
    lockPending=false;walk.locked=doc.pointerLockElement===canvas;
    if(walk.locked&&(!wantsControl||!enabled())){doc.exitPointerLock();return}
    if(walk.locked){walk.active=true;releaseDrag();canvas.dataset.pointerLockStatus='locked';status('WASD to walk · mouse to look · Shift to move faster · Esc to release')}
    else{wantsControl=false;walk.stop();walk.active=false;canvas.dataset.pointerLockStatus='released';status('Click the scene to explore · WASD + mouse · Esc to release')}
    wake();
  });
  doc.addEventListener('pointerlockerror',fallback);
  const codes=new Set(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','ArrowLeft','ArrowRight','ArrowUp','ArrowDown']);
  doc.addEventListener('keydown',event=>{
    if(!enabled())return;
    if(event.code==='Escape'||event.code==='Backquote'){stop();return}
    if(!walk.active||(doc.activeElement!==canvas&&doc.pointerLockElement!==canvas)||!codes.has(event.code))return;
    event.preventDefault();walk.keys.add(event.code);wake();walk.lastTime??=performance.now();
  });
  doc.addEventListener('keyup',event=>{if(walk.keys.has(event.code)){walk.step(performance.now());walk.keys.delete(event.code);wake()}});
  win.addEventListener('blur',stop);canvas.addEventListener('blur',()=>{if(doc.pointerLockElement!==canvas)stop()});
  doc.addEventListener('visibilitychange',()=>{if(doc.hidden)stop()});
  return {enter,stop,refresh(){canvas.classList.toggle('walk-view',enabled());if(!enabled())stop()}};
}
