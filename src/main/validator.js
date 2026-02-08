const { z } = require('zod')
const log = require('electron-log')

/**
 * Schéma de validation pour un client
 */
const customerSchema = z.object({
  customerName: z.string().min(1, 'Le nom du client est requis'),
  companyName: z.string().min(1, 'Le nom de l\'entreprise est requis'),
  companyId: z.string().optional(),
  address: z.string().min(1, 'L\'adresse est requise'),
  postalCode: z.string().regex(/^\d{5}$/, 'Le code postal doit contenir 5 chiffres'),
  city: z.string().min(1, 'La ville est requise'),
  email: z.string().email('Email invalide'),
  clientType: z.enum(['particulier', 'professionnel', 'administration'], {
    errorMap: () => ({ message: 'Type de client invalide' })
  })
})

/**
 * Schéma de validation pour une prestation/service
 */
const serviceSchema = z.object({
  id: z.number().int().positive(),
  description: z.string().min(1, 'La description est requise'),
  quantity: z.number().positive('La quantité doit être positive'),
  unit: z.enum(['heure', 'pièce', 'jour', 'forfait'], {
    errorMap: () => ({ message: 'Unité invalide' })
  }),
  unitPriceHT: z.number().nonnegative('Le prix unitaire doit être positif ou nul'),
  totalHT: z.number().nonnegative('Le total HT doit être positif ou nul')
})

/**
 * Schéma de validation pour les totaux
 */
const totalsSchema = z.object({
  totalHT: z.number().nonnegative(),
  VAT: z.number().nonnegative(),
  VATRate: z.number().nonnegative(),
  totalTTC: z.number().nonnegative()
})

/**
 * Schéma de validation pour un devis
 */
const quoteSchema = z.object({
  id: z.string().min(1),
  type: z.literal('devis'),
  numero: z.string().regex(/^D\d{6}$/, 'Le numéro de devis doit être au format D000001'),
  date: z.string().min(1, 'La date est requise'),
  validityDate: z.string().min(1, 'La date de validité est requise'),
  status: z.enum(['brouillon', 'envoyé', 'accepté', 'refusé'], {
    errorMap: () => ({ message: 'Statut invalide' })
  }),
  customer: customerSchema,
  services: z.array(serviceSchema).min(1, 'Au moins une prestation est requise'),
  totals: totalsSchema,
  notes: z.string().optional(),
  createdAt: z.string(),
  editedAt: z.string()
})

/**
 * Schéma de validation pour Chorus Pro
 */
const chorusProSchema = z.object({
  isSent: z.boolean(),
  dateSending: z.string().nullable().optional(),
  depositNumber: z.string().nullable().optional(),
  status: z.enum(['brouillon', 'envoyé', 'accepté', 'rejeté']).optional(),
  errors: z.array(z.string()).optional()
})

/**
 * Schéma de validation pour une facture
 */
const invoiceSchema = quoteSchema.extend({
  type: z.literal('facture'),
  numero: z.string().regex(/^F\d{6}$/, 'Le numéro de facture doit être au format F000001'),
  dueDate: z.string().min(1, 'La date d\'échéance est requise'),
  associatedQuote: z.string().optional(),
  chorusPro: chorusProSchema.optional()
})

/**
 * Valide un document (devis ou facture)
 * @param {string} type - 'devis' ou 'factures'
 * @param {Object} document - Document à valider
 * @returns {Object} { valid: boolean, errors: Array<{path: string, message: string}> }
 */
function validateDocument(type, document) {
  try {
    // Sélectionner le bon schéma
    const schema = type === 'devis' ? quoteSchema : invoiceSchema

    // Validation Zod
    const result = schema.safeParse(document)

    if (!result.success) {
      const errors = result.error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message
      }))
      log.warn(`Validation failed for ${type}:`, errors)
      return { valid: false, errors }
    }

    // Validations métier supplémentaires
    const businessErrors = []

    // Client professionnel doit avoir un SIRET
    if (document.customer.clientType === 'professionnel' && !document.customer.companyId) {
      businessErrors.push({
        path: 'customer.companyId',
        message: 'Le SIRET est obligatoire pour un client professionnel'
      })
    }

    // Vérifier cohérence des totaux avec la somme des services
    const calculatedTotalHT = document.services.reduce((sum, service) => {
      return sum + service.totalHT
    }, 0)

    // Tolérance de 0.01€ pour les arrondis
    if (Math.abs(calculatedTotalHT - document.totals.totalHT) > 0.01) {
      businessErrors.push({
        path: 'totals.totalHT',
        message: `Le total HT (${document.totals.totalHT}€) ne correspond pas à la somme des prestations (${calculatedTotalHT}€)`
      })
    }

    // Vérifier que chaque service a un totalHT cohérent
    document.services.forEach((service, index) => {
      const calculatedTotal = service.quantity * service.unitPriceHT
      if (Math.abs(calculatedTotal - service.totalHT) > 0.01) {
        businessErrors.push({
          path: `services.${index}.totalHT`,
          message: `Le total HT de la ligne ${index + 1} est incorrect (attendu: ${calculatedTotal.toFixed(2)}€)`
        })
      }
    })

    // Vérifier cohérence TTC = HT + TVA
    const calculatedTTC = document.totals.totalHT + document.totals.VAT
    if (Math.abs(calculatedTTC - document.totals.totalTTC) > 0.01) {
      businessErrors.push({
        path: 'totals.totalTTC',
        message: `Le total TTC (${document.totals.totalTTC}€) ne correspond pas à HT + TVA (${calculatedTTC}€)`
      })
    }

    if (businessErrors.length > 0) {
      log.warn(`Business validation failed for ${type}:`, businessErrors)
      return { valid: false, errors: businessErrors }
    }

    log.info(`${type} validation successful`)
    return { valid: true, errors: [] }
  } catch (error) {
    log.error(`Validation error for ${type}:`, error)
    return {
      valid: false,
      errors: [{ path: 'general', message: 'Erreur lors de la validation' }]
    }
  }
}

module.exports = {
  validateDocument,
  customerSchema,
  serviceSchema,
  quoteSchema,
  invoiceSchema
}
