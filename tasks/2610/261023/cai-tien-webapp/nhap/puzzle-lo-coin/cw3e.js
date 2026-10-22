// kiểm độc lập A(6)=4: dựng cây chiến lược rồi mô phỏng cả 64 vector
function pc(x){var c=0;while(x){x&=x-1;c++;}return c;}
var n=+process.argv[2],V=1<<n,memo=new Map();
function solv(set,k){ if(set.length<=1)return {leaf:set[0]}; if(k===0)return null; if(set.length>Math.pow(n+1,k))return null;
  var kk=set.join(",")+"|"+k; if(memo.has(kk))return memo.get(kk); var res=null;
  for(var S=1;S<V&&!res;S++){var bk={},cnt=0;for(var i=0;i<set.length;i++){var c=pc(set[i]&S);(bk[c]||(bk[c]=[])).push(set[i]);}
    var keys=Object.keys(bk); if(keys.length===1)continue; var ch={},ok=true;
    for(var j=0;j<keys.length&&ok;j++){var t=solv(bk[keys[j]],k-1); if(!t)ok=false; else ch[keys[j]]=t;}
    if(ok)res={S:S,ch:ch};}
  memo.set(kk,res);return res;}
var all=[];for(var x=0;x<V;x++)all.push(x);
var K=+process.argv[3],t0=Date.now();var tree=solv(all,K); if(!tree){console.log("n="+n+" K="+K+": KHÔNG giải được",(Date.now()-t0)+" ms");process.exit(0);} console.log("n="+n+" K="+K+": giải được",(Date.now()-t0)+" ms"); var bad=0,maxd=0;
for(var x=0;x<V;x++){var node=tree,d=0;while(node.S!==undefined){node=node.ch[pc(x&node.S)];d++;} if(node.leaf!==x)bad++; maxd=Math.max(maxd,d);}
function sb(S){var o=[];for(var i=0;i<n;i++)if(S>>i&1)o.push(i+1);return "{"+o.join(",")+"}";}
console.log("cây 6 xu: sai",bad,"/ 64, sâu nhất",maxd,"lần cân; phép cân đầu",sb(tree.S));
