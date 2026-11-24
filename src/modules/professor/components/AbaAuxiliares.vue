<script setup>
    import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
    import { supabase } from '@/lib/supabase';
    import { Plus, Search, Menu, Pencil, Trash2, Loader2, Image as ImageIcon } from '@lucide/vue';
    import { toast } from '@/composables/useToast';

    import Card from '@/components/ui/Card.vue';
    import CardContent from '@/components/ui/CardContent.vue';
    import Button from '@/components/ui/Button.vue';
    import Input from '@/components/ui/Input.vue';
    import FormGroup from '@/components/ui/FormGroup.vue';
    import Dropdown from '@/components/ui/Dropdown.vue';
    import Modal from '@/components/ui/Modal.vue';

    const emit = defineEmits(['update-total']);

    const termoPesquisa = ref('');
    const carregando = ref(true);
    const salvando = ref(false);
    const excluindo = ref(false);
    const arquivosAuxiliares = ref([]);
    const miniaturasComErro = ref(new Set());
    let realtimeChannel = null;

    const modalFormularioAberto = ref(false);
    const editandoId = ref(null);
    const erroPreviewMiniatura = ref(false);
    const form = ref({
        nome: '',
        miniatura_url: '',
        drive_url: '',
        mega_url: '',
        outro_url: ''
    });

    const modalExcluirAberto = ref(false);
    const arquivoParaExcluir = ref(null);

    watch(
        () => arquivosAuxiliares.value.length,
        (total) => emit('update-total', total)
    );

    watch(
        () => form.value.miniatura_url,
        () => {
            erroPreviewMiniatura.value = false;
        }
    );

    const arquivosFiltrados = computed(() => {
        const termo = termoPesquisa.value.toLowerCase().trim();

        return arquivosAuxiliares.value
            .filter(item => !termo || item.nome.toLowerCase().includes(termo))
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    });

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

    const carregarArquivos = async (silencioso = false) => {
        if (!silencioso) carregando.value = true;

        try {
            const { data, error } = await supabase
                .from('arquivo_auxiliar')
                .select('id, nome, miniatura_url, drive_url, mega_url, outro_url')
                .order('nome', { ascending: true });

            if (error) throw error;
            arquivosAuxiliares.value = data || [];
            miniaturasComErro.value = new Set();
            emit('update-total', arquivosAuxiliares.value.length);
        } catch (err) {
            console.error('Erro ao carregar arquivos auxiliares:', err);
            toast.error('Erro', 'Não foi possível carregar os arquivos auxiliares.');
        } finally {
            if (!silencioso) carregando.value = false;
        }
    };

    const abrirModalNovo = () => {
        editandoId.value = null;
        erroPreviewMiniatura.value = false;
        form.value = {
            nome: '',
            miniatura_url: '',
            drive_url: '',
            mega_url: '',
            outro_url: ''
        };
        modalFormularioAberto.value = true;
    };

    const abrirModalEdicao = (arquivo) => {
        editandoId.value = arquivo.id;
        erroPreviewMiniatura.value = false;
        form.value = {
            nome: arquivo.nome || '',
            miniatura_url: arquivo.miniatura_url || '',
            drive_url: arquivo.drive_url || '',
            mega_url: arquivo.mega_url || '',
            outro_url: arquivo.outro_url || ''
        };
        modalFormularioAberto.value = true;
    };

    const salvarArquivo = async () => {
        if (salvando.value) return;

        const nomeLimpo = form.value.nome.trim();
        const miniaturaLimpa = form.value.miniatura_url.trim();
        const driveLimpo = form.value.drive_url.trim();
        const megaLimpo = form.value.mega_url.trim();
        const outroLimpo = form.value.outro_url.trim();

        if (!nomeLimpo) {
            toast.error('Atenção', 'Informe o nome do arquivo auxiliar.');
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
                    .from('arquivo_auxiliar')
                    .update(payload)
                    .eq('id', editandoId.value)
                    .select('id, nome, miniatura_url, drive_url, mega_url, outro_url')
                    .single();

                if (error) {
                    if (error.code === '23505') {
                        toast.error('Nome em uso', 'Já existe um arquivo cadastrado com este nome.');
                        return;
                    }
                    throw error;
                }

                const index = arquivosAuxiliares.value.findIndex(item => item.id === editandoId.value);
                if (index !== -1 && data) {
                    arquivosAuxiliares.value[index] = data;
                    limparErroMiniatura(data.id);
                }

                toast.success('Sucesso', 'Arquivo auxiliar atualizado com sucesso!');
            } else {
                const { data, error } = await supabase
                    .from('arquivo_auxiliar')
                    .insert([payload])
                    .select('id, nome, miniatura_url, drive_url, mega_url, outro_url')
                    .single();

                if (error) {
                    if (error.code === '23505') {
                        toast.error('Nome em uso', 'Já existe um arquivo cadastrado com este nome.');
                        return;
                    }
                    throw error;
                }

                if (data) {
                    arquivosAuxiliares.value.push(data);
                }

                toast.success('Sucesso', 'Arquivo auxiliar cadastrado com sucesso!');
            }

            modalFormularioAberto.value = false;
        } catch (err) {
            console.error('Erro ao salvar arquivo auxiliar:', err);
            toast.error('Erro', 'Não foi possível salvar o arquivo auxiliar.');
        } finally {
            salvando.value = false;
        }
    };

    const abrirModalExcluir = (arquivo) => {
        arquivoParaExcluir.value = arquivo;
        modalExcluirAberto.value = true;
    };

    const confirmarExclusao = async () => {
        if (!arquivoParaExcluir.value || excluindo.value) return;

        excluindo.value = true;
        try {
            const { error } = await supabase
                .from('arquivo_auxiliar')
                .delete()
                .eq('id', arquivoParaExcluir.value.id);

            if (error) throw error;

            const nomeRemovido = arquivoParaExcluir.value.nome;
            arquivosAuxiliares.value = arquivosAuxiliares.value.filter(
                item => item.id !== arquivoParaExcluir.value.id
            );

            toast.success('Excluído', `O arquivo "${nomeRemovido}" foi removido.`);
            modalExcluirAberto.value = false;
            arquivoParaExcluir.value = null;
        } catch (err) {
            console.error('Erro ao excluir arquivo auxiliar:', err);
            toast.error('Erro', 'Não foi possível excluir o arquivo auxiliar.');
        } finally {
            excluindo.value = false;
        }
    };

    onMounted(() => {
        carregarArquivos();

        realtimeChannel = supabase
            .channel('aba_auxiliares_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'arquivo_auxiliar' },
                () => carregarArquivos(true)
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
        <!-- Busca e Cadastro -->
        <Card>
            <CardContent class="p-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div class="w-full sm:max-w-md">
                    <FormGroup label="Pesquisar Arquivo" id="pesquisa-auxiliar">
                        <div class="relative">
                            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            <Input
                                v-model="termoPesquisa"
                                placeholder="Buscar pelo nome do arquivo..."
                                class="pl-9"
                            />
                        </div>
                    </FormGroup>
                </div>

                <Button
                    variant="default"
                    class="h-10 shrink-0"
                    @click="abrirModalNovo"
                >
                    <Plus class="w-4 h-4 mr-1.5" />
                    Novo Arquivo
                </Button>
            </CardContent>
        </Card>

        <!-- Lista de Arquivos Auxiliares -->
        <Card class="min-h-[60dvh]">
            <div v-if="carregando" class="p-8 text-center text-muted-foreground">
                Carregando arquivos auxiliares...
            </div>

            <div v-else-if="arquivosFiltrados.length === 0" class="p-8 text-center text-muted-foreground">
                {{ termoPesquisa ? 'Nenhum arquivo encontrado.' : 'Nenhum arquivo auxiliar cadastrado.' }}
            </div>

            <div v-else class="flex flex-col">
                <div class="hidden md:flex items-center gap-4 p-4 border-b border-border bg-muted/50 text-sm font-semibold text-muted-foreground">
                    <div class="flex-1">Nome do Arquivo</div>
                    <div class="w-24 text-center">Drive</div>
                    <div class="w-24 text-center">Mega</div>
                    <div class="w-24 text-center">Outro</div>
                    <div class="w-16 text-center">Ações</div>
                </div>

                <div
                    v-for="item in arquivosFiltrados"
                    :key="item.id"
                    class="border-b border-border last:border-0 flex items-center justify-between gap-2 md:gap-4 p-3 md:p-4 hover:bg-muted/50 transition-colors"
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
                            <span class="font-bold text-foreground leading-tight truncate">
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
                                    <Pencil class="w-4 h-4" /> Editar Arquivo
                                </button>
                                <hr class="my-1 border-border" />
                                <button
                                    @click="abrirModalExcluir(item)"
                                    class="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                >
                                    <Trash2 class="w-4 h-4" /> Excluir Arquivo
                                </button>
                            </template>
                        </Dropdown>
                    </div>
                </div>
            </div>
        </Card>

        <!-- Modal: Cadastro e Edicao -->
        <Modal
            v-model="modalFormularioAberto"
            :title="editandoId ? 'Editar Arquivo Auxiliar' : 'Novo Arquivo Auxiliar'"
            size="md"
        >
            <div class="space-y-4 p-2">
                <FormGroup label="Nome *" id="aux-nome">
                    <Input
                        v-model="form.nome"
                        placeholder="Ex: Planilhas Práticas - Excel"
                        :disabled="salvando"
                        @keyup.enter="salvarArquivo"
                    />
                </FormGroup>

                <FormGroup label="Link da Miniatura (Opcional)" id="aux-miniatura">
                    <Input
                        v-model="form.miniatura_url"
                        type="url"
                        placeholder="https://.../capa.png"
                        :disabled="salvando"
                        @keyup.enter="salvarArquivo"
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

                <FormGroup label="Google Drive" id="aux-drive">
                    <Input
                        v-model="form.drive_url"
                        type="url"
                        placeholder="https://drive.google.com/..."
                        :disabled="salvando"
                        @keyup.enter="salvarArquivo"
                    />
                </FormGroup>

                <FormGroup label="Mega" id="aux-mega">
                    <Input
                        v-model="form.mega_url"
                        type="url"
                        placeholder="https://mega.nz/..."
                        :disabled="salvando"
                        @keyup.enter="salvarArquivo"
                    />
                </FormGroup>

                <FormGroup label="Outro Link" id="aux-outro">
                    <Input
                        v-model="form.outro_url"
                        type="url"
                        placeholder="https://..."
                        :disabled="salvando"
                        @keyup.enter="salvarArquivo"
                    />
                </FormGroup>
            </div>

            <template #footer>
                <Button variant="ghost" @click="modalFormularioAberto = false" :disabled="salvando">
                    Cancelar
                </Button>
                <Button variant="default" @click="salvarArquivo" :disabled="salvando">
                    <Loader2 v-if="salvando" class="w-4 h-4 mr-1.5 animate-spin" />
                    {{ salvando ? 'Salvando...' : (editandoId ? 'Salvar Alterações' : 'Cadastrar') }}
                </Button>
            </template>
        </Modal>

        <!-- Modal: Exclusao -->
        <Modal
            v-model="modalExcluirAberto"
            title="Excluir Arquivo Auxiliar"
            size="sm"
        >
            <p v-if="arquivoParaExcluir" class="text-sm text-muted-foreground">
                Deseja remover <strong class="text-foreground">{{ arquivoParaExcluir.nome }}</strong>? Ele deixará de aparecer na área do aluno.
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