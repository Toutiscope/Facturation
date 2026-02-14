<template>
  <div class="app-layout">
    <aside class="sidebar">
      <div class="sidebar__header">
        <svg
          class="sidebar__logo"
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            x="4"
            y="2"
            width="32"
            height="36"
            rx="3"
            stroke="currentColor"
            stroke-width="2.5"
          />
          <path
            d="M12 12h16M12 18h16M12 24h10"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
          <path
            d="M26 28l4 4 6-8"
            stroke="#10b981"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="sidebar__company-name">{{ companyName }}</span>
      </div>

      <nav class="sidebar__nav">
        <router-link to="/devis/nouveau" class="sidebar__item">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M14 2v6h6M12 18v-6M9 15h6"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span>Nouveau devis</span>
        </router-link>

        <router-link to="/factures/nouvelle" class="sidebar__item">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M14 2v6h6M9 13h6M9 17h4"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <circle cx="9" cy="13" r="0.5" fill="currentColor" />
          </svg>
          <span>Nouvelle facture</span>
        </router-link>
      </nav>

      <div class="sidebar__footer">
        <router-link to="/configuration" class="sidebar__item">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="12"
              cy="12"
              r="3"
              stroke="currentColor"
              stroke-width="1.8"
            />
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span>Mes paramètres</span>
        </router-link>
      </div>
    </aside>

    <main class="main-content">
      <slot />
    </main>
  </div>
</template>

<script setup>
import { inject, computed } from "vue";

const config = inject("config");

const companyName = computed(() => {
  return config?.value?.company?.companyName || "Mon entreprise";
});
</script>

<style lang="scss" scoped>
@use "@/styles/colors" as *;
@use "@/styles/variables" as *;

$sidebar-width: 330px;

.app-layout {
  display: flex;
  height: 100vh;
}

.sidebar {
  width: $sidebar-width;
  min-width: $sidebar-width;
  background: $grey-100;
  display: flex;
  flex-direction: column;
  color: $white;
}

.sidebar__header {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  padding: $spacing-xl $spacing-lg;
  border-bottom: 1px solid rgba($white, 0.1);
}

.sidebar__logo {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  color: $white;
}

.sidebar__company-name {
  font-size: $font-size-lg;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar__nav {
  flex: 1;
  padding: $spacing-md 0;
}

.sidebar__footer {
  border-top: 1px solid rgba($white, 0.1);
  padding: $spacing-md 0;
}

.sidebar__item {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  padding: $spacing-md $spacing-lg;
  color: rgba($white, 0.7);
  text-decoration: none;
  transition: all 0.15s ease;
  font-size: $font-size-base;
  font-weight: 500;

  svg {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
  }

  &:hover {
    color: $white;
    background: rgba($white, 0.08);
  }

  &.router-link-active {
    color: $white;
    background: rgba($white, 0.12);
    border-left: 3px solid $primary-light;
    padding-left: calc(#{$spacing-lg} - 3px);
  }
}

.main-content {
  flex: 1;
  overflow-y: auto;
  position: relative;
  background: $grey-10;
}
</style>
