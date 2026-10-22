// đuổi đèn tổng quát mod p (luật chữ thập, chữ nhật): đuổi → giải T·t = -r trên GF(p) → bấm t ở hàng 1 → đuổi lại ⇒ tắt hết
function mk(w,h,p){return {w:w,h:h,p:p};}
function press(B,v,i,t){var w=B.w,h=B.h,r=Math.floor(i/w),c=i%w;[[0,0],[-1,0],[1,0],[0,-1],[0,1]].forEach(function(d){var rr=r+d[0],cc=c+d[1];if(rr>=0&&rr<h&&cc>=0&&cc<w)v[rr*w+cc]=(v[rr*w+cc]+t)%B.p;});}
function chase(B,v,log){for(var r=0;r<B.h-1;r++)for(var c=0;c<B.w;c++){var s=v[r*B.w+c];if(s){var t=(B.p-s)%B.p;press(B,v,(r+1)*B.w+c,t);log.push([(r+1)*B.w+c,t]);}}return v.slice((B.h-1)*B.w);}
function inv(a,p){for(var x=1;x<p;x++)if(a*x%p===1)return x;return 0;}
function solveMod(M,b,p){var n=M.length,m=M[0].length,A=M.map(function(r,i){return r.concat([b[i]]);}),row=0,piv=[];
  for(var c=0;c<m&&row<n;c++){var q=-1;for(var i=row;i<n;i++)if(A[i][c]%p){q=i;break;}if(q<0)continue;var t=A[q];A[q]=A[row];A[row]=t;var iv=inv(A[row][c],p);for(var k=0;k<=m;k++)A[row][k]=A[row][k]*iv%p;
    for(i=0;i<n;i++)if(i!==row&&A[i][c]){var f=A[i][c];for(k=0;k<=m;k++)A[i][k]=((A[i][k]-f*A[row][k])%p+p)%p;}piv.push(c);row++;}
  for(var i2=row;i2<n;i2++)if(A[i2][m])return null;var x=new Array(m).fill(0);piv.forEach(function(c,r){x[c]=A[r][m];});return x;}
function topT(B){var T=[];for(var c=0;c<B.w;c++){var v=new Array(B.w*B.h).fill(0);press(B,v,c,1);T.push(chase(B,v,[]));}
  // T[c] = cột c; dựng ma trận w×w hàng = vị trí hàng cuối
  var M=[];for(var i=0;i<B.w;i++){M.push([]);for(c=0;c<B.w;c++)M[i].push(T[c][i]);}return M;}
var seed=12345;function rnd(n){seed=(seed*1103515245+12345)&0x7fffffff;return seed%n;}
var ok=0,bad=0;
[[5,5,2],[5,5,3],[4,4,3],[6,5,3],[7,7,5],[4,4,2],[9,9,2]].forEach(function(cfg){var B=mk(cfg[0],cfg[1],cfg[2]),M=topT(B);
  for(var trial=0;trial<200;trial++){var v=new Array(B.w*B.h).fill(0);for(var q=0;q<B.w*B.h;q++)press(B,v,rnd(B.w*B.h),1+rnd(B.p-1));
    var log=[],r=chase(B,v,log),neg=r.map(function(z){return (B.p-z)%B.p;}),t=solveMod(M,neg,B.p);
    if(!t){bad++;continue;} t.forEach(function(tc,c){if(tc)press(B,v,c,tc);}); chase(B,v,log);
    if(v.every(function(z){return z===0;}))ok++;else bad++;}});
console.log("đuổi đèn + giải hàng 1 tắt hết bàn giải được (5×5,4×4,6×5,7×7,9×9; mod 2/3/5):",ok,"đạt,",bad,"lỗi");
