<template>
  <div class="customer-fields">
    <SegmentedControl
      v-model="localCustomer.clientType"
      class="mg-bottom-16"
      @change="handleClientTypeChange"
    />

    <div class="form-row">
      <!-- Nom du client : autocomplete sur les clients enregistrés (optionnel) -->
      <div
        class="form-group"
        :class="{ 'autocomplete-wrapper': enableClientLookup }"
      >
        <label :for="`${idPrefix}customerName`">Nom du client</label>
        <input
          :id="`${idPrefix}customerName`"
          v-model="localCustomer.customerName"
          type="text"
          placeholder="Nom et prénom"
          class="form-control"
          autocomplete="off"
          @input="onNameInput"
          @focus="onNameFocus"
          @blur="onNameBlur"
          @keydown.down.prevent="onArrowDown"
          @keydown.up.prevent="onArrowUp"
          @keydown.enter.prevent="onEnter"
          @keydown.escape="closeDropdown"
        />
        <ul
          v-if="enableClientLookup && showDropdown && suggestions.length > 0"
          class="autocomplete-dropdown"
        >
          <li
            v-for="(client, index) in suggestions"
            :key="client.id"
            class="autocomplete-dropdown__item"
            :class="{
              'autocomplete-dropdown__item--highlighted':
                index === highlightedIndex,
            }"
            @mousedown.prevent="selectClient(client)"
          >
            <span class="autocomplete-dropdown__name">{{
              client.customerName
            }}</span>
            <span
              v-if="client.clientType === 'professionnel' && client.companyName"
              class="autocomplete-dropdown__company"
            >
              {{ client.companyName }}
            </span>
            <span v-if="client.city" class="autocomplete-dropdown__city">
              {{ client.city }}
            </span>
          </li>
        </ul>
      </div>

      <!-- Nom de l'entreprise : recherche dans l'annuaire public (SIREN/SIRET) -->
      <div
        v-if="localCustomer.clientType === 'professionnel'"
        class="form-group autocomplete-wrapper"
      >
        <label :for="`${idPrefix}companyName`">Nom de l'entreprise</label>
        <input
          :id="`${idPrefix}companyName`"
          v-model="localCustomer.companyName"
          type="text"
          placeholder="Raison sociale"
          class="form-control"
          autocomplete="off"
          @input="onCompanyInput"
          @focus="onCompanyFocus"
          @blur="onCompanyBlur"
          @keydown.down.prevent="onCompanyArrowDown"
          @keydown.up.prevent="onCompanyArrowUp"
          @keydown.enter.prevent="onCompanyEnter"
          @keydown.escape="closeCompanyDropdown"
        />
        <ul
          v-if="
            showCompanyDropdown && (companyLoading || companyResults.length > 0)
          "
          class="autocomplete-dropdown"
        >
          <li v-if="companyLoading" class="autocomplete-dropdown__status">
            Recherche en cours…
          </li>
          <template v-else>
            <li
              v-for="(company, index) in companyResults"
              :key="company.siren"
              class="autocomplete-dropdown__item"
              :class="{
                'autocomplete-dropdown__item--highlighted':
                  index === companyHighlightedIndex,
              }"
              @mousedown.prevent="selectCompany(company)"
            >
              <span class="autocomplete-dropdown__name">
                {{ company.companyName }}
                <span
                  v-if="company.closed"
                  class="autocomplete-dropdown__badge"
                >
                  fermé
                </span>
              </span>
              <span
                v-if="company.companyId"
                class="autocomplete-dropdown__company"
              >
                SIRET {{ company.companyId }}
              </span>
              <span v-if="company.city" class="autocomplete-dropdown__city">
                {{
                  [company.postalCode, company.city].filter(Boolean).join(" ")
                }}
              </span>
            </li>
          </template>
        </ul>
        <small class="form-text">
          Tapez le nom pour rechercher dans l'annuaire des entreprises (SIRET et
          adresse remplis automatiquement).
        </small>
      </div>
    </div>

    <div v-if="localCustomer.clientType === 'professionnel'" class="form-group">
      <label :for="`${idPrefix}companyId`">SIRET</label>
      <input
        :id="`${idPrefix}companyId`"
        v-model="localCustomer.companyId"
        type="text"
        placeholder="123 456 789 00012"
        class="form-control"
        maxlength="17"
        @input="emitUpdate"
      />
      <small class="form-text">Format: 14 chiffres (espaces optionnels)</small>

      <div class="pdp-check">
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          :disabled="!hasValidSiren || recipientStatus === 'checking'"
          @click="checkRecipient"
        >
          {{
            recipientStatus === "checking"
              ? "Vérification…"
              : "Vérifier la réception e-invoicing"
          }}
        </button>

        <span
          v-if="recipientStatus === 'reachable'"
          class="pdp-badge pdp-badge--ok"
        >
          ✓ Joignable en facturation électronique
        </span>
        <span
          v-else-if="recipientStatus === 'inactive'"
          class="pdp-badge pdp-badge--warn"
        >
          Référencé mais inactif dans l'annuaire
        </span>
        <span
          v-else-if="recipientStatus === 'not_found'"
          class="pdp-badge pdp-badge--neutral"
        >
          Pas encore référencé — ne peut pas recevoir de facture électronique
        </span>
        <span
          v-else-if="recipientStatus === 'unavailable'"
          class="pdp-badge pdp-badge--neutral"
          :title="recipientMessage"
        >
          Vérification indisponible (PDP non configurée ?)
        </span>
      </div>

      <button
        v-if="
          recipientEndpoint &&
          !localCustomer.electronicAddress &&
          formattedEndpoint
        "
        type="button"
        class="pdp-prefill"
        @click="useResolvedEndpoint"
      >
        Utiliser l'adresse de routage trouvée : {{ formattedEndpoint }}
      </button>
    </div>

    <div v-if="localCustomer.clientType === 'professionnel'" class="form-group">
      <label :for="`${idPrefix}electronicAddress`">
        Adresse électronique PDP (optionnel)
      </label>
      <input
        :id="`${idPrefix}electronicAddress`"
        v-model="localCustomer.electronicAddress"
        type="text"
        placeholder="ex : 0225:315143296_8898"
        class="form-control"
        @input="emitUpdate"
      />
      <small class="form-text">
        Adresse de routage pour la facturation électronique. Laissez vide pour
        une résolution automatique via l'annuaire (au format scheme:valeur
        sinon).
      </small>
    </div>

    <div class="form-group">
      <label :for="`${idPrefix}address`">Adresse</label>
      <input
        :id="`${idPrefix}address`"
        v-model="localCustomer.address"
        type="text"
        placeholder="123 Rue Example"
        class="form-control"
        @input="emitUpdate"
      />
    </div>

    <div class="form-row">
      <div class="form-group">
        <label :for="`${idPrefix}postalCode`">Code postal</label>
        <input
          :id="`${idPrefix}postalCode`"
          v-model="localCustomer.postalCode"
          type="text"
          placeholder="44000"
          class="form-control"
          pattern="\d{5}"
          maxlength="5"
          @input="emitUpdate"
        />
      </div>

      <div class="form-group">
        <label :for="`${idPrefix}city`">Ville</label>
        <input
          :id="`${idPrefix}city`"
          v-model="localCustomer.city"
          type="text"
          placeholder="Nantes"
          class="form-control"
          @input="emitUpdate"
        />
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label :for="`${idPrefix}email`">Email</label>
        <input
          :id="`${idPrefix}email`"
          v-model="localCustomer.email"
          type="email"
          placeholder="client@exemple.fr"
          class="form-control"
          @input="emitUpdate"
        />
      </div>

      <div class="form-group">
        <label :for="`${idPrefix}phoneNumber`">Téléphone</label>
        <input
          :id="`${idPrefix}phoneNumber`"
          v-model="localCustomer.phoneNumber"
          type="tel"
          maxlength="10"
          placeholder="06 12 34 56 78"
          class="form-control"
          @input="emitUpdate"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import SegmentedControl from "@/components/common/SegmentedControl.vue";
import { useCompanySearch } from "@/composables/useCompanySearch";
import { usePdpRecipient } from "@/composables/usePdpRecipient";

const props = defineProps({
  modelValue: {
    type: Object,
    required: true,
  },
  // Active l'autocomplete sur les clients déjà enregistrés (utile à la création
  // de devis/factures, inutile dans l'éditeur du répertoire).
  enableClientLookup: {
    type: Boolean,
    default: false,
  },
  // Préfixe des `id`/`for` pour éviter les collisions si plusieurs instances
  // sont rendues dans le même document.
  idPrefix: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["update:modelValue"]);

const localCustomer = ref({ ...props.modelValue });

watch(
  () => props.modelValue,
  (newValue) => {
    localCustomer.value = { ...newValue };
  },
  { deep: true },
);

function emitUpdate() {
  emit("update:modelValue", { ...localCustomer.value });
}

function handleClientTypeChange() {
  if (localCustomer.value.clientType !== "professionnel") {
    localCustomer.value.companyId = "";
    closeCompanyDropdown();
  }
  emitUpdate();
}

// ==================== Autocomplete clients enregistrés ====================

const clients = ref([]);
const showDropdown = ref(false);
const highlightedIndex = ref(-1);

onMounted(async () => {
  if (!props.enableClientLookup) return;
  try {
    clients.value = await window.electronAPI.loadClients();
  } catch (err) {
    console.error("Failed to load clients for autocomplete:", err);
  }
});

function normalize(str) {
  return str?.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") || "";
}

const suggestions = computed(() => {
  if (!props.enableClientLookup) return [];
  const query = localCustomer.value.customerName?.trim();
  if (!query || query.length < 3) return [];

  const q = normalize(query);
  return clients.value.filter(
    (c) =>
      normalize(c.customerName).includes(q) ||
      normalize(c.companyName).includes(q) ||
      normalize(c.city).includes(q),
  );
});

function onNameInput() {
  if (props.enableClientLookup) {
    highlightedIndex.value = -1;
    showDropdown.value = suggestions.value.length > 0;
  }
  emitUpdate();
}

function onNameFocus() {
  if (props.enableClientLookup && suggestions.value.length > 0) {
    showDropdown.value = true;
  }
}

function onNameBlur() {
  setTimeout(() => {
    showDropdown.value = false;
  }, 150);
}

function onArrowDown() {
  if (!showDropdown.value || suggestions.value.length === 0) return;
  highlightedIndex.value =
    (highlightedIndex.value + 1) % suggestions.value.length;
}

function onArrowUp() {
  if (!showDropdown.value || suggestions.value.length === 0) return;
  highlightedIndex.value =
    highlightedIndex.value <= 0
      ? suggestions.value.length - 1
      : highlightedIndex.value - 1;
}

function onEnter() {
  if (
    showDropdown.value &&
    highlightedIndex.value >= 0 &&
    highlightedIndex.value < suggestions.value.length
  ) {
    selectClient(suggestions.value[highlightedIndex.value]);
  }
}

function selectClient(client) {
  localCustomer.value = {
    customerName: client.customerName || "",
    companyName: client.companyName || "",
    companyId: client.companyId || "",
    electronicAddress: client.electronicAddress || "",
    address: client.address || "",
    postalCode: client.postalCode || "",
    city: client.city || "",
    email: client.email || "",
    phoneNumber: client.phoneNumber || "",
    clientType: client.clientType || "professionnel",
  };
  closeDropdown();
  emitUpdate();
}

function closeDropdown() {
  showDropdown.value = false;
  highlightedIndex.value = -1;
}

// ==================== Recherche d'entreprise (annuaire public) ====================

const {
  results: companyResults,
  loading: companyLoading,
  search: searchCompany,
  clear: clearCompany,
} = useCompanySearch();

const showCompanyDropdown = ref(false);
const companyHighlightedIndex = ref(-1);

function onCompanyInput() {
  companyHighlightedIndex.value = -1;
  showCompanyDropdown.value = true;
  searchCompany(localCustomer.value.companyName);
  emitUpdate();
}

function onCompanyFocus() {
  if (companyResults.value.length > 0) {
    showCompanyDropdown.value = true;
  }
}

function onCompanyBlur() {
  setTimeout(() => {
    showCompanyDropdown.value = false;
  }, 150);
}

function onCompanyArrowDown() {
  if (!showCompanyDropdown.value || companyResults.value.length === 0) return;
  companyHighlightedIndex.value =
    (companyHighlightedIndex.value + 1) % companyResults.value.length;
}

function onCompanyArrowUp() {
  if (!showCompanyDropdown.value || companyResults.value.length === 0) return;
  companyHighlightedIndex.value =
    companyHighlightedIndex.value <= 0
      ? companyResults.value.length - 1
      : companyHighlightedIndex.value - 1;
}

function onCompanyEnter() {
  if (
    showCompanyDropdown.value &&
    companyHighlightedIndex.value >= 0 &&
    companyHighlightedIndex.value < companyResults.value.length
  ) {
    selectCompany(companyResults.value[companyHighlightedIndex.value]);
  }
}

function selectCompany(company) {
  // On ne remplit que les champs entreprise + adresse ; le nom du contact
  // (customerName) reste saisi par l'utilisateur.
  localCustomer.value.companyName = company.companyName || "";
  localCustomer.value.companyId =
    company.companyId || localCustomer.value.companyId;
  localCustomer.value.address = company.address || localCustomer.value.address;
  localCustomer.value.postalCode =
    company.postalCode || localCustomer.value.postalCode;
  localCustomer.value.city = company.city || localCustomer.value.city;
  closeCompanyDropdown();
  emitUpdate();
}

function closeCompanyDropdown() {
  showCompanyDropdown.value = false;
  companyHighlightedIndex.value = -1;
  clearCompany();
}

// ==================== Joignabilité e-invoicing (annuaire PDP) ====================

const {
  status: recipientStatus,
  endpoint: recipientEndpoint,
  message: recipientMessage,
  check: checkRecipientEndpoint,
  reset: resetRecipient,
} = usePdpRecipient();

const hasValidSiren = computed(
  () => (localCustomer.value.companyId || "").replace(/\D/g, "").length >= 9,
);

const formattedEndpoint = computed(() => {
  const ep = recipientEndpoint.value;
  if (!ep || !ep.value) return "";
  return ep.scheme ? `${ep.scheme}:${ep.value}` : ep.value;
});

function checkRecipient() {
  checkRecipientEndpoint(localCustomer.value.companyId);
}

function useResolvedEndpoint() {
  if (!formattedEndpoint.value) return;
  localCustomer.value.electronicAddress = formattedEndpoint.value;
  emitUpdate();
}

// Toute modification du SIRET invalide le résultat précédent (évite un badge périmé).
watch(
  () => localCustomer.value.companyId,
  () => resetRecipient(),
);
</script>

<style scoped lang="scss">
@use "@/styles/colors" as *;
@use "@/styles/variables" as *;

.customer-fields {
  .form-row {
    grid-template-columns: 1fr 1fr;

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  }
}

.autocomplete-wrapper {
  position: relative;
}

.autocomplete-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 100;
  background: $white;
  border: 1px solid $grey-20;
  border-radius: $border-radius-sm;
  box-shadow: $shadow-lg;
  max-height: 240px;
  overflow-y: auto;
  margin: 0;
  padding: 0;
  list-style: none;

  &__item {
    display: flex;
    flex-direction: column;
    padding: $spacing-sm $spacing-md;
    cursor: pointer;
    border-bottom: 1px solid $grey-10;
    transition: background 0.1s ease;

    &:last-child {
      border-bottom: none;
    }

    &:hover,
    &--highlighted {
      background: rgba($primary-color, 0.08);
    }
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

  &__status {
    padding: $spacing-sm $spacing-md;
    font-size: $font-size-sm;
    color: $grey-50;
    font-style: italic;
  }

  &__badge {
    display: inline-block;
    margin-left: $spacing-xs;
    padding: 0 $spacing-xs;
    font-size: $font-size-xs;
    font-weight: 600;
    color: $error-color;
    border: 1px solid $error-color;
    border-radius: $border-radius-sm;
    vertical-align: middle;
  }
}

.pdp-check {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: $spacing-sm;
  margin-top: $spacing-sm;
}

.pdp-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px $spacing-sm;
  font-size: $font-size-sm;
  font-weight: 600;
  border-radius: $border-radius-sm;

  &--ok {
    color: $success-color;
    background: rgba($success-color, 0.12);
  }

  &--warn {
    color: $warning-color;
    background: rgba($warning-color, 0.12);
  }

  &--neutral {
    color: $grey-60;
    background: $grey-10;
    font-weight: 500;
  }
}

.pdp-prefill {
  display: inline-block;
  margin-top: $spacing-xs;
  padding: 0;
  background: none;
  border: none;
  color: $primary-color;
  font-size: $font-size-sm;
  text-decoration: underline;
  cursor: pointer;
}
</style>
