import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ─── Config ───────────────────────────────────────────────────────
const LAUNCH_INTERVAL  = [1.0, 2.5];
const BURST_PARTICLES  = 260;
const PARTICLE_LIFE    = [1.8, 3.5];
const BURST_SPEED      = [18, 35];
const LAUNCH_SPEED     = [38, 55];
const LAUNCH_SPREAD    = 40;
const GRAVITY          = -22;
const BULLET_TIME_SCALE = 0.03;
const RESUME_DELAY     = 2;
const EASE_IN_DURATION = 1.5;
const TRAIL_EMIT_RATE  = 0.012;  // seconds between trail spawns per burst particle

// ─── Renderer / Scene / Camera ────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000005, 0.004);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.5, 600);
camera.position.set(0, 25, 90);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 40, 0);
controls.minDistance = 10;
controls.maxDistance = 250;
controls.maxPolarAngle = Math.PI * 0.92;

// ─── Ground ──────────────────────────────────────────────────────
const gridHelper = new THREE.GridHelper(200, 40, 0x111133, 0x111133);
scene.add(gridHelper);

scene.add(new THREE.AmbientLight(0x222244, 0.3));
scene.add(new THREE.HemisphereLight(0x334466, 0x223322, 1.2));

// ─── Trees (threadbare evergreen) ────────────────────────────────
const barkMat = new THREE.MeshBasicMaterial({ color: 0x6b3a1a, fog: false });
const tuftMat = new THREE.MeshBasicMaterial({ color: 0x1a8a2a, fog: false });
const tuftDarkMat = new THREE.MeshBasicMaterial({ color: 0x146a1c, fog: false });
const tuftGeo = new THREE.ConeGeometry(1, 1.5, 5);

function createTree(x, z) {
  const group = new THREE.Group();

  const treeHeight = 8 + Math.random() * 10;
  const trunkRadius = 0.15 + Math.random() * 0.15;

  // straight trunk
  const trunkGeo = new THREE.CylinderGeometry(trunkRadius * 0.4, trunkRadius, treeHeight * 0.85, 5);
  const trunk = new THREE.Mesh(trunkGeo, barkMat);
  trunk.position.y = treeHeight * 0.85 / 2;
  group.add(trunk);

  // sparse tuft layers along the trunk
  const layerCount = 4 + (Math.random() * 4 | 0);
  const startY = treeHeight * 0.25;
  const endY = treeHeight * 0.95;

  for (let l = 0; l < layerCount; l++) {
    const t = l / (layerCount - 1);
    const y = startY + t * (endY - startY);
    // tufts get smaller toward the top
    const sizeScale = (1.0 - t * 0.5) * (0.6 + Math.random() * 0.5);
    // fewer tufts per layer = sparser look
    const count = 2 + (Math.random() * 3 | 0);
    const baseAz = Math.random() * Math.PI * 2;

    for (let b = 0; b < count; b++) {
      const az = baseAz + (Math.PI * 2 / count) * b + (Math.random() - 0.5) * 0.6;
      const outDist = 0.4 + sizeScale * 1.2;
      const tuft = new THREE.Mesh(tuftGeo, Math.random() > 0.4 ? tuftMat : tuftDarkMat);
      tuft.scale.set(sizeScale, sizeScale, sizeScale);
      tuft.position.set(
        Math.cos(az) * outDist,
        y,
        Math.sin(az) * outDist
      );
      // tilt outward slightly
      tuft.rotation.z = Math.cos(az) * 0.3;
      tuft.rotation.x = -Math.sin(az) * 0.3;
      group.add(tuft);
    }
  }

  // top spike tuft
  const top = new THREE.Mesh(tuftGeo, tuftMat);
  top.scale.set(0.4, 0.6, 0.4);
  top.position.y = treeHeight;
  group.add(top);

  const scale = 0.5 + Math.random() * 0.7;
  group.scale.setScalar(scale);
  group.position.set(x, 0, z);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);
}

// scatter trees, avoiding the center launch area
for (let i = 0; i < 60; i++) {
  const angle = Math.random() * Math.PI * 2;
  const dist = 25 + Math.random() * 70;
  createTree(Math.cos(angle) * dist, Math.sin(angle) * dist);
}
// a few closer clusters
for (let i = 0; i < 15; i++) {
  const angle = Math.random() * Math.PI * 2;
  const dist = 15 + Math.random() * 15;
  createTree(Math.cos(angle) * dist, Math.sin(angle) * dist);
}

// ─── HSL Color Generation (inspired by dwitter) ─────────────────
// Full-saturation, vibrant hues cycling through the spectrum
function vibrantColor() {
  const hue = Math.random();
  const c = new THREE.Color();
  c.setHSL(hue, 0.99, 0.55);
  return c;
}

function paletteFromHue(baseHue) {
  // generate a cohesive palette: base hue + neighbors + complement accent
  const c1 = new THREE.Color().setHSL(baseHue, 0.99, 0.55);
  const c2 = new THREE.Color().setHSL((baseHue + 0.05) % 1, 0.95, 0.62);
  const c3 = new THREE.Color().setHSL((baseHue + 0.12) % 1, 0.99, 0.50);
  const c4 = new THREE.Color().setHSL((baseHue + 0.5) % 1, 0.90, 0.65); // complement accent
  return [c1, c2, c3, c4];
}

// ─── Particle system ─────────────────────────────────────────────
const MAX_PARTICLES = 120000;

const geometry = new THREE.BufferGeometry();
const positions  = new Float32Array(MAX_PARTICLES * 3);
const colors     = new Float32Array(MAX_PARTICLES * 3);
const sizes      = new Float32Array(MAX_PARTICLES);
const alphas     = new Float32Array(MAX_PARTICLES);

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
geometry.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));
geometry.setAttribute('alpha',    new THREE.BufferAttribute(alphas, 1));

const vertexShader = `
  attribute float size;
  attribute float alpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = color;
    vAlpha = alpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (200.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 1.0, 64.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.25) discard;
    gl_FragColor = vec4(vColor * 1.8, vAlpha);
  }
`;

const material = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  vertexColors: true,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

const points = new THREE.Points(geometry, material);
points.frustumCulled = false;
scene.add(points);

// ─── Particle pool ───────────────────────────────────────────────
const pool = {
  alive: 0,
  vx: new Float32Array(MAX_PARTICLES),
  vy: new Float32Array(MAX_PARTICLES),
  vz: new Float32Array(MAX_PARTICLES),
  life: new Float32Array(MAX_PARTICLES),
  maxLife: new Float32Array(MAX_PARTICLES),
  drag: new Float32Array(MAX_PARTICLES),
  baseSize: new Float32Array(MAX_PARTICLES),
  type: new Uint8Array(MAX_PARTICLES),      // 0=trail, 1=burst, 2=sparkle
  trailTimer: new Float32Array(MAX_PARTICLES),
  // store original color for trail spawning
  origR: new Float32Array(MAX_PARTICLES),
  origG: new Float32Array(MAX_PARTICLES),
  origB: new Float32Array(MAX_PARTICLES),
};

function emitParticle(x, y, z, vx, vy, vz, color, life, size, type, drag) {
  const i = pool.alive;
  if (i >= MAX_PARTICLES) return;
  pool.alive++;
  positions[i*3]   = x;
  positions[i*3+1] = y;
  positions[i*3+2] = z;
  pool.vx[i] = vx;
  pool.vy[i] = vy;
  pool.vz[i] = vz;
  pool.life[i] = life;
  pool.maxLife[i] = life;
  pool.drag[i] = drag;
  pool.baseSize[i] = size;
  pool.type[i] = type;
  pool.trailTimer[i] = 0;

  let r, g, b;
  if (color instanceof THREE.Color) {
    r = color.r; g = color.g; b = color.b;
  } else {
    const c = new THREE.Color(color);
    r = c.r; g = c.g; b = c.b;
  }
  colors[i*3]   = r;
  colors[i*3+1] = g;
  colors[i*3+2] = b;
  pool.origR[i] = r;
  pool.origG[i] = g;
  pool.origB[i] = b;
  sizes[i] = size;
  alphas[i] = 1.0;
}

function removeParticle(i) {
  const last = pool.alive - 1;
  if (i < last) {
    positions[i*3]   = positions[last*3];
    positions[i*3+1] = positions[last*3+1];
    positions[i*3+2] = positions[last*3+2];
    colors[i*3]   = colors[last*3];
    colors[i*3+1] = colors[last*3+1];
    colors[i*3+2] = colors[last*3+2];
    sizes[i]  = sizes[last];
    alphas[i] = alphas[last];
    pool.vx[i] = pool.vx[last];
    pool.vy[i] = pool.vy[last];
    pool.vz[i] = pool.vz[last];
    pool.life[i] = pool.life[last];
    pool.maxLife[i] = pool.maxLife[last];
    pool.drag[i] = pool.drag[last];
    pool.baseSize[i] = pool.baseSize[last];
    pool.type[i] = pool.type[last];
    pool.trailTimer[i] = pool.trailTimer[last];
    pool.origR[i] = pool.origR[last];
    pool.origG[i] = pool.origG[last];
    pool.origB[i] = pool.origB[last];
  }
  pool.alive--;
}

// ─── Firework shells ─────────────────────────────────────────────
const shells = [];

function launchShell() {
  const baseHue = Math.random();
  const palette = paletteFromHue(baseHue);
  const x = (Math.random() - 0.5) * LAUNCH_SPREAD;
  const z = (Math.random() - 0.5) * LAUNCH_SPREAD;
  const speed = lerp(LAUNCH_SPEED[0], LAUNCH_SPEED[1], Math.random());
  const burstHeight = lerp(50, 90, Math.random());

  shells.push({
    x, y: 0, z,
    vx: (Math.random() - 0.5) * 3,
    vy: speed,
    vz: (Math.random() - 0.5) * 3,
    palette,
    burstHeight,
    trailTimer: 0,
  });
}

function updateShells(dt) {
  for (let i = shells.length - 1; i >= 0; i--) {
    const s = shells[i];
    s.vy += GRAVITY * dt * 0.3;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.z += s.vz * dt;

    // launch trail
    s.trailTimer -= dt;
    if (s.trailTimer <= 0) {
      s.trailTimer = 0.015;
      emitParticle(
        s.x + (Math.random()-.5)*0.5,
        s.y + (Math.random()-.5)*0.5,
        s.z + (Math.random()-.5)*0.5,
        (Math.random()-.5)*2, -3 + Math.random()*2, (Math.random()-.5)*2,
        0xffaa44, 0.4 + Math.random()*0.3, 2.5, 0, 0.92
      );
    }

    if (s.y >= s.burstHeight || s.vy <= 5) {
      burst(s);
      shells.splice(i, 1);
    }
  }
}

function burst(shell) {
  const count = BURST_PARTICLES + (Math.random() * 80 | 0);
  const palette = shell.palette;
  const hasRing = Math.random() > 0.6;
  const ringAxis = new THREE.Vector3(
    Math.random()-.5, Math.random()-.5, Math.random()-.5
  ).normalize();

  for (let i = 0; i < count; i++) {
    const color = palette[Math.random() * palette.length | 0];
    const speed = lerp(BURST_SPEED[0], BURST_SPEED[1], Math.random());
    let dx, dy, dz;

    if (hasRing && Math.random() > 0.4) {
      const angle = Math.random() * Math.PI * 2;
      const tangent = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
      const q = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1), ringAxis
      );
      tangent.applyQuaternion(q);
      dx = tangent.x * speed;
      dy = tangent.y * speed;
      dz = tangent.z * speed;
    } else {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      dx = Math.sin(phi) * Math.cos(theta) * speed;
      dy = Math.sin(phi) * Math.sin(theta) * speed;
      dz = Math.cos(phi) * speed;
    }

    const life = lerp(PARTICLE_LIFE[0], PARTICLE_LIFE[1], Math.random());
    const size = 2.5 + Math.random() * 3;

    emitParticle(
      shell.x, shell.y, shell.z,
      dx, dy, dz,
      color, life, size, 1, 0.96
    );
  }

  // central flash
  emitParticle(
    shell.x, shell.y, shell.z,
    0, 0, 0,
    0xffffff, 0.3, 20, 2, 1.0
  );

  // dynamic point light
  const light = new THREE.PointLight(palette[0], 80, 100);
  light.position.set(shell.x, shell.y, shell.z);
  scene.add(light);
  flashLights.push({ light, life: 0.5 });
}

const flashLights = [];

function updateFlashLights(dt) {
  for (let i = flashLights.length - 1; i >= 0; i--) {
    const f = flashLights[i];
    f.life -= dt;
    if (f.life <= 0) {
      scene.remove(f.light);
      f.light.dispose();
      flashLights.splice(i, 1);
    } else {
      f.light.intensity = 80 * (f.life / 0.5);
    }
  }
}

// ─── Particle update ─────────────────────────────────────────────
function updateParticles(dt) {
  let i = 0;
  while (i < pool.alive) {
    pool.life[i] -= dt;
    if (pool.life[i] <= 0) {
      removeParticle(i);
      continue;
    }

    const drag = pool.drag[i];
    pool.vx[i] *= Math.pow(drag, dt * 60);
    pool.vy[i] *= Math.pow(drag, dt * 60);
    pool.vz[i] *= Math.pow(drag, dt * 60);
    pool.vy[i] += GRAVITY * dt;

    positions[i*3]   += pool.vx[i] * dt;
    positions[i*3+1] += pool.vy[i] * dt;
    positions[i*3+2] += pool.vz[i] * dt;

    const t = pool.life[i] / pool.maxLife[i];
    alphas[i] = t * t;
    sizes[i] = pool.baseSize[i] * (0.3 + 0.7 * t);

    // burst particles spawn trailing embers (the "tail")
    if (pool.type[i] === 1 && t > 0.15) {
      pool.trailTimer[i] -= dt;
      if (pool.trailTimer[i] <= 0) {
        pool.trailTimer[i] = TRAIL_EMIT_RATE + Math.random() * 0.008;
        // spawn a small fading trail particle at current position
        // dimmer version of the parent color, shorter life, smaller, no further trails
        const trailLife = 0.25 + Math.random() * 0.35;
        const trailSize = pool.baseSize[i] * (0.3 + 0.4 * t);
        emitParticle(
          positions[i*3]   + (Math.random()-.5)*0.3,
          positions[i*3+1] + (Math.random()-.5)*0.3,
          positions[i*3+2] + (Math.random()-.5)*0.3,
          pool.vx[i] * 0.05 + (Math.random()-.5)*0.5,
          pool.vy[i] * 0.05 + (Math.random()-.5)*0.5,
          pool.vz[i] * 0.05 + (Math.random()-.5)*0.5,
          new THREE.Color(pool.origR[i] * 0.8, pool.origG[i] * 0.6, pool.origB[i] * 0.4),
          trailLife, trailSize, 0, 0.90
        );
      }
    }

    // fade color toward warm dim for burst particles
    if (pool.type[i] === 1 && t < 0.4) {
      const f = t / 0.4;
      colors[i*3]   = pool.origR[i] * f + 0.9 * (1-f);
      colors[i*3+1] = pool.origG[i] * f + 0.4 * (1-f);
      colors[i*3+2] = pool.origB[i] * f + 0.1 * (1-f);
    }

    i++;
  }

  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.color.needsUpdate = true;
  geometry.attributes.size.needsUpdate = true;
  geometry.attributes.alpha.needsUpdate = true;
  geometry.setDrawRange(0, pool.alive);
}

// ─── Time control ────────────────────────────────────────────────
let timeScale = 1.0;
let targetTimeScale = 1.0;
let lastInteraction = -Infinity;
let isInteracting = false;
let launchTimer = 0;
let simTime = 0;

const timeDisplay = document.getElementById('time-display');

function onInteractionStart() {
  isInteracting = true;
  lastInteraction = performance.now() / 1000;
  targetTimeScale = BULLET_TIME_SCALE;
}

function onInteractionEnd() {
  isInteracting = false;
  lastInteraction = performance.now() / 1000;
}

// Only drag triggers bullet-time, not scroll/zoom
renderer.domElement.addEventListener('pointerdown', onInteractionStart);
renderer.domElement.addEventListener('pointerup', onInteractionEnd);
renderer.domElement.addEventListener('pointerleave', onInteractionEnd);

function updateTimeScale(wallDt) {
  const now = performance.now() / 1000;
  const idleTime = now - lastInteraction;

  if (!isInteracting && idleTime > RESUME_DELAY) {
    targetTimeScale = 1.0;
  }

  const rate = targetTimeScale < timeScale ? 12 : (1.0 / EASE_IN_DURATION);
  timeScale += (targetTimeScale - timeScale) * Math.min(1, rate * wallDt);
  timeScale = Math.max(0.001, Math.min(1.0, timeScale));

  if (timeScale < 0.5) {
    const pct = (timeScale * 100).toFixed(0);
    timeDisplay.innerHTML = `<span class="slow">BULLET TIME ${pct}%</span>`;
  } else {
    timeDisplay.textContent = '';
  }
}

// ─── Helpers ─────────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }

// ─── Stars background ────────────────────────────────────────────
(function addStars() {
  const geo = new THREE.BufferGeometry();
  const count = 2000;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 250 + Math.random() * 50;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
    pos[i*3+1] = Math.abs(r * Math.sin(phi) * Math.sin(theta));
    pos[i*3+2] = r * Math.cos(phi);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.8, color: 0xffffff, transparent: true, opacity: 0.6
  });
  scene.add(new THREE.Points(geo, mat));
})();

// ─── Keyboard movement (WASD / arrows) ──────────────────────────
const keysDown = {};
const PAN_SPEED = 40;

window.addEventListener('keydown', (e) => { keysDown[e.code] = true; });
window.addEventListener('keyup',   (e) => { keysDown[e.code] = false; });

function updateKeyboardMovement(wallDt) {
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

  const dist = camera.position.distanceTo(controls.target);
  const speed = PAN_SPEED * wallDt * Math.max(0.1, dist / 90);
  const move = new THREE.Vector3();

  if (keysDown['KeyW'] || keysDown['ArrowUp'])    move.y += 1;
  if (keysDown['KeyS'] || keysDown['ArrowDown'])   move.y -= 1;
  if (keysDown['KeyA'] || keysDown['ArrowLeft'])   move.sub(right);
  if (keysDown['KeyD'] || keysDown['ArrowRight'])  move.add(right);

  if (move.lengthSq() > 0) {
    move.normalize().multiplyScalar(speed);
    camera.position.add(move);
    controls.target.add(move);
    lastInteraction = performance.now() / 1000;
    targetTimeScale = BULLET_TIME_SCALE;
  }
}

// ─── Resize ──────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ─── Main loop ───────────────────────────────────────────────────
let prevTime = performance.now() / 1000;

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now() / 1000;
  const wallDt = Math.min(now - prevTime, 0.1);
  prevTime = now;

  updateTimeScale(wallDt);
  const dt = wallDt * timeScale;
  simTime += dt;

  launchTimer -= dt;
  if (launchTimer <= 0) {
    launchShell();
    if (Math.random() > 0.7) launchShell();
    if (Math.random() > 0.92) launchShell();
    launchTimer = lerp(LAUNCH_INTERVAL[0], LAUNCH_INTERVAL[1], Math.random());
  }

  updateShells(dt);
  updateParticles(dt);
  updateFlashLights(dt);

  updateKeyboardMovement(wallDt);
  controls.update();
  renderer.render(scene, camera);
}

// initial salvo
for (let i = 0; i < 2; i++) {
  setTimeout(() => launchShell(), i * 150);
}

animate();
