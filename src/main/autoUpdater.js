import { autoUpdater } from "electron-updater";
import { app } from "electron";
import log from "electron-log";

const CHECK_INTERVAL = 4 * 60 * 60 * 1000; // 4 heures

/**
 * Configure et démarre l'auto-updater
 * @param {BrowserWindow} mainWindow - Fenêtre principale pour envoyer les événements
 */
function setupAutoUpdater(mainWindow) {
  // Ne pas exécuter en mode développement
  if (!app.isPackaged) {
    log.info("Auto-updater disabled in development mode");
    return;
  }

  // Configuration
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = log;

  // Événements
  autoUpdater.checkForUpdates();

  autoUpdater.on("checking-for-update", () => {
    log.info("Checking for update...");
  });

  autoUpdater.on("update-available", (info) => {
    log.info("Update available:", info.version);
    mainWindow.webContents.send("update-available", {
      version: info.version,
      releaseDate: info.releaseDate,
    });
  });

  autoUpdater.on("update-not-available", () => {
    log.info("No update available");
  });

  autoUpdater.on("download-progress", (progress) => {
    log.info(`Download progress: ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on("update-downloaded", (info) => {
    log.info("Update downloaded:", info.version);
    mainWindow.webContents.send("update-downloaded", {
      version: info.version,
      releaseDate: info.releaseDate,
    });
  });

  autoUpdater.on("error", (error) => {
    log.error("Auto-updater error:", error);
  });

  // Vérification initiale (avec délai pour laisser l'app démarrer)
  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 10000);

  // Vérification périodique
  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, CHECK_INTERVAL);
}

export { setupAutoUpdater };
