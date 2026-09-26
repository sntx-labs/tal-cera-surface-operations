import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {SOURCE_KIT_EXCLUSIONS,SOURCE_KIT_SHA256} from './hallway-source-parts.js';

const MAT={shell:'TOON | mauve enamel',panel:'TOON | pale violet panels',frame:'TOON | machined frame',floor:'TOON | lavender deck',warm:'TOON | warm reflected lintel',ink:'INK | deep aubergine',fine:'INK | secondary faded plum',blue:'DISPLAY | muted blue',ice:'DISPLAY | ice phosphor',dark:'DISPLAY | midnight blue',amber:'DISPLAY | amber',coral:'DISPLAY | muted coral',yellow:'DISPLAY | sulphur'};
const identity=new THREE.Matrix4();
const wallMatrix=(x,y,angle)=>new THREE.Matrix4().makeTranslation(x,y,0).multiply(new THREE.Matrix4().makeRotationZ(angle));
const left=wallMatrix(-11.78,0,Math.PI/2),right=wallMatrix(11.73,0,-Math.PI/2),back=wallMatrix(0,-21,Math.PI);

// Authored additions stay separate from the immutable Blender export.
export function buildHallway(sourceMeshes,sourceSHA256){
  if(sourceSHA256!==SOURCE_KIT_SHA256)throw Error('Hallway ornament metadata does not match this source revision');
  const group=new THREE.Group();group.name='Observation hallway — additive architecture';
  const batches=new Map(),labels=[],stats={pieces:0,reusedTriangles:0};
  let wall=identity;
  function add(geometry,material,matrix=wall){
    if(geometry.index){const old=geometry;geometry=geometry.toNonIndexed();old.dispose()}
    if(!geometry.getAttribute('sourceCoord'))geometry.setAttribute('sourceCoord',geometry.getAttribute('position').clone());
    if(!geometry.getAttribute('uv'))geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(geometry.getAttribute('position').count*2),2));
    geometry.applyMatrix4(matrix);geometry.clearGroups();
    for(const name of Object.keys(geometry.attributes))if(!['position','normal','sourceCoord','uv'].includes(name))geometry.deleteAttribute(name);
    if(!batches.has(material))batches.set(material,[]);batches.get(material).push(geometry);stats.pieces++;
  }
  function box(u,z,d,w,h,depth,material=MAT.panel){add(new THREE.BoxGeometry(w,depth,h).translate(u,-d,z),material)}
  function pipe(points,r=.035,material=MAT.frame){
    const p=points.map(([u,z,d])=>new THREE.Vector3(u,-d,z));
    for(let i=1;i<p.length;i++){
      const a=p[i-1],b=p[i],delta=b.clone().sub(a);if(delta.length()<1e-6)continue;
      const g=new THREE.CylinderGeometry(r,r,delta.length(),8,1);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize()));g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());add(g,material);
    }
    // Small elbows close the joints without a heavy curve tessellation.
    for(let i=1;i<p.length-1;i++)add(new THREE.SphereGeometry(r,8,6).translate(...p[i].toArray()),material);
  }
  function panel(u,z,w,h,d=.02,material=MAT.panel,cut=.12,depth=.12,outline=true){
    cut=Math.min(cut,w*.23,h*.23);
    const pts=[[-w/2+cut,-h/2],[w/2-cut,-h/2],[w/2,-h/2+cut],[w/2,h/2-cut],[w/2-cut,h/2],[-w/2+cut,h/2],[-w/2,h/2-cut],[-w/2,-h/2+cut]];
    const shape=new THREE.Shape(pts.map(p=>new THREE.Vector2(...p)));
    const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1,curveSegments:1});geometry.rotateX(Math.PI/2).translate(u,-d,z);add(geometry,material);
    if(outline)pipe([...pts,pts[0]].map(p=>[u+p[0],z+p[1],d+depth+.005]),.011,MAT.fine);
  }
  function bolt(u,z,d,r=.045){
    const g=new THREE.CylinderGeometry(r,r,.025,6).translate(u,-d,z);add(g,MAT.frame);
    pipe([[u-r*.45,z,d+.019],[u+r*.45,z,d+.019]],.009,MAT.ink);
  }
  function fasteners(u,z,w,h,d){for(const x of [-1,1])for(const y of [-1,1])bolt(u+x*(w/2-.14),z+y*(h/2-.14),d)}
  function vent(u,z,w,h,d=.25){
    panel(u,z,w+.18,h+.18,d,MAT.frame,.09,.09);box(u,z,d+.105,w,h,.045,MAT.ink);
    const n=Math.max(4,Math.floor(h/.115));
    for(let i=0;i<n;i++)box(u,z-h/2+(i+.5)*h/n,d+.155,w-.09,.035,.055,MAT.fine);
    fasteners(u,z,w+.18,h+.18,d+.2);
  }
  function screen(u,z,w=1.55,h=1.12,d=.26,variant=0){
    panel(u,z,w+.32,h+.35,d,MAT.frame,.13,.14);
    panel(u,z,w+.12,h+.14,d+.145,MAT.ink,.05,.04,false);
    box(u,z,d+.20,w,h,.025,MAT.dark);
    for(let i=0;i<7;i++)pipe([[u-w*.43,z-h*.39+i*h*.12,d+.22],[u+w*.43,z-h*.39+i*h*.12,d+.22]],.006,MAT.blue);
    for(let i=0;i<9;i++)pipe([[u-w*.43+i*w*.1,z-h*.39,d+.22],[u-w*.43+i*w*.1,z+h*.36,d+.22]],.005,MAT.blue);
    const wave=[];for(let i=0;i<21;i++)wave.push([u-w*.4+i*w*.04,z+Math.sin(i*.8+variant)*h*.18+Math.cos(i*1.5)*h*.07,d+.231]);pipe(wave,.009,MAT.ice);
    for(let i=0;i<4;i++){box(u+w*.33,z-h*.33+i*h*.12,d+.24,.07,.025,.016,i%2?MAT.amber:MAT.ice);box(u-w*.35,z+h*.34-i*.04,d+.24,w*.20,.009,.016,MAT.blue)}
    for(let i=0;i<5;i++)box(u-w*.3+i*w*.15,z-h*.5-.1,d+.24,.06,.04,.022,i===4?MAT.coral:MAT.frame);
  }
  function text(label,u,z,w,d=.35){labels.push({label,u,z,w,d,matrix:wall.clone()})}
  function circuit(u,z,w,h,d,seed=0){
    for(let i=0;i<7;i++){
      const x=u-w*.4+i*w*.125,y=z-h*.35+(i%3)*h*.17;
      pipe([[x,y,d],[x,y+h*.12,d],[x+.08,y+h*.12,d],[x+.08,y+h*.4,d],[x+w*.09,y+h*.4,d]],.008,MAT.fine);
      box(x+w*.09,y+h*.4,d+.013,.055,.036,.017,(i+seed)%5?MAT.frame:MAT.yellow);
    }
  }
  function utility(u,z=7.4,w=3.1,h=5.8,variant=0){
    panel(u,z,w,h,.08,MAT.shell,.22,.18);fasteners(u,z,w,h,.29);
    panel(u-.06,z+.6,w-.34,h*.48,.29,MAT.panel,.09,.08);
    screen(u-.12,z+1.25,w*.64,.95,.4,variant);
    vent(u,z-1.72,w*.75,.92,.31);
    panel(u,z-.58,w*.77,.67,.3,MAT.panel,.05,.12);circuit(u,z-.58,w*.6,.5,.45,variant);
    for(let j=0;j<3;j++){
      const x=u+w/2-.27-j*.13;
      pipe([[x,z-h*.4,.43],[x,z-.2,.43],[x-.2,z+.05,.43],[x-.2,z+2.3,.43]],.037,j===2?MAT.warm:MAT.frame);
      for(const y of [z-1.5,z+.2,z+1.9])box(x,y,.43,.19,.055,.13,MAT.frame);
    }
    text(variant%2?'THERMAL / 03':'AUX SYSTEMS',u-.24,z+2.52,w*.59,.32);
  }
  function door(u,id){
    panel(u,7.27,5.65,7.85,.055,MAT.frame,.45,.23);
    panel(u,6.94,4.86,6.87,.3,MAT.ink,.35,.09);
    for(const side of [-1,1]){
      const x=u+side*1.12;
      panel(x,6.96,2.19,6.58,.41,MAT.shell,.28,.14);
      panel(x,7.48,1.88,4.75,.56,MAT.panel,.2,.075);
      panel(x,4.65,1.75,.74,.56,MAT.frame,.09,.10);
      vent(x,4.66,1.4,.45,.67);
      pipe([[x-side*.62,5.42,.67],[x-side*.62,6.85,.67],[x-side*.34,7.13,.67],[x-side*.34,9.3,.67]],.017,MAT.fine);
      panel(x+side*.2,7.97,.72,1.46,.65,MAT.shell,.07,.045);fasteners(x+side*.2,7.97,.72,1.46,.71);
      vent(x+side*.2,8.22,.48,.46,.71);
      circuit(x+side*.16,6.38,.95,1.08,.66,side);
      for(let j=0;j<6;j++)box(x-side*.25,8.84-j*.095,.67,.25+(j%3)*.11,.014,.025,MAT.fine);
      for(const y of [5.7,9.12]){panel(x+side*.80,y,.16,.52,.64,MAT.frame,.025,.14);bolt(x+side*.80,y,.8,.042)}
      for(const y of [5.4,8.9])bolt(x+side*.67,y,.69,.06);
      pipe([[u+side*2.61,4.1,.51],[u+side*2.61,9.88,.51],[u+side*2.14,10.34,.51],[u+side*1.15,10.34,.51]],.075,MAT.frame);
      for(const z of [4.6,6.0,8.1,9.5])box(u+side*2.61,z,.51,.27,.13,.23,MAT.panel);
    }
    box(u,6.85,.60,.07,6.1,.08,MAT.ink);
    panel(u,10.46,3.75,.66,.34,MAT.panel,.11,.15);text(id,u,10.49,2.45,.51);
    box(u,10.05,.52,2.1,.035,.06,MAT.ice);
    screen(u+3.23,7.05,.48,.73,.2,2);text('ACCESS',u+3.24,7.62,.7,.23);
    panel(u,3.5,5.0,.20,.4,MAT.frame,.05,.65);
  }

  // Reuse actual front-wall machining, tubes, grilles and screens, retaining source coordinates.
  function sourceKit(kind){
    const bounds=kind==='left'?[-12.3,-7.15,-2.75,-.08,4.45,11.8]:[9.3,12.75,-2.75,-.08,4.55,11.85];
    const center=(bounds[0]+bounds[1])/2,kit=[];
    for(const mesh of sourceMeshes){
      if(mesh.userData.region!=='interior')continue;
      const g=mesh.geometry,p=g.getAttribute('position'),n=g.getAttribute('normal'),s=g.getAttribute('sourceCoord'),indices=g.index;
      const pos=[],norm=[],coords=[];
      const excludes=SOURCE_KIT_EXCLUSIONS[mesh.material.name]||[];
      for(let i=0;i<indices.count;i+=3){
        if(excludes.some(([start,count])=>i>=start&&i<start+count))continue;
        const ids=[indices.getX(i),indices.getX(i+1),indices.getX(i+2)];
        let polygon=ids.map(j=>[p.getX(j),p.getY(j),p.getZ(j),n.getX(j),n.getY(j),n.getZ(j),s.getX(j),s.getY(j),s.getZ(j)]);
        if([0,1,2].some(a=>polygon.every(v=>v[a]<bounds[a*2])||polygon.every(v=>v[a]>bounds[a*2+1])))continue;
        // Clip intersecting triangles instead of discarding their supporting panel faces.
        for(let a=0;a<3&&polygon.length;a++)for(const side of [0,1]){
          const plane=bounds[a*2+side],inside=v=>side?v[a]<=plane:v[a]>=plane,output=[];
          for(let j=0;j<polygon.length;j++){
            const va=polygon[j],vb=polygon[(j+1)%polygon.length],ia=inside(va),ib=inside(vb);
            if(ia)output.push(va);
            if(ia!==ib){const t=(plane-va[a])/(vb[a]-va[a]);output.push(va.map((value,k)=>value+(vb[k]-value)*t))}
          }
          polygon=output;
        }
        for(let j=1;j<polygon.length-1;j++)for(const v of [polygon[0],polygon[j],polygon[j+1]]){
          pos.push(v[0]-center,v[1]*.45,v[2]);
          const normal=new THREE.Vector3(v[3],v[4]/.45,v[5]).normalize();norm.push(...normal.toArray());coords.push(...v.slice(6));
        }
      }
      if(!pos.length)continue;
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));geometry.setAttribute('sourceCoord',new THREE.Float32BufferAttribute(coords,3));kit.push({geometry,material:mesh.material.name});
    }
    return kit;
  }
  const kits={left:sourceKit('left'),right:sourceKit('right')};
  function reuse(kind,u){
    const w=kind==='left'?5.15:3.45;
    panel(u,8.125,w+.23,7.65,-.08,MAT.shell,.10,.09);
    for(const side of [-1,1])box(u+side*(w/2+.045),8.125,.14,.13,7.65,.16,MAT.frame);
    for(const z of [4.32,11.94])box(u,z,.14,w+.25,.13,.16,MAT.frame);
    for(const part of kits[kind]){stats.reusedTriangles+=part.geometry.getAttribute('position').count/3;add(part.geometry.clone().translate(u,0,0),part.material)}
  }

  // Continuous inner wall skins and framing, with service bays on either side of each door.
  for(const [matrix,sign] of [[left,-1],[right,1]]){
    wall=matrix;
    box(sign*10.5,8.22,-.10,21,9.85,.20,MAT.shell);
    for(let i=0;i<7;i++){
      const u=sign*(1.5+i*3);
      panel(u,11.88,2.92,1.82,.035,i%3===1?MAT.panel:MAT.shell,.10,.10);fasteners(u,11.88,2.92,1.82,.155);
      vent(u,12.0,1.85,.47,.17);
      panel(u,3.84,2.9,.94,.04,MAT.panel,.08,.14);
      for(let j=0;j<3;j++)box(u-.7+j*.7,3.9,.20,.33,.035,.026,MAT.fine);
    }
    reuse(sign<0?'right':'left',sign*3.1);
    door(sign*10.5,sign<0?'02 / HABITAT':'03 / SERVICE');
    utility(sign*17.55,7.35,3.05,5.9,sign<0?2:3);
    for(const d of [.42,.59,.77]){
      pipe([[sign*.1,11.02,d],[sign*5.9,11.02,d],[sign*6.5,10.62,d],[sign*7.35,10.62,d]],.043,MAT.frame);
      pipe([[sign*13.4,10.92,d],[sign*14.3,11.22,d],[sign*20.6,11.22,d]],.043,MAT.frame);
    }
    for(const u of [sign*6.0,sign*14.5,sign*20.4]){
      panel(u,7.95,.55,8.8,.3,MAT.frame,.09,.28);
      for(let z=4.4;z<11;z+=1.25)panel(u,z,.7,.23,.59,MAT.panel,.045,.05);
    }
    for(let i=0;i<12;i++){
      const u=sign*(.7+i*1.75);if(Math.abs(u)>7&&Math.abs(u)<14)continue;
      panel(u,5.4,.62,.6,.10,MAT.frame,.035,.09);circuit(u,5.4,.5,.5,.205,i);
    }
  }

  // Opposing equipment wall: salvaged source modules flank a new environmental manifold.
  wall=back;box(0,8.2,-.12,23.5,9.9,.24,MAT.shell);
  reuse('left',-7.95);reuse('right',8.05);
  for(const u of [-11.1,-4.6,4.55,11.1]){panel(u,8.0,.43,8.9,.15,MAT.frame,.08,.35);for(let z=4.1;z<12;z+=1.15)bolt(u,z,.54,.065)}
  panel(0,8.48,8.2,6.7,.08,MAT.frame,.40,.23);
  panel(0,8.56,7.54,6.12,.32,MAT.shell,.32,.11);
  panel(0,10.97,6.3,.68,.44,MAT.panel,.10,.11);text('ENVIRONMENT / BAY 04',0,10.98,4.6,.58);
  for(const side of [-1,1]){
    panel(side*2.62,8.08,1.65,4.64,.5,MAT.panel,.14,.16);
    vent(side*2.62,8.88,1.22,1.37,.70);vent(side*2.62,6.85,1.22,1.15,.70);
    for(let i=0;i<3;i++)pipe([[side*(3.85+i*.13),4.2,.64],[side*(3.85+i*.13),9.75,.64],[side*(3.45+i*.13),10.18,.64],[side*1.43,10.18,.64]],.045,MAT.frame);
  }
  // Concentric air-handler rings, physical radial blades, fasteners, and plumbing.
  for(const [r,t,d,m] of [[1.73,.11,.57,MAT.frame],[1.52,.05,.66,MAT.panel],[1.42,.05,.73,MAT.ink],[.57,.06,.86,MAT.frame]]){
    const g=new THREE.TorusGeometry(r,t,8,64).rotateX(Math.PI/2).translate(0,-d,8.12);add(g,m);
  }
  const disc=new THREE.CylinderGeometry(1.42,1.42,.07,48).translate(0,-.73,8.12);add(disc,MAT.ink);
  // Cylinder's native axis is Y: rings lie in XZ, as do the blades.
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6;
    pipe([[Math.sin(a)*.58,8.12+Math.cos(a)*.58,.84],[Math.sin(a+.22)*1.29,8.12+Math.cos(a+.22)*1.29,.80]],.083,MAT.fine);
    bolt(Math.sin(a)*1.63,8.12+Math.cos(a)*1.63,.76,.068);
  }
  const hub=new THREE.CylinderGeometry(.44,.44,.20,24).translate(0,-.88,8.12);add(hub,MAT.frame);
  text('CIRCULATION',0,6.18,1.9,.48);box(0,5.88,.5,.08,.08,.025,MAT.yellow);
  for(const side of [-1,1]){
    panel(side*.95,5.82,.95,.38,.45,MAT.panel,.04,.06);circuit(side*.95,5.82,.7,.25,.53,1);
    panel(side*1.6,10.18,.56,.63,.46,MAT.panel,.04,.06);vent(side*1.6,10.2,.34,.30,.53);
    pipe([[side*.38,9.89,.56],[side*.38,10.39,.56],[side*.78,10.65,.56],[side*1.4,10.65,.56]],.019,MAT.fine);
    for(let i=0;i<6;i++){bolt(side*(1.94+i*.26),5.4,.47,.035);box(side*(2.3+i*.17),10.5,.47,.06,.12,.025,i===2?MAT.amber:MAT.fine)}
  }
  for(let i=0;i<40;i++){
    const angle=i*Math.PI/20;
    pipe([[Math.sin(angle)*1.82,8.12+Math.cos(angle)*1.82,.57],[Math.sin(angle)*(i%5===0?1.94:1.89),8.12+Math.cos(angle)*(i%5===0?1.94:1.89),.57]],.009,MAT.fine);
  }
  panel(0,8.12,.47,.31,1.0,MAT.shell,.035,.035);text('04',0,8.12,.24,1.04);
  panel(0,4.55,5.95,2.35,.09,MAT.frame,.18,1.17);panel(0,4.65,5.54,1.89,1.27,MAT.shell,.12,.10);
  screen(-1.53,4.94,1.7,.95,1.38,1);screen(.70,4.94,1.48,.95,1.38,4);
  vent(2.22,4.81,.55,1.12,1.43);text('LIFE SUPPORT / 04',-.3,3.97,2.9,1.40);
  for(let j=0;j<6;j++){panel(-9.95+j*4.0,12.1,3.88,1.27,.07,MAT.panel,.12,.14);vent(-9.95+j*4.0,12.18,2.75,.40,.24)}
  for(const z of [11.20,11.4,11.59])pipe([[-11.6,z,.55],[-4.8,z,.55],[-4.3,z+.2,.55],[4.3,z+.2,.55],[4.8,z,.55],[11.6,z,.55]],.047,MAT.frame);

  // Floor continuation. New plating meets the exported deck behind its existing edge.
  wall=identity;
  add(new THREE.BoxGeometry(23.5,5.25,.20).translate(0,-18.39,3.23),MAT.floor);
  const deckMatrix=new THREE.Matrix4().makeRotationX(-Math.PI/2);
  for(let row=0;row<2;row++)for(let col=0;col<6;col++){
    wall=new THREE.Matrix4().makeTranslation(-9.75+col*3.9,-16.97-row*2.60,3.335).multiply(deckMatrix);
    panel(0,0,3.86,2.54,0,MAT.floor,.22,.018);fasteners(0,0,3.86,2.54,.039);
    box(.25,.66,.036,.54,.04,.03,MAT.fine);
  }
  // Ceiling cassette grid and transverse structural frames complete every upward view.
  wall=identity;add(new THREE.BoxGeometry(23.65,21.3,.2).translate(0,-10.55,13.14),MAT.shell);
  const ceilingMatrix=new THREE.Matrix4().makeRotationX(Math.PI/2);
  for(let row=0;row<6;row++)for(let col=0;col<5;col++){
    wall=new THREE.Matrix4().makeTranslation(-9.36+col*4.68,-1.78-row*3.48,13.025).multiply(ceilingMatrix);
    panel(0,0,4.57,3.34,.02,(col+row)%4===0?MAT.panel:MAT.shell,.18,.075);fasteners(0,0,4.57,3.34,.11);
    if(col===1||col===3){panel(0,0,2.65,.63,.11,MAT.frame,.1,.07);box(0,0,.20,2.32,.14,.04,MAT.ice)}
    else vent(0,0,2.9,.6,.12);
    circuit(-.62,.98,2.1,.43,.105,row+col);
    for(let k=0;k<3;k++)panel(1.45,-.74+k*.27,.38,.16,.11,MAT.frame,.025,.03);
  }
  for(const y of [-6.45,-13.1,-20.45]){
    wall=wallMatrix(0,y,0);panel(0,12.69,23.2,.46,.08,MAT.frame,.1,.35);
    for(const x of [-10.92,10.87]){panel(x,11.96,.52,1.8,.1,MAT.frame,.16,.43);panel(x,11.17,.83,.43,.11,MAT.panel,.08,.46)}
  }
  wall=identity;

  // One atlas for physical machine legends. No screen-space text or reference images.
  const atlas=document.createElement('canvas');atlas.width=1024;atlas.height=512;
  const ctx=atlas.getContext('2d');ctx.fillStyle='#393041';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 27px monospace';
  const unique=[...new Set(labels.map(l=>l.label))];for(let i=0;i<unique.length;i++)ctx.fillText(unique[i],512,i*48+24,980);
  const texture=new THREE.CanvasTexture(atlas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  const labelMaterial=new THREE.MeshBasicMaterial({name:'Hallway equipment legends',map:texture,alphaTest:.35,side:THREE.DoubleSide});
  for(const label of labels){
    const row=unique.indexOf(label.label),g=new THREE.PlaneGeometry(label.w,label.w*.085);g.rotateX(Math.PI/2).translate(label.u,-label.d,label.z);
    const uv=g.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setY(i,1-(row*48+(1-uv.getY(i))*48)/512);
    add(g,'__labels',label.matrix);
  }
  for(const kit of Object.values(kits))for(const part of kit)part.geometry.dispose();
  const result=[];
  for(const [material,geometries] of batches){
    const geometry=mergeGeometries(geometries,false);geometry.computeBoundingSphere();for(const g of geometries)g.dispose();
    result.push({geometry,material,customMaterial:material==='__labels'?labelMaterial:null});
  }
  stats.triangles=result.reduce((n,b)=>n+b.geometry.getAttribute('position').count/3,0);stats.batches=result.length;stats.labelCount=labels.length;
  return {group,batches:result,stats};
}
