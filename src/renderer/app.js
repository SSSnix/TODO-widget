const { ipcRenderer } = require('electron');

// === Управление окном ===
document.getElementById('minimize')?.addEventListener('click', () => {
    ipcRenderer.send('window-minimize');
});

document.getElementById('close')?.addEventListener('click', () => {
    ipcRenderer.send('window-close');
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

// === Загрузка задач из SQLite ===
async function loadTasks() {
    try {
        const result = await ipcRenderer.invoke('db:get-tasks', activeList);
        if (result.success) {
            tasks = result.data;
            renderTasks();
        } else {
            console.error('Failed to load tasks:', result.error);
            showError('Не удалось загрузить задачи');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Ошибка подключения к БД');
    }
}

// === Отрисовка задач ===
function renderTasks() {
    todoList.innerHTML = '';

    if (tasks.length === 0) {
        todoList.innerHTML = `
      <div style="text-align: center; color: var(--text-dim); margin-top: 40px; font-size: 13px;">
        Задачи появятся здесь ✨
      </div>
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

    // Чекбокс
    const checkbox = div.querySelector('input');
    checkbox.addEventListener('change', async (e) => {
        const done = e.target.checked;
        div.querySelector('.todo-text').classList.toggle('done', done);

        const result = await ipcRenderer.invoke('db:update-task', {
            taskId: task.id,
            done: done
        });

        if (!result.success) {
            console.error('Failed to update task:', result.error);
            checkbox.checked = !done; // Откат
        }
    });

    // Двойной клик для удаления
    div.addEventListener('dblclick', async () => {
        if (confirm('Удалить задачу?')) {
            const result = await ipcRenderer.invoke('db:delete-task', task.id);
            if (result.success) {
                div.remove();
                tasks = tasks.filter(t => t.id !== task.id);
            }
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

    try {
        const result = await ipcRenderer.invoke('db:add-task', {
            listId: activeList,
            text: text
        });

        if (result.success) {
            // Добавляем в локальный массив и перерисовываем
            tasks.unshift(result.data);
            renderTasks();
            input.value = '';
        } else {
            console.error('Failed to add task:', result.error);
            showError('Не удалось добавить задачу');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Ошибка подключения к БД');
    }
});

// === Вспомогательные функции ===
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showError(message) {
    // Показываем ошибку в консоли и можно добавить UI-уведомление
    console.error('❗', message);
    // TODO: Добавить красивое уведомление в интерфейс
}

// === Инициализация ===
console.log('✅ Todo Widget loaded with SQLite');
loadTasks();