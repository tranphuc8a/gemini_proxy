
let rows=8,cols=8,moves=0,board=[],history=[];
const g=id=>document.getElementById(id);
function save(){history.push(JSON.stringify(board));}
function t(r,c){if(r<0||c<0||r>=rows||c>=cols)return;board[r][c]^=1;}
function create(){
 rows=+g('rows').value; cols=+g('cols').value;
 board=Array.from({length:rows},()=>Array(cols).fill(0));
 moves=0; history=[]; render();
}
function apply(r,c){
 save();
 let m=g('mode').value;
 if(m==='self')t(r,c);
 if(m==='cross')[[0,0],[-1,0],[1,0],[0,-1],[0,1]].forEach(d=>t(r+d[0],c+d[1]));
 if(m==='x')[[0,0],[-1,-1],[-1,1],[1,-1],[1,1]].forEach(d=>t(r+d[0],c+d[1]));
 if(m==='neighbors8')for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)t(r+dr,c+dc);
 if(m==='row')for(let j=0;j<cols;j++)t(r,j);
 if(m==='column')for(let i=0;i<rows;i++)t(i,c);
 if(m==='rowColumn'){for(let j=0;j<cols;j++)t(r,j);for(let i=0;i<rows;i++)t(i,c);t(r,c);}
 moves++; persist(); render();
}
function persist(){localStorage.setItem('lights-v2',JSON.stringify({rows,cols,moves,board}));}
function render(){
 const grid=g('grid');
 grid.style.gridTemplateColumns=`repeat(${cols},36px)`;
 grid.innerHTML='';
 let on=0;
 board.forEach((row,r)=>row.forEach((v,c)=>{
   if(v)on++;
   const d=document.createElement('div');
   d.className='cell';
   d.style.background=v?g('onColor').value:g('offColor').value;
   d.onclick=()=>apply(r,c);
   grid.appendChild(d);
 }));
 g('moves').textContent=moves;
 g('onCount').textContent=on;
}
g('create').onclick=create;
g('random').onclick=()=>{save();board=board.map(r=>r.map(()=>Math.random()<0.5?1:0));render();persist();};
g('clear').onclick=()=>{save();board.forEach(r=>r.fill(0));moves=0;render();persist();};
g('undo').onclick=()=>{if(history.length){board=JSON.parse(history.pop());render();persist();}};
g('onColor').oninput=render; g('offColor').oninput=render;

g('exportBtn').onclick=()=>{
 const blob=new Blob([JSON.stringify({rows,cols,board},null,2)],{type:'application/json'});
 const a=document.createElement('a');
 a.href=URL.createObjectURL(blob);
 a.download='board.json'; a.click();
};

g('importFile').onchange=e=>{
 const f=e.target.files[0]; if(!f)return;
 const rd=new FileReader();
 rd.onload=()=>{
   const x=JSON.parse(rd.result);
   rows=x.rows; cols=x.cols; board=x.board;
   g('rows').value=rows; g('cols').value=cols;
   render(); persist();
 };
 rd.readAsText(f);
};

const saved=localStorage.getItem('lights-v2');
if(saved){const s=JSON.parse(saved); rows=s.rows; cols=s.cols; board=s.board; moves=s.moves||0; g('rows').value=rows; g('cols').value=cols; render();}
else create();
