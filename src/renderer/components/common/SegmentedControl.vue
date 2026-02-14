<template>
  <fieldset class="segmented-control">
    <label class="control">
      <span>Professionnel</span>
      <input
        @change="handleClick('professionnel')"
        value="professionnel"
        :checked="newValue === 'professionnel'"
        name="segmentedControl"
        type="radio"
      />
    </label>
    <label class="control">
      <span>Particulier</span>
      <input
        @change="handleClick('particulier')"
        value="particulier"
        :checked="newValue === 'particulier'"
        name="segmentedControl"
        type="radio"
      />
    </label>
  </fieldset>
</template>

<script setup>
import { ref } from "vue";

const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(["update:modelValue"]);
const newValue = ref(props.modelValue);

const handleClick = (value) => {
  emit("update:modelValue", value);
};
</script>

<style lang="scss" scoped>
@use "sass:color";
@use "@/styles/colors" as *;
@use "@/styles/variables" as *;

.segmented-control {
  align-items: center;
  border-radius: $spacing-sm;
  border: none;
  background: $grey-10;
  display: flex;
  gap: $spacing-xs;
  padding: $spacing-xs;
}

.control {
  border-radius: $spacing-sm;
  background: white;
  cursor: pointer;
  margin: 0;
  padding: $spacing-sm $spacing-md;
  text-align: center;
  width: -webkit-fill-available;

  &:hover {
    background: $grey-20;
  }

  &:active,
  &:has(input:checked) {
    color: white;
    background: $primary-color;

    &:hover {
      background: color.scale($primary-color, $lightness: -10%);
    }
  }
}

input {
  height: 0;
  opacity: 0;
  width: 0;
}
</style>
