<script setup>
import { ref, onMounted } from "vue";

const status = ref(null); // 'checking' | 'downloading' | 'ready'
const version = ref("");
const dismissed = ref(false);

function onCheckingForUpdate() {
  status.value = "checking";
  dismissed.value = false;
}

function onUpdateAvailable(info) {
  status.value = "downloading";
  version.value = info.version;
  dismissed.value = false;
}

function onUpdateNotAvailable() {
  status.value = "up-to-date";
  dismissed.value = false;
  setTimeout(() => {
    dismissed.value = true;
  }, 3000);
}

function onUpdateDownloaded(info) {
  status.value = "ready";
  version.value = info.version;
  dismissed.value = false;
}

function onUpdateError() {
  dismissed.value = true;
}

function installNow() {
  window.electronAPI.installUpdate();
}

function dismiss() {
  dismissed.value = true;
}

onMounted(() => {
  window.electronAPI.onCheckingForUpdate(onCheckingForUpdate);
  window.electronAPI.onUpdateAvailable(onUpdateAvailable);
  window.electronAPI.onUpdateNotAvailable(onUpdateNotAvailable);
  window.electronAPI.onUpdateDownloaded(onUpdateDownloaded);
  window.electronAPI.onUpdateError(onUpdateError);
});
</script>

<template>
  <Transition name="slide">
    <div v-if="status && !dismissed" class="update-banner" :class="status">
      <div class="update-banner__content">
        <span v-if="status === 'checking'" class="update-banner__message">
          <span class="update-banner__spinner"></span>
          Recherche de mises à jour...
        </span>
        <span v-else-if="status === 'up-to-date'" class="update-banner__message">
          L'application est à jour.
        </span>
        <span v-else-if="status === 'downloading'" class="update-banner__message">
          <span class="update-banner__spinner"></span>
          Mise à jour v{{ version }} en cours de téléchargement...
        </span>
        <template v-else>
          <span class="update-banner__message">
            La mise à jour v{{ version }} est prête à être installée.
          </span>
          <div class="update-banner__actions">
            <button
              class="update-banner__btn update-banner__btn--install"
              @click="installNow"
            >
              Installer maintenant
            </button>
            <button
              class="update-banner__btn update-banner__btn--later"
              @click="dismiss"
            >
              Plus tard
            </button>
          </div>
        </template>
      </div>
      <button class="update-banner__close" @click="dismiss" aria-label="Fermer">
        &times;
      </button>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
@use "@/styles/colors" as *;
@use "@/styles/variables" as *;

.update-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  padding: $spacing-sm $spacing-lg;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: $font-size-sm;
  color: $white;

  &.checking,
  &.downloading {
    background-color: $info-color;
  }

  &.up-to-date {
    background-color: $success-color;
  }

  &.ready {
    background-color: $success-color;
  }

  &__content {
    display: flex;
    align-items: center;
    gap: $spacing-md;
    flex: 1;
  }

  &__message {
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: $spacing-sm;
  }

  &__spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba($white, 0.3);
    border-top-color: $white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  &__actions {
    display: flex;
    gap: $spacing-sm;
  }

  &__btn {
    border: none;
    border-radius: $radius-sm;
    padding: $spacing-xs $spacing-md;
    font-size: $font-size-sm;
    cursor: pointer;
    font-weight: 500;
    transition: $transition-base;

    &--install {
      background-color: $white;
      color: $success-color;

      &:hover {
        background-color: rgba($white, 0.9);
      }
    }

    &--later {
      background-color: transparent;
      color: $white;
      border: 1px solid rgba($white, 0.5);

      &:hover {
        background-color: rgba($white, 0.1);
      }
    }
  }

  &__close {
    background: none;
    border: none;
    color: $white;
    font-size: $font-size-xl;
    cursor: pointer;
    padding: 0 $spacing-xs;
    line-height: 1;
    opacity: 0.7;
    margin-left: $spacing-sm;

    &:hover {
      opacity: 1;
    }
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateY(-100%);
}
</style>
