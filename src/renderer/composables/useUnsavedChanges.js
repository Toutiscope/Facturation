import { ref, computed, toRaw } from "vue";

export function useUnsavedChanges(reactiveData) {
  const initialSnapshot = ref(null);

  function serialize(data) {
    return JSON.stringify(JSON.parse(JSON.stringify(toRaw(data))));
  }

  function setInitialState() {
    initialSnapshot.value = serialize(reactiveData.value);
  }

  const isDirty = computed(() => {
    if (initialSnapshot.value === null) return false;
    return serialize(reactiveData.value) !== initialSnapshot.value;
  });

  function markAsSaved() {
    initialSnapshot.value = serialize(reactiveData.value);
  }

  return { isDirty, setInitialState, markAsSaved };
}
