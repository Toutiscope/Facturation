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

### ✅ Phase 4 : Branchement avec une plateforme de facturation agréée (PDP)
- [x] Couche d'abstraction `einvoiceApi/` (adaptateur par fournisseur — SuperPDP)
- [x] Configuration de la PDP dans les paramètres (OAuth2, bac à sable, test de connexion)
- [x] Génération UBL EN16931 (validée schematron) + envoi de factures à la PDP
- [x] Résolution de l'adresse destinataire (annuaire DGFiP + saisie manuelle)
- [x] Réception et consultation des factures reçues (téléchargement Factur-X)
- [x] Synchronisation des statuts du cycle de vie

### 🔄 Phase 5 : Finitions
- [x] Auto-update
- [x] Documentation utilisateur (voir ci-dessous)
- [ ] Tests utilisateur de bout en bout
- [x] Build Windows (.exe)

## Configuration

Au premier lancement, l'application copie `config.template.json` vers `data/config.json`.

Configurez votre application via l'interface (page Configuration):
- Informations entreprise (SIRET, adresse, contact)
- Coordonnées bancaires (RIB)
- Paramètres de la plateforme de facturation agréée (URL d'API, credentials, format)
- Paramètres de facturation

## Facturation électronique (PDP)

L'application envoie et reçoit des factures électroniques via une **Plateforme de Dématérialisation Partenaire (PDP)** agréée. SuperPDP est la plateforme prise en charge par défaut (l'architecture reste ouverte à d'autres fournisseurs).

### 1. Créer un compte et une application chez la PDP

1. Créez un compte sur [superpdp.tech](https://www.superpdp.tech) (un environnement **bac à sable** gratuit est fourni, avec deux entreprises fictives Burger Queen et Tricatel).
2. Dans l'interface SuperPDP, créez une **application** rattachée à votre entreprise.
3. Notez le `client_id` et le `client_secret` (le secret ne s'affiche qu'une seule fois).

### 2. Configurer la plateforme dans l'application

Dans **Mes paramètres → Plateforme de facturation électronique** :

- Sélectionnez **SuperPDP**.
- Cochez **bac à sable** pour tester sans échanger de vraies factures.
- Renseignez le `client_id` et le `client_secret`, puis **Enregistrer les identifiants** (ils sont chiffrés localement, jamais stockés en clair).
- Cliquez sur **Tester la connexion** : le nom de votre entreprise doit s'afficher.

### 3. Envoyer une facture

Depuis l'écran d'édition d'une facture enregistrée, le bouton **Envoyer à la plateforme** :

1. valide les mentions obligatoires,
2. génère le format électronique **UBL** (norme EN16931, conforme au schématron français),
3. transmet la facture à la PDP.

Le **statut PDP** de la facture (Transmise / Acceptée / Encaissée / Refusée…) s'affiche dans l'en-tête de la facture et dans la colonne « Statut PDP » de la liste.

> **Adresse du destinataire** — Pour qu'une facture soit routée, le destinataire doit être joignable. L'application résout automatiquement son adresse via l'**annuaire DGFiP** (par SIREN). Si le client n'y figure pas (ou en bac à sable), renseignez son **adresse électronique PDP** dans la fiche client (champ optionnel, format `scheme:valeur`, ex. `0225:315143296_8898`).

### 4. Suivre le cycle de vie

Le traitement d'une facture est **asynchrone**. Sur la liste des factures, le bouton **Synchroniser les statuts** récupère les derniers événements de la PDP et met à jour le statut de chaque facture (acceptation, encaissement, refus…).

### 5. Factures reçues

L'onglet **Factures reçues** liste les factures que vos fournisseurs vous ont adressées via la PDP. Vous pouvez les consulter et **télécharger le PDF Factur-X** lisible. (Aucune sauvegarde locale : consultation uniquement.)

### Notes

- L'API SuperPDP est en version bêta (`/v1.beta`).
- En production, l'identité du vendeur doit correspondre à l'entreprise authentifiée auprès de la PDP.
- Référence technique des points d'API vérifiés : [`docs/superpdp-api-findings.md`](docs/superpdp-api-findings.md). Plan d'intégration : [`docs/pdp-integration-plan.md`](docs/pdp-integration-plan.md).

## Sécurité

**IMPORTANT:** Le dossier `data/` contient vos données sensibles et est exclu du versionnement Git.

- Identifiants PDP chiffrés au repos via `safeStorage` (jamais en clair, fichier `data/credentials.enc`)

- Context Isolation activé
- Node Integration désactivé
- Communication via contextBridge sécurisé
- Validation double (UI + Main Process)

## Scripts Disponibles

- `npm run dev` - Lancer en mode développement
- `npm run build` - Build production (Vite + Electron Builder)
- `npm run build:win` - Build pour Windows uniquement

## Plan d'implémentation

- Plan d'intégration PDP : [`docs/pdp-integration-plan.md`](docs/pdp-integration-plan.md)
- Points d'API SuperPDP vérifiés : [`docs/superpdp-api-findings.md`](docs/superpdp-api-findings.md)

## Licence

MIT

## Auteur

Développeur web front expert Vue.js
