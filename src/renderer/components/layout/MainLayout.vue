<template>
    <section>
        <button @click="goBack" type="button" class="back-button"><-</button>
        <slot></slot>
    </section>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()
const goBack = () => {
    router.go(-1)
}
</script>