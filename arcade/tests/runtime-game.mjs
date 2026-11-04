// Import the production class without DOM construction or animation boot.
import {readFileSync} from 'node:fs';
const entry=new URL('../game.js',import.meta.url);
const source=readFileSync(entry,'utf8').replace(/\nnew ArcadeGame\(\);\s*$/,'\n')
 .replace(/from '(\.[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL(path,entry).href));
export const {ArcadeGame}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
export function RuntimeHarness(){}
Object.setPrototypeOf(RuntimeHarness.prototype,ArcadeGame.prototype);
