import * as THREE from './vendor/three.module.js';

/** Shared geometry/materials and a bounded pool of reusable model graphs. */
export class ModelInstances {
    constructor(maxFree=48) {
        this.maxFree=maxFree;this.freeCount=0;this.free=new Map();
        this.sources=new WeakMap();this.materials=new Set();this.nextSource=0;
        this.created=0;this.reused=0;this.disposed=false;
    }
    _source(gltf) {
        let record=this.sources.get(gltf);
        if(record)return record;
        const bounds=new THREE.Box3().setFromObject(gltf.scene);
        record={id:++this.nextSource,center:bounds.getCenter(new THREE.Vector3()),
            size:bounds.getSize(new THREE.Vector3()),tints:new Map()};
        this.sources.set(gltf,record);return record;
    }
    acquire(gltf,span,tone) {
        if(this.disposed)throw new Error('Model pool is disposed');
        const record=this._source(gltf),key=record.id+'|'+span+'|'+(tone||'');
        const slots=this.free.get(key);
        let root=slots?.pop();
        if(root){
            this.freeCount--;this.reused++;
            if(!slots.length)this.free.delete(key);
        }else{
            root=new THREE.Group();
            const object=gltf.scene.clone(true);
            const factor=span/Math.max(record.size.x,record.size.z,.05);
            object.position.sub(record.center).multiplyScalar(factor);
            object.scale.setScalar(factor);
            if(tone){
                let tint=record.tints.get(tone);
                if(!tint){tint={color:new THREE.Color(tone),copies:new WeakMap()};record.tints.set(tone,tint);}
                object.traverse(node=>{
                    if(!node.isMesh)return;
                    const recolor=original=>{
                        let copy=tint.copies.get(original);
                        if(!copy){
                            copy=original.clone();
                            if(copy.color)copy.color.lerp(tint.color,.13);
                            if(copy.roughness!==undefined)copy.roughness=Math.min(.9,copy.roughness);
                            tint.copies.set(original,copy);this.materials.add(copy);
                        }
                        return copy;
                    };
                    node.material=Array.isArray(node.material)?node.material.map(recolor):recolor(node.material);
                });
            }
            root.add(object);root.userData.poolKey=key;this.created++;
        }
        root.visible=true;root.position.set(0,0,0);root.rotation.set(0,0,0);root.scale.setScalar(1);
        root.userData.inPool=false;
        return root;
    }
    release(root) {
        if(!root||root.userData.inPool)return;
        root.userData.inPool=true;
        root.removeFromParent();root.visible=false;
        if(this.disposed||this.freeCount>=this.maxFree)return;
        const key=root.userData.poolKey;
        if(!key)return;
        if(!this.free.has(key))this.free.set(key,[]);
        this.free.get(key).push(root);this.freeCount++;root.userData.inPool=true;
    }
    dispose() {
        if(this.disposed)return;
        this.disposed=true;this.free.clear();this.freeCount=0;
        for(const material of this.materials)material.dispose();
        this.materials.clear();this.sources=new WeakMap();
    }
}

/** Source assets own their shared buffers/textures; release each just once. */
export function disposeSources(sources) {
    const geometries=new Set(),materials=new Set(),textures=new Set();
    for(const gltf of sources)gltf.scene.traverse(node=>{
        if(node.geometry)geometries.add(node.geometry);
        for(const material of [node.material].flat()){
            if(!material)continue;
            materials.add(material);
            for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
        }
    });
    for(const geometry of geometries)geometry.dispose();
    for(const material of materials)material.dispose();
    for(const texture of textures)texture.dispose();
}
