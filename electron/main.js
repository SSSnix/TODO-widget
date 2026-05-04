const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const { VITE_DEV_SERVER_URL } = process.env;

let win = null;
let tray = null;

function createWindow() {
    win = new BrowserWindow({
        width: 340,
        height: 480,
        transparent: true,
        frame: false,
        resizable: false,
        alwaysOnTop: true,
        skipTaskbar: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL);
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    win.webContents.on('did-finish-load', () => {
        win.webContents.send('app-ready');
    });
}

function createTray() {

    tray = new Tray(path.join(__dirname, '../public/icon.png'));
    tray.setToolTip('Todo Widget');

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Показать', click: () => win.show() },
        { type: 'separator' },
        { label: 'Выход', click: () => app.quit() },
    ]);
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        win.isVisible() ? win.hide() : win.show();
    });
}

app.whenReady().then(() => {
    createWindow();
    createTray();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('window-minimize', () => win.minimize());
ipcMain.on('window-close', () => win.hide()); // Скрываем, а не закрываем