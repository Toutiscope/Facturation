<script setup>
import { RouterView } from 'vue-router'
import { provide, ref, onMounted } from 'vue'

const config = ref(null)
const loading = ref(true)
const error = ref(null)

onMounted(async () => {
  try {
    config.value = await window.electronAPI.loadConfig()
  } catch (err) {
    console.error('Failed to load config:', err)
    error.value = err.message
  } finally {
    loading.value = false
  }
})

// Fournir la config globalement via provide/inject
provide('config', config)
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
    <RouterView v-else />
  </div>
</template>

<style lang="scss">
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

#app {
  width: 100%;
  height: 100vh;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  font-size: 1.5rem;
  color: #475569;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #e2e8f0;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  padding: 2rem;
  text-align: center;
  color: #ef4444;
}
</style>
