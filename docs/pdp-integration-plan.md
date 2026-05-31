# Plan d'intégration PDP (SuperPDP) dans Facturation

> Document de référence pour l'intégration d'une Plateforme de Dématérialisation Partenaire (PDP) dans l'application Facturation. SuperPDP est la première PDP supportée mais l'architecture reste agnostique pour ajouter d'autres fournisseurs sans toucher au métier.

## Contexte initial

État du projet au démarrage de l'intégration :

- App Electron + Vue 3 fonctionnelle (Phases 1-3 + 5 du CLAUDE.md déjà faites : config, devis/factures, PDF, auto-update)
- Aucun fichier `einvoiceApi.js`, aucun dossier `adapters/`
- `config.json` ne contient pas encore `einvoicePlatform`
- `Settings.vue` n'a pas de section PDP
- `invoiceSchema` (Zod) ne contient pas le champ `einvoice`
- Statuts factures côté UI : `draft|sent|paid|overdue` — à étendre pour le cycle de vie PDP

## Décisions structurantes

1. **Génération XML** : on **ne génère pas** UBL/CII côté Facturation. On envoie un JSON `en_invoice` (EN16931) à `POST /v1.beta/invoices/convert` pour récupérer le format final. Cela évite une lib XML lourde et garde le code testable.
2. **Architecture** : un orchestrateur `einvoiceApi/index.js` + des adaptateurs par PDP (`adapters/superpdp.js`). Demain on branche une autre PDP sans toucher au métier.
3. **Sécurité credentials** : `safeStorage` Electron, stockés hors `config.json` dans un fichier chiffré `data/credentials.enc`.
4. **Asynchrone** : on persiste le `depositNumber` SuperPDP dans le JSON local et on synchronise les statuts via un polling périodique des `/invoice_events`.

---

## Phase 1 — Fondations (couche d'abstraction + credentials)

**Nouveaux fichiers :**

- `src/main/einvoiceApi/index.js` — orchestrateur, sélectionne l'adapter selon `providerName`
- `src/main/einvoiceApi/adapters/superpdp.js` — implémentation SuperPDP
- `src/main/einvoiceApi/tokenCache.js` — cache OAuth2 (token + expiresAt en mémoire, refresh à T-60s, retry sur 401)
- `src/main/einvoiceApi/secureCredentials.js` — chiffrement via `safeStorage`, lecture/écriture `data/credentials.enc`
- `src/main/einvoiceApi/mappers/enInvoice.js` — mapping JSON local → `en_invoice` EN16931

**Interface adapter (contrat unique) :**

```js
{
  testConnection(),            // GET /companies/me
  sendInvoice(enInvoice),      // convert + POST /invoices
  fetchInvoices(opts),         // GET /invoices (filtrable direction=received/sent)
  getInvoice(id),              // GET /invoices/{id}
  downloadInvoice(id, format), // GET /invoices/{id}/download
  validateInvoice(file),       // POST /validation_reports
  listEvents(opts),            // GET /invoice_events?starting_after_id=N
  createEvent(invoiceId, statusCode, details),
  searchFrenchDirectory(siren),
}
```

---

## Phase 2 — Schéma de données & migration

**Modifications :**

- `config.template.json` (créé si absent) → ajouter `einvoicePlatform: { providerName, urlApi, isSandbox }` (les credentials vont dans `credentials.enc`)
- `src/main/utils/paths.js` → ajouter `einvoicePlatform` dans `DEFAULT_CONFIG` et un chemin `EINVOICE_CREDENTIALS_PATH`
- `src/main/validator.js` → enrichir `invoiceSchema` :

  ```js
  einvoice: z.object({
    isSent: z.boolean(),
    dateSending: z.string().nullable(),
    depositNumber: z.string().nullable(),
    status: z.enum(['draft','submitted','accepted','rejected','paid','cancelled']),
    errors: z.array(z.object({ code: z.string(), message: z.string() })),
    lastEventId: z.number().nullable(),
  }).optional()
  ```

- Migration lazy au chargement : si `invoice.einvoice` absent → ajouter avec valeurs par défaut

---

## Phase 3 — IPC + preload

**`src/main/ipcHandlers.js`** — ajouter une section dédiée PDP :

```
'pdp:test-connection'
'pdp:save-credentials'        // chiffre puis stocke
'pdp:has-credentials'         // bool (sans renvoyer les valeurs)
'pdp:send-invoice'            // type='factures', id
'pdp:validate-invoice'        // dry-run sur /validation_reports
'pdp:fetch-received'
'pdp:download-received-pdf'
'pdp:list-events'
'pdp:create-event'
'pdp:search-directory'        // recherche annuaire DGFiP
'pdp:sync'                    // polling incrémental des événements
```

**`src/preload/index.js`** — exposer `electronAPI.pdp.*` (sous-objet pour la lisibilité)

---

## Phase 4 — UI Configuration (Settings.vue)

Ajouter section **"Plateforme de facturation électronique"** :

- Select `providerName` (pour l'instant : SuperPDP uniquement, mais extensible)
- Toggle `isSandbox`
- Input `urlApi` (pré-rempli : `https://api.superpdp.tech`)
- Inputs `client_id` / `client_secret` (avec œil pour révéler, sauvegarde via `pdp:save-credentials`)
- Bouton **"Tester la connexion"** → appelle `pdp:test-connection`, affiche : nom de l'entreprise SuperPDP retournée + statut de vérification de session
- Aide contextuelle : lien externe `https://www.superpdp.tech` pour créer une application

---

## Phase 5 — Envoi d'une facture (InvoiceForm + InvoiceList)

**InvoiceForm.vue :**

- Nouveau bouton **"Envoyer à la PDP"** (visible uniquement si facture validée + non encore envoyée + credentials présents)
- Modal de confirmation avec étapes :
  1. Validation locale (mentions obligatoires)
  2. Validation pré-envoi PDP (`/validation_reports`)
  3. Envoi final (`POST /invoices`)
- Affichage des erreurs schematron remontées par SuperPDP (avant l'envoi définitif)
- Mise à jour de `invoice.einvoice` + sauvegarde

**InvoiceList.vue :**

- Nouvelle colonne **"Statut PDP"** (badge couleur selon `einvoice.status`)
- Filtre additionnel par statut PDP

---

## Phase 6 — Vue "Factures reçues"

**Nouveau fichier `src/renderer/views/ReceivedInvoices.vue`** :

- Liste paginée des factures reçues (`GET /invoices` filtré côté serveur)
- Colonnes : Date, Émetteur, Numéro, Montant TTC, Statut
- Filtres : période, statut, émetteur
- Actions : **Voir PDF**, **Télécharger**, **Marquer comme payée** (envoie événement `fr:212`)
- Ajout route Vue Router + entrée dans `MainLayout.vue`

**Pas de stockage JSON local** pour les factures reçues (consultation seulement, comme prévu dans CLAUDE.md).

---

## Phase 7 — Cycle de vie (synchronisation des événements)

- Composable `useEinvoiceSync` côté renderer
- Au démarrage de l'app : appel `pdp:sync` → récupère les événements depuis `lastEventId` stocké en config, met à jour les factures locales concernées (`einvoice.status`, `errors`)
- Polling périodique (5 min) ou bouton manuel "Synchroniser maintenant"
- Mapping `status_code` SuperPDP → statut applicatif :
  - `fr:200` → `accepted`
  - `fr:203/204/205` → `rejected` + raison dans `errors`
  - `fr:212` → `paid`
  - etc. (tableau de mapping dans `mappers/statusMapping.js`)

---

## Phase 8 — Annuaire DGFiP (vérification destinataire)

Dans `CustomerForm.vue` (client professionnel) :

- Bouton **"Vérifier dans l'annuaire"** à côté du SIRET
- Appelle `pdp:search-directory`
- Affiche : entreprise trouvée OK / non trouvée (prévenir que le client n'est peut-être pas encore prêt à recevoir)

---

## Phase 9 — Tests

**Tests unitaires (vitest, déjà installé) :**

- `einvoiceApi/__tests__/superpdp.test.js` — mocks `fetch`, vérifie endpoints + headers + retry 401
- `einvoiceApi/__tests__/tokenCache.test.js` — expiration, refresh
- `einvoiceApi/__tests__/enInvoiceMapper.test.js` — mapping JSON local → EN16931
- `einvoiceApi/__tests__/statusMapping.test.js`

**Tests d'intégration (manuels) :**

- Compte sandbox SuperPDP (Burger Queen + Tricatel)
- Scénario E2E : créer facture → envoyer → polling → marquer encaissée

---

## Phase 10 — Documentation utilisateur

- Mettre à jour `README.md` : section "Configurer une PDP"
- Guide pas-à-pas dans l'app (modal d'aide accessible depuis Settings)

---

## Ordre de mise en œuvre recommandé

| Étape | Livrable | Pourquoi en premier |
|---|---|---|
| 1 | Phase 1 + 2 | Pas d'UI utile sans les fondations |
| 2 | Phase 3 | Pont entre main et renderer |
| 3 | Phase 4 | Permet de tester la connexion en sandbox dès maintenant |
| 4 | Phase 5 + mapper EN16931 | Premier vrai cas d'usage end-to-end |
| 5 | Phase 7 | Sans ça, les statuts envoyés restent figés |
| 6 | Phase 6 | Réception (besoin moins urgent côté EI prestataire) |
| 7 | Phase 8 | Confort utilisateur |
| 8 | Phases 9 + 10 | Stabilisation |

---

## Risques identifiés

- **API `/v1.beta`** : encore en beta, breaking changes possibles. Mitigation : variable `API_VERSION` centralisée + tests d'intégration sandbox réguliers.
- **`safeStorage` Electron** : indisponible si l'utilisateur n'a pas de keychain (rare sur Windows mais possible). Fallback à prévoir : chiffrement par mot de passe maître.
- **Session OAuth2 non vérifiée (403)** : pendant l'onboarding chez SuperPDP, la vérification peut prendre plusieurs minutes. UI doit l'expliquer clairement.
- **Génération `en_invoice`** : tous les champs EN16931 ne sont pas évidents (codes pays, schemes d'identifiants). Prévoir un effort de mapping non négligeable (Phase 5).

---

## Références

- Skill projet : `.claude/skills/superpdp/SKILL.md`
- Documentation SuperPDP : <https://www.superpdp.tech/documentation>
- OpenAPI SuperPDP : <https://www.superpdp.tech/openapi>
- Norme EN16931 : XP Z12-012 (AFNOR)
- Spec projet : `CLAUDE.md`
