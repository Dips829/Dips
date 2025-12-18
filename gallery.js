// ====== CONFIG ======

// tile size
const BASE_HEIGHT = 210;
const BASE_WIDTH = 150;

// heart layout size (big so 173 tiles fit)
const HEART_WIDTH = 3000;
const HEART_HEIGHT = 2600;

// how many sample points along heart to approximate arc length
const HEART_SAMPLES = 600;

// spawn timing
const INITIAL_SPAWN_DELAY = 480;
const MIN_SPAWN_DELAY = 70;
const SPAWN_ACCELERATION = 0.97;

// pan & zoom
const MIN_ZOOM = 0.18;
const MAX_ZOOM = 1.8;
const ZOOM_SENSITIVITY = 0.0016;


// ====== STATE ======

const viewport = document.getElementById("galleryViewport");
const canvas = document.getElementById("galleryCanvas");

let photoPaths = [];
let spawnIndex = 0;

let scale = 0.7;
let offsetX = 0;
let offsetY = 80;

let isDragging = false;
let lastX = 0;
let lastY = 0;

let heartPositions = [];


// ====== HEART GEOMETRY (OUTLINE RING) ======

// base heart in param space
function rawHeart(t) {
  const x = 16 * Math.pow(Math.sin(t), 3);
  const y =
    13 * Math.cos(t) -
    5 * Math.cos(2 * t) -
    2 * Math.cos(3 * t) -
    Math.cos(4 * t);
  return { x, y };
}

// sample the curve, normalize to CENTERED canvas coords, compute cumulative arc length
function sampleHeartWithArc() {
  const pts = [];
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (let i = 0; i < HEART_SAMPLES; i++) {
    const t = -Math.PI + (2 * Math.PI * i) / (HEART_SAMPLES - 1);
    const p = rawHeart(t);
    pts.push({ ...p, t });

    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const sx = maxX - minX || 1;
  const sy = maxY - minY || 1;

  // normalize and scale
  for (const p of pts) {
    const nx = (p.x - minX) / sx - 0.5;
    const ny = (p.y - minY) / sy - 0.5;
    p.cx = nx * HEART_WIDTH;
    p.cy = -ny * HEART_HEIGHT;
  }

  // compute cumulative arc length
  let length = 0;
  pts[0].s = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].cx - pts[i - 1].cx;
    const dy = pts[i].cy - pts[i - 1].cy;
    length += Math.hypot(dx, dy);
    pts[i].s = length;
  }

  return { pts, totalLength: length };
}

const HEART_ARC = sampleHeartWithArc();

// get point at given arc length s along the outline
function pointAtArc(s) {
  const { pts, totalLength } = HEART_ARC;
  const target = ((s % totalLength) + totalLength) % totalLength;

  // binary search
  let lo = 0, hi = pts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].s < target) lo = mid + 1;
    else hi = mid;
  }
  return pts[lo];
}

// build positions for each photo, evenly spaced along arc
function buildHeartPositions(photoCount) {
  const positions = [];
  const { totalLength } = HEART_ARC;

  // small gap between tiles along arc
  const gap = 10;
  const approxTileWidth = BASE_WIDTH + gap;
  const requiredPerimeter = approxTileWidth * photoCount;

  // if required perimeter is larger than curve, scale up slightly via factor
  const scaleFactor = Math.max(1, requiredPerimeter / totalLength);

  const effectiveLength = totalLength * scaleFactor;
  const step = effectiveLength / photoCount;

  // start a bit offset so top center has some breathing room
  const startOffset = step / 2;

  for (let i = 0; i < photoCount; i++) {
    const s = startOffset + i * step;
    const p = pointAtArc(s / scaleFactor); // map back to original arc length

    positions.push({
      x: p.cx,
      y: p.cy
    });
  }

  return positions;
}


// ====== SPAWN LOGIC ======

function spawnNextPhoto(delay) {
  if (spawnIndex >= photoPaths.length) return;

  const src = photoPaths[spawnIndex];
  const img = new Image();
  img.src = src;

  img.onload = () => {
    const container = document.createElement("div");
    container.className = "gallery-photo spawned";

    const aspect = img.naturalWidth / img.naturalHeight || (BASE_WIDTH / BASE_HEIGHT);
    const displayHeight = BASE_HEIGHT;
    const displayWidth = displayHeight * aspect;

    container.style.width = `${displayWidth}px`;
    container.style.height = `${displayHeight}px`;

    const pos = heartPositions[spawnIndex] || { x: 0, y: 0 };

    // almost no jitter; tiny to prevent perfect line
    const jitter = 4;
    const jx = (Math.random() - 0.5) * jitter;
    const jy = (Math.random() - 0.5) * jitter;

    container.style.left = `${pos.x + jx - displayWidth / 2}px`;
    container.style.top = `${pos.y + jy - displayHeight / 2}px`;

    container.appendChild(img);
    canvas.appendChild(container);

    setTimeout(() => {
      container.classList.remove("spawned");
    }, 520);

    spawnIndex++;
    if (spawnIndex < photoPaths.length) {
      const nextDelay = Math.max(MIN_SPAWN_DELAY, delay * SPAWN_ACCELERATION);
      setTimeout(() => spawnNextPhoto(nextDelay), nextDelay);
    }
  };

  img.onerror = () => {
    console.warn("Failed to load image:", src);
    spawnIndex++;
    if (spawnIndex < photoPaths.length) {
      setTimeout(() => spawnNextPhoto(delay), delay);
    }
  };
}

function startSpawning() {
  if (!photoPaths.length) return;
  heartPositions = buildHeartPositions(photoPaths.length);
  spawnIndex = 0;
  spawnNextPhoto(INITIAL_SPAWN_DELAY);
}


// ====== PAN & ZOOM ======

function updateCanvasTransform() {
  canvas.style.transform =
    `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
}

function onWheel(e) {
  e.preventDefault();

  const delta = -e.deltaY * ZOOM_SENSITIVITY;
  const prevScale = scale;
  let newScale = scale + delta;
  newScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newScale));

  const rect = viewport.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const dx = mx - cx;
  const dy = my - cy;

  offsetX += dx / prevScale - dx / newScale;
  offsetY += dy / prevScale - dy / newScale;

  scale = newScale;
  updateCanvasTransform();
}

function onPointerDown(e) {
  isDragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  viewport.classList.add("dragging");
}

function onPointerMove(e) {
  if (!isDragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;

  offsetX += dx / scale;
  offsetY += dy / scale;
  updateCanvasTransform();
}

function onPointerUp() {
  isDragging = false;
  viewport.classList.remove("dragging");
}


// ====== LOAD PHOTO LIST & INIT ======

async function loadPhotoList() {
  try {
    const res = await fetch("photos.json");
    if (!res.ok) throw new Error("Failed to load photos.json");
    const list = await res.json();

    // shuffle so order is random around the ring
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    photoPaths = list;
  } catch (err) {
    console.error(err);
    photoPaths = [];
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  scale = 0.7;
  offsetX = 0;
  offsetY = 80;
  updateCanvasTransform();

  await loadPhotoList();
  startSpawning();

  viewport.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  viewport.addEventListener("wheel", onWheel, { passive: false });
});
