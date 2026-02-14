<template>
  <MainLayout class="quote-form-view">
    <div class="container">
      <div class="header">
        <h1>{{ isEditMode ? "Modifier le devis" : "Nouveau devis" }}</h1>
        <p>{{ quote.status }}</p>
      </div>

      <div v-if="loading" class="loading">Chargement...</div>
      <div v-else-if="error" class="error">{{ error }}</div>

      <form v-else @submit.prevent="handleSubmit" class="form">
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
                  <label for="numero" class="required">Numéro</label>
                  <input
                    id="numero"
                    type="text"
                    v-model="quote.numero"
                    placeholder="D000001"
                    class="form-control"
                    pattern="D\d{6}"
                    required
                  />
                  <small class="form-text"
                    >Format conseillé&nbsp;: D suivi de 6 chiffres</small
                  >
                </div>

                <div class="form-group">
                  <label for="date" class="required">Date</label>
                  <input
                    id="date"
                    type="date"
                    v-model="quote.date"
                    class="form-control"
                    required
                  />
                </div>

                <div class="form-group">
                  <label for="validityDate" class="required"
                    >Date de validité</label
                  >
                  <input
                    id="validityDate"
                    type="date"
                    v-model="quote.validityDate"
                    class="form-control"
                    required
                  />
                </div>
              </div>
            </section>

            <!-- Notes internes -->
            <section class="card">
              <div class="form-group">
                <label for="quoteNotes">Notes internes</label>
                <textarea
                  id="quoteNotes"
                  v-model="quote.notes"
                  placeholder="Notes internes (optionnel)"
                  class="form-control"
                  rows="4"
                ></textarea>
              </div>
            </section>
          </div>
        </div>

        <!-- Tableau des prestations -->
        <section class="card">
          <ServiceLinesTable ref="serviceLinesRef" v-model="quote.services" />
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

const { loadOne, save, validate } = useDocuments("devis");
const { nextNumber, loadConfig, incrementNumber } = useNumbering("devis");

const serviceLinesRef = ref(null);
const quote = ref({
  id: "",
  type: "devis",
  numero: "",
  date: new Date().toISOString().split("T")[0],
  validityDate: getValidityDate(),
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
      // Mode édition : charger le devis existant
      loading.value = true;
      const existingQuote = await loadOne(route.params.id);
      quote.value = { ...existingQuote };
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

async function handleSubmit() {
  await saveQuote(false);
  await handleGeneratePDF();
}

async function saveAsDraft() {
  quote.value.status = "brouillon";
  await saveQuote(true);
}

async function saveQuote(isDraft = false) {
  saving.value = true;
  validationErrors.value = [];

  try {
    // Récupérer les totaux depuis le composant ServiceLinesTable
    if (serviceLinesRef.value) {
      quote.value.totals = serviceLinesRef.value.totals;
    }

    // Valider seulement si ce n'est pas un brouillon
    if (!isDraft) {
      const validation = await validate(quote.value);
      if (!validation.valid) {
        validationErrors.value = validation.errors;
        return;
      }
    }

    // Formater les dates au format français pour le JSON
    const quoteToSave = {
      ...quote.value,
      date: formatDateToFrench(quote.value.date),
      validityDate: formatDateToFrench(quote.value.validityDate),
    };

    // Sauvegarder
    await save(quoteToSave);

    // Incrémenter le compteur si nouveau devis
    if (!isEditMode.value) {
      await incrementNumber(quote.value.numero);
    }

    // Rediriger vers la liste
    router.push("/devis");
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
      quote.value.totals = serviceLinesRef.value.totals;
    }

    // Valider le document avant génération
    const validation = await validate(quote.value);
    if (!validation.valid) {
      validationErrors.value = validation.errors;
      alert(
        "Le document contient des erreurs. Veuillez les corriger avant de générer le PDF.",
      );
      return;
    }

    // Formater les dates pour le PDF
    const quoteForPDF = {
      ...quote.value,
      date: formatDateToFrench(quote.value.date),
      validityDate: formatDateToFrench(quote.value.validityDate),
    };

    // Générer le PDF
    const filePath = await window.electronAPI.generatePDF("devis", quoteForPDF);

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

<style scoped lang="scss">
@use "@/styles/colors" as *;
@use "@/styles/variables" as *;

.quote-form-view {
  .header {
    margin-bottom: $spacing-lg;

    h1 {
      font-size: $font-size-3xl;
      font-weight: 700;
      color: $grey-100;
    }
  }

  .form .card {
    h2,
    h3 {
      font-size: $font-size-lg;
      font-weight: 600;
      margin-bottom: $spacing-md;
      color: $grey-100;
    }
  }
}
</style>
