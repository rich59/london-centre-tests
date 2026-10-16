// London Centre Tests – Electron main process
'use strict';
const { app, BrowserWindow, session, protocol, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_NAME = 'London Centre Tests';
const ROOT = __dirname;                       // .../resources/app.asar/app
const ORIGIN = 'app://tests';
const HOME_URL = ORIGIN + '/home.html';
const TESTS = {
  adult: { file: 'tests/adult.html', title: 'Adult Placement Test (CEFR)' },
  teen: { file: 'tests/teen.html', title: 'Teenager Placement Test (CEFR) – Ages 13–19' },
  kids: { file: 'tests/kids.html', title: 'Entry Test – Ages 7–12' },
  phonics: { file: 'tests/phonics.html', title: 'Phonics Entry Test' }
};
const LOG = process.env.LCT_LOG === '1';
// Offline speech model (Vosk small English). Shipped as a separate file because of download size limits:
// "London-Centre-Tests-Speech-Model.tar.gz" next to the installer / portable exe, or imported from the home screen.
const MODEL_ROUTE = 'vosk/vosk-model-small-en-us-0.15.tar.gz';
const MODEL_SIZE = 41205771;
const MODEL_DOWNLOAD_RE = /^London-Centre-Tests-Speech-Model.*\.tar\.gz$/i;
const log = (...a) => { if (LOG) console.log('[lct]', ...a); };

app.setName(APP_NAME);
if (process.platform === 'win32') app.setAppUserModelId('com.londoncentre.tests');

// app:// is a "standard + secure" scheme: pages get a stable origin (so storage/permissions persist),
// a secure context (getUserMedia, clipboard) and fetch() works for the offline speech model.
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } }]);

if (!app.requestSingleInstanceLock()) { app.quit(); }

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.json': 'application/json', '.gz': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8', '.wasm': 'application/wasm' };

// Scripts injected at the very top of every test page (before the test's own scripts run)
const INJECT = '<script src="app://tests/inject/sr-shim.js"></script><script src="app://tests/inject/toolbar.js" defer></script><link rel="stylesheet" href="app://tests/inject/toolbar.css">';

function modelStore() { return path.join(app.getPath('userData'), 'speech', 'vosk-model-small-en-us-0.15.tar.gz'); }
function isModelFile(f) { try { const st = fs.statSync(f); if (!st.isFile() || st.size !== MODEL_SIZE) return false;
  const fd = fs.openSync(f, 'r'), b = Buffer.alloc(2); fs.readSync(fd, b, 0, 2, 0); fs.closeSync(fd); return b[0] === 0x1f && b[1] === 0x8b; } catch (_) { return false; } }
function candidateModelFiles() {
  const out = [path.join(ROOT, MODEL_ROUTE), path.join(process.resourcesPath || '', 'speech', 'vosk-model-small-en-us-0.15.tar.gz')];
  const dirs = [...new Set([process.env.PORTABLE_EXECUTABLE_DIR, path.dirname(process.execPath), app.getPath('downloads'), path.join(app.getPath('home'), 'Downloads'), app.getPath('desktop')].filter(Boolean))];
  for (const d of dirs) { try { for (const n of fs.readdirSync(d)) if (MODEL_DOWNLOAD_RE.test(n)) out.push(path.join(d, n)); } catch (_) {} }
  return out;
}
let modelPath = null;
function findModel() {
  if (modelPath && isModelFile(modelPath)) return modelPath;
  modelPath = null;
  if (isModelFile(modelStore())) return (modelPath = modelStore());
  for (const f of candidateModelFiles()) if (isModelFile(f)) {
    // keep a private copy so the model survives updates/re-installs and deleting the download
    try { fs.mkdirSync(path.dirname(modelStore()), { recursive: true }); fs.copyFileSync(f, modelStore() + '.part'); fs.renameSync(modelStore() + '.part', modelStore()); modelPath = modelStore(); }
    catch (e) { log('model copy failed', e.message); modelPath = f; }
    log('speech model found at', f, '->', modelPath); return modelPath;
  }
  return null;
}
async function importModel(wc) {
  const bw = BrowserWindow.fromWebContents(wc) || win;
  const { canceled, filePaths } = await dialog.showOpenDialog(bw, { title: 'Choose the speech model file (London-Centre-Tests-Speech-Model.tar.gz)',
    defaultPath: app.getPath('downloads'), properties: ['openFile'], filters: [{ name: 'Speech model', extensions: ['gz'] }] });
  if (canceled || !filePaths[0]) return { ok: false, canceled: true };
  if (!isModelFile(filePaths[0])) { dialog.showMessageBox(bw, { type: 'error', title: APP_NAME, message: 'That is not the speech model file.', detail: 'Choose "London-Centre-Tests-Speech-Model.tar.gz" (41 MB) from the Desktop App folder.' }); return { ok: false }; }
  fs.mkdirSync(path.dirname(modelStore()), { recursive: true });
  fs.copyFileSync(filePaths[0], modelStore() + '.part'); fs.renameSync(modelStore() + '.part', modelStore()); modelPath = modelStore();
  return { ok: true };
}

function serve(request) {
  const u = new URL(request.url);
  if (u.host !== 'tests') return new Response('Not found', { status: 404 });
  let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'home.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT + path.sep)) return new Response('Forbidden', { status: 403 });
  let data, src = file;
  if (rel === MODEL_ROUTE) { src = findModel(); if (!src) return new Response('Speech model not installed', { status: 404 }); }
  try { data = fs.readFileSync(src); } catch (e) { log('404', rel); return new Response('Not found', { status: 404 }); }
  const ext = path.extname(file).toLowerCase();
  const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' };
  if (ext === '.html' && rel.startsWith('tests/')) {
    let html = data.toString('utf8');
    html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + INJECT) : INJECT + html;
    data = Buffer.from(html, 'utf8');
  }
  return new Response(data, { status: 200, headers });
}

const MEDIA_PERMS = new Set(['media', 'microphone', 'audioCapture', 'speaker-selection', 'clipboard-read', 'clipboard-sanitized-write', 'fullscreen']);
const isOurs = (url) => typeof url === 'string' && url.startsWith(ORIGIN + '/');

function setupSession(ses) {
  // Auto-grant the microphone (and clipboard) for our own pages → no "Allow" prompt ever appears
  ses.setPermissionRequestHandler((wc, permission, callback, details) => {
    const url = (details && (details.requestingUrl || details.securityOrigin)) || (wc && wc.getURL()) || '';
    let ok = MEDIA_PERMS.has(permission) && (isOurs(url) || url.startsWith(ORIGIN));
    if (ok && permission === 'media' && details && Array.isArray(details.mediaTypes) && details.mediaTypes.includes('video')) ok = details.mediaTypes.includes('audio');
    log('permission request', permission, JSON.stringify(details && details.mediaTypes), url, '->', ok);
    callback(ok);
  });
  ses.setPermissionCheckHandler((wc, permission, origin) => {
    const ok = MEDIA_PERMS.has(permission) && (!origin || origin.startsWith(ORIGIN));
    log('permission check', permission, origin, '->', ok);
    return ok;
  });
  // <a download> links (recordings) → normal Save dialog
  ses.on('will-download', (e, item) => { log('download', item.getFilename()); });
}

let win = null;
function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 800, minHeight: 600, show: false,
    title: APP_NAME, backgroundColor: '#ffffff',
    icon: path.join(ROOT, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      preload: path.join(ROOT, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      autoplayPolicy: 'no-user-gesture-required', spellcheck: false
    }
  });
  win.once('ready-to-show', () => { if (!process.env.LCT_NO_MAXIMIZE) win.maximize(); win.show(); });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:|^mailto:/i.test(url)) shell.openExternal(url);
    return { action: isOurs(url) || url.startsWith('blob:') ? 'allow' : 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!isOurs(url) && !url.startsWith('blob:') && !url.startsWith('data:')) { e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); }
  });
  win.webContents.on('console-message', (...args) => {
    if (!LOG) return; const d = args[0] && args[0].message !== undefined ? args[0] : { level: args[1], message: args[2] };
    console.log('[page]', d.message);
  });
  win.webContents.on('page-title-updated', (e, t) => { e.preventDefault(); win.setTitle(t && !/^app:/.test(t) ? t + ' – ' + APP_NAME : APP_NAME); });
  win.loadURL(process.env.LCT_START_URL || HOME_URL);
}

async function savePdf(wc) {
  const bw = BrowserWindow.fromWebContents(wc) || win;
  const title = (wc.getTitle() || 'Test').replace(/\s+–\s+London Centre.*$/, '').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80);
  const d = new Date(); const stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const defName = `${title} ${stamp}.pdf`;
  // LCT_TEST_PDF_DIR is only used by the automated tests (no dialog can be clicked there)
  const { canceled, filePath } = process.env.LCT_TEST_PDF_DIR ? { canceled: false, filePath: path.join(process.env.LCT_TEST_PDF_DIR, defName) }
    : await dialog.showSaveDialog(bw, { title: 'Save as PDF', defaultPath: path.join(app.getPath('documents'), defName), filters: [{ name: 'PDF', extensions: ['pdf'] }] });
  if (canceled || !filePath) return { ok: false, canceled: true };
  const pdf = await wc.printToPDF({ printBackground: true, preferCSSPageSize: true, pageSize: 'A4', margins: { marginType: 'default' } });
  fs.writeFileSync(filePath, pdf);
  if (!process.env.LCT_TEST_PDF_DIR) shell.showItemInFolder(filePath);
  return { ok: true, path: filePath, bytes: pdf.length };
}

function goHome(wc) { (wc || win.webContents).loadURL(HOME_URL); }

ipcMain.handle('lct:open', (e, key) => { const t = TESTS[key]; if (!t) return false; e.sender.loadURL(ORIGIN + '/' + t.file); return true; });
ipcMain.handle('lct:home', (e) => { goHome(e.sender); return true; });
ipcMain.handle('lct:savePdf', (e) => savePdf(e.sender).catch(err => ({ ok: false, error: String(err) })));
ipcMain.handle('lct:print', (e) => { e.sender.print({ printBackground: true }); return true; });
ipcMain.on('lct:speechModelSync', (e) => { e.returnValue = !!findModel(); });
ipcMain.handle('lct:importModel', (e) => importModel(e.sender).catch(err => ({ ok: false, error: String(err) })));
ipcMain.handle('lct:info', () => ({ version: app.getVersion(), name: APP_NAME, electron: process.versions.electron, chrome: process.versions.chrome, platform: process.platform }));

// ---- automatic saving of results: Documents\London Centre Tests\Results\<date>_<name>_<test>\ ----
function resultsRoot() { return process.env.LCT_RESULTS_DIR || path.join(app.getPath('documents'), 'London Centre Tests', 'Results'); }
const SAVE_FILES = new Set(['report.html', 'results.json', 'report.txt']);
async function saveResults(wc, req) {
  const folder = String((req && req.folder) || '').replace(/[\\/:*?"<>|\x00-\x1f]+/g, '_').replace(/^\.+/, '').slice(0, 120) || ('results_' + Date.now());
  const dir = path.join(resultsRoot(), folder);
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, data] of Object.entries((req && req.files) || {})) {
    if (SAVE_FILES.has(name) && typeof data === 'string' && data) fs.writeFileSync(path.join(dir, name), data, 'utf8');
  }
  let pdf = null;
  if (req && req.pdf) {
    const buf = await wc.printToPDF({ printBackground: true, preferCSSPageSize: true, pageSize: 'A4', margins: { marginType: 'default' } });
    pdf = path.join(dir, 'report.pdf'); fs.writeFileSync(pdf, buf);
  }
  return { ok: true, dir, pdf };
}
ipcMain.handle('lct:saveResults', (e, req) => saveResults(e.sender, req).catch(err => ({ ok: false, error: String(err && err.message || err) })));
ipcMain.handle('lct:openResults', (e, dir) => {
  const root = path.resolve(resultsRoot()); const d = path.resolve(String(dir || root));
  if (d !== root && !d.startsWith(root + path.sep)) return false;
  shell.openPath(d); return true;
});

function buildMenu() {
  const wc = () => (BrowserWindow.getFocusedWindow() || win).webContents;
  const tpl = [
    { label: 'File', submenu: [
      { label: 'Home', accelerator: 'Alt+Home', click: () => goHome(wc()) },
      { type: 'separator' },
      { label: 'Phonics (3–6 years)', click: () => wc().loadURL(ORIGIN + '/' + TESTS.phonics.file) },
      { label: 'Young Learners (7–12 years)', click: () => wc().loadURL(ORIGIN + '/' + TESTS.kids.file) },
      { label: 'Teenagers (13–19 years)', click: () => wc().loadURL(ORIGIN + '/' + TESTS.teen.file) },
      { label: 'Adults (20 years upwards)', click: () => wc().loadURL(ORIGIN + '/' + TESTS.adult.file) },
      { type: 'separator' },
      { label: 'Print…', accelerator: 'CmdOrCtrl+P', click: () => wc().print({ printBackground: true }) },
      { label: 'Save as PDF…', accelerator: 'CmdOrCtrl+Shift+S', click: () => savePdf(wc()) },
      { type: 'separator' }, { role: 'quit', label: 'Exit' } ] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload', label: 'Reload (restarts the test)' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }, { type: 'separator' }, { role: 'toggleDevTools', label: 'Developer tools' }] },
    { label: 'Help', submenu: [{ label: 'About ' + APP_NAME, click: () => dialog.showMessageBox(win, { type: 'info', title: APP_NAME,
      message: APP_NAME + ' ' + app.getVersion(), detail: 'London Centre of English Language School – Placement Tests.\n\nWorks fully offline. The microphone is allowed automatically for these tests.\nSpeech is transcribed on this computer with the offline Vosk English model (nothing is sent to the internet).' }) }] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => {
  protocol.handle('app', serve);
  setupSession(session.defaultSession);
  buildMenu();
  createWindow();
});
app.on('window-all-closed', () => app.quit());
