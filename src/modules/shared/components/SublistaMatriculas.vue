<script setup>
    import { formatarDataBR } from '@/utils/dateHelpers';
    import { capitalizar, getBadgeVariantMatricula } from '@/utils/formatters';

    import Button from '@/components/ui/Button.vue';
    import Badge from '@/components/ui/Badge.vue';
    import Table from '@/components/ui/Table.vue';
    import TableHeader from '@/components/ui/TableHeader.vue';
    import TableHead from '@/components/ui/TableHead.vue';
    import TableCell from '@/components/ui/TableCell.vue';
    import TableBody from '@/components/ui/TableBody.vue';
    import TableRow from '@/components/ui/TableRow.vue';

    defineProps({
        matriculas: { type: Array, default: () => [] }
    });

    const emit = defineEmits(['ver-detalhes']);
</script>

<template>
    <div class="p-3 pt-0 pl-11 md:p-4 md:pt-0 md:pl-16">
        <div v-if="!matriculas || matriculas.length === 0" class="mt-2 text-sm text-slate-500 italic">
            Nenhum histórico de matrículas.
        </div>

        <template v-else>
            <!-- Visualização Desktop -->
            <div class="hidden md:block mt-2 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                <Table>
                    <TableHeader class="bg-slate-50">
                        <TableRow>
                            <TableHead class="pl-4 text-xs">Curso</TableHead>
                            <TableHead class="text-xs">Situação</TableHead>
                            <TableHead class="text-xs">Início</TableHead>
                            <!-- <TableHead class="text-xs">Término/Conclusão</TableHead> -->
                            <TableHead class="text-xs text-end pr-4">Gerenciar</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow v-for="mat in matriculas" :key="mat.id">
                            <TableCell class="pl-4 py-2 font-medium text-sm text-slate-700">
                                {{ mat.curso?.nome || 'Curso Desconhecido' }}
                            </TableCell>
                            <TableCell class="py-2">
                                <Badge 
                                    :variant="getBadgeVariantMatricula(mat.situacao)" 
                                    class="text-[10px] px-2 py-0"
                                    :class="mat.situacao === 'cursando' ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200' : ''"
                                >
                                    {{ capitalizar(mat.situacao) }}
                                </Badge>
                            </TableCell>
                            <TableCell class="py-2 text-sm text-slate-500">
                                {{ formatarDataBR(mat.data_inicio) }}
                            </TableCell>
                            <!-- <TableCell class="py-2 text-sm text-slate-500">
                                {{ formatarDataBR(mat.data_conclusao || mat.data_fim) }}
                            </TableCell> -->
                            <TableCell class="pr-4 py-2 text-end">
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    class="h-7 px-2 text-xs" 
                                    @click="emit('ver-detalhes', mat)"
                                >
                                    Ver Detalhes
                                </Button>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>

            <!-- Visualização Mobile -->
            <div class="md:hidden mt-2 space-y-2">
                <div 
                    v-for="mat in matriculas" 
                    :key="'mob-' + mat.id"
                    class="flex items-center justify-between p-2 rounded-md bg-white border border-slate-100"
                >
                    <div class="flex flex-col min-w-0 pr-2">
                        <span class="text-sm font-medium text-slate-700 truncate">
                            {{ mat.curso?.nome || 'Curso Desconhecido' }}
                        </span>
                        <span class="text-xs text-slate-400">
                            {{ formatarDataBR(mat.data_inicio) }}
                        </span>
                    </div>
                    <Badge 
                        :variant="getBadgeVariantMatricula(mat.situacao)" 
                        class="text-[10px] px-2 py-0 shrink-0"
                        :class="mat.situacao === 'cursando' ? 'bg-amber-100 text-amber-700 border-amber-200' : ''"
                    >
                        {{ capitalizar(mat.situacao) }}
                    </Badge>
                </div>
            </div>
        </template>
    </div>
</template>