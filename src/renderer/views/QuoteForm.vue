<template>
  <div class="quote-form-view">
    <div class="container">
      <div
        class="header flex flex-space-between flex-vertical-center mg-bottom-16"
      >
        <h1>{{ isEditMode ? "Modifier le devis" : "Nouveau devis" }}</h1>
        <p :class="['status-badge', `status-${quote.status}`]">
          {{ statusLabel(quote.status) }}
        </p>
      </div>

      <div v-if="loading" class="loading">Chargement...</div>
      <div v-else-if="error" class="error">{{ error }}</div>

      <form v-else @submit.prevent class="form flex flex-column gap-16">
        <div class="form__info grid grid--6-4 gap-16">
          <!-- Formulaire client -->
          <section class="card">
            <CustomerForm v-model="quote.customer" />
          </section>

          <div>
            <!-- Informations du devis -->
            <section class="card">
              <h2>Informations du devis</h2>

              <div class="form-row">
                <div class="form-group">
                  <label for="numero">Numéro</label>
                  <input
                    id="numero"
                    type="text"
                    v-model="quote.numero"
                    placeholder="D000001"
                    class="form-control"
                  />
                  <small class="form-text"
                    >Format conseillé&nbsp;: D suivi de 6 chiffres</small
                  >
                </div>

                <div class="form-group">
                  <label for="date">Date</label>
                  <input
                    id="date"
                    type="date"
                    v-model="quote.date"
                    class="form-control"
                  />
                </div>

                <div class="form-group">
                  <label for="validityDate">Date de validité</label>
                  <input
                    id="validityDate"
                    type="date"
                    v-model="quote.validityDate"
                    class="form-control"
                  />
                </div>
              </div>
            </section>

            <!-- Notes internes -->
            <section class="card mg-top-16">
              <div class="form-group">
                <label for="quoteNotes"
                  >Notes internes (elles n'apparaitront pas sur le PDF)</label
                >
                <textarea
                  id="quoteNotes"
                  v-model="quote.notes"
                  placeholder="Notes internes"
                  class="form-control"
                  rows="4"
                ></textarea>
              </div>
            </section>
          </div>
        </div>

        <!-- Tableau des prestations -->
        <section class="card">
          <h2>Prestations</h2>

          <div class="form-group">
            <label for="quoteObjet">Objet</label>
            <textarea
              id="quoteObjet"
              v-model="quote.object"
              placeholder="Objet du devis"
              class="form-control"
              rows="2"
            ></textarea>
          </div>
          <ServiceLinesTable ref="serviceLinesRef" v-model="quote.services" />
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
                : "Enregister et générer le PDF"
            }}
          </button>
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

const { loadOne, save } = useDocuments("devis");
const { nextNumber, loadConfig, incrementNumber } = useNumbering("devis");

const serviceLinesRef = ref(null);
const quote = ref({
  id: "",
  type: "devis",
  numero: "",
  date: new Date().toISOString().split("T")[0],
  validityDate: getValidityDate(),
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
      // Mode édition : charger le devis existant
      loading.value = true;
      const existingQuote = await loadOne(route.params.id);
      quote.value = {
        ...existingQuote,
        date: formatDateToISO(existingQuote.date),
        validityDate: formatDateToISO(existingQuote.validityDate),
      };
    } else {
      // Mode création : numéro auto
      quote.value.numero = nextNumber.value;
    }
  } catch (err) {
    error.value = err.message || "Erreur lors du chargement";
  } finally {
    loading.value = false;
  }
});

function getValidityDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().split("T")[0];
}

async function saveAsDraft() {
  quote.value.status = "draft";
  await saveQuote();
  router.push("/devis");
}

async function saveAndGeneratePDF() {
  await saveQuote();
  await handleGeneratePDF();
  router.push("/devis");
}

async function saveQuote() {
  saving.value = true;

  try {
    // Récupérer les totaux depuis le composant ServiceLinesTable
    if (serviceLinesRef.value) {
      quote.value.totals = serviceLinesRef.value.totals;
    }

    // Convertir le proxy réactif en objet brut pour l'IPC
    const raw = JSON.parse(JSON.stringify(toRaw(quote.value)));
    raw.date = formatDateToFrench(quote.value.date);
    raw.validityDate = formatDateToFrench(quote.value.validityDate);

    // Sauvegarder
    await save(raw);

    // Incrémenter le compteur si nouveau devis
    if (!isEditMode.value) {
      await incrementNumber(quote.value.numero);
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
      quote.value.totals = serviceLinesRef.value.totals;
    }

    // Convertir le proxy réactif en objet brut pour l'IPC
    const raw = JSON.parse(JSON.stringify(toRaw(quote.value)));
    raw.date = formatDateToFrench(quote.value.date);
    raw.validityDate = formatDateToFrench(quote.value.validityDate);

    // Générer le PDF
    const filePath = await window.electronAPI.generatePDF("devis", raw);

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
  router.push("/devis");
}
</script>

<style scoped lang="scss"></style>
