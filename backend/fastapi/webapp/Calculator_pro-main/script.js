const buttons = [
    'C', '←', '(', ')', 'π', 'e',
    'sin', 'cos', 'tan', 'log', 'ln', '√',
    '7', '8', '9', '/', '^', '%',
    '4', '5', '6', '*', 'exp', '!',
    '1', '2', '3', '-', 'abs', 'mod',
    '0', '.', '+', '='
  ];
  
  const display = document.getElementById('display');
  const buttonsContainer = document.getElementById('buttons');
  const historyList = document.getElementById('historyList');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  
  let input = '';
  let history = [];
  
  // Timer
  const timerDisplay = document.getElementById('timerDisplay');
  const startStopBtn = document.getElementById('startStopBtn');
  const resetBtn = document.getElementById('resetBtn');
  
  let timerInterval = null;
  let timerStart = null;
  let elapsed = 0;
  
  // Factorial
  function factorial(n) {
    if (n < 0) return NaN;
    if (n === 0 || n === 1) return 1;
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
  }
  
  // Display
  function updateDisplay() {
    display.textContent = input || '0';
  }
  
  // History
  function addHistory(entry) {
    history.push(entry);
    if (history.length > 20) history.shift(); // limit to 20
    renderHistory();
  }
  
  function renderHistory() {
    historyList.innerHTML = '';
    history.slice().reverse().forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      historyList.appendChild(li);
    });
  }
  
  clearHistoryBtn.addEventListener('click', () => {
    history = [];
    renderHistory();
  });
  
  // Calculation
  function calculate(expr) {
    try {
      let replaced = expr
        .replace(/π/g, Math.PI)
        .replace(/e/g, Math.E)
        .replace(/√/g, 'Math.sqrt')
        .replace(/sin/g, 'Math.sin')
        .replace(/cos/g, 'Math.cos')
        .replace(/tan/g, 'Math.tan')
        .replace(/log/g, 'Math.log10')
        .replace(/ln/g, 'Math.log')
        .replace(/exp/g, 'Math.exp')
        .replace(/abs/g, 'Math.abs')
        .replace(/mod/g, '%')
        .replace(/\^/g, '**');
  
      // Replace factorials
      while (replaced.includes('!')) {
        replaced = replaced.replace(/(\d+)!/, (_, num) => factorial(parseInt(num)));
      }
  
      // Percent handling
      replaced = replaced.replace(/(\d+)%/g, '($1/100)');
  
      const result = Function('"use strict"; return (' + replaced + ')')();
  
      if (
        result === undefined ||
        result === Infinity ||
        Number.isNaN(result)
      ) {
        return 'Error';
      }
  
      return Math.round(result * 1e12) / 1e12;
    } catch (e) {
      return 'Error';
    }
  }
  
  // Button handling
  function handleClick(val) {
    if (val === 'C') {
      input = '';
    } else if (val === '←') {
      input = input.slice(0, -1);
    } else if (val === '=') {
      const res = calculate(input);
      addHistory(`${input} = ${res}`);
      input = res.toString();
    } else {
      if (input === 'Error') input = '';
      input += val;
    }
    updateDisplay();
  }
  
  // Create buttons
  buttons.forEach(btn => {
    const button = document.createElement('button');
    button.textContent = btn;
    if (btn === '=') button.classList.add('equal');
    button.addEventListener('click', () => handleClick(btn));
    buttonsContainer.appendChild(button);
  });
  
  updateDisplay();
  renderHistory(); // Initial rendering of history
  
  // --- TIMER ---
  function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }
  
  function startTimer() {
    if (timerInterval) return;
    timerStart = Date.now() - elapsed;
    timerInterval = setInterval(() => {
      elapsed = Date.now() - timerStart;
      timerDisplay.textContent = formatTime(elapsed);
    }, 1000);
    startStopBtn.textContent = 'Stop';
  }
  
  function stopTimer() {
    if (!timerInterval) return;
    clearInterval(timerInterval);
    timerInterval = null;
    startStopBtn.textContent = 'Start';
  }
  
  startStopBtn.addEventListener('click', () => {
    if (timerInterval) stopTimer();
    else startTimer();
  });
  resetBtn.addEventListener('click', () => {
    stopTimer();
    elapsed = 0;
    timerDisplay.textContent = '00:00:00';
  });
