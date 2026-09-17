import * as THREE from 'three';

const smooth=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const wave=(x,y)=>Math.sin(x*.071+y*.083)*.48+Math.sin(x*.137-y*.049)*.27+Math.sin(x*.319+y*.217)*.14+Math.sin(x*.811-y*.393)*.06;

// Read the real source boundary, including its irregular row spacing and normals.
// No source vertex or source binary is changed by this addition.
export function terrainBoundary(mesh,side=1){
  const p=mesh.geometry.getAttribute('position'),n=mesh.geometry.getAttribute('normal');
  let x=-side*Infinity;for(let i=0;i<p.count;i++)x=side>0?Math.max(x,p.getX(i)):Math.min(x,p.getX(i));
  const points=new Map();
  for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i)-x)<.0001){
    const y=p.getY(i);let row=points.get(y);
    if(!row){row={x,y,z:p.getZ(i),normal:new THREE.Vector3(),count:0};points.set(y,row)}
    row.normal.add(new THREE.Vector3(n.getX(i),n.getY(i),n.getZ(i)));row.count++;
  }
  const rows=[...points.values()].sort((a,b)=>a.y-b.y);for(const row of rows)row.normal.normalize();
  if(rows.length<100)throw Error('Expected the source terrain boundary, not an unrelated mesh');
  return {x,rows};
}

function sample(rows,y){
  if(y<=rows[0].y)return rows[0].z;
  if(y>=rows.at(-1).y)return rows.at(-1).z;
  let lo=0,hi=rows.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(rows[m].y<=y)lo=m;else hi=m}
  const a=rows[lo],b=rows[hi];return THREE.MathUtils.lerp(a.z,b.z,(y-a.y)/(b.y-a.y));
}

function columns(start,end){
  const xs=[start],side=Math.sign(end-start);let x=start;
  while(side*(end-x)>0){const d=Math.abs(x-start),next=x+side*(d<160?1.15:d<480?2.8:d<950?6:15);x=side>0?Math.min(end,next):Math.max(end,next);xs.push(x)}
  return xs;
}

function grid(xs,ys,point,edge){
  const positions=[],indices=[];
  for(const x of xs)for(const y of ys)positions.push(...point(x,y));
  const h=ys.length;
  for(let c=0;c<xs.length-1;c++)for(let r=0;r<h-1;r++){
    const a=c*h+r,b=a+h;
    if(xs[1]>xs[0])indices.push(a,b,a+1,b,b+1,a+1);
    else indices.push(a,a+1,b,b,a+1,b+1);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('sourceCoord',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  if(edge){const normals=geometry.getAttribute('normal');for(let i=0;i<edge.length;i++)normals.setXYZ(i,edge[i].normal.x,edge[i].normal.y,edge[i].normal.z)}
  geometry.computeBoundingSphere();return geometry;
}

function buildSide(sourceMeshes,side){
  const find=name=>sourceMeshes.find(m=>m.userData.region==='exterior'&&m.material.name===name);
  const ridge=terrainBoundary(find('TOON | rose canyon'),side),basin=terrainBoundary(find('TOON | salt basin'),side);
  const end=2200,base=6.65;
  const bend=x=>{const d=(x-ridge.x)*side;return smooth(0,35,d)*(d*.14+8*Math.sin(d/67)+3*Math.sin(d/21))};
  const ridgePoint=(x,y)=>{
    const d=(x-ridge.x)*side,join=smooth(0,28,d);
    const amp=1+join*(.14*Math.sin(d/29)-.12*Math.sin(d/71)+.06*Math.sin(d/8));
    const height=sample(ridge.rows,y)-base;
    const detail=join*smooth(1,12,height)*(2.2*wave(x,y)+.7*Math.sin(x*.43+y*.29));
    // A rolling continuation of the existing broad mesa, gradually receding inland.
    return [x,y+bend(x),base+Math.max(0,height*amp+detail)];
  };
  const ridgeGeometry=grid(columns(ridge.x,side*end),ridge.rows.map(p=>p.y),ridgePoint,ridge.rows);
  const plainYs=basin.rows.map(p=>p.y);for(let y=plainYs.at(-1)+3;y<end;y+=y<400?3:15)plainYs.push(y);plainYs.push(end);
  const plainPoint=(x,y)=>{
    const d=(x-basin.x)*side,join=smooth(0,30,d),source=sample(basin.rows,y);
    // Low wind-cut ripples leave the foreground legible as a broad salt/desert plain.
    const height=source+join*(.30*wave(x*.42,y*.47)+.10*Math.sin(x*.06+y*.17));
    return [x,y,height];
  };
  const plainGeometry=grid(columns(basin.x,side*end),plainYs,plainPoint,basin.rows);
  const batches=[{material:'TOON | rose canyon',geometry:ridgeGeometry},{material:'TOON | salt basin',geometry:plainGeometry}];

  // Discontinuous fine strata on the new ridge use the source ink material.
  const inkPositions=[],inkIndices=[];
  let seed=side>0?7139:104729;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  const ribbon=(points,width)=>{
    const first=inkPositions.length/3;
    for(const [x,y]of points){for(const side of [-1,1]){const p=ridgePoint(x,y+side*width);p[2]+=.065;inkPositions.push(...p)}}
    for(let i=0;i<points.length-1;i++){const a=first+i*2;if(side>0)inkIndices.push(a,a+2,a+1,a+1,a+2,a+3);else inkIndices.push(a,a+1,a+2,a+1,a+3,a+2)}
  };
  for(let i=0;i<220;i++){
    const x=ridge.x+side*2+side*random()*650,y=151+random()*53,length=3+random()*19,points=[];
    for(let j=0;j<=18;j++){const xx=x+side*length*j/18;points.push([xx,y+.3*Math.sin(xx*.22+i)])}
    ribbon(points,.022+random()*.026);
  }
  const ink=new THREE.BufferGeometry();ink.setAttribute('position',new THREE.Float32BufferAttribute(inkPositions,3));ink.setAttribute('sourceCoord',new THREE.Float32BufferAttribute(inkPositions,3));ink.setIndex(inkIndices);ink.computeVertexNormals();ink.computeBoundingSphere();
  batches.push({material:'INK | layered lilac erosion',geometry:ink});
  const stats={batches:batches.length,triangles:batches.reduce((sum,b)=>sum+b.geometry.index.count/3,0),attributeBytes:batches.reduce((sum,b)=>sum+Object.values(b.geometry.attributes).reduce((s,a)=>s+a.array.byteLength,0)+b.geometry.index.array.byteLength,0),ridgeStartX:ridge.x,plainStartX:basin.x,extent:end,ridgeSeamVertices:ridge.rows.length,plainSeamVertices:basin.rows.length};
  return {batches,stats,ridge,basin};
}

export function buildLandscape(sourceMeshes){
  const right=buildSide(sourceMeshes,1),left=buildSide(sourceMeshes,-1);
  const group=new THREE.Group();group.name='Desert and ridge continuations';
  const batches=[...right.batches,...left.batches];
  const stats={batches:batches.length,triangles:right.stats.triangles+left.stats.triangles,attributeBytes:right.stats.attributeBytes+left.stats.attributeBytes,extent:2200,sides:{right:right.stats,left:left.stats}};
  return {group,batches,stats,sides:{right,left}};
}
