<template>
  <div class="customer-form">
    <h2>Informations du client</h2>

    <CustomerFields
      :model-value="modelValue"
      enable-client-lookup
      @update:model-value="(value) => emit('update:modelValue', value)"
    />
  </div>
</template>

<script setup>
import CustomerFields from "./CustomerFields.vue";

defineProps({
  modelValue: {
    type: Object,
    required: true,
    default: () => ({
      customerName: "",
      companyName: "",
      companyId: "",
      electronicAddress: "",
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
</script>

<style scoped lang="scss">
@use "@/styles/variables" as *;
@use "@/styles/colors" as *;

.customer-form {
  h2 {
    font-size: $font-size-lg;
    font-weight: 600;
    margin-bottom: $spacing-md;
    color: $grey-100;
  }
}
</style>
