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
const muteButton = document.getElementById("mute-button");

const audioManager = {
  audioCtx: null,
  isMuted: false,

  init() {
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.error("Web Audio API is not supported in this browser");
    }
    
    this.isMuted = localStorage.getItem('snakeIsMuted') === 'true';
    this.updateMuteButton();
  },

  playSound(type) {
    if (!this.audioCtx || this.isMuted) return;

    this.audioCtx.resume();

    const oscillator = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);
    
    let volume, freq, oscType, duration;

    switch(type) {
      case 'add':
        volume = 0.4;
        freq = 300;
        oscType = 'triangle';
        duration = 0.3;
        break;
      case 'remove':
        volume = 0.12;
        freq = 150;
        oscType = 'square';
        duration = 0.2;
        break;
      case 'edit':
        volume = 0.4;
        freq = 440;
        oscType = 'sine';
        duration = 0.15;
        break;
      default:
        return; 
    }

    gainNode.gain.setValueAtTime(volume, this.audioCtx.currentTime);
    oscillator.type = oscType;
    oscillator.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
    
    gainNode.gain.exponentialRampToValueAtTime(0.00001, this.audioCtx.currentTime + duration);

    oscillator.start(this.audioCtx.currentTime);
    oscillator.stop(this.audioCtx.currentTime + duration);
  },
  
  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('snakeIsMuted', this.isMuted);
    this.updateMuteButton();
  },

  updateMuteButton() {
    const soundOnIcon = muteButton.querySelector('.sound-on');
    const soundOffIcon = muteButton.querySelector('.sound-off');
    if (this.isMuted) {
      soundOnIcon.style.display = 'none';
      soundOffIcon.style.display = 'block';
    } else {
      soundOnIcon.style.display = 'block';
      soundOffIcon.style.display = 'none';
    }
  }
};


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
muteButton.addEventListener("click", () => audioManager.toggleMute());

window.addEventListener("click", (e) => {
  if (e.target === instructionsModal) {
    hideInstructions();
  }
});

document.addEventListener("keydown", (e) => {
  // Impede que o atalho "/" funcione quando se está a editar uma tarefa
  if (e.key === "/" && document.activeElement.tagName.toLowerCase() !== 'input') {
    e.preventDefault();
    taskInput.focus();
  }

  if (e.key === "Delete" && tasks.length > 0) {
    // Impede que se apague a tarefa enquanto se edita
    if (document.activeElement.tagName.toLowerCase() !== 'input') {
       removeTask(0);
    }
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
    audioManager.playSound('add');
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
  audioManager.playSound('remove');
  updateSnake();
  updateStatusText();
  saveTasks(); // Salva as tarefas após remover uma
}

/**
 * Entra no modo de edição para uma tarefa.
 * @param {number} taskIndex O índice da tarefa a ser editada.
 * @param {HTMLElement} segmentElement O elemento do segmento da cobra que foi clicado.
 */
function editTask(taskIndex, segmentElement) {
    audioManager.playSound('edit');
    const tooltip = segmentElement.querySelector('.task-tooltip');
    if (tooltip) tooltip.style.display = 'none';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = tasks[taskIndex];
    input.className = 'task-edit-input';

    segmentElement.innerHTML = '';
    segmentElement.appendChild(input);
    input.focus();

    const saveEdit = () => {
        const newText = input.value.trim();
        if (newText && newText !== tasks[taskIndex]) {
            tasks[taskIndex] = newText;
            saveTasks();
        }
        updateSnake(); 
    };

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveEdit();
        } else if (e.key === 'Escape') {
            updateSnake();
        }
    });
    input.addEventListener('blur', saveEdit);
}


/**
 * Atualiza o texto de status com base no número de tarefas.
 */
function updateStatusText() {
  statusText.textContent =
    tasks.length === 0
      ? "Add tasks to grow the snake (Press '/' to focus)"
      : "Click to complete, Double-click to edit, DEL for first";
}

// --- Lógica de Renderização da Cobra ---

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
    while(attempts < 4) {
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
        let clickTimer = null;

        segmentElement.addEventListener('click', () => {
          if(audioManager.audioCtx) audioManager.audioCtx.resume();

          if (clickTimer) {
            clearTimeout(clickTimer);
            clickTimer = null;
            editTask(taskIndex, segmentElement);
          } else {
            clickTimer = setTimeout(() => {
              removeTask(taskIndex);
              clickTimer = null;
            }, 250);
          }
        });

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

function initialize() {
    audioManager.init();
    loadTasks();
    updateSnake();
    updateStatusText();
}

initialize();
