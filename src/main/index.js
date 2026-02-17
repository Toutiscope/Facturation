import { app, BrowserWindow, Menu } from "electron";
import path from "path";
import { initializeIPC } from "./ipcHandlers.js";
import { initializeDataFolder } from "./utils/paths";
import log from "electron-log";
import { setupAutoUpdater } from "./autoUpdater.js";

// Configuration logging
log.transports.file.level = "info";
log.transports.console.level = "debug";

let mainWindow;

/**
 * Crée la fenêtre principale de l'application
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Nécessaire pour electron-store
    },
    icon: path.join(__dirname, "../build/icon.ico"),
  });

  mainWindow.maximize();

  // Menu en français
  const menu = Menu.buildFromTemplate([
    {
      label: "Fichier",
      submenu: [{ label: "Quitter", role: "quit" }],
    },
    {
      label: "Édition",
      submenu: [
        { label: "Annuler", role: "undo" },
        { label: "Rétablir", role: "redo" },
        { type: "separator" },
        { label: "Couper", role: "cut" },
        { label: "Copier", role: "copy" },
        { label: "Coller", role: "paste" },
        { label: "Tout sélectionner", role: "selectAll" },
      ],
    },
    {
      label: "Affichage",
      submenu: [
        { label: "Recharger", role: "reload" },
        { label: "Forcer le rechargement", role: "forceReload" },
        { label: "Outils de développement", role: "toggleDevTools" },
        { type: "separator" },
        { label: "Zoom avant", role: "zoomIn" },
        { label: "Zoom arrière", role: "zoomOut" },
        { label: "Réinitialiser le zoom", role: "resetZoom" },
        { type: "separator" },
        { label: "Plein écran", role: "togglefullscreen" },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);

  // Développement vs Production
  if (process.env.NODE_ENV === "development" || !app.isPackaged) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/**
 * Initialisation de l'application
 */
app.whenReady().then(async () => {
  try {
    // Initialiser dossier data/ et config.json si première exécution
    await initializeDataFolder();

    // Initialiser tous les handlers IPC
    initializeIPC();

    // Créer fenêtre principale
    createWindow();

    // Setup auto-updater
    setupAutoUpdater(mainWindow);

    log.info("Application started successfully");
  } catch (error) {
    log.error("Failed to initialize application:", error);
    app.quit();
  }
});

/**
 * Gestion de la fermeture de l'application
 */
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

/**
 * Gestion de la réactivation (macOS)
 */
app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
