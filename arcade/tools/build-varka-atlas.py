"""Build one compact animated atlas from three CC-BY asteroid sheets by Varkalandar.

Sources: https://opengameart.org/content/24-bigger-asteroids
License chosen: CC BY 3.0. Original author: Hansjörg Malthaner.
Requires pillow, numpy, scipy (build-time only; not shipped to browser).
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import label, find_objects

ROOT = Path('assets/space/varkalandar')
CELL, FRAMES, ROWS = 96, 12, 6
sources = [ROOT/f'planetoids-{n}.png' for n in (2, 3, 4)]
atlas = Image.new('RGBA', (CELL*FRAMES, CELL*ROWS*len(sources)), (0,0,0,0))
preview = Image.new('RGB', (980, 400), (9,19,32))
paint = ImageDraw.Draw(preview)

for source_i, filename in enumerate(sources):
    rgba = Image.open(filename).convert('RGBA')
    alpha = np.asarray(rgba.getchannel('A'))
    segmentation, count = label(alpha > 24, np.ones((3,3), dtype=bool))
    components = []
    for label_id, rect in enumerate(find_objects(segmentation), 1):
        if rect is None: continue
        ys, xs = rect
        area = int(np.count_nonzero(segmentation[rect] == label_id))
        if area < 150: continue
        x,y = xs.start, ys.start
        w,h = xs.stop-x, ys.stop-y
        components.append((area, y+h/2-.37*(x+w/2), x+w/2,
                           label_id, (x,y,x+w,y+h)))
    assert len(components) in (72,73), (filename,len(components))
    components = sorted(components,reverse=True)[:72]
    components.sort(key=lambda x:x[1])
    for row in range(ROWS):
        frames = sorted(components[row*FRAMES:(row+1)*FRAMES],key=lambda x:x[2])
        assert len(frames) == FRAMES
        centers = [entry[2] for entry in frames]
        assert all(93 < centers[i+1]-centers[i] < 170 for i in range(11)), (filename,row,centers)
        biggest = max(max(entry[4][2]-entry[4][0],
                          entry[4][3]-entry[4][1]) for entry in frames)
        scale = min(1,(CELL-10)/biggest)
        variant = source_i*ROWS+row
        for col,entry in enumerate(frames):
            _,_,_,component_id,rect = entry
            x0,y0,x1,y1=rect
            pixels = rgba.crop(rect)
            img_alpha = np.array(pixels.getchannel('A'),copy=True)
            img_alpha[segmentation[y0:y1,x0:x1] != component_id] = 0
            pixels.putalpha(Image.fromarray(img_alpha,'L'))
            tw = max(1,round((x1-x0)*scale))
            th = max(1,round((y1-y0)*scale))
            pixels = pixels.resize((tw,th),Image.Resampling.LANCZOS)
            atlas.paste(pixels,(col*CELL+(CELL-tw)//2,
                 variant*CELL+(CELL-th)//2))
        # The contact sheet shows positions 0 and 6, two views per rock.
        cx=(variant%6)*160 + 12
        cy=(variant//6)*130+26
        for sample in (0,6):
            patch=atlas.crop((sample*CELL,variant*CELL,
                              (sample+1)*CELL,(variant+1)*CELL))
            target=Image.new('RGBA',(CELL,CELL),(19,32,49,255))
            target.alpha_composite(patch)
            preview.paste(target.convert('RGB'),(cx+(sample//6)*42,cy))
        paint.text((cx,cy-17),f'{variant+1:02d} · {source_i+2}/{row+1}',fill=(212,235,244))
        print('Variant',variant,filename.name,'row',row,'scale',round(scale,3))

out=ROOT/'varkalandar-18x12.png'
atlas.save(out,optimize=True)
preview_path=ROOT/'preview-variants.jpg'
preview.save(preview_path,quality=88,optimize=True)
print('ATLAS',out,atlas.size,out.stat().st_size,'bytes')
print('PREVIEW',preview_path,preview_path.stat().st_size,'bytes')
assert out.stat().st_size < 5_000_000
