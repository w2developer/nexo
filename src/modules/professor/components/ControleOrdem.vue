<script setup>
    import { GripVertical, ChevronUp, ChevronDown } from '@lucide/vue';

    defineProps({
        ordem: {
            type: [Number, String],
            required: true
        },
        desabilitado: {
            type: Boolean,
            default: false
        },
        podeSubir: {
            type: Boolean,
            default: true
        },
        podeDescer: {
            type: Boolean,
            default: true
        },
        tituloArrastar: {
            type: String,
            default: 'Arraste para reordenar'
        }
    });

    const emit = defineEmits(['subir', 'descer']);
</script>

<template>
    <div
        class="inline-flex items-center h-8 rounded-md border border-border bg-background shadow-xs overflow-hidden select-none shrink-0"
        @click.stop
    >
        <!-- Alca de arrastar + numero da posicao -->
        <div
            class="flex items-center justify-center gap-0.5 pl-1 pr-1.5 h-full text-muted-foreground transition-colors"
            :class="
                desabilitado
                    ? 'opacity-40 cursor-not-allowed'
                    : 'cursor-grab active:cursor-grabbing hover:bg-muted/60 hover:text-foreground'
            "
            :title="tituloArrastar"
        >
            <GripVertical class="hidden sm:block w-3 h-3 opacity-60 shrink-0" />
            <span class="min-w-[1.125rem] text-center text-xs font-semibold tabular-nums text-foreground">
                {{ ordem }}
            </span>
        </div>

        <!-- Setas compactas (subir / descer) -->
        <div class="flex flex-col border-l border-border h-full w-5 shrink-0">
            <button
                type="button"
                class="flex-1 flex items-center justify-center border-b border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
                :disabled="desabilitado || !podeSubir"
                title="Mover para cima"
                @mousedown.stop
                @click.stop="emit('subir')"
            >
                <ChevronUp class="w-3 h-3" />
            </button>
            <button
                type="button"
                class="flex-1 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
                :disabled="desabilitado || !podeDescer"
                title="Mover para baixo"
                @mousedown.stop
                @click.stop="emit('descer')"
            >
                <ChevronDown class="w-3 h-3" />
            </button>
        </div>
    </div>
</template>