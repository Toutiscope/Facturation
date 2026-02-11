<template>
  <MainLayout class="invoice-form-view">
    <div class="container">
      <div class="header">
        <h1>{{ isEditMode ? "Modifier la facture" : "Nouvelle facture" }}</h1>
      </div>

      <div v-if="loading" class="loading">Chargement...</div>
      <div v-else-if="error" class="error">{{ error }}</div>

      <form v-else @submit.prevent="handleSubmit" class="form">
        <!-- Informations de la facture -->
        <section class="card">
          <h2>Informations de la facture</h2>

          <div class="form-row">
            <div class="form-group">
              <label for="numero" class="required">Numéro</label>
              <input
                id="numero"
                type="text"
                v-model="invoice.numero"
                placeholder="F000001"
                class="form-control"
                pattern="F\d{6}"
                required
              />
              <small class="form-text">Format: F suivi de 6 chiffres</small>
            </div>

            <div class="form-group">
              <label for="date" class="required">Date</label>
              <input
                id="date"
                type="date"
                v-model="invoice.date"
                class="form-control"
                required
              />
            </div>

            <div class="form-group">
              <label for="dueDate" class="required">Date d'échéance</label>
              <input
                id="dueDate"
                type="date"
                v-model="invoice.dueDate"
                class="form-control"
                required
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="status">Statut</label>
              <select id="status" v-model="invoice.status" class="form-control">
                <option value="brouillon">Brouillon</option>
                <option value="envoyé">Envoyé</option>
                <option value="payé">Payé</option>
                <option value="en retard">En retard</option>
              </select>
            </div>

            <div class="form-group">
              <label for="associatedQuote">Devis associé (optionnel)</label>
              <input
                id="associatedQuote"
                type="text"
                v-model="invoice.associatedQuote"
                placeholder="D000001"
                class="form-control"
              />
            </div>
          </div>

          <!-- Affichage statut Chorus Pro si envoyé -->
          <div v-if="invoice.chorusPro?.isSent" class="chorus-status">
            <h3>Statut Chorus Pro</h3>
            <p>
              <strong>Envoyé le :</strong>
              {{ invoice.chorusPro.dateSending }}
            </p>
            <p v-if="invoice.chorusPro.depositNumber">
              <strong>Numéro de dépôt :</strong>
              {{ invoice.chorusPro.depositNumber }}
            </p>
            <p>
              <strong>Statut :</strong>
              <span
                :class="['status-badge', `status-${invoice.chorusPro.status}`]"
              >
                {{ invoice.chorusPro.status }}
              </span>
            </p>
            <div v-if="invoice.chorusPro.errors?.length > 0" class="errors">
              <strong>Erreurs :</strong>
              <ul>
                <li
                  v-for="(err, index) in invoice.chorusPro.errors"
                  :key="index"
                >
                  {{ err }}
                </li>
              </ul>
            </div>
          </div>
        </section>

        <!-- Formulaire client -->
        <section class="card">
          <CustomerForm v-model="invoice.customer" />
        </section>

        <!-- Tableau des prestations -->
        <section class="card">
          <ServiceLinesTable ref="serviceLinesRef" v-model="invoice.services" />
        </section>

        <!-- Notes internes -->
        <section class="card">
          <div class="form-group">
            <label for="invoiceNotes">Notes internes</label>
            <textarea
              id="invoiceNotes"
              v-model="invoice.notes"
              placeholder="Notes internes (optionnel)"
              class="form-control"
              rows="4"
            ></textarea>
          </div>
        </section>

        <!-- Erreurs de validation -->
        <div v-if="validationErrors.length > 0" class="errors-list">
          <h3>Erreurs de validation :</h3>
          <ul>
            <li v-for="(err, index) in validationErrors" :key="index">
              <strong>{{ err.path }}</strong> : {{ err.message }}
            </li>
          </ul>
        </div>

        <!-- Actions -->
        <div class="actions">
          <button type="button" @click="cancel" class="btn btn-secondary">
            Annuler
          </button>
          <button
            type="button"
            @click="saveAsDraft"
            class="btn btn-outline"
            :disabled="saving"
          >
            Enregistrer le brouillon
          </button>
          <button
            type="submit"
            @click="handleGeneratePDF"
            class="btn btn-primary"
            :disabled="saving || generatingPDF"
          >
            {{ generatingPDF ? "Génération PDF..." : "Générer le PDF" }}
          </button>
          <!-- <button
            type="submit"
            class="btn btn-primary"
            :disabled="saving"
          >
            {{ saving ? 'Sauvegarde...' : 'Valider et enregistrer' }}
          </button> -->
        </div>
      </form>
    </div>
  </MainLayout>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import MainLayout from "@/components/layout/MainLayout.vue";
import { useRouter, useRoute } from "vue-router";
import CustomerForm from "@/components/forms/CustomerForm.vue";
import ServiceLinesTable from "@/components/forms/ServiceLinesTable.vue";
import { useDocuments } from "@/composables/useDocuments";
import { useNumbering } from "@/composables/useNumbering";

const router = useRouter();
const route = useRoute();

const { loadOne, save, validate } = useDocuments("factures");
const { nextNumber, loadConfig, incrementNumber } = useNumbering("factures");

const serviceLinesRef = ref(null);
const invoice = ref({
  id: "",
  type: "facture",
  numero: "",
  date: new Date().toISOString().split("T")[0],
  dueDate: getDueDate(),
  status: "brouillon",
  customer: {
    customerName: "",
    companyName: "",
    companyId: "",
    address: "",
    postalCode: "",
    city: "",
    email: "",
    clientType: "professionnel",
  },
  services: [],
  totals: {
    totalHT: 0,
    VAT: 0,
    VATRate: 0,
    totalTTC: 0,
  },
  notes: "",
  associatedQuote: "",
  chorusPro: {
    isSent: false,
    dateSending: null,
    depositNumber: null,
    status: "brouillon",
    errors: [],
  },
  createdAt: "",
  editedAt: "",
});

const loading = ref(false);
const saving = ref(false);
const generatingPDF = ref(false);
const error = ref(null);
const validationErrors = ref([]);

const isEditMode = computed(() => !!route.params.id);

onMounted(async () => {
  try {
    await loadConfig();

    if (isEditMode.value) {
      // Mode édition : charger la facture existante
      loading.value = true;
      const existingInvoice = await loadOne(route.params.id);
      invoice.value = { ...existingInvoice };
    } else {
      // Mode création : vérifier si conversion depuis devis
      const quoteToConvert = sessionStorage.getItem("quoteToConvert");
      if (quoteToConvert) {
        const quote = JSON.parse(quoteToConvert);
        convertQuoteToInvoice(quote);
        sessionStorage.removeItem("quoteToConvert");
      } else {
        // Numéro auto
        invoice.value.numero = nextNumber.value;
      }
    }
  } catch (err) {
    error.value = err.message || "Erreur lors du chargement";
  } finally {
    loading.value = false;
  }
});

function getDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().split("T")[0];
}

function convertQuoteToInvoice(quote) {
  // Copier toutes les données du devis
  invoice.value = {
    ...invoice.value,
    customer: { ...quote.customer },
    services: [...quote.services],
    notes: quote.notes || "",
    associatedQuote: quote.numero,
    numero: nextNumber.value,
    date: new Date().toISOString().split("T")[0],
    dueDate: getDueDate(),
  };
}

async function handleSubmit() {
  await saveInvoice(false);
}

async function saveAsDraft() {
  invoice.value.status = "brouillon";
  await saveInvoice(true);
}

async function saveInvoice(isDraft = false) {
  saving.value = true;
  validationErrors.value = [];

  try {
    // Récupérer les totaux depuis le composant ServiceLinesTable
    if (serviceLinesRef.value) {
      invoice.value.totals = serviceLinesRef.value.totals;
    }

    // Valider seulement si ce n'est pas un brouillon
    if (!isDraft) {
      const validation = await validate(invoice.value);
      if (!validation.valid) {
        validationErrors.value = validation.errors;
        return;
      }
    }

    // Formater les dates au format français pour le JSON
    const invoiceToSave = {
      ...invoice.value,
      date: formatDateToFrench(invoice.value.date),
      dueDate: formatDateToFrench(invoice.value.dueDate),
    };

    // Sauvegarder
    await save(invoiceToSave);

    // Incrémenter le compteur si nouvelle facture
    if (!isEditMode.value) {
      await incrementNumber(invoice.value.numero);
    }

    // Rediriger vers la liste
    router.push("/factures");
  } catch (err) {
    error.value = err.message || "Erreur lors de la sauvegarde";
  } finally {
    saving.value = false;
  }
}

function formatDateToFrench(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

async function handleGeneratePDF() {
  generatingPDF.value = true;
  validationErrors.value = [];

  try {
    // Récupérer les totaux depuis le composant ServiceLinesTable
    if (serviceLinesRef.value) {
      invoice.value.totals = serviceLinesRef.value.totals;
    }

    // Valider le document avant génération
    const validation = await validate(invoice.value);
    if (!validation.valid) {
      validationErrors.value = validation.errors;
      alert(
        "Le document contient des erreurs. Veuillez les corriger avant de générer le PDF.",
      );
      return;
    }

    // Formater les dates pour le PDF
    const invoiceForPDF = {
      ...invoice.value,
      date: formatDateToFrench(invoice.value.date),
      dueDate: formatDateToFrench(invoice.value.dueDate),
    };

    // Générer le PDF
    const filePath = await window.electronAPI.generatePDF(
      "factures",
      invoiceForPDF,
    );

    if (filePath) {
      alert(`PDF généré avec succès !\nEmplacement : ${filePath}`);
    }
  } catch (err) {
    error.value = err.message || "Erreur lors de la génération du PDF";
    alert(`Erreur lors de la génération du PDF : ${err.message}`);
  } finally {
    generatingPDF.value = false;
  }
}

function cancel() {
  router.push("/factures");
}
</script>

<style scoped lang="scss">
@use "@/styles/colors" as *;
@use "@/styles/variables" as *;

.invoice-form-view {
  .header {
    margin-bottom: $spacing-lg;

    h1 {
      font-size: $font-size-3xl;
      font-weight: 700;
      color: $text-primary;
    }
  }

  .form {
    .card {
      h2,
      h3 {
        font-size: $font-size-lg;
        font-weight: 600;
        margin-bottom: $spacing-md;
        color: $text-primary;
      }

      .chorus-status {
        margin-top: $spacing-lg;
        padding: $spacing-md;
        background-color: $gray-50;
        border-radius: $border-radius-md;
        border: 1px solid $border-color;

        h3 {
          margin-bottom: $spacing-sm;
        }

        p {
          margin-bottom: $spacing-xs;
          font-size: $font-size-sm;
          color: $text-secondary;

          strong {
            color: $text-primary;
          }
        }

        .errors {
          margin-top: $spacing-sm;
          color: $error-color;

          ul {
            list-style: disc;
            margin-left: $spacing-md;
            margin-top: $spacing-xs;

            li {
              margin-bottom: $spacing-xs;
              font-size: $font-size-sm;
            }
          }
        }
      }
    }
  }
}
</style>
