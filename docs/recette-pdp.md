# Checklist de recette — Intégration PDP (test manuel de bout en bout)

> Test manuel depuis l'interface, en environnement **bac à sable** SuperPDP.
> Coche chaque étape ; la colonne « Attendu » décrit le résultat correct.

## Prérequis

- [ ] Compte SuperPDP sandbox créé sur [superpdp.tech](https://www.superpdp.tech) (entreprises fictives **Burger Queen** + **Tricatel**)
- [ ] Une **application** OAuth créée pour Burger Queen → `client_id` + `client_secret` notés
- [ ] App lancée en dev : `npm run dev`

> ⚠️ En bac à sable, l'identité vendeur doit correspondre au compte authentifié (Burger Queen). Les étapes ci-dessous utilisent donc l'identité Burger Queen.

---

## 1. Configuration de la plateforme

| # | Action | Attendu |
|---|--------|---------|
| 1.1 | Mes paramètres → section **Plateforme de facturation électronique** | La section s'affiche |
| 1.2 | Sélectionner **SuperPDP** | Le champ URL se pré-remplit avec `https://api.superpdp.tech` |
| 1.3 | Cocher **bac à sable** | Case cochée |
| 1.4 | Cliquer **Configurer**, saisir `client_id` + `client_secret`, **Afficher** le secret | Le secret devient lisible |
| 1.5 | **Enregistrer les identifiants** | Badge passe à **Configurés** ; pas d'erreur |
| 1.6 | Rouvrir la section après sauvegarde | Les identifiants ne sont **jamais ré-affichés en clair** |

- [ ] Section 1 OK

---

## 2. Test de connexion

| # | Action | Attendu |
|---|--------|---------|
| 2.1 | Cliquer **Tester la connexion** | Message vert : *« Connexion OK — entreprise reconnue : Burger Queen »* |
| 2.2 | (Optionnel) Saisir un mauvais secret puis tester | Message d'erreur clair (code HTTP affiché), pas de crash |

- [ ] Section 2 OK

---

## 3. Préparer l'identité vendeur (spécifique sandbox)

| # | Action | Attendu |
|---|--------|---------|
| 3.1 | Mes paramètres → **Mes informations** : nom = `Burger Queen`, SIRET commençant par `000000002` | Sauvegarde sans erreur |
| 3.2 | Cliquer **Sauvegarder la configuration** | Confirmation de sauvegarde |

- [ ] Section 3 OK

---

## 4. Créer et envoyer une facture

| # | Action | Attendu |
|---|--------|---------|
| 4.1 | Nouvelle facture, client **professionnel** « Tricatel », SIRET `000000001` | — |
| 4.2 | Champ **Adresse électronique PDP** du client = `0225:315143296_8898` | — |
| 4.3 | Ajouter une prestation (ex. 2 jours × 500 €), enregistrer | Facture enregistrée, n° attribué |
| 4.4 | Bouton **Envoyer à la plateforme** | Modal d'envoi s'ouvre |
| 4.5 | Étape de revue | Mentions obligatoires OK (sinon blocage explicite) |
| 4.6 | Confirmer l'envoi | Succès + **numéro de dépôt** affiché |
| 4.7 | Fermer la modal | Badge en-tête **PDP : Transmise** |

- [ ] Section 4 OK

---

## 5. Affichage du statut PDP

| # | Action | Attendu |
|---|--------|---------|
| 5.1 | Liste des factures | Colonne **Statut PDP** = « Transmise » sur la facture envoyée |
| 5.2 | Factures non envoyées | Colonne Statut PDP = « — » |

- [ ] Section 5 OK

---

## 6. Synchronisation du cycle de vie

| # | Action | Attendu |
|---|--------|---------|
| 6.1 | Liste des factures → **Synchroniser les statuts** | Toast : « X facture(s) mise(s) à jour » ou « Statuts déjà à jour » |
| 6.2 | Observer le statut PDP après synchro | Évolue selon les événements PDP (ex. Acceptée / Reçue) |
| 6.3 | Re-synchroniser immédiatement | Pas de doublon, message « déjà à jour » |

- [ ] Section 6 OK

---

## 7. Factures reçues

| # | Action | Attendu |
|---|--------|---------|
| 7.1 | Onglet **Factures reçues** | La liste se charge (peut être vide pour Burger Queen en sandbox) |
| 7.2 | Si une facture reçue existe : **Télécharger PDF** | Dialogue de sauvegarde ; PDF Factur-X lisible enregistré |
| 7.3 | **Rafraîchir** | Rechargement sans erreur |

- [ ] Section 7 OK

---

## 8. Cas d'erreur (robustesse)

| # | Action | Attendu |
|---|--------|---------|
| 8.1 | Envoyer une facture vers un client **sans** adresse électronique et **sans** SIREN valide | Erreur claire : adresse/SIREN manquant |
| 8.2 | Envoyer vers un SIREN absent de l'annuaire (hors override) | Message : destinataire introuvable / pas encore actif |
| 8.3 | Supprimer les identifiants puis tenter une synchro/un envoi | Erreur claire « plateforme non configurée » (pas de crash) |

- [ ] Section 8 OK

---

## 9. Sécurité (vérifications fichiers)

| # | Vérification | Attendu |
|---|--------------|---------|
| 9.1 | `data/credentials.enc` existe après config | Fichier présent, **contenu chiffré illisible** |
| 9.2 | `git status` | Ni `data/`, ni credentials, ni fichiers temporaires suivis |
| 9.3 | Aucun `client_secret`/token en clair dans les logs (`%APPDATA%/facturation/logs/main.log`) | Seuls `providerName`, chemins, codes d'erreur apparaissent |

- [ ] Section 9 OK

---

## Résultat global

- [ ] **Recette validée** — l'intégration PDP fonctionne de bout en bout en bac à sable.

**Remarques / anomalies constatées :**

> _(à compléter pendant la recette)_

---

### Référence rapide sandbox

| Élément | Valeur |
|---|---|
| Vendeur (compte authentifié) | Burger Queen — SIREN `000000002` — adresse `0225:315143296_8899` |
| Acheteur de test | Tricatel — SIREN `000000001` — adresse `0225:315143296_8898` |
| Statuts attendus à l'envoi | `api:uploaded` → `fr:200` → `fr:201` → `fr:202` |
