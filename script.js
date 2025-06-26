// A variável `tasks` agora é `let` para poder ser reassinada
let tasks = [];

// Seletores de elementos do DOM
const taskForm = document.getElementById("task-form");
const taskInput = document.getElementById("task-input");
const snakeGrid = document.getElementById("snake-grid");
const statusText = document.getElementById("status-text");
const instructionsButton = document.getElementById("instructions-button");
const instructionsModal = document.getElementById("instructions-modal");
const closeModalButton = document.getElementById("close-modal");

/**
 * Carrega as tarefas salvas do localStorage para a variável `tasks`.
 */
function loadTasks() {
  const storedTasks = localStorage.getItem('snakeTasks');
  if (storedTasks) {
    tasks = JSON.parse(storedTasks);
  }
}

/**
 * Salva a lista de tarefas atual no localStorage.
 */
function saveTasks() {
  localStorage.setItem('snakeTasks', JSON.stringify(tasks));
}

// --- Event Listeners ---

taskForm.addEventListener("submit", addTask);
instructionsButton.addEventListener("click", showInstructions);
closeModalButton.addEventListener("click", hideInstructions);
window.addEventListener("click", (e) => {
  if (e.target === instructionsModal) {
    hideInstructions();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement !== taskInput) {
    e.preventDefault();
    taskInput.focus();
  }

  if (e.key === "Delete" && tasks.length > 0) {
    removeTask(0);
  }
});

// --- Funções do Modal de Instruções ---

function showInstructions() {
  instructionsModal.style.display = "block";
  document.body.style.overflow = "hidden";
}

function hideInstructions() {
  instructionsModal.style.display = "none";
  document.body.style.overflow = "auto";
}

// --- Funções de Gerenciamento de Tarefas ---

/**
 * Adiciona uma nova tarefa à lista.
 * @param {Event} e O evento de submit do formulário.
 */
function addTask(e) {
  e.preventDefault();
  const taskText = taskInput.value.trim();

  if (taskText) {
    tasks.push(taskText);
    taskInput.value = "";
    updateSnake();
    updateStatusText();
    saveTasks(); // Salva as tarefas após adicionar uma nova
  }
}

/**
 * Remove uma tarefa da lista pelo seu índice.
 * @param {number} index O índice da tarefa a ser removida.
 */
function removeTask(index) {
  tasks.splice(index, 1);
  updateSnake();
  updateStatusText();
  saveTasks(); // Salva as tarefas após remover uma
}

/**
 * Atualiza o texto de status com base no número de tarefas.
 */
function updateStatusText() {
  statusText.textContent =
    tasks.length === 0
      ? "Add tasks to grow the snake (Press '/' to focus)"
      : "Click on a snake segment to remove a task (or press 'Delete' for first task)";
}

// --- Lógica de Renderização da Cobra ---

/**
 * Gera o caminho da cobra em uma grade.
 * @param {number} length O número de segmentos da cobra (tarefas).
 * @returns {{path: Array, gridSize: number}} O caminho e o tamanho da grade.
 */
function generateSnakePath(length) {
  const gridSize = Math.max(5, Math.ceil(Math.sqrt(length + 1)) + 2);

  const path = [];
  let direction = "right";
  let x = 0, y = 0;

  path.push({ x, y, isHead: true });

  for (let i = 0; i < length; i++) {
    let prevX = x;
    let prevY = y;
    
    let attempts = 0;
    while(attempts < 4) { // Tenta todas as 4 direções antes de desistir
        let tempX = prevX;
        let tempY = prevY;

        if (direction === "right") tempX++;
        else if (direction === "down") tempY++;
        else if (direction === "left") tempX--;
        else if (direction === "up") tempY--;

        const isOutOfBounds = tempX < 0 || tempX >= gridSize || tempY < 0 || tempY >= gridSize;
        const isColliding = path.some(p => p.x === tempX && p.y === tempY);

        if (!isOutOfBounds && !isColliding) {
            x = tempX;
            y = tempY;
            break;
        } else {
            if (direction === "right") direction = "down";
            else if (direction === "down") direction = "left";
            else if (direction === "left") direction = "up";
            else if (direction === "up") direction = "right";
            attempts++;
        }
    }
    
    path.push({ x, y, isHead: false });
  }

  return { path, gridSize };
}

/**
 * Atualiza e renderiza a cobra na tela.
 */
function updateSnake() {
  const { path, gridSize } = generateSnakePath(tasks.length);

  snakeGrid.innerHTML = "";

  snakeGrid.style.gridTemplateColumns = `repeat(${gridSize}, minmax(0, 1fr))`;
  snakeGrid.style.gridTemplateRows = `repeat(${gridSize}, minmax(0, 1fr))`;
  
  const containerWidth = snakeGrid.parentElement.clientWidth;
  const containerHeight = snakeGrid.parentElement.clientHeight;
  const availableSize = Math.min(containerWidth, containerHeight) * 0.9;
  
  snakeGrid.style.width = `${availableSize}px`;
  snakeGrid.style.height = `${availableSize}px`;

  path.forEach((segment, index) => {
    const segmentElement = document.createElement("div");

    segmentElement.style.gridColumn = segment.x + 1;
    segmentElement.style.gridRow = segment.y + 1;

    if (segment.isHead) {
      segmentElement.className = "snake-segment snake-head";

      const eyesElement = document.createElement("div");
      eyesElement.className = "snake-eyes";
      const leftEye = document.createElement("div");
      leftEye.className = "snake-eye";
      const rightEye = document.createElement("div");
      rightEye.className = "snake-eye";

      eyesElement.appendChild(leftEye);
      eyesElement.appendChild(rightEye);
      segmentElement.appendChild(eyesElement);
    } else {
      const taskIndex = index - 1;

      if (taskIndex >= 0 && taskIndex < tasks.length) {
        segmentElement.className = "snake-segment";
        segmentElement.addEventListener("click", () => removeTask(taskIndex));

        const tooltipElement = document.createElement("div");
        tooltipElement.className = "task-tooltip";
        tooltipElement.textContent = tasks[taskIndex];
        segmentElement.appendChild(tooltipElement);
      }
    }
    snakeGrid.appendChild(segmentElement);
  });
}

// --- Inicialização da Aplicação ---

window.addEventListener("resize", updateSnake);

if (!localStorage.getItem("instructionsShown")) {
  setTimeout(() => {
    showInstructions();
    localStorage.setItem("instructionsShown", "true");
  }, 500);
}

/**
 * Função de inicialização para carregar tudo na ordem correta.
 */
function initialize() {
    loadTasks();
    updateSnake();
    updateStatusText();
}

// Inicia a aplicação quando o DOM está pronto.
initialize();
