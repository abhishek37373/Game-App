const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const bestScoreEl = document.getElementById('bestScore');
const selectedBrandEl = document.getElementById('selectedBrand');
const startBtn = document.getElementById('startBtn');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const brandGrid = document.getElementById('brandGrid');
const hudEl = document.querySelector('.hud');

const comboEl = document.createElement('p');
comboEl.innerHTML = '<strong>Combo:</strong> <span id="comboStat">x1</span>';
const missionEl = document.createElement('p');
missionEl.className = 'mission';
const powerEl = document.createElement('p');
powerEl.className = 'powerup';
hudEl.append(comboEl, missionEl, powerEl);

const comboStatEl = document.getElementById('comboStat');

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
let selectedLogoImg = null;
let selectedLogoPath = fallbackBrands[0]?.logoPath || null;
let logoLoadRequestId = 0;
let level = 1;
let nextLevelScore = 150;

let comboCount = 0;
let comboMultiplier = 1;
let starsCollected = 0;

const mission = {
  goal: 10,
  bonus: 120,
  complete: false,
};

const powerState = {
  shieldFrames: 0,
};

let levelBannerFrames = 0;
let particles = [];

bestScoreEl.textContent = bestScore;

const player = {
  width: 54,
  height: 98,
  y: canvas.height - 120,
};

let obstacles = [];
let stars = [];
let powerUps = [];

missionEl.textContent = `Mission: Collect ${mission.goal} stars in this run`;
powerEl.textContent = 'Power-Up: None';

function preloadSelectedLogo(path) {
  selectedLogoImg = null;
  if (!path) return;

  const requestId = ++logoLoadRequestId;
  const logoImg = new Image();
  logoImg.crossOrigin = 'anonymous';

  logoImg.onload = () => {
    if (requestId === logoLoadRequestId) {
      selectedLogoImg = logoImg;
    }
  };

  logoImg.onerror = () => {
    if (requestId === logoLoadRequestId) {
      selectedLogoImg = null;
    }
  };

  logoImg.src = path;
}

function renderBrandCards(logos) {
  brandGrid.innerHTML = logos
    .map((logo, index) => {
      const selectedClass = index === 0 ? ' selected' : '';
      const color = brandColors[index % brandColors.length];
      return `
        <button class="brand-card${selectedClass}" data-color="${color}" data-brand="${logo.brand}" data-logo-path="${logo.logoPath}">
          <span class="logo-circle"><img src="${logo.logoPath}" alt="${logo.brand} logo" loading="lazy"></span>
        <button class="brand-card${selectedClass}" data-color="${color}" data-brand="${logo.brand}">
          <span class="logo-circle"><img src="${logo.logoPath}" alt="${logo.brand} logo" loading="lazy" data-fallback="${DEFAULT_LOGO_PATH}" onerror="if (this.dataset.errorHandled) return; this.dataset.errorHandled='1'; this.src = this.dataset.fallback;"></span>
          <span class="brand-name">${logo.brand}</span>
        </button>
      `;
    })
    .join('');

  selectedBrandEl.textContent = logos[0]?.brand || 'Unknown Brand';
  carColor = brandColors[0];
  selectedLogoPath = logos[0]?.logoPath || null;
  preloadSelectedLogo(selectedLogoPath);
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
  level = 1;
  nextLevelScore = 150;
  comboCount = 0;
  comboMultiplier = 1;
  starsCollected = 0;
  mission.complete = false;
  powerState.shieldFrames = 0;
  levelBannerFrames = 0;
  obstacles = [];
  stars = [];
  particles = [];
  powerUps = [];
  running = true;
  scoreEl.textContent = score;
  comboStatEl.textContent = 'x1';
  missionEl.textContent = `Mission: Collect ${mission.goal} stars in this run`;
  powerEl.textContent = 'Power-Up: None';

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
  obstacles.push(createObstacle('normal', obstacleLane));
}

function createObstacle(type, laneIndex, y = -110) {
  return {
    type,
    lane: laneIndex,
    y,
    height: 85,
    width: 48,
    color: ['#f25757', '#7f7fff', '#5fc478'][Math.floor(Math.random() * 3)],
    speedBoost: type === 'fast' ? 1.5 : 1,
    weaveTick: 0,
    weaveRate: 0.1 + Math.random() * 0.08,
  };
}

function spawnTrafficPattern() {
  const roll = Math.random();
  const trafficDepth = Math.min(1 + Math.floor(level / 2), 4);

  if (trafficDepth >= 2 && roll < 0.28) {
    const leftStart = Math.random() < 0.5 ? 0 : 1;
    obstacles.push(createObstacle('blocker', leftStart));
    obstacles.push(createObstacle('blocker', leftStart + 1));
    return;
  }

  if (trafficDepth >= 3 && roll < 0.5) {
    obstacles.push(createObstacle('fast', Math.floor(Math.random() * 3)));
    return;
  }

  if (trafficDepth >= 4 && roll < 0.68) {
    const weaveLane = Math.random() < 0.5 ? 0 : 2;
    obstacles.push(createObstacle('weave', weaveLane));
    return;
  }

  spawnObstacle();
}

function spawnStar() {
  stars.push({
    lane: Math.floor(Math.random() * 3),
    y: -50,
  });
}

function spawnPowerUp() {
  powerUps.push({
    type: 'shield',
    lane: Math.floor(Math.random() * 3),
    y: -45,
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
    if (selectedLogoImg?.complete && selectedLogoImg.naturalWidth > 0) {
      const logoWidth = 28;
      const logoHeight = 18;
      const logoX = x - logoWidth / 2;
      const logoY = y + 42;
      ctx.drawImage(selectedLogoImg, logoX, logoY, logoWidth, logoHeight);
    } else {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px Comic Sans MS';
      ctx.textAlign = 'center';
      ctx.fillText('YOU', x, y + 52);
    }
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

function drawShieldPowerUp(x, y) {
  ctx.strokeStyle = '#70f7ff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#c2ffff';
  ctx.font = 'bold 17px Comic Sans MS';
  ctx.textAlign = 'center';
  ctx.fillText('S', x, y + 6);
}

function drawParticles() {
  particles.forEach((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += 0.03;
    particle.life -= 1;
    ctx.globalAlpha = Math.max(particle.life / particle.maxLife, 0);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  particles = particles.filter((particle) => particle.life > 0);
}

function spawnBurst(x, y, color = '#ffe16a') {
  for (let i = 0; i < 16; i++) {
    const angle = (Math.PI * 2 * i) / 16;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * (1 + Math.random() * 2.3),
      vy: Math.sin(angle) * (1 + Math.random() * 2.3),
      life: 24 + Math.floor(Math.random() * 10),
      maxLife: 34,
      size: 1.8 + Math.random() * 2,
      color,
    });
  }
}

function hit(a, b) {
  if (powerState.shieldFrames > 0 && b.type !== 'star' && b.type !== 'power') return false;
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function resetCombo() {
  comboCount = 0;
  comboMultiplier = 1;
  comboStatEl.textContent = 'x1';
}

function consumeShieldHit(obstacle) {
  powerState.shieldFrames = 0;
  powerEl.textContent = 'Power-Up: None';
  resetCombo();
  spawnBurst(obstacle.x, obstacle.y + 30, '#7bedff');
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
  const playerRect = { x: playerX - 24, y: player.y, w: 48, h: player.height };

  if (powerState.shieldFrames > 0) {
    powerState.shieldFrames -= 1;
    if (powerState.shieldFrames === 0) powerEl.textContent = 'Power-Up: None';
  }

  if (powerState.shieldFrames > 0) {
    ctx.strokeStyle = '#72f5ff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(playerX, player.y + 46, 36 + Math.sin(roadOffset / 8) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawCar(playerX, player.y, carColor, true);

  const spawnRate = Math.min(0.02 + level * 0.0035, 0.055);
  if (Math.random() < spawnRate) spawnTrafficPattern();
  if (Math.random() < 0.022) spawnStar();
  if (Math.random() < 0.0048 && powerState.shieldFrames <= 0) spawnPowerUp();

  obstacles.forEach((obstacle) => {
    obstacle.y += gameSpeed * obstacle.speedBoost;

    let obstacleX = laneCenters[obstacle.lane];
    if (obstacle.type === 'weave') {
      obstacle.weaveTick += obstacle.weaveRate;
      obstacleX += Math.sin(obstacle.weaveTick) * 78;
    }

    obstacle.x = obstacleX;
    drawCar(obstacleX, obstacle.y, obstacle.color);

    const obstacleRect = {
      x: obstacleX - obstacle.width / 2,
      y: obstacle.y,
      w: obstacle.width,
      h: obstacle.height,
      type: obstacle.type,
    };

    if (hit(playerRect, obstacleRect)) {
      if (powerState.shieldFrames > 0) {
        consumeShieldHit({ x: obstacleX, y: obstacle.y });
        obstacle.y = canvas.height + 150;
      } else {
        endGame();
      }
    }
  });

  stars.forEach((star) => {
    star.y += gameSpeed + 0.7;
    drawStar(laneCenters[star.lane], star.y);

    const starRect = {
      x: laneCenters[star.lane] - 12,
      y: star.y - 12,
      w: 24,
      h: 24,
      type: 'star',
    };

    if (hit(playerRect, starRect)) {
      star.y = canvas.height + 50;
      starsCollected += 1;
      comboCount += 1;
      comboMultiplier = 1 + Math.floor(comboCount / 3);
      const gained = 5 * comboMultiplier;
      score += gained;
      comboStatEl.textContent = `x${comboMultiplier}`;

      spawnBurst(laneCenters[star.lane], star.y, '#ffe16a');

      if (!mission.complete && starsCollected >= mission.goal) {
        mission.complete = true;
        score += mission.bonus;
        missionEl.textContent = `Mission complete! +${mission.bonus} bonus`; 
        spawnBurst(canvas.width / 2, 120, '#91ff9f');
      }

      scoreEl.textContent = score;
    } else if (star.y > canvas.height + 40) {
      resetCombo();
    }
  });

  powerUps.forEach((power) => {
    power.y += gameSpeed + 0.4;
    drawShieldPowerUp(laneCenters[power.lane], power.y);

    const powerRect = {
      x: laneCenters[power.lane] - 16,
      y: power.y - 16,
      w: 32,
      h: 32,
      type: 'power',
    };

    if (hit(playerRect, powerRect)) {
      spawnBurst(laneCenters[power.lane], power.y, '#9ffcff');
      power.y = canvas.height + 80;
      powerState.shieldFrames = 360;
      powerEl.textContent = 'Power-Up: Shield active';
    }
  });

  drawParticles();

  obstacles = obstacles.filter((obstacle) => obstacle.y < canvas.height + 120);
  stars = stars.filter((star) => star.y < canvas.height + 60);
  powerUps = powerUps.filter((power) => power.y < canvas.height + 60);

  score += 1;
  scoreEl.textContent = score;

  if (score >= nextLevelScore) {
    level += 1;
    nextLevelScore += 150;
    gameSpeed += 0.25;
    levelBannerFrames = 120;
  }

  missionEl.textContent = mission.complete
    ? `Mission complete! +${mission.bonus} bonus`
    : `Mission: Collect ${mission.goal} stars (${starsCollected}/${mission.goal})`;

  if (levelBannerFrames > 0) {
    levelBannerFrames -= 1;
    ctx.fillStyle = '#111d';
    ctx.fillRect(85, 72, canvas.width - 170, 56);
    ctx.fillStyle = '#ffea76';
    ctx.font = 'bold 30px Comic Sans MS';
    ctx.textAlign = 'center';
    ctx.fillText(`Level ${level}!`, canvas.width / 2, 110);
  }

  animationId = requestAnimationFrame(loop);
}

brandGrid.addEventListener('click', (event) => {
  const card = event.target.closest('.brand-card');
  if (!card) return;

  document.querySelectorAll('.brand-card').forEach((node) => node.classList.remove('selected'));
  card.classList.add('selected');
  carColor = card.dataset.color;
  selectedBrandEl.textContent = card.dataset.brand;
  selectedLogoPath = card.dataset.logoPath || null;
  preloadSelectedLogo(selectedLogoPath);
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
