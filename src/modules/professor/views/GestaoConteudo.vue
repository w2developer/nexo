<script setup>
    import { ref, computed, markRaw } from 'vue';

    import Card from '@/components/ui/Card.vue';
    import CardHeader from '@/components/ui/CardHeader.vue';
    import CardContent from '@/components/ui/CardContent.vue';
    import Button from '@/components/ui/Button.vue';

    import AbaAuxiliares from '../components/AbaAuxiliares.vue';
    import AbaApostilas from '../components/AbaApostilas.vue';
    import AbaAtividades from '../components/AbaAtividades.vue';

    // Registro central de abas: para adicionar uma nova, basta incluir um item aqui
    const abas = [
        { id: 'auxiliares', label: 'Auxiliares', component: markRaw(AbaAuxiliares) },
        { id: 'apostilas', label: 'Apostilas', component: markRaw(AbaApostilas) },
        { id: 'atividades', label: 'Atividades', component: markRaw(AbaAtividades) }
    ];

    const abaAtiva = ref('auxiliares');
    const contadores = ref({});

    const componenteAtivo = computed(() => {
        const encontrada = abas.find(aba => aba.id === abaAtiva.value);
        return encontrada ? encontrada.component : null;
    });

    const atualizarTotal = (abaId, total) => {
        contadores.value[abaId] = total;
    };

    const formatarLabelAba = (aba) => {
        const total = contadores.value[aba.id];
        return total !== undefined ? `${aba.label} (${total})` : aba.label;
    };
</script>

<template>
    <div class="space-y-6 pb-12">
        <!-- Cabecalho e Navegacao entre Modulos -->
        <Card>
            <CardHeader class="p-4 font-bold text-xl border-b border-border text-foreground">
                <h2>Gestão de Conteúdo</h2>
            </CardHeader>
            <CardContent class="p-4">
                <div class="flex flex-wrap items-center gap-2">
                    <Button
                        v-for="aba in abas"
                        :key="aba.id"
                        size="sm"
                        class="h-9 px-3 text-xs"
                        :variant="abaAtiva === aba.id ? 'default' : 'outline'"
                        @click="abaAtiva = aba.id"
                    >
                        {{ formatarLabelAba(aba) }}
                    </Button>
                </div>
            </CardContent>
        </Card>

        <!-- Conteudo Dinamico da Aba Ativa -->
        <KeepAlive>
            <component
                :is="componenteAtivo"
                :key="abaAtiva"
                @update-total="(total) => atualizarTotal(abaAtiva, total)"
            />
        </KeepAlive>
    </div>
</template>