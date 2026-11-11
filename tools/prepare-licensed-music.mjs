/**
 * Prepare legally redistributable game-ready Ogg/Opus music during CI.
 * Assets are staged into assets/audio/music/ before tests and Pages packaging.
 * The official source URLs and licenses are recorded in licensed-music-manifest.json.
 */
import {readFile,stat,mkdir,mkdtemp,rm,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const outputDir=join(root,'assets/audio/music');
const manifest=JSON.parse(await readFile(join(root,'tools/licensed-music-manifest.json'),'utf8'));
const allowed=new Set(['www.scottbuckley.com.au','opengameart.org']);
const cached=async(path)=>{
  try{
    const bytes=await readFile(path);
    return bytes.length>100000&&bytes.subarray(0,4).toString('ascii')==='OggS';
  }catch{return false;}
};
function run(program,args){
  execFileSync(program,args,{stdio:'inherit',timeout:240000});
}
await mkdir(outputDir,{recursive:true});
const work=await mkdtemp(join(tmpdir(),'survivor-licensed-music-'));
try{
  for(const item of manifest.tracks){
    if(!['CC0','CC BY 4.0'].includes(item.license))throw Error('Unapproved license: '+item.id);
    if(!allowed.has(new URL(item.url).hostname)||new URL(item.url).protocol!=='https:')throw Error('Unapproved source host: '+item.id);
    if(!/^[a-z0-9][a-z0-9-]*\.ogg$/.test(item.file))throw Error('Bad output filename: '+item.file);
    const dest=join(outputDir,item.file);
    if(await cached(dest)){console.log('CACHED',item.id);continue;}
    const input=join(work,item.id+'.source');
    const encoded=join(work,item.id+'.ogg');
    console.log('FETCH',item.id,item.source);
    run('curl',['--fail','--location','--show-error','--silent','--retry','3','--retry-delay','3','--connect-timeout','20','--max-time','180','--user-agent','SurvivorGame/1.0 (+https://github.com/vesninsergeybk-afk/survival-open)','--output',input,item.url]);
    const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json',input],{encoding:'utf8',timeout:30000}));
    const seconds=Number(probe.format?.duration);
    if(!Number.isFinite(seconds)||seconds<18||seconds>1800)throw Error('Invalid audio duration for '+item.id+': '+seconds);
    run('ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-y','-i',input,'-map','0:a:0','-vn','-ac','2','-ar','48000','-c:a','libopus','-b:a','96k','-vbr','on','-map_metadata','-1',encoded]);
    if(!(await cached(encoded)))throw Error('Invalid Ogg/Opus audio: '+item.id);
    await rename(encoded,dest);
    console.log('READY',item.id,Math.round((await stat(dest)).size/1024)+'KiB',Math.round(seconds)+'s');
    await rm(input,{force:true});
  }
  console.log('Prepared',manifest.tracks.length,'licensed tracks');
}finally{await rm(work,{recursive:true,force:true});}
