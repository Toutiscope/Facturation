<template>
  <div class="quote-form-view">
    <div class="container">
      <div
        class="header flex flex-space-between flex-vertical-center mg-bottom-16"
      >
        <h1>{{ isEditMode ? "Modifier le devis" : "Nouveau devis" }} {{ quote.numero }}</h1>
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
          <div class="form-group">
            <label for="quotePrestationDelay">Délai</label>
            <input
              id="quotePrestationDelay"
              type="text"
              v-model="quote.prestationDelay"
              placeholder="Ex : 2 semaines, 30 jours..."
              class="form-control"
            />
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

      <ConfirmModal
        :visible="showUnsavedModal"
        title="Modifications non sauvegardées"
        warning="Les modifications seront perdues si vous quittez cette page."
        confirmLabel="Quitter sans sauvegarder"
        @cancel="showUnsavedModal = false"
        @confirm="confirmLeave"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, toRaw, watch } from "vue";
import { useRouter, useRoute, onBeforeRouteLeave } from "vue-router";
import { useToast } from "@/composables/useToast";
import { useUnsavedChanges } from "@/composables/useUnsavedChanges";
import CustomerForm from "@/components/forms/CustomerForm.vue";
import ServiceLinesTable from "@/components/forms/ServiceLinesTable.vue";
import ConfirmModal from "@/components/common/ConfirmModal.vue";
import { useDocuments } from "@/composables/useDocuments";
import { useNumbering } from "@/composables/useNumbering";
import { statusLabel } from "@/utils/statusLabels";

const router = useRouter();
const route = useRoute();
const { showToast } = useToast();

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
  prestationDelay: "",
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
const showUnsavedModal = ref(false);
const pendingRoute = ref(null);
let skipGuard = false;

const { isDirty, setInitialState, markAsSaved } = useUnsavedChanges(quote);

const isEditMode = computed(() => !!route.params.id);

onBeforeRouteLeave((to) => {
  if (skipGuard) {
    skipGuard = false;
    return true;
  }
  if (isDirty.value) {
    pendingRoute.value = to.fullPath;
    showUnsavedModal.value = true;
    return false;
  }
});

function confirmLeave() {
  showUnsavedModal.value = false;
  skipGuard = true;
  router.push(pendingRoute.value);
}

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
    setInitialState();
  } catch (err) {
    error.value = err.message || "Erreur lors du chargement";
  } finally {
    loading.value = false;
  }
});

function getValidityDate(from) {
  const date = from ? new Date(from) : new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().split("T")[0];
}

watch(
  () => quote.value.date,
  (newDate) => {
    if (newDate) {
      quote.value.validityDate = getValidityDate(newDate);
    }
  }
);

async function saveAsDraft() {
  quote.value.status = "draft";
  await saveQuote();
  showToast(`Devis ${quote.value.numero} enregistré`);
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

    // Enregistrer le client dans le répertoire s'il est nouveau
    await saveClientIfNew(raw.customer);

    markAsSaved();
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
      showToast(`PDF enregistré : ${filePath}`);
    }
  } catch (err) {
    error.value = err.message || "Erreur lors de la génération du PDF";
    showToast(`Erreur lors de la génération du PDF : ${err.message}`, "error");
  } finally {
    generatingPDF.value = false;
  }
}

async function saveClientIfNew(customer) {
  if (!customer?.customerName?.trim()) return;

  try {
    const clients = await window.electronAPI.loadClients();
    const exists = clients.some(
      (c) =>
        c.customerName?.toLowerCase() === customer.customerName.toLowerCase() &&
        c.clientType === customer.clientType,
    );
    if (!exists) {
      const { clientType, customerName, companyName, companyId, address, postalCode, city, email, phoneNumber } = customer;
      await window.electronAPI.saveClient({
        clientType, customerName, companyName, companyId, address, postalCode, city, email, phoneNumber,
      });
    }
  } catch (err) {
    console.error("Failed to auto-save client:", err);
  }
}

function cancel() {
  router.push("/devis");
}
</script>

<style scoped lang="scss"></style>
