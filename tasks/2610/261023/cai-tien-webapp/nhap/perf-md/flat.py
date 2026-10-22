import json,sys
d=json.load(open(sys.argv[1],encoding='utf-8'))
def flat(x,p=''):
  if isinstance(x,dict):
    for k,v in x.items(): flat(v,p+'.'+k if p else k)
  else: print(p,'=',x)
flat(d)
