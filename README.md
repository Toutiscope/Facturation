# Application Electron - Facturation

Application desktop pour la création, gestion et conformité de devis et factures selon la réglementation française 2027 pour Entrepreneur Individuel en prestation de services.

## Stack Technique

- **Electron** 28.x - Framework desktop
- **Vue.js** 3.4.x - Framework UI (Composition API)
- **Vite** 5.x - Build tool et dev server
- **SCSS** - Styles (pas de framework CSS)
- **PDFKit** - Génération PDF
- **Zod** - Validation
- **Axios** - Appels HTTP vers l'API d'une plateforme de facturation agréée (PDP)
- **electron-updater** - Auto-update

## Prérequis

- Node.js >= 18.0.0 (recommandé)
- npm >= 8.0.0

## Installation

```bash
npm install
```

## Développement

```bash
npm run dev
```

L'application se lancera automatiquement avec:
- Hot Module Replacement (HMR) pour Vue.js
- DevTools activés
- Rechargement automatique du renderer

## Build Production

### Windows

```bash
npm run build:win
```

L'installeur sera généré dans `out/Facturation Setup 1.0.0.exe`

## Structure du Projet

```
facturation/
├── src/
│   ├── main/              # Process principal Electron
│   │   ├── index.js       # Entry point
│   │   ├── ipcHandlers.js # Handlers IPC
│   │   ├── fileManager.js # Gestion fichiers JSON
│   │   └── utils/
│   │       └── paths.js   # Chemins data/
│   ├── preload/
│   │   └── index.js       # Script preload (contextBridge)
│   └── renderer/          # Application Vue.js
│       ├── views/         # Pages
│       ├── components/    # Composants réutilisables
│       ├── composables/   # Logique réutilisable
│       ├── styles/        # SCSS Design System
│       └── router/        # Vue Router
├── data/                  # Données locales (gitignored!)
│   ├── config.json
│   ├── devis/
│   └── factures/
├── config.template.json   # Template configuration
└── package.json
```

## Fonctionnalités par Phase

### ✅ Phase 1 : Structure de base (Terminée)
- [x] Setup Electron + Vue 3 + SCSS
- [x] Structure de dossiers
- [x] IPC de base
- [x] Chargement/sauvegarde config.json
- [x] Page Configuration fonctionnelle

### 🔄 Phase 2 : Gestion documents (En cours)
- [ ] Création/édition devis
- [ ] Création/édition factures
- [ ] Stockage JSON
- [ ] Liste/affichage documents
- [ ] Numérotation automatique
- [ ] Validation mentions obligatoires

### ⏳ Phase 3 : Export PDF
- [ ] Génération PDF design professionnel
- [ ] Export au format e-invoicing (Factur-X / UBL selon la PDP cible)

### ⏳ Phase 4 : Branchement avec une plateforme de facturation agréée (PDP)
- [ ] Couche d'abstraction `einvoiceApi.js` (adaptateur par fournisseur)
- [ ] Configuration de la PDP dans les paramètres
- [ ] Envoi de factures à la PDP
- [ ] Réception et consultation des factures
- [ ] Validation pré-envoi

### ⏳ Phase 5 : Finitions
- [ ] Auto-update
- [ ] Tests utilisateur
- [ ] Documentation utilisateur
- [ ] Build Windows (.exe)

## Configuration

Au premier lancement, l'application copie `config.template.json` vers `data/config.json`.

Configurez votre application via l'interface (page Configuration):
- Informations entreprise (SIRET, adresse, contact)
- Coordonnées bancaires (RIB)
- Paramètres de la plateforme de facturation agréée (URL d'API, credentials, format)
- Paramètres de facturation

## Sécurité

**IMPORTANT:** Le dossier `data/` contient vos données sensibles et est exclu du versionnement Git.

- Context Isolation activé
- Node Integration désactivé
- Communication via contextBridge sécurisé
- Validation double (UI + Main Process)

## Scripts Disponibles

- `npm run dev` - Lancer en mode développement
- `npm run build` - Build production (Vite + Electron Builder)
- `npm run build:win` - Build pour Windows uniquement

## Plan d'implémentation complet

Voir [PLAN.md](C:\Users\voile\.claude\plans\scalable-munching-valley.md) pour le plan détaillé des 5 phases.

## Licence

MIT

## Auteur

Développeur web front expert Vue.js
