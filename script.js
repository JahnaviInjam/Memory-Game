/* ============ Data ============ */
const ICONS = [
  "🐶","🐱","🐻","🦊","🐸","🐼","🐷","🐵","🦁","🐯","🐨","🐰",
  "🦉","🐙","🐢","🦄","🐝","🦋","🌸","🍀","🍎","🍋","🍇","🍉",
  "⚽️","🏀","🚗","✈️","🎲","🎧","💎","🧩","⭐️","🌙","☂️","🔥"
]; // 36+ for 6x6 (needs 18 pairs)
const boardEl = document.getElementById("gameBoard");
const panelEl = document.getElementById("scorePanel");
const settingsModal = document.getElementById("settingsModal");
const winModal = document.getElementById("winModal");
const winSummary = document.getElementById("winSummary");

const btnStart = document.getElementById("btnStart");
const btnRestart = document.getElementById("btnRestart");
const btnNewGame = document.getElementById("btnNewGame");
const btnPlayAgain = document.getElementById("btnPlayAgain");
const btnChangeSettings = document.getElementById("btnChangeSettings");

/* ============ Game State ============ */
let options = {
  theme: "icons",        // "icons" | "numbers"
  players: 1,            // 1..4
  grid: 4                // 4 | 6
};

let state = {
  deck: [],
  flipped: [],
  matchedIdx: new Set(),
  lock: false,
  moves: 0,
  timerStarted: false,
  seconds: 0,
  timerHandle: null,
  turn: 0,               // player index 0..players-1
  scores: []
};

/* ============ Helpers ============ */
const $ = (sel) => document.querySelector(sel);

function shuffle(arr){
  for (let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function range(n){ return Array.from({length:n}, (_,i)=>i); }

function buildDeck(){
  const pairsNeeded = options.grid === 4 ? 8 : 18;
  let base;
  if (options.theme === "numbers"){
    base = range(pairsNeeded).map(i => String(i+1).padStart(2,"0"));
  } else {
    if (ICONS.length < pairsNeeded) throw new Error("Not enough icons");
    base = ICONS.slice(0, pairsNeeded);
  }
  const full = [...base, ...base]; // duplicate for pairs
  shuffle(full);
  return full;
}

function resetTimer(){
  clearInterval(state.timerHandle);
  state.seconds = 0;
  state.timerHandle = null;
  state.timerStarted = false;
}

function startTimer(){
  if (state.timerStarted) return;
  state.timerStarted = true;
  state.timerHandle = setInterval(() => {
    state.seconds++;
    renderPanel();
  }, 1000);
}

function timeFmt(s){
  const m = Math.floor(s/60);
  const ss = String(s%60).padStart(2,"0");
  return `${m}:${ss}`;
}

/* ============ Rendering ============ */
function renderBoard(){
  boardEl.classList.toggle("grid-4", options.grid === 4);
  boardEl.classList.toggle("grid-6", options.grid === 6);
  boardEl.innerHTML = "";

  state.deck.forEach((val, idx) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "card";
    card.setAttribute("data-index", idx);
    card.setAttribute("aria-label", "Card");
    card.addEventListener("click", onCardClick);

    // face content
    const front = options.theme === "numbers" ? val : val;
    card.textContent = state.flipped.includes(idx) || state.matchedIdx.has(idx) ? front : "";

    if (state.flipped.includes(idx) || state.matchedIdx.has(idx)) {
      card.classList.add("flipped");
    }

    if (state.matchedIdx.has(idx)){
      card.classList.add("matched");
      card.disabled = true;
    }
    boardEl.appendChild(card);
  });
}

function renderPanel(){
  panelEl.innerHTML = "";

  // Solo stats header
  if (options.players === 1){
    const stats = document.createElement("div");
    stats.className = "stat";
    stats.innerHTML = `
      <div class="label">Moves</div>
      <div class="value">${state.moves}</div>
    `;
    const timer = document.createElement("div");
    timer.className = "stat";
    timer.innerHTML = `
      <div class="label">Time</div>
      <div class="value">${timeFmt(state.seconds)}</div>
    `;
    panelEl.appendChild(stats);
    panelEl.appendChild(timer);
  }

  // Players
  const wrap = document.createElement("div");
  wrap.className = "players";

  for (let i = 0; i < options.players; i++){
    const p = document.createElement("div");
    p.className = "player" + (state.turn === i ? " active" : "");
    if (isGameOver()) {
      // mark winners later in showWin
    }
    p.innerHTML = `
      <div class="badge">${i+1}</div>
      <div class="name">Player ${i+1}</div>
      <div class="score">${state.scores[i] ?? 0}</div>
    `;
    wrap.appendChild(p);
  }
  panelEl.appendChild(wrap);
}

/* ============ Core Game Logic ============ */
function onCardClick(e){
  const card = e.currentTarget;
  const idx = Number(card.getAttribute("data-index"));
  if (state.lock) return;
  if (state.flipped.includes(idx)) return;
  if (state.matchedIdx.has(idx)) return;

  startTimer();

  state.flipped.push(idx);
  renderFlip(idx, true);

  if (state.flipped.length === 2){
    state.lock = true;
    state.moves++;
    const [a,b] = state.flipped;
    const match = state.deck[a] === state.deck[b];

    if (match){
      state.matchedIdx.add(a); state.matchedIdx.add(b);
      state.scores[state.turn] = (state.scores[state.turn] ?? 0) + 1;

      setTimeout(() => {
        state.flipped = [];
        state.lock = false;
        renderBoard();
        renderPanel();

        if (isGameOver()) {
          clearInterval(state.timerHandle);
          showWin();
        }
        // same player's turn continues on a match
      }, 300);

    } else {
      // mismatch → next player's turn
      setTimeout(() => {
        renderFlip(a, false);
        renderFlip(b, false);
        state.flipped = [];
        state.lock = false;

        if (options.players > 1){
          state.turn = (state.turn + 1) % options.players;
        }
        renderPanel();
      }, 800);
    }
  }
}

function renderFlip(index, faceUp){
  const btn = boardEl.querySelector(`.card[data-index="${index}"]`);
  if (!btn) return;
  if (faceUp){
    btn.classList.add("flipped");
    btn.textContent = options.theme === "numbers" ? state.deck[index] : state.deck[index];
  } else {
    btn.classList.remove("flipped");
    btn.textContent = "";
  }
}

function isGameOver(){
  return state.matchedIdx.size === state.deck.length;
}

/* ============ Win Modal ============ */
function showWin(){
  // Build summary
  const totalPairs = state.deck.length / 2;
  if (options.players === 1){
    winSummary.innerHTML = `
      <div class="stat"><div class="label">Time</div><div class="value">${timeFmt(state.seconds)}</div></div>
      <div class="stat"><div class="label">Moves</div><div class="value">${state.moves}</div></div>
      <div class="stat"><div class="label">Pairs</div><div class="value">${totalPairs}</div></div>
    `;
  } else {
    // determine winner(s)
    const max = Math.max(...state.scores);
    winSummary.innerHTML = "";
    state.scores.forEach((s, i) => {
      const row = document.createElement("div");
      row.className = "stat";
      row.innerHTML = `
        <div class="label">Player ${i+1}</div>
        <div class="value">${s} pair${s!==1?"s":""}</div>
      `;
      if (s === max) row.style.outline = "2px solid #16a34a";
      winSummary.appendChild(row);
    });
  }

  winModal.classList.add("open");
}

/* ============ Game Setup / Reset ============ */
function newGameFromModal(){
  const theme = document.querySelector('input[name="theme"]:checked').value;
  const players = Number(document.querySelector('input[name="players"]:checked').value);
  const grid = Number(document.querySelector('input[name="grid"]:checked').value);

  options.theme = theme;
  options.players = players;
  options.grid = grid;

  startNewGame();
  settingsModal.classList.remove("open");
}

function startNewGame(){
  state.deck = buildDeck();
  state.flipped = [];
  state.matchedIdx = new Set();
  state.lock = false;
  state.moves = 0;
  state.turn = 0;
  state.scores = Array.from({length: options.players}, () => 0);
  resetTimer();

  // Build cards
  renderBoard();
  renderPanel();
}

function restartSameSettings(){
  startNewGame();
}

function backToSettings(){
  winModal.classList.remove("open");
  settingsModal.classList.add("open");
}

/* ============ Events ============ */
btnStart.addEventListener("click", newGameFromModal);
btnRestart.addEventListener("click", restartSameSettings);
btnNewGame.addEventListener("click", () => settingsModal.classList.add("open"));
btnPlayAgain?.addEventListener("click", () => {
  winModal.classList.remove("open");
  restartSameSettings();
});
btnChangeSettings?.addEventListener("click", backToSettings);

// Close modals on outside click (optional nicety)
[settingsModal, winModal].forEach(modal => {
  modal.addEventListener("click", (e) => {
    const card = e.target.closest(".modal-card");
    if (!card) {
      // settings modal shouldn't close by outside click before starting a game
      if (modal === settingsModal) return;
      modal.classList.remove("open");
    }
  });
});

/* ============ First load ============ */
/* Keep settings modal open initially; user picks options and starts */
