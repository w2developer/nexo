<script setup>
    import { ref, computed } from 'vue';
    import { cn } from '@/utils/cn';
    import { getInitials, getAvatarColor } from '@/utils/formatters';

    const props = defineProps({
        src: { type: String, default: '' },
        alt: { type: String, default: 'Avatar' },
        name: { type: String, default: '' },
        initials: { type: String, default: 'WM' },
        class: { type: String, default: '' }
    });

    const imageError = ref(false);

    const onImageError = () => {
        imageError.value = true;
    };

    // Usa as iniciais do nome se existir, senão usa a prop initials
    const textoIniciais = computed(() => {
        if (props.name) return getInitials(props.name);
        return props.initials;
    });

    // Gera cor dinâmica se tiver nome, senão usa cor padrão do tema
    const classesCor = computed(() => {
        if (props.name) return getAvatarColor(props.name);
        return 'bg-muted text-foreground';
    });
</script>

<template>
    <div
        :class="
            cn(
                'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted',
                props.class
            )
        "
    >
        <!-- Imagem Real -->
        <img
            v-if="src && !imageError"
            :src="src"
            :alt="alt || name"
            @error="onImageError"
            class="aspect-square h-full w-full object-cover"
        />

        <!-- Fallback (Iniciais + Cor) -->
        <div
            v-else
            :class="
                cn(
                    'flex h-full w-full items-center justify-center rounded-full text-sm font-semibold',
                    classesCor
                )
            "
        >
            {{ textoIniciais }}
        </div>
    </div>
</template>