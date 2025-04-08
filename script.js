const tasks = []


const taskForm = document.getElementById("task-form")
const taskInput = document.getElementById("task-input")
const snakeGrid = document.getElementById("snake-grid")
const footerText = document.getElementById("footer-text")
const instructionsButton = document.getElementById("instructions-button")
const instructionsModal = document.getElementById("instructions-modal")
const closeModalButton = document.getElementById("close-modal")


taskForm.addEventListener("submit", addTask)
instructionsButton.addEventListener("click", showInstructions)
closeModalButton.addEventListener("click", hideInstructions)
window.addEventListener("click", (e) => {
  if (e.target === instructionsModal) {
    hideInstructions()
  }
})


function showInstructions() {
  instructionsModal.style.display = "block"
  document.body.style.overflow = "hidden"
}

function hideInstructions() {
  instructionsModal.style.display = "none"
  document.body.style.overflow = "auto"
}

function addTask(e) {
  e.preventDefault()
  const taskText = taskInput.value.trim()

  if (taskText) {
    tasks.push(taskText)
    taskInput.value = ""
    updateSnake()
    updateFooterText()
  }
}

function removeTask(index) {
  tasks.splice(index, 1)
  updateSnake()
  updateFooterText()
}

function updateFooterText() {
  footerText.textContent =
    tasks.length === 0 ? "Add tasks to grow the snake" : "Click on a snake segment to remove a task"
}

function generateSnakePath(length) {
  const gridSize = Math.max(5, Math.ceil(Math.sqrt(length + 1)) + 2)

  const path = []
  let direction = "right"
  let x = 0,
    y = 0

  path.push({ x, y, isHead: true })

  for (let i = 0; i < length; i++) {
    if (direction === "right") x++
    else if (direction === "down") y++
    else if (direction === "left") x--
    else if (direction === "up") y--

    const nextX = direction === "right" ? x + 1 : direction === "left" ? x - 1 : x
    const nextY = direction === "down" ? y + 1 : direction === "up" ? y - 1 : y

    if (
      nextX < 0 ||
      nextX >= gridSize ||
      nextY < 0 ||
      nextY >= gridSize ||
      path.some((p) => p.x === nextX && p.y === nextY)
    ) {
      if (direction === "right") direction = "down"
      else if (direction === "down") direction = "left"
      else if (direction === "left") direction = "up"
      else if (direction === "up") direction = "right"
    }

    path.push({ x, y, isHead: false })
  }

  return { path, gridSize }
}

function updateSnake() {
  const { path, gridSize } = generateSnakePath(tasks.length)

  snakeGrid.innerHTML = ""

  snakeGrid.style.gridTemplateColumns = `repeat(${gridSize}, minmax(0, 1fr))`
  snakeGrid.style.gridTemplateRows = `repeat(${gridSize}, minmax(0, 1fr))`

  const cellSize = (Math.min(window.innerWidth, window.innerHeight) * 0.7) / gridSize
  snakeGrid.style.width = `${cellSize * gridSize}px`
  snakeGrid.style.height = `${cellSize * gridSize}px`

  path.forEach((segment, index) => {
    const segmentElement = document.createElement("div")

    segmentElement.style.gridColumn = segment.x + 1
    segmentElement.style.gridRow = segment.y + 1

    if (segment.isHead) {
      segmentElement.className = "snake-segment snake-head"

      const eyesElement = document.createElement("div")
      eyesElement.className = "snake-eyes"

      const leftEye = document.createElement("div")
      leftEye.className = "snake-eye"

      const rightEye = document.createElement("div")
      rightEye.className = "snake-eye"

      eyesElement.appendChild(leftEye)
      eyesElement.appendChild(rightEye)
      segmentElement.appendChild(eyesElement)
    } else {
      const taskIndex = index - 1

      if (taskIndex >= 0 && taskIndex < tasks.length) {
        segmentElement.className = "snake-segment"

        segmentElement.addEventListener("click", () => removeTask(taskIndex))

        const tooltipElement = document.createElement("div")
        tooltipElement.className = "task-tooltip"
        tooltipElement.textContent = tasks[taskIndex]
        segmentElement.appendChild(tooltipElement)
      }
    }

    snakeGrid.appendChild(segmentElement)
  })
}

updateSnake()

window.addEventListener("resize", updateSnake)

if (!localStorage.getItem("instructionsShown")) {
  setTimeout(() => {
    showInstructions()
    localStorage.setItem("instructionsShown", "true")
  }, 500)
}
