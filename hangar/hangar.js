import * as THREE from '../src/vendor/three.module.js';
import {GLTFLoader} from '../src/vendor/loaders/GLTFLoader.js';

const $=id=>document.getElementById(id);
const canvas=$('view');
const shipPreview=document.createElement('img');
shipPreview.alt='Текущий спрайт главного корабля';
shipPreview.style.cssText='position:absolute;inset:9% 10%;width:80%;height:82%;object-fit:contain;pointer-events:none;filter:drop-shadow(0 8px 12px #0008);z-index:1;display:none';
canvas.after(shipPreview);
const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
renderer.setClearColor(0x000000,0);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.65;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(42,1,.1,1000);
const lights=[
    new THREE.HemisphereLight(0xd7edff,0x162d45,2.8),
    new THREE.DirectionalLight(0xffffff,3.8),
    new THREE.DirectionalLight(0x5bd9ff,2),
    new THREE.DirectionalLight(0xfdc58c,1.2)
];
lights[1].position.set(7,12,-6);lights[2].position.set(-8,3,7);
lights[3].position.set(3,4,11);lights.forEach(l=>scene.add(l));
const grid=new THREE.GridHelper(15,15,0x3e98a0,0x225067);
grid.position.y=-2.8;grid.material.transparent=true;grid.material.opacity=.16;
scene.add(grid);
const loader=new GLTFLoader();
const cache=new Map(),pending=new Map();
let manifest=[],mode='ship',picked=19151,current=null,seq=0;
let tier=0,yaw=.3,pitch=.32,distance=15,drag=null,filter='Все',search='';
const hulls=[19151,19151,19151,19148,19148,19150,19147];

async function glb(id){
    if(cache.has(id))return cache.get(id);
    if(pending.has(id))return pending.get(id);
    const value=loader.loadAsync('../assets/3d/'+id+'.glb').then(g=>{
        cache.set(id,g);pending.delete(id);return g;
    }).catch(e=>{pending.delete(id);throw e;});
    pending.set(id,value);
    return value;
}
function mesh(gltf,span){
    const object=gltf.scene.clone(true);
    const box=new THREE.Box3().setFromObject(object);
    const extent=box.getSize(new THREE.Vector3());
    const center=box.getCenter(new THREE.Vector3());
    const f=span/Math.max(extent.x,extent.z,.001);
    object.position.sub(center).multiplyScalar(f);
    object.scale.setScalar(f);
    const group=new THREE.Group();
    group.add(object);
    return group;
}
function setScene(root){
    if(current)scene.remove(current);
    current=root;
    scene.add(root);
}
function setStatus(text){$('status').textContent=text;}
async function show(){
    const request=++seq;
    if(mode==='ship'){
        const name='ship_'+String(tier+1).padStart(2,'0')+'.webp';
        const url='../assets/space/hero-evolution/'+name;
        shipPreview.src=url;shipPreview.style.display='block';
        canvas.style.opacity='0';
        $('title').textContent='Наш корабль · этап '+(tier+1);
        $('download').href=url;$('download').download=name;
        $('download').textContent='Скачать спрайт WebP';
        $('hint').textContent='Выберите ступень развития справа · все десять изображений взяты из исходного рисунка';
        setStatus('2D-спрайт · ступень '+(tier+1)+' из 10 · прозрачный фон');
        return;
    }
    shipPreview.style.display='none';canvas.style.opacity='1';
    $('hint').textContent='Перетаскивайте, чтобы вращать · Колесо мыши — масштаб';
    $('download').textContent='Скачать текущий GLB';
    const root=new THREE.Group();
    const info=manifest.find(m=>m.id===picked);
    try{
        if(mode==='single'){
            setStatus('Загрузка '+(info?.name||picked)+'…');
            root.add(mesh(await glb(picked),8.5));
            if(request!==seq)return;
            setScene(root);
            $('title').textContent=info?.name||String(picked);
            $('download').href='../assets/3d/'+picked+'.glb';
            $('download').download=(info?.name||picked)+'.glb';
            setStatus('3D-модель · '+(info?.triangles||'?').toLocaleString('ru')+' треугольников · CC0');
        }else{
            const ids=[hulls[tier],tier>=1?19156:19155];
            if(tier>=2)ids.push(19159);
            if(tier>=3)ids.push(19161,19173);
            if(tier>=4)ids.push(19164,19167);
            if(tier>=5)ids.push(19160,19157);
            if(tier>=6)ids.push(19162,19163,19158);
            const unique=[...new Set(ids)];
            setStatus('Собираем корабль · ступень '+tier+' из 6…');
            const loaded=await Promise.all(unique.map(id=>glb(id)));
            if(request!==seq)return;
            const parts=new Map(unique.map((id,i)=>[id,loaded[i]]));
            root.add(mesh(parts.get(hulls[tier]),tier>=5?10:tier>=3?9:8));
            const put=(id,span,x,y,z)=>{
                const obj=mesh(parts.get(id),span);
                obj.position.set(x,y,z);root.add(obj);
            };
            const engine=tier>=1?19156:19155;
            put(engine,tier>=5?2.8:2.1,-2,.1,-2.8);
            put(engine,tier>=5?2.8:2.1,2,.1,-2.8);
            if(tier>=2)put(19159,1.9,0,.9,1.2);
            if(tier>=3){
                put(19161,2.3,-3,.2,.3);put(19161,2.3,3,.2,.3);
                put(19173,2,-1.9,.6,-.5);put(19173,2,1.9,.6,-.5);
            }
            if(tier>=4){put(19164,2.5,0,1.3,-1.4);put(19167,1.9,0,1.3,2.6);}
            if(tier>=5){
                put(19160,2.2,-1.5,1.1,1.3);put(19160,2.2,1.5,1.1,1.3);
                put(19157,3,0,.3,-4);
            }
            if(tier>=6){
                put(19162,2.7,0,1.2,3.2);put(19163,1.8,2.5,1.1,-.2);
                put(19158,2.4,-3.3,.2,-2.2);put(19158,2.4,3.3,.2,-2.2);
            }
            setScene(root);
            $('title').textContent=tier===0?'Корабль из пролога':
                'Корабль · ступень '+tier;
            $('download').href='../assets/3d/'+hulls[tier]+'.glb';
            $('download').download='Survivor-hull-'+hulls[tier]+'.glb';
            setStatus('Корпус и '+(root.children.length-1)+' модулей · поворачивайте модель');
        }
    }catch(error){
        if(request!==seq)return;
        setStatus('Не удалось загрузить GLB: '+error.message);
        console.warn('Hangar model load failed',error);
    }
}
function chooseMode(next){
    mode=next;
    $('ship').setAttribute('aria-pressed',String(mode==='ship'));
    $('single').setAttribute('aria-pressed',String(mode==='single'));
    document.querySelector('.tier').hidden=mode==='single';
    show();
}
$('ship').addEventListener('click',()=>chooseMode('ship'));
$('single').addEventListener('click',()=>chooseMode('single'));
$('tier').addEventListener('input',e=>{
    tier=Number(e.target.value);
    $('tierValue').textContent=(tier+1)+'/10';
    if(mode!=='ship')chooseMode('ship');else show();
});
$('search').addEventListener('input',e=>{search=e.target.value.trim().toLowerCase();paintList();});
function paintFilters(){
    const container=$('filters');
    container.replaceChildren();
    for(const label of ['Все','Корпуса','Модули','Станции','Флот и окружение']){
        const button=document.createElement('button');
        button.textContent=label;button.setAttribute('aria-pressed',String(filter===label));
        button.addEventListener('click',()=>{filter=label;paintFilters();paintList();});
        container.append(button);
    }
}
function paintList(){
    const content=$('models');
    content.replaceChildren();
    for(const item of manifest){
        if(filter!=='Все'&&filter!==item.category)continue;
        if(search&&!item.name.toLowerCase().includes(search)&&!String(item.id).includes(search))continue;
        const button=document.createElement('button');
        button.setAttribute('aria-pressed',String(mode==='single'&&picked===item.id));
        button.title=item.name;
        const name=document.createElement('span');
        name.textContent=item.name;
        const detail=document.createElement('small');
        detail.textContent=(item.triangles/1000).toFixed(1)+' тыс. трис · '+item.id;
        button.append(name,detail);
        button.addEventListener('click',()=>{
            picked=item.id;chooseMode('single');paintList();
        });
        content.append(button);
    }
}
function resize(){
    const rect=canvas.getBoundingClientRect();
    const width=Math.max(1,rect.width),height=Math.max(1,rect.height);
    renderer.setSize(width,height,false);
    camera.aspect=width/height;camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);
function zoom(delta){distance=Math.max(7,Math.min(32,distance+delta));}
canvas.addEventListener('wheel',event=>{
    event.preventDefault();zoom(event.deltaY*.011);
},{passive:false});
canvas.addEventListener('pointerdown',event=>{
    canvas.setPointerCapture(event.pointerId);
    drag={x:event.clientX,y:event.clientY,id:event.pointerId};
});
canvas.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.id)return;
    yaw+=(event.clientX-drag.x)*.008;
    pitch=Math.max(-.5,Math.min(1.2,pitch+(event.clientY-drag.y)*.008));
    drag.x=event.clientX;drag.y=event.clientY;
});
canvas.addEventListener('pointerup',()=>drag=null);
canvas.addEventListener('pointercancel',()=>drag=null);
let last=0;
function tick(time){
    requestAnimationFrame(tick);
    if(document.hidden||time-last<28)return;
    const dt=Math.min(.1,(time-last)/1000||0);last=time;
    if(!drag)yaw+=dt*.08;
    camera.position.set(distance*Math.sin(yaw)*Math.cos(pitch),
        distance*Math.sin(pitch)+4,
        distance*Math.cos(yaw)*Math.cos(pitch));
    camera.lookAt(0,0,0);
    if(mode==='single')renderer.render(scene,camera);
}
requestAnimationFrame(tick);
(async()=>{
    try{
        const response=await fetch('../assets/3d/manifest.json',{cache:'force-cache'});
        if(!response.ok)throw new Error('HTTP '+response.status);
        const list=await response.json();
        manifest=list.items;
        $('filters').replaceChildren();paintFilters();paintList();
        resize();await show();
    }catch(error){setStatus('Каталог недоступен: '+error.message);}
})();
