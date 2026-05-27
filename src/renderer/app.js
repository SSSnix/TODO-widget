const { ipcRenderer } = require('electron');

// === Управление окном ===
document.getElementById('minimize')?.addEventListener('click', () => {
    ipcRenderer.send('window-minimize');
});

document.getElementById('close')?.addEventListener('click', () => {
    ipcRenderer.send('window-close');
});

// === Настройки ===
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const closeSettings = document.getElementById('closeSettings');
const bgTransparent = document.getElementById('bgTransparent');
const bgSolid = document.getElementById('bgSolid');
const opacityGroup = document.getElementById('opacityGroup');
const opacityRange = document.getElementById('opacityRange');
const opacityValue = document.getElementById('opacityValue');
const colorGroup = document.getElementById('colorGroup');
const bgColorPicker = document.getElementById('bgColorPicker');
const colorPresets = document.querySelectorAll('.color-preset');

let settingsOpen = false;
// === Глобальное состояние стиля ===
let currentBgColor = '#1a1a2e';  // Базовый цвет
let currentOpacity = 85;          // Прозрачность 0-100 (где 0 = полностью прозрачный)
let currentBgType = 'transparent'; // 'transparent' или 'solid'

// Открыть/закрыть настройки (toggle)
function toggleSettings() {
    settingsOpen = !settingsOpen;
    if (settingsOpen) {
        settingsPanel.classList.add('active');
    } else {
        settingsPanel.classList.remove('active');
    }
}

settingsBtn?.addEventListener('click', (e) => {
    e.stopPropagation(); // Чтобы не сработал клик по body
    toggleSettings();
});

closeSettings?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSettings();
});

// Закрыть при клике вне панели настроек
document.addEventListener('click', (e) => {
    if (settingsOpen && !settingsPanel.contains(e.target) && !settingsBtn.contains(e.target)) {
        toggleSettings();
    }
});

// Предотвращаем закрытие при клике внутри панели
settingsPanel?.addEventListener('click', (e) => {
    e.stopPropagation();
});

// === Универсальное применение фона ===
function applyBackground() {
    if (currentBgType === 'solid') {
        // Сплошной цвет — просто применяем его
        document.body.style.background = currentBgColor;
    } else {
        const alpha = (100 - currentOpacity) / 100;

        const rgb = hexToRgb(currentBgColor) || { r: 26, g: 26, b: 46 };
        document.body.style.background = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    }
}

// === Хелпер: hex → rgb ===
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// Загрузка настроек
async function loadSettings() {
    try {
        const result = await ipcRenderer.invoke('settings:get');
        if (result.success) {
            applySettings(result.data);
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

// Применение настроек
function applySettings(settings) {
    const { bgType, opacity, bgColor } = settings;

    currentBgType = bgType;
    currentOpacity = opacity;
    currentBgColor = bgColor;

    if (bgType === 'solid') {
        document.body.classList.remove('transparent-bg');
        document.body.classList.add('solid-bg');
        bgTransparent?.classList.remove('active');
        bgSolid?.classList.add('active');
        opacityGroup.style.display = 'none';
        colorGroup.style.display = 'flex';

        document.body.style.background = bgColor;
        bgColorPicker.value = bgColor;

    } else {
        document.body.classList.remove('solid-bg');
        document.body.classList.add('transparent-bg');
        bgTransparent?.classList.add('active');
        bgSolid?.classList.remove('active');
        opacityGroup.style.display = 'flex';
        colorGroup.style.display = 'none';

        applyBackground();

        opacityRange.value = opacity;
        opacityValue.textContent = opacity;
        bgColorPicker.value = bgColor;
    }
}

// Переключение типа фона
bgTransparent?.addEventListener('click', async () => {
    currentBgType = 'transparent';
    await ipcRenderer.invoke('settings:update', { bgType: 'transparent' });
    applySettings({ bgType: 'transparent', opacity: currentOpacity, bgColor: currentBgColor });
});

bgSolid?.addEventListener('click', async () => {
    currentBgType = 'solid';
    await ipcRenderer.invoke('settings:update', { bgType: 'solid' });
    applySettings({ bgType: 'solid', opacity: currentOpacity, bgColor: currentBgColor });
});

// Изменение прозрачности
opacityRange?.addEventListener('input', async (e) => {
    const value = parseInt(e.target.value);
    currentOpacity = value;
    opacityValue.textContent = value;

    applyBackground();

    await ipcRenderer.invoke('settings:update', { opacity: value });
});

// Изменение цвета
bgColorPicker?.addEventListener('input', async (e) => {
    const color = e.target.value;
    currentBgColor = color;
    applyBackground();

    await ipcRenderer.invoke('settings:update', { bgColor: color });
});

// Пресеты цветов
colorPresets.forEach(preset => {
    preset.addEventListener('click', async () => {
        const color = preset.dataset.color;
        currentBgColor = color;
        bgColorPicker.value = color;
        applyBackground();

        await ipcRenderer.invoke('settings:update', { bgColor: color });
    });
});

// === Глобальные переменные ===
let activeList = 'own';
let tasks = [];

// === Вкладки ===
const tabs = document.querySelectorAll('.tab');
const todoList = document.getElementById('todoList');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeList = tab.dataset.list;
        loadTasks();
    });
});

// === Загрузка задач ===
async function loadTasks() {
    try {
        const result = await ipcRenderer.invoke('db:get-tasks', activeList);
        if (result.success) {
            tasks = result.data;
            renderTasks();
        } else {
            console.error('Failed to load tasks:', result.error);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// === Отрисовка задач ===
function renderTasks() {
    todoList.innerHTML = '';

    if (tasks.length === 0) {
        todoList.innerHTML = `
      <div class="placeholder-text">Задачи появятся здесь ✨</div>
    `;
        return;
    }

    tasks.forEach(task => {
        const item = createTaskElement(task);
        todoList.appendChild(item);
    });
}

// === Создание элемента задачи ===
function createTaskElement(task) {
    const div = document.createElement('div');
    div.className = 'todo-item';
    div.innerHTML = `
    <input type="checkbox" ${task.done ? 'checked' : ''} data-id="${task.id}">
    <span class="todo-text ${task.done ? 'done' : ''}">${escapeHtml(task.text)}</span>
  `;

    const checkbox = div.querySelector('input');
    checkbox.addEventListener('change', async (e) => {
        const done = e.target.checked;
        div.querySelector('.todo-text').classList.toggle('done', done);

        await ipcRenderer.invoke('db:update-task', { taskId: task.id, done });
    });

    div.addEventListener('dblclick', async () => {
        if (confirm('Удалить задачу?')) {
            await ipcRenderer.invoke('db:delete-task', task.id);
            loadTasks();
        }
    });

    return div;
}

// === Добавление задачи ===
const form = document.getElementById('addForm');
const input = document.getElementById('taskInput');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    const result = await ipcRenderer.invoke('db:add-task', { listId: activeList, text });

    if (result.success) {
        tasks.unshift(result.data);
        renderTasks();
        input.value = '';
    }
});

// === Вспомогательные функции ===
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// === Инициализация ===
console.log('✅ Todo Widget loaded with settings');
loadSettings();
loadTasks();