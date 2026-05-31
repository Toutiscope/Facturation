<template>
  <div class="received-view">
    <div class="container">
      <div class="header">
        <h1>Factures reçues</h1>
        <button
          v-if="pdpEnabled"
          class="btn btn-outline"
          :disabled="loading"
          @click="reload"
        >
          {{ loading ? "Chargement…" : "Rafraîchir" }}
        </button>
      </div>

      <!-- PDP non configurée -->
      <div v-if="!pdpEnabled" class="empty-state card">
        <p>Aucune plateforme de facturation électronique n'est configurée.</p>
        <router-link to="/configuration" class="btn btn-primary">
          Configurer une plateforme
        </router-link>
      </div>

      <template v-else>
        <div v-if="loading && rows.length === 0" class="loading">
          Chargement des factures reçues…
        </div>

        <div v-else-if="error" class="error">{{ error }}</div>

        <div v-else-if="rows.length === 0" class="empty-state card">
          <p>Aucune facture reçue pour le moment.</p>
        </div>

        <div v-else class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th style="width: 120px">Date</th>
                <th style="min-width: 200px">Émetteur</th>
                <th style="width: 160px">Numéro</th>
                <th style="width: 120px">Montant TTC</th>
                <th style="min-width: 140px">Statut</th>
                <th style="width: 140px">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.id">
                <td>{{ formatDate(row.issueDate || row.createdAt) }}</td>
                <td class="emitter">{{ row.emitter || "—" }}</td>
                <td class="numero">{{ row.number || "—" }}</td>
                <td class="amount">
                  {{
                    row.amountTTC != null ? formatCurrency(row.amountTTC) : "—"
                  }}
                </td>
                <td>
                  <span v-if="row.statusLabel" class="status-badge status-sent">
                    {{ row.statusLabel }}
                  </span>
                  <span v-else class="pdp-dash">—</span>
                </td>
                <td>
                  <button
                    class="btn btn-outline btn-sm"
                    :disabled="downloadingId === row.id || row.error"
                    @click="download(row)"
                  >
                    {{ downloadingId === row.id ? "…" : "Télécharger PDF" }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-if="hasAfter" class="load-more">
            <button
              class="btn btn-secondary"
              :disabled="loading"
              @click="loadMore"
            >
              {{ loading ? "Chargement…" : "Charger plus" }}
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useToast } from "@/composables/useToast";

const { showToast } = useToast();

const pdpEnabled = ref(false);
const loading = ref(false);
const error = ref(null);
const rows = ref([]);
const hasAfter = ref(false);
const downloadingId = ref(null);

onMounted(async () => {
  try {
    const config = await window.electronAPI.loadConfig();
    pdpEnabled.value = Boolean(config.einvoicePlatform?.providerName);
  } catch {
    pdpEnabled.value = false;
  }
  if (pdpEnabled.value) await reload();
});

async function reload() {
  loading.value = true;
  error.value = null;
  rows.value = [];
  hasAfter.value = false;
  try {
    const result = await window.electronAPI.pdp.fetchReceived({ limit: 20 });
    if (!result.ok) {
      error.value =
        result.error?.message || "Impossible de charger les factures reçues";
      return;
    }
    rows.value = result.data.rows;
    hasAfter.value = result.data.hasAfter;
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (rows.value.length === 0) return;
  loading.value = true;
  try {
    const lastId = rows.value[rows.value.length - 1].id;
    const result = await window.electronAPI.pdp.fetchReceived({
      limit: 20,
      startingAfterId: lastId,
    });
    if (!result.ok) {
      showToast(result.error?.message || "Erreur de chargement", "error");
      return;
    }
    rows.value.push(...result.data.rows);
    hasAfter.value = result.data.hasAfter;
  } finally {
    loading.value = false;
  }
}

async function download(row) {
  downloadingId.value = row.id;
  try {
    const result = await window.electronAPI.pdp.downloadReceivedPdf(row.id);
    if (!result.ok) {
      showToast(result.error?.message || "Téléchargement impossible", "error");
      return;
    }
    if (result.data.canceled) return;
    showToast(`Enregistré : ${result.data.path}`);
  } finally {
    downloadingId.value = null;
  }
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR");
}

function formatCurrency(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value) || 0);
}
</script>

<style scoped lang="scss">
@use "@/styles/colors" as *;
@use "@/styles/variables" as *;
@use "@/styles/mixins" as *;

.received-view {
  padding: $spacing-lg;

  .header {
    @include page-header;
  }
}

.empty-state {
  padding: $spacing-xl;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-md;
  color: $grey-70;
}

.load-more {
  margin-top: $spacing-md;
  text-align: center;
}

.btn-sm {
  padding: 6px 12px;
  font-size: $font-size-sm;
}

.pdp-dash {
  color: $grey-40;
}

.emitter {
  font-weight: 500;
}
</style>
