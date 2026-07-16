# Plan — Factur-X à UI personnalisée (approche hybride)

> Statut : Phases 0 à 5 terminées ✅ — reste : Phase 6 (validation manuelle)
> Date : 2026-07-16

## Objectif

Produire un Factur-X **valide** dont la couche visuelle est **notre design PDFKit**
(au lieu du gabarit générique de SuperPDP), avec le XML CII embarqué et la
conformité PDF/A-3.

## Contexte code actuel

- `src/main/pdfGenerator.js` produit déjà un PDF designé (logo, couleurs, mise en
  page) via le bouton « Générer le PDF », mais ce n'est **pas** un Factur-X
  (pas de XML embarqué, pas PDF/A-3).
- `src/main/einvoiceApi/index.js` :
  - `exportFacturX(config, invoice)` délègue aujourd'hui la fabrication du PDF à
    SuperPDP via `convertDocument(..., { from: "ubl", to: "factur-x" })` → gabarit
    générique, aucune personnalisation possible.
  - `buildUbl` + `convertDocument` savent produire de l'UBL et convertir vers
    `cii` / `factur-x`.
- La chaîne UI est déjà en place (bouton « Exporter en Factur-X », handler
  `pdp:export-invoice`, bridge `pdp.exportInvoice`).
- `pdfkit@0.15` déjà installé ; `blob-stream` disponible ; `vitest` présent.

## Principe retenu

1. Visuel = notre PDF PDFKit existant, rendu en **PDF/A-3**.
2. XML CII obtenu via SuperPDP `/convert?from=ubl&to=cii` (SuperPDP ne fabrique
   plus le visuel, juste les données).
3. Embarquement du XML + métadonnées Factur-X dans le PDF.

---

## Phase 0 — Spike de faisabilité (BLOQUANT)

**But :** confirmer que `pdfkit@0.15` produit un PDF/A-3 conforme avec fichier
embarqué, sinon choisir le plan B.

- Tester `new PDFDocument({ subset: "PDF/A-3", pdfVersion: "1.7", tagged: true })`
  + `doc.file(xmlBuffer, { name: "factur-x.xml", relationship: "Alternative", ... })`.
- Générer un PDF de test, le passer dans le **validateur FNFE-MPE** et/ou l'outil
  SuperPDP (`POST /validation_reports` accepte le PDF Factur-X).
- **Livrable :** verdict PDFKit suffisant OU nécessité d'un post-traitement.

**Plan B si PDFKit insuffisant :** post-traiter avec `pdf-lib` (XMP + OutputIntent
ICC sRGB + AFRelationship) ou, en dernier recours, Ghostscript pour la conformité
PDF/A. → ajoute une dépendance et de la complexité ; à trancher ici.

**Décision utilisateur nº1 :** valider l'outil retenu à l'issue du spike.

---

## Phase 1 — Refactor de `pdfGenerator.js` pour réutiliser le rendu ✅ FAIT

Aujourd'hui `generatePDF()` mélange rendu + dialog + écriture disque. On isole
le rendu.

- [x] Extraire `renderInvoiceDocument(doc, type, document, config)` (toute la
  logique `renderHeader…renderFooter`) + `createInvoiceDoc(...)`.
- [x] Ajouter `buildPdfBuffer(type, document, config, options)` qui retourne un
  **Buffer** (accumulation de chunks ; `options` = options PDFDocument, ex.
  `{ subset: "PDF/A-3b", pdfVersion: "1.7", tagged: true }` pour la Phase 3).
- [x] `generatePDF()` réutilise `buildPdfBuffer` puis fait dialog + écriture —
  comportement inchangé.
- [x] Bascule des polices `Helvetica*` → **Noto Sans** (Regular/Bold/Italic),
  embarquées via `registerFonts(doc)`.
- [x] Polices versionnées dans `src/main/assets/fonts/` (+ `OFL.txt`).
- [x] Copie build : `copyFontsPlugin` (vite.config.js) → `dist-electron/fonts/`.
  Vérifié : `__dirname` du bundle = `dist-electron`, TTF présents après
  `vite build`, ICC PDFKit toujours copié. electron-builder embarque
  `dist-electron/**/*` (pas de changement de `build.files` requis).

**Fichiers :** `src/main/pdfGenerator.js`, `vite.config.js`,
`src/main/assets/fonts/*`.

**Reste à valider (non bloquant) :** rendu visuel réel Noto Sans (lancer l'app et
générer un PDF) — le rendu doit être quasi identique à l'ancien Helvetica.

---

## Phase 2 — Récupération du XML CII ✅ FAIT

- [x] Dans `einvoiceApi/index.js`, ajout de `buildCiiXml(config, invoice, options)` :
  `buildUbl(...)` → `convertDocument(..., { from: "ubl", to: "cii" })` (renvoie une
  string XML — `convertInvoice` ne retourne un Buffer que pour `to: "factur-x"`).
- [x] Abstraction préservée : si un jour on génère le CII localement, seule cette
  fonction change.

**Fichiers :** `src/main/einvoiceApi/index.js`.

**Note :** dépend de la PDP en ligne (conversion `ubl`→`cii`). Acceptable et isolé.

---

## Phase 3 — Assemblage Factur-X ✅ FAIT

- [x] Hook `decorate` ajouté à `buildPdfBuffer` (pdfGenerator.js) : appelé après
  le rendu, avant `doc.end()`, pour injecter XMP + fichier embarqué **sans coupler
  pdfGenerator à la couche PDP**.
- [x] Nouveau module **`src/main/facturxBuilder.js`** avec `assembleFacturX({ document,
  config, ciiXml, type, conformanceLevel })` — module « pur » (reçoit le CII, ne
  dépend pas de `einvoiceApi` → pas de cycle). Il :
  1. appelle `buildPdfBuffer(type, document, config, { docOptions: { subset:
     "PDF/A-3b", pdfVersion: "1.7", tagged: true }, decorate })` → PDF/A-3 visuel ;
  2. via `decorate` : `doc.appendXML(xmp)` (extension schema `fx` +
     `DocumentType=INVOICE`, `DocumentFileName=factur-x.xml`, `Version=1.0`,
     `ConformanceLevel=EN 16931`) puis `doc.file(cii, { name: "factur-x.xml",
     type: "text/xml", relationship: "Alternative" })`.
- [x] **OutputIntent + ICC sRGB** : fournis automatiquement par PDFKit (aucun asset
  ICC à ajouter, cf. Phase 0).
- [x] Chaîne de dépendances : `einvoiceApi → facturxBuilder → pdfGenerator` (validée
  au build, pas de cycle).
- [x] Spike d'assemblage complet vérifié : PDF/A-3 + Noto embarquée (`FontFile2`) +
  `factur-x.xml` (`/EmbeddedFile`, `AFRelationship Alternative`) + XMP `fx` coexistent.

**Fichiers :** `src/main/facturxBuilder.js` (nouveau), `src/main/pdfGenerator.js`.

---

## Phase 4 — Remplacement du chemin d'export ✅ FAIT

- [x] `einvoiceApi.exportFacturX` ne délègue plus la fabrication du PDF à la PDP :
  il génère le CII (`buildCiiXml`) puis assemble localement (`assembleFacturX`).
- [x] Le handler `pdp:export-invoice`, le preload et le bouton UI **restent
  inchangés** (déjà en place). ✅
- [x] Validation non bloquante via `POST /validation_reports` : le Factur-X
  assemblé est vérifié avant écriture ; un résumé (`{ checked, isValid, messages }`)
  est renvoyé au renderer, qui affiche un avertissement (toast) si des anomalies
  sont détectées. Un échec de l'appel de validation n'empêche pas l'export.

**Fichiers :** `src/main/einvoiceApi/index.js`, `src/main/ipcHandlers.js`
(handler `pdp:export-invoice` + `summarizeValidationReport`),
`src/renderer/views/InvoiceForm.vue`.

---

## Phase 5 — Envoi du Factur-X (PDF) ✅ FAIT

**Décision utilisateur nº2 : envoyer le Factur-X (PDF)** (le destinataire reçoit
le visuel + les données).

- [x] `sendInvoice` (einvoiceApi/index.js) : après résolution du routage
  (endpoints vendeur/acheteur via annuaire), génère le CII **portant ces
  endpoints** (`buildCiiXml`), assemble le Factur-X (`assembleFacturX`) et le
  dépose via `POST /invoices` avec `Content-Type: application/pdf`.
- [x] `SendToPdpModal.vue` : suppression du `targetFormat: "ubl"` obsolète.
- [x] Lint + build OK.

**Fichiers :** `src/main/einvoiceApi/index.js`,
`src/renderer/components/pdp/SendToPdpModal.vue`.

**Reste à valider (Phase 6, manuel) :** envoyer réellement une facture en sandbox
et confirmer le dépôt (statut `fr:200/201/202`) côté SuperPDP avec le Factur-X.

---

## Phase 6 — Tests & validation

- **Unitaires** (`vitest`) : structure du buffer (magic `%PDF`, présence de
  `/AFRelationship`, `factur-x.xml`, XMP `fx:DocumentType`).
- **Intégration manuelle** : export réel → validateur FNFE-MPE +
  `/validation_reports` SuperPDP → verdict `is_valid`.
- Cas de test : facture 293 B (TVA non applicable) et facture avec TVA.

---

## Risques & points d'attention

| Risque | Impact | Mitigation |
|---|---|---|
| PDFKit ne produit pas un PDF/A-3 conforme | Élevé | Phase 0 tranche ; plan B `pdf-lib`/Ghostscript |
| XMP Factur-X mal formé → recalé par validateur | Moyen | Se caler sur un exemple FNFE-MPE de référence |
| CII dépend de SuperPDP en ligne | Faible | Acceptable ; isolé dans `buildCiiXml` |
| Client particulier sans SIREN | Faible | Déjà géré : conversion refusée, erreur remontée |
| Polices non embarquées (PDF/A l'exige) | Moyen | Embarquer une police TTF explicite dans PDFKit |

## Dépendances éventuelles

- `pdf-lib` (seulement si Phase 0 le confirme).
- Asset `sRGB.icc` (profil ICC, ~10 Ko, à versionner).

## Effort estimé

- Phase 0 : 0,5 j (déterminant)
- Phases 1–4 : 2–4 j selon verdict Phase 0
- Phases 5–6 : 1 j

---

## Journal du spike (Phase 0)

**Verdict : ✅ PDFKit 0.15.2 est SUFFISANT — pas besoin de `pdf-lib` ni de Ghostscript.**

### Ce qui fonctionne nativement (vérifié par génération réelle)

`new PDFDocument({ subset: "PDF/A-3b", pdfVersion: "1.7", tagged: true })` produit,
sans dépendance supplémentaire :

- `pdfaid:part = 3` + `pdfaid:conformance = B` dans le XMP ;
- `OutputIntent` `GTS_PDFA1` avec **profil ICC sRGB déjà fourni par PDFKit**
  (`node_modules/pdfkit/js/data/sRGB_IEC61966_2_1.icc`) — aucun asset ICC à ajouter ;
- flux `/Metadata` (`/Type /Metadata`) ;
- `doc.file(buffer, { name: "factur-x.xml", type: "text/xml", relationship: "Alternative" })`
  → génère `/EmbeddedFile`, `/AFRelationship /Alternative`, entrée `/AF` au catalogue,
  `/Subtype text#2Fxml` — conforme aux exigences Factur-X ;
- `doc.appendXML(...)` permet d'injecter le **XMP Factur-X** (namespace `fx`
  `urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#` + `pdfaExtension:schemas`)
  avant `doc.end()`.

### ⚠️ Point d'attention CONFIRMÉ — embarquement des polices

- Avec la police par défaut **Helvetica (base-14, Type1)** → `FontFile` **absent**
  (polices NON embarquées). Un validateur PDF/A strict (veraPDF / FNFE-MPE) **recalera**
  le document (règle : toutes les polices doivent être embarquées).
- Correctif validé : `doc.registerFont("Body", "<chemin>.ttf")` puis `doc.font("Body")`
  → `/FontFile2` présent, police en sous-ensemble (`Type0` / `CIDFontType2`). ✅
- **Action Phase 1/3 :** bundler une police TrueType **librement redistribuable** dans
  `src/main/assets/fonts/` et faire basculer `pdfGenerator.js` dessus.
  **Décision utilisateur : Noto Sans (licence OFL)**, appliquée au **Factur-X ET à
  tous les PDF** (homogénéité du rendu). Variantes minimales à embarquer :
  `NotoSans-Regular.ttf` et `NotoSans-Bold.ttf` (ajouter Italic/BoldItalic si le
  rendu l'exige). Inclure aussi le fichier de licence OFL à côté des `.ttf`.
  Vérifier l'inclusion de l'asset par electron-builder (`build.files` / `extraResources`)
  et le résolveur de chemin en prod (cf. `src/main/utils/paths`).

### Incidences sur le plan

- **Phase 3 simplifiée** : plus besoin de `pdf-lib`, tout se fait dans le flux PDFKit
  (le XMP `fx` + `doc.file` doivent être ajoutés avant `doc.end()`).
- **Dépendance `pdf-lib` : abandonnée.** Seul ajout d'asset = **une police TTF**
  (l'ICC est déjà fourni par PDFKit).
- **Décision utilisateur nº1 : tranchée → on garde PDFKit.**

### Reste à valider (non bloquant pour démarrer)

- Conformité formelle non vérifiée ici (pas de veraPDF/validateur en ligne dans
  l'environnement de spike). À confirmer en Phase 6 via le validateur FNFE-MPE
  et/ou `POST /validation_reports` de SuperPDP.
- PDFKit n'ajoute pas `xmpMM:DocumentID` / `InstanceID` : à surveiller si un
  validateur l'exige (ajout possible via `appendXML`).

### Méthode

Spike réalisé via scripts jetables (`node`) générant un PDF réel puis inspection
binaire (magic, XMP, `/AF`, `/FontFile2`…). Scripts supprimés après coup
(non versionnés).
