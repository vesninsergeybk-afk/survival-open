#!/usr/bin/env python3
"""Offline, reproducible SPAC-1 walk atlas build from approved artwork.

Never modifies idle/attack/wake/death sources. Never warps individual limbs or
alters a sprite at runtime. 8x8 160px cells, ground line y=128.
"""
from __future__ import annotations
import argparse, json, math
from pathlib import Path
from scipy.ndimage import label, binary_dilation, map_coordinates
import numpy as np
from PIL import Image, ImageOps, ImageDraw, ImageFont

CELL=160; FOOT_Y=128; FRAME_COUNT=8; HEIGHT=81
# Use only previously approved source views; corrections are whole-frame mirrors.
SOURCE_ROWS = {0:(0,False),1:(1,False),2:(6,True),3:(3,False),
               4:(4,False),5:(3,True),6:(6,False),7:(7,False)}
NAMES=['S','SW','W','NW','N','NE','E','SE']

def frame(src:Image.Image, column:int, row:int) -> Image.Image:
    # Important: width=887 does not divide evenly into 4 cells.
    w,h=src.size
    return src.crop((round(column*w/4),round(row*h/8),round((column+1)*w/4),round((row+1)*h/8)))

def components(binary):
    """8-connected sprite components; area, bounds and mask label."""
    ids,count=label(binary,structure=np.ones((3,3),dtype='uint8'))
    areas=np.bincount(ids.ravel(),minlength=count+1)
    if len(areas):areas[0]=0
    result=[]
    for i in range(1,count+1):
        if areas[i]<1:continue
        yy,xx=np.where(ids==i)
        result.append((i,int(areas[i]),int(xx.min()),int(yy.min()),
                       int(xx.max())+1,int(yy.max())+1))
    return ids,result

def clean_alpha(im:Image.Image) -> Image.Image:
    """Drop isolated flecks without stripping a disconnected robot hand/foot."""
    pixels=np.array(im.convert('RGBA'))
    ids,parts=components((pixels[:,:,3]>34))
    if not parts:return im
    main=max(parts,key=lambda t:t[1])
    _,_,mx,my,mx1,my1=main
    keep=np.zeros(ids.shape,dtype=bool)
    for i,area,x,y,x1,y1 in parts:
        if i==main[0] or (area>=20 and x1>=mx-12 and x<=mx1+12 and y1>=my-12 and y<=my1+12):
            keep |= ids==i
    keep=binary_dilation(keep,iterations=1)
    pixels[:,:,3]*=keep.astype('uint8')
    return Image.fromarray(pixels)

def head(im:Image.Image) -> dict:
    """Helmet geometric anchor; excludes swinging lower limbs and cannon."""
    ar=np.array(im)
    a=(ar[:,:,3]>95)
    a[89:,:]=False
    ids,parts=components(a)
    candidates=[p for p in parts if p[1]>150]
    if not candidates:raise ValueError('Helmet missing')
    i,_,x,y,x1,y1=max(candidates,key=lambda t:t[1])
    yy,xx=np.where(ids==i)
    ix=xx[yy<min(82,y+70)]
    cx=float(np.median(ix)) if len(ix)>30 else float((x+x1)/2)
    return {'left':x,'top':y,'width':x1-x,'height':y1-y,
            'cx':cx,'cy':float(y+min(y1-y,78)/2)}

def shoe(im:Image.Image, helmet_x:float) -> dict:
    """Bottom edge of the robot's central foot region, excluding red flecks."""
    arr=np.asarray(im)
    mask=(arr[:,:,3]>115)
    yy,xx=np.where(mask & (np.indices(mask.shape)[0]>142) &
                   (abs(np.indices(mask.shape)[1]-helmet_x)<98))
    if not len(yy):raise ValueError('No foot/contact pixels')
    # Percentile ignores isolated single pixels around the sole.
    sole=float(np.percentile(yy,99.2))
    return {'sole':sole,'support_x':float(np.median(xx[yy>=sole-2]))}

def prep_sprites(original:Image.Image, extra:Image.Image):
    all_info=[]
    for direction in range(8):
        source_row,mirror=SOURCE_ROWS[direction]
        views=[]
        for f in range(8):
            src=original if f%2==0 else extra
            im=clean_alpha(frame(src,f//2,source_row))
            if mirror:im=ImageOps.mirror(im)
            hd=head(im);ft=shoe(im,hd['cx'])
            views.append({'image':im,'head':hd,'foot':ft,'frame':f,
                          'source':'original' if f%2==0 else 'extra',
                          'source_row':source_row,'mirror':mirror})
        # Original frames are canonical for helmet proportions. The supplemental
        # sheet consistently has a bigger helmet; normalize it to this width.
        head_target=float(np.median([v['head']['width'] for v in views if v['frame']%2==0]))
        # One canonical physical size for all eight directions; correcting
        # source-derived artwork dimensions is allowed, changing the robot isn't.
        scale_nominal=HEIGHT/float(np.median([v['foot']['sole']-v['head']['top'] for v in views]))
        if not 0.29<=scale_nominal<=0.58:raise ValueError((direction,scale_nominal))
        for v in views:
            correction=head_target/max(1,v['head']['width'])
            correction=np.clip(correction,.86,1.13)
            v['scale']=float(scale_nominal*correction)
            # Keep the same head center and sole floor line; feet travel inside
            # the fixed grounded character footprint.
            v['shift_x']=float(CELL/2-v['head']['cx']*v['scale'])
            v['shift_y']=float(FOOT_Y-v['foot']['sole']*v['scale'])
        all_info.append(views)
    return all_info

def ease(t):
    return t*t*(3-2*t)

def correct_contact(lower:Image.Image, delta:float) -> Image.Image:
    """Offline shin adjustment: anchor torso at y<103; keep boots intact y>121.

    A source frame cannot in general fix BOTH the head/torso and sole with
    one translation. Correcting only the lower segment prevents whole-body
    bobbing or size changes, and happens during the bake, never in the game.
    """
    if abs(delta)<.08:return lower
    ar=np.asarray(lower)
    h,w=ar.shape[:2]
    yy,xx=np.mgrid[:h,:w].astype('float32')
    t=np.clip((yy-102)/20,0,1)
    displacement=(t*t*(3-2*t))*delta
    yy=yy-displacement
    channels=[map_coordinates(ar[:,:,c], [yy,xx], order=1,
                              mode='constant',cval=0) for c in range(4)]
    corrected=np.stack(channels,axis=2).clip(0,255).astype('uint8')
    return Image.fromarray(corrected)

def make_atlas(views):
    atlas=Image.new('RGBA',(CELL*8,CELL*8),(0,0,0,0))
    measurements=[]
    for d,row in enumerate(views):
        # The middle of the helmet is a stable visual proxy for the central
        # armored torso, unlike changing widths of the cannon and the legs.
        ref_head_y=64.0
        for v in row:
            src=v['image'];f=v['frame'];scale=v['scale']
            im=src.resize((round(src.width*scale),round(src.height*scale)),Image.Resampling.LANCZOS)
            x=round(v['shift_x']);y=round(ref_head_y-v['head']['cy']*scale)
            if x<0 or y<0 or x+im.width>CELL or y+im.height>CELL:
                raise ValueError(f'Frame would clip: view {d} frame {f} / {x} {y} size {im.size}')
            single=Image.new('RGBA',(CELL,CELL),(0,0,0,0))
            single.alpha_composite(im,(x,y))
            raw_sole=y+v['foot']['sole']*scale
            correction=FOOT_Y-raw_sole
            # Keep compensation within what is mechanically plausible.
            if abs(correction)>12:raise ValueError(f'Unacceptable lower-leg adjustment {d}/{f}: {correction:.2f}px')
            single=correct_contact(single,correction)
            atlas.alpha_composite(single,(f*CELL,d*CELL))
            measurements.append(dict(direction=NAMES[d],index=d,frame=f,source=v['source'],
                 source_row=v['source_row'],mirror=v['mirror'],scale=round(scale,5),
                 helmet_target_x=round(x+v['head']['cx']*scale,2),
                 helmet_target_y=round(y+v['head']['cy']*scale,2),
                 sole_target_y=round(raw_sole+correction,2),
                 shin_adjustment=round(correction,2),
                 origin_x=x,origin_y=y,
                 helmet_source_width=v['head']['width'],helmet_target_width=round(v['head']['width']*scale,2)))
    return atlas, measurements

def make_contact(atlas:Image.Image,out:Path):
    xunit=230;yunit=240
    plate=Image.new('RGB',(8*xunit,8*yunit),(17,25,35))
    draw=ImageDraw.Draw(plate)
    for d in range(8):
        for f in range(8):
            c=atlas.crop((f*CELL,d*CELL,(f+1)*CELL,(d+1)*CELL))
            # 1.3x previews, with ground marking
            sprite=c.resize((CELL*1+0,CELL*1+0),Image.Resampling.NEAREST)
            px=f*xunit+(xunit-CELL)//2;py=d*yunit+25
            draw.line((px,py+FOOT_Y,px+CELL,py+FOOT_Y),fill=(67,104,121),width=1)
            plate.paste(sprite,(px,py),sprite)
            draw.text((f*xunit+8,d*yunit+7),f'{NAMES[d]} / {f}',fill=(218,238,247))
    plate.save(out)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--original',type=Path,required=True)
    parser.add_argument('--extra',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    args.output.mkdir(parents=True,exist_ok=True)
    orig=Image.open(args.original).convert('RGBA')
    extra=Image.open(args.extra).convert('RGBA')
    if orig.size!=(887,1774) or extra.size!=(887,1774):raise ValueError(f'Unexpected source dimensions {orig.size} {extra.size}')
    rows=prep_sprites(orig,extra)
    atlas,meta=make_atlas(rows)
    atlas.save(args.output/'walk.webp',format='WEBP',quality=94,method=6,exact=True)
    with open(args.output/'walk-audit.json','w') as stream:
        json.dump({'format':'SPAC-1 normalized walk','cell':CELL,'feet':FOOT_Y,
                   'directions':SOURCE_ROWS,'frames':meta},stream,indent=2)
    make_contact(atlas,args.output/'walk-contact.png')
    # Proof that our feet, head and cell placement are stable at final scale.
    for d in range(8):
        m=meta[d*8:(d+1)*8]
        assert all(abs(z['sole_target_y']-FOOT_Y)<1.2 for z in m), (d,m)
        assert all(abs(z['helmet_target_y']-64)<1.2 for z in m), (d,m)
        assert all(abs(z['helmet_target_x']-CELL/2)<1.2 for z in m), (d,m)
    print('SUCCESS: '+str(args.output/'walk.webp'))
    print('size:', (args.output/'walk.webp').stat().st_size,'frames:',len(meta))
    for d in range(8):
        m=meta[d*8:(d+1)*8]
        print(NAMES[d], 'scales:',*[z['scale'] for z in m], 'head widths:',*[z['helmet_target_width'] for z in m])

if __name__=='__main__':main()
