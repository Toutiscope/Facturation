<script setup>
import { useRouter } from "vue-router";

const router = useRouter();
</script>

<template>
  <div class="dashboard">
    <header>
      <h1>Tableau de bord</h1>
    </header>

    <div class="welcome card">
      <h2>Bienvenue dans votre application de facturation !</h2>
      <p>Phase 2 terminée ! Gestion complète des devis et factures.</p>

      <div class="quick-actions">
        <h3>Actions rapides</h3>
        <div class="actions-grid">
          <button @click="router.push('/configuration')" class="btn-primary">
            ⚙️ Configurer l'application
          </button>
          <button @click="router.push('/devis/nouveau')" class="btn-primary">
            📄 Nouveau devis
          </button>
          <button
            @click="router.push('/factures/nouvelle')"
            class="btn-primary"
          >
            💰 Nouvelle facture
          </button>
        </div>
      </div>

      <div class="info-box">
        <h3>Prochaines étapes</h3>
        <ul>
          <li>✓ Phase 1: Structure de base et configuration</li>
          <li>✓ Phase 2: Gestion des devis et factures</li>
          <li>⏳ Phase 3: Export PDF</li>
          <li>⏳ Phase 4: Intégration Chorus Pro</li>
          <li>⏳ Phase 5: Finitions et déploiement</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/styles/colors" as *;
@use "@/styles/variables" as *;

.dashboard {
  padding: $spacing-xl;
}

.welcome {
  max-width: 800px;
  margin: 0 auto;

  h2 {
    color: $primary-color;
    margin-bottom: $spacing-md;
  }

  > p {
    color: $grey-80;
    margin-bottom: $spacing-2xl;
  }
}

.quick-actions {
  margin-bottom: $spacing-2xl;

  h3 {
    margin-bottom: $spacing-md;
  }
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: $spacing-md;

  button {
    padding: $spacing-lg;
    font-size: $font-size-lg;
  }
}

.info-box {
  background: $grey-20;
  padding: $spacing-lg;
  border-radius: $radius-md;
  border-left: 4px solid $primary-color;

  h3 {
    margin-bottom: $spacing-md;
    color: $primary-color;
  }

  ul {
    list-style: none;

    li {
      padding: $spacing-xs 0;
      color: $grey-100;

      &:first-child {
        color: $success-color;
        font-weight: 600;
      }
    }
  }
}
</style>
