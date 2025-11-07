let count =0;
let p = function (message){console.log(message)};
for(var i=0;i<10;i++) for(var j=0;j<10;j++){
  let ele = $('.cell').eq(count);
      ele.attr('data-row', i);
      ele.attr('data-col', j);
  count++;
}
$('.info').on('click', function() {
    $('.para').toggleClass('show');
});
$('.tryBtn').on('click', function() {
    $('.para').toggleClass('show');
});
//------------shallow copy 2d array---------
function coppy(arr2d){
  let newArray = arr2d.map(function(arr) {
    return arr.slice();
  });
  return newArray;
  
}
function isEqual(obj1,obj2){
  return Object.keys(obj1).every(
    key => obj2.hasOwnProperty(key)
       && obj2[key] === obj1[key]);
}
// ------------------------------------------

function reverseString(str) {
    return str.split("").reverse().join("");
}

function utility(gameState,x,y)
{
    patternComputer = ["XXXXX", "XXXX-", "XX-XX", "XXX-X", "-XXX-", "XXX--", "-XX-X", //7
            "XX-X-", "--XX-", "-XX--", "XX---", "XX--X", "X-X--", "X---X",  "X--X-", "-X-X-",
             "X-X-X", "--X--", "-X---", "X----"]; //14

    patternMan = ["OOOOO", "OOOO-", "OO-OO", "OOO-O", "-OOO-", "OOO--", "-OO-O", //7
            "OO-OO-", "--OO-", "-OO--", "OO---", "OO--O", "O-O--", "O---O", "O--O-",
             "-O-O-", "O-O-O", "--O--", "-O---", "O----"];


    profit = [200000000.0, 500000.0, 30000.0, 30000.0, 10000.0, 900.0, 450.0, 450.0, 300.0, 200.0,
                    80.0, 50.0, 30.0, 30.0, 30.0, 30.0, 30.0, 15.0, 15.0, 10.0];

    let state=[[],[],[],[],[],[],[],[],[],[]];

    for (i=0; i<10; i++)
    {
        for(j=0; j<10; j++)
        {
            if(gameState[i][j] == 1) state[i][j] = "X";
            else if(gameState[i][j] == -1) state[i][j] = "O";
            else state[i][j] = "-";
        }
    }

    if(state[x][y] == "X")
    {
        state[x][y] = "-";
        mult = 1.0;
        pcProfit = 0.0;

        for(iter=0; iter<5; iter++)
        {
            pr = x + iter; //r for right diagonal
            qr = y - iter; //l for left diagonal
            pl = x + iter;
            ql = y + iter;
            sr = "";
            sl = "";

            for(iterr=0; iterr<5; iterr++)
            {
                if (pr>-1 && pr<10 && qr>-1 && qr<10)
                {
                    sr += state[pr][qr];
                    pr -= 1;
                    qr += 1;
                }


                if (pl>-1 && pl<10 && ql>-1 && ql<10)
                {
                    sl += state[pl][ql];
                    pl -= 1;
                    ql -= 1;
                }

            }

            k = 1;
            sr2 = sr;
            // reverse(sr2.begin(), sr2.end());
            sr2= reverseString(sr2);

            for(i=0; i<20; i++)
                {
                    if(sr == patternMan[i] || sr2 == patternMan[i])
                    {
                        pcProfit += mult * profit[i];
                        //cout<<profit[i]<<endl;
                        k = 0;
                        break;

                    }
                }
            if(k)
            {
                //sr[iter] = 'X';
                sr3 = sr;
                // reverse(sr3.begin(), sr3.end());
                sr3= reverseString(sr3);

                for(i=0; i<20; i++)
                {
                    if(sr == patternComputer[i] || sr3 == patternComputer[i])
                    {
                        pcProfit += mult * profit[i];
                        //cout<<profit[i]<<endl;
                        //k = 0;
                        break;

                    }
                }

            }

            k2 = 1;
            sl2 = sl;
            sl2= reverseString(sl2);
            //reverse(sl2.begin(), sl2.end());

            for(i=0; i<20; i++)
                {
                    if(sl == patternMan[i] || sl2 == patternMan[i])
                    {
                        pcProfit += mult * profit[i];
                        //cout<<profit[i]<<endl;
                        k2 = 0;
                        break;

                    }
                }
            if(k2)
            {
                //sl[iter] = 'X';
                sl3 = sr;
                sl3= reverseString(sl3);
                // reverse(sl3.begin(), sl3.end());

                for(i=0; i<20; i++)
                {
                    if(sl == patternComputer[i] || sl3 == patternComputer[i])
                    {
                        pcProfit += mult * profit[i];
                        //cout<<profit[i]<<endl;
                        //k = 0;
                        break;

                    }
                }

            }


        }

        //up down left right
        for( iter=0; iter<5; iter++)
        {
             pu = x + iter; //r for right diagonal
             qu = y; //l for left diagonal
             ph = x;
             qh = y - iter;
             su = "";
             sh = "";

            for( iterr=0; iterr<5; iterr++)
            {
                if (pu>-1 && pu<10 && qu>-1 && qu<10)
                {
                    su += state[pu][qu];
                    pu -= 1;
                    //qr += 1;
                }


                if (ph>-1 && ph<10 && qh>-1 && qh<10)
                {
                    sh += state[ph][qh];
                    //pl -= 1;
                    qh -= 1;
                }

            }

             k = 1;
             su2 = su;
            // reverse(su2.begin(), su2.end());
            su2= reverseString(su2);
            for( i=0; i<20; i++)
                {
                    if(su == patternMan[i] || su2 == patternMan[i])
                    {
                        pcProfit += mult * profit[i];
                        k = 0;
                        break;

                    }
                }
            if(k)
            {
                //su[iter] = 'X';
                 su3 = su;
                // reverse(su3.begin(), su3.end());
                su3= reverseString(su3);
                for( i=0; i<20; i++)
                {
                    if(su == patternComputer[i] || su3 == patternComputer[i])
                    {
                        pcProfit += mult * profit[i];
                        //k = 0;
                        break;

                    }
                }

            }

             k2 = 1;
             sh2 = sh;
            // reverse(sh2.begin(), sh2.end());
            sh2= reverseString(sh2);
            for( i=0; i<20; i++)
                {
                    if(sh == patternMan[i] || sh2 == patternMan[i])
                    {
                        pcProfit += mult * profit[i];
                        k2 = 0;
                        break;

                    }
                }
            if(k2)
            {
                //sh[iter] = 'X';
                 sh3 = sh;
                // reverse(sh3.begin(), sh3.end());
                sh3= reverseString(sh3);
                for( i=0; i<20; i++)
                {
                    if(sh == patternComputer[i] || sh3 == patternComputer[i])
                    {
                        pcProfit += mult * profit[i];
                        //k = 0;
                        break;

                    }
                }

            }


        }

        return pcProfit;
    }


    else
    {
        state[x][y] = "-";
         mult = 1.0;
         manProfit = 0.0;

        for( iter=0; iter<5; iter++)
        {
             pr = x + iter; //r for right diagonal
             qr = y - iter; //l for left diagonal
             pl = x + iter;
             ql = y + iter;
             sr = "";
             sl = "";

            for( iterr=0; iterr<5; iterr++)
            {
                if (pr>-1 && pr<10 && qr>-1 && qr<10)
                {
                    sr += state[pr][qr];
                    pr -= 1;
                    qr += 1;
                }


                if (pl>-1 && pl<10 && ql>-1 && ql<10)
                {
                    sl += state[pl][ql];
                    pl -= 1;
                    ql -= 1;
                }

            }

             k = 1;
             sr2 = sr;
            // reverse(sr2.begin(), sr2.end());
            sr2= reverseString(sr2);
            for( i=0; i<20; i++)
                {
                    if(sr == patternComputer[i] || sr2 == patternComputer[i])
                    {
                        manProfit += mult * profit[i];
                        k = 0;
                        break;

                    }
                }
            if(k)
            {
                //sr[iter] = 'O';
                 sr3 = sr;
                // reverse(sr3.begin(), sr3.end());
                sr3= reverseString(sr3);
                for( i=0; i<20; i++)
                {
                    if(sr == patternMan[i] || sr3 == patternMan[i])
                    {
                        manProfit += mult * profit[i];
                        //k = 0;
                        break;

                    }
                }

            }

             k2 = 1;
             sl2 = sl;
            // reverse(sl2.begin(), sl2.end());
            sl2= reverseString(sl2);
            for( i=0; i<20; i++)
                {
                    if(sl == patternComputer[i] || sl2 == patternComputer[i])
                    {
                        manProfit += mult * profit[i];
                        k2 = 0;
                        break;

                    }
                }
            if(k2)
            {
                //sl[iter] = 'O';
                 sl3 = sr;
                // reverse(sl3.begin(), sl3.end());
                sl3= reverseString(sl3);
                for( i=0; i<20; i++)
                {
                    if(sl == patternMan[i] || sl3 == patternMan[i])
                    {
                        manProfit += mult * profit[i];
                        //k = 0;
                        break;

                    }
                }

            }


        }

        //up down left right
        for( iter=0; iter<5; iter++)
        {
             pu = x + iter; //r for right diagonal
             qu = y; //l for left diagonal
             ph = x;
             qh = y - iter;
             su = "";
             sh = "";

            for( iterr=0; iterr<5; iterr++)
            {
                if (pu>-1 && pu<10 && qu>-1 && qu<10)
                {
                    su += state[pu][qu];
                    pu -= 1;
                    //qr += 1;
                }


                if (ph>-1 && ph<10 && qh>-1 && qh<10)
                {
                    sh += state[ph][qh];
                    //pl -= 1;
                    qh -= 1;
                }

            }

             k = 1;
             su2 = su;
            // reverse(su2.begin(), su2.end());
            su2= reverseString(su2);
            for( i=0; i<20; i++)
                {
                    if(su == patternComputer[i] || su2 == patternComputer[i])
                    {
                        manProfit += mult * profit[i];
                        k = 0;
                        break;

                    }
                }
            if(k)
            {
                //su[iter] = 'O';
                 su3 = su;
                // reverse(su3.begin(), su3.end());
                su3= reverseString(su3);
                for( i=0; i<20; i++)
                {
                    if(su == patternMan[i] || su3 == patternMan[i])
                    {
                        manProfit += mult * profit[i];
                        //k = 0;
                        break;

                    }
                }

            }

             k2 = 1;
             sh2 = sh;
            // reverse(sh2.begin(), sh2.end());
            sh2= reverseString(sh2);
            for( i=0; i<20; i++)
                {
                    if(sh == patternComputer[i] || sh2 == patternComputer[i])
                    {
                        manProfit += mult * profit[i];
                        k2 = 0;
                        break;

                    }
                }
            if(k2)
            {
                //sh[iter] = 'O';
                 sh3 = sh;
                // reverse(sh3.begin(), sh3.end());
                sh3= reverseString(sh3);
                for( i=0; i<20; i++)
                {
                    if(sh == patternMan[i] || sh3 == patternMan[i])
                    {
                        manProfit += mult * profit[i];
                        //k = 0;
                        break;

                    }
                }

            }


        }

        return manProfit * -1.00;
    }

}


// ----------------------------------------------
let firstTurn = "user";
let totalScore=0,userScore=0,computerScore=0;
let myTurn = false,restart = false;
let inputCell = {row:-1,col:-1};
const maxDepth = 4;
let first = true;
let state = [
  [0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0]
];

options = [];

function init(){
  // reset board
  count = 0;
  for(var i=0;i<10;i++) for(var j=0;j<10;j++){
    let ele = $('.cell').eq(count);
        ele.removeClass('user computer win');
    count++;
  }
  // reset array
  for(var i=0;i<10;i++) for(var j=0;j<10;j++){
    state[i][j] = 0;
  }
  // reset option
  options.length = 0;
  first = true;
}

function win(start,end){
  
  let increI = Math.round((end.x-start.x)/4);
  let increJ = Math.round((end.y-start.y)/4);
    //qDebug()<<"increI "<<increI<<" "<<increJ;
    for(let i=0;i<5;i++){
      let pos1= start.x+increI*i,pos2=start.y+increJ*i;
      let ele = $(`div[data-row=${pos1}][data-col=${pos2}]`);
          ele.addClass('win');
    }
  
}


$('.cell').on('click', function() {
  let classes = $(this).attr('class');
  if(!myTurn || classes.includes("user") || classes.includes("computer")) return;
  myTurn = false;
  let row = Number($(this).attr('data-row'));
  let col = Number($(this).attr("data-col"));
  state[row][col] = -1; // user ------------
  
  $(this).addClass('user');
  let start={x:0,y:0},end={x:0,y:0};
  if(fiveInRow(row,col,start,end)!=0){
    if(firstTurn =="user") firstTurn ="computer";
    else firstTurn ="user";
    win(start,end);
    $('.playBtn').text("Next");
    $('.greeting').text("Congratulations !");
    $('.overlay').toggleClass('show');
    firstTurn = "computer";
    totalScore++;
    $('.userScore').text(`${++userScore}/${totalScore}`);
    $('.computerScore').text(`${computerScore}/${totalScore}`);
    return;
  }
  options = addSpaces(options,{x:row,y:col});
  if(options.length==0){
    $('.greeting').text("Match Draw!");
       return ;
    }
  
  computerTurn();
  
  });

function computerTurn(){
  result  = Max(9999999999,options,1);
  let row,col;
  row = result.second.x; // calculate ------------
  col = result.second.y;
  state[row][col] =1 // computer--------------
  let start={x:0,y:0},end={x:0,y:0};
  let ele = $(`div[data-row=${row}][data-col=${col}]`);
      ele.addClass('computer');
    myTurn = true;
  if(fiveInRow(row,col,start,end)!=0){
    
    win(start,end);
    if(firstTurn =="user") firstTurn ="computer";
    else firstTurn ="user";
    $('.playBtn').text("Next");
    $('.greeting').text("Computer Win !");
    $('.overlay').toggleClass('show');
    totalScore++;
    $('.computerScore').text(`${++computerScore}/${totalScore}`);
    $('.userScore').text(`${userScore}/${totalScore}`);
    return;
  }
  options = addSpaces(options,{x:row,y:col});
  if(options.length==0) $('.greeting').text("Match Draw !");
}

function computerFirstTurn(){
  state[4][4] =1 // computer--------------
  let row = 4,col=4;
  let ele = $(`div[data-row=${row}][data-col=${col}]`);
      ele.addClass('computer');
  options = addSpaces(options,{x:4,y:4});
}
$('.playBtn').on('click',function(){
  let ele = $('.playBtn');
  let text = ele.text();
  if(text=="Play") {
    myTurn = true;
    ele.text("Restart"); 
  }
  else {
    ele.text("Restart"); 
    init();
    $('.overlay').removeClass('show');
    if(firstTurn=="computer") computerFirstTurn();
  }
  
});

 
function addSpaces(crrntSpaces,point){ 
  let lenth;
  let copySpaces =  $.map(crrntSpaces, function (obj) {
    return $.extend({}, obj);
  });
  copySpaces = copySpaces.filter(function(el) { return !isEqual(el,point);});
  for(i = point.x-1;i<=point.x+1;i++)
    for(j=point.y-1;j<=point.y+1;j++){
        if(i<0||j<0||i>=10||j>=10) {
            continue;
        }
        if(state[i][j]!=0) continue;
        lenth = copySpaces.length;
        if(first){
            copySpaces.push({x:i,y:j});
            first=false;
        }
        for(ii=0;ii<lenth;ii++){
            if(isEqual(copySpaces[ii],{x:i,y:j})) break;
            if(ii==lenth-1) copySpaces.push({x:i,y:j});
        }
    }
    return copySpaces;
}

function fiveInRow(i,j,start/*change*/,end/*change*/){
  if(i<0||j<0||i>=10||j>=10){
      console.log("error from fiveInRow()");
      return;
  }
  let value = state[i][j];
  let cnt = 1,jj,ii,row=5;
  jj=j+1;
  start.x=i,start.y=j;
  end.x=i,end.y=j;
  while(jj<10){
      if(state[i][jj]!=value) break;
      cnt++;
      end.x=i,end.y=jj++;
      if(cnt==row) return value;
  }
  jj = j-1;
  while(jj>-1){
      if(state[i][jj]!=value) break;
      cnt++;
      start.x=i,start.y=jj--;
      if(cnt==row) return value;
  }
  cnt = 1;
  ii=i+1;
  start.x=i,start.y=j;
  end.x=i,end.y=j;
  while(ii<10){
      if(state[ii][j]!=value) break;
      cnt++;
      end.x=ii++,end.y=j;
      if(cnt==row) return value;
  }
  ii = i-1;
  while(ii>-1){
      if(state[ii][j]!=value) break;
      cnt++;
      start.x=ii--,start.y=j;
      if(cnt==row) return value;
  }
  cnt = 1;
  ii = i-1; jj = j+1;
  start.x=i,start.y=j;
  end.x=i,end.y=j;
  while(ii>-1 && jj<10){
      if(state[ii][jj]!=value) break;
      cnt++;
      start.x=ii--,start.y=jj++;
      if(cnt==row) return value;
  }
  ii = i+1; jj = j-1;
  while(ii<10 && jj>-1){
      if(state[ii][jj]!=value) break;
      cnt++;
      end.x=ii++,end.y=jj--;
      if(cnt==row) return value;
  }
  cnt = 1;
  ii = i-1; jj = j-1;
  start.x=i,start.y=j;
  end.x=i,end.y=j;
  while(ii>-1 && jj>-1){
      if(state[ii][jj]!=value) break;
      cnt++;
      start.x=ii--,start.y=jj--;
      if(cnt==row) return value;
  }
  ii = i+1; jj = j+1;
  while(ii<10 && jj<10){
      if(state[ii][jj]!=value) break;
      cnt++;
      end.x=ii++,end.y=jj++;
      if(cnt==row) return value;
  }
  return 0;
}

function Max( beta,options, depth){ /// never call with empty options from main
  if(options.length==0) return "draw"; //draw
  let alpha = -9999999999;
  let start={x:0,y:0},end={x:0,y:0};
  let tempPoint,result={first:0,second:0};
  let maxUtil = 200000000.0/depth;
  for(let i=0;i<options.length;i++){
    let option =options[i];
      state[option.x][option.y] = 1;
      if(fiveInRow(option.x,option.y,start,end)!=0){
          result.first = maxUtil;
      }
      else{
          if(depth==maxDepth) {
              result.first = 0/depth;
          }
          else {

              result =  Min(alpha,addSpaces(options,option),depth+1); //9999999999
          }

          if(result.first==0 && depth==1){
              let res = utility(state,option.x,option.y); // 00000000000
              result.first = res/maxDepth;
          }
      }
      state[option.x][option.y] = 0;

      if(alpha<result.first) {

          alpha = result.first;
          tempPoint = option;
      }

      if(alpha>=beta || alpha == maxUtil) break;
  }

  return {first:alpha,second:tempPoint};
}

function Min(alpha,options,depth){
  if(options.length==0) return "draw" //draw
  let beta = 9999999999;
  let result={first:0,second:0}
  let start={x:0,y:0},end={x:0,y:0};
  let maxUtil = -200000000.0/depth;
  for(let i=0;i<options.length;i++){
      let option =options[i];
      state[option.x][option.y] = -1;
      if(fiveInRow(option.x,option.y,start,end)!=0){
          result.first = maxUtil;
      }

      else{
          if(depth==maxDepth) {
              result.first = 0/depth;
          }
          else result =  Max(beta,addSpaces(options,option),depth+1);
      }
      state[option.x][option.y] = 0;
      if(beta>result.first) beta = result.first;
      if((beta<=alpha && result.first!=0) || beta == maxUtil) break;
  }

  return {first:beta,second:""};
}

// ----------------------------------------------------------------------------

//computerFirstTurn();
