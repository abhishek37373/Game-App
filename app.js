const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const bestScoreEl = document.getElementById('bestScore');
const selectedBrandEl = document.getElementById('selectedBrand');
const startBtn = document.getElementById('startBtn');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const brandGrid = document.getElementById('brandGrid');

const laneCenters = [canvas.width * 0.23, canvas.width * 0.5, canvas.width * 0.77];
const roadMargin = 55;

const DEFAULT_LOGO_PATH = 'assets/logos/default-logo.svg';

const fallbackBrands = [
  { brand: 'Tata Motors', logoPath: 'assets/logos/tata.svg' },
  { brand: 'Mahindra', logoPath: 'assets/logos/mahindra.svg' },
  { brand: 'Maruti Suzuki', logoPath: 'assets/logos/maruti-suzuki.svg' },
  { brand: 'Hindustan Motors', logoPath: 'assets/logos/hindustan-motors.svg' },
  { brand: 'Ashok Leyland', logoPath: 'assets/logos/ashok-leyland.svg' },
];

const brandColors = ['#3f6edb', '#d44f3a', '#ffb347', '#55c66b', '#9f7aea'];

let lane = 1;
let carColor = brandColors[0];
let score = 0;
let bestScore = Number(localStorage.getItem('kid-racer-best') || 0);
let running = false;
let animationId = null;
let gameSpeed = 4;
let roadOffset = 0;

bestScoreEl.textContent = bestScore;

const player = {
  width: 54,
  height: 98,
  y: canvas.height - 120,
};

let obstacles = [];
let stars = [];

function renderBrandCards(logos) {
  brandGrid.innerHTML = logos
    .map((logo, index) => {
      const selectedClass = index === 0 ? ' selected' : '';
      const color = brandColors[index % brandColors.length];
      return `
        <button class="brand-card${selectedClass}" data-color="${color}" data-brand="${logo.brand}">
          <span class="logo-circle"><img src="${logo.logoPath}" alt="${logo.brand} logo" loading="lazy" data-fallback="${DEFAULT_LOGO_PATH}" onerror="if (this.dataset.errorHandled) return; this.dataset.errorHandled='1'; this.src = this.dataset.fallback;"></span>
          <span class="brand-name">${logo.brand}</span>
        </button>
      `;
    })
    .join('');

  selectedBrandEl.textContent = logos[0]?.brand || 'Unknown Brand';
  carColor = brandColors[0];
}

async function loadBrandCards() {
  try {
    const response = await fetch('indian-car-brand-logos.json');
    if (!response.ok) throw new Error('logo json unavailable');
    const data = await response.json();
    renderBrandCards(data.logos || fallbackBrands);
  } catch {
    renderBrandCards(fallbackBrands);
  }
}

function startGame() {
  lane = 1;
  score = 0;
  gameSpeed = 4;
  obstacles = [];
  stars = [];
  running = true;
  scoreEl.textContent = score;

  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(loop);
}

function moveLeft() {
  if (!running) return;
  lane = Math.max(0, lane - 1);
}

function moveRight() {
  if (!running) return;
  lane = Math.min(2, lane + 1);
}

function spawnObstacle() {
  const obstacleLane = Math.floor(Math.random() * 3);
  obstacles.push({
    lane: obstacleLane,
    y: -110,
    color: ['#f25757', '#7f7fff', '#5fc478'][Math.floor(Math.random() * 3)],
  });
}

function spawnStar() {
  stars.push({
    lane: Math.floor(Math.random() * 3),
    y: -50,
  });
}

function drawRoad() {
  ctx.fillStyle = '#2d2f33';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#2a9048';
  ctx.fillRect(0, 0, roadMargin, canvas.height);
  ctx.fillRect(canvas.width - roadMargin, 0, roadMargin, canvas.height);

  roadOffset += gameSpeed;
  const dashHeight = 38;
  const gap = 26;

  ctx.fillStyle = '#f6f6f6';
  for (let y = -dashHeight; y < canvas.height + dashHeight; y += dashHeight + gap) {
    const drawY = y + (roadOffset % (dashHeight + gap));
    ctx.fillRect(canvas.width / 2 - 5, drawY, 10, dashHeight);
    ctx.fillRect(canvas.width / 3 - 4, drawY, 8, dashHeight * 0.7);
    ctx.fillRect((canvas.width * 2) / 3 - 4, drawY, 8, dashHeight * 0.7);
  }
}

function drawCar(x, y, color, isPlayer = false) {
  ctx.fillStyle = color;
  ctx.fillRect(x - 24, y, 48, 85);

  ctx.fillStyle = '#111';
  ctx.fillRect(x - 18, y + 7, 36, 20);

  ctx.fillStyle = '#cfd9ff';
  ctx.fillRect(x - 15, y + 11, 30, 12);

  ctx.fillStyle = '#111';
  ctx.fillRect(x - 29, y + 15, 7, 20);
  ctx.fillRect(x + 22, y + 15, 7, 20);
  ctx.fillRect(x - 29, y + 58, 7, 20);
  ctx.fillRect(x + 22, y + 58, 7, 20);

  if (isPlayer) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Comic Sans MS';
    ctx.textAlign = 'center';
    ctx.fillText('YOU', x, y + 52);
  }
}

function drawStar(x, y) {
  ctx.fillStyle = '#ffe16a';
  ctx.beginPath();
  ctx.moveTo(x, y - 14);
  for (let i = 1; i < 5; i++) {
    ctx.lineTo(x + 14 * Math.cos((18 + i * 72) * Math.PI / 180), y - 14 * Math.sin((18 + i * 72) * Math.PI / 180));
  }
  ctx.closePath();
  ctx.fill();
}

function hit(aLane, aY, aH, bLane, bY, bH) {
  if (aLane !== bLane) return false;
  return aY < bY + bH && aY + aH > bY;
}

function endGame() {
  running = false;
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('kid-racer-best', String(bestScore));
    bestScoreEl.textContent = bestScore;
  }

  ctx.fillStyle = '#000000aa';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 42px Comic Sans MS';
  ctx.textAlign = 'center';
  ctx.fillText('Oops! Try Again', canvas.width / 2, canvas.height / 2 - 30);
  ctx.font = 'bold 24px Comic Sans MS';
  ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 15);
}

function loop() {
  if (!running) return;

  drawRoad();
  const playerX = laneCenters[lane];
  drawCar(playerX, player.y, carColor, true);

  if (Math.random() < 0.03) spawnObstacle();
  if (Math.random() < 0.022) spawnStar();

  obstacles.forEach((obstacle) => {
    obstacle.y += gameSpeed;
    drawCar(laneCenters[obstacle.lane], obstacle.y, obstacle.color);

    if (hit(lane, player.y, player.height, obstacle.lane, obstacle.y, 85)) {
      endGame();
    }
  });

  stars.forEach((star) => {
    star.y += gameSpeed + 0.7;
    drawStar(laneCenters[star.lane], star.y);

    if (hit(lane, player.y, player.height, star.lane, star.y - 12, 24)) {
      star.y = canvas.height + 50;
      score += 5;
      scoreEl.textContent = score;
    }
  });

  obstacles = obstacles.filter((obstacle) => obstacle.y < canvas.height + 120);
  stars = stars.filter((star) => star.y < canvas.height + 60);

  score += 1;
  scoreEl.textContent = score;

  if (score % 140 === 0) gameSpeed += 0.35;

  animationId = requestAnimationFrame(loop);
}

brandGrid.addEventListener('click', (event) => {
  const card = event.target.closest('.brand-card');
  if (!card) return;

  document.querySelectorAll('.brand-card').forEach((node) => node.classList.remove('selected'));
  card.classList.add('selected');
  carColor = card.dataset.color;
  selectedBrandEl.textContent = card.dataset.brand;
});

startBtn.addEventListener('click', startGame);
leftBtn.addEventListener('click', moveLeft);
rightBtn.addEventListener('click', moveRight);

window.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') moveLeft();
  if (event.key === 'ArrowRight') moveRight();
  if (event.key === ' ' || event.key === 'Enter') startGame();
});

// Draw idle screen
(function drawIdle() {
  drawRoad();
  drawCar(laneCenters[lane], player.y, carColor, true);
  ctx.fillStyle = '#00000077';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px Comic Sans MS';
  ctx.textAlign = 'center';
  ctx.fillText('Press Start!', canvas.width / 2, canvas.height / 2);
})();

loadBrandCards();
