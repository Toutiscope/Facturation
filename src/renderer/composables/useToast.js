import { ref } from "vue";

const toast = ref(null);
let timer = null;

export function useToast() {
  function showToast(message, type = "success", duration = 5000) {
    clearTimeout(timer);
    toast.value = { message, type };
    timer = setTimeout(() => {
      toast.value = null;
    }, duration);
  }

  function dismissToast() {
    clearTimeout(timer);
    toast.value = null;
  }

  return { toast, showToast, dismissToast };
}
