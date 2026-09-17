import {defineConfig} from 'vite';
import {readFile,readdir} from 'node:fs/promises';

// Ship editable sources and third-party notices alongside the compiled scene.
const sourceDistribution={name:'source-distribution',async generateBundle(){
  const emit=async(source,destination)=>this.emitFile({type:'asset',fileName:destination,source:await readFile(new URL(source,import.meta.url))});
  for(const name of await readdir(new URL('./src/',import.meta.url)))await emit(`./src/${name}`,`source/lilac-frontier/src/${name}`);
  for(const name of ['index.html','package.json','package-lock.json','vite.config.js','THIRD_PARTY.md'])await emit(`./${name}`,`source/lilac-frontier/${name}`);
  for(const name of ['sh-panel.js','sh-panel.css'])await emit(`../infrastructure/sh-panel/${name}`,`source/infrastructure/sh-panel/${name}`);
}};
export default defineConfig({base:'./',plugins:[sourceDistribution],build:{target:'es2022',rollupOptions:{output:{manualChunks:{three:['three']}}}},server:{fs:{allow:['..']}}});
