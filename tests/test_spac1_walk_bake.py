"""Acceptance checks for offline SPAC-1 walk atlas. Python 3 / Pillow / NumPy."""
import hashlib
import json
import unittest
from pathlib import Path
from PIL import Image
import numpy as np

ROOT=Path(__file__).resolve().parent
if not (ROOT/'walk.webp').exists():
    ROOT=Path(__file__).resolve().parents[1]/'assets/prologue/spac1/runtime-v2'
ATLAS=ROOT/'walk.webp'
AUDIT=ROOT/'walk-audit.json'
NAMES=('S','SW','W','NW','N','NE','E','SE')
SOURCE={0:(0,False),1:(1,False),2:(6,True),3:(3,False),
        4:(4,False),5:(3,True),6:(6,False),7:(7,False)}

class TestSpac1Walk(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.im=np.asarray(Image.open(ATLAS).convert('RGBA'))
        cls.audit=json.loads(AUDIT.read_text())['frames']

    def test_sheet_geometry_and_full_data(self):
        self.assertEqual(self.im.shape,(1280,1280,4))
        self.assertEqual(len(self.audit),64)
        for d in range(8):
            for f in range(8):
                cell=self.im[d*160:(d+1)*160,f*160:(f+1)*160]
                self.assertGreater(int(np.count_nonzero(cell[:,:,3]>100)),800)
                self.assertLess(int(np.count_nonzero(cell[:,0,3]>100)),4)
                self.assertLess(int(np.count_nonzero(cell[:,-1,3]>100)),4)

    def test_source_directions_frames_and_ground(self):
        for d in range(8):
            for f in range(8):
                row=self.audit[d*8+f]
                self.assertEqual(row['index'],d)
                self.assertEqual(row['frame'],f)
                self.assertEqual(row['direction'],NAMES[d])
                self.assertEqual(row['source_row'],SOURCE[d][0])
                self.assertEqual(row['mirror'],SOURCE[d][1])
                self.assertEqual(row['source'],'original' if f%2==0 else 'extra')
                self.assertLessEqual(abs(row['helmet_target_x']-80),.6)
                self.assertLessEqual(abs(row['helmet_target_y']-64),.6)
                self.assertLessEqual(abs(row['sole_target_y']-128),.05)

    def test_actual_pixel_contact_and_no_unintended_angle_change(self):
        for d in range(8):
            soles=[];head_tops=[]
            for f in range(8):
                cell=self.im[d*160:(d+1)*160,f*160:(f+1)*160]
                yy,xx=np.where(cell[:,:,3]>95)
                sole=int(yy.max());head=int(yy.min())
                soles.append(sole);head_tops.append(head)
            self.assertLessEqual(max(soles)-min(soles),2,(d,soles))
            self.assertLessEqual(max(head_tops)-min(head_tops),4,(d,head_tops))

if __name__=='__main__':unittest.main()
