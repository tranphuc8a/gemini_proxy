var box = document.getElementById("display-box");

function addToScreen(x){
    box.value += x;
    if(x=="c"||x=="C"){
      box.value="";
    }    

}

function showTime(){
      var time = new Date();
      var hour= time.getHours();

      var minutes = time.getMinutes();
      var seconds = time.getSeconds();
        var completeTime = hour+":"+minutes+":"+seconds;
      document.getElementById("timer").innerHTML= completeTime;

    }

function answer(){
  x=box.value;
  x=eval(x);
  box.value=x;
}

function backspace(){
  var x = box.value;
  var lengthAfterDeletion= x.length-1;
  var newNumbers = x.substring(0,lengthAfterDeletion);
  box.value = newNumbers;
  
}


function calc(id){
  
  switch(id){
      
      case "power2":
        var y=2;
        var x = box.value;
        var result = Math.pow(x,y);
        box.value= result;
     break;
      
      case "power3":
        var y=3;
        var x = box.value;
        var result = Math.pow(x,y);
        box.value= result;
     break;
      
    case "logx":
        var x = box.value;
        box.value = Math.log(x);
    break;
      
    case "sqrt":
      x=box.value;
      box.value=Math.sqrt(x);
      break;
      
    case "exponential":
      x=box.value;
      box.value=Math.exp(x);
      break;
      
    case "sin":
      x=box.value;
      box.value=Math.sin(x);
      break;
      
    case "asin":
      x=box.value;
      box.value=Math.asin(x);
      break;
      
    case "cos":
      x=box.value;
      box.value=Math.cos(x);
      break;
      
    case "acos":
      x=box.value;
      box.value=Math.acos(x);
      break;
      
    case "tan":
      x=box.value;
      box.value = Math.tan(x);
      break;
    case "atan":
      x= box.value;
      box.value= Math.atan(x);
      break;
    case "fact":
      x=box.value;
      
      y=1;
      for(var i=1; i<=x; i++){
        y=y*i;
      }
      box.value=y;
      
      break;
      
  }
  
}