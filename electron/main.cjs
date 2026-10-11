// ZawaZawa 桌面客户端 — Electron 主进程
const { app, BrowserWindow, shell, Menu, session } = require('electron');
const path = require('path');

const API_ORIGIN = 'https://www.zawa.uk';

// 单实例
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 900,
    minHeight: 600,
    title: 'ZawaZawa',
    backgroundColor: '#101014',
    autoHideMenuBar: true,
    webPreferences: {
      // 关闭 webSecurity 允许 file:// 页面跨域请求 API（客户端专用）
      webSecurity: false,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // 新窗口（如 Stripe 结算页）→ 尽量在当前窗口打开，外链用系统浏览器
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(API_ORIGIN)) {
      mainWindow?.webContents.loadURL(url);
    } else {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // 拦截对 API 域名的顶层导航（避免跳出客户端）
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith(API_ORIGIN) && !url.includes('/api/')) {
      e.preventDefault();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  // 缓存策略：API 永不缓存
  await session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    cb({ responseHeaders: details.responseHeaders });
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
