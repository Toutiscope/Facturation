<template>
  <div class="app-layout">
    <aside class="sidebar">
      <div class="sidebar__header">
        <img
          v-if="hasLogo"
          :src="logo"
          alt="Logo"
          class="sidebar__logo sidebar__logo--img"
        />
        <svg
          v-else
          class="sidebar__logo"
          fill="none"
          viewBox="0 0 40 40"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            height="36"
            rx="3"
            stroke="currentColor"
            stroke-width="2.5"
            width="32"
            x="4"
            y="2"
          />
          <path
            d="M12 12h16M12 18h16M12 24h10"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-width="2"
          />
          <path
            d="M26 28l4 4 6-8"
            stroke="#10b981"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2.5"
          />
        </svg>
        <span class="sidebar__company-name">{{ companyName }}</span>
      </div>

      <nav class="sidebar__nav">
        <div class="sidebar__section">
          <p class="sidebar__section__title">Créer</p>
          <router-link class="sidebar__item" to="/devis/nouveau">
            <svg
              fill="none"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
              <path
                d="M14 2v6h6M12 18v-6M9 15h6"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
            </svg>
            <span>Nouveau devis</span>
          </router-link>

          <router-link class="sidebar__item" to="/factures/nouvelle">
            <svg
              fill="none"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
              <path
                d="M14 2v6h6M9 13h6M9 17h4"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
              <circle cx="9" cy="13" fill="currentColor" r="0.5" />
            </svg>
            <span>Nouvelle facture</span>
          </router-link>
        </div>

        <div class="sidebar__section">
          <p class="sidebar__section__title">Suivi</p>
          <router-link class="sidebar__item" exact to="/">
            <svg
              fill="none"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                height="7"
                rx="1"
                stroke="currentColor"
                stroke-width="1.8"
                width="7"
                x="3"
                y="3"
              />
              <rect
                height="7"
                rx="1"
                stroke="currentColor"
                stroke-width="1.8"
                width="7"
                x="14"
                y="3"
              />
              <rect
                height="7"
                rx="1"
                stroke="currentColor"
                stroke-width="1.8"
                width="7"
                x="3"
                y="14"
              />
              <rect
                height="7"
                rx="1"
                stroke="currentColor"
                stroke-width="1.8"
                width="7"
                x="14"
                y="14"
              />
            </svg>
            <span>Tableau de bord</span>
          </router-link>

          <router-link class="sidebar__item" to="/finances">
            <svg
              fill="none"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 3v18h18"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
              <path
                d="M7 15l4-4 3 3 5-6"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
              <path
                d="M14 8h5v5"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
            </svg>
            <span>Finances</span>
          </router-link>

          <router-link class="sidebar__item" to="/devis">
            <svg
              fill="none"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
              <path
                d="M14 2v6h6M9 13h6M9 17h4"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
              <circle cx="9" cy="13" fill="currentColor" r="0.5" />
            </svg>
            <span>Mes devis</span>
          </router-link>

          <router-link class="sidebar__item" to="/factures">
            <svg
              fill="none"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
              <path
                d="M14 2v6h6M9 13h6M9 17h4"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
              <circle cx="9" cy="13" fill="currentColor" r="0.5" />
            </svg>
            <span>Mes factures</span>
          </router-link>

          <router-link class="sidebar__item" to="/factures-recues">
            <svg
              fill="none"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
              <path
                d="M7 10l5 5 5-5M12 15V3"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
            </svg>
            <span>E-factures reçues</span>
          </router-link>
        </div>
      </nav>

      <div class="sidebar__section">
        <p class="sidebar__section__title">Gestion</p>
        <router-link class="sidebar__item" to="/clients">
          <svg
            fill="none"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.8"
            />
            <circle
              cx="9"
              cy="7"
              r="4"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.8"
            />
            <path
              d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.8"
            />
          </svg>
          <span>Répertoire client</span>
        </router-link>

        <router-link class="sidebar__item" to="/configuration">
          <svg
            fill="none"
            viewBox="0 0 24 24"
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
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.8"
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
import { computed, inject } from "vue";

const config = inject("config");
const logo = inject("logo");

const companyName = computed(() => {
  return config?.value?.company?.companyName || "Mon entreprise";
});

const hasLogo = computed(() => !!logo?.value);
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
  background: $grey-100;
  color: $white;
  display: flex;
  flex-direction: column;
  min-width: $sidebar-width;
  width: $sidebar-width;

  &__header {
    align-items: center;
    display: flex;
    gap: $spacing-md;
    padding: $spacing-xl $spacing-lg;
  }

  &__logo {
    color: $white;
    flex-shrink: 0;
    height: 40px;
    width: 40px;

    &--img {
      border-radius: $border-radius-sm;
      object-fit: contain;
    }
  }

  &__company-name {
    font-size: $font-size-lg;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__section {
    border-top: 1px solid rgba($white, 0.1);
    padding-bottom: $spacing-md;

    &__title {
      color: $grey_50;
      font-size: $font-size-xs;
      font-weight: 600;
      padding: $spacing-md $spacing-xs $spacing-xs $spacing-lg;
      text-transform: uppercase;
    }
  }

  &__item {
    align-items: center;
    border-radius: $border-radius-sm;
    color: $grey_30;
    display: flex;
    font-size: $font-size-base;
    font-weight: 500;
    gap: $spacing-sm;
    margin: $spacing-xs $spacing-sm;
    padding: $spacing-sm $spacing-md;
    text-decoration: none;
    transition: all 0.15s ease;

    svg {
      color: $grey_80;
      flex-shrink: 0;
      height: 20px;
      width: 20px;
    }

    &:hover {
      background: rgba($white, 0.08);
      color: $white;
    }

    &.router-link-active {
      background: rgba($white, 0.12);
      color: $white;

      svg {
        color: $grey-100;
      }
    }
  }
}

.main-content {
  flex: 1;
  overflow-y: auto;
  position: relative;
}
</style>
