// Keep the laboratory's route, production and damage rules identical to the
// arcade. Only time controls, camera coordinates and the test aggressor belong
// to this file; none of this state is persisted back to the player's game.
import {
  CONTOURS,createContours,connectContour,contourFields,advanceContours,
} from '../territory-system.js';

export {CONTOURS};

export const LAB_NODES=Object.freeze([
  {id:'siphon-a',x:-900,y:480,label:'ПЕРИМЕТР'},
  {id:'siphon-b',x:150,y:-600,label:'УЗЕЛ СЕТИ'},
  {id:'siphon-c',x:1150,y:600,label:'ОПОРА'},
]);

export function createLabWorld(){
  const stations=new Map(LAB_NODES.map(s=>[s.id,{...s,active:true,enemy:false,suppressed:false}]));
  const world={stations,contours:createContours()};
  for(const pair of [['siphon-a','siphon-b'],['siphon-b','siphon-c'],['siphon-c','siphon-a']]){
    const result=connectContour(world,...pair);
    if(!result.ok)throw Error(`Не удалось замкнуть контур: ${result.reason}`);
  }
  const fields=contourFields(world);
  if(fields.length!==1)throw Error(`Ожидалось одно добывающее поле, получено ${fields.length}`);
  return {world,fields,clock:0,attackUntil:-1,attackTarget:null,attackPosition:null};
}

export function harvesterPosition(field,harvester){
  const t=harvester.phase==='out' ? Math.min(1,harvester.progress) :
    harvester.phase==='back' ? 1-Math.min(1,harvester.progress) : 1;
  return {x:field.anchor.x+(field.center.x-field.anchor.x)*t,
          y:field.anchor.y+(field.center.y-field.anchor.y)*t};
}

export function forceLaunch(lab){
  if(lab.world.contours.harvesters.length>=2)return [];
  lab.world.contours.nextLaunchAt=lab.clock;
  return stepLab(lab,.001);
}

export function startIntercept(lab){
  const worker=lab.world.contours.harvesters[0];
  if(!worker)return false;
  lab.attackTarget=worker;
  lab.attackUntil=lab.clock+3.4;
  lab.attackPosition=harvesterPosition(lab.fields[0],worker);
  return true;
}

export function stepLab(lab,dt){
  if(!(dt>0&&Number.isFinite(dt)))return [];
  lab.clock+=dt;
  const field=lab.fields[0];
  let enemies=[];
  if(lab.attackTarget&&lab.clock<lab.attackUntil&&lab.world.contours.harvesters.includes(lab.attackTarget)){
    const target=harvesterPosition(field,lab.attackTarget);
    // Controlled interception: the test aggressor is placed just beside the
    // selected worker so the actual game's proximity damage can be observed.
    lab.attackPosition={x:target.x+24,y:target.y-12};
    enemies=[{...lab.attackPosition,hp:100,converted:false}];
  }else{
    lab.attackTarget=null;
    lab.attackPosition=null;
  }
  const events=advanceContours(lab.world,lab.clock,dt,enemies,field.center);
  if(!lab.world.contours.harvesters.includes(lab.attackTarget)){
    lab.attackTarget=null;
    lab.attackPosition=null;
  }
  return events;
}
