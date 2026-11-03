"""Bake the approved SPAC-1 sheets into equally scaled, grounded game cells.

Requires Pillow, NumPy and SciPy. Source art is retained, never overwritten.
"""
from pathlib import Path
import json
import subprocess
import sys
import numpy as np
from PIL import Image
from scipy.ndimage import label, find_objects

ROOT = Path(__file__).resolve().parents[1] / 'assets/prologue/spac1'
OUT = ROOT / 'runtime-v2'
OUT.mkdir(exist_ok=True)
CELL, FEET, HEIGHT = 160, 128, 81

def cell(name, cols, rows, col, row):
    with Image.open(ROOT/name) as source:
        im=source.convert('RGBA').crop((round(col*source.width/cols),round(row*source.height/rows),
            round((col+1)*source.width/cols),round((row+1)*source.height/rows)))
    a=np.array(im)
    components,count=label(a[:,:,3]>64)
    sizes=np.bincount(components.ravel());sizes[0]=0
    main=int(sizes.argmax())
    # Discard isolated compression/colour debris, retaining attached limbs.
    boxes=find_objects(components)
    box=boxes[main-1]
    y0,y1,x0,x1=box[0].start,box[0].stop,box[1].start,box[1].stop
    keep=[main]
    for i,b in enumerate(boxes,1):
        if b is None or i==main or sizes[i]<max(10,sizes[main]*.004):continue
        if b[1].stop>=x0-10 and b[1].start<=x1+10 and b[0].stop>=y0-10 and b[0].start<=y1+10:
            keep.append(i)
    mask=np.isin(components,keep)
    # Keep antialiased edges within two pixels of the retained components.
    from scipy.ndimage import binary_dilation
    a[:,:,3]=np.where(binary_dilation(mask,iterations=2),a[:,:,3],0)
    yy,xx=np.where(mask)
    box=(max(0,int(xx.min())-2),max(0,int(yy.min())-2),min(im.width,int(xx.max())+3),min(im.height,int(yy.max())+3))
    return Image.fromarray(a).crop(box)

def bake(name, rows):
    sheet=Image.new('RGBA',(CELL*len(rows[0]),CELL*len(rows)))
    for row,frames in enumerate(rows):
        # One scale per source sheet and view, not per animation pose.
        # Wake A/B share a scale. Original/extra compensate source resolution.
        groups={}
        for im,group in frames:groups.setdefault(group,[]).append(im.height)
        scale={g:HEIGHT/float(np.median(h)) for g,h in groups.items()}
        for col,(im,group) in enumerate(frames):
            s=scale[group]
            im=im.resize((max(1,round(im.width*s)),max(1,round(im.height*s))),Image.Resampling.LANCZOS)
            if im.width>CELL-6:raise ValueError((name,row,col,'art exceeds cell'))
            sheet.alpha_composite(im,(col*CELL+(CELL-im.width)//2,row*CELL+FEET-im.height))
    sheet.save(OUT/(name+'.webp'),quality=88,method=6,exact=True)
    return {'file':name+'.webp','cols':len(rows[0]),'rows':len(rows),'bytes':(OUT/(name+'.webp')).stat().st_size}

manifest={}
for state,count in [('idle',6),('attack',8)]:
    rows=[]
    for d in range(8):
        frames=[]
        for f in range(count):
            original=f==0 if state=='idle' else f%2==0
            suffix='original' if original else 'extra'
            cols,rs=(4,2) if state=='idle' and original else (5,8) if state=='idle' else (4,8)
            col,row=(d%4,d//4) if state=='idle' and original else (f-1,d) if state=='idle' else (f//2,d)
            frames.append((cell(f'{state}-{suffix}.png',cols,rs,col,row),suffix))
        rows.append(frames)
    manifest[state]=bake(state,rows)
# Walk is baked by its own audited ground/torso alignment pipeline.
# Never overwrite the approved walk.webp with the legacy per-source scaling.
subprocess.run([
    sys.executable,str(Path(__file__).with_name('pack-spac1-walk.py')),
    '--original',str(ROOT/'walk-original.png'),
    '--extra',str(ROOT/'walk-extra.png'),
    '--output',str(OUT)
],check=True)
walk=OUT/'walk.webp'
manifest['walk']={'file':'walk.webp','cols':8,'rows':8,
                  'bytes':walk.stat().st_size,'revision':'walk-134',
                  'audit':'walk-audit.json'}
for view in ['front','left','back','right']:
    # Keep all 24 poses as one row to retain a single scale across A/B.
    frames=[(cell(f'spac1_wake_{view}_{"a" if f<12 else "b"}.webp',4,3,f%4,(f%12)//4),'wake') for f in range(24)]
    manifest['wake'+view.title()]=bake('wake-'+view,[frames])
(OUT/'manifest.json').write_text(json.dumps({'cell':CELL,'feet':FEET,'height':HEIGHT,'sheets':manifest},indent=2)+'\n')
print(json.dumps(manifest,indent=2))
