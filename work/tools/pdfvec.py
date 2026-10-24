# usage: python3 -I pdfvec.py PDF PAGE x0 y0 x1 y1 OUT.svg
# copies the vector drawings that lie inside the rectangle into an SVG (no redrawing); reports text/images/shadings in the rect.
import sys, pymupdf
pdf,pg,x0,y0,x1,y1,out=sys.argv[1],int(sys.argv[2]),*map(float,sys.argv[3:7]),sys.argv[7]
doc=pymupdf.open(pdf); p=doc[pg-1]; R=pymupdf.Rect(x0,y0,x1,y1)
def col(c):
  if c is None: return 'none'
  return '#%02X%02X%02X'%tuple(round(max(0,min(1,v))*255) for v in c[:3])
def f(v): return ('%.3f'%v).rstrip('0').rstrip('.')
paths=[];U=None
for d in p.get_drawings():
  r=d['rect']
  if not (r.x0>=R.x0-0.5 and r.y0>=R.y0-0.5 and r.x1<=R.x1+0.5 and r.y1<=R.y1+0.5): continue
  if r.width>=R.width*0.98 and r.height>=R.height*0.98 and d.get('fill') is not None and d.get('type')=='f' and len(d['items'])<=1: 
     print('skip full-rect background', col(d.get('fill'))); continue
  dd=[];cur=None
  for it in d['items']:
    k=it[0]
    if k=='l':
      a,b=it[1],it[2]
      if cur is None or abs(cur.x-a.x)>1e-3 or abs(cur.y-a.y)>1e-3: dd.append(f'M{f(a.x)} {f(a.y)}')
      dd.append(f'L{f(b.x)} {f(b.y)}'); cur=b
    elif k=='c':
      a,c1,c2,b=it[1:5]
      if cur is None or abs(cur.x-a.x)>1e-3 or abs(cur.y-a.y)>1e-3: dd.append(f'M{f(a.x)} {f(a.y)}')
      dd.append(f'C{f(c1.x)} {f(c1.y)} {f(c2.x)} {f(c2.y)} {f(b.x)} {f(b.y)}'); cur=b
    elif k=='re':
      q=it[1]; dd.append(f'M{f(q.x0)} {f(q.y0)}H{f(q.x1)}V{f(q.y1)}H{f(q.x0)}Z'); cur=None
    elif k=='qu':
      q=it[1]; dd.append(f'M{f(q.ul.x)} {f(q.ul.y)}L{f(q.ur.x)} {f(q.ur.y)}L{f(q.lr.x)} {f(q.lr.y)}L{f(q.ll.x)} {f(q.ll.y)}Z'); cur=None
  if d.get('closePath'): dd.append('Z')
  t=d.get('type'); fill=col(d.get('fill')) if t in('f','fs') else 'none'; stroke=col(d.get('color')) if t in('s','fs') else 'none'
  a=f'<path d="{"".join(dd)}" fill="{fill}"'
  if fill!='none' and d.get('even_odd'): a+=' fill-rule="evenodd"'
  if fill!='none' and (d.get('fill_opacity') or 1)<1: a+=f' fill-opacity="{f(d["fill_opacity"])}"'
  if stroke!='none':
    a+=f' stroke="{stroke}" stroke-width="{f(d.get("width") or 1)}"'
    if (d.get('stroke_opacity') or 1)<1: a+=f' stroke-opacity="{f(d["stroke_opacity"])}"'
    lc=d.get('lineCap'); 
  paths.append((a+'/>',pymupdf.Rect(r),fill,len(d['items'])))
# drop plain background boxes (simple shapes covering the whole of the rest)
def union(L):
  u=None
  for x in L: u=pymupdf.Rect(x[1]) if u is None else u|x[1]
  return u
changed=True
import os
while changed and len(paths)>1 and not os.environ.get('NODROP'):
  changed=False
  for k,(a,r,fill,ni) in enumerate(paths):
    rest=paths[:k]+paths[k+1:]; ur=union(rest)
    if ni<=6 and fill!='none' and r.contains(ur+(1,1,-1,-1)) and (r.width*r.height)>=0.8*(ur.width*ur.height):
      print('dropped background',fill,[round(v) for v in r]); paths=rest; changed=True; break
U=union(paths); paths=[x[0] for x in paths]
txt=[s['text'] for b in p.get_text('dict',clip=R)['blocks'] if b['type']==0 for l in b['lines'] for s in l['spans'] if s['text'].strip()]
imgs=[i for i in p.get_image_info() if pymupdf.Rect(i['bbox']).intersects(R)]
print('paths',len(paths),'text',txt[:10],'images',[(i['width'],i['height'],[round(v) for v in i['bbox']]) for i in imgs][:5])
if U is None: sys.exit('no drawings')
pad=0
svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{f(U.x0)} {f(U.y0)} {f(U.width)} {f(U.height)}">'+''.join(paths)+'</svg>'
open(out,'w').write(svg); print('wrote',out,'bbox',[round(v,1) for v in U])
