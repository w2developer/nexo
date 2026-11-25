<script setup>
    import { computed } from 'vue';
    import { FileText, ExternalLink } from '@lucide/vue';

    import googleDriveIcon from '@/assets/png/google-drive-96.png';
    import megaLogoIcon from '@/assets/png/mega-logo-96.png';

    const props = defineProps({
        tipo: {
            type: String,
            required: true,
            validator: (valor) => ['drive', 'mega', 'outro', 'pdf'].includes(valor)
        },
        url: {
            type: String,
            default: ''
        },
        mostrarLabel: {
            type: Boolean,
            default: false
        }
    });

    const configuracao = computed(() => {
        const mapa = {
            drive: {
                label: 'Drive',
                titulo: 'Abrir no Google Drive',
                imagem: googleDriveIcon
            },
            mega: {
                label: 'Mega',
                titulo: 'Abrir no Mega',
                imagem: megaLogoIcon
            },
            outro: {
                label: 'Outro',
                titulo: 'Abrir link externo',
                icone: ExternalLink,
                classeIcone: 'text-foreground'
            },
            pdf: {
                label: 'PDF',
                titulo: 'Abrir arquivo PDF',
                icone: FileText,
                classeIcone: 'text-rose-600 dark:text-rose-400'
            }
        };

        return mapa[props.tipo];
    });
</script>

<template>
    <a
        v-if="url"
        :href="url"
        target="_blank"
        rel="noopener noreferrer"
        :title="configuracao.titulo"
        :aria-label="configuracao.titulo"
        class="inline-flex items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-muted transition-colors shadow-xs"
        :class="mostrarLabel ? 'gap-1.5 px-2 py-1 text-xs font-medium' : 'w-8 h-8'"
    >
        <img
            v-if="configuracao.imagem"
            :src="configuracao.imagem"
            :alt="configuracao.label"
            class="object-contain shrink-0"
            :class="mostrarLabel ? 'w-3.5 h-3.5' : 'w-5 h-5'"
        />
        <component
            :is="configuracao.icone"
            v-else
            class="shrink-0"
            :class="[mostrarLabel ? 'w-3.5 h-3.5' : 'w-4 h-4', configuracao.classeIcone]"
        />
        <span v-if="mostrarLabel">{{ configuracao.label }}</span>
    </a>

    <span
        v-else-if="!mostrarLabel"
        class="text-sm text-muted-foreground/40 select-none"
    >
        —
    </span>
</template>