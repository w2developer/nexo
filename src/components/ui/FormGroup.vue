<script setup>
import Label from './Label.vue'

const props = defineProps({
    label: { type: String, required: true },
    id: { type: String, default: '' },
    description: { type: String, default: '' },
    error: { type: String, default: '' },
})
</script>

<template>
    <div class="space-y-2">
        <!-- Label principal -->
        <Label :for="id" :class="error ? 'text-destructive' : ''">
            {{ label }}
        </Label>

        <!-- O Input (ou Select, Textarea) entra aqui -->
        <slot />

        <!-- Texto de ajuda -->
        <p v-if="description && !error" class="text-[0.8rem] text-muted-foreground">
            {{ description }}
        </p>

        <!-- Mensagem de erro (substitui a descrição quando presente) -->
        <p v-if="error" class="text-[0.8rem] font-medium text-destructive">
            {{ error }}
        </p>
    </div>
</template>
