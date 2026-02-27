<template>
  <div class="customer-form">
    <h2>Informations du client</h2>

    <SegmentedControl
      v-model="localCustomer.clientType"
      @change="handleClientTypeChange"
      class="mg-bottom-16"
    />

    <div class="form-row">
      <div class="form-group autocomplete-wrapper">
        <label for="customerName">Nom du client</label>
        <input
          id="customerName"
          type="text"
          v-model="localCustomer.customerName"
          @input="onNameInput"
          @focus="onNameFocus"
          @blur="onNameBlur"
          @keydown.down.prevent="onArrowDown"
          @keydown.up.prevent="onArrowUp"
          @keydown.enter.prevent="onEnter"
          @keydown.escape="closeDropdown"
          placeholder="Nom et prénom"
          class="form-control"
          autocomplete="off"
        />
        <ul
          v-if="showDropdown && suggestions.length > 0"
          class="autocomplete-dropdown"
        >
          <li
            v-for="(client, index) in suggestions"
            :key="client.id"
            class="autocomplete-dropdown__item"
            :class="{ 'autocomplete-dropdown__item--highlighted': index === highlightedIndex }"
            @mousedown.prevent="selectClient(client)"
          >
            <span class="autocomplete-dropdown__name">{{ client.customerName }}</span>
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

      <div
        v-if="localCustomer.clientType === 'professionnel'"
        class="form-group"
      >
        <label for="companyName">Nom de l'entreprise</label>
        <input
          id="companyName"
          type="text"
          v-model="localCustomer.companyName"
          @input="emitUpdate"
          placeholder="Raison sociale"
          class="form-control"
        />
      </div>
    </div>

    <div class="form-group" v-if="localCustomer.clientType === 'professionnel'">
      <label for="companyId">SIRET</label>
      <input
        id="companyId"
        type="text"
        v-model="localCustomer.companyId"
        @input="emitUpdate"
        placeholder="123 456 789 00012"
        class="form-control"
        maxlength="17"
      />
      <small class="form-text">Format: 14 chiffres (espaces optionnels)</small>
    </div>

    <div class="form-group">
      <label for="address">Adresse</label>
      <input
        id="address"
        type="text"
        v-model="localCustomer.address"
        @input="emitUpdate"
        placeholder="123 Rue Example"
        class="form-control"
      />
    </div>

    <div class="form-row">
      <div class="form-group">
        <label for="postalCode">Code postal</label>
        <input
          id="postalCode"
          type="text"
          v-model="localCustomer.postalCode"
          @input="emitUpdate"
          placeholder="44000"
          class="form-control"
          pattern="\d{5}"
          maxlength="5"
        />
      </div>

      <div class="form-group">
        <label for="city">Ville</label>
        <input
          id="city"
          type="text"
          v-model="localCustomer.city"
          @input="emitUpdate"
          placeholder="Nantes"
          class="form-control"
        />
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label for="email">Email</label>
        <input
          id="email"
          type="email"
          v-model="localCustomer.email"
          @input="emitUpdate"
          placeholder="client@exemple.fr"
          class="form-control"
        />
      </div>

      <div class="form-group">
        <label for="phoneNumber">Téléphone</label>
        <input
          id="phoneNumber"
          type="tel"
          v-model="localCustomer.phoneNumber"
          @input="emitUpdate"
          placeholder="06 12 34 56 78"
          class="form-control"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import SegmentedControl from "@/components/common/SegmentedControl.vue";

const props = defineProps({
  modelValue: {
    type: Object,
    required: true,
    default: () => ({
      customerName: "",
      companyName: "",
      companyId: "",
      address: "",
      postalCode: "",
      city: "",
      email: "",
      phoneNumber: "",
      clientType: "professionnel",
    }),
  },
});

const emit = defineEmits(["update:modelValue"]);

const localCustomer = ref({ ...props.modelValue });

// Client autocomplete state
const clients = ref([]);
const showDropdown = ref(false);
const highlightedIndex = ref(-1);

onMounted(async () => {
  try {
    clients.value = await window.electronAPI.loadClients();
  } catch (err) {
    console.error("Failed to load clients for autocomplete:", err);
  }
});

function normalize(str) {
  return str?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";
}

const suggestions = computed(() => {
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
  highlightedIndex.value = -1;
  showDropdown.value = suggestions.value.length > 0;
  emitUpdate();
}

function onNameFocus() {
  if (suggestions.value.length > 0) {
    showDropdown.value = true;
  }
}

function onNameBlur() {
  // Small delay to allow click on dropdown item
  setTimeout(() => {
    showDropdown.value = false;
  }, 150);
}

function onArrowDown() {
  if (!showDropdown.value || suggestions.value.length === 0) return;
  highlightedIndex.value = (highlightedIndex.value + 1) % suggestions.value.length;
}

function onArrowUp() {
  if (!showDropdown.value || suggestions.value.length === 0) return;
  highlightedIndex.value =
    highlightedIndex.value <= 0
      ? suggestions.value.length - 1
      : highlightedIndex.value - 1;
}

function onEnter() {
  if (showDropdown.value && highlightedIndex.value >= 0 && highlightedIndex.value < suggestions.value.length) {
    selectClient(suggestions.value[highlightedIndex.value]);
  }
}

function selectClient(client) {
  localCustomer.value = {
    customerName: client.customerName || "",
    companyName: client.companyName || "",
    companyId: client.companyId || "",
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

// Synchroniser les changements du parent
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
  // Réinitialiser le SIRET si on passe à particulier
  if (localCustomer.value.clientType !== "professionnel") {
    localCustomer.value.companyId = "";
  }
  emitUpdate();
}
</script>

<style scoped lang="scss">
@use "@/styles/colors" as *;
@use "@/styles/variables" as *;

.customer-form {
  h3 {
    font-size: $font-size-lg;
    font-weight: 600;
    margin-bottom: $spacing-md;
    color: $grey-100;
  }

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
}
</style>
