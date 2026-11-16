"""Prepare five light CC0 gas overlays for the existing Canvas 2D space sky.

Author of source images: Screaming Brain Studios, Seamless Space Backgrounds (CC0).
The original 512x512 pack is downloaded at build time, never shipped as a zip.
Select only files inspected in assets/space/sbs-review/contact.jpg.
"""
import io,sys,zipfile
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw

SOURCES=[
 ("Purple Nebula/Purple Nebula 5 - 512x512.png",(190,107,230)),
 ("Blue Nebula/Blue Nebula 5 - 512x512.png",(105,194,241)),
 ("Purple Nebula/Purple Nebula 3 - 512x512.png",(241,154,82)),
 ("Purple Nebula/Purple Nebula 7 - 512x512.png",(205,138,236)),
 ("Green Nebula/Green Nebula 3 - 512x512.png",(83,193,174)),
]
root=Path("assets/space/deep-nebula")
root.mkdir(parents=True,exist_ok=True)
archive=zipfile.ZipFile(sys.argv[1])
names=archive.namelist()
contact=Image.new('RGB',(5*220,258),(6,13,29))
p=ImageDraw.Draw(contact)
for i,(suffix,tint) in enumerate(SOURCES):
 matches=[n for n in names if n.endswith(suffix)]
 if len(matches)!=1:raise RuntimeError(f"Missing or duplicate source {suffix}: {matches}")
 original=Image.open(io.BytesIO(archive.read(matches[0]))).convert('RGB')
 assert original.size==(512,512)
 source=np.asarray(original).astype(np.float32)
 bright=np.max(source,axis=2)/255
 # The original star/nebula image is opaque. Remove its dark background
 # so it can add detail without masking the approved sector painting.
 # Keep non-uniform gas structure, dim isolated highlights to protect HUD.
 density=np.clip((bright-.047)*2.85,0,1)
 coverage=np.clip(density*172,0,166)
 tinted=np.array(tint,dtype=np.float32)[None,None,:]
 color=np.clip(tinted*(.69+.38*bright[:,:,None])+
  source*.17,0,255).astype(np.uint8)
 layer=np.empty((512,512,4),np.uint8)
 layer[:,:,:3]=color
 layer[:,:,3]=coverage.astype(np.uint8)
 im=Image.fromarray(layer,'RGBA')
 output=root/f'cloud-{i}.webp'
 im.save(output,'WEBP',quality=84,method=6)
 assert output.stat().st_size<190000,(output,output.stat().st_size)
 print(i,matches[0],"WEBP",output.stat().st_size)
 # Review visible color cloud on the dark background used by the game.
 backdrop=Image.new('RGBA',(512,512),(9,14,31,255))
 faded=im.copy();faded.putalpha(faded.getchannel('A').point(lambda a:round(a*.73)))
 backdrop.alpha_composite(faded)
 contact.paste(backdrop.convert('RGB').resize((212,212),Image.Resampling.LANCZOS),
  (i*220+4,5))
 p.text((i*220+10,224),f'Sector {i} - CC0',fill=(202,229,244))
contact.save(root/'review.jpg',quality=88,optimize=True)
print('PREVIEW_BYTES',(root/'review.jpg').stat().st_size)
