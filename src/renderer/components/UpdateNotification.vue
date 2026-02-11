<script setup>
import { ref, onMounted, onUnmounted } from "vue";

const status = ref(null); // 'downloading' | 'ready'
const version = ref("");
const dismissed = ref(false);

function onUpdateAvailable(info) {
  status.value = "downloading";
  version.value = info.version;
  dismissed.value = false;
}

function onUpdateDownloaded(info) {
  status.value = "ready";
  version.value = info.version;
  dismissed.value = false;
}

function installNow() {
  window.electronAPI.installUpdate();
}

function dismiss() {
  dismissed.value = true;
}

onMounted(() => {
  window.electronAPI.onUpdateAvailable(onUpdateAvailable);
  window.electronAPI.onUpdateDownloaded(onUpdateDownloaded);
});
</script>

<template>
  <Transition name="slide">
    <div v-if="status && !dismissed" class="update-banner" :class="status">
      <div class="update-banner__content">
        <span v-if="status === 'downloading'" class="update-banner__message">
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

  &.downloading {
    background-color: $info-color;
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

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateY(-100%);
}
</style>
