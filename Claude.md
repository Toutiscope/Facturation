# Guidelines - Application Electron "Facturation"

## Règles strictes

- **Ne jamais exécuter de commandes git** (commit, push, pull, add, etc.)
- **Ne jamais proposer de commit** ni de message de commit

---

## Vue d'ensemble

Application desktop Electron pour la création, gestion et conformité de devis et factures selon la réglementation française 2027 pour Entrepreneur Individuel en prestation de services.

**Stack technique :**

- Electron (desktop app Windows)
- Vue.js 3 (Composition API)
- SCSS (pas de framework CSS)
- Node.js backend simple
- Stockage : fichiers JSON locaux
- Intégration : API d'une plateforme de facturation agréée (PDP – Plateforme de Dématérialisation Partenaire, choix de la PDP laissé à l'utilisateur)
- Auto-update : GitHub Releases

---

## Objectifs de l'application

### Fonctionnalités principales

1. **Création de devis** avec numérotation automatique modifiable
2. **Création de factures** avec numérotation automatique modifiable
3. **Export PDF** des devis et factures
4. **Stockage JSON local** organisé par année
5. **Envoi à une plateforme de facturation agréée** (PDP) via son API, au format e-invoicing standard (Factur-X, UBL ou équivalent selon la PDP)
6. **Réception de factures via la plateforme agréée** avec visualisation et export PDF
7. **Validation automatique** des mentions obligatoires
8. **Auto-update** via GitHub Releases
9. **Configuration utilisateur** via interface (pas de manipulation JSON manuelle)

### Non-fonctionnalités (pour l'instant)

- Envoi d'emails
- Gestion de clients (base de données clients)
- Multi-devises (EUR uniquement)

---

## Architecture technique

### Structure des dossiers

```
facturation/
├── src/
│   ├── main/                    # Process principal Electron
│   │   ├── index.js            # Entry point Electron
│   │   ├── einvoiceApi.js      # Intégration plateforme agréée (PDP)
│   │   ├── pdfGenerator.js     # Génération PDF
│   │   ├── validator.js        # Validation factures
│   │   └── autoUpdater.js      # Gestion des mises à jour
│   ├── renderer/               # Process de rendu (Vue.js)
│   │   ├── main.js             # Entry point Vue
│   │   ├── App.vue             # Composant racine
│   │   ├── components/         # Composants Vue
│   │   ├── views/              # Vues/Pages
│   │   ├── composables/        # Composables Vue
│   │   ├── styles/             # SCSS
│   │   └── assets/             # Images, fonts
│   └── preload/
│       └── index.js            # Script de preload (IPC)
├── data/                       # Données locales (gitignored)
│   ├── config.json             # Configuration utilisateur
│   ├── devis/
│   │   └── 2027/
│   │       ├── D2027-001.json
│   │       └── ...
│   └── factures/
│       └── 2027/
│           ├── F2027-001.json
│           └── ...
├── config.template.json        # Template de configuration (versionné)
├── package.json
└── README.md
```

### Stockage des données

**Structure du fichier `data/config.json` (données sensibles de l'utilisateur) :**

```json
{
  "company": {
    "companyName": "Nom de l'entreprise",
    "companyId": "123 456 789 00012",
    "address": "123 Rue Example",
    "postalCode": "44000",
    "city": "Nantes",
    "email": "contact@exemple.fr",
    "phoneNumber": "02 XX XX XX XX",
    "webSite": ""
  },
  "rib": {
    "iban": "FR76 XXXX XXXX XXXX XXXX XXXX XXX",
    "bic": "XXXXXXXX",
    "holder": "Nom du titulaire"
  },
  "einvoicePlatform": {
    "providerName": "",
    "identifier": "",
    "password": "",
    "apiKey": "",
    "urlApi": ""
  },
  "billing": {
    "legalNotice": "Dispensé d'immatriculation au registre du commerce...",
    "paymentTerms": "Paiement à 30 jours",
    "latePenalties": "En cas de retard de paiement, application de pénalités...",
    "latestQuoteNumber": 0,
    "latestInvoiceNumber": 0
  }
}
```

**Structure d'un devis/facture (ex: D2027-001.json) :**

```json
{
  "id": "000875",
  "type": "devis",
  "numero": "000875",
  "date": "15/01/2027",
  "validityDate": "15/01/2027",
  "status": "brouillon|envoyé|accepté|refusé",
  "customer": {
    "customerName": "Nom du client",
    "companyName": "Nom du client",
    "companyId": "987 654 321 00012",
    "address": "456 Avenue Client",
    "postalCode": "75001",
    "city": "Paris",
    "email": "client@exemple.fr",
    "clientType": "particulier|professionnel|administration"
  },
  "services": [
    {
      "id": 1,
      "description": "Développement site web",
      "quantity": 40,
      "unit": "heure|pièce",
      "unitPriceHT": 65.0,
      "totalHT": 2600.0
    }
  ],
  "totals": {
    "totalHT": 2600.0,
    "VAT": 0.0,
    "VATRate": 0,
    "totalTTC": 2600.0
  },
  "notes": "Notes internes",
  "createdAt": "2027-01-15T10:30:00Z",
  "editedAt": "2027-01-15T14:20:00Z"
}
```

**Structure d'une facture (similaire au devis + champs spécifiques) :**

```json
{
  // ... mêmes champs que devis
  "type": "facture",
  "numero": "000375",
  "dueDate": "15/02/2027",
  "associatedQuote": "000875",
  "einvoice": {
    "isSent": false,
    "dateSending": null,
    "depositNumber": null,
    "status": "brouillon|envoyé|accepté|rejeté",
    "errors": []
  }
}
```

---

## Spécifications fonctionnelles

### 1. Numérotation automatique

**Règles :**

- Format devis à 6 chiffres : `D{NUMERO}` (ex: D000001, D9856523...)
- Format factures : `F{NUMERO}` (ex: F000025, F025684...)
- Le champ doit être **pré-rempli mais éditable** par l'utilisateur
- À la sauvegarde, mettre à jour `dernierNumeroDevis` ou `dernierNumeroFacture` dans config.json

**Comportement :**

```javascript
// Proposition automatique
const nextQuoteNumber = `D${String(config.billing.latestQuoteNumber + 1).padStart(6, "0")}`;

// L'utilisateur peut modifier avant sauvegarde
// Si validation OK → sauvegarder et incrémenter le compteur
```

### 2. Validation des mentions obligatoires

**Pour Entrepreneur Individuel en prestation de services :**

**Mentions obligatoires sur TOUS les documents :**

- Nom et prénom de l'entrepreneur
- Adresse du siège social
- SIRET
- Email
- Téléphone

**Mentions spécifiques aux factures :**

- Numéro de facture unique et séquentiel
- Date de la facture
- Date d'échéance
- Identité complète du client (nom/raison sociale, adresse)
- Si client professionnel : SIRET obligatoire
- Description détaillée des prestations
- Prix unitaire HT
- Quantité
- Total HT par ligne
- Total HT global
- Taux de TVA applicable (ou mention "TVA non applicable, art. 293 B du CGI" si micro-entrepreneur)
- Total TTC
- Conditions de paiement
- Pénalités de retard
- Indemnité forfaitaire pour frais de recouvrement (40€)

**L'application doit :**

- Vérifier la présence de tous ces champs avant export PDF ou envoi à la plateforme agréée
- Afficher des alertes claires si des champs sont manquants
- Bloquer l'envoi/export si validation échoue
- Auto-remplir certains champs depuis config.json

### 3. Intégration avec une plateforme de facturation agréée (PDP)

**Principe :**

L'application doit se brancher sur l'API d'une **Plateforme de Dématérialisation Partenaire (PDP)** choisie par l'utilisateur. La PDP est responsable de la transmission des factures électroniques entre émetteur et destinataire conformément à la réglementation française.

- Authentification : OAuth2, API Key ou identifiants selon la PDP retenue
- Format de facture : format e-invoicing standard supporté par la PDP (Factur-X PDF/A-3 + XML CII, UBL 2.1, ou équivalent)
- L'URL d'API, les credentials et le format à utiliser sont configurables dans les paramètres

**Couche d'abstraction :**

Prévoir une interface technique unique (`einvoiceApi.js`) qui expose des opérations standard — `sendInvoice`, `fetchReceivedInvoices`, `downloadInvoicePdf` — et qui isole le code spécifique au fournisseur dans un adaptateur dédié. Cela permet de changer de PDP sans toucher au code applicatif.

**Fonctionnalités à implémenter :**

#### A. Envoi de factures

```javascript
// Processus :
// 1. Générer le document e-invoice au format attendu par la PDP
// 2. Valider le format avant envoi (schéma + mentions obligatoires)
// 3. Envoyer via l'API de la plateforme agréée
// 4. Récupérer l'identifiant de dépôt retourné par la plateforme
// 5. Mettre à jour le JSON de la facture avec les infos de transmission
// 6. Afficher confirmation ou erreurs
```

**Boutons dans l'interface :**

- **"Envoyer à la plateforme"** : envoi direct via l'API configurée
- **"Exporter le fichier e-invoice"** : téléchargement local du fichier pour envoi manuel

#### B. Réception de factures

```javascript
// Processus :
// 1. Récupérer la liste des factures reçues via l'API de la PDP
// 2. Afficher dans une liste (tableau)
// 3. Permettre visualisation (affichage PDF)
// 4. Permettre export PDF local
// 5. PAS de sauvegarde JSON (juste consultation)
```

**Interface de réception :**

- Onglet "Factures reçues"
- Tableau avec colonnes : Date, Émetteur, Numéro, Montant, Statut
- Boutons : "Enregistrer", "Télécharger PDF"
- Filtres : date, statut, émetteur

#### C. Validation pré-envoi

- Vérifier conformité du document e-invoice (XML CII, UBL, etc.)
- Vérifier mentions obligatoires
- Vérifier format des données (SIRET valide, IBAN valide si présent, etc.)
- Simuler la validation localement avant l'envoi à la plateforme

### 4. Génération PDF

**Bibliothèque recommandée : PDFKit ou jsPDF**

**Design du PDF :**

- En-tête avec logo et infos entreprise
- Titre "DEVIS" ou "FACTURE" bien visible
- Numéro et date
- Bloc client
- Tableau des prestations (description, qté, unité, P.U. HT, Total HT)
- Totaux (HT, TVA, TTC)
- Conditions de paiement et mentions légales en pied de page
- RIB (optionnel, configurable)

**Export au format e-invoicing :**

- PDF/A-3 (conforme archivage électronique)
- XML embarqué selon le standard requis par la PDP (CII Cross Industry Invoice, UBL 2.1, etc.)
- Bibliothèque : à choisir selon le format ciblé (`facturx-js`, librairie UBL, etc.)

### 5. Auto-update

**Utiliser electron-updater :**

- Vérifier les nouvelles versions au démarrage
- Télécharger en arrière-plan
- Afficher notification "Mise à jour disponible"
- Proposer "Installer maintenant" ou "Plus tard"
- Redémarrage après installation

**Configuration :**

```json
// package.json
{
  "build": {
    "publish": [
      {
        "provider": "github",
        "owner": "votre-username",
        "repo": "Facturation"
      }
    ]
  }
}
```

### 6. Interface utilisateur (Vue.js 3)

**Pages principales :**

1. **Dashboard** (page d'accueil)
   - Statistiques rapides (nb devis, nb factures, CA du mois/année)
   - Accès rapides vers création devis/facture
   - Derniers documents créés

2. **Devis**
   - Liste des devis (tableau filtrable/triable)
   - Bouton "Nouveau devis"
   - Actions : Voir, Modifier, Dupliquer, Convertir en facture, Exporter PDF, Supprimer

3. **Factures**
   - Liste des factures (tableau filtrable/triable)
   - Bouton "Nouvelle facture"
   - Actions : Voir, Modifier, Dupliquer, Exporter PDF, Envoyer à la plateforme agréée, Supprimer

4. **Factures reçues** (depuis la plateforme agréée)
   - Liste des factures reçues
   - Actions : Voir PDF, Télécharger PDF

5. **Configuration**
   - Formulaire pour éditer config.json
   - Sections : Entreprise, RIB, Plateforme de facturation, Facturation
   - Bouton "Sauvegarder"
   - Validation des champs (SIRET, IBAN, email, URL d'API, etc.)

**Formulaire de création/édition devis/facture :**

- Champs auto-remplis depuis config.json (infos entreprise)
- Numéro pré-rempli (éditable)
- Date (pré-remplie à aujourd'hui)
- Bloc client : formulaire complet (nom, adresse, SIRET si pro, type client)
- Tableau des prestations :
  - Lignes dynamiques (ajout/suppression)
  - Colonnes : Description, Quantité, Unité (select: heure/pièce), P.U. HT, Total HT
  - Calcul automatique des totaux
- Bloc totaux : Total HT, TVA (auto-calculée), Total TTC
- Notes internes (optionnel)
- Boutons : Enregistrer brouillon, Valider et générer PDF, Envoyer à la plateforme agréée (factures uniquement)

**Design SCSS :**

- Variables pour couleurs, espacements
- Layout responsive (même si Windows uniquement, bonne pratique)
- Thème professionnel sobre (bleu/gris par exemple)
- Typography claire et lisible
- Formulaires bien espacés et intuitifs
- Tableaux avec hover states
- Boutons avec états (hover, active, disabled)

---

## Spécifications techniques

### Communication IPC (Electron)

**Channels à créer :**

```javascript
// Main → Renderer
'update-available' // Nouvelle version disponible
'update-downloaded' // Mise à jour téléchargée

// Renderer → Main
'load-config' → return config.json
'save-config' → save config.json
'load-documents' → return liste devis/factures (avec filtres)
'load-document' → return un document spécifique
'save-document' → save devis ou facture
'delete-document' → supprimer un document
'generate-pdf' → générer PDF
'export-einvoice' → générer le fichier e-invoice au format attendu (Factur-X / UBL / …)
'send-einvoice' → envoyer la facture à la plateforme agréée configurée
'fetch-received-invoices' → récupérer les factures reçues via la plateforme agréée
'download-received-pdf' → télécharger le PDF d'une facture reçue
'validate-document' → valider avant envoi/export
'install-update' → installer mise à jour
```

### Sécurité

**IMPORTANT : Aucune donnée sensible dans le code versionné**

- `data/` dossier entier dans `.gitignore`
- `config.template.json` versionné avec valeurs vides/exemple
- Au premier lancement, copier template → `data/config.json` si n'existe pas
- Guider l'utilisateur vers Configuration pour remplir ses données
- Stocker les credentials de la plateforme agréée (API key, identifiants OAuth2, etc.) de manière sécurisée — éviter le plain text, utiliser `electron-store` avec chiffrement (`safeStorage` Electron de préférence)

### Gestion des erreurs

- Toutes les opérations I/O doivent être try/catch
- Messages d'erreur clairs et utilisables pour l'utilisateur final
- Logs pour debug (electron-log)
- Ne jamais crasher l'app, toujours gérer gracieusement

### Performance

- Chargement paresseux des documents (pagination ou virtualisation si beaucoup de documents)
- Indexation en mémoire des documents pour recherche rapide
- Cache de la config en mémoire (reload seulement si modification)

---

## Configuration de développement

**package.json scripts :**

```json
{
  "scripts": {
    "dev": "electron .",
    "build": "electron-builder",
    "build:win": "electron-builder --win"
  }
}
```

**Dependencies principales :**

- electron
- vue (v3)
- electron-updater
- pdfkit (ou jsPDF)
- axios (pour les appels HTTP vers l'API de la plateforme agréée)
- electron-store (pour config sécurisée)
- date-fns (manipulation dates)
- Validation : validator.js ou zod

**DevDependencies :**

- @vitejs/plugin-vue
- vite
- electron-builder
- sass

---

## Livrables attendus

### Phase 1 : Structure de base

- [ ] Setup Electron + Vue 3 + SCSS
- [ ] Structure de dossiers
- [ ] IPC de base
- [ ] Chargement/sauvegarde config.json
- [ ] Page Configuration fonctionnelle

### Phase 2 : Gestion documents

- [ ] Création/édition devis
- [ ] Création/édition factures
- [ ] Stockage JSON
- [ ] Liste/affichage documents
- [ ] Numérotation automatique
- [ ] Validation mentions obligatoires

### Phase 3 : Export PDF

- [ ] Génération PDF design professionnel
- [ ] Export au format e-invoicing (Factur-X / UBL selon PDP)

### Phase 4 : Branchement avec une plateforme de facturation agréée (PDP)

- [ ] Couche d'abstraction `einvoiceApi.js` (adaptateur par fournisseur)
- [ ] Configuration de la PDP dans les paramètres (URL, credentials, format)
- [ ] Envoi de factures à la PDP
- [ ] Réception et consultation des factures depuis la PDP
- [ ] Validation pré-envoi

### Phase 5 : Finitions

- [ ] Auto-update
- [ ] Tests utilisateur
- [ ] Documentation utilisateur
- [ ] Build Windows (.exe)

---

## Notes importantes pour le développement

1. **Utilisateur final non-technique** : L'interface doit être la plus intuitive possible, avec guidage clair et messages explicites

2. **Conformité 2027** : Se tenir informé des évolutions réglementaires et prévoir adaptabilité du code

3. **Plateforme agréée (PDP)** : l'utilisateur peut changer de PDP au fil du temps et chaque PDP a sa propre API. Prévoir une couche d'abstraction (`einvoiceApi.js` + adaptateurs) pour isoler l'intégration et faciliter l'ajout/le remplacement d'un fournisseur

4. **Pas de framework CSS** : Créer un système de design cohérent en SCSS vanilla (variables, mixins, structure BEM ou similaire)

5. **GitHub public** : Double vérification que RIEN de sensible n'est commité (config, credentials, données test réalistes)

6. **Backend simple** : Privilégier la simplicité, pas de sur-engineering. Node.js natif suffit pour la plupart des opérations

7. **Windows uniquement** : Pas besoin de gérer compatibilité macOS/Linux, optimiser pour Windows

8. **Vue 3 Composition API** : Utiliser `<script setup>`, composables, et bonnes pratiques Vue 3 modernes

9. **Tests** : Prévoir au moins des tests manuels systématiques, idéalement quelques tests unitaires sur la validation et calculs

10. **Performance** : Avec 800 devis + 400 factures/an, bien tester avec volume réaliste de données

---

## Ressources utiles

- Documentation Electron : https://www.electronjs.org/docs
- Vue 3 : https://vuejs.org/
- Réglementation facturation électronique : https://www.impots.gouv.fr/
- Norme Factur-X : https://fnfe-mpe.org/factur-x/
- Liste des PDP immatriculées (DGFiP) : à consulter sur impots.gouv.fr

---

**Auteur :** Développeur web front expert Vue.js  
**Date :** Février 2026  
**Version :** 1.0
