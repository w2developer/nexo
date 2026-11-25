<script setup>
    import {
        List,
        ListChecks,
        ListPlus,
        RefreshCw,
        LayoutDashboard,
        AlertTriangle,
        Award,
        PhoneCall,
        ArrowRight,
        CheckCircle2,
        X
    } from '@lucide/vue';
    import { ref, computed, onMounted } from 'vue';
    import { useRouter, useRoute } from 'vue-router';
    import { sincronizarRealtimeAuth } from '@/lib/supabase';
    import { usePendencias } from '@/composables/usePendencias';
    import { useChat } from '@/composables/useChat';
    import ChatWidget from '@/components/chat/ChatWidget.vue';

    import AppLayout from '@/components/layout/AppLayout.vue';
    import Sidebar from '@/components/layout/Sidebar.vue';
    import Navbar from '@/components/layout/Navbar.vue';
    import Modal from '@/components/ui/Modal.vue';
    import Button from '@/components/ui/Button.vue';

    const CHAVE_RESUMO_VISTO = 'resumo_turno_secretaria_visto';
    const CHAVE_FAIXA_OCULTA = 'faixa_pendencias_secretaria_oculta';

    const router = useRouter();
    const route = useRoute();

    const {
        carregarDadosGlobais,
        listaFaltantes,
        faltantesAcaoImediata,
        faltantesCriticos,
        listaCertificados,
        contatosHoje,
        metaContatosDia,
        progressoMetaDiaria,
        metaDiariaAtingida
    } = usePendencias();

    const { initChat } = useChat();

    const modalResumoAberto = ref(false);
    const faixaOculta = ref(sessionStorage.getItem(CHAVE_FAIXA_OCULTA) === '1');

    const navigation = [
        {
            group: 'Geral',
            items: [
                {
                    title: 'Dashboard',
                    to: '/secretaria/dashboard',
                    icon: LayoutDashboard
                }
            ]
        },
        {
            group: 'Gestão de Alunos',
            items: [
                {
                    title: 'Controle de Alunos',
                    to: '/secretaria/alunos',
                    icon: List
                },
                {
                    title: 'Controle de Concluídos',
                    to: '/secretaria/concluidos',
                    icon: ListChecks
                },
                {
                    title: 'Controle de Rematrícula',
                    to: '/secretaria/rematricula',
                    icon: RefreshCw
                },
                {
                    title: 'Cadastrar Aluno',
                    to: '/secretaria/cadastrar-aluno',
                    icon: ListPlus
                }
            ]
        }
    ];

    const totalPendenciasAtivas = computed(() => {
        return listaFaltantes.value.length + listaCertificados.value.length;
    });

    const estaNoDashboard = computed(() => {
        return route.path === '/secretaria/dashboard';
    });

    const exibirFaixaTopo = computed(() => {
        return !faixaOculta.value && totalPendenciasAtivas.value > 0;
    });

    const abaPrioritaria = computed(() => {
        if (faltantesAcaoImediata.value.length > 0 || listaFaltantes.value.length > 0) {
            return 'faltantes';
        }
        return 'certificados';
    });

    const fecharResumoTurno = () => {
        sessionStorage.setItem(CHAVE_RESUMO_VISTO, '1');
        modalResumoAberto.value = false;
    };

    const irParaFila = (aba = abaPrioritaria.value) => {
        fecharResumoTurno();
        router.push({ path: '/secretaria/dashboard', query: { aba } });
    };

    const ocultarFaixaSessao = () => {
        faixaOculta.value = true;
        sessionStorage.setItem(CHAVE_FAIXA_OCULTA, '1');
    };

    onMounted(async () => {
        try {
            const token = sessionStorage.getItem('token_acesso');

            if (token) {
                sincronizarRealtimeAuth();

                const payload = JSON.parse(atob(token.split('.')[1]));

                if (payload && payload.sub) {
                    const idDoUsuario = payload.sub;
                    const tipoChat = payload.tipo === 'aluno' ? 'aluno' : 'usuario';
                    const nomeDoUsuario = payload.nome || 'Usuário Logado';

                    initChat(idDoUsuario, nomeDoUsuario, tipoChat);
                }
            } else {
                console.warn('Nenhum token de acesso encontrado. O chat não foi inicializado.');
            }
        } catch (err) {
            console.error('Erro ao ler sessão para o chat:', err);
        }

        await carregarDadosGlobais();

        // Camada A: exibe o Resumo do Turno 1x por sessao se houver pendencias
        const jaViuResumo = sessionStorage.getItem(CHAVE_RESUMO_VISTO) === '1';
        if (!jaViuResumo && totalPendenciasAtivas.value > 0) {
            modalResumoAberto.value = true;
            sessionStorage.setItem(CHAVE_RESUMO_VISTO, '1');
        }
    });
</script>

<template>
    <AppLayout :navigation="navigation">
        <template #sidebar>
            <Sidebar :navigation="navigation" />
        </template>

        <template #navbar>
            <Navbar />
        </template>

        <!-- Camada B: Faixa fina de pendencias e meta diaria (substitui o toast.infinit) -->
        <div
            v-if="exibirFaixaTopo"
            class="border-b border-amber-500/25 bg-amber-500/10 px-4 py-2 text-xs"
        >
            <div class="mx-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-foreground">
                    <span class="inline-flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
                        <AlertTriangle class="w-3.5 h-3.5 shrink-0" />
                        Pendências da secretaria:
                    </span>

                    <button
                        v-if="listaFaltantes.length > 0"
                        type="button"
                        @click="irParaFila('faltantes')"
                        class="hover:underline cursor-pointer text-left"
                    >
                        <strong>{{ listaFaltantes.length }}</strong> faltantes
                        <span v-if="faltantesAcaoImediata.length > 0" class="text-muted-foreground">
                            ({{ faltantesAcaoImediata.length }} sem retorno)
                        </span>
                    </button>

                    <span v-if="listaFaltantes.length > 0 && listaCertificados.length > 0" class="text-muted-foreground/50">
                        ·
                    </span>

                    <button
                        v-if="listaCertificados.length > 0"
                        type="button"
                        @click="irParaFila('certificados')"
                        class="hover:underline cursor-pointer text-left"
                    >
                        <strong>{{ listaCertificados.length }}</strong> certificados
                    </button>
                </div>

                <div class="flex items-center gap-3 ml-auto">
                    <!-- Mini indicador da meta diaria -->
                    <div
                        class="hidden sm:flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tabular-nums"
                        :class="
                            metaDiariaAtingida
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                : 'border-border bg-background/80 text-muted-foreground'
                        "
                        title="Meta diária de contatos com alunos faltantes"
                    >
                        <CheckCircle2 v-if="metaDiariaAtingida" class="w-3 h-3 shrink-0" />
                        <PhoneCall v-else class="w-3 h-3 shrink-0" />
                        <span>Contatos hoje: {{ contatosHoje }}/{{ metaContatosDia }}</span>
                    </div>

                    <button
                        v-if="!estaNoDashboard"
                        type="button"
                        @click="irParaFila()"
                        class="inline-flex items-center gap-1 font-semibold text-amber-800 dark:text-amber-300 hover:underline cursor-pointer"
                    >
                        Abrir fila
                        <ArrowRight class="w-3.5 h-3.5" />
                    </button>

                    <button
                        type="button"
                        @click="ocultarFaixaSessao"
                        class="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                        title="Ocultar aviso nesta sessão"
                        aria-label="Ocultar aviso nesta sessão"
                    >
                        <X class="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>

        <div class="mx-auto p-4 pb-24">
            <RouterView />
        </div>

        <!-- Camada A: Modal Resumo do Turno (1x por sessao) -->
        <Modal
            v-model="modalResumoAberto"
            title="Resumo do Turno"
            description="Acompanhamento rápido das pendências abertas para organizar seu dia."
            size="md"
        >
            <div class="space-y-4 p-1">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <!-- Card Faltantes -->
                    <button
                        type="button"
                        @click="irParaFila('faltantes')"
                        class="flex flex-col justify-between gap-2 rounded-lg border border-rose-500/25 bg-rose-500/5 p-3.5 text-left hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                                Alunos Faltantes
                            </span>
                            <AlertTriangle class="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                        </div>

                        <div>
                            <p class="text-2xl font-bold text-foreground tabular-nums">
                                {{ listaFaltantes.length }}
                            </p>
                            <p class="text-xs text-muted-foreground mt-0.5">
                                <template v-if="faltantesCriticos.length > 0">
                                    {{ faltantesAcaoImediata.length }} sem retorno ({{ faltantesCriticos.length }} há +30 dias)
                                </template>
                                <template v-else-if="faltantesAcaoImediata.length > 0">
                                    {{ faltantesAcaoImediata.length }} aguardando contato
                                </template>
                                <template v-else>
                                    Todos já receberam contato recente
                                </template>
                            </p>
                        </div>
                    </button>

                    <!-- Card Certificados -->
                    <button
                        type="button"
                        @click="irParaFila('certificados')"
                        class="flex flex-col justify-between gap-2 rounded-lg border border-indigo-500/25 bg-indigo-500/5 p-3.5 text-left hover:bg-indigo-500/10 transition-colors cursor-pointer"
                    >
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                                Certificados
                            </span>
                            <Award class="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        </div>

                        <div>
                            <p class="text-2xl font-bold text-foreground tabular-nums">
                                {{ listaCertificados.length }}
                            </p>
                            <p class="text-xs text-muted-foreground mt-0.5">
                                Aguardando emissão ou entrega
                            </p>
                        </div>
                    </button>
                </div>

                <!-- Progresso da Meta Diaria -->
                <div class="rounded-lg border border-border bg-muted/40 p-3.5 space-y-2">
                    <div class="flex items-center justify-between gap-2 text-xs">
                        <span class="font-medium text-foreground inline-flex items-center gap-1.5">
                            <CheckCircle2 v-if="metaDiariaAtingida" class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <PhoneCall v-else class="w-4 h-4 text-muted-foreground" />
                            Meta diária de contatos
                        </span>
                        <span class="font-semibold text-foreground tabular-nums">
                            {{ contatosHoje }} / {{ metaContatosDia }} hoje
                        </span>
                    </div>

                    <div class="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                            class="h-full rounded-full transition-all duration-300"
                            :class="metaDiariaAtingida ? 'bg-emerald-500' : 'bg-indigo-600 dark:bg-indigo-500'"
                            :style="{ width: `${progressoMetaDiaria}%` }"
                        ></div>
                    </div>

                    <p class="text-xs text-muted-foreground">
                        <template v-if="metaDiariaAtingida">
                            Meta do dia atingida! Excelente ritmo de acompanhamento.
                        </template>
                        <template v-else>
                            Faltam <strong>{{ metaContatosDia - contatosHoje }}</strong>
                            {{ metaContatosDia - contatosHoje === 1 ? 'contato' : 'contatos' }}
                            para concluir a meta de hoje.
                        </template>
                    </p>
                </div>
            </div>

            <template #footer>
                <Button variant="ghost" @click="fecharResumoTurno">
                    Ver depois
                </Button>
                <Button variant="default" @click="irParaFila()">
                    Atender pendências agora
                    <ArrowRight class="w-4 h-4 ml-1.5" />
                </Button>
            </template>
        </Modal>

        <ChatWidget />
    </AppLayout>
</template>