/**
 * Run after GitHub Pages deploy. Confirm every published score responds over
 * HTTP from the ACTUAL live game; source tests alone are insufficient.
 */
import {MUSIC_TRACKS} from '../arcade/music-playlist.js';
const base='https://vesninsergeybk-afk.github.io/survival-open/assets/audio/music/';
const tracks=Object.entries(MUSIC_TRACKS);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function check([id,track]){
  const url=base+encodeURIComponent(track.file)+'?audit=20261111';
  let reason='';
  for(let attempt=1;attempt<=6;attempt++){
    try{
      const head=await fetch(url,{method:'HEAD',cache:'no-store',signal:AbortSignal.timeout(22000)});
      const size=Number(head.headers.get('content-length'));
      if(head.ok&&Number.isFinite(size)&&size>100000){
        // Make an actual GET as well; read only the initial response chunk to
        // avoid transferring full music files when a CDN ignores Range.
        const get=await fetch(url,{headers:{Range:'bytes=0-63'},cache:'no-store',signal:AbortSignal.timeout(22000)});
        if(!get.ok||!get.body)throw Error('GET HTTP '+get.status);
        const reader=get.body.getReader();
        const {value}=await reader.read();
        await reader.cancel().catch(()=>{});
        if(!value||value.length<4||Buffer.from(value).subarray(0,4).toString('ascii')!=='OggS')
          throw Error('GET does not start with OggS');
        console.log('LIVE OK',id,track.file,size+' bytes');
        return null;
      }
      reason='HEAD HTTP '+head.status+', bytes='+size;
    }catch(err){reason=String(err.message||err);}
    console.warn('LIVE RETRY',id,attempt,reason);
    if(attempt<6)await sleep(3500*attempt);
  }
  return id+': '+reason;
}
let cursor=0;const failures=[];
const workers=Array.from({length:Math.min(6,tracks.length)},async()=>{
  while(cursor<tracks.length){
    const track=tracks[cursor++];
    const failure=await check(track);
    if(failure)failures.push(failure);
  }
});
await Promise.all(workers);
console.log('Published soundtrack audit:',tracks.length-failures.length,'/',tracks.length,'HTTP + OggS checks passed.');
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
