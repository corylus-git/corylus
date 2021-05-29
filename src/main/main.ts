import {
    app,
    BrowserWindow,
    Menu,
    MenuItemConstructorOptions,
    dialog,
    ipcMain,
    IpcMainEvent,
    ipcRenderer,
} from 'electron';
import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs';

let win: BrowserWindow | null;

const installExtensions = async () => {
    const installer = require('electron-devtools-installer');
    const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
    const extensions = ['REACT_DEVELOPER_TOOLS'];

    return Promise.all(extensions.map((name) => installer.default(installer[name], true))).catch(
        console.log
    ); // eslint-disable-line no-console
};

function getAssetPath(...params: string[]): string {
    return app.isPackaged
        ? path.join(process.resourcesPath, 'assets', ...params)
        : path.join(__dirname, '../assets', ...params);
}

function createMainMenu() {
    const template: MenuItemConstructorOptions[] = [
        {
            label: 'Program',
            submenu: [
                {
                    label: ' About...',
                    click: () => {
                        if (win) {
                            win.webContents.send('show-about');
                        }
                    },
                },
                {
                    type: 'separator',
                },
                {
                    role: 'quit',
                },
            ],
        },
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

async function saveLogFile(ev: IpcMainEvent, ...args: any[]) {
    const result = await dialog.showSaveDialog(win!, {
        title: 'Save log buffer to file',
        defaultPath: `corylus-${new Date().toISOString().replace(/[^0-9-Z]/g, '-')}.json`,
    });
    if (!result.canceled) {
        fs.writeFileSync(result.filePath!, args[0]);
        ev.sender.send('toast-from-main', {
            message: `Saved debug log to ${result}`,
            options: { type: 'success' },
        });
    }
}

const createWindow = async () => {
    if (process.env.NODE_ENV !== 'production') {
        await installExtensions();
    }

    win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        },
        icon: getAssetPath('icon.png'),
    });

    ipcMain.on('save-log', saveLogFile);

    if (process.env.NODE_ENV !== 'production') {
        process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = '1'; // eslint-disable-line require-atomic-updates
        win.loadURL(`http://localhost:2003`);
    } else {
        win.loadURL(
            url.format({
                pathname: path.join(__dirname, 'index.html'),
                protocol: 'file:',
                slashes: true,
            })
        );
    }

    if (process.env.NODE_ENV !== 'production') {
        // Open DevTools, see https://github.com/electron/electron/issues/12438 for why we wait for dom-ready
        win.webContents.once('dom-ready', () => {
            win!.webContents.openDevTools();
        });
    }

    win.on('closed', () => {
        win = null;
    });

    createMainMenu();
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.name = 'Corylus';

app.on('activate', () => {
    if (win === null) {
        createWindow();
    }
});
