<script setup>
import { ref } from 'vue'
import { cn } from '../../utils/cn'

const props = defineProps({
    src: { type: String, default: '' },
    alt: { type: String, default: 'Avatar' },
    initials: { type: String, default: 'WM' },
    class: { type: String, default: '' },
})

const imageError = ref(false)

const onImageError = () => {
    imageError.value = true
}
</script>

<template>
    <div
        :class="
            cn(
                'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted',
                props.class,
            )
        "
    >
        <!-- Imagem Real -->
        <img
            v-if="src && !imageError"
            :src="src"
            :alt="alt"
            @error="onImageError"
            class="aspect-square h-full w-full object-cover"
        />
        <!-- Fallback (Iniciais) -->
        <div
            v-else
            class="flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground"
        >
            {{ initials }}
        </div>
    </div>
</template>
