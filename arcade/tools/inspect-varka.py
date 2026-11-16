from pathlib import Path
import json
import numpy as np
from PIL import Image
from scipy.ndimage import label, find_objects

result = {}
root = Path('assets/space/varkalandar')
for path in sorted(root.glob('planetoids-*.png')):
    im = Image.open(path).convert('RGBA')
    alpha = np.asarray(im.getchannel('A'))
    groups, count = label(alpha > 24, np.ones((3, 3), dtype=bool))
    rects = []
    for n, box in enumerate(find_objects(groups), 1):
        if box is None:
            continue
        yy, xx = box
        area = int(np.count_nonzero(groups[box] == n))
        if area < 150:
            continue
        x, y = xx.start, yy.start
        w, h = xx.stop - x, yy.stop - y
        rects.append(dict(x=x, y=y, w=w, h=h, area=area,
            cx=x+w/2, cy=y+h/2, lane=round(y+h/2-0.37*(x+w/2),1)))
    result[path.name] = dict(dimensions=im.size, component_count=count,
       asteroid_candidates=len(rects), rects=rects)
    print(path.name, im.size, count, 'filtered', len(rects))
    lane = sorted(rects, key=lambda a:a['lane'])
    for k in range(6):
        chunk = lane[k*12:(k+1)*12]
        if chunk:
            print('row',k,'items',len(chunk),'lane',round(chunk[0]['lane']),round(chunk[-1]['lane']),
                  'x',round(min(x['cx'] for x in chunk)),round(max(x['cx'] for x in chunk)))
(root/'layout-review.json').write_text(json.dumps(result, indent=2))
