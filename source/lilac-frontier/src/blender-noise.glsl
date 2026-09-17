/* SPDX-FileCopyrightText: 2019-2023 Blender Authors
 * SPDX-License-Identifier: GPL-2.0-or-later
 * WebGL2 adaptation of Blender 5.0.1's 3D Jenkins/Perlin/normalized fBM.
 * See THIRD_PARTY.md. Only the source scene's undistorted 3D fBM is needed.
 */
uint rotl(uint x, uint k) { return (x << k) | (x >> (32u-k)); }
uint hash3(ivec3 p) {
  uint a=0xdeadbeefu+25u+uint(p.x), b=0xdeadbeefu+25u+uint(p.y), c=0xdeadbeefu+25u+uint(p.z);
  c^=b;c-=rotl(b,14u);a^=c;a-=rotl(c,11u);b^=a;b-=rotl(a,25u);
  c^=b;c-=rotl(b,16u);a^=c;a-=rotl(c,4u);b^=a;b-=rotl(a,14u);c^=b;c-=rotl(b,24u);return c;
}
float grad3(ivec3 i,vec3 p) {
  uint h=hash3(i)&15u;
  float u=h<8u?p.x:p.y, v=h<4u?p.y:((h==12u||h==14u)?p.x:p.z);
  return ((h&1u)!=0u?-u:u)+((h&2u)!=0u?-v:v);
}
float perlin(vec3 p) {
  ivec3 i=ivec3(floor(p));vec3 f=fract(p), t=f*f*f*(f*(f*6.0-15.0)+10.0);
  float a=grad3(i,f),b=grad3(i+ivec3(1,0,0),f-vec3(1,0,0));
  float c=grad3(i+ivec3(0,1,0),f-vec3(0,1,0)),d=grad3(i+ivec3(1,1,0),f-vec3(1,1,0));
  float e=grad3(i+ivec3(0,0,1),f-vec3(0,0,1)),g=grad3(i+ivec3(1,0,1),f-vec3(1,0,1));
  float h=grad3(i+ivec3(0,1,1),f-vec3(0,1,1)),j=grad3(i+ivec3(1,1,1),f-vec3(1,1,1));
  return .982*mix(mix(mix(a,b,t.x),mix(c,d,t.x),t.y),mix(mix(e,g,t.x),mix(h,j,t.x),t.y),t.z);
}
float blenderNoise(vec3 p,float detail,float rough,float lac) {
  float sum=0.0,amp=1.0,total=0.0;
  for(int i=0;i<9;i++){if(i>int(detail))break;sum+=amp*perlin(p);total+=amp;amp*=rough;p*=lac;}
  float extra=fract(detail);
  return mix(.5*sum/total+.5,.5*(sum+amp*perlin(p))/(total+amp)+.5,extra);
}
