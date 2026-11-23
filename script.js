const FIELD_WIDTH = 800;
const FIELD_HEIGHT = 500;

const FORMATION = {
  "blue-gk": { x: 40, y: 250 },
  "blue-def": { x: 200, y: 300 },
  "blue-mid": { x: 330, y: 170 },
  "blue-fw": { x: 400, y: 300 },
  "red-gk": { x: 760, y: 250 },
  "red-def": { x: 600, y: 200 },
  "red-mid": { x: 470, y: 340 },
  "red-fw": { x: 420, y: 150 },
  ball: { x: 200, y: 300 },
};

const STEPS = [
  {
    title: "Passe do zagueiro",
    text: "O zagueiro azul toca a bola para o meio-campo.",
    duration: 1.4,
    kick: "blue-def",
    moves: { "blue-mid": { x: 350, y: 200 } },
    ball: { x: 350, y: 200 },
  },
  {
    title: "Avanço pelo meio",
    text: "O meio-campista avança com a bola, o atacante se posiciona e os vermelhos se aproximam.",
    duration: 1.6,
    moves: {
      "blue-mid": { x: 520, y: 200 },
      "blue-fw": { x: 560, y: 270 },
      "red-mid": { x: 470, y: 250 },
      "red-def": { x: 620, y: 200 },
    },
    ball: { x: 520, y: 200 },
  },
  {
    title: "Passe para o atacante",
    text: "A bola chega ao atacante, que avança em direção ao gol.",
    duration: 1.2,
    kick: "blue-mid",
    moves: {
      "blue-fw": { x: 610, y: 250 },
      "red-mid": { x: 540, y: 270 },
    },
    ball: { x: 610, y: 250 },
  },
  {
    title: "Chute ao gol",
    text: "O atacante chuta forte. O goleiro vermelho se joga, mas não alcança a bola.",
    duration: 0.8,
    kick: "blue-fw",
    moves: { "red-gk": { x: 765, y: 300 } },
    ball: { x: 790, y: 290 },
  },
  {
    title: "Gol!",
    text: "A bola entra no gol e o atacante comemora.",
    duration: 2.2,
    celebrate: "blue-fw",
    goal: true,
  },
];

const STATUS_LABELS = {
  idle: "Aguardando início",
  playing: "Em andamento",
  paused: "Pausado",
  finished: "Finalizado",
};

const START_LABELS = {
  idle: "Iniciar",
  playing: "Iniciar",
  paused: "Continuar",
  finished: "Repetir",
};

const els = {
  field: document.getElementById("field"),
  goalFlash: document.getElementById("goal-flash"),
  btnStart: document.getElementById("btn-start"),
  btnPause: document.getElementById("btn-pause"),
  btnReset: document.getElementById("btn-reset"),
  speedButtons: document.querySelectorAll(".speed-btn"),
  status: document.getElementById("status"),
  stepTitle: document.getElementById("step-title"),
  stepText: document.getElementById("step-text"),
  stepCounter: document.getElementById("step-counter"),
  stepList: document.getElementById("step-list"),
};

const entities = {};

const state = {
  status: "idle",
  stepIndex: 0,
  stepElapsed: 0,
  speed: 1,
  positions: {},
  from: {},
  lastTime: null,
  frameId: null,
};

const clonePositions = (source) =>
  Object.fromEntries(Object.entries(source).map(([id, point]) => [id, { ...point }]));

const lerpPoint = (from, to, t) => ({
  x: from.x + (to.x - from.x) * t,
  y: from.y + (to.y - from.y) * t,
});

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

const movingIds = (step) => {
  const ids = Object.keys(step.moves ?? {});
  if (step.ball) ids.push("ball");
  return ids;
};

function createEntities() {
  for (const id of Object.keys(FORMATION)) {
    const el = document.createElement("div");
    if (id === "ball") {
      el.className = "ball";
    } else {
      const team = id.startsWith("blue") ? "blue" : "red";
      const keeper = id.endsWith("gk") ? " keeper" : "";
      el.className = `player player-${team}${keeper}`;
    }
    els.field.appendChild(el);
    entities[id] = el;
  }
}

function positionElement(el, point) {
  el.style.left = `${(point.x / FIELD_WIDTH) * 100}%`;
  el.style.top = `${(point.y / FIELD_HEIGHT) * 100}%`;
}

function render() {
  for (const [id, el] of Object.entries(entities)) {
    positionElement(el, state.positions[id]);
  }
}

function beginStep(index) {
  const step = STEPS[index];
  state.stepIndex = index;
  state.stepElapsed = 0;
  state.from = clonePositions(state.positions);

  for (const id of movingIds(step)) entities[id].classList.add("moving");
  if (step.kick) entities[step.kick].classList.add("kick");
  if (step.celebrate) entities[step.celebrate].classList.add("celebrate");
  if (step.goal) els.goalFlash.classList.add("show");
}

function endStep(index) {
  const step = STEPS[index];
  for (const id of movingIds(step)) entities[id].classList.remove("moving");
  if (step.kick) entities[step.kick].classList.remove("kick");
}

function update(dt) {
  const step = STEPS[state.stepIndex];
  state.stepElapsed += dt * state.speed;
  const t = Math.min(1, state.stepElapsed / step.duration);
  const eased = easeInOut(t);

  for (const [id, target] of Object.entries(step.moves ?? {})) {
    state.positions[id] = lerpPoint(state.from[id], target, eased);
  }
  if (step.ball) {
    state.positions.ball = lerpPoint(state.from.ball, step.ball, eased);
  }

  if (t < 1) return;

  endStep(state.stepIndex);
  if (state.stepIndex + 1 < STEPS.length) {
    beginStep(state.stepIndex + 1);
  } else {
    state.status = "finished";
  }
  refreshUi();
}

function frame(now) {
  const dt = state.lastTime === null ? 1 / 60 : Math.min((now - state.lastTime) / 1000, 0.05);
  state.lastTime = now;
  update(dt);
  render();
  if (state.status === "playing") {
    state.frameId = requestAnimationFrame(frame);
  }
}

function renderStepInfo() {
  if (state.status === "idle") {
    els.stepTitle.textContent = "Pronto para começar";
    els.stepText.textContent = "Clique em Iniciar para ver a jogada do início ao gol.";
    els.stepCounter.textContent = `0 de ${STEPS.length} passos`;
  } else if (state.status === "finished") {
    els.stepTitle.textContent = "Jogada concluída";
    els.stepText.textContent = "Clique em Repetir para assistir à jogada de novo.";
    els.stepCounter.textContent = `${STEPS.length} de ${STEPS.length} passos`;
  } else {
    const step = STEPS[state.stepIndex];
    els.stepTitle.textContent = step.title;
    els.stepText.textContent = step.text;
    els.stepCounter.textContent = `Passo ${state.stepIndex + 1} de ${STEPS.length}`;
  }
}

function renderStepList() {
  els.stepList.innerHTML = "";
  STEPS.forEach((step, index) => {
    const item = document.createElement("li");
    item.textContent = step.title;
    const finished = state.status === "finished";
    const active = !finished && state.status !== "idle" && index === state.stepIndex;
    if (finished || index < state.stepIndex) item.classList.add("step-done");
    if (active) item.classList.add("step-active");
    els.stepList.appendChild(item);
  });
}

function refreshUi() {
  els.status.textContent = STATUS_LABELS[state.status];
  renderStepInfo();
  renderStepList();
  els.btnStart.textContent = START_LABELS[state.status];
  els.btnStart.disabled = state.status === "playing";
  els.btnPause.disabled = state.status !== "playing";
}

function startAnimation() {
  if (state.status === "playing") return;
  if (state.status === "finished") resetScene();
  if (state.status === "idle") beginStep(0);
  state.status = "playing";
  state.lastTime = null;
  refreshUi();
  state.frameId = requestAnimationFrame(frame);
}

function pauseAnimation() {
  if (state.status !== "playing") return;
  state.status = "paused";
  cancelAnimationFrame(state.frameId);
  refreshUi();
}

function resetScene() {
  cancelAnimationFrame(state.frameId);
  for (const el of Object.values(entities)) {
    el.classList.remove("moving", "kick", "celebrate");
  }
  els.goalFlash.classList.remove("show");

  state.status = "idle";
  state.stepIndex = 0;
  state.stepElapsed = 0;
  state.lastTime = null;
  state.positions = clonePositions(FORMATION);
  render();
  refreshUi();
}

function setSpeed(button) {
  state.speed = Number(button.dataset.speed);
  for (const other of els.speedButtons) {
    other.setAttribute("aria-pressed", String(other === button));
  }
}

els.btnStart.addEventListener("click", startAnimation);
els.btnPause.addEventListener("click", pauseAnimation);
els.btnReset.addEventListener("click", resetScene);
for (const button of els.speedButtons) {
  button.addEventListener("click", () => setSpeed(button));
}

createEntities();
state.positions = clonePositions(FORMATION);
render();
refreshUi();
