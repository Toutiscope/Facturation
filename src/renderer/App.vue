<script setup>
import { RouterView } from "vue-router";
import { provide, ref, onMounted } from "vue";
import MainLayout from "./components/layout/MainLayout.vue";
import UpdateNotification from "./components/UpdateNotification.vue";

const config = ref(null);
const logo = ref(null);
const loading = ref(true);
const error = ref(null);

onMounted(async () => {
  try {
    config.value = await window.electronAPI.loadConfig();
    logo.value = await window.electronAPI.getLogo();
  } catch (err) {
    console.error("Failed to load config:", err);
    error.value = err.message;
  } finally {
    loading.value = false;
  }
});

// Fournir la config et le logo globalement via provide/inject
provide("config", config);
provide("logo", logo);
</script>

<template>
  <div id="app">
    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <p>Chargement de la configuration...</p>
    </div>
    <div v-else-if="error" class="error">
      <h2>Erreur au démarrage</h2>
      <p>{{ error }}</p>
      <p>Veuillez vérifier que l'application a bien été installée.</p>
    </div>
    <template v-else>
      <UpdateNotification />
      <MainLayout>
        <RouterView />
      </MainLayout>
    </template>
  </div>
</template>

<style lang="scss">
@use "@/styles/colors" as *;
@use "@/styles/variables" as *;
@use "@/styles/mixins" as *;

#app {
  width: 100%;
  height: 100vh;

  > .loading {
    @include flex-center;
    flex-direction: column;
    height: 100vh;
    font-size: $font-size-2xl;
    color: $grey-80;
  }

  > .loading .loading-spinner {
    @include spinner;
  }

  > .error {
    @include flex-center;
    flex-direction: column;
    height: 100vh;
    padding: $spacing-xl;
    color: $error-color;
  }
}
</style>
