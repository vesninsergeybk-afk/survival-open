/**
 * Prologue 00's optional skinned-robot layer.
 * Quaternius CC0 animated GLB models. A Kenney Canvas2D robot remains the
 * fallback in 2D mode, under load, or while a model is loading.
 */
import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
// Lightweight SPAC-1 patrols are always Canvas2D; keep expensive 3D only for elites.
const TYPES={workshop:'custodian',maintenance:'custodian',forge:'overseer',command:'sentinel',siege:'sentinel'};
const RANK={custodian:1,overseer:2,sentinel:3};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function skinnedClone(source){
 const clone=source.clone(true),original=[],copies=[];
 source.traverse(n=>original.push(n));
 clone.traverse(n=>copies.push(n));
 const lookup=new Map(original.map((n,i)=>[n.uuid,copies[i]]));
 for(let i=0;i<original.length;i++){
  if(!original[i].isSkinnedMesh)continue;
  const skeleton=original[i].skeleton.clone();
  skeleton.bones=original[i].skeleton.bones.map(n=>lookup.get(n.uuid));
  if(skeleton.bones.some(n=>!n))throw new Error('Robot bone mapping failed');
  copies[i].bind(skeleton,original[i].bindMatrix.clone());
 }
 return clone;
}
function clip(gltf,...names){
 return gltf.animations.find(a=>names.some(n=>
  a.name.split('|').pop().toLowerCase()===n.toLowerCase()));
}
function switchAction(actor,name){
 if(actor.state===name)return;
 const next=actor.clips[name]||actor.clips.idle;
 if(!next)return;
 const action=actor.mixer.clipAction(next);
 action.reset().play();
 if(actor.action&&actor.action!==action)actor.action.crossFadeTo(action,.14,false);
 actor.state=name;actor.action=action;
}
export class PrologueRobot3D{
 constructor(scene){
  this.scene=scene;this.loader=new GLTFLoader();this.sources=new Map();
  this.loading=new Set();this.failed=new Set();this.actors=new Map();
  this.disposed=false;
 }
 load(type){
  if(this.disposed||this.sources.has(type)||this.loading.has(type)||this.failed.has(type))return;
  this.loading.add(type);
  const url=new URL('../assets/3d/robots/'+type+'.glb',import.meta.url).href;
  this.loader.loadAsync(url).then(gltf=>{
   this.loading.delete(type);
   if(!this.disposed)this.sources.set(type,gltf);
  }).catch(error=>{
   this.loading.delete(type);this.failed.add(type);
   console.warn('Prologue robot 3D model unavailable',type,error);
  });
 }
 create(enemy,type){
  const gltf=this.sources.get(type);if(!gltf)return null;
  const figure=skinnedClone(gltf.scene);
  const bounds=new THREE.Box3().setFromObject(gltf.scene);
  const size=bounds.getSize(new THREE.Vector3());
  const center=bounds.getCenter(new THREE.Vector3());
  const desired=type==='sentinel'?100:type==='overseer'?84:66;
  const scale=desired/Math.max(size.x,size.y,size.z,.05);
  figure.position.sub(center).multiplyScalar(scale);
  figure.scale.setScalar(scale);
  const root=new THREE.Group();root.add(figure);this.scene.add(root);
  const actor={type,root,mixer:new THREE.AnimationMixer(figure),
   clips:{idle:clip(gltf,'Idle','Robot_Idle'),walk:clip(gltf,'Walk','Robot_Walking'),
     run:clip(gltf,'Run','Robot_Running'),
     attack:clip(gltf,'Shoot','Shoot_Big','Attack','Punch','Robot_Punch'),
     hit:clip(gltf,'HitRecieve_1','HitRecieve_2')},
   state:null,action:null,time:0,x:enemy.x,y:enemy.y};
  this.actors.set(enemy,actor);switchAction(actor,'idle');return actor;
 }
 sync(enemies,cx,cy,w,h,time,quality){
  if(this.disposed)return;
  const selected=new Set(),candidates=[];
  // Respect the frame budget while allowing more than two animated robots
  // on capable desktops. Lower-quality modes retain the 2D fallback.
  const limit=Math.max(0,Math.min(quality?.enemyModels??0,quality?.mobile?2:4));
  for(const e of enemies||[]){
   if(!e.missionStructure)continue;
   e._prologue3dVisible=false;
   const type=TYPES[e.prologueGroup];
   if(!type||e.hp<=0||Math.abs(e.x-cx)>w*.56||Math.abs(e.y-cy)>h*.56)continue;
   const distance2=(e.x-cx)**2+(e.y-cy)**2;
   // Keep an already visible robot in 3D until it leaves view or a higher
   // class arrives; otherwise nearby peers swap 2D/3D presentation each frame.
   candidates.push({e,type,score:RANK[type]*1e7-distance2+
     (this.actors.has(e)?2e6:0)});
  }
  candidates.sort((a,b)=>b.score-a.score);
  for(const {e,type} of candidates.slice(0,limit)){
   this.load(type);
   if(!this.sources.has(type))continue;
   let a=this.actors.get(e);
   if(a&&a.type!==type){this.remove(e);a=null;}
   if(!a)a=this.create(e,type);
   if(!a)continue;
   selected.add(e);
   const dt=a.time?clamp(time-a.time,0,.08):0;
   const speed=dt?Math.hypot(e.x-a.x,e.y-a.y)/dt:0;
   const state=e.flashTimer>0&&a.clips.hit?'hit':
    e.aimTimer>0&&a.clips.attack?'attack':
    speed>42&&a.clips.run?'run':speed>7?'walk':'idle';
   switchAction(a,state);
   a.mixer.update(dt);
   a.root.position.set(e.x,6,e.y);
   a.root.rotation.y=Math.PI-(Number(e.visualAngle)||0);
   a.time=time;a.x=e.x;a.y=e.y;
   e._prologue3dVisible=true;
  }
  for(const [e] of this.actors)if(!selected.has(e))this.remove(e);
 }
 remove(enemy){
  const a=this.actors.get(enemy);if(!a)return;
  a.mixer.stopAllAction();
  a.mixer.uncacheRoot(a.root.children[0]);
  a.root.removeFromParent();this.actors.delete(enemy);
  enemy._prologue3dVisible=false;
 }
 reset(){for(const [enemy] of this.actors)this.remove(enemy);}
 dispose(){
  if(this.disposed)return;
  this.disposed=true;this.reset();
  const g=new Set(),m=new Set(),t=new Set();
  for(const gltf of this.sources.values())gltf.scene.traverse(n=>{
   if(n.geometry)g.add(n.geometry);
   for(const material of [n.material].flat()){
    if(!material)continue;m.add(material);
    for(const value of Object.values(material))if(value?.isTexture)t.add(value);
   }
  });
  for(const resource of [...g,...m,...t])resource.dispose();
  this.sources.clear();this.loading.clear();
 }
}