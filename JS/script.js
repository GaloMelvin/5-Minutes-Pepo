let isGameOver = false;
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const esMovil = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// Variable para el tiempo del último fotograma para la velocidad independiente del fotograma
let lastFrameTime = 0;

// Definir un factor de velocidad global basado en el dispositivo
// En PC (no esMovil), queremos que se sienta más rápido, por ejemplo, 1.5 o 2 veces más rápido.
// En móvil, mantenemos la velocidad "normal" que ya ajustamos para deltaTime.
const gameSpeedFactor = esMovil ? 1 : 1.5; // Ajusta 1.5 a tu gusto para PC

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

const playerImage = new Image();
playerImage.src = "/assets/pjprincipal.png";
playerImage.onload = () => {
  gameLoop();
};

const enemyImage = new Image();
enemyImage.src = "/assets/bandido.png";

const meleeEnemyImage = new Image();
meleeEnemyImage.src = "/assets/esqueleto.png";

const player = {
  x: canvas.width / 5,
  y: canvas.height / 5,
  width: 50,
  height: 50,
  speed: 200, // Pixeles por segundo (base)
  hp: 100,
  maxHp: 100,
  bullets: 12,
  maxBullets: 12,
  score: 0,
  isReloading: false,
  reloadTime: 2000,
  dodgeCooldown: 1000,
  dodgeDuration: 200,
  isDodging: false,
  dodgeSpeed: 500, // Pixeles por segundo (base)
  angle: 0,
};

let dodgeTime = 0;
let lastShot = 0;
let bullets = [];
let enemies = [];
let enemyProjectiles = [];
let lastEnemySpawn = Date.now();
let autoShoot = false;
let reloadProgress = 0;
let afterimages = [];
let deadEnemies = [];
let showControls = true;
let controlsAlpha = 1;
let controlsStartTime = Date.now();
const controlsDisplayDuration = 3000;
let muzzleFlashes = [];
let curacionAlpha = 0;
const sonidoDisparo = new Audio("/Assets/Sonidos/Bala.mp3");
const sonidoRecarga = new Audio("/Assets/Sonidos/Recarga.mp3");
const sonidoDaño = new Audio("/Assets/Sonidos/Daño.mp3");
const sonidoCuracion = new Audio("/assets/sonidos/Curación.mp3");

if (esMovil) {
  const style = document.createElement("style");
  style.textContent = `
    .joystickArea {
      position: fixed;
      width: 120px;
      height: 120px;
      background: rgba(255,255,255,0.05);
      border-radius: 50%;
      touch-action: none;
      z-index: 9999;
    }

    .joystickStick {
      position: absolute;
      width: 60px;
      height: 60px;
      background: rgba(255,255,255,0.4);
      border-radius: 50%;
      pointer-events: none;
      top: 30px;
      left: 30px;
    }

    .btnTouch {
      position: fixed;
      width: 70px;
      height: 70px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.15);
      border: 2px solid white;
      font-size: 22px;
      color: white;
      text-align: center;
      line-height: 70px;
      z-index: 9999;
      user-select: none;
    }

    #joystickMove { bottom: 20px; left: 20px; }
    #joystickShoot { bottom: 20px; right: 20px; }

    /* Adjusted positions for reload and dodge buttons */
    #btnReload { bottom: 130px; right: 100px; font-size: 18px; }
    #btnDodge { bottom: 130px; right: 20px; font-size: 22px; } /* Placed to the right of reload */
  `;
  document.head.appendChild(style);

  const moveJoystick = document.createElement("div");
  moveJoystick.className = "joystickArea";
  moveJoystick.id = "joystickMove";
  moveJoystick.innerHTML = `<div class="joystickStick" id="moveStick"></div>`;
  document.body.appendChild(moveJoystick);

  const shootJoystick = document.createElement("div");
  shootJoystick.className = "joystickArea";
  shootJoystick.id = "joystickShoot";
  shootJoystick.innerHTML = `<div class="joystickStick" id="shootStick"></div>`;
  document.body.appendChild(shootJoystick);

  const botones = [
    { id: "btnReload", texto: "R" },
    { id: "btnDodge", texto: "⤴" }
  ];

  botones.forEach(({ id, texto }) => {
    const btn = document.createElement("div");
    btn.id = id;
    btn.className = "btnTouch";
    btn.innerText = texto;
    document.body.appendChild(btn);
  });

  const moveStick = document.getElementById("moveStick");
  let moveTouchId = null;

  moveJoystick.addEventListener("touchstart", (e) => {
    moveTouchId = e.changedTouches[0].identifier;
  });

  moveJoystick.addEventListener("touchmove", (e) => {
    for (let t of e.changedTouches) {
      if (t.identifier === moveTouchId) {
        const dx = t.clientX - moveJoystick.offsetLeft - 60;
        const dy = t.clientY - moveJoystick.offsetTop - 60;
        const angle = Math.atan2(dy, dx);
        const dist = Math.min(40, Math.sqrt(dx * dx + dy * dy));
        moveStick.style.left = `${60 + Math.cos(angle) * dist - 30}px`;
        moveStick.style.top = `${60 + Math.sin(angle) * dist - 30}px`;

        keys["w"] = dy < -10;
        keys["s"] = dy > 10;
        keys["a"] = dx < -10;
        keys["d"] = dx > 10;
      }
    }
  });

  moveJoystick.addEventListener("touchend", () => {
    moveStick.style.left = "30px";
    moveStick.style.top = "30px";
    keys["w"] = keys["a"] = keys["s"] = keys["d"] = false;
    moveTouchId = null;
  });

  const shootStick = document.getElementById("shootStick");
  let shootTouchId = null;

  shootJoystick.addEventListener("touchstart", (e) => {
    shootTouchId = e.changedTouches[0].identifier;
    autoShoot = true;
  });

  shootJoystick.addEventListener("touchmove", (e) => {
    for (let t of e.changedTouches) {
      if (t.identifier === shootTouchId) {
        const dx = t.clientX - shootJoystick.offsetLeft - 60;
        const dy = t.clientY - shootJoystick.offsetTop - 60;
        const angle = Math.atan2(dy, dx);
        const dist = Math.min(40, Math.sqrt(dx * dx + dy * dy));
        shootStick.style.left = `${60 + Math.cos(angle) * dist - 30}px`;
        shootStick.style.top = `${60 + Math.sin(angle) * dist - 30}px`;

        player.angle = angle;
      }
    }
  });

  shootJoystick.addEventListener("touchend", () => {
    shootStick.style.left = "30px";
    shootStick.style.top = "30px";
    autoShoot = false;
    shootTouchId = null;
  });

  const reloadBtn = document.getElementById("btnReload");
  reloadBtn.addEventListener("touchstart", () => {
    if (!player.isReloading && player.bullets < player.maxBullets) {
      const rKey = new KeyboardEvent("keydown", {
        key: "r"
      });
      document.dispatchEvent(rKey);
    }
  });

  const dodgeBtn = document.getElementById("btnDodge");
  dodgeBtn.addEventListener("touchstart", () => {
    if (!player.isDodging && Date.now() - dodgeTime > player.dodgeCooldown) {
      player.isDodging = true;
      dodgeTime = Date.now();
    }
    // Add this to hide controls when dodge button is pressed
    if (showControls) {
      showControls = false;
      controlsAlpha = 0;
    }
  });

  // Add the pause button for mobile
  const pauseBtn = document.createElement("div");
  pauseBtn.id = "btnPause";
  pauseBtn.className = "btnTouch"; // Reuse existing styles
  pauseBtn.innerText = "II"; // Pause symbol
  document.body.appendChild(pauseBtn);

  // Add style for the new pause button
  const pauseButtonStyle = document.createElement("style");
  pauseButtonStyle.textContent = `
    #btnPause {
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%); /* Center horizontally */
      width: 70px;
      height: 70px;
      line-height: 70px; /* Center text vertically */
      font-size: 30px; /* Adjust size for the pause symbol */
    }
  `;
  document.head.appendChild(pauseButtonStyle);

  pauseBtn.addEventListener("touchstart", () => {
    if (player.hp > 0) { // Only allow pausing if not game over
      togglePause();
    }
  });
}

function spawnMuzzleFlash(x, y, angle) {
  muzzleFlashes.push({
    x,
    y,
    angle,
    alpha: 1,
    size: 20
  });
}

const keys = {};
document.addEventListener("keydown", (e) => {
  keys[e.key] = true;

  if (e.key === " " && showControls) {
    showControls = false;
    controlsAlpha = 0;
  }
  if (e.key === "r" && !player.isReloading && player.bullets < player.maxBullets) startReload();
  if (e.key === " " && !player.isDodging && Date.now() - dodgeTime > player.dodgeCooldown) {
    player.isDodging = true;
    dodgeTime = Date.now();
  }
});

document.addEventListener("keyup", (e) => keys[e.key] = false);
document.addEventListener("mousedown", () => autoShoot = true);
document.addEventListener("mouseup", () => autoShoot = false);
document.addEventListener("mousemove", (e) => {
  player.angle = Math.atan2(e.clientY - player.y, e.clientX - player.x);
});

function shoot() {
  if (!player.isReloading && player.bullets > 0 && Date.now() - lastShot > 100) {
    bullets.push({
      x: player.x,
      y: player.y,
      angle: player.angle,
      speed: 400 // Bullet speed in pixels per second (base)
    });
    spawnMuzzleFlash(
      player.x + Math.cos(player.angle) * 25,
      player.y + Math.sin(player.angle) * 25,
      player.angle
    );
    player.bullets--;
    sonidoDisparo.currentTime = 0;
    sonidoDisparo.play();
    lastShot = Date.now();
  } else if (player.bullets === 0 && !player.isReloading) {
    startReload();
  }
}

function manageShooting() {
  if (isGameOver) return;
  if (autoShoot && !player.isReloading) {
    shoot();
  }
}

function startReload() {
  player.isReloading = true;
  reloadProgress = 0;
  const reloadInterval = setInterval(() => {
    reloadProgress += 100 / (player.reloadTime / 100);
    if (reloadProgress >= 100) {
      player.bullets = player.maxBullets;
      player.isReloading = false;
      clearInterval(reloadInterval);
      sonidoRecarga.currentTime = 0;
      sonidoRecarga.play();
    }
  }, 100);
}

function movePlayer(deltaTime) {
  if (isGameOver) return;

  // Aplica el factor de velocidad global
  const currentSpeed = player.isDodging ? player.dodgeSpeed * gameSpeedFactor : player.speed * gameSpeedFactor;
  const moveAmount = currentSpeed * deltaTime;

  if (keys["ArrowUp"] || keys["w"]) player.y -= moveAmount;
  if (keys["ArrowDown"] || keys["s"]) player.y += moveAmount;
  if (keys["ArrowLeft"] || keys["a"]) player.x -= moveAmount;
  if (keys["ArrowRight"] || keys["d"]) player.x += moveAmount;
  if (player.isDodging) {
    afterimages.push({
      x: player.x,
      y: player.y,
      angle: player.angle,
      alpha: 0.5
    });
  }
  if (player.isDodging && Date.now() - dodgeTime > player.dodgeDuration) player.isDodging = false;
  player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
  player.y = Math.max(0, Math.min(canvas.height - player.height, player.y));
}

function spawnEnemies() {
  if (Date.now() - lastEnemySpawn > 2000) {
    const enemyType = Math.random() < 0.5 ? 'ranged' : 'melee';

    enemies.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      hp: enemyType === 'ranged' ? 3 : 5,
      speed: enemyType === 'ranged' ? 150 : 250, // Pixeles por segundo (base)
      angle: 0,
      isShooting: enemyType === 'ranged',
      type: enemyType,
      shootCooldown: 1000,
      lastShot: Date.now()
    });

    lastEnemySpawn = Date.now();
  }
}

function updateEnemies(deltaTime) {
  enemies.forEach((enemy, i) => {
    let dx = player.x - enemy.x;
    let dy = player.y - enemy.y;
    let dist = Math.sqrt(dx * dx + dy * dy);

    enemy.angle = Math.atan2(dy, dx);

    if (dist > 20) {
      // Aplica el factor de velocidad global
      enemy.x += (dx / dist) * enemy.speed * deltaTime * gameSpeedFactor;
      enemy.y += (dy / dist) * enemy.speed * deltaTime * gameSpeedFactor;
    }

    if (enemy.type === 'ranged' && Date.now() - enemy.lastShot > enemy.shootCooldown) {
      shootEnemyProjectile(enemy);
      enemy.lastShot = Date.now();
    }

    if (enemy.type === 'ranged' && dist < 20) {
      if (!player.isDodging) {
        player.hp -= 10;
        sonidoDaño.currentTime = 0;
        sonidoDaño.play();
        spawnBlood(player.x, player.y);
        player.x += (dx / dist) * 20;
        player.y += (dy / dist) * 20;
        if (player.hp <= 0) gameOver();
      }
    }

    if (enemy.type === 'melee' && dist < 20) {
      if (!player.isDodging) {
        player.hp -= 20;
        sonidoDaño.currentTime = 0;
        sonidoDaño.play();
        spawnBlood(player.x, player.y);
        player.x += (dx / dist) * 40;
        player.y += (dy / dist) * 40;
        if (player.hp <= 0) gameOver();
      }
    }

    if (enemy.hp <= 0) {
      deadEnemies.push({
        x: enemy.x,
        y: enemy.y,
        angle: enemy.angle,
        type: enemy.type,
        alpha: 1
      });
      enemies.splice(i, 1);
      player.score++;
    }
  });
}

function shootEnemyProjectile(enemy) {
  const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  enemyProjectiles.push({
    x: enemy.x,
    y: enemy.y,
    angle,
    speed: 300 // Pixeles por segundo (base)
  });
  spawnMuzzleFlash(
    enemy.x + Math.cos(angle) * 25,
    enemy.y + Math.sin(angle) * 25,
    angle
  );
}

function updateEnemyProjectiles(deltaTime) {
  enemyProjectiles = enemyProjectiles.filter(projectile => projectile.x > 0 && projectile.x < canvas.width && projectile.y > 0 && projectile.y < canvas.height);
  enemyProjectiles.forEach((projectile, pIndex) => {
    // Aplica el factor de velocidad global
    projectile.x += Math.cos(projectile.angle) * projectile.speed * deltaTime * gameSpeedFactor;
    projectile.y += Math.sin(projectile.angle) * projectile.speed * deltaTime * gameSpeedFactor;

    const dx = projectile.x - player.x;
    const dy = projectile.y - player.y;
    if (Math.sqrt(dx * dx + dy * dy) < 20) {
      if (!player.isDodging) {
        player.hp -= 10;
        sonidoDaño.currentTime = 0;
        sonidoDaño.play();
        spawnBlood(player.x, player.y);
      }
      enemyProjectiles.splice(pIndex, 1);
      if (player.hp <= 0) gameOver();
    }
  });
}

function updateBullets(deltaTime) {
  bullets = bullets.filter(bullet => bullet.x > 0 && bullet.x < canvas.width && bullet.y > 0 && bullet.y < canvas.height);

  bullets.forEach((bullet, bIndex) => {
    // Aplica el factor de velocidad global
    bullet.x += Math.cos(bullet.angle) * bullet.speed * deltaTime * gameSpeedFactor;
    bullet.y += Math.sin(bullet.angle) * bullet.speed * deltaTime * gameSpeedFactor;

    enemies.forEach((enemy, eIndex) => {
      const enemyWidth = 50;
      const enemyHeight = 50;
      if (
        bullet.x > enemy.x - enemyWidth / 2 &&
        bullet.x < enemy.x + enemyWidth / 2 &&
        bullet.y > enemy.y - enemyHeight / 2 &&
        bullet.y < enemy.y + enemyHeight / 2
      ) {
        enemy.hp--;
        spawnBlood(enemy.x, enemy.y);
        bullets.splice(bIndex, 1);
        return;
      }
    });
  });
}

function drawHealthBar() {
  const barWidth = 200;
  const barHeight = 20;
  const healthRatio = player.hp / player.maxHp;
  ctx.fillStyle = "red";
  ctx.fillRect(10, 10, barWidth * healthRatio, barHeight);
  ctx.strokeStyle = "white";
  ctx.strokeRect(10, 10, barWidth, barHeight);
}

function drawTimer() {
  const timeElapsed = Date.now() - timerStart - totalPausedTime;
  const timeRemaining = Math.max(0, timerDuration - timeElapsed);

  const minutes = Math.floor(timeRemaining / 60000);
  const seconds = Math.floor((timeRemaining % 60000) / 1000);
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  ctx.font = "24px Arial";
  ctx.fillStyle = "white";
  ctx.textAlign = "right";
  ctx.fillText(`Tiempo: ${formattedTime}`, canvas.width - 10, 50);
}

function drawHUD() {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform for HUD elements
  drawHealthBar();
  ctx.font = "24px Arial";
  ctx.fillStyle = "white";
  ctx.textAlign = "left";
  ctx.fillText(`Puntaje: ${player.score}`, 10, 50);
  ctx.fillText(`Balas: ${player.bullets}/${player.maxBullets}`, 10, 80);
  if (player.isReloading) drawReloadBar();
  drawTimer();
  ctx.restore();
}

function drawReloadBar() {
  const barWidth = 50;
  const barHeight = 10;
  ctx.fillStyle = "gray";
  ctx.fillRect(player.x - barWidth / 2, player.y - player.height - 20, barWidth, barHeight);
  ctx.fillStyle = "white";
  ctx.fillRect(player.x - barWidth / 2, player.y - player.height - 20, (reloadProgress / 100) * barWidth, barHeight);
}

function drawBullet(bullet) {
  ctx.fillStyle = "yellow";
  ctx.beginPath();
  ctx.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawEnemyProjectile(projectile) {
  ctx.fillStyle = "orange";
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, 7, 0, Math.PI * 2);
  ctx.fill();
}

function drawEnemy(enemy) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(enemy.angle);
  const image = enemy.type === 'ranged' ? enemyImage : meleeEnemyImage;
  ctx.drawImage(image, -25, -25, 50, 50);
  ctx.restore();
}

function updateAndDrawBloodParticles(deltaTime) {
  bloodParticles.forEach((p, index) => {
    // Estas partículas visuales no necesitan gameSpeedFactor, solo deltaTime
    p.x += p.dx * deltaTime;
    p.y += p.dy * deltaTime;
    p.alpha -= 0.01 * (deltaTime * 60);
    p.radius *= (1 - 0.02 * (deltaTime * 60));
    if (p.alpha <= 0 || p.radius < 0.5) {
      bloodParticles.splice(index, 1);
    } else {
      ctx.fillStyle = `rgba(255, 0, 0, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function drawMuzzleFlashes() {
  muzzleFlashes.forEach((flash, index) => {
    ctx.save();
    ctx.translate(flash.x, flash.y);
    ctx.rotate(flash.angle);
    ctx.globalAlpha = flash.alpha;
    ctx.fillStyle = `rgba(255, 255, 0, ${flash.alpha})`;

    const spikeLength = flash.size;
    const spikeWidth = flash.size / 3;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(spikeLength, -spikeWidth / 2);
    ctx.lineTo(spikeLength * 0.7, 0);
    ctx.lineTo(spikeLength, spikeWidth / 2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
    flash.alpha -= 0.1;
    flash.size *= 0.9;
    if (flash.alpha <= 0.1) {
      muzzleFlashes.splice(index, 1);
    }
  });
}

function drawAfterimages() {
  afterimages.forEach((img, index) => {
    ctx.save();
    ctx.translate(img.x, img.y);
    ctx.rotate(img.angle);
    ctx.globalAlpha = img.alpha;
    ctx.drawImage(playerImage, -player.width / 2, -player.height / 2, player.width, player.height);
    ctx.restore();
    img.alpha -= 0.05;
    if (img.alpha <= 0) {
      afterimages.splice(index, 1);
    }
  });
}

function drawDeadEnemies() {
  deadEnemies.forEach((deadEnemy, index) => {
    ctx.save();
    ctx.translate(deadEnemy.x, deadEnemy.y);
    ctx.rotate(deadEnemy.angle);
    ctx.globalAlpha = deadEnemy.alpha;
    const image = deadEnemy.type === 'ranged' ? enemyImage : meleeEnemyImage;
    ctx.drawImage(image, -25, -25, 50, 50);
    ctx.restore();
    deadEnemy.alpha -= 0.02;
    if (deadEnemy.alpha <= 0) {
      deadEnemies.splice(index, 1);
    }
  });
}


function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();

  bullets.forEach(drawBullet);
  enemyProjectiles.forEach(drawEnemyProjectile);
  enemies.forEach(drawEnemy);
  drawDeadEnemies();
  drawMuzzleFlashes();
  drawAfterimages();

  medkits.forEach(medkit => {
    const pulse = 15 + Math.sin(Date.now() / 200) * 6;

    ctx.beginPath();
    ctx.arc(medkit.x, medkit.y, pulse, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 0, 0.4)";
    ctx.fill();

    ctx.drawImage(medkitImage, medkit.x - 30, medkit.y - 30, 60, 60);
  });

  updateAndDrawBloodParticles(1 / 60);


  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  if (curacionAlpha > 0) {
    ctx.filter = `drop-shadow(0 0 20px rgba(0, 255, 0, ${curacionAlpha}))`;
  }
  ctx.drawImage(playerImage, -player.width / 2, -player.height / 2, player.width, player.height);
  ctx.filter = "none";
  ctx.restore();

  drawHUD();

  if (curacionAlpha > 0) {
    curacionAlpha -= 0.02;
    if (curacionAlpha < 0) curacionAlpha = 0;
  }
}

const medkitImage = new Image();
medkitImage.src = "/assets/botiquin.png";
medkitImage.onload = () => {
  console.log("Imagen del botiquín cargada");
};

let medkits = [];

let lastScoreForMedkit = 0;

function dropMedkitIfNeeded() {
  if (player.score > 0 && player.score % 15 === 0 && player.score !== lastScoreForMedkit) {
    console.log("Botiquín generado en", player.score);
    medkits.push({
      x: Math.random() * (canvas.width - 60) + 30,
      y: Math.random() * (canvas.height - 60) + 30,
      radius: 30
    });
    lastScoreForMedkit = player.score;
  }
}

function checkMedkitPickup() {
  medkits = medkits.filter(medkit => {
    const dx = player.x - medkit.x;
    const dy = player.y - medkit.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < medkit.radius + player.width / 2) {
      player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.4);
      sonidoCuracion.currentTime = 0;
      sonidoCuracion.play();
      curacionAlpha = 1;
      return false;
    }
    return true;
  });
}

let bloodParticles = [];

function spawnBlood(x, y, amount = 10) {
  for (let i = 0; i < amount; i++) {
    bloodParticles.push({
      x,
      y,
      radius: Math.random() * 3 + 2,
      dx: (Math.random() - 0.5) * 200,
      dy: (Math.random() - 0.5) * 200,
      alpha: 1
    });
  }
}

let pauseStart = 0;
let totalPausedTime = 0;

function gameOver() {
  isGameOver = true;
  medkits = [];
  gameOverMenu.style.display = "block";
}

function restartGame() {
  player.hp = player.maxHp;
  player.bullets = player.maxBullets;
  player.score = 0;
  enemies = [];
  bullets = [];
  enemyProjectiles = [];
  player.x = canvas.width / 2;
  player.y = canvas.height / 2;
  player.isReloading = false;
  totalPausedTime = 0;
  isGameOver = false;

  timerStart = Date.now();
  showControls = true;
  controlsAlpha = 1;
  controlsStartTime = Date.now();
}

let isPaused = false;

const pauseMenu = document.createElement("div");
pauseMenu.style.position = "fixed";
pauseMenu.style.top = "50%";
pauseMenu.style.left = "50%";
pauseMenu.style.transform = "translate(-50%, -50%)";
pauseMenu.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
pauseMenu.style.color = "white";
pauseMenu.style.padding = "20px";
pauseMenu.style.textAlign = "center";
pauseMenu.style.borderRadius = "10px";
pauseMenu.style.fontFamily = "'Spartan', sans-serif";
pauseMenu.style.display = "none";
document.body.appendChild(pauseMenu);

pauseMenu.innerHTML = `
    <h2>Pausa</h2>
    <button id="resumeButton" style="width: 100%; padding: 10px;margin-bottom:5px; font-size: 16px; border-radius: 5px; background-color: rgba(42, 95, 53, 0.781);; color: white; border: none; cursor: pointer; margin-right: 30px ">Reanudar</button>
    <button id="mainMenuButton" style="width: 100%; padding: 10px; font-size: 16px; border-radius: 5px; background-color: rgba(42, 95, 53, 0.781);; color: white; border: none; cursor: pointer;"><a href="../index.html" style="text-decoration:none;color:white;">Ir al Menú Principal</a></button>
`;

const gameOverMenu = document.createElement("div");
gameOverMenu.style.position = "fixed";
gameOverMenu.style.top = "50%";
gameOverMenu.style.left = "50%";
gameOverMenu.style.transform = "translate(-50%, -50%)";
gameOverMenu.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
gameOverMenu.style.color = "white";
gameOverMenu.style.padding = "20px";
gameOverMenu.style.textAlign = "center";
gameOverMenu.style.borderRadius = "10px";
gameOverMenu.style.fontFamily = "'Spartan', sans-serif";
gameOverMenu.style.display = "none";
document.body.appendChild(gameOverMenu);

gameOverMenu.innerHTML = `
  <h1>Game Over</h1>
  <button id="retryButton" style="width: 100%; padding: 10px;margin-bottom:5px; font-size: 16px; border-radius: 5px; background-color: rgba(95, 42, 42, 0.781); color: white; border: none; cursor: pointer;">Reintentar</button>
  <button id="gameOverMenuButton" style="width: 100%; padding: 10px; font-size: 16px; border-radius: 5px; background-color: rgba(95, 42, 42, 0.781); color: white; border: none; cursor: pointer;"><a href="../index.html" style="text-decoration:none;color:white;">Ir al Menú Principal</a></button>
`;

const retryButton = gameOverMenu.querySelector("#retryButton");
retryButton.addEventListener("click", () => {
  gameOverMenu.style.display = "none";
  restartGame();
});

const resumeButton = document.getElementById("resumeButton");
const mainMenuButton = document.getElementById("mainMenuButton");

function togglePause() {
  if (!isPaused) {
    pauseStart = Date.now();
  } else {
    totalPausedTime += Date.now() - pauseStart;
  }
  isPaused = !isPaused;
  pauseMenu.style.display = isPaused ? "block" : "none";
}

resumeButton.addEventListener("click", togglePause);
mainMenuButton.addEventListener("click", () => {
  window.location.href = "../index.html";
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && player.hp > 0) {
    togglePause();
  }
});

const timerDuration = 5 * 60 * 1000;
let timerStart = Date.now();

function updateTimer() {
  if (isGameOver) return;

  const timeElapsed = Date.now() - timerStart - totalPausedTime;
  const timeRemaining = Math.max(0, timerDuration - timeElapsed);

  if (timeRemaining <= 0) {
    isGameOver = true;
    window.location.href = "/HTML/final.html";
  }
}

function drawControls() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const timeSinceControlsStart = Date.now() - controlsStartTime;
  if (timeSinceControlsStart < controlsDisplayDuration) {
    controlsAlpha = 1;
  } else {
    const fadeProgress = (timeSinceControlsStart - controlsDisplayDuration) / 1000;
    controlsAlpha = Math.max(0, 1 - fadeProgress);
    if (controlsAlpha <= 0) {
      showControls = false;
    }
  }

  ctx.save();
  ctx.globalAlpha = controlsAlpha;
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = "30px Arial";
  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.fillText("Controles", canvas.width / 2, canvas.height / 2 - 100);

  ctx.font = "20px Arial";
  ctx.fillText("WASD o Flechas para mover", canvas.width / 2, canvas.height / 2 - 40);
  ctx.fillText("Clic Izquierdo / Joystick Derecho para disparar", canvas.width / 2, canvas.height / 2);
  ctx.fillText("R para recargar / Botón R en móvil", canvas.width / 2, canvas.height / 2 + 40);
  ctx.fillText("Espacio para esquivar / Botón ⤴ en móvil", canvas.width / 2, canvas.height / 2 + 80);

  if (controlsAlpha > 0.5) {
    ctx.fillText("Presiona ESPACIO para comenzar", canvas.width / 2, canvas.height / 2 + 150);
  }

  ctx.restore();
}


function gameLoop(currentTime) {
  const deltaTime = (currentTime - lastFrameTime) / 1000;
  lastFrameTime = currentTime;

  if (showControls) {
    drawControls();
    requestAnimationFrame(gameLoop);
    return;
  }
  if (!isPaused && !isGameOver) {
    movePlayer(deltaTime);
    manageShooting();
    updateBullets(deltaTime);
    spawnEnemies();
    updateEnemies(deltaTime);
    updateEnemyProjectiles(deltaTime);
    dropMedkitIfNeeded();
    checkMedkitPickup();
    draw();
  }
  updateTimer();
  requestAnimationFrame(gameLoop);
}