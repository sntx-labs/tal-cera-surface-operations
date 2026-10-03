import * as THREE from 'three';
import noise from './blender-noise.glsl?raw';

const f=x=>Number(x).toFixed(9);
const v=x=>`vec3(${x.slice(0,3).map(f).join(',')})`;
export function compileGraph(graph) {
  const nodes=new Map(graph.nodes.map(n=>[n.name,n])), cache=new Map(), code=[];
  const as=(value,type)=>value.type===type?value.code:type==='vec3'?`vec3(${value.code})`:`dot(${value.code},vec3(0.333333333))`;
  function input(n,i,type) {
    const link=graph.links.find(l=>l[3]===n.name&&l[4]===i);
    if(link)return as(output(link[0],link[2]),type);
    const value=n.inputs[i].value;
    return type==='vec3'?Array.isArray(value)?v(value):`vec3(${f(value)})`:f(value);
  }
  function output(name,socket) {
    const key=name+socket;if(cache.has(key))return cache.get(key);
    const n=nodes.get(name);let exp,type='vec3';
    const I=(i,t='vec3')=>input(n,i,t);
    switch(n.type) {
      case 'ShaderNodeTexCoord':exp='vCoord';break;
      case 'ShaderNodeShaderToRGB':type='float';exp='lightValue';break;
      case 'ShaderNodeEmission':exp=`${I(0)}*${I(1,'float')}`;break;
      case 'ShaderNodeVectorMath':
        if(n.properties.operation!=='MULTIPLY')throw Error('Unsupported vector operation');
        exp=`${I(0)}*${I(1)}`;break;
      case 'ShaderNodeTexNoise':{
        if(n.properties.noise_dimensions!=='3D'||n.properties.noise_type!=='FBM'||n.inputs[8].value!==0)throw Error('Unsupported noise');
        type='float';const linked=graph.links.some(l=>l[3]===name&&l[4]===0);
        exp=`blenderNoise(${linked?I(0):'vCoord'}*${I(2,'float')},${I(3,'float')},${I(4,'float')},${I(5,'float')})`;break;
      }
      case 'ShaderNodeValToRGB':{
        const fac=I(0,'float'),els=n.ramp.elements;exp=v(els[0][1]);
        for(let i=1;i<els.length;i++){
          const amount=n.ramp.interpolation==='CONSTANT'?`step(${f(els[i][0])},${fac})`:`clamp((${fac}-${f(els[i-1][0])})/${f(els[i][0]-els[i-1][0])},0.0,1.0)`;
          exp=`mix(${exp},${v(els[i][1])},${amount})`;
        }break;
      }
      case 'ShaderNodeMixRGB':
        if(n.properties.blend_type!=='MULTIPLY')throw Error('Unsupported mix');
        exp=`${I(1)}*mix(vec3(1.0),${I(2)},clamp(${I(0,'float')}*uTexture,0.0,1.0))`;break;
      case 'ShaderNodeMath':
        if(n.properties.operation!=='MULTIPLY')throw Error('Unsupported math');
        type='float';exp=`${I(0,'float')}*${I(1,'float')}`;break;
      default:throw Error(`Unsupported node ${n.type}`);
    }
    const variable=`node${cache.size}`;code.push(`${type} ${variable}=${exp};`);
    const result={code:variable,type};cache.set(key,result);return result;
  }
  const out=graph.nodes.find(n=>n.type==='ShaderNodeOutputMaterial');
  const result=input(out,0,'vec3');return `${code.join('\n')}\nvec3 surface=${result};`;
}

export const vertexShader=`
attribute vec3 sourceCoord;
varying vec3 vCoord,vWorld,vNormal;
void main(){vCoord=sourceCoord;vWorld=(modelMatrix*vec4(position,1.0)).xyz;vNormal=mat3(modelMatrix)*normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;

export function makeMaterial(name,graph,shared) {
  const toon=name.startsWith('TOON'),ink=name.startsWith('INK'),display=name.startsWith('DISPLAY'),matte=name==='Letterbox black';
  return new THREE.ShaderMaterial({name,side:THREE.DoubleSide, uniforms:{...shared,
    uTint:{value:new THREE.Color(1,1,1)},uTexture:{value:1},uCategoryGain:{value:1},uRegion:{value:1},uHallFill:{value:0},uHorizon:{value:0},uHorizonColor:{value:new THREE.Color()}},vertexShader,
    fragmentShader:`
    precision highp int;
    varying vec3 vCoord,vWorld,vNormal;
    uniform sampler2D uShadow;
    uniform mat4 uShadowMatrix;
    uniform vec3 uSunDirection,uTint,uWorld,uHorizonColor;
    uniform float uSun,uFill,uThreshold,uTexture,uCategoryGain,uRegion,uHallFill,uHorizon;
    ${graph.nodes.some(n=>n.type==='ShaderNodeTexNoise')?noise:''}
    float visibility(){
      vec4 sc=uShadowMatrix*vec4(vWorld+normalize(vNormal)*.012,1.0);vec3 q=sc.xyz/sc.w;
      if(any(lessThan(q,vec3(0.0)))||any(greaterThan(q,vec3(1.0))))return 1.0;
      float lit=0.0;
      for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)lit+=step(q.z-.00003,textureLod(uShadow,q.xy+vec2(float(x),float(y))/4096.0,0.0).r);
      return lit/9.0;
    }
    float diskFill(vec3 p,vec3 n){
      if(p.y>30.0)return 0.0;
      float value=0.0;
      for(int i=0;i<32;i++){
        float radius=9.0*sqrt((float(i)+.5)/32.0),angle=float(i)*2.39996323;
        vec3 lightPoint=vec3(radius*cos(angle),-10.0+radius*sin(angle)*.28734776,10.0+radius*sin(angle)*.95782632);
        vec3 delta=lightPoint-p;float d2=dot(delta,delta);vec3 direction=delta*inversesqrt(d2);
        value+=max(0.0,dot(n,direction))*max(0.0,dot(-direction,vec3(0.0,.95782632,-.28734776)))/d2;
      }
      return value*(.8*450.0/(3.14159265*3.14159265*32.0));
    }
    void main(){
      vec3 n=normalize(vNormal)*(gl_FrontFacing?1.0:-1.0);
      float lightValue=(dot(.8*uWorld,vec3(.2126,.7152,.0722))+.8*uSun*max(0.0,dot(n,uSunDirection))*visibility()/3.14159265+uFill*diskFill(vWorld,n)+uHallFill*(.65+.35*max(0.0,dot(n,normalize(vec3(.3,-.6,.7))))))/uThreshold;
      ${compileGraph(graph)}
      vec3 color=surface*uTint*uCategoryGain;
      if(uHorizon>.5)color=mix(color,uHorizonColor,smoothstep(900.0,1800.0,distance(cameraPosition,vWorld)));
      gl_FragColor=vec4(color,uRegion);
    }`, userData:{toon,ink,display,matte}});
}


