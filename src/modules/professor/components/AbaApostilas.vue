<script setup>
    import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
    import { supabase } from '@/lib/supabase';
    import { Plus, Search, Menu, Pencil, Trash2, Loader2, ChevronRight, Image as ImageIcon } from '@lucide/vue';
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

    const emit = defineEmits(['update-total']);

    const cursos = ref([]);
    const apostilas = ref([]);
    const termoPesquisa = ref('');
    const filtroCurso = ref('todos');
    const carregando = ref(true);
    const salvando = ref(false);
    const excluindo = ref(false);
    const cursoExpandido = ref(null);
    const miniaturasComErro = ref(new Set());
    let realtimeChannel = null;

    const modalFormularioAberto = ref(false);
    const editandoId = ref(null);
    const erroPreviewMiniatura = ref(false);
    const form = ref({
        curso_id: '',
        nome: '',
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
            const chaveCurso = item.curso_id ? String(item.curso_id) : 'sem_curso';
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
            grupo.itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
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
                .select('id, curso_id, nome, miniatura_url, drive_url, mega_url, outro_url')
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

    const abrirModalNova = () => {
        editandoId.value = null;
        erroPreviewMiniatura.value = false;
        form.value = {
            curso_id: filtroCurso.value !== 'todos' && filtroCurso.value !== 'sem_curso' ? filtroCurso.value : '',
            nome: '',
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
        form.value = {
            curso_id: apostila.curso_id ? String(apostila.curso_id) : '',
            nome: apostila.nome || '',
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
                    .select('id, curso_id, nome, miniatura_url, drive_url, mega_url, outro_url')
                    .single();

                if (error) throw error;

                const index = apostilas.value.findIndex(item => item.id === editandoId.value);
                if (index !== -1 && data) {
                    apostilas.value[index] = data;
                    limparErroMiniatura(data.id);
                }

                toast.success('Sucesso', 'Apostila atualizada com sucesso!');
            } else {
                const { data, error } = await supabase
                    .from('apostila')
                    .insert([payload])
                    .select('id, curso_id, nome, miniatura_url, drive_url, mega_url, outro_url')
                    .single();

                if (error) throw error;

                if (data) {
                    apostilas.value.push(data);
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
            const { error } = await supabase
                .from('apostila')
                .delete()
                .eq('id', apostilaParaExcluir.value.id);

            if (error) throw error;

            const nomeRemovido = apostilaParaExcluir.value.nome;
            apostilas.value = apostilas.value.filter(
                item => item.id !== apostilaParaExcluir.value.id
            );

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
                () => carregarApostilas(true)
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'curso' },
                () => carregarCursos()
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
                                    <div class="flex-1">Nome da Apostila</div>
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
                        v-model="form.curso_id"
                        :options="opcoesCursoModal"
                        :disabled="salvando"
                    />
                </FormGroup>

                <FormGroup label="Nome *" id="apo-nome">
                    <Input
                        v-model="form.nome"
                        placeholder="Ex: Módulo 1 - Introdução ao Excel"
                        :disabled="salvando"
                        @keyup.enter="salvarApostila"
                    />
                </FormGroup>

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