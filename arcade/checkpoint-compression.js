// Deterministic, synchronous byte-oriented LZW for the large, repeated
// station/colony graphs. Native CompressionStream is asynchronous, whereas
// the checkpoint contract is synchronous and must also run in Node tests.
// Dictionary codes occupy one UTF-16 code unit. The output is a string so
// the existing dual-slot storage and checksum protocol remain unchanged.
const PREFIX='~LZW1~';
const LIMIT=65535;
const MAX_RAW=6000000;

export function compressCheckpoint(raw){
 const bytes=new TextEncoder().encode(raw);
 if(!bytes.length)return raw;
 const dictionary=new Map();let next=256;
 let word=String.fromCharCode(bytes[0]);
 const codes=[];
 const codeOf=value=>value.length===1?value.charCodeAt(0):dictionary.get(value);
 for(let i=1;i<bytes.length;i++){
  const symbol=String.fromCharCode(bytes[i]),joined=word+symbol;
  if(dictionary.has(joined)){word=joined;continue;}
  codes.push(codeOf(word));
  if(next<LIMIT)dictionary.set(joined,next++);
  word=symbol;
 }
 codes.push(codeOf(word));
 const parts=[PREFIX];
 for(let i=0;i<codes.length;i+=12000)
  parts.push(String.fromCharCode(...codes.slice(i,i+12000)));
 return parts.join('');
}

export function decompressCheckpoint(data){
 if(!data.startsWith(PREFIX))return data;
 const codes=data.slice(PREFIX.length);
 if(!codes.length)throw new Error('invalid-compression');
 const dict=[];let next=256;
 let prev=String.fromCharCode(codes.charCodeAt(0));
 if(prev.charCodeAt(0)>255)throw new Error('invalid-compression');
 const chunks=[prev];let size=1;
 for(let i=1;i<codes.length;i++){
  const code=codes.charCodeAt(i);
  const current=code<256?String.fromCharCode(code):
   dict[code]??(code===next&&next<LIMIT?prev+prev[0]:null);
  if(current===null)throw new Error('invalid-compression');
  size+=current.length;
  if(size>MAX_RAW)throw new Error('too-large');
  chunks.push(current);
  if(next<LIMIT)dict[next++]=prev+current[0];
  prev=current;
 }
 const raw=chunks.join(''),bytes=new Uint8Array(raw.length);
 for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
 return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
