<script setup>
    import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
    import { supabase } from '@/lib/supabase';
    import { Plus, Search, Menu, Pencil, Trash2, Loader2, ChevronRight, Layers } from '@lucide/vue';
    import { toast } from '@/composables/useToast';

    import Card from '@/components/ui/Card.vue';
    import CardContent from '@/components/ui/CardContent.vue';
    import Button from '@/components/ui/Button.vue';
    import Input from '@/components/ui/Input.vue';
    import Select from '@/components/ui/Select.vue';
    import Badge from '@/components/ui/Badge.vue';
    import FormGroup from '@/components/ui/FormGroup.vue';
    import Dropdown from '@/components/ui/Dropdown.vue';
    import Modal from '@/components/ui/Modal.vue';

    import ModalGerenciarModulos from './ModalGerenciarModulos.vue';

    const emit = defineEmits(['update-total']);

    // Dados do banco
    const cursos = ref([]);
    const modulos = ref([]);
    const cursoModulos = ref([]);
    const dificuldades = ref([]);
    const atividades = ref([]);

    // Estados de interface
    const termoPesquisa = ref('');
    const filtroCurso = ref('todos');
    const carregando = ref(true);
    const salvando = ref(false);
    const excluindo = ref(false);
    const moduloExpandido = ref(null);
    let realtimeChannel = null;

    // Modal de modulos
    const modalModulosAberto = ref(false);

    // Modal de atividade
    const modalFormularioAberto = ref(false);
    const editandoId = ref(null);
    const form = ref({
        modulo_id: '',
        dificuldade_id: '',
        nome: '',
        drive_url: '',
        mega_url: '',
        outro_url: ''
    });

    // Modal de exclusao
    const modalExcluirAberto = ref(false);
    const atividadeParaExcluir = ref(null);

    watch(
        () => atividades.value.length,
        (total) => emit('update-total', total)
    );

    const opcoesFiltroCurso = computed(() => [
        { label: 'Todos os cursos', value: 'todos' },
        ...cursos.value.map(c => ({ label: c.nome, value: String(c.id) })),
        { label: 'Sem curso vinculado', value: 'sem_curso' }
    ]);

    const opcoesModuloModal = computed(() => [
        { label: 'Sem módulo vinculado', value: '' },
        ...modulos.value.map(m => ({ label: m.nome, value: String(m.id) }))
    ]);

    const opcoesDificuldadeModal = computed(() =>
        dificuldades.value.map(d => ({
            label: `${d.nome} (${d.pontos} pts)`,
            value: String(d.id)
        }))
    );

    const mapaDificuldades = computed(() => {
        return new Map(dificuldades.value.map(d => [d.id, d]));
    });

    const mapaCursosPorModulo = computed(() => {
        const mapaCursos = new Map(cursos.value.map(c => [c.id, c]));
        const resultado = new Map();

        cursoModulos.value.forEach(rel => {
            const curso = mapaCursos.get(rel.curso_id);
            if (!curso) return;

            if (!resultado.has(rel.modulo_id)) {
                resultado.set(rel.modulo_id, []);
            }
            resultado.get(rel.modulo_id).push(curso);
        });

        resultado.forEach(lista => {
            lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        });

        return resultado;
    });

    // Agrupamento de atividades por modulo (respeitando busca e filtro por curso)
    const gruposModulos = computed(() => {
        const termo = termoPesquisa.value.toLowerCase().trim();
        const atividadesPorModulo = new Map();
        const semModuloItens = [];

        atividades.value.forEach(item => {
            if (!item.modulo_id) {
                semModuloItens.push(item);
                return;
            }
            if (!atividadesPorModulo.has(item.modulo_id)) {
                atividadesPorModulo.set(item.modulo_id, []);
            }
            atividadesPorModulo.get(item.modulo_id).push(item);
        });

        const listaGrupos = [];

        modulos.value.forEach(mod => {
            const cursosDoModulo = mapaCursosPorModulo.value.get(mod.id) || [];

            if (filtroCurso.value === 'sem_curso' && cursosDoModulo.length > 0) {
                return;
            }
            if (
                filtroCurso.value !== 'todos' &&
                filtroCurso.value !== 'sem_curso' &&
                !cursosDoModulo.some(c => String(c.id) === filtroCurso.value)
            ) {
                return;
            }

            const itensModulo = atividadesPorModulo.get(mod.id) || [];
            const correspondeModuloOuCurso =
                !termo ||
                mod.nome.toLowerCase().includes(termo) ||
                cursosDoModulo.some(c => c.nome.toLowerCase().includes(termo));

            const itensFiltrados = correspondeModuloOuCurso
                ? [...itensModulo]
                : itensModulo.filter(item => item.nome.toLowerCase().includes(termo));

            if (termo && !correspondeModuloOuCurso && itensFiltrados.length === 0) {
                return;
            }

            itensFiltrados.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

            listaGrupos.push({
                id: String(mod.id),
                nome: mod.nome,
                semModulo: false,
                cursos: cursosDoModulo,
                itens: itensFiltrados
            });
        });

        listaGrupos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

        // Inclui grupo "Sem modulo vinculado" apenas quando houver atividades soltas
        if (
            semModuloItens.length > 0 &&
            (filtroCurso.value === 'todos' || filtroCurso.value === 'sem_curso')
        ) {
            const itensSoltos = termo
                ? semModuloItens.filter(item => item.nome.toLowerCase().includes(termo))
                : [...semModuloItens];

            if (itensSoltos.length > 0) {
                itensSoltos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
                listaGrupos.push({
                    id: 'sem_modulo',
                    nome: 'Sem módulo vinculado',
                    semModulo: true,
                    cursos: [],
                    itens: itensSoltos
                });
            }
        }

        return listaGrupos;
    });

    const isGrupoExpandido = (grupoId) => {
        if (termoPesquisa.value.trim() || filtroCurso.value !== 'todos') {
            return true;
        }
        return moduloExpandido.value === grupoId;
    };

    const toggleGrupoModulo = (grupoId) => {
        moduloExpandido.value = moduloExpandido.value === grupoId ? null : grupoId;
    };

    const getBadgeDificuldade = (dificuldadeId) => {
        const dif = mapaDificuldades.value.get(dificuldadeId);
        if (!dif) {
            return { texto: '---', variant: 'secondary' };
        }

        const variantesPorOrdem = {
            1: 'success',
            2: 'info',
            3: 'warning',
            4: 'destructive'
        };

        return {
            texto: `${dif.nome} • ${dif.pontos} pts`,
            variant: variantesPorOrdem[dif.ordem] || 'secondary'
        };
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

    // ========================================================
    // CARREGAMENTO DE DADOS
    // ========================================================

    const carregarCursos = async () => {
        const { data, error } = await supabase
            .from('curso')
            .select('id, nome')
            .order('nome', { ascending: true });

        if (error) throw error;
        cursos.value = data || [];
    };

    const carregarModulos = async () => {
        const [resModulos, resRel] = await Promise.all([
            supabase
                .from('modulo')
                .select('id, nome')
                .order('nome', { ascending: true }),
            supabase
                .from('curso_modulo')
                .select('curso_id, modulo_id')
        ]);

        if (resModulos.error) throw resModulos.error;
        if (resRel.error) throw resRel.error;

        modulos.value = resModulos.data || [];
        cursoModulos.value = resRel.data || [];
    };

    const carregarDificuldades = async () => {
        const { data, error } = await supabase
            .from('dificuldade_atividade')
            .select('id, nome, pontos, ordem')
            .order('ordem', { ascending: true });

        if (error) throw error;
        dificuldades.value = data || [];
    };

    const carregarAtividades = async () => {
        const { data, error } = await supabase
            .from('atividade')
            .select('id, modulo_id, dificuldade_id, nome, drive_url, mega_url, outro_url')
            .order('nome', { ascending: true });

        if (error) throw error;
        atividades.value = data || [];
        emit('update-total', atividades.value.length);
    };

    const carregarTudo = async (silencioso = false) => {
        if (!silencioso) carregando.value = true;

        try {
            await Promise.all([
                carregarCursos(),
                carregarModulos(),
                carregarDificuldades(),
                carregarAtividades()
            ]);
        } catch (err) {
            console.error('Erro ao carregar dados de atividades:', err);
            toast.error('Erro', 'Não foi possível carregar os dados das atividades.');
        } finally {
            if (!silencioso) carregando.value = false;
        }
    };

    // ========================================================
    // CRUD: ATIVIDADES
    // ========================================================

    const abrirModalNova = () => {
        editandoId.value = null;
        form.value = {
            modulo_id: moduloExpandido.value && moduloExpandido.value !== 'sem_modulo' ? moduloExpandido.value : '',
            dificuldade_id: '',
            nome: '',
            drive_url: '',
            mega_url: '',
            outro_url: ''
        };
        modalFormularioAberto.value = true;
    };

    const abrirModalEdicao = (atividade) => {
        editandoId.value = atividade.id;
        form.value = {
            modulo_id: atividade.modulo_id ? String(atividade.modulo_id) : '',
            dificuldade_id: atividade.dificuldade_id ? String(atividade.dificuldade_id) : '',
            nome: atividade.nome || '',
            drive_url: atividade.drive_url || '',
            mega_url: atividade.mega_url || '',
            outro_url: atividade.outro_url || ''
        };
        modalFormularioAberto.value = true;
    };

    const salvarAtividade = async () => {
        if (salvando.value) return;

        const nomeLimpo = form.value.nome.trim();
        const driveLimpo = form.value.drive_url.trim();
        const megaLimpo = form.value.mega_url.trim();
        const outroLimpo = form.value.outro_url.trim();
        const moduloIdFinal = form.value.modulo_id ? Number(form.value.modulo_id) : null;
        const dificuldadeIdFinal = form.value.dificuldade_id ? Number(form.value.dificuldade_id) : null;

        if (!nomeLimpo) {
            toast.error('Atenção', 'Informe o nome da atividade.');
            return;
        }

        if (!dificuldadeIdFinal) {
            toast.error('Atenção', 'Selecione a dificuldade da atividade.');
            return;
        }

        if (!driveLimpo && !megaLimpo && !outroLimpo) {
            toast.error('Atenção', 'Informe ao menos um link para o PDF.');
            return;
        }

        if (!validarUrl(driveLimpo) || !validarUrl(megaLimpo) || !validarUrl(outroLimpo)) {
            toast.error('Link inválido', 'Use URLs válidas iniciadas com http:// ou https://.');
            return;
        }

        const payload = {
            modulo_id: moduloIdFinal,
            dificuldade_id: dificuldadeIdFinal,
            nome: nomeLimpo,
            drive_url: driveLimpo || null,
            mega_url: megaLimpo || null,
            outro_url: outroLimpo || null
        };

        salvando.value = true;
        try {
            if (editandoId.value) {
                const { data, error } = await supabase
                    .from('atividade')
                    .update({
                        ...payload,
                        atualizado_em: new Date().toISOString()
                    })
                    .eq('id', editandoId.value)
                    .select('id, modulo_id, dificuldade_id, nome, drive_url, mega_url, outro_url')
                    .single();

                if (error) throw error;

                const index = atividades.value.findIndex(item => item.id === editandoId.value);
                if (index !== -1 && data) {
                    atividades.value[index] = data;
                }

                toast.success('Sucesso', 'Atividade atualizada com sucesso!');
            } else {
                const { data, error } = await supabase
                    .from('atividade')
                    .insert([payload])
                    .select('id, modulo_id, dificuldade_id, nome, drive_url, mega_url, outro_url')
                    .single();

                if (error) throw error;

                if (data) {
                    atividades.value.push(data);
                }

                toast.success('Sucesso', 'Atividade cadastrada com sucesso!');
            }

            modalFormularioAberto.value = false;
        } catch (err) {
            console.error('Erro ao salvar atividade:', err);
            toast.error('Erro', 'Não foi possível salvar a atividade.');
        } finally {
            salvando.value = false;
        }
    };

    const abrirModalExcluir = (atividade) => {
        atividadeParaExcluir.value = atividade;
        modalExcluirAberto.value = true;
    };

    const confirmarExclusao = async () => {
        if (!atividadeParaExcluir.value || excluindo.value) return;

        excluindo.value = true;
        try {
            const { error } = await supabase
                .from('atividade')
                .delete()
                .eq('id', atividadeParaExcluir.value.id);

            if (error) throw error;

            const nomeRemovido = atividadeParaExcluir.value.nome;
            atividades.value = atividades.value.filter(
                item => item.id !== atividadeParaExcluir.value.id
            );

            toast.success('Excluída', `A atividade "${nomeRemovido}" foi removida.`);
            modalExcluirAberto.value = false;
            atividadeParaExcluir.value = null;
        } catch (err) {
            console.error('Erro ao excluir atividade:', err);
            toast.error('Erro', 'Não foi possível excluir a atividade.');
        } finally {
            excluindo.value = false;
        }
    };

    onMounted(() => {
        carregarTudo();

        realtimeChannel = supabase
            .channel('aba_atividades_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'atividade' },
                () => carregarAtividades().catch(err => console.error(err))
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'modulo' },
                () => carregarModulos().catch(err => console.error(err))
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'curso_modulo' },
                () => carregarModulos().catch(err => console.error(err))
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'curso' },
                () => carregarCursos().catch(err => console.error(err))
            )
            .subscribe();
    });

    onUnmounted(() => {
        if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel);
        }
    });
</script>

<template>
    <div class="space-y-6">
        <!-- Busca, Filtro por Curso e Acoes -->
        <Card>
            <CardContent class="p-4 flex flex-col xl:flex-row xl:items-end justify-between gap-4">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 max-w-2xl">
                    <FormGroup label="Pesquisar Atividade" id="pesquisa-atividade">
                        <div class="relative">
                            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            <Input
                                v-model="termoPesquisa"
                                placeholder="Buscar por atividade, módulo ou curso..."
                                class="pl-9"
                            />
                        </div>
                    </FormGroup>

                    <FormGroup label="Filtrar por Curso" id="filtro-curso-atividade">
                        <Select
                            v-model="filtroCurso"
                            :options="opcoesFiltroCurso"
                        />
                    </FormGroup>
                </div>

                <div class="flex flex-wrap items-center justify-end gap-2 shrink-0">
                    <Button
                        variant="outline"
                        class="h-10 shrink-0 bg-background text-foreground border-border hover:bg-muted"
                        @click="modalModulosAberto = true"
                    >
                        <Layers class="w-4 h-4 mr-1.5" />
                        Gerenciar Módulos
                    </Button>

                    <Button
                        variant="default"
                        class="h-10 shrink-0"
                        @click="abrirModalNova"
                    >
                        <Plus class="w-4 h-4 mr-1.5" />
                        Nova Atividade
                    </Button>
                </div>
            </CardContent>
        </Card>

        <!-- Lista Agrupada por Modulo (Recolhida por Padrao) -->
        <Card class="min-h-[60dvh]">
            <div v-if="carregando" class="p-8 text-center text-muted-foreground">
                Carregando atividades...
            </div>

            <div v-else-if="gruposModulos.length === 0" class="p-8 text-center text-muted-foreground">
                {{
                    termoPesquisa || filtroCurso !== 'todos'
                        ? 'Nenhum módulo ou atividade encontrada para os filtros aplicados.'
                        : 'Nenhum módulo ou atividade cadastrada. Comece criando um módulo ou uma nova atividade.'
                }}
            </div>

            <div v-else class="flex flex-col">
                <div
                    v-for="grupo in gruposModulos"
                    :key="grupo.id"
                    class="border-b border-border last:border-0 flex flex-col transition-colors"
                    :class="{ 'bg-muted/30': isGrupoExpandido(grupo.id) }"
                >
                    <!-- Cabecalho Retratil do Modulo -->
                    <div
                        class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 md:p-4 cursor-pointer hover:bg-muted/60 transition-colors"
                        @click="toggleGrupoModulo(grupo.id)"
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
                                :class="grupo.semModulo ? 'text-muted-foreground' : 'text-foreground'"
                            >
                                {{ grupo.nome }}
                            </span>

                            <Badge variant="secondary" class="text-[11px] px-2 py-0 shrink-0">
                                {{ grupo.itens.length }} {{ grupo.itens.length === 1 ? 'atividade' : 'atividades' }}
                            </Badge>
                        </div>

                        <!-- Cursos vinculados ao modulo -->
                        <div
                            v-if="!grupo.semModulo"
                            class="flex flex-wrap items-center gap-1.5 pl-8 sm:pl-0"
                        >
                            <template v-if="grupo.cursos.length > 0">
                                <Badge
                                    v-for="curso in grupo.cursos"
                                    :key="curso.id"
                                    variant="outline"
                                    class="text-[10px] px-2 py-0"
                                >
                                    {{ curso.nome }}
                                </Badge>
                            </template>
                            <span v-else class="text-xs text-muted-foreground">
                                Sem cursos vinculados
                            </span>
                        </div>
                    </div>

                    <!-- Corpo Expansivel com as Atividades do Modulo -->
                    <div
                        class="grid transition-all duration-300 ease-in-out"
                        :class="isGrupoExpandido(grupo.id) ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'"
                    >
                        <div class="overflow-hidden">
                            <div class="border-t border-border bg-background">
                                <div
                                    v-if="grupo.itens.length === 0"
                                    class="px-4 py-6 md:pl-12 text-sm text-muted-foreground"
                                >
                                    Nenhuma atividade cadastrada neste módulo.
                                </div>

                                <template v-else>
                                    <div class="hidden md:flex items-center gap-4 px-4 py-2.5 pl-12 border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                                        <div class="flex-1">Nome da Atividade</div>
                                        <div class="w-36 text-center">Dificuldade</div>
                                        <div class="w-24 text-center">Drive</div>
                                        <div class="w-24 text-center">Mega</div>
                                        <div class="w-24 text-center">Outro</div>
                                        <div class="w-16 text-center">Ações</div>
                                    </div>

                                    <div
                                        v-for="item in grupo.itens"
                                        :key="item.id"
                                        class="border-b border-border last:border-0 flex items-center justify-between gap-2 md:gap-4 p-3 md:px-4 md:py-3 md:pl-12 hover:bg-muted/40 transition-colors"
                                    >
                                        <div class="flex flex-col flex-1 min-w-0">
                                            <span class="font-medium text-sm text-foreground leading-tight truncate">
                                                {{ item.nome }}
                                            </span>

                                            <div class="md:hidden flex flex-wrap items-center gap-1.5 mt-2">
                                                <Badge
                                                    :variant="getBadgeDificuldade(item.dificuldade_id).variant"
                                                    class="text-[10px] px-2 py-0"
                                                >
                                                    {{ getBadgeDificuldade(item.dificuldade_id).texto }}
                                                </Badge>

                                                <a
                                                    v-if="item.drive_url"
                                                    :href="item.drive_url"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    class="inline-flex items-center rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                                                >
                                                    Drive
                                                </a>
                                                <a
                                                    v-if="item.mega_url"
                                                    :href="item.mega_url"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    class="inline-flex items-center rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                                                >
                                                    Mega
                                                </a>
                                                <a
                                                    v-if="item.outro_url"
                                                    :href="item.outro_url"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    class="inline-flex items-center rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                                                >
                                                    Outro
                                                </a>
                                            </div>
                                        </div>

                                        <div class="hidden md:flex w-36 justify-center shrink-0">
                                            <Badge
                                                :variant="getBadgeDificuldade(item.dificuldade_id).variant"
                                                class="text-[11px] whitespace-nowrap"
                                            >
                                                {{ getBadgeDificuldade(item.dificuldade_id).texto }}
                                            </Badge>
                                        </div>

                                        <div class="hidden md:flex w-24 justify-center shrink-0">
                                            <a
                                                v-if="item.drive_url"
                                                :href="item.drive_url"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                class="inline-flex items-center justify-center rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-xs"
                                            >
                                                Abrir
                                            </a>
                                            <span v-else class="text-sm text-muted-foreground/50">—</span>
                                        </div>

                                        <div class="hidden md:flex w-24 justify-center shrink-0">
                                            <a
                                                v-if="item.mega_url"
                                                :href="item.mega_url"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                class="inline-flex items-center justify-center rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-xs"
                                            >
                                                Abrir
                                            </a>
                                            <span v-else class="text-sm text-muted-foreground/50">—</span>
                                        </div>

                                        <div class="hidden md:flex w-24 justify-center shrink-0">
                                            <a
                                                v-if="item.outro_url"
                                                :href="item.outro_url"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                class="inline-flex items-center justify-center rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-xs"
                                            >
                                                Abrir
                                            </a>
                                            <span v-else class="text-sm text-muted-foreground/50">—</span>
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
                                                        <Pencil class="w-4 h-4" /> Editar Atividade
                                                    </button>
                                                    <hr class="my-1 border-border" />
                                                    <button
                                                        @click="abrirModalExcluir(item)"
                                                        class="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                                    >
                                                        <Trash2 class="w-4 h-4" /> Excluir Atividade
                                                    </button>
                                                </template>
                                            </Dropdown>
                                        </div>
                                    </div>
                                </template>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Card>

        <!-- Modal: Gerenciar Modulos -->
        <ModalGerenciarModulos
            v-model="modalModulosAberto"
            :cursos="cursos"
            :modulos="modulos"
            :curso-modulos="cursoModulos"
            @atualizado="carregarModulos"
        />

        <!-- Modal: Cadastro e Edicao de Atividade -->
        <Modal
            v-model="modalFormularioAberto"
            :title="editandoId ? 'Editar Atividade' : 'Nova Atividade'"
            size="md"
        >
            <div class="space-y-4 p-2">
                <FormGroup label="Módulo" id="ati-modulo">
                    <Select
                        v-model="form.modulo_id"
                        :options="opcoesModuloModal"
                        :disabled="salvando"
                    />
                </FormGroup>

                <FormGroup label="Dificuldade *" id="ati-dificuldade">
                    <Select
                        v-model="form.dificuldade_id"
                        :options="opcoesDificuldadeModal"
                        placeholder="Selecione a dificuldade..."
                        :disabled="salvando"
                    />
                </FormGroup>

                <FormGroup label="Nome da Atividade *" id="ati-nome">
                    <Input
                        v-model="form.nome"
                        placeholder="Ex: Atividade 01 - Planilha de Controle"
                        :disabled="salvando"
                        @keyup.enter="salvarAtividade"
                    />
                </FormGroup>

                <FormGroup label="Google Drive (PDF)" id="ati-drive">
                    <Input
                        v-model="form.drive_url"
                        type="url"
                        placeholder="https://drive.google.com/..."
                        :disabled="salvando"
                        @keyup.enter="salvarAtividade"
                    />
                </FormGroup>

                <FormGroup label="Mega (PDF)" id="ati-mega">
                    <Input
                        v-model="form.mega_url"
                        type="url"
                        placeholder="https://mega.nz/..."
                        :disabled="salvando"
                        @keyup.enter="salvarAtividade"
                    />
                </FormGroup>

                <FormGroup label="Outro Link (PDF)" id="ati-outro">
                    <Input
                        v-model="form.outro_url"
                        type="url"
                        placeholder="https://..."
                        :disabled="salvando"
                        @keyup.enter="salvarAtividade"
                    />
                </FormGroup>
            </div>

            <template #footer>
                <Button variant="ghost" @click="modalFormularioAberto = false" :disabled="salvando">
                    Cancelar
                </Button>
                <Button variant="default" @click="salvarAtividade" :disabled="salvando">
                    <Loader2 v-if="salvando" class="w-4 h-4 mr-1.5 animate-spin" />
                    {{ salvando ? 'Salvando...' : (editandoId ? 'Salvar Alterações' : 'Cadastrar') }}
                </Button>
            </template>
        </Modal>

        <!-- Modal: Exclusao de Atividade -->
        <Modal
            v-model="modalExcluirAberto"
            title="Excluir Atividade"
            size="sm"
        >
            <p v-if="atividadeParaExcluir" class="text-sm text-muted-foreground">
                Deseja remover <strong class="text-foreground">{{ atividadeParaExcluir.nome }}</strong>? Ela deixará de aparecer na área do aluno.
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