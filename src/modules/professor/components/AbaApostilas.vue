<script setup>
    import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
    import { supabase } from '@/lib/supabase';
    import {
        Plus,
        Search,
        Menu,
        Pencil,
        Trash2,
        Loader2,
        ChevronRight,
        Image as ImageIcon
    } from '@lucide/vue';
    import { toast } from '@/composables/useToast';
    import {
        ordenarPorOrdemENome,
        moverItemNaLista,
        posicionarItemPorNumero,
        calcularNormalizacaoOrdem
    } from '../utils/ordenacao';

    import Card from '@/components/ui/Card.vue';
    import CardContent from '@/components/ui/CardContent.vue';
    import Button from '@/components/ui/Button.vue';
    import Input from '@/components/ui/Input.vue';
    import Select from '@/components/ui/Select.vue';
    import Badge from '@/components/ui/Badge.vue';
    import FormGroup from '@/components/ui/FormGroup.vue';
    import Dropdown from '@/components/ui/Dropdown.vue';
    import Modal from '@/components/ui/Modal.vue';
    import ControleOrdem from './ControleOrdem.vue';
    import BotaoCanalLink from './BotaoCanalLink.vue';

    const emit = defineEmits(['update-total']);

    const cursos = ref([]);
    const apostilas = ref([]);
    const termoPesquisa = ref('');
    const filtroCurso = ref('todos');
    const carregando = ref(true);
    const salvando = ref(false);
    const excluindo = ref(false);
    const reordenando = ref(false);
    const cursoExpandido = ref(null);
    const miniaturasComErro = ref(new Set());
    let realtimeChannel = null;
    let realtimeTimer = null;

    // Estados de Drag & Drop (isolados por grupo de curso)
    const dragOrigem = ref(null);
    const dragAlvo = ref(null);

    const modalFormularioAberto = ref(false);
    const editandoId = ref(null);
    const cursoOriginalEdicao = ref('sem_curso');
    const erroPreviewMiniatura = ref(false);
    const form = ref({
        curso_id: '',
        nome: '',
        ordem: '1',
        miniatura_url: '',
        drive_url: '',
        mega_url: '',
        outro_url: ''
    });

    const modalExcluirAberto = ref(false);
    const apostilaParaExcluir = ref(null);

    watch(
        () => apostilas.value.length,
        (total) => emit('update-total', total)
    );

    watch(
        () => form.value.miniatura_url,
        () => {
            erroPreviewMiniatura.value = false;
        }
    );

    const getChaveCurso = (cursoId) => {
        return cursoId ? String(cursoId) : 'sem_curso';
    };

    const obterApostilasDoGrupo = (chaveCurso) => {
        return ordenarPorOrdemENome(
            apostilas.value.filter(item => getChaveCurso(item.curso_id) === chaveCurso)
        );
    };

    const opcoesFiltroCurso = computed(() => [
        { label: 'Todos os cursos', value: 'todos' },
        ...cursos.value.map(c => ({ label: c.nome, value: String(c.id) })),
        { label: 'Sem curso vinculado', value: 'sem_curso' }
    ]);

    const opcoesCursoModal = computed(() => [
        { label: 'Sem curso vinculado', value: '' },
        ...cursos.value.map(c => ({ label: c.nome, value: String(c.id) }))
    ]);

    const gruposApostilas = computed(() => {
        const termo = termoPesquisa.value.toLowerCase().trim();
        const mapaCursos = new Map(cursos.value.map(c => [c.id, c.nome]));
        const gruposMap = new Map();

        apostilas.value.forEach(item => {
            const chaveCurso = getChaveCurso(item.curso_id);
            const nomeCurso = item.curso_id
                ? (mapaCursos.get(item.curso_id) || 'Curso desconhecido')
                : 'Sem curso vinculado';

            if (filtroCurso.value !== 'todos' && filtroCurso.value !== chaveCurso) {
                return;
            }

            if (
                termo &&
                !item.nome.toLowerCase().includes(termo) &&
                !nomeCurso.toLowerCase().includes(termo)
            ) {
                return;
            }

            if (!gruposMap.has(chaveCurso)) {
                gruposMap.set(chaveCurso, {
                    id: chaveCurso,
                    nome: nomeCurso,
                    semCurso: !item.curso_id,
                    itens: []
                });
            }

            gruposMap.get(chaveCurso).itens.push(item);
        });

        const listaGrupos = Array.from(gruposMap.values());

        listaGrupos.forEach(grupo => {
            grupo.itens = ordenarPorOrdemENome(grupo.itens);
        });

        return listaGrupos.sort((a, b) => {
            if (a.semCurso && !b.semCurso) return 1;
            if (!a.semCurso && b.semCurso) return -1;
            return a.nome.localeCompare(b.nome, 'pt-BR');
        });
    });

    const isGrupoExpandido = (grupoId) => {
        if (termoPesquisa.value.trim() || filtroCurso.value !== 'todos') {
            return true;
        }
        return cursoExpandido.value === grupoId;
    };

    const toggleGrupoCurso = (grupoId) => {
        cursoExpandido.value = cursoExpandido.value === grupoId ? null : grupoId;
    };

    const podeReordenarGrupo = (grupo) => {
        return !termoPesquisa.value.trim() && !reordenando.value && grupo.itens.length > 1;
    };

    const validarUrl = (valor) => {
        if (!valor) return true;

        try {
            const url = new URL(valor);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    };

    const marcarErroMiniatura = (id) => {
        const novoSet = new Set(miniaturasComErro.value);
        novoSet.add(id);
        miniaturasComErro.value = novoSet;
    };

    const limparErroMiniatura = (id) => {
        if (!miniaturasComErro.value.has(id)) return;
        const novoSet = new Set(miniaturasComErro.value);
        novoSet.delete(id);
        miniaturasComErro.value = novoSet;
    };

    const persistirAlteracoesOrdem = async (alteracoes) => {
        if (!alteracoes.length) return;

        const resultados = await Promise.all(
            alteracoes.map(({ id, ordem }) =>
                supabase
                    .from('apostila')
                    .update({ ordem })
                    .eq('id', id)
            )
        );

        const erro = resultados.find(res => res.error)?.error;
        if (erro) throw erro;
    };

    const substituirGruposLocalmente = (chavesAfetadas, novosItens) => {
        const conjuntoChaves = new Set(chavesAfetadas);
        const restantes = apostilas.value.filter(
            item => !conjuntoChaves.has(getChaveCurso(item.curso_id))
        );
        apostilas.value = [...restantes, ...novosItens];
    };

    // ========================================================
    // CARREGAMENTO DE DADOS
    // ========================================================

    const carregarCursos = async () => {
        try {
            const { data, error } = await supabase
                .from('curso')
                .select('id, nome')
                .order('nome', { ascending: true });

            if (error) throw error;
            cursos.value = data || [];
        } catch (err) {
            console.error('Erro ao carregar cursos:', err);
            toast.error('Erro', 'Não foi possível carregar a lista de cursos.');
        }
    };

    const carregarApostilas = async (silencioso = false) => {
        if (!silencioso) carregando.value = true;

        try {
            const { data, error } = await supabase
                .from('apostila')
                .select('id, curso_id, nome, ordem, miniatura_url, drive_url, mega_url, outro_url')
                .order('ordem', { ascending: true })
                .order('nome', { ascending: true });

            if (error) throw error;
            apostilas.value = data || [];
            miniaturasComErro.value = new Set();
            emit('update-total', apostilas.value.length);
        } catch (err) {
            console.error('Erro ao carregar apostilas:', err);
            toast.error('Erro', 'Não foi possível carregar as apostilas.');
        } finally {
            if (!silencioso) carregando.value = false;
        }
    };

    const agendarRecarregamentoRealtime = () => {
        if (reordenando.value || salvando.value || excluindo.value) return;

        clearTimeout(realtimeTimer);
        realtimeTimer = setTimeout(() => {
            carregarApostilas(true);
        }, 250);
    };

    // ========================================================
    // REORDENACAO (SETAS E DRAG & DROP POR CURSO)
    // ========================================================

    const aplicarReordenacao = async (grupoId, indiceOrigem, indiceDestino) => {
        if (termoPesquisa.value.trim() || reordenando.value || indiceOrigem === indiceDestino) return;

        const itensGrupo = obterApostilasDoGrupo(grupoId);
        if (itensGrupo.length < 2) return;

        const estadoAnterior = [...apostilas.value];
        const listaMovida = moverItemNaLista(itensGrupo, indiceOrigem, indiceDestino);
        const { listaNormalizada, alteracoes } = calcularNormalizacaoOrdem(listaMovida);

        if (!alteracoes.length) return;

        substituirGruposLocalmente([grupoId], listaNormalizada);
        reordenando.value = true;

        try {
            await persistirAlteracoesOrdem(alteracoes);
        } catch (err) {
            apostilas.value = estadoAnterior;
            console.error('Erro ao reordenar apostilas:', err);
            toast.error('Erro', 'Não foi possível salvar a nova ordem.');
        } finally {
            reordenando.value = false;
        }
    };

    const moverApostila = (grupoId, index, direcao) => {
        aplicarReordenacao(grupoId, index, index + direcao);
    };

    const onDragStart = (grupo, index, event) => {
        if (!podeReordenarGrupo(grupo)) {
            event.preventDefault();
            return;
        }

        dragOrigem.value = { grupoId: grupo.id, index };
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', `${grupo.id}:${index}`);
        }
    };

    const onDragOver = (grupoId, index, event) => {
        if (!dragOrigem.value || dragOrigem.value.grupoId !== grupoId) return;

        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
        dragAlvo.value = { grupoId, index };
    };

    const onDrop = (grupoId, index, event) => {
        event.preventDefault();
        const origem = dragOrigem.value;
        dragOrigem.value = null;
        dragAlvo.value = null;

        if (origem && origem.grupoId === grupoId && origem.index !== index) {
            aplicarReordenacao(grupoId, origem.index, index);
        }
    };

    const onDragEnd = () => {
        dragOrigem.value = null;
        dragAlvo.value = null;
    };

    // ========================================================
    // CRUD: APOSTILAS
    // ========================================================

    const aoTrocarCursoModal = (novoCursoId) => {
        form.value.curso_id = novoCursoId;
        const chaveDestino = getChaveCurso(novoCursoId);
        const itensDestino = obterApostilasDoGrupo(chaveDestino);

        if (editandoId.value && chaveDestino === cursoOriginalEdicao.value) {
            const indiceAtual = itensDestino.findIndex(item => item.id === editandoId.value);
            form.value.ordem = String(indiceAtual !== -1 ? indiceAtual + 1 : itensDestino.length);
        } else {
            form.value.ordem = String(itensDestino.length + 1);
        }
    };

    const abrirModalNova = () => {
        editandoId.value = null;
        erroPreviewMiniatura.value = false;

        const cursoInicial =
            filtroCurso.value !== 'todos' && filtroCurso.value !== 'sem_curso'
                ? filtroCurso.value
                : '';
        const chaveInicial = getChaveCurso(cursoInicial);
        const itensIniciais = obterApostilasDoGrupo(chaveInicial);

        cursoOriginalEdicao.value = chaveInicial;
        form.value = {
            curso_id: cursoInicial,
            nome: '',
            ordem: String(itensIniciais.length + 1),
            miniatura_url: '',
            drive_url: '',
            mega_url: '',
            outro_url: ''
        };
        modalFormularioAberto.value = true;
    };

    const abrirModalEdicao = (apostila) => {
        editandoId.value = apostila.id;
        erroPreviewMiniatura.value = false;

        const chaveCurso = getChaveCurso(apostila.curso_id);
        const itensGrupo = obterApostilasDoGrupo(chaveCurso);
        const indiceAtual = itensGrupo.findIndex(item => item.id === apostila.id);
        const ordemExibicao = indiceAtual !== -1 ? indiceAtual + 1 : (apostila.ordem || 1);

        cursoOriginalEdicao.value = chaveCurso;
        form.value = {
            curso_id: apostila.curso_id ? String(apostila.curso_id) : '',
            nome: apostila.nome || '',
            ordem: String(ordemExibicao),
            miniatura_url: apostila.miniatura_url || '',
            drive_url: apostila.drive_url || '',
            mega_url: apostila.mega_url || '',
            outro_url: apostila.outro_url || ''
        };
        modalFormularioAberto.value = true;
    };

    const salvarApostila = async () => {
        if (salvando.value) return;

        const nomeLimpo = form.value.nome.trim();
        const miniaturaLimpa = form.value.miniatura_url.trim();
        const driveLimpo = form.value.drive_url.trim();
        const megaLimpo = form.value.mega_url.trim();
        const outroLimpo = form.value.outro_url.trim();
        const cursoIdFinal = form.value.curso_id ? Number(form.value.curso_id) : null;
        const chaveDestino = getChaveCurso(cursoIdFinal);
        const mudouDeCurso = Boolean(editandoId.value && chaveDestino !== cursoOriginalEdicao.value);

        const itensDestinoAtual = obterApostilasDoGrupo(chaveDestino);
        const totalMaximo = editandoId.value && !mudouDeCurso
            ? Math.max(1, itensDestinoAtual.length)
            : itensDestinoAtual.length + 1;
        const ordemDigitada = Number.parseInt(form.value.ordem, 10);
        const ordemDesejada = Number.isNaN(ordemDigitada)
            ? totalMaximo
            : Math.min(Math.max(1, ordemDigitada), totalMaximo);

        if (!nomeLimpo) {
            toast.error('Atenção', 'Informe o nome da apostila.');
            return;
        }

        if (!driveLimpo && !megaLimpo && !outroLimpo) {
            toast.error('Atenção', 'Informe ao menos um link de acesso.');
            return;
        }

        if (
            !validarUrl(miniaturaLimpa) ||
            !validarUrl(driveLimpo) ||
            !validarUrl(megaLimpo) ||
            !validarUrl(outroLimpo)
        ) {
            toast.error('Link inválido', 'Use URLs válidas iniciadas com http:// ou https://.');
            return;
        }

        const payload = {
            curso_id: cursoIdFinal,
            nome: nomeLimpo,
            ordem: ordemDesejada,
            miniatura_url: miniaturaLimpa || null,
            drive_url: driveLimpo || null,
            mega_url: megaLimpo || null,
            outro_url: outroLimpo || null
        };

        salvando.value = true;
        try {
            if (editandoId.value) {
                const { data, error } = await supabase
                    .from('apostila')
                    .update({
                        ...payload,
                        atualizado_em: new Date().toISOString()
                    })
                    .eq('id', editandoId.value)
                    .select('id, curso_id, nome, ordem, miniatura_url, drive_url, mega_url, outro_url')
                    .single();

                if (error) throw error;

                if (data) {
                    if (mudouDeCurso) {
                        const baseDestino = [...itensDestinoAtual, data];
                        const destinoReposicionado = posicionarItemPorNumero(baseDestino, data.id, ordemDesejada);
                        const { listaNormalizada: destinoNorm, alteracoes: altDestino } =
                            calcularNormalizacaoOrdem(destinoReposicionado);

                        const baseOrigem = obterApostilasDoGrupo(cursoOriginalEdicao.value).filter(
                            item => item.id !== data.id
                        );
                        const { listaNormalizada: origemNorm, alteracoes: altOrigem } =
                            calcularNormalizacaoOrdem(baseOrigem);

                        await persistirAlteracoesOrdem([...altDestino, ...altOrigem]);
                        substituirGruposLocalmente(
                            [cursoOriginalEdicao.value, chaveDestino],
                            [...origemNorm, ...destinoNorm]
                        );
                    } else {
                        const baseDestino = itensDestinoAtual.map(item =>
                            item.id === data.id ? data : item
                        );
                        const destinoReposicionado = posicionarItemPorNumero(baseDestino, data.id, ordemDesejada);
                        const { listaNormalizada, alteracoes } = calcularNormalizacaoOrdem(destinoReposicionado);

                        if (alteracoes.length > 0) {
                            await persistirAlteracoesOrdem(alteracoes);
                        }

                        substituirGruposLocalmente([chaveDestino], listaNormalizada);
                    }

                    limparErroMiniatura(data.id);
                }

                toast.success('Sucesso', 'Apostila atualizada com sucesso!');
            } else {
                const { data, error } = await supabase
                    .from('apostila')
                    .insert([payload])
                    .select('id, curso_id, nome, ordem, miniatura_url, drive_url, mega_url, outro_url')
                    .single();

                if (error) throw error;

                if (data) {
                    const baseDestino = [...itensDestinoAtual, data];
                    const destinoReposicionado = posicionarItemPorNumero(baseDestino, data.id, ordemDesejada);
                    const { listaNormalizada, alteracoes } = calcularNormalizacaoOrdem(destinoReposicionado);

                    if (alteracoes.length > 0) {
                        await persistirAlteracoesOrdem(alteracoes);
                    }

                    substituirGruposLocalmente([chaveDestino], listaNormalizada);
                }

                toast.success('Sucesso', 'Apostila cadastrada com sucesso!');
            }

            modalFormularioAberto.value = false;
        } catch (err) {
            console.error('Erro ao salvar apostila:', err);
            toast.error('Erro', 'Não foi possível salvar a apostila.');
        } finally {
            salvando.value = false;
        }
    };

    const abrirModalExcluir = (apostila) => {
        apostilaParaExcluir.value = apostila;
        modalExcluirAberto.value = true;
    };

    const confirmarExclusao = async () => {
        if (!apostilaParaExcluir.value || excluindo.value) return;

        excluindo.value = true;
        try {
            const idRemovido = apostilaParaExcluir.value.id;
            const nomeRemovido = apostilaParaExcluir.value.nome;
            const chaveGrupo = getChaveCurso(apostilaParaExcluir.value.curso_id);

            const { error } = await supabase
                .from('apostila')
                .delete()
                .eq('id', idRemovido);

            if (error) throw error;

            const restantesGrupo = obterApostilasDoGrupo(chaveGrupo).filter(
                item => item.id !== idRemovido
            );
            const { listaNormalizada, alteracoes } = calcularNormalizacaoOrdem(restantesGrupo);

            if (alteracoes.length > 0) {
                await persistirAlteracoesOrdem(alteracoes);
            }

            substituirGruposLocalmente([chaveGrupo], listaNormalizada);

            toast.success('Excluída', `A apostila "${nomeRemovido}" foi removida.`);
            modalExcluirAberto.value = false;
            apostilaParaExcluir.value = null;
        } catch (err) {
            console.error('Erro ao excluir apostila:', err);
            toast.error('Erro', 'Não foi possível excluir a apostila.');
        } finally {
            excluindo.value = false;
        }
    };

    onMounted(() => {
        Promise.all([carregarCursos(), carregarApostilas()]);

        realtimeChannel = supabase
            .channel('aba_apostilas_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'apostila' },
                () => agendarRecarregamentoRealtime()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'curso' },
                () => carregarCursos()
            )
            .subscribe();
    });

    onUnmounted(() => {
        clearTimeout(realtimeTimer);
        if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel);
        }
    });
</script>

<template>
    <div class="space-y-6">
        <!-- Busca, Filtro por Curso e Cadastro -->
        <Card>
            <CardContent class="p-4 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 max-w-2xl">
                    <FormGroup label="Pesquisar Apostila" id="pesquisa-apostila">
                        <div class="relative">
                            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            <Input
                                v-model="termoPesquisa"
                                placeholder="Buscar por apostila ou curso..."
                                class="pl-9"
                            />
                        </div>
                    </FormGroup>

                    <FormGroup label="Filtrar por Curso" id="filtro-curso-apostila">
                        <Select
                            v-model="filtroCurso"
                            :options="opcoesFiltroCurso"
                        />
                    </FormGroup>
                </div>

                <Button
                    variant="default"
                    class="h-10 shrink-0"
                    @click="abrirModalNova"
                >
                    <Plus class="w-4 h-4 mr-1.5" />
                    Nova Apostila
                </Button>
            </CardContent>
        </Card>

        <!-- Lista Agrupada por Curso (Recolhida por Padrao) -->
        <Card class="min-h-[60dvh]">
            <div v-if="carregando" class="p-8 text-center text-muted-foreground">
                Carregando apostilas...
            </div>

            <div v-else-if="gruposApostilas.length === 0" class="p-8 text-center text-muted-foreground">
                {{
                    termoPesquisa || filtroCurso !== 'todos'
                        ? 'Nenhuma apostila encontrada para os filtros aplicados.'
                        : 'Nenhuma apostila cadastrada.'
                }}
            </div>

            <div v-else class="flex flex-col">
                <div
                    v-for="grupo in gruposApostilas"
                    :key="grupo.id"
                    class="border-b border-border last:border-0 flex flex-col transition-colors"
                    :class="{ 'bg-muted/30': isGrupoExpandido(grupo.id) }"
                >
                    <!-- Cabecalho Retratil do Grupo (Curso) -->
                    <div
                        class="flex items-center justify-between gap-3 p-3.5 md:p-4 cursor-pointer hover:bg-muted/60 transition-colors"
                        @click="toggleGrupoCurso(grupo.id)"
                    >
                        <div class="flex items-center gap-3 min-w-0">
                            <div
                                class="text-muted-foreground transition-transform duration-300 ease-in-out shrink-0"
                                :class="{ 'rotate-90 text-indigo-600 dark:text-indigo-400': isGrupoExpandido(grupo.id) }"
                            >
                                <ChevronRight class="w-5 h-5" />
                            </div>

                            <span
                                class="font-bold text-sm sm:text-base truncate"
                                :class="grupo.semCurso ? 'text-muted-foreground' : 'text-foreground'"
                            >
                                {{ grupo.nome }}
                            </span>

                            <Badge variant="secondary" class="text-[11px] px-2 py-0 shrink-0">
                                {{ grupo.itens.length }} {{ grupo.itens.length === 1 ? 'apostila' : 'apostilas' }}
                            </Badge>
                        </div>
                    </div>

                    <!-- Corpo Expansivel com as Apostilas do Curso -->
                    <div
                        class="grid transition-all duration-300 ease-in-out"
                        :class="isGrupoExpandido(grupo.id) ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'"
                    >
                        <div class="overflow-hidden">
                            <div class="border-t border-border bg-background">
                                <div class="hidden md:flex items-center gap-4 px-4 py-2.5 pl-12 border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                                    <div class="w-16 text-center">Ordem</div>
                                    <div class="flex-1">Nome da Apostila</div>
                                    <div class="w-16 text-center">Drive</div>
                                    <div class="w-16 text-center">Mega</div>
                                    <div class="w-16 text-center">Outro</div>
                                    <div class="w-16 text-center">Ações</div>
                                </div>

                                <div
                                    v-for="(item, index) in grupo.itens"
                                    :key="item.id"
                                    :draggable="podeReordenarGrupo(grupo)"
                                    class="border-b border-border last:border-0 flex items-center justify-between gap-2 md:gap-4 p-3 md:px-4 md:py-3 md:pl-12 hover:bg-muted/40 transition-colors"
                                    :class="[
                                        dragOrigem?.grupoId === grupo.id && dragOrigem?.index === index
                                            ? 'opacity-40 bg-muted/60'
                                            : '',
                                        dragAlvo?.grupoId === grupo.id &&
                                        dragAlvo?.index === index &&
                                        dragOrigem?.index !== index
                                            ? 'ring-2 ring-inset ring-indigo-500/60 bg-indigo-50/40 dark:bg-indigo-500/10'
                                            : ''
                                    ]"
                                    @dragstart="onDragStart(grupo, index, $event)"
                                    @dragover="onDragOver(grupo.id, index, $event)"
                                    @drop="onDrop(grupo.id, index, $event)"
                                    @dragend="onDragEnd"
                                >
                                    <!-- Controles de Ordem Compacto -->
                                    <div class="md:w-16 flex justify-center shrink-0">
                                        <ControleOrdem
                                            :ordem="item.ordem || index + 1"
                                            :desabilitado="!podeReordenarGrupo(grupo)"
                                            :pode-subir="index > 0"
                                            :pode-descer="index < grupo.itens.length - 1"
                                            :titulo-arrastar="termoPesquisa ? 'Limpe a busca para reordenar' : 'Arraste para reordenar neste curso'"
                                            @subir="moverApostila(grupo.id, index, -1)"
                                            @descer="moverApostila(grupo.id, index, 1)"
                                        />
                                    </div>

                                    <div class="flex items-center gap-3 flex-1 min-w-0">
                                        <div class="w-10 h-10 rounded-md border border-border bg-muted/50 overflow-hidden flex items-center justify-center shrink-0">
                                            <img
                                                v-if="item.miniatura_url && !miniaturasComErro.has(item.id)"
                                                :src="item.miniatura_url"
                                                :alt="item.nome"
                                                class="w-full h-full object-cover"
                                                loading="lazy"
                                                @error="marcarErroMiniatura(item.id)"
                                            />
                                            <ImageIcon v-else class="w-4 h-4 text-muted-foreground/50" />
                                        </div>

                                        <div class="flex flex-col flex-1 min-w-0">
                                            <span class="font-medium text-sm text-foreground leading-tight truncate">
                                                {{ item.nome }}
                                            </span>

                                            <div class="md:hidden flex flex-wrap items-center gap-1.5 mt-2">
                                                <BotaoCanalLink tipo="drive" :url="item.drive_url" mostrar-label />
                                                <BotaoCanalLink tipo="mega" :url="item.mega_url" mostrar-label />
                                                <BotaoCanalLink tipo="outro" :url="item.outro_url" mostrar-label />
                                            </div>
                                        </div>
                                    </div>

                                    <div class="hidden md:flex w-16 justify-center shrink-0">
                                        <BotaoCanalLink tipo="drive" :url="item.drive_url" />
                                    </div>

                                    <div class="hidden md:flex w-16 justify-center shrink-0">
                                        <BotaoCanalLink tipo="mega" :url="item.mega_url" />
                                    </div>

                                    <div class="hidden md:flex w-16 justify-center shrink-0">
                                        <BotaoCanalLink tipo="outro" :url="item.outro_url" />
                                    </div>

                                    <div class="w-auto md:w-16 flex justify-center shrink-0">
                                        <Dropdown align="right">
                                            <template #trigger>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    class="bg-background border border-border text-foreground hover:bg-muted px-2 rounded-md transition-colors shadow-sm"
                                                >
                                                    <Menu class="w-4 h-4" />
                                                </Button>
                                            </template>
                                            <template #content>
                                                <button
                                                    @click="abrirModalEdicao(item)"
                                                    class="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                                                >
                                                    <Pencil class="w-4 h-4" /> Editar Apostila
                                                </button>
                                                <hr class="my-1 border-border" />
                                                <button
                                                    @click="abrirModalExcluir(item)"
                                                    class="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                                >
                                                    <Trash2 class="w-4 h-4" /> Excluir Apostila
                                                </button>
                                            </template>
                                        </Dropdown>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Card>

        <!-- Modal: Cadastro e Edicao -->
        <Modal
            v-model="modalFormularioAberto"
            :title="editandoId ? 'Editar Apostila' : 'Nova Apostila'"
            size="md"
        >
            <div class="space-y-4 p-2">
                <FormGroup label="Curso" id="apo-curso">
                    <Select
                        :model-value="form.curso_id"
                        :options="opcoesCursoModal"
                        :disabled="salvando"
                        @update:model-value="aoTrocarCursoModal"
                    />
                </FormGroup>

                <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div class="sm:col-span-3">
                        <FormGroup label="Nome *" id="apo-nome">
                            <Input
                                v-model="form.nome"
                                placeholder="Ex: Módulo 1 - Introdução ao Excel"
                                :disabled="salvando"
                                @keyup.enter="salvarApostila"
                            />
                        </FormGroup>
                    </div>

                    <div class="sm:col-span-1">
                        <FormGroup label="Ordem" id="apo-ordem">
                            <Input
                                v-model="form.ordem"
                                type="number"
                                min="1"
                                :disabled="salvando"
                                @keyup.enter="salvarApostila"
                            />
                        </FormGroup>
                    </div>
                </div>

                <FormGroup label="Link da Miniatura (Opcional)" id="apo-miniatura">
                    <Input
                        v-model="form.miniatura_url"
                        type="url"
                        placeholder="https://.../capa.png"
                        :disabled="salvando"
                        @keyup.enter="salvarApostila"
                    />
                    <div
                        v-if="form.miniatura_url.trim()"
                        class="mt-2 flex items-center gap-3 rounded-md border border-border bg-muted/40 p-2"
                    >
                        <div class="w-12 h-12 rounded border border-border bg-background overflow-hidden flex items-center justify-center shrink-0">
                            <img
                                v-if="!erroPreviewMiniatura"
                                :src="form.miniatura_url.trim()"
                                alt="Prévia da miniatura"
                                class="w-full h-full object-cover"
                                @error="erroPreviewMiniatura = true"
                            />
                            <ImageIcon v-else class="w-4 h-4 text-muted-foreground" />
                        </div>
                        <p class="text-xs text-muted-foreground">
                            {{ erroPreviewMiniatura ? 'Não foi possível carregar esta imagem.' : 'Prévia da miniatura.' }}
                        </p>
                    </div>
                </FormGroup>

                <FormGroup label="Google Drive" id="apo-drive">
                    <Input
                        v-model="form.drive_url"
                        type="url"
                        placeholder="https://drive.google.com/..."
                        :disabled="salvando"
                        @keyup.enter="salvarApostila"
                    />
                </FormGroup>

                <FormGroup label="Mega" id="apo-mega">
                    <Input
                        v-model="form.mega_url"
                        type="url"
                        placeholder="https://mega.nz/..."
                        :disabled="salvando"
                        @keyup.enter="salvarApostila"
                    />
                </FormGroup>

                <FormGroup label="Outro Link" id="apo-outro">
                    <Input
                        v-model="form.outro_url"
                        type="url"
                        placeholder="https://..."
                        :disabled="salvando"
                        @keyup.enter="salvarApostila"
                    />
                </FormGroup>
            </div>

            <template #footer>
                <Button variant="ghost" @click="modalFormularioAberto = false" :disabled="salvando">
                    Cancelar
                </Button>
                <Button variant="default" @click="salvarApostila" :disabled="salvando">
                    <Loader2 v-if="salvando" class="w-4 h-4 mr-1.5 animate-spin" />
                    {{ salvando ? 'Salvando...' : (editandoId ? 'Salvar Alterações' : 'Cadastrar') }}
                </Button>
            </template>
        </Modal>

        <!-- Modal: Exclusao -->
        <Modal
            v-model="modalExcluirAberto"
            title="Excluir Apostila"
            size="sm"
        >
            <p v-if="apostilaParaExcluir" class="text-sm text-muted-foreground">
                Deseja remover <strong class="text-foreground">{{ apostilaParaExcluir.nome }}</strong>? Ela deixará de aparecer na área do aluno.
            </p>

            <template #footer>
                <Button variant="ghost" @click="modalExcluirAberto = false" :disabled="excluindo">
                    Cancelar
                </Button>
                <Button variant="destructive" @click="confirmarExclusao" :disabled="excluindo">
                    <Loader2 v-if="excluindo" class="w-4 h-4 mr-1.5 animate-spin" />
                    {{ excluindo ? 'Excluindo...' : 'Excluir' }}
                </Button>
            </template>
        </Modal>
    </div>
</template>