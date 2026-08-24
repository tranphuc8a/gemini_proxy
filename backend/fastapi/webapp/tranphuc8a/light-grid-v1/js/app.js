
let rows=5,cols=5;
let board=[];
let history=[];
let moves=0;

const grid=document.getElementById('grid');

function save(){history.push(JSON.stringify(board));}
function undo(){
 if(history.length){
   board=JSON.parse(history.pop());
   render();
 }
}

function createBoard(){
 rows=+rowsInput.value;
 cols=+colsInput.value;
 board=Array.from({length:rows},()=>Array(cols).fill(0));
 moves=0;
 history=[];
 render();
}

function toggle(r,c){
 if(r<0||c<0||r>=rows||c>=cols)return;
 board[r][c]^=1;
}

function apply(r,c){
 save();
 const mode=modeSelect.value;
 const R=+radiusInput.value;

 if(mode==='self') toggle(r,c);

 if(mode==='cross'){
   [[0,0],[-1,0],[1,0],[0,-1],[0,1]].forEach(d=>toggle(r+d[0],c+d[1]));
 }

 if(mode==='x'){
   [[0,0],[-1,-1],[-1,1],[1,-1],[1,1]].forEach(d=>toggle(r+d[0],c+d[1]));
 }

 if(mode==='neighbors8'){
   for(let dr=-1;dr<=1;dr++)
    for(let dc=-1;dc<=1;dc++)
      toggle(r+dr,c+dc);
 }

 if(mode==='row'){
   for(let j=0;j<cols;j++) toggle(r,j);
 }

 if(mode==='column'){
   for(let i=0;i<rows;i++) toggle(i,c);
 }

 if(mode==='rowColumn'){
   for(let j=0;j<cols;j++) toggle(r,j);
   for(let i=0;i<rows;i++) toggle(i,c);
   toggle(r,c);
 }

 if(mode==='checkerboard'){
   let p=(r+c)%2;
   for(let i=0;i<rows;i++)
    for(let j=0;j<cols;j++)
      if((i+j)%2===p) toggle(i,j);
 }

 if(mode==='knight'){
   [[0,0],[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]
   .forEach(d=>toggle(r+d[0],c+d[1]));
 }

 if(mode==='manhattan'){
   for(let dr=-R;dr<=R;dr++)
    for(let dc=-R;dc<=R;dc++)
      if(Math.abs(dr)+Math.abs(dc)<=R) toggle(r+dr,c+dc);
 }

 if(mode==='square'){
   for(let dr=-R;dr<=R;dr++)
    for(let dc=-R;dc<=R;dc++)
      toggle(r+dr,c+dc);
 }

 moves++;
 render();
}

function render(){
 grid.style.gridTemplateColumns=`repeat(${cols},40px)`;
 grid.innerHTML='';

 let on=0;
 const onColor=onColorInput.value;
 const offColor=offColorInput.value;

 board.forEach((row,r)=>{
   row.forEach((v,c)=>{
      if(v) on++;
      const cell=document.createElement('div');
      cell.className='cell';
      cell.style.background=v?onColor:offColor;
      cell.onclick=()=>apply(r,c);
      grid.appendChild(cell);
   });
 });

 movesLabel.textContent=moves;
 onCount.textContent=on;
}

const rowsInput=document.getElementById('rows');
const colsInput=document.getElementById('cols');
const modeSelect=document.getElementById('mode');
const radiusInput=document.getElementById('radius');
const onColorInput=document.getElementById('onColor');
const offColorInput=document.getElementById('offColor');
const movesLabel=document.getElementById('moves');
const onCount=document.getElementById('onCount');

document.getElementById('createBtn').onclick=createBoard;
document.getElementById('undoBtn').onclick=undo;

document.getElementById('resetBtn').onclick=()=>{
 board.forEach(r=>r.fill(0));
 moves=0;
 render();
};

document.getElementById('randomBtn').onclick=()=>{
 save();
 for(let i=0;i<rows;i++)
  for(let j=0;j<cols;j++)
   board[i][j]=Math.random()<0.5?0:1;
 render();
};

onColorInput.oninput=render;
offColorInput.oninput=render;

createBoard();
