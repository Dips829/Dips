const moonButton = document.getElementById('moonButton');
const hero = document.querySelector('.hero');
const heroCard = document.getElementById('heroCard');
const heroName = document.getElementById('heroName');
const subtitlePill = document.getElementById('subtitlePill');
const closeLetter = document.getElementById('closeLetter');
const startPuzzle = document.getElementById('startPuzzle');
const letterBody = document.getElementById('letterBody');
const puzzleBody = document.getElementById('puzzleBody');
const puzzlePiecesContainer = document.getElementById('puzzlePieces');
const puzzleSlots = document.querySelectorAll('.puzzle-slot');
const puzzleStatus = document.getElementById('puzzleStatus');
const puzzleBack = document.getElementById('puzzleBack');
const puzzleReset = document.getElementById('puzzleReset');
const pathHint = document.querySelector('.path-hint');

/* grid dimensions for logic */
const COLS = 3;
const ROWS = 4;
const TOTAL_PIECES = COLS * ROWS;
const FRAME_WIDTH = 270;   // scaled version of the original
const FRAME_HEIGHT = 360;
const TILE_W = FRAME_WIDTH / COLS;   // 90
const TILE_H = FRAME_HEIGHT / ROWS;  // 90

let puzzleClickable = false; // becomes true only when solved

/* generic typing helper */
function typeText(element, fullText, options = {}) {
  const { startDelay = 0, baseDelay = 90, jitter = 60, onDone } = options;
  let index = 0;

  function step() {
    index += 1;
    element.textContent = fullText.slice(0, index);

    if (index < fullText.length) {
      const delay = baseDelay + Math.random() * jitter;
      setTimeout(step, delay);
    } else if (typeof onDone === 'function') {
      onDone();
    }
  }

  setTimeout(step, startDelay);
}

/* run both typings in sequence on load */
window.addEventListener('DOMContentLoaded', () => {
  if (!heroName) return;

  const nameText = heroName.getAttribute('data-text') || '';
  const subtitleText = subtitlePill?.getAttribute('data-text') || '';

  typeText(heroName, nameText, {
    startDelay: 600,
    onDone: () => {
      if (subtitlePill && subtitleText) {
        typeText(subtitlePill, subtitleText, { startDelay: 250 });
      }
    }
  });
});

/* open / close logic */

function openLetter() {
  hero.classList.add('blurred');
  heroCard.classList.add('open');
  moonButton.classList.add('hidden');
  pathHint.classList.add('hidden');
}

function closeLetterFn() {
  heroCard.classList.remove('open');
  hero.classList.remove('blurred');
  moonButton.classList.remove('hidden');
  pathHint.classList.remove('hidden');
}

moonButton.addEventListener('click', openLetter);
closeLetter.addEventListener('click', closeLetterFn);

/* ----- Puzzle logic (3×4 drag/drop) ----- */

function setupPuzzle() {
  // clear all slots and dock
  puzzleSlots.forEach((slot) => {
    while (slot.firstChild) slot.removeChild(slot.firstChild);
  });
  puzzlePiecesContainer.innerHTML = '';

  const target = document.getElementById('puzzleTarget');
  target.classList.remove('puzzle-solved');
  target.classList.remove('puzzle-clickable');
  puzzleClickable = false;

  const indices = [...Array(TOTAL_PIECES).keys()];

  // shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  indices.forEach((index) => {
    const piece = document.createElement('div');
    piece.className = 'puzzle-piece';
    piece.draggable = true;
    piece.dataset.index = index;

    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const offsetX = -col * TILE_W;
    const offsetY = -row * TILE_H;
    piece.style.backgroundPosition = `${offsetX}px ${offsetY}px`;

    puzzlePiecesContainer.appendChild(piece);
  });

  const pieces = document.querySelectorAll('.puzzle-piece');

  // desktop drag and drop
  pieces.forEach((piece) => {
    piece.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', piece.dataset.index);
    });
  });

  puzzleSlots.forEach((slot) => {
    slot.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      const index = e.dataTransfer.getData('text/plain');

      if (slot.firstChild) return;

      const piece = [...pieces].find((p) => p.dataset.index === index);
      if (!piece) return;

      slot.appendChild(piece);
      checkPuzzleComplete();
    });
  });

  puzzleStatus.textContent = '';
}

function checkPuzzleComplete() {
  let complete = true;

  puzzleSlots.forEach((slot) => {
    const child = slot.firstElementChild;
    if (!child || child.dataset.index !== slot.dataset.slot) {
      complete = false;
    }
  });

  if (complete) {
    const target = document.getElementById('puzzleTarget');

    // remove inner gaps + add glow
    target.classList.add('puzzle-solved');
    target.classList.add('puzzle-clickable');
    puzzleClickable = true;

    // ensure each piece is lined up exactly
    puzzleSlots.forEach((slot) => {
      const i = Number(slot.dataset.slot);
      const piece = slot.firstElementChild;
      if (!piece) return;
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const offsetX = -col * TILE_W;
      const offsetY = -row * TILE_H;
      piece.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
    });

    puzzleStatus.textContent = 'Perfect, just like us.';
  }
}

// navigate to gallery when she clicks the completed picture
const puzzleTarget = document.getElementById('puzzleTarget');
if (puzzleTarget) {
  puzzleTarget.addEventListener('click', () => {
    if (!puzzleClickable) return;
    window.location.href = 'gallery.html';
  });
}

startPuzzle.addEventListener('click', () => {
  // smooth transition from letter to puzzle
  letterBody.classList.add('fade-out');
  setTimeout(() => {
    letterBody.style.display = 'none';
    letterBody.classList.remove('fade-out');

    puzzleBody.classList.add('active', 'fade-in');
    setupPuzzle();

    setTimeout(() => {
      puzzleBody.classList.remove('fade-in');
    }, 300);
  }, 250);
});

puzzleBack.addEventListener('click', () => {
  puzzleBody.classList.remove('active');
  puzzleStatus.textContent = '';
  letterBody.style.display = 'block';
});

puzzleReset.addEventListener('click', () => {
  setupPuzzle();
  puzzleStatus.textContent = '';
});
