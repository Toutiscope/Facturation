import { autoUpdater } from "electron-updater";
import { app } from "electron";
import log from "electron-log";

const CHECK_INTERVAL = 4 * 60 * 60 * 1000; // 4 heures

/**
 * Traduit une erreur brute de l'auto-updater en un code court (que
 * l'utilisateur peut communiquer au support) et un message explicite.
 * @param {Error} error
 * @returns {{ code: string, message: string, detail: string }}
 */
function classifyUpdateError(error) {
  const raw = (error && (error.message || String(error))) || "";
  const text = raw.toLowerCase();
  const detail = raw.split("\n")[0].slice(0, 200);

  // Pas de connexion / DNS introuvable
  if (
    text.includes("enotfound") ||
    text.includes("eai_again") ||
    text.includes("getaddrinfo")
  ) {
    return {
      code: "NET_NO_CONNECTION",
      message:
        "Impossible de joindre le serveur de mises à jour. Vérifiez votre connexion internet.",
      detail,
    };
  }

  // Connexion refusée / coupée / délai dépassé
  if (
    text.includes("econnrefused") ||
    text.includes("econnreset") ||
    text.includes("etimedout") ||
    text.includes("timeout") ||
    text.includes("network")
  ) {
    return {
      code: "NET_TIMEOUT",
      message:
        "La connexion au serveur de mises à jour a échoué (délai dépassé ou réseau bloqué). Un pare-feu ou un antivirus peut en être la cause.",
      detail,
    };
  }

  // Problème de certificat SSL (proxy d'entreprise, horloge système…)
  if (
    text.includes("cert") ||
    text.includes("ssl") ||
    text.includes("self signed") ||
    text.includes("unable to verify")
  ) {
    return {
      code: "SSL_CERT",
      message:
        "Le certificat de sécurité n'a pas pu être validé. Cela vient souvent d'un proxy d'entreprise ou d'une date système incorrecte.",
      detail,
    };
  }

  // Fichier de version / release introuvable (latest.yml, 404)
  if (
    text.includes("404") ||
    text.includes("latest.yml") ||
    text.includes("cannot find") ||
    text.includes("no published versions") ||
    text.includes("not found")
  ) {
    return {
      code: "NO_RELEASE",
      message:
        "Aucune mise à jour publiée n'a été trouvée sur le serveur. Réessayez plus tard.",
      detail,
    };
  }

  // Accès refusé en écriture (installation protégée, droits insuffisants)
  if (
    text.includes("eperm") ||
    text.includes("eacces") ||
    text.includes("access is denied") ||
    text.includes("permission")
  ) {
    return {
      code: "WRITE_PERMISSION",
      message:
        "La mise à jour n'a pas pu être écrite sur le disque. Lancez l'application avec les droits suffisants, ou réinstallez-la.",
      detail,
    };
  }

  // Erreur de signature du paquet téléchargé
  if (text.includes("signature") || text.includes("sha512")) {
    return {
      code: "BAD_SIGNATURE",
      message:
        "Le fichier de mise à jour téléchargé est corrompu ou invalide. Réessayez plus tard.",
      detail,
    };
  }

  return {
    code: "UNKNOWN",
    message: "Une erreur inattendue est survenue pendant la mise à jour.",
    detail,
  };
}

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
  autoUpdater.on("checking-for-update", () => {
    log.info("Checking for update...");
    mainWindow.webContents.send("checking-for-update");
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
    mainWindow.webContents.send("update-not-available");
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
    mainWindow.webContents.send("update-error", classifyUpdateError(error));
  });

  // Vérification initiale (avec délai pour laisser l'app démarrer)
  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 5000);

  // Vérification périodique
  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, CHECK_INTERVAL);
}

export { setupAutoUpdater };
