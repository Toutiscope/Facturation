# SuperPDP — faits API vérifiés en sandbox (2026-05-26)

Vérifié en direct contre `https://api.superpdp.tech` avec un compte sandbox (Burger Queen / Tricatel). Ces points corrigent des hypothèses fausses du plan initial.

## Authentification — confirmée

- `POST /oauth2/token` (`grant_type=client_credentials`) → `{ access_token, expires_in: 1799, token_type: "bearer" }`
- `GET /v1.beta/companies/me` → `{ id, env: "sandbox", number_scheme, number, formal_name, trade_name, address, postcode, city, country }`
- La session sandbox était immédiatement vérifiée (pas de 403).

## Formats acceptés en ENTRÉE (création de facture)

`POST /v1.beta/invoices` — le **corps brut** est analysé, format auto-détecté.

| Entrée | Accepté ? |
|---|---|
| UBL XML | ✅ (prouvé par quick_start + nos tests) |
| CII XML | ✅ (format reconnu) |
| Factur-X PDF | ✅ (attendu) |
| **JSON `en_invoice`** (corps `application/json`) | ❌ **400 "unknown format"** |
| JSON `{ en_invoice: {...} }` | ❌ 400 "unknown format" |

➡️ **Conclusion majeure** : on ne peut PAS envoyer un JSON. Il faut générer du **UBL** (ou CII / Factur-X) et le POSTer en brut.

Réponse de `POST /invoices` (200) :
```json
{ "id": 59136, "company_id": 8899, "created_at": "...",
  "events": [{ "status_code": "api:uploaded", "status_text": "Téléversée" }],
  "direction": "out" }
```

## Endpoint `/convert`

`POST /v1.beta/invoices/convert?from=<fmt>&to=<fmt>` — paramètres **query** `from` et `to`, corps = fichier brut.

- `from` valides : `ubl`, `cii`, `factur-x` (XML/PDF en entrée)
- `to` valides : `ubl`, `cii`, `factur-x`
- `to=json` / `to=en_invoice` → ❌ 400 "unknown format to: ..."

➡️ `/convert` ne produit **pas** de JSON. Il ne sert qu'à passer d'un format XML/PDF à un autre (ex : UBL → Factur-X pour l'archivage lisible).

## Schéma réel `en_invoice` (sortie de `GET /invoices/{id}`)

C'est la représentation **canonique en lecture seule**. Noms de champs réels (très différents de mes hypothèses initiales) :

```json
{
  "number": "F20260526_201523_461",
  "issue_date": "2025-06-30",
  "type_code": 380,
  "currency_code": "EUR",
  "payment_due_date": "2025-07-30",
  "notes": [{ "subject_code": "PMT", "note": "..." }],
  "process_control": {
    "business_process_type": "M1",
    "specification_identifier": "urn:cen.eu:en16931:2017"
  },
  "seller": {
    "name": "Burger Queen",
    "identifiers": [{ "value": "000000002", "scheme": "0225" }],
    "legal_registration_identifier": { "value": "000000002", "scheme": "0002" },
    "vat_identifier": "FR18000000002",
    "electronic_address": { "value": "315143296_8899", "scheme": "0225" },
    "postal_address": { "country_code": "FR" }
  },
  "buyer": { "...idem seller..." },
  "delivery_information": { "delivery_date": "2025-06-30" },
  "deliver_to_address": { "country_code": "FR" },
  "totals": {
    "sum_invoice_lines_amount": "1560.46",
    "total_without_vat": "1560.46",
    "total_vat_amount": { "value": "303.33", "currency_code": "EUR" },
    "total_with_vat": "1863.79",
    "amount_due_for_payment": "1863.79"
  },
  "vat_break_down": [{
    "vat_category_taxable_amount": "60.46",
    "vat_category_tax_amount": "3.33",
    "vat_category_code": "S",
    "vat_identifier": "VAT",
    "vat_category_rate": "5.50"
  }],
  "lines": [{
    "identifier": "001",
    "invoiced_quantity": "28.5200",
    "invoiced_quantity_code": "KGM",
    "net_amount": "60.46",
    "price_details": { "item_net_price": "2.120000" },
    "vat_information": {
      "invoiced_item_vat_category_code": "S",
      "invoiced_item_vat_rate": "5.50"
    },
    "item_information": { "name": "...", "description": "..." }
  }]
}
```

> Note : `scheme: "0225"` = code de routage sandbox SuperPDP ; `"0002"` = SIREN (ISO 6523) pour `legal_registration_identifier`. En production l'`electronic_address` du destinataire doit être résolvable via l'annuaire.

## Codes de statut réels (cycle de vie, champ `events[].status_code`)

| Code | Libellé renvoyé |
|---|---|
| `api:uploaded` | Téléversée |
| `fr:200` | Déposée (validée) |
| `fr:201` | Émise par la plateforme |
| `fr:202` | Reçue par la plateforme |
| `fr:204`…`fr:211` | (statuts cycle de vie — à émettre via POST /invoice_events) |
| `fr:212` | Encaissée |

➡️ Mapping pour Phase 7 :
- `fr:200` / `fr:201` / `fr:202` → `submitted`/`accepted` côté app
- `fr:212` → `paid`
- statuts de rejet → `rejected`

## Routage du destinataire (bloquant pour l'envoi)

Vérifié : un `POST /invoices` où l'`EndpointID` acheteur = SIREN brut est **rejeté** :
```
400 "pre-check: receiver address does not accept this document"
```

Le destinataire doit être identifié par sa **vraie adresse électronique de routage** (Peppol participant ID), pas son SIREN.

- En **production** : résoudre via `GET /v1.beta/french_directory/companies?number=<SIREN>` → renvoie l'adresse électronique du destinataire. S'il n'y est pas → il ne peut pas recevoir de facture électronique (à signaler à l'utilisateur).
- En **sandbox** : l'annuaire DGFiP (`french_directory`) est **vide** pour Burger Queen / Tricatel. Le routage interne suit le pattern `0225:315143296_<companyId>` (vu via `GET /v1.beta/directory_entries`). L'envoi sandbox Burger Queen → Tricatel nécessite donc l'adresse explicite `0225:315143296_8898`.

➡️ **Envoi prouvé end-to-end** (statuts `fr:200 → fr:201 → fr:202`) quand l'adresse acheteur correcte est fournie via `buildUbl(invoice, config, { buyerEndpoint, sellerEndpoint })`.

➡️ Conséquence : `sendInvoice` doit résoudre l'adresse du destinataire (annuaire) avant d'envoyer. Prévoir aussi un champ « adresse électronique destinataire » optionnel sur le client pour les cas de test / override sandbox.

## Impact sur le code

- ❌ `mappers/enInvoice.js` (JSON) : inutilisable pour l'ENVOI. À conserver éventuellement pour parser la lecture, mais l'envoi ne passe pas par là.
- ❌ `einvoiceApi/index.js > sendInvoice` : le `convertInvoice(enInvoice, ...)` JSON→XML n'existe pas côté API. À remplacer par un **générateur UBL** (`mappers/ubl.js`) puis POST brut.
- ✅ `adapters/superpdp.js > sendInvoice(payload, { contentType })` : OK tel quel, il POST déjà un corps brut. Il faut juste lui passer du UBL XML.
- ✅ `convertInvoice` de l'adapter : à corriger pour utiliser `?from=&to=` (query) au lieu d'un body JSON, utile pour générer le Factur-X d'archivage depuis l'UBL.
