<script setup>
    import { ref, computed, watch } from 'vue';
    import { useRouter } from 'vue-router';
    import { Save, Loader2, History, UserCheck, BookOpen } from '@lucide/vue';
    import { supabase } from '@/lib/supabase';
    import { toast } from '@/composables/useToast';
    import { formatarNome } from '@/utils/formatters';
    import { formatarDataBR } from '@/utils/dateHelpers';

    import Modal from '@/components/ui/Modal.vue';
    import Textarea from '@/components/ui/Textarea.vue';
    import Switch from '@/components/ui/Switch.vue';
    import Button from '@/components/ui/Button.vue';
    import Badge from '@/components/ui/Badge.vue';
    import Avatar from '@/components/ui/Avatar.vue';

    const aberto = defineModel({ type: Boolean, default: false });

    const props = defineProps({
        item: { type: Object, default: null },
        tipoUsuario: { type: String, default: 'secretaria' }
    });

    const emit = defineEmits(['salvo']);
    const router = useRouter();

    const statusSelecionado = ref('em_negociacao');
    const observacao = ref('');
    const abrirNovaMatricula = ref(true);
    const salvando = ref(false);
    const erroValidacao = ref(false);

    // Botões diretos de status (evita dropdown longo e conflito de clique no modal)
    const statusOpcoes = [
        {
            value: 'pendente',
            label: 'Pendente',
            ativa: 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold'
        },
        {
            value: 'em_negociacao',
            label: 'Em Negociação',
            ativa: 'border-violet-500 bg-violet-500/15 text-violet-700 dark:text-violet-300 font-semibold'
        },
        {
            value: 'rematriculado',
            label: 'Rematriculado',
            ativa: 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold'
        },
        {
            value: 'nao_rematriculado',
            label: 'Não Rematriculado',
            ativa: 'border-rose-500 bg-rose-500/15 text-rose-700 dark:text-rose-300 font-semibold'
        }
    ];

    const nomeUsuarioLogado = computed(() => {
        return sessionStorage.getItem('nome_usuario') || 'Colaborador';
    });

    watch(aberto, (estaAberto) => {
        if (estaAberto && props.item) {
            statusSelecionado.value = props.item.status === 'pendente'
                ? 'em_negociacao'
                : props.item.status;
            observacao.value = '';
            erroValidacao.value = false;
            abrirNovaMatricula.value = true;
        }
    });

    const configStatus = (status) => {
        const mapa = {
            pendente: { label: 'Pendente', classe: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
            em_negociacao: { label: 'Em Negociação', classe: 'bg-violet-500/15 text-violet-700 dark:text-violet-300' },
            rematriculado: { label: 'Rematriculado', classe: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
            nao_rematriculado: { label: 'Não Rematriculado', classe: 'bg-rose-500/15 text-rose-700 dark:text-rose-400' }
        };
        return mapa[status] || mapa.pendente;
    };

    const salvarAtendimento = async () => {
        erroValidacao.value = true;
        if (!observacao.value.trim() || !props.item || salvando.value) return;

        salvando.value = true;

        try {
            const agora = new Date().toISOString();
            const historicoAnterior = Array.isArray(props.item.historico) ? props.item.historico : [];

            const novoRegistro = {
                data: agora,
                usuario_nome: nomeUsuarioLogado.value,
                status: statusSelecionado.value,
                observacao: observacao.value.trim()
            };

            const payload = {
                aluno_id: props.item.aluno.id,
                status: statusSelecionado.value,
                usuario_nome: nomeUsuarioLogado.value,
                observacao: observacao.value.trim(),
                historico: [novoRegistro, ...historicoAnterior],
                atualizado_em: agora
            };

            const { error } = await supabase
                .from('controle_rematricula')
                .upsert(payload, { onConflict: 'aluno_id' });

            if (error) throw error;

            toast.success('Atendimento salvo', 'Registro atualizado com sucesso.');
            emit('salvo');
            aberto.value = false;

            if (statusSelecionado.value === 'rematriculado' && abrirNovaMatricula.value) {
                router.push(`/${props.tipoUsuario}/nova-matricula/${props.item.aluno.id}`);
            }
        } catch (err) {
            console.error('Erro ao salvar rematrícula:', err);
            toast.error('Erro', 'Não foi possível salvar o atendimento.');
        } finally {
            salvando.value = false;
        }
    };
</script>

<template>
    <Modal
        v-model="aberto"
        title="Atendimento de Rematrícula"
        size="md"
    >
        <div v-if="item" class="space-y-3">
            <!-- Cabeçalho Compacto (Aluno + Atendente unificados) -->
            <div class="p-2.5 rounded-lg bg-muted border border-border space-y-2">
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <Avatar :name="item.aluno.nome" class="w-8 h-8 text-xs shrink-0" />
                        <div class="min-w-0">
                            <p class="font-bold text-sm text-foreground truncate leading-tight">
                                {{ formatarNome(item.aluno.nome) }}
                            </p>
                            <p class="text-[11px] text-muted-foreground truncate">
                                {{ item.resumoCurso }} • Cód: {{ item.aluno.codigo }}
                            </p>
                        </div>
                    </div>

                    <Badge
                        variant="secondary"
                        class="shrink-0 text-[10px] px-2 py-0"
                        :class="item.origem === 'reta_final'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                            : 'bg-blue-500/15 text-blue-700 dark:text-blue-400'"
                    >
                        {{ item.motivoQualificacao }}
                    </Badge>
                </div>

                <div class="flex items-center justify-between pt-1.5 border-t border-border/70 text-[11px] text-muted-foreground">
                    <span class="flex items-center gap-1">
                        <UserCheck class="w-3 h-3 text-primary" />
                        Atendente responsável:
                    </span>
                    <span class="font-semibold text-foreground">{{ nomeUsuarioLogado }}</span>
                </div>
            </div>

            <!-- Seletor de Status em Pílulas 2x2 (Não fecha o modal e economiza altura) -->
            <div class="space-y-1.5">
                <label class="block text-xs font-semibold text-foreground">
                    Status da Rematrícula *
                </label>
                <div class="grid grid-cols-2 gap-1.5">
                    <button
                        v-for="op in statusOpcoes"
                        :key="op.value"
                        type="button"
                        :disabled="salvando"
                        @click.stop="statusSelecionado = op.value"
                        class="px-2.5 py-1.5 rounded-md border text-xs transition-all text-center cursor-pointer"
                        :class="statusSelecionado === op.value
                            ? op.ativa
                            : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'"
                    >
                        {{ op.label }}
                    </button>
                </div>
            </div>

            <!-- Atalho para Nova Matrícula -->
            <div
                v-if="statusSelecionado === 'rematriculado'"
                class="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
            >
                <div class="flex items-center gap-2 text-xs">
                    <BookOpen class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span class="font-medium text-foreground">Abrir tela de Nova Matrícula ao salvar</span>
                </div>
                <Switch id="switch-ir-nova-mat" v-model="abrirNovaMatricula" variant="emerald" />
            </div>

            <!-- Observação Compacta -->
            <div class="space-y-1">
                <label for="obs-rematricula" class="block text-xs font-semibold text-foreground">
                    Observações do Atendimento *
                </label>
                <Textarea
                    id="obs-rematricula"
                    v-model="observacao"
                    rows="2"
                    placeholder="Descreva a proposta feita ou resposta do aluno..."
                    :error="erroValidacao && !observacao.trim()"
                    :disabled="salvando"
                />
                <p v-if="erroValidacao && !observacao.trim()" class="text-[11px] text-red-500 dark:text-red-400">
                    Informe uma observação sobre o atendimento.
                </p>
            </div>

            <!-- Histórico Enxuto -->
            <div v-if="item.historico?.length > 0" class="space-y-1.5 pt-1 border-t border-border">
                <h4 class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <History class="w-3 h-3" />
                    Histórico ({{ item.historico.length }})
                </h4>

                <div class="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                    <div
                        v-for="(reg, idx) in item.historico"
                        :key="idx"
                        class="p-2 rounded-md bg-muted/60 border border-border text-xs space-y-1"
                    >
                        <div class="flex items-center justify-between gap-2 text-[11px]">
                            <span class="font-semibold text-foreground truncate">{{ reg.usuario_nome }}</span>
                            <div class="flex items-center gap-1.5 shrink-0">
                                <span
                                    class="px-1.5 py-0 rounded text-[9px] font-semibold"
                                    :class="configStatus(reg.status).classe"
                                >
                                    {{ configStatus(reg.status).label }}
                                </span>
                                <span class="text-muted-foreground">{{ formatarDataBR(reg.data) }}</span>
                            </div>
                        </div>
                        <p class="text-muted-foreground whitespace-pre-wrap break-words leading-snug text-[11px]">
                            {{ reg.observacao }}
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <template #footer>
            <Button variant="ghost" size="sm" :disabled="salvando" @click="aberto = false">
                Cancelar
            </Button>
            <Button variant="default" size="sm" :disabled="salvando" @click="salvarAtendimento">
                <Loader2 v-if="salvando" class="w-4 h-4 mr-1.5 animate-spin" />
                <Save v-else class="w-4 h-4 mr-1.5" />
                Salvar
            </Button>
        </template>
    </Modal>
</template>