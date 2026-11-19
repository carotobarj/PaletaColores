// ==========================================
// 1. Referencias al DOM y Estado
// ==========================================
const paletteGrid = document.getElementById('palette-grid');
const sizeSelect = document.getElementById('palette-size');
const formatSelect = document.getElementById('color-format');
const generateBtn = document.getElementById('generate-btn');
const saveBtn = document.getElementById('save-btn');
const savedList = document.getElementById('saved-palettes-list');
const clearSavedBtn = document.getElementById('clear-saved-btn');
const toast = document.getElementById('toast');

const STORAGE_KEY = 'colorfly_saved_palettes';

let currentPalette = [];
let currentSize = Number(sizeSelect.value);
let currentFormat = formatSelect.value; // 'hex' | 'hsl'
let toastTimer = null;

// ==========================================
// 2. Funciones puras de color y contraste
// ==========================================
function generateRandomHSL() {
  const h = Math.floor(Math.random() * 360);
  const s = Math.floor(Math.random() * 55) + 35; // 35% - 90% (colores vibrantes)
  const l = Math.floor(Math.random() * 60) + 20; // 20% - 80% (evita extremos puros)
  return { h, s, l };
}

function formatHSL({ h, s, l }) {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function hslToHex(h, s, l) {
  const sNorm = s / 100;
  const lNorm = l / 100;

  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let r = 0, g = 0, b = 0;

  if (h < 60) {
    r = c; g = x; b = 0;
  } else if (h < 120) {
    r = x; g = c; b = 0;
  } else if (h < 180) {
    r = 0; g = c; b = x;
  } else if (h < 240) {
    r = 0; g = x; b = c;
  } else if (h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  const toHex = (val) => Math.round((val + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function createColorItem() {
  const hsl = generateRandomHSL();
  return {
    id: crypto.randomUUID(),
    hslString: formatHSL(hsl),
    hex: hslToHex(hsl.h, hsl.s, hsl.l),
    locked: false
  };
}

// Garantiza contraste accesible (texto oscuro sobre fondos claros y viceversa)
function getAccessibleTextColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 145 ? '#111827' : '#FFFFFF';
}

// ==========================================
// 3. Generación y Renderizado de la Paleta
// ==========================================
function generatePalette(showFeedback = true) {
  const nextPalette = [];

  for (let i = 0; i < currentSize; i++) {
    const existing = currentPalette[i];
    if (existing && existing.locked) {
      nextPalette.push(existing);
    } else {
      nextPalette.push(createColorItem());
    }
  }

  currentPalette = nextPalette;
  renderPalette();

  if (showFeedback) {
    showToast(`Paleta de ${currentSize} colores generada`);
  }
}

function renderPalette() {
  paletteGrid.dataset.size = String(currentSize);
  paletteGrid.innerHTML = '';

  currentPalette.forEach((color) => {
    const card = document.createElement('article');
    card.className = 'color-card';
    card.style.setProperty('--swatch-bg', color.hex);
    card.style.setProperty('--swatch-text', getAccessibleTextColor(color.hex));

    const mainCode = currentFormat === 'hex' ? color.hex : color.hslString;
    const secondaryCode = currentFormat === 'hex' ? color.hslString : color.hex;

    // Botón de bloqueo
    const cardTop = document.createElement('div');
    cardTop.className = 'card-top';

    const lockBtn = document.createElement('button');
    lockBtn.type = 'button';
    lockBtn.className = 'lock-btn';
    lockBtn.setAttribute('aria-pressed', String(color.locked));
    lockBtn.setAttribute(
      'aria-label',
      color.locked ? `Desbloquear ${color.hex}` : `Bloquear ${color.hex}`
    );
    lockBtn.textContent = color.locked ? 'Bloqueado' : 'Bloquear';
    lockBtn.addEventListener('click', () => toggleLock(color.id));

    cardTop.appendChild(lockBtn);

    // Botón para copiar código HEX al portapapeles
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'copy-btn';
    copyBtn.setAttribute('aria-label', `Copiar código HEX ${color.hex}`);
    copyBtn.innerHTML = `
      <span class="color-code-main">${mainCode}</span>
      <span class="color-code-sub">${secondaryCode}</span>
      <span class="copy-hint">Clic para copiar HEX</span>
    `;
    copyBtn.addEventListener('click', () => copyToClipboard(color.hex));

    card.append(cardTop, copyBtn);
    paletteGrid.appendChild(card);
  });
}

function toggleLock(id) {
  currentPalette = currentPalette.map((color) =>
    color.id === id ? { ...color, locked: !color.locked } : color
  );
  renderPalette();
}

async function copyToClipboard(hexCode) {
  try {
    await navigator.clipboard.writeText(hexCode);
    showToast(`Copiado al portapapeles: ${hexCode}`);
  } catch (error) {
    console.error('Error al copiar:', error);
    showToast('No se pudo copiar automáticamente');
  }
}

// ==========================================
// 4. Microfeedback (Toast)
// ==========================================
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 2200);
}

// ==========================================
// 5. Persistencia en localStorage
// ==========================================
function getSavedPalettes() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveCurrentPalette() {
  const saved = getSavedPalettes();
  const newEntry = {
    id: crypto.randomUUID(),
    createdAt: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    colors: currentPalette.map((c) => ({ ...c, locked: false }))
  };

  const updated = [newEntry, ...saved];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  renderSavedPalettes();
  showToast('Paleta guardada en tu navegador');
}

function deleteSavedPalette(id) {
  const updated = getSavedPalettes().filter((item) => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  renderSavedPalettes();
  showToast('Paleta eliminada');
}

function loadSavedPalette(colors) {
  currentSize = colors.length;
  sizeSelect.value = String(currentSize);
  currentPalette = colors.map((c) => ({ ...c, id: crypto.randomUUID() }));
  renderPalette();
  showToast('Paleta cargada');
}

function renderSavedPalettes() {
  const saved = getSavedPalettes();
  savedList.innerHTML = '';

  if (saved.length === 0) {
    savedList.innerHTML = '<p class="empty-state">Aún no tienes paletas guardadas.</p>';
    return;
  }

  saved.forEach((entry) => {
    const card = document.createElement('article');
    card.className = 'saved-card';

    const swatches = document.createElement('div');
    swatches.className = 'saved-swatches';

    entry.colors.forEach((color) => {
      const swatch = document.createElement('div');
      swatch.className = 'saved-swatch';
      swatch.style.setProperty('--swatch-bg', color.hex);
      swatch.title = color.hex;
      swatches.appendChild(swatch);
    });

    const footer = document.createElement('div');
    footer.className = 'saved-card-actions';

    const meta = document.createElement('span');
    meta.textContent = `${entry.colors.length} colores · ${entry.createdAt}`;

    const btnGroup = document.createElement('div');
    const loadBtn = document.createElement('button');
    loadBtn.type = 'button';
    loadBtn.className = 'btn btn-ghost';
    loadBtn.textContent = 'Cargar';
    loadBtn.addEventListener('click', () => loadSavedPalette(entry.colors));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-ghost';
    deleteBtn.textContent = 'Eliminar';
    deleteBtn.addEventListener('click', () => deleteSavedPalette(entry.id));

    btnGroup.append(loadBtn, deleteBtn);
    footer.append(meta, btnGroup);
    card.append(swatches, footer);
    savedList.appendChild(card);
  });
}

// ==========================================
// 6. Eventos e Inicialización
// ==========================================
generateBtn.addEventListener('click', () => generatePalette(true));

sizeSelect.addEventListener('change', (event) => {
  currentSize = Number(event.target.value);
  generatePalette(true);
});

formatSelect.addEventListener('change', (event) => {
  currentFormat = event.target.value;
  renderPalette();
  showToast(`Formato cambiado a ${currentFormat.toUpperCase()}`);
});

saveBtn.addEventListener('click', saveCurrentPalette);

clearSavedBtn.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  renderSavedPalettes();
  showToast('Historial limpiado');
});

// Atajo con la barra espaciadora (solo si no estás en un select o botón)
document.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && document.activeElement.tagName === 'BODY') {
    event.preventDefault();
    generatePalette(true);
  }
});

// Arranque inicial
generatePalette(false);
renderSavedPalettes();