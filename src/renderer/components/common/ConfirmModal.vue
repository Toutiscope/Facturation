<template>
  <div v-if="visible" class="modal-overlay" @click="$emit('cancel')">
    <div class="modal" @click.stop>
      <h3>{{ title }}</h3>
      <p>
        <slot />
      </p>
      <p class="warning">{{ warning }}</p>
      <div class="modal-actions">
        <button @click="$emit('cancel')" class="btn btn-secondary">
          Annuler
        </button>
        <button @click="$emit('confirm')" class="btn btn-danger">
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  visible: {
    type: Boolean,
    required: true,
  },
  title: {
    type: String,
    default: "Confirmer la suppression",
  },
  warning: {
    type: String,
    default: "Cette action est irréversible.",
  },
  confirmLabel: {
    type: String,
    default: "Supprimer",
  },
});

defineEmits(["cancel", "confirm"]);
</script>
