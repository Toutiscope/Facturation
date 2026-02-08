# Guidelines - Application Electron "Facturation"

## Vue d'ensemble

Application desktop Electron pour la création, gestion et conformité de devis et factures selon la réglementation française 2027 pour Entrepreneur Individuel en prestation de services.

**Stack technique :**
- Electron (desktop app Windows)
- Vue.js 3 (Composition API)
- SCSS (pas de framework CSS)
- Node.js backend simple
- Stockage : fichiers JSON locaux
- Intégration : Chorus Pro (API)
- Auto-update : GitHub Releases

---

## Objectifs de l'application

### Fonctionnalités principales
1. **Création de devis** avec numérotation automatique modifiable
2. **Création de factures** avec numérotation automatique modifiable
3. **Export PDF** des devis et factures
4. **Stockage JSON local** organisé par année
5. **Envoi à Chorus Pro** (format Factur-X)
6. **Réception de factures Chorus Pro** avec visualisation et export PDF
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
│   │   ├── chorusApi.js        # Intégration Chorus Pro
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
    "holder": "Nom du titulaire",
    "bank": "Nom de la banque"
  },
  "chorusPro": {
    "identifier": "",
    "password": "",
    "apiKey": "",
    "urlApi": "https://chorus-pro.gouv.fr/api/..."
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
      "unitPriceHT": 65.00,
      "totalHT": 2600.00
    }
  ],
  "totals": {
    "totalHT": 2600.00,
    "VAT": 0.00,
    "VATRate": 0,
    "totalTTC": 2600.00
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
  "chorusPro": {
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
const nextQuoteNumber = `D${String(config.billing.latestQuoteNumber + 1).padStart(6, '0')}`;

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
- Mention "Dispensé d'immatriculation au registre du commerce..."

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
- Vérifier la présence de tous ces champs avant export PDF ou envoi Chorus Pro
- Afficher des alertes claires si des champs sont manquants
- Bloquer l'envoi/export si validation échoue
- Auto-remplir certains champs depuis config.json

### 3. Intégration Chorus Pro

**API Chorus Pro :**
- Documentation officielle : https://developer.chorus-pro.gouv.fr/
- Authentification : OAuth2 ou API Key (selon API disponible)
- Format de facture : **Factur-X** (PDF + XML embarqué) recommandé pour compatibilité

**Fonctionnalités à implémenter :**

#### A. Envoi de factures
```javascript
// Processus :
// 1. Générer le Factur-X (PDF/A-3 + XML CII)
// 2. Valider le format avant envoi
// 3. Envoyer via API Chorus Pro
// 4. Récupérer le numéro de dépôt
// 5. Mettre à jour le JSON de la facture avec infos Chorus Pro
// 6. Afficher confirmation ou erreurs
```

**Boutons dans l'interface :**
- **"Envoyer à Chorus Pro"** : envoi direct via API
- **"Exporter Factur-X"** : téléchargement du fichier pour envoi manuel

#### B. Réception de factures
```javascript
// Processus :
// 1. Récupérer la liste des factures reçues via API
// 2. Afficher dans une liste (tableau)
// 3. Permettre visualisation (affichage PDF)
// 4. Permettre export PDF local
// 5. PAS de sauvegarde JSON (juste consultation)
```

**Interface de réception :**
- Onglet "Factures reçues"
- Tableau avec colonnes : Date, Émetteur, Numéro, Montant, Statut
- Boutons : "Enregistrer", "Télécharger PDF", "Envoyer à Chorus Pro"
- Filtres : date, statut, émetteur

#### C. Validation pré-envoi
- Vérifier conformité du XML CII
- Vérifier mentions obligatoires
- Vérifier format des données (SIRET valide, IBAN valide si présent, etc.)
- Simuler la validation Chorus Pro en local avant envoi

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

**Export Factur-X :**
- PDF/A-3 (conforme archivage électronique)
- XML CII embarqué (norme Cross Industry Invoice)
- Bibliothèque : `facturx-js` ou équivalent

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
    "publish": [{
      "provider": "github",
      "owner": "votre-username",
      "repo": "Facturation"
    }]
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
   - Actions : Voir, Modifier, Dupliquer, Exporter PDF, Envoyer Chorus Pro, Supprimer

4. **Factures reçues** (Chorus Pro)
   - Liste des factures reçues
   - Actions : Voir PDF, Télécharger PDF

5. **Configuration**
   - Formulaire pour éditer config.json
   - Sections : Entreprise, RIB, Chorus Pro, Facturation
   - Bouton "Sauvegarder"
   - Validation des champs (SIRET, IBAN, email, etc.)

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
- Boutons : Enregistrer brouillon, Valider et générer PDF, Envoyer Chorus Pro (factures uniquement)

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
'export-facturx' → générer Factur-X
'send-chorus' → envoyer facture à Chorus Pro
'fetch-chorus-invoices' → récupérer factures reçues
'download-chorus-pdf' → télécharger PDF d'une facture reçue
'validate-document' → valider avant envoi/export
'install-update' → installer mise à jour
```

### Sécurité

**IMPORTANT : Aucune donnée sensible dans le code versionné**

- `data/` dossier entier dans `.gitignore`
- `config.template.json` versionné avec valeurs vides/exemple
- Au premier lancement, copier template → `data/config.json` si n'existe pas
- Guider l'utilisateur vers Configuration pour remplir ses données
- Stocker credentials Chorus Pro de manière sécurisée (éviter plain text si possible, utiliser electron-store avec chiffrement)

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
- axios (pour appels API Chorus Pro)
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
- [ ] Export Factur-X

### Phase 4 : Chorus Pro
- [ ] Intégration API
- [ ] Envoi factures
- [ ] Réception factures
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

3. **Chorus Pro** : L'API peut changer, prévoir une couche d'abstraction pour faciliter les mises à jour

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
- Chorus Pro API : https://developer.chorus-pro.gouv.fr/
- Norme Factur-X : https://fnfe-mpe.org/factur-x/
- Réglementation facturation électronique : https://www.impots.gouv.fr/

---

**Auteur :** Développeur web front expert Vue.js  
**Date :** Février 2026  
**Version :** 1.0