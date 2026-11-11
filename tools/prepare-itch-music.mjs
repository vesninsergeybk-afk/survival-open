/**
 * Download the explicitly selected FREE OGG uploads from the author's itch.io
 * asset pages. No paid content, no API keys, no scraping guessed CDN URLs.
 * The /download_url -> /file/<uploadId> flow follows the public itch page.
 */
import {readFile,mkdir,mkdtemp,rm,rename,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=join(root,'assets/audio/music');
const manifest=JSON.parse(await readFile(join(root,'tools/itch-music-manifest.json'),'utf8'));
const agent='Mozilla/5.0 (compatible; SurvivorGameMusic/1.0; +https://github.com/vesninsergeybk-afk/survival-open)';
const work=await mkdtemp(join(tmpdir(),'survivor-itch-'));
const cookies=(res)=>typeof res.headers.getSetCookie==='function'
  ? res.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ')
  : (res.headers.get('set-cookie')||'').split(';')[0];
const mergeCookies=(a,b)=>{
  const pairs=new Map();
  for(const p of (a+'; '+b).split(';').map(v=>v.trim()).filter(v=>v.includes('='))){
    const i=p.indexOf('=');pairs.set(p.slice(0,i),p.slice(i+1));
  }
  return [...pairs].map(([k,v])=>k+'='+v).join('; ');
};
const header=(cookie,referer)=>({'User-Agent':agent,...(cookie?{Cookie:cookie}:{}),...(referer?{Referer:referer}:{})});
const csrf=(html)=>html.match(/csrf_token["']\\s+value=["']([^"']+)/)?.[1]||
  html.match(/name=["']csrf_token["'][^>]*value=["']([^"']+)/)?.[1]||'';
const uploadIds=(html)=>[...html.matchAll(/data-upload_id=["'](\\d+)/g)].map(m=>m[1]);
const uploadMap=(html)=>{
  const out=new Map();
  const re=/<a[^>]*data-upload_id=["'](\\d+)["'][^>]*>[\\s\\S]*?<strong[^>]*class=["'][^"']*name[^"']*["'][^>]*>([^<]+)<\\/strong>/g;
  for(const m of html.matchAll(re)){
    const name=m[2].replace(/&amp;/g,'&').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"').trim();
    out.set(name,m[1]);
  }
  return out;
};
async function request(url,options={}){
  const res=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(180000),...options});
  if(!res.ok)throw Error('HTTP '+res.status+' '+url);
  return res;
}
const valid=async(path)=>{
  try{const b=await readFile(path);return b.length>100000&&b.subarray(0,4).toString('ascii')==='OggS';}
  catch{return false;}
};
const run=(prog,args)=>execFileSync(prog,args,{stdio:'inherit',timeout:240000});
await mkdir(output,{recursive:true});
try {
  for(const bundle of manifest.bundles){
    if(new URL(bundle.page).hostname!=='davidkbd.itch.io'||manifest.license!=='CC BY 4.0')
      throw Error('Unapproved author page or license: '+bundle.page);
    const missing=[];
    for(const t of bundle.tracks){
      if(!/^[a-z0-9][a-z0-9-]*\\.ogg$/.test(t.file))throw Error('Bad music file '+t.file);
      if(!(await valid(join(output,t.file))))missing.push(t);
    }
    if(!missing.length){console.log('CACHED BUNDLE',bundle.page);continue;}
    console.log('ITCH BUNDLE',bundle.page,'missing',missing.length);
    const page=await request(bundle.page,{headers:header('')});
    const html=await page.text();let cookie=cookies(page);
    const token=csrf(html), ids=uploadIds(html);
    if(!token)throw Error('itch initial page has no CSRF token: '+bundle.page);
    const response=await request(bundle.page+'/download_url',{
      method:'POST',headers:{...header(cookie,bundle.page),'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'},
      body:new URLSearchParams({csrf_token:token,...(ids[0]?{upload_id:ids[0]}:{})})});
    const downloadData=await response.json();
    if(!downloadData.url||new URL(downloadData.url).protocol!=='https:')
      throw Error('itch download_url did not issue a signed page');
    const download=await request(downloadData.url,{headers:header(cookie,bundle.page)});
    const downloadHtml=await download.text();
    cookie=mergeCookies(cookie,cookies(download));
    const names=uploadMap(downloadHtml);
    const downloadToken=csrf(downloadHtml)||token;
    console.log('ITCH FOUND FILES',names.size,[...names.keys()].slice(0,3).join(' | '));
    for(const t of missing){
      const id=names.get(t.originalName);
      if(!id)throw Error('Official free OGG upload not found: '+t.originalName+'; available: '+[...names.keys()].join(' | '));
      const issue=await request(bundle.page+'/file/'+id,{
        method:'POST',headers:{...header(cookie,downloadData.url),'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'},
        body:new URLSearchParams({csrf_token:downloadToken})});
      const cdn=await issue.json();
      if(!cdn.url||new URL(cdn.url).protocol!=='https:')throw Error('Missing signed asset URL for '+t.id);
      const bytes=Buffer.from(await (await request(cdn.url,{headers:header('')})).arrayBuffer());
      if(bytes.length<100000||bytes.subarray(0,4).toString('ascii')!=='OggS')throw Error('Bad source Ogg for '+t.id);
      const source=join(work,t.id+'.source.ogg'),encoded=join(work,t.id+'.ogg');
      await writeFile(source,bytes);
      const info=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json',source],{encoding:'utf8',timeout:30000}));
      const seconds=Number(info.format?.duration);
      if(!Number.isFinite(seconds)||seconds<18||seconds>1800)throw Error('Bad duration '+t.id+': '+seconds);
      run('ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-y','-i',source,'-map','0:a:0','-vn','-ac','2','-ar','48000','-c:a','libopus','-b:a','96k','-vbr','on','-map_metadata','-1',encoded]);
      if(!(await valid(encoded)))throw Error('Bad game-ready audio for '+t.id);
      await rename(encoded,join(output,t.file));
      await rm(source,{force:true});
      console.log('ITCH READY',t.id,Math.round((await stat(join(output,t.file))).size/1024)+'KiB',Math.round(seconds)+'s');
    }
  }
} finally {await rm(work,{force:true,recursive:true});}
console.log('All',manifest.bundles.reduce((n,b)=>n+b.tracks.length,0),'itch OGG uploads ready');
