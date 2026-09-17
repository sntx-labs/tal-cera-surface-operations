import * as THREE from 'three';
import '../../infrastructure/sh-panel/sh-panel.js';
import './style.css';
import {makeMaterial} from './materials.js';
import {InspectionMotion,bindInspection} from './inspection.js';
import {WalkMotion,bindWalk,ROOM} from './walk.js';
import {buildHallway} from './hallway.js';
import {buildLandscape} from './landscape.js';

const started=performance.now(), query=new URLSearchParams(location.search), proof=query.has('proof');
const defaults={exposure:0,sun:2.5,fill:.9,toonThreshold:1,texture:1,ink:1,contour:1,screen:1,roomTint:'#ffffff',terrainTint:'#ffffff',sky:'#99ace6',zoom:1,panX:0,panY:0,matte:true,resolution:1,samples:32,interactive:!matchMedia('(prefers-reduced-motion: reduce)').matches,parallax:.8,inspectZoom:1.5,response:.16,viewMode:proof?'inspection':'walk',walkSpeed:3.4,lookSensitivity:1,eyeHeight:3.36,walkFov:57,hallFill:.18};
// Start new visitors with the approved presentation; keep source comparison isolated.
if(!proof)Object.assign(defaults,{sun:4.3,toonThreshold:.89,texture:.95,ink:1.05,contour:.95,screen:1.34,zoom:.85,panX:-.36,panY:-.27,eyeHeight:3.34,walkFov:80});
let stored={};try{stored=proof?{}:JSON.parse(localStorage.getItem('lilac-frontier-settings-v1')||'{}')}catch{}
const settings={...defaults,...Object.fromEntries(Object.entries(stored).filter(([k])=>k in defaults))};
const panelEl=document.querySelector('#panel'), shell=document.querySelector('#app'), viewport=document.querySelector('#viewport');
if(query.get('panel')==='closed')sessionStorage.setItem('sh-panel-collapsed','true');
else if(query.get('panel')==='open')sessionStorage.setItem('sh-panel-collapsed','false');
const panel=new window.SHPanel(panelEl);
const intro=document.createElement('div');intro.className='panel-intro';intro.innerHTML='<strong>Lilac Frontier</strong>Move your pointer to look around.<br>Hold to inspect; release to return.<br>Press ` to open or close controls.';panelEl.prepend(intro);
const status=document.createElement('div');status.className='panel-status';status.setAttribute('role','status');status.textContent='Loading source geometry…';intro.after(status);
const dock=()=>{shell.classList.toggle('closed',panelEl.classList.contains('collapsed'));};dock();window.addEventListener('sh-panel-toggle',dock);
for(const event of ['pointerdown','pointermove','pointerup','wheel'])panelEl.addEventListener(event,e=>e.stopPropagation());
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance',preserveDrawingBuffer:true,premultipliedAlpha:false});
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;renderer.setPixelRatio(1);renderer.info.autoReset=false;viewport.append(renderer.domElement);
renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','Lilac Frontier interactive scene. Move the pointer to look around. Hold the primary button or Space to zoom in; release to return.');
const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(), postScene=new THREE.Scene(), postCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
let target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:4});
let historyA=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false}),historyB=historyA.clone();
const accumulationScene=new THREE.Scene();
const accumulation=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{tCurrent:{value:target.texture},tPrevious:{value:historyA.texture},uWeight:{value:1}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'varying vec2 vUv;uniform sampler2D tCurrent,tPrevious;uniform float uWeight;void main(){gl_FragColor=uWeight>=1.0?texture2D(tCurrent,vUv):mix(texture2D(tPrevious,vUv),texture2D(tCurrent,vUv),uWeight);}'});
accumulationScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),accumulation));
const shadowTarget=new THREE.WebGLRenderTarget(4096,4096,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
shadowTarget.depthTexture=new THREE.DepthTexture(4096,4096,THREE.UnsignedIntType);
const shadowCamera=new THREE.OrthographicCamera(-22,22,22,-22,.1,150);shadowCamera.up.set(0,0,1);
const depthMaterial=new THREE.MeshDepthMaterial({side:THREE.DoubleSide});
const shared={uWorld:{value:new THREE.Color(.318546772,.412542611,.791297913)},uSun:{value:settings.sun},uFill:{value:settings.fill},uThreshold:{value:settings.toonThreshold},uShadow:{value:shadowTarget.depthTexture},uShadowMatrix:{value:new THREE.Matrix4()},uSunDirection:{value:new THREE.Vector3()}};
const post=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{tScene:{value:target.texture},uResolution:{value:new THREE.Vector2(1,1)},uExposure:{value:0},uContour:{value:1},uWalk:{value:0},uMoonMask:{value:new THREE.Vector4(.734,.773,.029,.0505)},uWindowMask:{value:new THREE.Vector4(.544,.565,.332,.267)}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`
 varying vec2 vUv;uniform sampler2D tScene;uniform vec2 uResolution;uniform float uExposure,uContour,uWalk;uniform vec4 uMoonMask,uWindowMask;
 void main(){
 vec2 d=1.0/uResolution;vec3 c=texture2D(tScene,vUv).rgb;
 vec3 tl=texture2D(tScene,vUv+vec2(-d.x,d.y)).rgb,t=texture2D(tScene,vUv+vec2(0,d.y)).rgb,tr=texture2D(tScene,vUv+d).rgb;
 vec3 l=texture2D(tScene,vUv-vec2(d.x,0)).rgb,r=texture2D(tScene,vUv+vec2(d.x,0)).rgb;
 vec3 bl=texture2D(tScene,vUv-d).rgb,b=texture2D(tScene,vUv-vec2(0,d.y)).rgb,br=texture2D(tScene,vUv+vec2(d.x,-d.y)).rgb;
 vec3 gx=-tl-2.0*l-bl+tr+2.0*r+br,gy=-bl-2.0*b-br+tl+2.0*t+tr;
 float edge=dot(sqrt(gx*gx+gy*gy),vec3(.2126,.7152,.0722));
 float moon=step(1.0,length((vUv-uMoonMask.xy)/uMoonMask.zw));
 vec2 box=abs(vUv-uWindowMask.xy);float room=1.0-step(box.x,uWindowMask.z)*step(box.y,uWindowMask.w);
 if(uWalk>.5){float region=texture2D(tScene,vUv).a;moon=step(-.5,region);room=step(.5,region);}
 float amount=clamp(edge*1.2,0.0,1.0)*.30*moon*(.68+1.30*room)*uContour;
 vec3 color=mix(c,vec3(.0295568,.01764195,.0481718),clamp(amount,0.0,1.0))*exp2(uExposure);
 gl_FragColor=vec4(color,1.0);
 #include <colorspace_fragment>
 }`});
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),post));
const materials=[],meshes=[],controls=[];let manifest,ready=false,scheduled=false,baseCamera,sampleIndex=0,maskAnchors,renderedFrames=0,peakInspectZoom=1,movingFrames=0,hallway,landscape,sourceFov=28,lastMode;
const motion=new InspectionMotion(settings),inspection=bindInspection(renderer.domElement,motion,requestRender);
const walk=new WalkMotion(settings),navigation=bindWalk(renderer.domElement,walk,()=>{updateCamera();requestRender()},message=>status.textContent=message);
const payload=()=>({project:'lilac-frontier',version:1,settings:{...settings}});
function halton(i,b){let r=0,f=1;while(i>0){f/=b;r+=f*(i%b);i=Math.floor(i/b)}return r}
function requestRender(){sampleIndex=0;if(window.lilac)window.lilac.settled=false;if(!ready||scheduled)return;motion.lastTime=null;walk.lastTime=null;scheduled=true;requestAnimationFrame(refine)}
function refine(time){
 scheduled=false;
 const walker=settings.viewMode==='walk';
 if(walker?walk.step(time):motion.step(time)){updateCamera();sampleIndex=0}
 // Moving views use a fresh MSAA frame. Only a stationary camera accumulates samples.
 if(walker?walk.moving:motion.moving){render();scheduled=true;requestAnimationFrame(refine);return}
 const count=Number(settings.samples);
 // Preserve the source aspect despite integer rounding of the fitted canvas size.
 const sampleWidth=target.height*camera.aspect;
 camera.setViewOffset(sampleWidth,target.height,(halton(sampleIndex+1,2)-.5)*1.5,(halton(sampleIndex+1,3)-.5)*1.5,sampleWidth,target.height);
 renderer.info.reset();renderer.setRenderTarget(target);renderer.render(scene,camera);camera.clearViewOffset();
 accumulation.uniforms.tPrevious.value=historyA.texture;accumulation.uniforms.uWeight.value=1/(sampleIndex+1);renderer.setRenderTarget(historyB);renderer.render(accumulationScene,postCamera);
 [historyA,historyB]=[historyB,historyA];post.uniforms.tScene.value=historyA.texture;renderer.setRenderTarget(null);renderer.render(postScene,postCamera);
 renderedFrames++;sampleIndex++;if(sampleIndex<count){scheduled=true;requestAnimationFrame(refine)}else{window.lilac.settled=true;window.lilac.firstSettledMs??=performance.now()-started}publishViewState();
}
function render(){renderer.info.reset();renderer.setRenderTarget(target);renderer.render(scene,camera);post.uniforms.tScene.value=target.texture;renderer.setRenderTarget(null);renderer.render(postScene,postCamera);renderedFrames++;publishViewState();}
function publishViewState(){
 if(!(import.meta.env.DEV||proof))return;
 peakInspectZoom=Math.max(peakInspectZoom,motion.zoom);if(motion.moving||walk.moving)movingFrames++;
 // DOM-readable diagnostics keep local preview verification independent of page script access.
 renderer.domElement.dataset.viewState=JSON.stringify({viewMode:settings.viewMode,walk:walk.snapshot(),hallway:hallway?.stats,landscape:landscape?.stats,interaction:motion.snapshot(),position:camera.position.toArray(),zoom:camera.zoom,fov:camera.fov,aspect:camera.aspect,samples:sampleIndex,settled:window.lilac.settled,renderedFrames,movingFrames,peakInspectZoom,moonMask:post.uniforms.uMoonMask.value.toArray(),windowMask:post.uniforms.uWindowMask.value.toArray(),draws:renderer.info.render.calls,triangles:renderer.info.render.triangles});
}
function updateCamera(){
 if(!baseCamera)return;
 const walking=settings.viewMode==='walk';post.uniforms.uWalk.value=walking?1:0;
 if(walking){
  camera.position.set(walk.x,walk.y,ROOM.floor+settings.eyeHeight);camera.scale.set(1,1,1);camera.up.set(0,0,1);
  camera.lookAt(walk.x+Math.sin(walk.yaw)*Math.cos(walk.pitch),walk.y+Math.cos(walk.yaw)*Math.cos(walk.pitch),camera.position.z+Math.sin(walk.pitch));
  camera.zoom=1;camera.fov=settings.walkFov;camera.aspect=Math.max(1,viewport.clientWidth)/Math.max(1,viewport.clientHeight);
 }else{
  camera.matrix.copy(baseCamera);camera.matrix.decompose(camera.position,camera.quaternion,camera.scale);
  camera.position.x+=settings.panX+motion.x;camera.position.z+=settings.panY+motion.y;
  camera.zoom=settings.zoom*motion.zoom;camera.fov=sourceFov;camera.aspect=16/9;
 }
 camera.far=walking?3200:manifest.camera.far;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 if(hallway)hallway.group.visible=walking;
 if(landscape)landscape.group.visible=walking;
 for(const mesh of meshes)if(mesh.userData.region==='matte'){mesh.visible=settings.matte&&!walking;mesh.scale.set(1/camera.zoom,1/camera.zoom,1)}
 // Reproject the source's masks at their respective room/moon depths, without TAA jitter.
 for(const [name,anchors] of Object.entries(walking?{}:maskAnchors||{})){
  const center=anchors[0].clone().project(camera),corner=anchors[1].clone().project(camera);
  post.uniforms[name].value.set((center.x+1)/2,(center.y+1)/2,Math.abs(corner.x-center.x)/2,Math.abs(corner.y-center.y)/2);
 }
}
function resize(){
 const w=viewport.clientWidth,h=viewport.clientHeight;if(!w||!h)return;
 const walking=settings.viewMode==='walk',cw=Math.max(1,Math.floor(walking?w:Math.min(w,h*16/9))),ch=Math.max(1,walking?h:Math.round(cw*9/16));
 const scale=Math.min(window.devicePixelRatio||1,2)*settings.resolution;
 const rw=Math.round(cw*scale),rh=Math.round(ch*scale);if(renderer.domElement.width!==rw||renderer.domElement.height!==rh)renderer.setSize(rw,rh,false);renderer.domElement.style.width=cw+'px';renderer.domElement.style.height=ch+'px';
 target.setSize(renderer.domElement.width,renderer.domElement.height);historyA.setSize(target.width,target.height);historyB.setSize(target.width,target.height);post.uniforms.uResolution.value.set(target.width,target.height);updateCamera();requestRender();
}
new ResizeObserver(resize).observe(viewport);window.addEventListener('resize',resize);
function apply(){
 shared.uSun.value=settings.sun;shared.uFill.value=settings.fill;shared.uThreshold.value=settings.toonThreshold;
 post.uniforms.uExposure.value=settings.exposure;post.uniforms.uContour.value=settings.contour;
 scene.background=null;renderer.setClearColor(new THREE.Color(settings.sky),0);
 for(const {material,batch} of materials){
  material.uniforms.uTexture.value=settings.texture;
  material.uniforms.uCategoryGain.value=material.userData.ink?settings.ink:material.userData.display?settings.screen:1;
  material.uniforms.uHallFill.value=batch.region==='hallway'?settings.hallFill:0;
  material.uniforms.uHorizonColor.value.set(settings.sky);
  material.uniforms.uTint.value.set(batch.region==='matte'?'#ffffff':batch.region==='exterior'?settings.terrainTint:material.userData.toon?settings.roomTint:'#ffffff');
 }
 if(lastMode!==settings.viewMode){
  navigation.stop();inspection.cancel();motion.reset();walk.reset();lastMode=settings.viewMode;
  intro.innerHTML=settings.viewMode==='walk'?'<strong>Lilac Frontier</strong>Click the scene to explore.<br>WASD to walk · mouse to look.<br>Shift to move faster · Esc to release.<br>Press ` to open or close controls.':'<strong>Lilac Frontier</strong>Move your pointer to look around.<br>Hold to inspect; release to return.<br>Press ` to open or close controls.';
  renderer.domElement.setAttribute('aria-label',settings.viewMode==='walk'?'Lilac Frontier observation hallway. Click to enter. WASD to walk, mouse or arrow keys to look, Escape to release.':'Lilac Frontier window study. Move to look around; hold to inspect.');
  if(ready)status.textContent=settings.viewMode==='walk'?'Click the scene to explore · WASD + mouse · Esc to release':'Move to explore · hold to inspect';
 }
 framing.el.hidden=settings.viewMode==='walk';interaction.el.hidden=settings.viewMode==='walk';
 inspection.refresh();navigation.refresh();updateCamera();
 if(!proof)localStorage.setItem('lilac-frontier-settings-v1',JSON.stringify(settings));resize();requestRender();
}
function add(folder,type,key,opts){const c=folder[type](settings,key,opts);c.on('change',()=>{if(typeof defaults[key]==='number')settings[key]=Number(settings[key]);apply()});controls.push({key,control:c});return c}
const explore=panel.folder('Explore');
add(explore,'select','viewMode',{label:'View mode',options:{'Walk the hallway':'walk','Window study':'inspection'}});
add(explore,'slider','walkSpeed',{label:'Walking pace',min:1.5,max:6,step:.1});
add(explore,'slider','lookSensitivity',{label:'Mouse sensitivity',min:.25,max:2,step:.05});
add(explore,'slider','eyeHeight',{label:'Eye height',min:2.6,max:4,step:.01});
add(explore,'slider','walkFov',{label:'Field of view',min:45,max:80,step:1});
panel.button('Enter hallway',()=>{if(settings.viewMode!=='walk')setSettings({viewMode:'walk'});navigation.enter()});
function faceRoom(x,y,z){if(settings.viewMode!=='walk')setSettings({viewMode:'walk'});navigation.stop();walk.yaw=Math.atan2(x-walk.x,y-walk.y);walk.pitch=Math.atan2(z-ROOM.floor-settings.eyeHeight,Math.hypot(x-walk.x,y-walk.y));updateCamera();requestRender()}
panel.button('Face window',()=>faceRoom(1.1,0,8.3));
panel.button('Face back wall',()=>faceRoom(0,-21,8.0));
panel.button('Face left door',()=>faceRoom(-11.78,-10.5,7.1));
panel.button('Face right door',()=>faceRoom(11.73,-10.5,7.1));
panel.button('Reset position',()=>{navigation.stop();walk.reset();updateCamera();requestRender()});
panel.button('Room overview',()=>{if(settings.viewMode!=='walk')setSettings({viewMode:'walk'});navigation.stop();walk.x=6;walk.y=-4.9;walk.yaw=-2.68;walk.pitch=.11;updateCamera();requestRender()});
if(proof&&query.has('terraincheck')){
 const pose=(x,y,yaw,pitch)=>{if(settings.viewMode!=='walk')setSettings({viewMode:'walk'});navigation.stop();walk.x=x;walk.y=y;walk.yaw=yaw;walk.pitch=pitch;updateCamera();requestRender()};
 panel.button('Check right window',()=>pose(1.5,-2.2,.79,.08));
 panel.button('Check far right',()=>pose(-4,-2.2,1.04,.05));
 panel.button('Check left window',()=>pose(1.5,-2.2,-.75,.05));
 panel.button('Check far left',()=>pose(4,-2.2,-1.04,.05));
 panel.button('Check terrain edge',()=>{pose(1.5,-2.2,.86,.04);landscape.group.visible=!landscape.group.visible;requestRender()});
}
const light=panel.folder('Light & palette');
add(light,'slider','exposure',{label:'Exposure',min:-1,max:1,step:.01});
add(light,'slider','sun',{label:'Sun strength',min:0,max:5,step:.05});
add(light,'slider','fill',{label:'Cabin fill',min:0,max:2,step:.01});
add(light,'slider','hallFill',{label:'Hallway fill',min:0,max:.6,step:.01});
add(light,'slider','toonThreshold',{label:'Toon band threshold',min:.5,max:1.5,step:.01});
add(light,'color','roomTint',{label:'Room tint'});add(light,'color','terrainTint',{label:'Terrain tint'});add(light,'color','sky',{label:'Sky color'});
const detail=panel.folder('Surface & ink');
add(detail,'slider','texture',{label:'Geological texture',min:0,max:1.5,step:.01});
add(detail,'slider','ink',{label:'Ink brightness',min:.3,max:1.8,step:.01});
add(detail,'slider','contour',{label:'Contour reinforcement',min:0,max:2,step:.01});
add(detail,'slider','screen',{label:'Screen phosphor',min:.3,max:2,step:.01});
const framing=panel.folder('Window study');
add(framing,'slider','zoom',{label:'Camera zoom',min:.85,max:1.25,step:.005});
add(framing,'slider','panX',{label:'Camera horizontal',min:-1,max:1,step:.01});
add(framing,'slider','panY',{label:'Camera vertical',min:-.7,max:.7,step:.01});
add(framing,'toggle','matte',{label:'Cinematic matte'});
const quality=panel.folder('Image quality');
add(quality,'slider','resolution',{label:'Render scale',min:.5,max:1.5,step:.25});
add(quality,'select','samples',{label:'Refinement samples',options:{'Quick · 1':1,'Draft · 8':8,'Source study · 32':32,'Fine · 64':64}});
const interaction=panel.folder('Window study motion');
add(interaction,'toggle','interactive',{label:'Interactive view'});
add(interaction,'slider','parallax',{label:'Parallax travel',min:0,max:1.6,step:.05});
add(interaction,'slider','inspectZoom',{label:'Hold zoom',min:1,max:2,step:.05});
add(interaction,'slider','response',{label:'Motion softness',min:0,max:.4,step:.01});
function setSettings(values){for(const [k,v]of Object.entries(values)){if(!(k in defaults))throw Error('Unknown setting '+k);settings[k]=v}for(const c of controls)c.control.setValue(settings[c.key]);apply()}
function reset(){navigation.stop();walk.reset();inspection.cancel();motion.reset();setSettings(defaults)}
panel.button('Reset all',reset);
panel.button('Reset camera',()=>{navigation.stop();walk.reset();inspection.cancel();motion.reset();setSettings({zoom:1,panX:0,panY:0})});
panel.button('Copy JSON',async()=>{
 const text=JSON.stringify(payload(),null,2);let copied=false;
 try{await navigator.clipboard.writeText(text);copied=true}catch{
  const field=document.createElement('textarea');field.value=text;field.className='copy-fallback';panelEl.append(field);field.select();
  try{copied=document.execCommand('copy')}catch{}if(copied)field.remove();
 }
 status.textContent=copied?'Settings copied.':'Select and copy the settings below.';
});
panel.button('Save PNG',async()=>{if(!ready)return;while(!window.lilac.settled)await new Promise(requestAnimationFrame);const a=document.createElement('a');a.download='lilac-frontier.png';a.href=renderer.domElement.toDataURL('image/png');a.click()});
if(proof&&query.has('benchmark'))panel.button('Measure frame time',async()=>{status.textContent='Measuring this view…';const result=await window.lilac.benchmark(120);renderer.domElement.dataset.benchmark=JSON.stringify(result);status.textContent='Frame measurement complete.';requestRender()});
async function fetchOK(url){const response=await fetch(url);if(!response.ok)throw Error(`${url}: HTTP ${response.status}`);return response}
function rect(el){const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}}
window.lilac={ready:false,settings,payload,setSettings,reset,render,diagnostics:()=>({ready,three:THREE.REVISION,settings:{...settings},camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),projection:camera.projectionMatrix.toArray()},interaction:motion.snapshot(),refinement:{samples:sampleIndex,renderedFrames,scheduled},contourMasks:{moon:post.uniforms.uMoonMask.value.toArray(),window:post.uniforms.uWindowMask.value.toArray()},canvas:rect(renderer.domElement),viewport:rect(viewport),panel:rect(panelEl),panelClosed:panelEl.classList.contains('collapsed'),drawingBuffer:[renderer.domElement.width,renderer.domElement.height],render:{...renderer.info.render},memory:{...renderer.info.memory},geometry:manifest?.geometry,firstReadyMs:window.lilac.firstReadyMs}),
 async benchmark(count=60){
  const cpu=[],raf=[],gpu=[];const gl=renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),pending=[];let prev=performance.now();
  for(let i=0;i<count;i++){await new Promise(requestAnimationFrame);const now=performance.now();raf.push(now-prev);prev=now;const q=ext?gl.createQuery():null;if(q)gl.beginQuery(ext.TIME_ELAPSED_EXT,q);const t=performance.now();render();cpu.push(performance.now()-t);if(q){gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push(q)}}
  if(ext){for(let j=0;j<30&&pending.length;j++){await new Promise(requestAnimationFrame);for(let i=pending.length-1;i>=0;i--){const q=pending[i];if(gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)){if(!gl.getParameter(ext.GPU_DISJOINT_EXT))gpu.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);pending.splice(i,1)}}}}
  const stats=a=>{const s=a.slice(5).sort((a,b)=>a-b);return s.length?{meanMs:s.reduce((a,b)=>a+b,0)/s.length,medianMs:s[Math.floor(s.length/2)],p95Ms:s[Math.floor(s.length*.95)]}:null};const info=gl.getExtension('WEBGL_debug_renderer_info');
  return {frames:count,cpu:stats(cpu),raf:stats(raf),gpu:stats(gpu),renderer:info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),drawingBuffer:[target.width,target.height],...renderer.info.render};
 }};
try{
 manifest=await(await fetchOK(`${import.meta.env.BASE_URL}assets/scene.json`)).json();
 const packed=await(await fetchOK(`${import.meta.env.BASE_URL}assets/${manifest.geometry.url}`)).arrayBuffer();
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',packed)),v=>v.toString(16).padStart(2,'0')).join('');const compressed=new Uint8Array(packed)[0]===31&&new Uint8Array(packed)[1]===139;if(hash!==(compressed?manifest.geometry.sha256:manifest.geometry.decodedSha256))throw Error('Geometry revision checksum mismatch');
 const buffer=compressed?await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer():packed;if(buffer.byteLength!==manifest.geometry.decodedBytes)throw Error('Geometry payload length mismatch');
 status.textContent='Preparing materials…';
 baseCamera=new THREE.Matrix4().set(...manifest.camera.matrixWorldRows.flat());
 camera.near=manifest.camera.near;camera.far=manifest.camera.far;camera.aspect=16/9;sourceFov=THREE.MathUtils.radToDeg(2*Math.atan(1/manifest.camera.projectionMatrixRows[1][1]));camera.fov=sourceFov;camera.updateProjectionMatrix();
 const anchor=(u,v,depth)=>new THREE.Vector3((2*u-1)*depth/manifest.camera.projectionMatrixRows[0][0],(2*v-1)*depth/manifest.camera.projectionMatrixRows[1][1],-depth).applyMatrix4(baseCamera);
 maskAnchors={uMoonMask:[anchor(.734,.773,185),anchor(.763,.8235,185)],uWindowMask:[anchor(.544,.565,26),anchor(.876,.832,26)]};
 const sun=manifest.lights.find(l=>l.type==='SUN');shared.uSunDirection.value.set(sun.matrixWorldRows[0][2],sun.matrixWorldRows[1][2],sun.matrixWorldRows[2][2]);
 shadowCamera.position.copy(shared.uSunDirection.value).multiplyScalar(60).add(new THREE.Vector3(0,-3,7));shadowCamera.lookAt(0,-3,7);shadowCamera.updateMatrixWorld(true);
 const bias=new THREE.Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);shared.uShadowMatrix.value.copy(bias).multiply(shadowCamera.projectionMatrix).multiply(shadowCamera.matrixWorldInverse);
 for(const batch of manifest.geometry.batches){
  const array=new Float32Array(buffer,batch.vertexByteOffset,batch.vertexCount*9), interleaved=new THREE.InterleavedBuffer(array,9), geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.InterleavedBufferAttribute(interleaved,3,0));geometry.setAttribute('normal',new THREE.InterleavedBufferAttribute(interleaved,3,3));geometry.setAttribute('sourceCoord',new THREE.InterleavedBufferAttribute(interleaved,3,6));geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer,batch.indexByteOffset,batch.indexCount),1));geometry.computeBoundingSphere();
  const material=makeMaterial(batch.material,manifest.materials[batch.material],shared),mesh=new THREE.Mesh(geometry,material);mesh.name=batch.material+' / '+batch.region;mesh.userData.region=batch.region;materials.push({material,batch});meshes.push(mesh);
  material.uniforms.uRegion.value=batch.material==='Moon | pale pink'?-1:batch.region==='exterior'?0:1;
  if(batch.region==='matte'){geometry.applyMatrix4(baseCamera.clone().invert());camera.add(mesh)}else scene.add(mesh);
 }
 scene.add(camera);
 hallway=buildHallway(meshes,manifest.source.sha256);
 for(const part of hallway.batches){
  const material=part.customMaterial||makeMaterial(part.material,manifest.materials[part.material],shared),mesh=new THREE.Mesh(part.geometry,material);mesh.name='Hallway / '+part.material;mesh.userData.region='hallway';hallway.group.add(mesh);meshes.push(mesh);
  if(!part.customMaterial)materials.push({material,batch:{material:part.material,region:'hallway'}});
 }
 scene.add(hallway.group);
 landscape=buildLandscape(meshes);
 for(const part of landscape.batches){
  const material=makeMaterial(part.material,manifest.materials[part.material],shared),mesh=new THREE.Mesh(part.geometry,material);
  material.uniforms.uRegion.value=0;material.uniforms.uHorizon.value=1;
  mesh.name='Desert continuation / '+part.material;mesh.userData.region='exterior';landscape.group.add(mesh);meshes.push(mesh);materials.push({material,batch:{material:part.material,region:'exterior'}});
 }
 scene.add(landscape.group);
 apply();
 // Static key visibility is captured from the actual interior meshes, independent of source camera.
 for(const mesh of meshes)mesh.visible=mesh.userData.region==='interior';
 const background=scene.background;scene.background=null;scene.overrideMaterial=depthMaterial;renderer.setRenderTarget(shadowTarget);renderer.render(scene,shadowCamera);scene.overrideMaterial=null;scene.background=background;for(const mesh of meshes)mesh.visible=mesh.userData.region!=='matte'||(settings.matte&&settings.viewMode!=='walk');
 renderer.setRenderTarget(null);await renderer.compileAsync(scene,camera);ready=true;resize();window.lilac.ready=true;window.lilac.firstReadyMs=performance.now()-started;
 status.textContent=settings.viewMode==='walk'?'Click the scene to explore · WASD + mouse · Esc to release':settings.interactive?'Ready · move to explore, hold to inspect':'Ready · interactive view is off';
}catch(error){console.error(error);status.textContent='Could not load scene: '+error.message;window.lilac.error=error.message;if(panelEl.classList.contains('collapsed'))document.dispatchEvent(new KeyboardEvent('keydown',{code:'Backquote',bubbles:true}));}



