<script setup>
    import { ref, nextTick, onUnmounted } from 'vue';
    import { cn } from '@/utils/cn';

    const props = defineProps({
        content: { type: String, required: true },
        position: { type: String, default: 'top' } // top, bottom, right, left
    });

    const isVisible = ref(false);
    const triggerRef = ref(null);
    const tooltipRef = ref(null);
    const coords = ref({ top: 0, left: 0 });

    // Calcula posição fixa na tela e evita corte nas bordas da janela
    const atualizarPosicao = async () => {
        if (!triggerRef.value) return;
        await nextTick();
        if (!tooltipRef.value) return;

        const rect = triggerRef.value.getBoundingClientRect();
        const tip = tooltipRef.value.getBoundingClientRect();
        const gap = 8;
        const margemTela = 8;

        let top = 0;
        let left = 0;

        if (props.position === 'top') {
            top = rect.top - tip.height - gap;
            left = rect.left + (rect.width - tip.width) / 2;
        } else if (props.position === 'bottom') {
            top = rect.bottom + gap;
            left = rect.left + (rect.width - tip.width) / 2;
        } else if (props.position === 'left') {
            top = rect.top + (rect.height - tip.height) / 2;
            left = rect.left - tip.width - gap;
        } else if (props.position === 'right') {
            top = rect.top + (rect.height - tip.height) / 2;
            left = rect.right + gap;
        }

        // Impede que o tooltip ultrapasse as laterais da tela
        left = Math.max(margemTela, Math.min(left, window.innerWidth - tip.width - margemTela));
        top = Math.max(margemTela, Math.min(top, window.innerHeight - tip.height - margemTela));

        coords.value = { top, left };
    };

    const mostrar = () => {
        isVisible.value = true;
        atualizarPosicao();
        window.addEventListener('scroll', esconder, true);
        window.addEventListener('resize', esconder);
    };

    const esconder = () => {
        isVisible.value = false;
        window.removeEventListener('scroll', esconder, true);
        window.removeEventListener('resize', esconder);
    };

    onUnmounted(() => {
        esconder();
    });
</script>

<template>
    <div
        ref="triggerRef"
        class="inline-flex"
        @mouseenter="mostrar"
        @mouseleave="esconder"
        @focus="mostrar"
        @blur="esconder"
    >
        <slot />

        <Teleport to="body">
            <Transition
                enter-active-class="transition duration-150 ease-out"
                enter-from-class="opacity-0 scale-95"
                enter-to-class="opacity-100 scale-100"
                leave-active-class="transition duration-100 ease-in"
                leave-from-class="opacity-100 scale-100"
                leave-to-class="opacity-0 scale-95"
            >
                <div
                    v-if="isVisible && content"
                    ref="tooltipRef"
                    :style="{ top: `${coords.top}px`, left: `${coords.left}px` }"
                    :class="
                        cn(
                            'fixed z-[9999] rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-lg whitespace-nowrap pointer-events-none'
                        )
                    "
                >
                    {{ content }}
                </div>
            </Transition>
        </Teleport>
    </div>
</template>