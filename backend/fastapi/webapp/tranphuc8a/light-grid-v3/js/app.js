
let rows=8,cols=8,moves=0,board=[],history=[];
const $=id=>document.getElementById(id);

function save(){history.push(JSON.stringify(board));}
function t(r,c){if(r<0||c<0||r>=rows||c>=cols)return;board[r][c]^=1;}

function create(){
 rows=+$('rows').value;
 cols=+$('cols').value;
 board=Array.from({length:rows},()=>Array(cols).fill(0));
 moves=0;history=[];render();
}

function applyMode(r,c){
 save();
 const m=$('mode').value;
 const R=+$('radius').value;

 if(m==='self')t(r,c);

 if(m==='cross')
   [[0,0],[-1,0],[1,0],[0,-1],[0,1]].forEach(d=>t(r+d[0],c+d[1]));

 if(m==='x')
   [[0,0],[-1,-1],[-1,1],[1,-1],[1,1]].forEach(d=>t(r+d[0],c+d[1]));

 if(m==='neighbors8')
   for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)t(r+dr,c+dc);

 if(m==='row')for(let j=0;j<cols;j++)t(r,j);
 if(m==='column')for(let i=0;i<rows;i++)t(i,c);

 if(m==='rowColumn'){
   for(let j=0;j<cols;j++)t(r,j);
   for(let i=0;i<rows;i++)t(i,c);
   t(r,c);
 }

 if(m==='manhattan')
   for(let dr=-R;dr<=R;dr++)
    for(let dc=-R;dc<=R;dc++)
      if(Math.abs(dr)+Math.abs(dc)<=R)t(r+dr,c+dc);

 if(m==='square')
   for(let dr=-R;dr<=R;dr++)
    for(let dc=-R;dc<=R;dc++)
      t(r+dr,c+dc);

 moves++;
 persist();
 render();
}

function render(){
 const grid=$('grid');
 grid.style.gridTemplateColumns=`repeat(${cols},36px)`;
 grid.innerHTML='';

 let on=0;
 for(let r=0;r<rows;r++){
   for(let c=0;c<cols;c++){
      if(board[r][c])on++;
      const d=document.createElement('div');
      d.className='cell';
      d.style.background=board[r][c] ? $('onColor').value : $('offColor').value;
      d.onclick=()=>applyMode(r,c);
      grid.appendChild(d);
   }
 }
 $('moves').textContent=moves;
 $('onCount').textContent=on;
 $('rank').textContent=Math.min(rows*cols, rows+cols);
}

function persist(){
 localStorage.setItem('lights-v3',JSON.stringify({rows,cols,moves,board}));
}

$('create').onclick=create;

$('random').onclick=()=>{
 save();
 for(let r=0;r<rows;r++)
   for(let c=0;c<cols;c++)
      board[r][c]=Math.random()<0.5?0:1;
 render();persist();
};

$('clear').onclick=()=>{
 save();
 board.forEach(x=>x.fill(0));
 moves=0;
 render();persist();
};

$('undo').onclick=()=>{
 if(history.length){
   board=JSON.parse(history.pop());
   render();persist();
 }
};

$('export').onclick=()=>{
 const blob=new Blob([JSON.stringify({rows,cols,board},null,2)]);
 const a=document.createElement('a');
 a.href=URL.createObjectURL(blob);
 a.download='board.json';
 a.click();
};

$('share').onclick=()=>{
 const data=btoa(JSON.stringify({rows,cols,board}));
 const url=location.origin+location.pathname+'#'+data;
 navigator.clipboard.writeText(url);
 alert('Đã copy URL vào clipboard');
};

$('solve').onclick=()=>{
 const res=[];
 for(let r=0;r<rows;r++)
   for(let c=0;c<cols;c++)
      if(board[r][c])res.push(`(${r},${c})`);
 $('solverOutput').textContent =
   'Demo solver (placeholder)\nCác ô đang bật:\n'+res.join(' ');
};

$('onColor').oninput=render;
$('offColor').oninput=render;

const saved=localStorage.getItem('lights-v3');
if(saved){
 const s=JSON.parse(saved);
 rows=s.rows; cols=s.cols; moves=s.moves; board=s.board;
 $('rows').value=rows;
 $('cols').value=cols;
 render();
}else create();
