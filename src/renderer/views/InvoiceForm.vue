<template>
  <div class="invoice-form-view">
    <div class="container">
      <div
          class="header flex flex-space-between flex-vertical-center mg-bottom-16"
      >
        <h1>
          {{ isEditMode ? "Modifier la facture" : "Nouvelle facture" }}
          {{ invoice.numero }}
        </h1>
        <div class="header-badges flex flex-vertical-center gap-8">
          <p
              v-if="isEditMode && invoice.einvoice?.isSent"
              :class="['status-badge', `einvoice-${invoice.einvoice.status}`]"
          >
            PDP : {{ einvoiceStatusLabel(invoice.einvoice.status) }}
          </p>
          <p :class="['status-badge', `status-${invoice.status}`]">
            {{ statusLabel(invoice.status) }}
          </p>
        </div>
      </div>

      <div v-if="loading" class="loading">Chargement...</div>
      <div v-else-if="error" class="error">{{ error }}</div>

      <form v-else class="form flex flex-column gap-16" @submit.prevent>
        <div class="grid grid--6-4 gap-16">
          <!-- Formulaire client -->
          <section class="card">
            <CustomerForm v-model="invoice.customer"/>
          </section>

          <!-- Informations de la facture -->
          <section class="card">
            <h2>Informations de la facture</h2>

            <div class="form-row">
              <div class="form-group">
                <label class="required" for="numero">Numéro</label>
                <input
                    id="numero"
                    v-model="invoice.numero"
                    class="form-control"
                    pattern="F\d{6}"
                    placeholder="F000001"
                    required
                    type="text"
                />
                <small class="form-text">Format: F suivi de 6 chiffres</small>
              </div>

              <div class="form-group">
                <label class="required" for="date">Date</label>
                <input
                    id="date"
                    v-model="invoice.date"
                    class="form-control"
                    required
                    type="date"
                />
              </div>

              <div class="form-group">
                <label class="required" for="dueDate">Date d'échéance</label>
                <input
                    id="dueDate"
                    v-model="invoice.dueDate"
                    class="form-control"
                    required
                    type="date"
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
                <label
                    :class="{ required: invoice.status === 'paid' }"
                    for="paymentDate"
                >Payé le</label
                >
                <input
                    id="paymentDate"
                    v-model="invoice.paymentDate"
                    :disabled="invoice.status !== 'paid'"
                    class="form-control"
                    type="date"
                />
                <small class="form-text">
                  Date d'encaissement (utilisée pour les statistiques).
                </small>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="associatedQuote">Devis associé (optionnel)</label>
                <input
                    id="associatedQuote"
                    v-model="invoice.associatedQuote"
                    class="form-control"
                    placeholder="D000001"
                    type="text"
                />
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
                v-model="invoice.object"
                class="form-control"
                placeholder="Objet de la facture"
                rows="2"
            ></textarea>
          </div>
          <div class="form-group">
            <label for="invoicePrestationDelay">Délai</label>
            <input
                id="invoicePrestationDelay"
                v-model="invoice.prestationDelay"
                class="form-control"
                placeholder="Ex : 2 semaines, 30 jours..."
                type="text"
            />
          </div>
          <div class="form-group">
            <label for="invoiceDepositPaid">Acompte payé (€)</label>
            <input
                id="invoiceDepositPaid"
                v-model.number="invoice.depositPaid"
                class="form-control"
                min="0"
                placeholder="0.00"
                step="0.01"
                type="number"
            />
          </div>
          <ServiceLinesTable
              ref="serviceLinesRef"
              v-model="invoice.services"
              :deposit="parseFloat(invoice.depositPaid) || 0"
              deposit-label="Acompte payé"
          />
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
                class="form-control"
                placeholder="Notes internes"
                rows="4"
            ></textarea>
          </div>
        </section>

        <!-- Actions -->
        <div class="actions">
          <button
              class="btn btn-secondary mg-right-auto"
              type="button"
              @click="cancel"
          >
            Annuler
          </button>
          <button
              v-if="canSendToPdp"
              :disabled="saving || sendingToPdp"
              class="btn btn-primary"
              type="button"
              @click="openSendToPdp"
          >
            {{ sendingToPdp ? "Préparation…" : pdpButtonLabel }}
          </button>
          <p
              v-else-if="isEditMode && pdpReady && isAlreadySent"
              class="pdp-sent-note"
          >
            Facture déjà transmise à la plateforme. Le suivi se fait via la
            synchronisation des statuts.
          </p>
          <button
              :disabled="saving || generatingPDF"
              class="btn btn-outline"
              type="button"
              @click="saveAndGeneratePDF"
          >
            {{ generatingPDF ? "Génération du PDF..." : "Générer le PDF" }}
          </button>
          <button
              v-if="canExportFacturX"
              :disabled="saving || exportingFacturX"
              class="btn btn-outline"
              type="button"
              @click="exportFacturX"
          >
            {{ exportingFacturX ? "Export en cours…" : "Exporter en Factur-X" }}
          </button>
          <button
              :disabled="saving"
              class="btn btn-primary"
              type="button"
              @click="saveAsDraft"
          >
            Enregistrer
          </button>
        </div>
      </form>

      <ConfirmModal
          :visible="showUnsavedModal"
          confirm-label="Quitter sans sauvegarder"
          title="Modifications non sauvegardées"
          warning="Les modifications seront perdues si vous quittez cette page."
          @cancel="showUnsavedModal = false"
          @confirm="confirmLeave"
      />

      <SendToPdpModal
          :invoice-id="invoice.id"
          :is-sandbox="pdpIsSandbox"
          :provider-name="pdpProviderName"
          :visible="showSendToPdpModal"
          @close="showSendToPdpModal = false"
          @sent="onPdpSent"
      />

      <ConfirmModal
          :visible="showClearPaymentModal"
          :warning="`Cela retirera le paiement enregistré du ${formatDateToFrench(paymentDateBeforeChange)}.`"
          confirm-label="Continuer"
          title="Retirer le paiement enregistré ?"
          @cancel="cancelClearPayment"
          @confirm="confirmClearPayment"
      >
        Vous changez le statut de la facture alors qu'une date de paiement est
        enregistrée.
      </ConfirmModal>
    </div>
  </div>
</template>

<script setup>
import {computed, onMounted, ref, toRaw, watch} from "vue";
import {onBeforeRouteLeave, useRoute, useRouter} from "vue-router";
import {useToast} from "@/composables/useToast";
import {useUnsavedChanges} from "@/composables/useUnsavedChanges";
import CustomerForm from "@/components/forms/CustomerForm.vue";
import ServiceLinesTable from "@/components/forms/ServiceLinesTable.vue";
import ConfirmModal from "@/components/common/ConfirmModal.vue";
import SendToPdpModal from "@/components/pdp/SendToPdpModal.vue";
import {useDocuments} from "@/composables/useDocuments";
import {useNumbering} from "@/composables/useNumbering";
import {usePdpConfig} from "@/composables/usePdpConfig";
import {einvoiceStatusLabel, statusLabel} from "@/utils/statusLabels";

const router = useRouter();
const route = useRoute();
const {showToast} = useToast();

const {loadOne, save} = useDocuments("factures");
const {nextNumber, loadConfig, incrementNumber} = useNumbering("factures");

const serviceLinesRef = ref(null);
const invoice = ref({
  id: "",
  type: "facture",
  numero: "",
  date: new Date().toISOString().split("T")[0],
  dueDate: getDueDate(),
  status: "draft",
  paymentDate: "",
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
  depositRequested: 0,
  depositPaid: 0,
  services: [],
  totals: {
    totalHT: 0,
    VAT: 0,
    VATRate: 0,
    totalTTC: 0,
  },
  notes: "",
  associatedQuote: "",
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

// ── Paiement ─────────────────────────────────────────────────
// `formReady` empêche le watch de statut de se déclencher pendant le
// chargement initial de la facture (sinon une facture payée legacy se verrait
// attribuer la date du jour à l'ouverture).
const formReady = ref(false);
const showClearPaymentModal = ref(false);
const paymentDateBeforeChange = ref("");

// ── PDP ──────────────────────────────────────────────────────
const pdp = usePdpConfig();
const pdpProviderName = ref("");
const pdpIsSandbox = ref(false);
const showSendToPdpModal = ref(false);
const sendingToPdp = ref(false);
const exportingFacturX = ref(false);

const {isDirty, setInitialState, markAsSaved} = useUnsavedChanges(invoice);

const isEditMode = computed(() => !!route.params.id);

const pdpReady = computed(
    () => Boolean(pdpProviderName.value) && pdp.hasCredentials.value,
);

// Une facture déjà transmise (déposée chez SuperPDP) ne doit plus pouvoir être
// renvoyée : l'API ne déduplique pas (pas de 409, pas d'idempotence), un renvoi
// créerait un doublon chez le destinataire. Le suivi se fait via les événements.
const isAlreadySent = computed(() => Boolean(invoice.value.einvoice?.isSent));

const canSendToPdp = computed(
    () => isEditMode.value && pdpReady.value && !isAlreadySent.value,
);

const pdpButtonLabel = computed(() => "Envoyer à la plateforme");

// L'export Factur-X passe par la conversion de la PDP : il exige donc une
// plateforme configurée. Disponible quel que soit le statut d'envoi (utile
// pour l'archivage lisible d'une facture déjà transmise).
const canExportFacturX = computed(() => pdpReady.value);

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
    await loadPdpState();

    if (isEditMode.value) {
      // Mode édition : charger la facture existante
      loading.value = true;
      const existingInvoice = await loadOne(route.params.id);
      invoice.value = {
        ...existingInvoice,
        date: formatDateToISO(existingInvoice.date),
        dueDate: formatDateToISO(existingInvoice.dueDate),
        paymentDate: formatDateToISO(existingInvoice.paymentDate),
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
      setInitialState();
    }
  } catch (err) {
    error.value = err.message || "Erreur lors du chargement";
  } finally {
    loading.value = false;
    formReady.value = true;
  }
});

// Le `<select>` pilote, la date suit :
//  - arriver sur « Payé » sans date → pré-remplissage à aujourd'hui (éditable)
//  - quitter « Payé » avec une date enregistrée → confirmation avant vidage
watch(
    () => invoice.value.status,
    (newStatus, oldStatus) => {
      if (!formReady.value) return;

      if (newStatus === "paid") {
        if (!invoice.value.paymentDate) {
          invoice.value.paymentDate = new Date().toISOString().split("T")[0];
        }
        return;
      }

      if (oldStatus === "paid" && invoice.value.paymentDate) {
        paymentDateBeforeChange.value = invoice.value.paymentDate;
        showClearPaymentModal.value = true;
      }
    },
);

function confirmClearPayment() {
  invoice.value.paymentDate = "";
  showClearPaymentModal.value = false;
  paymentDateBeforeChange.value = "";
}

function cancelClearPayment() {
  // Annulation : on rétablit le statut « Payé » et la date est conservée.
  invoice.value.status = "paid";
  showClearPaymentModal.value = false;
  paymentDateBeforeChange.value = "";
}

function getDueDate(from) {
  const date = from ? new Date(from) : new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().split("T")[0];
}

watch(
    () => invoice.value.date,
    (newDate) => {
      if (newDate) {
        invoice.value.dueDate = getDueDate(newDate);
      }
    },
);

function convertQuoteToInvoice(quote) {
  // Copier toutes les données du devis
  invoice.value = {
    ...invoice.value,
    customer: {...quote.customer},
    services: [...quote.services],
    object: quote.object || "",
    prestationDelay: quote.prestationDelay || "",
    depositRequested: parseFloat(quote.depositRequested) || 0,
    depositPaid: parseFloat(quote.depositRequested) || 0,
    notes: quote.notes || "",
    associatedQuote: quote.numero,
    numero: nextNumber.value,
    date: new Date().toISOString().split("T")[0],
    dueDate: getDueDate(),
  };
}

async function saveAsDraft() {
  // Le statut choisi dans le `<select>` est respecté (on n'écrase plus par
  // « brouillon »), faute de quoi il serait impossible d'enregistrer une
  // facture payée.
  await saveInvoice();
  showToast(`Facture ${invoice.value.numero} enregistrée`);
  router.push("/factures");
}

async function saveAndGeneratePDF() {
  await saveInvoice();
  await handleGeneratePDF();
  router.push("/factures");
}

/**
 * Garde-fous sur la date de paiement (dates au format ISO yyyy-mm-dd, donc
 * comparables lexicographiquement).
 *  - antérieure à l'émission → bloquant
 *  - dans le futur → autorisée, avertissement
 *  - « Payé » sans date → autorisé, avertissement
 */
function validatePaymentBeforeSave() {
  if (invoice.value.status !== "paid") return { ok: true };

  const pay = invoice.value.paymentDate;

  if (!pay) {
    showToast(
        "Facture marquée « Payé » sans date de paiement renseignée.",
        "warning",
    );
    return { ok: true };
  }

  if (invoice.value.date && pay < invoice.value.date) {
    return {
      ok: false,
      message:
          "La date de paiement ne peut pas être antérieure à la date d'émission.",
    };
  }

  const today = new Date().toISOString().split("T")[0];
  if (pay > today) {
    showToast("La date de paiement est dans le futur.", "warning");
  }

  return { ok: true };
}

async function saveInvoice() {
  // Garde-fou bloquant : la date de paiement ne peut pas précéder l'émission.
  const paymentCheck = validatePaymentBeforeSave();
  if (!paymentCheck.ok) {
    error.value = paymentCheck.message;
    showToast(paymentCheck.message, "error");
    throw new Error(paymentCheck.message);
  }

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
    // La date de paiement n'a de sens que pour une facture payée.
    raw.paymentDate =
      invoice.value.status === "paid"
        ? formatDateToFrench(invoice.value.paymentDate)
        : null;

    // Sauvegarder
    await save(raw);

    // Incrémenter le compteur si nouvelle facture
    if (!isEditMode.value) {
      await incrementNumber(invoice.value.numero);
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
      invoice.value.totals = serviceLinesRef.value.totals;
    }

    // Convertir le proxy réactif en objet brut pour l'IPC
    const raw = JSON.parse(JSON.stringify(toRaw(invoice.value)));
    raw.date = formatDateToFrench(invoice.value.date);
    raw.dueDate = formatDateToFrench(invoice.value.dueDate);

    // Générer le PDF
    const filePath = await window.electronAPI.generatePDF("factures", raw);

    if (filePath) {
      showToast(`PDF enregistré : ${filePath}`);
    }
  } catch (err) {
    const raw = (err.message || "").replace(
        /^Error invoking remote method '[^']+': /,
        "",
    );
    const msg = raw.includes("EBUSY")
        ? `Erreur : vérifiez que la facture ${invoice.value.numero} n'est pas déjà ouverte sur une autre application.`
        : raw || "Erreur lors de la génération du PDF";
    error.value = msg;
    showToast(msg, "error");
  } finally {
    generatingPDF.value = false;
  }
}

async function exportFacturX() {
  exportingFacturX.value = true;

  try {
    // Récupérer les totaux depuis le composant ServiceLinesTable
    if (serviceLinesRef.value) {
      invoice.value.totals = serviceLinesRef.value.totals;
    }

    // Convertir le proxy réactif en objet brut pour l'IPC
    const raw = JSON.parse(JSON.stringify(toRaw(invoice.value)));
    raw.date = formatDateToFrench(invoice.value.date);
    raw.dueDate = formatDateToFrench(invoice.value.dueDate);

    const result = await window.electronAPI.pdp.exportInvoice(raw);

    if (!result.ok) {
      const msg = result.error?.message || "Échec de l'export Factur-X";
      error.value = msg;
      showToast(msg, "error");
      return;
    }
    if (result.data.canceled) return;

    const validation = result.data.validation;
    if (validation && validation.checked && validation.isValid === false) {
      const count = validation.messages?.length || 0;
      showToast(
        `Factur-X enregistré, mais des anomalies de conformité ont été détectées${
          count ? ` (${count})` : ""
        }. Vérifiez le document avant de l'utiliser.`,
        "warning",
      );
    } else {
      showToast(`Factur-X enregistré : ${result.data.path}`);
    }
  } catch (err) {
    const msg = err.message || "Erreur lors de l'export Factur-X";
    error.value = msg;
    showToast(msg, "error");
  } finally {
    exportingFacturX.value = false;
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
      const {
        clientType,
        customerName,
        companyName,
        companyId,
        electronicAddress,
        address,
        postalCode,
        city,
        email,
        phoneNumber,
      } = customer;
      await window.electronAPI.saveClient({
        clientType,
        customerName,
        companyName,
        companyId,
        electronicAddress,
        address,
        postalCode,
        city,
        email,
        phoneNumber,
      });
    }
  } catch (err) {
    console.error("Failed to auto-save client:", err);
  }
}

function cancel() {
  router.push("/factures");
}

async function loadPdpState() {
  try {
    const config = await window.electronAPI.loadConfig();
    pdpProviderName.value = config.einvoicePlatform?.providerName || "";
    pdpIsSandbox.value = Boolean(config.einvoicePlatform?.isSandbox);
    if (pdpProviderName.value) {
      await pdp.refreshHasCredentials(pdpProviderName.value);
    }
  } catch (err) {
    console.error("Failed to load PDP state:", err);
  }
}

async function openSendToPdp() {
  sendingToPdp.value = true;
  try {
    // S'assurer que la version sur disque est à jour avant l'envoi
    await saveInvoice();
    showSendToPdpModal.value = true;
  } catch {
    // saveInvoice gère déjà l'affichage de l'erreur
  } finally {
    sendingToPdp.value = false;
  }
}

function onPdpSent(updatedInvoice) {
  if (updatedInvoice?.einvoice) {
    invoice.value.einvoice = updatedInvoice.einvoice;
  }
  showToast(`Facture ${invoice.value.numero} transmise à la plateforme`);
}
</script>

<style lang="scss" scoped>
@use "@/styles/variables" as *;
@use "@/styles/colors" as *;

.pdp-sent-note {
  align-self: center;
  color: $grey-70;
  font-size: $font-size-sm;
  max-width: 280px;
}
</style>
