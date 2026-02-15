<template>
  <div class="customer-form">
    <h2>Informations du client</h2>

    <SegmentedControl
      v-model="localCustomer.clientType"
      @change="handleClientTypeChange"
      class="mg-bottom-16"
    />

    <div class="form-row">
      <div class="form-group">
        <label
          for="customerName"
          :class="{ required: localCustomer.clientType !== 'professionnel' }"
          >Nom du client</label
        >
        <input
          id="customerName"
          type="text"
          v-model="localCustomer.customerName"
          @input="emitUpdate"
          placeholder="Nom et prénom"
          class="form-control"
          :required="localCustomer.clientType !== 'professionnel'"
        />
      </div>

      <div
        v-if="localCustomer.clientType === 'professionnel'"
        class="form-group"
      >
        <label for="companyName" :class="required">Nom de l'entreprise</label>
        <input
          id="companyName"
          type="text"
          v-model="localCustomer.companyName"
          @input="emitUpdate"
          placeholder="Raison sociale"
          class="form-control"
          :required="localCustomer.clientType === 'professionnel'"
        />
      </div>
    </div>

    <div class="form-group" v-if="localCustomer.clientType === 'professionnel'">
      <label for="companyId" class="required">SIRET</label>
      <input
        id="companyId"
        type="text"
        v-model="localCustomer.companyId"
        @input="emitUpdate"
        placeholder="123 456 789 00012"
        class="form-control"
        :required="localCustomer.clientType === 'professionnel'"
        maxlength="17"
      />
      <small class="form-text">Format: 14 chiffres (espaces optionnels)</small>
    </div>

    <div class="form-group">
      <label for="address" class="required">Adresse</label>
      <input
        id="address"
        type="text"
        v-model="localCustomer.address"
        @input="emitUpdate"
        placeholder="123 Rue Example"
        class="form-control"
        required
      />
    </div>

    <div class="form-row">
      <div class="form-group">
        <label for="postalCode" class="required">Code postal</label>
        <input
          id="postalCode"
          type="text"
          v-model="localCustomer.postalCode"
          @input="emitUpdate"
          placeholder="44000"
          class="form-control"
          pattern="\d{5}"
          maxlength="5"
          required
        />
      </div>

      <div class="form-group">
        <label for="city" class="required">Ville</label>
        <input
          id="city"
          type="text"
          v-model="localCustomer.city"
          @input="emitUpdate"
          placeholder="Nantes"
          class="form-control"
          required
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
import { ref, watch } from "vue";
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
</style>
