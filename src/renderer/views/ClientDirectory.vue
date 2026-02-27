<template>
  <div class="client-directory">
    <div class="header">
      <h1>Répertoire client</h1>
    </div>

    <div class="directory-layout">
      <!-- Colonne gauche : liste des clients -->
      <div class="client-list-panel">
        <div class="client-list-panel__header">
          <input
            type="text"
            v-model="searchQuery"
            placeholder="Rechercher un client..."
            class="form-control search-input"
          />
          <button @click="createNewClient" class="btn btn-primary btn-sm">
            + Nouveau
          </button>
        </div>

        <div class="client-list-panel__list">
          <div
            v-for="client in filteredClients"
            :key="client.id"
            class="client-item"
            :class="{ 'client-item--active': selectedClient?.id === client.id }"
            @click="selectClient(client)"
          >
            <span class="client-item__name">{{ client.customerName }}</span>
            <span
              v-if="client.clientType === 'professionnel' && client.companyName"
              class="client-item__company"
            >
              {{ client.companyName }}
            </span>
            <span v-if="client.city" class="client-item__city">
              {{ client.city }}
            </span>
          </div>

          <div v-if="filteredClients.length === 0" class="client-list-panel__empty">
            <template v-if="searchQuery">Aucun résultat</template>
            <template v-else>Aucun client enregistré</template>
          </div>
        </div>
      </div>

      <!-- Colonne droite : formulaire -->
      <div class="client-form-panel">
        <template v-if="editingClient">
          <h2>{{ isNew ? "Nouveau client" : "Modifier le client" }}</h2>

          <SegmentedControl
            v-model="editingClient.clientType"
            @update:modelValue="handleClientTypeChange"
            class="mg-bottom-16"
          />

          <div class="form-row">
            <div class="form-group">
              <label for="cd-customerName">Nom du client</label>
              <input
                id="cd-customerName"
                type="text"
                v-model="editingClient.customerName"
                placeholder="Nom et prénom"
                class="form-control"
              />
            </div>

            <div
              v-if="editingClient.clientType === 'professionnel'"
              class="form-group"
            >
              <label for="cd-companyName">Nom de l'entreprise</label>
              <input
                id="cd-companyName"
                type="text"
                v-model="editingClient.companyName"
                placeholder="Raison sociale"
                class="form-control"
              />
            </div>
          </div>

          <div
            class="form-group"
            v-if="editingClient.clientType === 'professionnel'"
          >
            <label for="cd-companyId">SIRET</label>
            <input
              id="cd-companyId"
              type="text"
              v-model="editingClient.companyId"
              placeholder="123 456 789 00012"
              class="form-control"
              maxlength="17"
            />
            <small class="form-text"
              >Format: 14 chiffres (espaces optionnels)</small
            >
          </div>

          <div class="form-group">
            <label for="cd-address">Adresse</label>
            <input
              id="cd-address"
              type="text"
              v-model="editingClient.address"
              placeholder="123 Rue Example"
              class="form-control"
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="cd-postalCode">Code postal</label>
              <input
                id="cd-postalCode"
                type="text"
                v-model="editingClient.postalCode"
                placeholder="44000"
                class="form-control"
                pattern="\d{5}"
                maxlength="5"
              />
            </div>

            <div class="form-group">
              <label for="cd-city">Ville</label>
              <input
                id="cd-city"
                type="text"
                v-model="editingClient.city"
                placeholder="Nantes"
                class="form-control"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="cd-email">Email</label>
              <input
                id="cd-email"
                type="email"
                v-model="editingClient.email"
                placeholder="client@exemple.fr"
                class="form-control"
              />
            </div>

            <div class="form-group">
              <label for="cd-phoneNumber">Téléphone</label>
              <input
                id="cd-phoneNumber"
                type="tel"
                v-model="editingClient.phoneNumber"
                placeholder="06 12 34 56 78"
                class="form-control"
              />
            </div>
          </div>

          <div class="form-actions">
            <button
              v-if="!isNew"
              @click="confirmDelete"
              class="btn btn-danger btn-sm"
            >
              Supprimer
            </button>
            <div class="form-actions__right">
              <button @click="cancelEdit" class="btn btn-secondary">
                Annuler
              </button>
              <button @click="saveCurrentClient" class="btn btn-primary">
                Enregistrer
              </button>
            </div>
          </div>
        </template>

        <div v-else class="client-form-panel__empty">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <circle
              cx="9"
              cy="7"
              r="4"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <p>Sélectionnez un client ou créez-en un nouveau</p>
        </div>
      </div>
    </div>

    <ConfirmModal
      :visible="showUnsavedModal"
      title="Modifications non sauvegardées"
      warning="Les modifications seront perdues si vous quittez cette page."
      confirmLabel="Quitter sans sauvegarder"
      @cancel="showUnsavedModal = false"
      @confirm="confirmLeave"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, toRaw } from "vue";
import { useRouter, onBeforeRouteLeave } from "vue-router";
import { useUnsavedChanges } from "@/composables/useUnsavedChanges";
import SegmentedControl from "@/components/common/SegmentedControl.vue";
import ConfirmModal from "@/components/common/ConfirmModal.vue";

const router = useRouter();

const clients = ref([]);
const selectedClient = ref(null);
const editingClient = ref(null);
const isNew = ref(false);
const searchQuery = ref("");
const showUnsavedModal = ref(false);
const pendingRoute = ref(null);
let skipGuard = false;

const { isDirty, setInitialState, markAsSaved } = useUnsavedChanges(editingClient);

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

function emptyClient() {
  return {
    id: "",
    customerName: "",
    companyName: "",
    companyId: "",
    address: "",
    postalCode: "",
    city: "",
    email: "",
    phoneNumber: "",
    clientType: "professionnel",
  };
}

onMounted(async () => {
  await loadAllClients();
});

async function loadAllClients() {
  try {
    clients.value = await window.electronAPI.loadClients();
  } catch (err) {
    console.error("Failed to load clients:", err);
  }
}

const filteredClients = computed(() => {
  if (!searchQuery.value) return clients.value;
  const q = searchQuery.value.toLowerCase();
  return clients.value.filter(
    (c) =>
      c.customerName?.toLowerCase().includes(q) ||
      c.companyName?.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q),
  );
});

function selectClient(client) {
  selectedClient.value = client;
  editingClient.value = { ...client };
  isNew.value = false;
  setInitialState();
}

function createNewClient() {
  selectedClient.value = null;
  editingClient.value = emptyClient();
  isNew.value = true;
  setInitialState();
}

function cancelEdit() {
  if (isNew.value) {
    editingClient.value = null;
    isNew.value = false;
  } else if (selectedClient.value) {
    editingClient.value = { ...selectedClient.value };
  }
}

function handleClientTypeChange() {
  if (editingClient.value.clientType !== "professionnel") {
    editingClient.value.companyId = "";
  }
}

async function saveCurrentClient() {
  try {
    const raw = JSON.parse(JSON.stringify(toRaw(editingClient.value)));
    const saved = await window.electronAPI.saveClient(raw);
    await loadAllClients();

    // Select the saved client in the list
    const found = clients.value.find((c) => c.id === saved.id);
    if (found) {
      selectClient(found);
    }
    isNew.value = false;
    markAsSaved();
  } catch (err) {
    console.error("Failed to save client:", err);
  }
}

async function confirmDelete() {
  if (!selectedClient.value) return;
  const ok = confirm(
    `Supprimer le client "${selectedClient.value.customerName}" ?`,
  );
  if (!ok) return;

  try {
    await window.electronAPI.deleteClient(selectedClient.value.id);
    selectedClient.value = null;
    editingClient.value = null;
    await loadAllClients();
  } catch (err) {
    console.error("Failed to delete client:", err);
  }
}
</script>

<style scoped lang="scss">
@use "@/styles/colors" as *;
@use "@/styles/variables" as *;
@use "@/styles/mixins" as *;

.client-directory {
  padding: $spacing-lg;
  height: 100%;
  display: flex;
  flex-direction: column;

  .header {
    @include page-header;
  }
}

.directory-layout {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: $spacing-lg;
  flex: 1;
  min-height: 0;
}

// ---- Colonne gauche ----
.client-list-panel {
  @include card;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0;

  &__header {
    display: flex;
    gap: $spacing-sm;
    padding: $spacing-md;
    border-bottom: 1px solid $grey-20;

    .search-input {
      flex: 1;
    }
  }

  &__list {
    flex: 1;
    overflow-y: auto;
  }

  &__empty {
    padding: $spacing-xl;
    text-align: center;
    color: $grey-60;
    font-size: $font-size-sm;
  }
}

.client-item {
  display: flex;
  flex-direction: column;
  padding: $spacing-sm $spacing-md;
  cursor: pointer;
  border-bottom: 1px solid $grey-10;
  transition: background 0.1s ease;

  &:hover {
    background: $grey-10;
  }

  &--active {
    background: rgba($primary-color, 0.08);
    border-left: 3px solid $primary-color;
    padding-left: calc(#{$spacing-md} - 3px);
  }

  &__name {
    font-weight: 600;
    font-size: $font-size-base;
    color: $grey-100;
  }

  &__company {
    font-size: $font-size-sm;
    color: $grey-70;
  }

  &__city {
    font-size: $font-size-xs;
    color: $grey-50;
  }
}

// ---- Colonne droite ----
.client-form-panel {
  @include card;
  min-height: 0;
  overflow-y: auto;

  h2 {
    font-size: $font-size-2xl;
    font-weight: 700;
    color: $grey-100;
    margin-bottom: $spacing-lg;
  }

  .form-row {
    grid-template-columns: 1fr 1fr;
  }

  &__empty {
    @include flex-center;
    flex-direction: column;
    gap: $spacing-md;
    height: 100%;
    color: $grey-50;

    svg {
      width: 64px;
      height: 64px;
    }

    p {
      font-size: $font-size-lg;
    }
  }
}

.form-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: $spacing-lg;
  position: static;

  &__right {
    display: flex;
    gap: $spacing-md;
    margin-left: auto;
  }
}
</style>
