/**
 * Mission 00 observation-window art.
 * Real NASA/SDO AIA 304 surface imagery is projected onto an animated
 * volumetric-looking star. The window is a world-space 3D plane: its shader
 * ray-intersects a sphere while the physical metal framing remains 3D geometry.
 * Both windows see the same slowly rotating solar longitude.
 */
import * as THREE from './vendor/three.module.js';

const VERT = [
    'varying vec2 vUv;',
    'void main(){',
    '  vUv=uv;',
    '  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);',
    '}'
].join('\n');

const FRAG = [
    'precision highp float;',
    'uniform sampler2D uSolar;',
    'uniform sampler2D uNebula;',
    'uniform float uTime;',
    'uniform float uAspect;',
    'uniform float uPulse;',
    'varying vec2 vUv;',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float noise(vec2 p){',
    ' vec2 i=floor(p), f=fract(p);f=f*f*(3.0-2.0*f);',
    ' return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),',
    ' mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);',
    '}',
    'float fbm(vec2 p){',
    ' float a=.5,v=0.;',
    ' for(int i=0;i<3;i++){v+=a*noise(p);p=p*2.03+11.7;a*=.5;}',
    ' return v;',
    '}',
    'void main(){',
    ' vec2 uv=vUv;',
    ' vec2 back=uv+vec2(.0018*uTime,.0006*uTime);',
    ' vec3 nebula=texture2D(uNebula,clamp(back,0.005,.995)).rgb;',
    ' vec3 col=mix(vec3(.002,.008,.025),nebula*.38,.72);',
    ' vec2 cells=floor(uv*vec2(110.,52.));',
    ' vec2 jitter=fract(uv*vec2(110.,52.));',
    ' float sparkle=step(.996,hash(cells))*',
    '    (1.-smoothstep(.014,.12,length(jitter-vec2(.5))));',
    ' col+=vec3(.57,.72,1.)*sparkle*.75;',
    ' // A sphere in a wide rectangular window: its silhouette is never a flat circle.',
    ' vec2 q=vec2((uv.x-.64)*uAspect,(uv.y-.46));',
    ' float radius=.705;',
    ' float r=length(q)/radius;',
    ' float angle=atan(q.y,q.x);',
    ' float cycle=.5+.5*sin(uTime*.19-.9);',
    ' float activity=cycle*cycle*(3.-2.*cycle);',
    ' float coronaMotion=noise(q*5.0+vec2(.15*uTime,.06*uTime));',
    ' float filament=noise(vec2(angle*5.5+uTime*.09, r*7.-uTime*.46));',
    ' float halo=exp(-max(0.,r-1.)*mix(6.4,2.9,activity))*(.30+.55*activity+.35*coronaMotion);',
    ' float prominenceDistance=(r-1.08-.13*activity)/(.10+.17*activity);',
    ' float prominences=exp(-prominenceDistance*prominenceDistance)*',
    '    smoothstep(.46,.86,filament)*(.10+.65*activity);',
    ' float hot=clamp(halo*.56+prominences,0.,.85);',
    ' col+=vec3(1.0,.38,.10)*hot*(.75+.65*activity);',
    ' col+=vec3(1.0,.69,.28)*exp(-max(0.,r-1.)*13.)*.12;',
    ' if(r<1.){',
    '   // 3D hemisphere and two different time scales for rotation and convection.',
    '   vec3 n=vec3(q/radius,sqrt(max(0.,1.-r*r)));',
    '   float spin=uTime*.024;',
    '   mat2 rot=mat2(cos(spin),-sin(spin),sin(spin),cos(spin));',
    '   vec2 surface=rot*n.xy;',
    '   vec2 slow=surface*6.7+vec2(uTime*.068,-uTime*.052);',
    '   float cells=fbm(slow*3.2);',
    '   float currents=noise(slow*1.35+vec2(cells*.23,0.));',
    '   vec2 displacement=.015*vec2(cells-.5,currents-.5);',
    '   // SDO 304 is a false-colour extreme-UV solar observation, not a photo.',
    '   vec3 measured=texture2D(uSolar,vec2(.5)+surface*.448+displacement).rgb;',
    '   float granular=noise(surface*57.+vec2(uTime*.37,-uTime*.29));',
    '   float latitude=1.-pow(1.-n.z,1.45);',
    '   vec3 solar=mix(vec3(.62,.065,.008),vec3(1.,.36,.075),',
    '                  clamp(measured.r*.77+measured.g*.44,0.,1.));',
    '   solar=mix(solar,measured*vec3(1.35,.91,.58),.48);',
    '   solar*= (.72+.42*currents+.23*granular)*(.82+.30*activity);',
    '   solar*=.69+.31*latitude;',
    '   solar+=vec3(.50,.20,.04)*pow(n.z,5.)*.5;',
    '   solar+=vec3(.18,.075,.02)*uPulse;',
    '   float edge=1.-smoothstep(.979,1.,r);',
    '   col=mix(col,solar+vec3(.20,.085,.025),edge);',
    ' }',
    ' // Glare on multi-layer observation glass; glass remains translucent.',
    ' float glint=exp(-abs(q.y)*26.)*exp(-abs(q.x)*2.4);',
    ' col+=vec3(.28,.15,.065)*glint*(1.+uPulse*.3);',
    ' col+=vec3(.040,.074,.105)*pow(max(0.,uv.y-.58),2.)*1.25;',
    ' gl_FragColor=vec4(col,1.0);',
    '}'
].join('\n');

function frameBar(w,h,x,y,z,material){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,7),material);
    mesh.position.set(x,y,z);
    return mesh;
}
function makeWindow(spec,surface,nebula){
    const {w,h}=spec;
    const root=new THREE.Group();
    root.rotation.x=-Math.PI/2;
    root.position.set(spec.x+w/2,-18,spec.y+h/2);
    const pane=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.ShaderMaterial({
        vertexShader:VERT,fragmentShader:FRAG,
        uniforms:{
            uSolar:{value:surface},uNebula:{value:nebula},
            uTime:{value:0},uAspect:{value:w/h},uPulse:{value:0}
        },
        side:THREE.DoubleSide,depthWrite:true,depthTest:true,toneMapped:false
    }));
    pane.position.z=0;
    root.add(pane);
    const metal=new THREE.MeshStandardMaterial({
        color:0x263d4d,metalness:.76,roughness:.33,
        emissive:0x0b1924,emissiveIntensity:.32
    });
    const inlay=new THREE.MeshStandardMaterial({
        color:0x88a6b7,metalness:.85,roughness:.24,
        emissive:0x203746,emissiveIntensity:.45
    });
    const seal=new THREE.MeshBasicMaterial({color:0x426879});
    root.add(frameBar(w+18,25,0,h/2,6,metal));
    root.add(frameBar(w+18,25,0,-h/2,6,metal));
    root.add(frameBar(25,h+14,-w/2,0,6,metal));
    root.add(frameBar(25,h+14,w/2,0,6,metal));
    root.add(frameBar(w+8,3,0,h/2-13,8,inlay));
    root.add(frameBar(w+8,3,0,-h/2+13,8,inlay));
    for(let i=1;i<4;i++){
        const x=-w/2+w*i/4;
        root.add(frameBar(17,h+7,x,0,7,metal));
        root.add(frameBar(2.8,h-29,x-5,0,10,inlay));
        const brace=frameBar(24,8,x,-h/2+17,10,seal);
        root.add(brace);
    }
    // Fine readouts and alternating amber maintenance lamps are architectural
    // details, not floating UI. A low-powered station remains believable.
    const lamp=new THREE.MeshBasicMaterial({color:0xffba74});
    const lights=[];
    for(let i=0;i<6;i++){
        const dot=frameBar(10,3,-w/2+40+i*(w-80)/5,-h/2+13,10,lamp.clone());
        root.add(dot);lights.push(dot);
    }
    const sunlight=new THREE.PointLight(0xffbc79,0,Math.max(560,w*1.3),2);
    sunlight.position.set(w*.12,0,120);
    root.add(sunlight);
    return {root,pane,lights,sunlight,spec};
}

export class StellarWindows3D{
    constructor(scene){
        this.scene=scene;
        this.windows=new Map();
        const loader=new THREE.TextureLoader();
        const solar=new URL('../assets/space/sdo-sun-304.webp',import.meta.url).href;
        const nebula=new URL('../assets/space/nebula_main.jpg',import.meta.url).href;
        this.surface=loader.load(solar);
        this.nebula=loader.load(nebula);
        this.surface.colorSpace=THREE.SRGBColorSpace;
        this.nebula.colorSpace=THREE.SRGBColorSpace;
        this.surface.wrapS=this.surface.wrapT=THREE.ClampToEdgeWrapping;
        this.nebula.wrapS=this.nebula.wrapT=THREE.ClampToEdgeWrapping;
    }
    update(windows,time,centerX,centerY,width,height){
        const active=new Set();
        for(const spec of windows||[]){
            const key=String(spec.id||'star-window');
            active.add(key);
            let rig=this.windows.get(key);
            if(!rig){
                rig=makeWindow(spec,this.surface,this.nebula);
                this.windows.set(key,rig);
                this.scene.add(rig.root);
            }
            const visible=Math.abs(spec.x+spec.w*.5-centerX)<width*.8+spec.w &&
                Math.abs(spec.y+spec.h*.5-centerY)<height*.85+spec.h;
            rig.root.visible=visible;
            if(!visible)continue;
            if(!Number.isFinite(rig.revealAt))rig.revealAt=time;
            const reveal=Math.max(0,1-(time-rig.revealAt)/4.2);
            // Two windows share one solar rotation, with slightly different
            // reflection phases. Emergency lighting modulates only the frame.
            const pulse=.5+.5*Math.sin(time*.19-.9);
            const activity=pulse*pulse*(3-2*pulse);
            rig.pane.material.uniforms.uTime.value=time;
            rig.pane.material.uniforms.uPulse.value=activity*.32+reveal*.72;
            rig.sunlight.intensity=(spec.powered?.42:.20)*(.72+.85*activity);
            for(let i=0;i<rig.lights.length;i++)
                rig.lights[i].material.color.setHex((i+Math.floor(time*.43))%3===0?
                    0xffc080:0x5d95a4);
        }
        for(const [key,rig] of this.windows)if(!active.has(key))rig.root.visible=false;
    }
    dispose(){
        const geometries=new Set(),materials=new Set();
        for(const rig of this.windows.values()){
            rig.root.traverse(node=>{
                if(node.geometry)geometries.add(node.geometry);
                for(const material of [node.material].flat())if(material)materials.add(material);
            });
            this.scene.remove(rig.root);
        }
        for(const geometry of geometries)geometry.dispose();
        for(const material of materials)material.dispose();
        this.surface.dispose();this.nebula.dispose();this.windows.clear();
    }

}
