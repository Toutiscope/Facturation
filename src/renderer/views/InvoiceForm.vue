<template>
  <div class="invoice-form-view">
    <div class="container">
      <div
        class="header flex flex-space-between flex-vertical-center mg-bottom-16"
      >
        <h1>{{ isEditMode ? "Modifier la facture" : "Nouvelle facture" }}</h1>
        <p :class="['status-badge', `status-${invoice.status}`]">
          {{ statusLabel(invoice.status) }}
        </p>
      </div>

      <div v-if="loading" class="loading">Chargement...</div>
      <div v-else-if="error" class="error">{{ error }}</div>

      <form v-else @submit.prevent class="form flex flex-column gap-16">
        <div class="grid grid--6-4 gap-16">
          <!-- Formulaire client -->
          <section class="card">
            <CustomerForm v-model="invoice.customer" />
          </section>

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
                <select
                  id="status"
                  v-model="invoice.status"
                  class="form-control"
                >
                  <option value="draft">Brouillon</option>
                  <option value="sent">Envoyé</option>
                  <option value="paid">Payé</option>
                  <option value="overdue">En retard</option>
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
                  :class="[
                    'status-badge',
                    `status-${invoice.chorusPro.status}`,
                  ]"
                >
                  {{ statusLabel(invoice.chorusPro.status) }}
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
        </div>

        <!-- Tableau des prestations -->
        <section class="card">
          <h2>Prestations</h2>

          <div class="form-group">
            <label for="invoiceObjet">Objet</label>
            <textarea
              id="invoiceObjet"
              v-model="invoice.objectt"
              placeholder="Objet de la facture"
              class="form-control"
              rows="2"
            ></textarea>
          </div>
          <ServiceLinesTable ref="serviceLinesRef" v-model="invoice.services" />
        </section>

        <!-- Notes internes -->
        <section class="card">
          <div class="form-group">
            <label for="invoiceNotes"
              >Notes internes (elles n'apparaitront pas sur le PDF)</label
            >
            <textarea
              id="invoiceNotes"
              v-model="invoice.notes"
              placeholder="Notes internes"
              class="form-control"
              rows="4"
            ></textarea>
          </div>
        </section>

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
            Sauvegarder
          </button>
          <button
            type="button"
            @click="saveAndGeneratePDF"
            class="btn btn-primary"
            :disabled="saving || generatingPDF"
          >
            {{
              generatingPDF
                ? "Génération du PDF..."
                : "Enregistrer et générer le PDF"
            }}
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
  </div>
</template>

<script setup>
import { ref, onMounted, computed, toRaw } from "vue";
import { useRouter, useRoute } from "vue-router";
import CustomerForm from "@/components/forms/CustomerForm.vue";
import ServiceLinesTable from "@/components/forms/ServiceLinesTable.vue";
import { useDocuments } from "@/composables/useDocuments";
import { useNumbering } from "@/composables/useNumbering";
import { statusLabel } from "@/utils/statusLabels";

const router = useRouter();
const route = useRoute();

const { loadOne, save } = useDocuments("factures");
const { nextNumber, loadConfig, incrementNumber } = useNumbering("factures");

const serviceLinesRef = ref(null);
const invoice = ref({
  id: "",
  type: "facture",
  numero: "",
  date: new Date().toISOString().split("T")[0],
  dueDate: getDueDate(),
  status: "draft",
  customer: {
    customerName: "",
    companyName: "",
    companyId: "",
    address: "",
    postalCode: "",
    city: "",
    email: "",
    phoneNumber: "",
    clientType: "professionnel",
  },
  object: "",
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
    status: "draft",
    errors: [],
  },
  createdAt: "",
  editedAt: "",
});

const loading = ref(false);
const saving = ref(false);
const generatingPDF = ref(false);
const error = ref(null);

const isEditMode = computed(() => !!route.params.id);

onMounted(async () => {
  try {
    await loadConfig();

    if (isEditMode.value) {
      // Mode édition : charger la facture existante
      loading.value = true;
      const existingInvoice = await loadOne(route.params.id);
      invoice.value = {
        ...existingInvoice,
        date: formatDateToISO(existingInvoice.date),
        dueDate: formatDateToISO(existingInvoice.dueDate),
      };
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
    object: quote.object || "",
    notes: quote.notes || "",
    associatedQuote: quote.numero,
    numero: nextNumber.value,
    date: new Date().toISOString().split("T")[0],
    dueDate: getDueDate(),
  };
}

async function saveAsDraft() {
  invoice.value.status = "draft";
  await saveInvoice();
  router.push("/factures");
}

async function saveAndGeneratePDF() {
  await saveInvoice();
  await handleGeneratePDF();
  router.push("/factures");
}

async function saveInvoice() {
  saving.value = true;

  try {
    // Récupérer les totaux depuis le composant ServiceLinesTable
    if (serviceLinesRef.value) {
      invoice.value.totals = serviceLinesRef.value.totals;
    }

    // Convertir le proxy réactif en objet brut pour l'IPC
    const raw = JSON.parse(JSON.stringify(toRaw(invoice.value)));
    raw.date = formatDateToFrench(invoice.value.date);
    raw.dueDate = formatDateToFrench(invoice.value.dueDate);

    // Sauvegarder
    await save(raw);

    // Incrémenter le compteur si nouvelle facture
    if (!isEditMode.value) {
      await incrementNumber(invoice.value.numero);
    }
  } catch (err) {
    error.value = err.message || "Erreur lors de la sauvegarde";
    throw err;
  } finally {
    saving.value = false;
  }
}

function formatDateToFrench(isoDate) {
  if (!isoDate) return "";
  if (isoDate.includes("/")) return isoDate;
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function formatDateToISO(frenchDate) {
  if (!frenchDate) return "";
  if (frenchDate.includes("-")) return frenchDate;
  const [day, month, year] = frenchDate.split("/");
  return `${year}-${month}-${day}`;
}

async function handleGeneratePDF() {
  generatingPDF.value = true;

  try {
    // Récupérer les totaux depuis le composant ServiceLinesTable
    if (serviceLinesRef.value) {
      invoice.value.totals = serviceLinesRef.value.totals;
    }

    // Convertir le proxy réactif en objet brut pour l'IPC
    const raw = JSON.parse(JSON.stringify(toRaw(invoice.value)));
    raw.date = formatDateToFrench(invoice.value.date);
    raw.dueDate = formatDateToFrench(invoice.value.dueDate);

    // Générer le PDF
    const filePath = await window.electronAPI.generatePDF("factures", raw);

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
@use "@/styles/variables" as *;
@use "@/styles/colors" as *;

.chorus-status {
  margin-top: $spacing-lg;
  padding: $spacing-md;
  background-color: $grey-50;
  border-radius: $border-radius-md;
  border: 1px solid $grey-30;

  h3 {
    margin-bottom: $spacing-sm;
  }

  p {
    margin-bottom: $spacing-xs;
    font-size: $font-size-sm;
    color: $grey-80;

    strong {
      color: $grey-100;
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
</style>
