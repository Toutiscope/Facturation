<script setup>
import { useToast } from "@/composables/useToast";

const { toast, dismissToast } = useToast();
</script>

<template>
  <Transition name="toast">
    <div
      v-if="toast"
      class="toast"
      :class="`toast--${toast.type}`"
      @click="dismissToast"
    >
      <span class="toast__message">{{ toast.message }}</span>
      <button class="toast__close" aria-label="Fermer">&times;</button>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
@use "@/styles/colors" as *;
@use "@/styles/variables" as *;

.toast {
  position: fixed;
  bottom: $spacing-lg;
  right: $spacing-lg;
  z-index: 9999;
  padding: $spacing-md $spacing-lg;
  border-radius: $radius-md;
  display: flex;
  align-items: center;
  gap: $spacing-md;
  color: $white;
  font-size: $font-size-sm;
  cursor: pointer;
  box-shadow: $shadow-lg;
  max-width: 600px;
  overflow-wrap: break-word;
  word-break: normal;

  &--success {
    background-color: $success-color;
  }

  &--error {
    background-color: $error-color;
  }

  &__message {
    flex: 1;
    font-weight: 500;
  }

  &__close {
    background: none;
    border: none;
    color: $white;
    font-size: $font-size-xl;
    cursor: pointer;
    line-height: 1;
    opacity: 0.7;
    padding: 0;

    &:hover {
      opacity: 1;
    }
  }
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
