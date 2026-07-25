<template>
  <div class="accordion" :class="{ 'accordion--open': open }">
    <button
      type="button"
      class="accordion__header"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="accordion__title">{{ title }}</span>
      <svg
        class="accordion__chevron"
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M6 9l6 6 6-6"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>

    <!-- v-show (et non v-if) : conserve l'état du formulaire et les champs
         montés même lorsqu'une section est repliée. -->
    <div v-show="open" class="accordion__body">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";

const props = defineProps({
  title: { type: String, required: true },
  defaultOpen: { type: Boolean, default: false },
});

const open = ref(props.defaultOpen);
</script>

<style lang="scss" scoped>
@use "@/styles/colors" as *;
@use "@/styles/variables" as *;

.accordion__header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-md;
  padding: $spacing-sm 0;
  background: none;
  border: none;
  border-bottom: 1px solid $grey-40;
  cursor: pointer;
  text-align: left;
  color: $grey-100;

  &:hover {
    color: $primary-color;
  }
}

.accordion__title {
  font-size: $font-size-2xl;
  font-weight: 600;
}

.accordion__chevron {
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.accordion--open .accordion__chevron {
  transform: rotate(180deg);
}

.accordion__body {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  padding-top: $spacing-md;
}
</style>
