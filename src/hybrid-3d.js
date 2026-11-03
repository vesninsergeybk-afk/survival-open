/**
 * Survivor hybrid renderer: 2D game rules and UI, real 3D ships/modules/turrets.
 * CC0 model pack: 3dassets.dev / Interstellar Fleet; Three.js is MIT.
 * Optional feature: ?render=2d guarantees the original Canvas2D fallback.
 */
import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { ModelInstances, disposeSources } from './model-instances.js?v=perf-981';
import { RenderBudget } from './render-budget.js?v=runtime-124';
import { StellarWindows3D } from './stellar-window-3d.js?v=solar-shadow-104';
import { isAnimatedShipAtlasReady } from './disruptor-ship-sprites.js';

// A single corvette hull is canonical in every mission. All levels add bolt-on
// hardware to this silhouette; no unexplained hull/ship swap mid-campaign.
const HULLS = [19151,19151,19151,19151,19151,19151,19151];
const TWO_PI = Math.PI * 2;
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const heading = (radians) => Math.PI - (Number(radians) || 0);
const turretHeading = (radians) => Math.PI / 2 - (Number(radians) || 0);
const prefer2D = () => new URLSearchParams(location.search).get('render') === '2d' ||
    localStorage.getItem('survivor-renderer') === '2d';

export class Hybrid3D {
    constructor(canvas, {mode='campaign',quality=null,graphicsMode=null}={}) {
        if (graphicsMode==='2d' || (graphicsMode!=='3d' && prefer2D())) throw new Error('3D rendering disabled in settings');
        this.source = canvas;
        this.quality = quality || new RenderBudget({
            mobile:matchMedia('(any-pointer: coarse)').matches,
            devicePixelRatio:window.devicePixelRatio || 1
        }).plan();
        this.rigs = new ModelInstances(48);
        this.shipResources = [];
        this.needsResize = true;
        this.mode = mode;
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'survivor-3d-layer';
        this.canvas.setAttribute('aria-hidden','true');
        this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;background:transparent;border:0;pointer-events:none;z-index:1;display:block;';
        if (mode === 'prologue') this.canvas.style.position = 'fixed';
        canvas.after(this.canvas);
        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas:this.canvas, alpha:true, antialias:false,
                powerPreference:'high-performance', preserveDrawingBuffer:false
            });
        } catch (error) {
            this.canvas.remove();
            throw error;
        }
        this.renderer.setClearColor(0x000000,0);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.55;
        this.renderer.setPixelRatio(this.quality.pixelRatio);
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-600,600,400,-400,.1,4000);
        this.camera.up.set(0,0,-1);
        this.scene.add(new THREE.HemisphereLight(0xb8daff,0x172942,2.4));
        const light = new THREE.DirectionalLight(0xffffff,3.2);
        light.position.set(-240,900,-380);
        this.scene.add(light);
        const rim = new THREE.DirectionalLight(0x41cde9,1.4);
        rim.position.set(360,560,420);
        this.scene.add(rim);
        this.loader = new GLTFLoader();
        this.prologueRobots = null; // All prologue enemies use native 2D art.
        this.models = new Map();
        this.loading = new Map();
        this.modelQueue = [];
        this.activeModelLoads = 0;
        this.maxModelLoads = this.quality.mobile ? 2 : 3;
        this.bosses = new Map();
        this.enemies3d = new Map();
        this.enemyMissiles = new Map();
        this.guns = new Map();
        this.scenery3d = new Map();
        this.stellarWindows = null;
        this.playerRig = null;
        this.shipFlames = [];
        this.shipTurrets = [];
        this.ready = true; // Keep 3D scenery, draw the hero as an original 2D sprite.
        this.tier = -1;
        this.variant = '';
        this.generation = 0;
        this.width = this.height = 0;
        this.disposed = false;
        this.contextLost = false;
        this._resizeHandler=()=>{this.needsResize=true;};
        window.addEventListener('resize',this._resizeHandler);
        if(typeof ResizeObserver!=='undefined'){
            this.resizeObserver=new ResizeObserver(()=>{this.needsResize=true;});
            this.resizeObserver.observe(canvas);
        }
        this.canvas.addEventListener('webglcontextlost',(event)=>{
            event.preventDefault();
            this.contextLost=true;
            this.ready=false;
            this.resetActorFlags();
            if(this.onDisabled)this.onDisabled();
        });
        this.canvas.addEventListener('webglcontextrestored',()=>{this.contextLost=false;this.ready=true;this.tier=-1;this.requestKit='';});
        // The hero sprite is independent; 3D enemies and scenery load on demand.
    }

    // GLB decoding and GPU uploads must be staggered. Unbounded concurrent
    // glTF loads used to hit the very first seconds of a new sector.
    model(id) {
        if(this.models.has(id))return Promise.resolve(this.models.get(id));
        if(this.loading.has(id))return this.loading.get(id);
        if(this.disposed)return Promise.reject(new Error('Renderer disposed'));
        let resolve,reject;
        const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
        this.loading.set(id,promise);
        this.modelQueue.push({id,resolve,reject});
        this._drainModelQueue();
        return promise;
    }

    _drainModelQueue() {
        if(this.disposed)return;
        while(this.activeModelLoads<this.maxModelLoads&&this.modelQueue.length){
            const {id,resolve,reject}=this.modelQueue.shift();
            const localName=typeof id==='string' &&
                /^q-(access|computer|crate|doorframe|vent)$/.test(id);
            const url=new URL(localName?'../assets/3d/interior/'+id+'.gltf':
                '../assets/3d/'+id+'.glb',import.meta.url).href;
            this.activeModelLoads++;
            this.loader.loadAsync(url).then(gltf=>{
                if(this.disposed){
                    disposeSources([gltf]);
                    throw new Error('Renderer was disposed while loading');
                }
                this.models.set(id,gltf);
                resolve(gltf);
            }).catch(reject).finally(()=>{
                this.loading.delete(id);
                this.activeModelLoads--;
                this._drainModelQueue();
            });
        }
    }

    tierFor(player, campaign, workshop) {
        const completed = Array.isArray(campaign?.completed)
            ? campaign.completed.length : Object.keys(campaign?.completed||{}).filter(k=>campaign.completed[k]).length;
        const level = Number(player?.level)||1;
        const weapons = player?.weapons?.length||0;
        return clamp(Math.max(workshop?2:0,Math.floor((level-1)/3),
            Math.floor(completed/2),Math.max(0,weapons-1)),0,6);
    }

    async buildShip(tier,variant,kit={}) {
        const mark = ++this.generation;
        const hullId=HULLS[tier];
        const parts=[hullId,tier>=1?19156:19155];
        if(tier>=2||kit.armed)parts.push(19159);
        if(tier>=3)parts.push(19161,19173);
        if(tier>=4)parts.push(19164,19167);
        else if(kit.shielded)parts.push(19164);
        if(tier>=5)parts.push(19160,19157);
        if(tier>=6)parts.push(19162,19163,19158);
        else if(kit.canDodge)parts.push(19158);
        const source = await Promise.all([...new Set(parts)].map(id=>this.model(id)));
        if(mark!==this.generation||this.disposed)return;
        const loaded = new Map([...new Set(parts)].map((id,i)=>[id,source[i]]));
        const tint=variant==='mage'?'#ac89ff':variant==='scout'?'#42eac0':'#6daeff';
        const root=new THREE.Group();
        const flames=[],turretPivots=[],resources=[];
        const hull=this.rigs.acquire(loaded.get(hullId),88,tint);
        root.add(hull);
        const put=(id,span,x,y,z,angle=0)=>{
            const part=this.rigs.acquire(loaded.get(id),span,tint);
            part.position.set(x,y,z);part.rotation.y=angle;root.add(part);
            return part;
        };
        const engine=tier>=1?19156:19155;
        const engineOffsets=tier>=5?[-27,0,27]:[-20,20];
        for(const x of engineOffsets)put(engine,tier>=5?28:21,x,1,-28);
        // In-world engine plumes use emissive shader materials, not flat sprites.
        // They stay inside the ship rig and scale with actual 2D thrust speed.
        for(const x of engineOffsets){
            const jet=new THREE.Group();
            const outer=new THREE.Mesh(new THREE.ConeGeometry(8,30,12),
                new THREE.MeshBasicMaterial({color:0x269cf5,transparent:true,
                    opacity:.45,depthWrite:false,blending:THREE.AdditiveBlending}));
            const core=new THREE.Mesh(new THREE.ConeGeometry(3.5,24,10),
                new THREE.MeshBasicMaterial({color:0xc4f8ff,transparent:true,
                    opacity:.76,depthWrite:false,blending:THREE.AdditiveBlending}));
            resources.push(outer.geometry,outer.material,core.geometry,core.material);
            outer.rotation.x=core.rotation.x=-Math.PI/2;
            core.position.z=-4;
            jet.add(outer,core);jet.position.set(x,1,-45);
            root.add(jet);flames.push({jet,outer,core,x});
        }
        if(tier>=2||kit.armed)
            turretPivots.push(put(19159,19,0,9,12));
        if(tier>=3){
            put(19161,23,-30,2,3);put(19161,23,30,2,3);
            put(19173,20,-19,6,-5);put(19173,20,19,6,-5);
        }
        if(tier>=4){
            put(19164,25,0,13,-14);put(19167,19,0,13,26);
        }else if(kit.shielded)put(19164,25,0,13,-14);
        if(tier>=5){
            turretPivots.push(put(19160,22,-15,11,13),put(19160,22,15,11,13));
            put(19157,30,0,3,-40);
        }
        if(tier>=6){
            put(19162,27,0,12,32);put(19163,18,25,11,-2);
        }
        if(tier>=6||kit.canDodge){
            put(19158,24,-33,2,-22);put(19158,24,33,2,-22);
        }
        if(mark!==this.generation||this.disposed)return;
        if(this.playerRig)this.scene.remove(this.playerRig);
        for(const resource of this.shipResources)resource.dispose();
        this.shipResources=resources;
        this.playerRig=root;
        this.shipFlames=flames;this.shipTurrets=turretPivots;
        this.scene.add(root);
        this.tier=tier;
        this.variant=variant;
        this.ready=true;
    }

    syncPlayer(player,campaign,workshop,time,enemies=[]) {
        if(!player)return;
        const tier=this.tierFor(player,campaign,workshop);
        const variant=player.shipVariant||'fighter';
        const kit={
            armed:(player.weapons?.length||0)>0,
            shielded:(player.passives?.shield_core?.count||0)>0,
            canDodge:(player.passives?.dodge?.count||0)>0
        };
        const kitKey=tier+'|'+variant+'|'+Number(kit.armed)+
            '|'+Number(kit.shielded)+'|'+Number(kit.canDodge);
        if(this.requestKit!==kitKey){
            this.requestKit=kitKey;
            this.buildShip(tier,variant,kit).catch(e=>{this.requestKit='';this.disable(e);});
        }
        if(!this.playerRig)return;
        this.playerRig.visible=true;
        this.playerRig.position.set(player.x,0,player.y);
        // Actual 3D pitch and bank, while navigation and hitbox remain the
        // authoritative shared 2D simulation.
        const speed=Math.hypot(player.vx||0,player.vy||0);
        const motion=clamp(speed/235,0,1);
        const flightBank=Math.sin(time*3.5)*(.035+.16*motion);
        const flightPitch=Math.cos(time*2.1)*(.018+.08*motion);
        const lastEvade=Number(player.missileEvasionAt);
        let barrelRoll=0;
        if(Number.isFinite(lastEvade)){
            const elapsed=time-lastEvade;
            if(elapsed>=0&&elapsed<.82){
                const t=elapsed/.82,smooth=t*t*(3-2*t);
                barrelRoll=(player.missileEvasionSign||1)*TWO_PI*smooth;
            }
        }
        this.playerRig.rotation.set(flightPitch,heading(player.visualAngle),
            flightBank+barrelRoll);
        this.playerRig.position.y=.6*Math.sin(time*2.5)+motion*.8;
        for(const flame of this.shipFlames){
            const flicker=.87+.10*Math.sin(time*19+flame.x)+.05*Math.sin(time*31);
            flame.jet.visible=enginePower>.005;
            flame.jet.scale.set(1,1,Math.max(.01,1.45*enginePower)*flicker);
            flame.outer.material.opacity=.58*enginePower;
            flame.core.material.opacity=.90*enginePower;
        }
        let target=null,best=600*600;
        for(const enemy of enemies){
            if(enemy.hp<=0)continue;
            const dx=enemy.x-player.x,dy=enemy.y-player.y,d2=dx*dx+dy*dy;
            if(d2<best){best=d2;target=enemy;}
        }
        const shipYaw=heading(player.visualAngle);
        const aimedYaw=target?heading(Math.atan2(target.y-player.y,
            target.x-player.x)+Math.PI/2):shipYaw;
        const localYaw=Math.atan2(Math.sin(aimedYaw-shipYaw),
            Math.cos(aimedYaw-shipYaw));
        for(const gun of this.shipTurrets){
            gun.rotation.y=target?localYaw:.18*Math.sin(time*.9+gun.position.x*.02);
        }
    }

    syncBosses(enemies,centerX,centerY,width,height,time) {
        const active=new Set();
        let shown=0;
        for(const enemy of (enemies||[])){
            enemy._hybrid3dVisible=false;
            if(!enemy.boss||enemy.hp<=0||shown>=this.quality.bossModels ||
               Math.abs(enemy.x-centerX)>width*.65 ||
               Math.abs(enemy.y-centerY)>height*.65)continue;
            const key=enemy;
            active.add(key);shown++;
            let entity=this.bosses.get(key);
            if(!entity){
                if(!this.models.has(19149)){
                    this.model(19149).catch(()=>{});
                    continue;
                }
                entity=this.rigs.acquire(this.models.get(19149),Math.max(84,enemy.size*2.6),'#f87868');
                this.bosses.set(key,entity);this.scene.add(entity);
            }
            entity.visible=true;
            entity.position.set(enemy.x,3+Math.sin(time*2+enemy.x)*1.8,enemy.y);
            const direction=Number.isFinite(enemy.visualAngle) ? enemy.visualAngle :
                Math.atan2((enemy.vy||0),(enemy.vx||0))+Math.PI/2;
            const oldYaw=entity.rotation.y;
            entity.rotation.y=heading(direction);
            const turn=Math.atan2(Math.sin(entity.rotation.y-oldYaw),
                Math.cos(entity.rotation.y-oldYaw));
            entity.rotation.z=clamp(turn*2.5,-.24,.24)+Math.sin(time*1.6+enemy.x)*.08;
            entity.rotation.x=Math.cos(time*1.1+enemy.y)*.08;
            enemy._hybrid3dVisible=true;
        }
        for(const [key,obj] of this.bosses){
            if(!active.has(key)||!key._hybrid3dVisible){
                this.rigs.release(obj);this.bosses.delete(key);
                key._hybrid3dVisible=false;
            }
        }
    }


    enemyModelId(enemy){
        const id=enemy.id||enemy.type?.id||'';
        switch(id){
            case 'bat':case 'slimeling':case 'slime':return 19212;
            case 'ghost':case 'illusionist':return 19218;
            case 'bomber':return 19210;
            case 'golem':return 19209;
            case 'minelayer':return 19146;
            case 'carrier':return 19149;
            case 'gunship':return 19151;
            case 'rammer':return 19208;
            case 'mage':return 19208;
            default:return 19211;
        }
    }

    syncEnemies(enemies,centerX,centerY,width,height,player,time){
        const visible=new Set();
        const limit=this.quality.enemyModels;
        let count=0;
        for(const enemy of (enemies||[])){
            if(enemy.boss)continue;
            enemy._hybrid3dVisible=false;
            if(enemy.missionStructure)continue;
            if(isAnimatedShipAtlasReady())continue;
            if(enemy.hp<=0||count>=limit||
                Math.abs(enemy.x-centerX)>width*.62||
                Math.abs(enemy.y-centerY)>height*.62)continue;
            count++;
            const id=this.enemyModelId(enemy);
            if(!this.models.has(id)){
                this.model(id).catch(()=>{});
                continue;
            }
            const key=enemy;
            visible.add(key);
            let entity=this.enemies3d.get(key);
            if(!entity||entity.id!==id){
                if(entity)this.rigs.release(entity.mesh);
                const mesh=this.rigs.acquire(this.models.get(id),
                    Math.max(22,(enemy.size||14)*2.2),'#d67877');
                this.scene.add(mesh);
                entity={id,mesh,rollAt:-Infinity,rollSign:1,
                    wasDashing:false,flankSign:enemy.flankSign,lastYaw:0};
                this.enemies3d.set(key,entity);
            }
            entity.mesh.visible=true;
            entity.mesh.position.set(enemy.x,1.5+Math.sin(time*3+enemy.x)*.6,enemy.y);
            const dx=player.x-enemy.x,dy=player.y-enemy.y;
            const angle=Number.isFinite(enemy.visualAngle)?enemy.visualAngle:
                Math.atan2(dy,dx)+Math.PI/2;
            const yaw=heading(angle);
            const turn=Math.atan2(Math.sin(yaw-entity.lastYaw),
                Math.cos(yaw-entity.lastYaw));
            entity.mesh.rotation.y=yaw;
            entity.lastYaw=yaw;
            const dashing=(enemy.dashActive||0)>0;
            if((dashing&&!entity.wasDashing) ||
                (enemy.flanker&&enemy.flankSign!==entity.flankSign)){
                entity.rollAt=time;
                entity.rollSign=enemy.flankSign||1;
            }
            entity.wasDashing=dashing;entity.flankSign=enemy.flankSign;
            const age=time-entity.rollAt;
            let roll=0;
            if(age>=0&&age<.68){
                const t=age/.68;
                roll=entity.rollSign*TWO_PI*(t*t*(3-2*t));
            }
            const bank=clamp(-turn*2.4,-.36,.36)+
                (enemy.flanker?(enemy.flankSign||1)*.12:0);
            entity.mesh.rotation.z=bank+roll+
                (enemy.flashTimer>0?Math.sin(time*40)*.14:0);
            entity.mesh.rotation.x=Math.sin(time*1.7+enemy.x*.015)*.12;
            enemy._hybrid3dVisible=true;
        }
        for(const [key,entity] of this.enemies3d){
            if(!visible.has(key)){
                this.rigs.release(entity.mesh);
                this.enemies3d.delete(key);
                key._hybrid3dVisible=false;
            }
        }
    }

    syncEnemyMissiles(projectiles,centerX,centerY,width,height,time){
        const current=new Set();
        let count=0;
        const limit=this.quality.missileModels;
        for(const p of (projectiles||[])){
            p._hybrid3dVisible=false;
            if(p.kind!=='missile'||p.shouldRemove||count>=limit||
                Math.abs(p.x-centerX)>width*.7||
                Math.abs(p.y-centerY)>height*.7)continue;
            count++;
            if(!this.models.has(19161)){
                this.model(19161).catch(()=>{});
                continue;
            }
            current.add(p);
            let mesh=this.enemyMissiles.get(p);
            if(!mesh){
                mesh=this.rigs.acquire(this.models.get(19161),26,'#ff9870');
                this.scene.add(mesh);this.enemyMissiles.set(p,mesh);
            }
            mesh.position.set(p.x,5+Math.sin(time*13+p.x)*.6,p.y);
            mesh.rotation.y=heading(Math.atan2(p.vy,p.vx)+Math.PI/2);
            mesh.rotation.x=Math.sin(time*8+p.y*.02)*.08;
            mesh.rotation.z=Math.sin(time*16+p.x*.02)*.12;
            p._hybrid3dVisible=true;
        }
        for(const [projectile,mesh]of this.enemyMissiles){
            if(!current.has(projectile)){
                this.rigs.release(mesh);this.enemyMissiles.delete(projectile);
                projectile._hybrid3dVisible=false;
            }
        }
    }

    syncGuns(sources,centerX,centerY,width,height,time) {
        const current=new Set();
        let drawn=0;
        for(const source of (sources||[])){
            if(drawn>=this.quality.turretModels)break;
            const x=Number(source.x),y=Number(source.y);
            if(!Number.isFinite(x)||!Number.isFinite(y)||
                Math.abs(x-centerX)>width*.65||Math.abs(y-centerY)>height*.65)continue;
            const key=source.key||source;
            current.add(key);drawn++;
            const id=source.level>=5?19162:source.level>=3?19160:19159;
            let item=this.guns.get(key);
            if(!item||item.id!==id){
                if(item){this.rigs.release(item.mesh);this.guns.delete(key);}
                if(!this.models.has(id)){
                    this.model(id).catch(()=>{});
                    continue;
                }
                const mesh=this.rigs.acquire(this.models.get(id),source.span||62,'#70dccc');
                this.scene.add(mesh);item={id,mesh};this.guns.set(key,item);
            }
            item.mesh.visible=true;
            item.mesh.position.set(x,4,y);
            item.mesh.rotation.y=turretHeading(source.angle||0);
            item.mesh.rotation.x=0;
            item.mesh.rotation.z=source.flash>0?Math.sin(time*55)*.025:0;
            item.mesh.scale.setScalar(source.disabled?.8:1);
        }
        for(const [key,item]of this.guns)if(!current.has(key)){
            this.rigs.release(item.mesh);this.guns.delete(key);
        }
    }

    syncScenery(sources,centerX,centerY,width,height,time=0,player=null){
        const visible=new Set();
        let count=0;
        for(const src of (sources||[])){
            if(count>=this.quality.sceneryModels || !Number.isFinite(src.x)||!Number.isFinite(src.y) ||
                Math.abs(src.x-centerX)>width*.83 ||
                Math.abs(src.y-centerY)>height*.83)continue;
            const id=typeof src.model==='number'?src.model:String(src.model),key=String(src.id);
            if(!this.models.has(id)){
                this.model(id).catch(error=>console.warn('Scenery GLB unavailable',id,error));
                continue;
            }
            count++;
            visible.add(key);
            let node=this.scenery3d.get(key);
            if(!node || node.id!==id){
                if(node)this.rigs.release(node.mesh);
                const mesh=this.rigs.acquire(this.models.get(id),src.span||130,src.tint||'#a9c3d1');
                this.scene.add(mesh);
                // Give each scenery instance its own opacity controls. The
                // pooled geometry stays shared; only its materials are cloned.
                if(!mesh.userData.sceneryFades){
                    const fades=[];
                    mesh.traverse(part=>{
                        if(!part.isMesh)return;
                        const cloneMaterial=original=>{
                            const copy=original.clone();
                            copy.userData.sceneryBaseOpacity=original.opacity??1;
                            copy.userData.sceneryOriginalTransparent=original.transparent;
                            copy.userData.sceneryOriginalDepthWrite=original.depthWrite;
                            copy.transparent=true;copy.depthWrite=false;
                            fades.push(copy);this.rigs.materials.add(copy);
                            return copy;
                        };
                        part.material=Array.isArray(part.material)?
                            part.material.map(cloneMaterial):cloneMaterial(part.material);
                    });
                    mesh.userData.sceneryFades=fades;
                }
                node={id,mesh,phase:(key.length*.41+src.x*.007),
                    visibleLastFrame:false,appearAt:time};
                this.scenery3d.set(key,node);
            }
            if(!node.visibleLastFrame)node.appearAt=time;
            node.visibleLastFrame=true;
            node.mesh.visible=true;
            // Gradually dim scenery around the corvette so it never pops out
            // of existence; nearby machinery remains faintly visible.
            const clearance=Math.max(160,(src.span||130)*.78+85);
            const d=player?Math.hypot(src.x-player.x,src.y-player.y):Infinity;
            const proximity=clamp((d-clearance*.35)/(clearance*.9),.18,1);
            const fadeIn=clamp((time-node.appearAt)/.35,0,1);
            const margin=Math.min(width*.83-Math.abs(src.x-centerX),
                height*.83-Math.abs(src.y-centerY));
            const edgeFade=clamp(margin/Math.max(75,Math.min(width,height)*.17),0,1);
            const alpha=proximity*fadeIn*edgeFade;
            for(const mat of node.mesh.userData.sceneryFades||[]){
                mat.opacity=(mat.userData.sceneryBaseOpacity??1)*alpha;
                // Keep the shader variant stable while the player moves.
                // Toggling transparent/depthWrite at alpha=0.995 triggered
                // repeated GPU program recompilation around scenery edges.
            }
            node.mesh.position.set(src.x,src.height||0,src.y);
            node.mesh.rotation.y=src.yaw||0;
            node.mesh.rotation.z=0;
            // Mechanical animation is limited to powered equipment. The
            // derelict initially stays eerily still; repairs wake it up.
            if(src.powered){
                if(/sensor|telescope|listening|array/.test(key)){
                    node.mesh.rotation.y+=Math.sin(time*.51+node.phase)*.43;
                    node.mesh.rotation.z=Math.sin(time*.63+node.phase)*.035;
                }else if(/refinery|pod|vault|gantry|vent|frame/.test(key)){
                    node.mesh.rotation.y+=time*.07;
                    node.mesh.position.y+=Math.sin(time*1.6+node.phase)*.8;
                }
            }
        }
        // Station props are static. Reuse loaded rigs when revisiting a sector;
        // cloning and reallocating 3D materials every time caused GPU churn.
        for(const [key,node]of this.scenery3d) {
            if(!visible.has(key)){
                node.mesh.visible=false;node.visibleLastFrame=false;
            }
        }
    }

    syncBaseTurrets(bases){
        const guns=[];
        for(const base of (bases||[])){
            if(base.hp<=0||!base.discovered ||
                (base.id?.startsWith('prologue-')&&!base.activated))continue;
            for(const turret of base.turrets||[]){
                if(turret.disabled||(turret.integrity??100)<=0)continue;
                const a=((turret.mount||0)-2)*Math.PI/4;
                guns.push({key:base.id+':'+turret.mount,x:base.x+Math.cos(a)*78,
                    y:base.y+Math.sin(a)*78,angle:turret.aimAngle??a,
                    level:turret.level,flash:turret.flash,disabled:turret.disabled,
                    span:turret.level>=3?70:56});
            }
        }
        return guns;
    }

    resize(width,height){
        const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
        if(w===this.width&&h===this.height)return;
        this.width=w;this.height=h;
        this.renderer.setSize(w,h,false);
    }

    render({player,centerX,centerY,logicalWidth,logicalHeight,cssWidth,cssHeight,time=0,
        campaign=null,workshop=false,enemies=[],enemyProjectiles=[],bases=[],
        turrets=null,scenery=[],stellarWindows=[],active=true,quality=null}={}){
        if(this.disposed||this.contextLost){this.resetActorFlags();return;}
        if(quality)this.setQuality(quality);
        if(!active||!player){
            if(this.playerRig)this.playerRig.visible=false;
            this.resetActorFlags();
            this.renderer.clear();return;
        }
        if(cssWidth>0 && cssHeight>0){
            this.resize(cssWidth,cssHeight);this.needsResize=false;
        }else if(this.needsResize){
            const rect=this.source.getBoundingClientRect();
            this.resize(rect.width,rect.height);this.needsResize=false;
        }
        if(!this.width||!this.height)return;
        const hw=logicalWidth/2,hh=logicalHeight/2;
        if(this.logicalWidth!==logicalWidth || this.logicalHeight!==logicalHeight){
            this.logicalWidth=logicalWidth;this.logicalHeight=logicalHeight;
            this.camera.left=-hw;this.camera.right=hw;
            this.camera.top=hh;this.camera.bottom=-hh;
            this.camera.updateProjectionMatrix();
        }
        this.camera.position.set(centerX,1100,centerY);
        this.camera.lookAt(centerX,0,centerY);
        this.player=player;
        if(this.playerRig)this.playerRig.visible=false;
        if(stellarWindows?.length && !this.stellarWindows)
            this.stellarWindows=new StellarWindows3D(this.scene);
        this.stellarWindows?.update(stellarWindows,time,centerX,centerY,
            logicalWidth,logicalHeight);
        if(this.mode==='campaign'){
            this.syncBosses(enemies,centerX,centerY,logicalWidth,logicalHeight,time);
            this.syncEnemies(enemies,centerX,centerY,logicalWidth,logicalHeight,player,time);
            // Prologue robots stay Canvas2D: no skinned GLB clones or mixers.
            this.syncEnemyMissiles(enemyProjectiles,centerX,centerY,
                logicalWidth,logicalHeight,time);
            this.syncGuns(this.syncBaseTurrets(bases),centerX,centerY,logicalWidth,logicalHeight,time);
        }else{
            this.syncGuns(turrets,centerX,centerY,logicalWidth,logicalHeight,time);
        }
        // Gameplay actors get GLB download priority; static setpieces follow.
        this.syncScenery(scenery,centerX,centerY,logicalWidth,logicalHeight,time,player);
        this.renderer.render(this.scene,this.camera);
    }

    setQuality(quality){
        if(this.quality.pixelRatio!==quality.pixelRatio){
            this.renderer.setPixelRatio(quality.pixelRatio);
            this.width=this.height=0;this.needsResize=true;
        }
        this.quality=quality;
    }

    resetActorFlags(){
        if(this.player)this.player._hybrid3dVisible=false;
        for(const key of this.bosses.keys())key._hybrid3dVisible=false;
        for(const key of this.enemies3d.keys())key._hybrid3dVisible=false;
        for(const key of this.enemyMissiles.keys())key._hybrid3dVisible=false;
        this.prologueRobots?.reset();
    }

    disable(error) {
        if(this.disposed)return;
        if(error)console.warn('Survivor: 3D models unavailable, using Canvas2D',error);
        this.ready=false;
        this.disposed=true;
        for(const task of this.modelQueue)task.reject(new Error('Renderer disposed'));
        this.modelQueue.length=0;
        this.generation++;
        this.canvas.remove();
        this.resetActorFlags();
        this.resizeObserver?.disconnect();
        window.removeEventListener('resize',this._resizeHandler);
        for(const resource of this.shipResources)resource.dispose();
        this.shipResources.length=0;
        this.stellarWindows?.dispose();
        this.prologueRobots?.dispose();
        this.rigs.dispose();
        disposeSources(this.models.values());
        this.models.clear();
        for(const [key] of this.bosses)key._hybrid3dVisible=false;
        for(const [key] of this.enemies3d)key._hybrid3dVisible=false;
        if(this.onDisabled)this.onDisabled();
        this.bosses.clear();this.enemies3d.clear();this.enemyMissiles.clear();
        this.guns.clear();this.scenery3d.clear();this.scene.clear();
        this.playerRig=null;this.shipFlames.length=0;this.shipTurrets.length=0;
        this.renderer.dispose();
    }
}

