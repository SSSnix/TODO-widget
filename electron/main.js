const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fssync = require('fs');

let win = null;
let tray = null;
let dbPath = null;

// === JSON "Database" ===
async function initDatabase() {
    dbPath = path.join(app.getPath('userData'), 'todo-data.json');

    try {
        await fs.access(dbPath);
        console.log('✅ Database loaded:', dbPath);
    } catch {
        const defaultData = {
            lists: {
                'own': { id: 'own', owner: 'current_user', name: 'Мой список', sharedWith: [] }
            },
            tasks: {
                'own': []
            }
        };
        await fs.writeFile(dbPath, JSON.stringify(defaultData, null, 2));
        console.log('✅ Database created:', dbPath);
    }
}

async function readDb() {
    try {
        const data = await fs.readFile(dbPath, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Read error:', e);
        return { lists: {}, tasks: {} };
    }
}

async function writeDb(data) {
    await fs.writeFile(dbPath, JSON.stringify(data, null, 2));
}

function createWindow() {
    win = new BrowserWindow({
        width: 340,
        height: 480,
        transparent: true,
        frame: false,
        resizable: false,
        alwaysOnTop: true,
        skipTaskbar: false,
        hasShadow: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    const { VITE_DEV_SERVER_URL } = process.env;

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL);
    } else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

function createTray() {
    const iconPath = path.join(__dirname, '../public/icon.png');
    tray = new Tray(iconPath);
    tray.setToolTip('Todo Widget');

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Показать', click: () => win.show() },
        { type: 'separator' },
        { label: 'Выход', click: () => app.quit() },
    ]);
    tray.setContextMenu(contextMenu);
    tray.on('click', () => win.isVisible() ? win.hide() : win.show());
}

// === IPC: окно ===
ipcMain.on('window-minimize', () => win?.minimize());
ipcMain.on('window-close', () => win?.hide());

// === IPC: JSON API ===

ipcMain.handle('db:get-tasks', async (event, listId) => {
    try {
        const data = await readDb();
        return { success: true, data: data.tasks[listId] || [] };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:add-task', async (event, { listId, text }) => {
    try {
        const data = await readDb();

        // Создаём список, если нет
        if (!data.tasks[listId]) data.tasks[listId] = [];
        if (!data.lists[listId]) {
            data.lists[listId] = { id: listId, owner: 'current_user', name: listId, sharedWith: [] };
        }

        const newTask = {
            id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            list_id: listId,
            text,
            done: 0,
            created_at: Date.now()
        };

        data.tasks[listId].unshift(newTask);
        await writeDb(data);

        return { success: true, data: newTask };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:update-task', async (event, { taskId, done }) => {
    try {
        const data = await readDb();

        for (const listId of Object.keys(data.tasks)) {
            const task = data.tasks[listId].find(t => t.id === taskId);
            if (task) {
                task.done = done ? 1 : 0;
                await writeDb(data);
                return { success: true };
            }
        }
        return { success: false, error: 'Task not found' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:delete-task', async (event, taskId) => {
    try {
        const data = await readDb();

        for (const listId of Object.keys(data.tasks)) {
            const idx = data.tasks[listId].findIndex(t => t.id === taskId);
            if (idx !== -1) {
                data.tasks[listId].splice(idx, 1);
                await writeDb(data);
                return { success: true };
            }
        }
        return { success: false, error: 'Task not found' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

let settingsPath = null;
let currentSettings = {
    bgType: 'transparent',
    opacity: 85,
    bgColor: '#1a1a2e'
};

async function initSettings() {
    settingsPath = path.join(app.getPath('userData'), 'settings.json');

    try {
        const data = await fs.readFile(settingsPath, 'utf-8');
        currentSettings = JSON.parse(data);
        console.log('✅ Settings loaded:', currentSettings);
    } catch {
        await fs.writeFile(settingsPath, JSON.stringify(currentSettings, null, 2));
        console.log('✅ Settings created with defaults');
    }
}

async function saveSettings() {
    await fs.writeFile(settingsPath, JSON.stringify(currentSettings, null, 2));
}

// === IPC для настроек ===
ipcMain.handle('settings:get', async () => {
    return { success: true, data: currentSettings };
});

ipcMain.handle('settings:update', async (event, updates) => {
    currentSettings = { ...currentSettings, ...updates };
    await saveSettings();
    return { success: true, data: currentSettings };
});

app.whenReady().then(async () => {
    await initDatabase();
    await initSettings();
    createWindow();
    createTray();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});