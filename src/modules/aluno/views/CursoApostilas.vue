<script setup>
    import { ref, computed, watch, onMounted } from 'vue';
    import { useRouter, useRoute } from 'vue-router';
    import { supabase } from '@/lib/supabase';
    import {
        ArrowLeft,
        FileText,
        ExternalLink,
        Search,
        Loader2,
        AlertCircle,
        BookOpen
    } from '@lucide/vue';
    import { toast } from '@/composables/useToast';
    import { useAlunoSessao } from '../composables/useAlunoSessao';

    import googleDriveIcon from '@/assets/png/google-drive-96.png';
    import megaLogoIcon from '@/assets/png/mega-logo-96.png';

    import Card from '@/components/ui/Card.vue';
    import CardContent from '@/components/ui/CardContent.vue';
    import Button from '@/components/ui/Button.vue';
    import Input from '@/components/ui/Input.vue';

    const router = useRouter();
    const route = useRoute();
    const { alunoId, carregarSessaoAluno } = useAlunoSessao();

    const carregando = ref(true);
    const erroCarregamento = ref('');
    const matriculaAtual = ref(null);
    const apostilasBrutas = ref([]);
    const termoPesquisa = ref('');
    const imagensComErro = ref(new Set());

    const cursoIdParam = computed(() => Number(route.params.cursoId));

    const marcarImagemErro = (id) => {
        const novo = new Set(imagensComErro.value);
        novo.add(id);
        imagensComErro.value = novo;
    };

    const apostilasLista = computed(() => {
        const ordenadas = [...apostilasBrutas.value].sort((a, b) => {
            const ordemA = Number(a.ordem) > 0 ? Number(a.ordem) : Number.MAX_SAFE_INTEGER;
            const ordemB = Number(b.ordem) > 0 ? Number(b.ordem) : Number.MAX_SAFE_INTEGER;
            if (ordemA !== ordemB) return ordemA - ordemB;
            return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
        });

        return ordenadas.map(item => {
            const canais = [];
            if (item.drive_url) canais.push({ tipo: 'drive', label: 'Google Drive', curto: 'Drive', url: item.drive_url });
            if (item.mega_url) canais.push({ tipo: 'mega', label: 'Mega', curto: 'Mega', url: item.mega_url });
            if (item.outro_url) canais.push({ tipo: 'outro', label: 'Link externo', curto: 'Outro', url: item.outro_url });

            return {
                ...item,
                canais
            };
        });
    });

    const apostilasFiltradas = computed(() => {
        const termo = termoPesquisa.value.toLowerCase().trim();
        if (!termo) return apostilasLista.value;

        return apostilasLista.value.filter(item =>
            item.nome.toLowerCase().includes(termo)
        );
    });

    const voltarParaCursos = () => {
        router.push('/aluno/apostilas');
    };

    const carregarDados = async () => {
        carregando.value = true;
        erroCarregamento.value = '';
        termoPesquisa.value = '';
        imagensComErro.value = new Set();

        try {
            if (!alunoId.value) {
                carregarSessaoAluno();
            }

            if (!alunoId.value) {
                erroCarregamento.value = 'Sessão do aluno não identificada. Faça login novamente.';
                return;
            }

            if (!cursoIdParam.value) {
                erroCarregamento.value = 'Curso inválido.';
                return;
            }

            const [resMatriculas, resApostilas] = await Promise.all([
                supabase
                    .from('matricula')
                    .select('id, curso_id, situacao, curso:curso_id ( id, nome )')
                    .eq('aluno_id', alunoId.value)
                    .eq('curso_id', cursoIdParam.value)
                    .in('situacao', ['cursando', 'concluido'])
                    .order('id', { ascending: false }),
                supabase
                    .from('apostila')
                    .select('id, curso_id, nome, drive_url, mega_url, outro_url, miniatura_url, ordem')
                    .eq('curso_id', cursoIdParam.value)
                    .order('ordem', { ascending: true })
                    .order('nome', { ascending: true })
            ]);

            if (resMatriculas.error) throw resMatriculas.error;
            if (resApostilas.error) throw resApostilas.error;

            const listaMat = resMatriculas.data || [];
            const matricula = listaMat.find(m => m.situacao === 'cursando') || listaMat[0] || null;

            if (!matricula) {
                erroCarregamento.value = 'Você não possui acesso a este curso.';
                return;
            }

            matriculaAtual.value = matricula;
            apostilasBrutas.value = resApostilas.data || [];
        } catch (err) {
            console.error('Erro ao carregar apostilas do curso:', err);
            erroCarregamento.value = 'Não foi possível carregar as apostilas deste curso.';
            toast.error('Erro', 'Não foi possível carregar as apostilas.');
        } finally {
            carregando.value = false;
        }
    };

    watch(cursoIdParam, () => {
        carregarDados();
    });

    onMounted(() => {
        carregarSessaoAluno();
        carregarDados();
    });
</script>

<template>
    <div class="space-y-5">
        <!-- Voltar -->
        <div>
            <button
                type="button"
                @click="voltarParaCursos"
                class="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 -ml-2 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
            >
                <ArrowLeft class="w-4 h-4" />
                <span>Cursos</span>
            </button>
        </div>

        <!-- Carregando -->
        <Card v-if="carregando">
            <CardContent class="p-10 text-center space-y-2 text-muted-foreground">
                <Loader2 class="w-6 h-6 mx-auto animate-spin text-primary" />
                <p class="text-sm">Carregando apostilas...</p>
            </CardContent>
        </Card>

        <!-- Erro -->
        <Card v-else-if="erroCarregamento">
            <CardContent class="p-10 text-center space-y-3">
                <AlertCircle class="w-8 h-8 mx-auto text-rose-500" />
                <p class="text-sm font-medium text-foreground">{{ erroCarregamento }}</p>
                <Button size="sm" variant="outline" @click="voltarParaCursos">
                    Voltar para cursos
                </Button>
            </CardContent>
        </Card>

        <template v-else>
            <!-- Cabecalho -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="min-w-0">
                    <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
                        {{ matriculaAtual?.curso?.nome }}
                    </h1>
                    <p class="text-xs sm:text-sm text-muted-foreground mt-0.5 tabular-nums">
                        {{ apostilasLista.length }}
                        {{ apostilasLista.length === 1 ? 'apostila disponível' : 'apostilas disponíveis' }}
                    </p>
                </div>

                <div v-if="apostilasLista.length > 4" class="relative w-full sm:w-64">
                    <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                        v-model="termoPesquisa"
                        placeholder="Buscar apostila..."
                        class="pl-9 h-9 bg-background text-sm"
                    />
                </div>
            </div>

            <!-- Sem apostilas -->
            <Card v-if="apostilasLista.length === 0">
                <CardContent class="p-10 text-center space-y-2 text-muted-foreground">
                    <BookOpen class="w-9 h-9 mx-auto text-muted-foreground/40" />
                    <p class="text-sm font-medium text-foreground">
                        Nenhuma apostila cadastrada para este curso.
                    </p>
                </CardContent>
            </Card>

            <!-- Busca vazia -->
            <Card v-else-if="apostilasFiltradas.length === 0">
                <CardContent class="p-8 text-center space-y-3 text-muted-foreground">
                    <p class="text-sm font-medium text-foreground">Nenhuma apostila encontrada.</p>
                    <Button size="sm" variant="outline" @click="termoPesquisa = ''">
                        Limpar busca
                    </Button>
                </CardContent>
            </Card>

            <!-- Grade de Apostilas -->
            <div
                v-else
                class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
                <article
                    v-for="item in apostilasFiltradas"
                    :key="item.id"
                    class="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs"
                >
                    <!-- Capa / Miniatura -->
                    <div class="relative aspect-[16/10] w-full bg-muted/50 border-b border-border overflow-hidden">
                        <img
                            v-if="item.miniatura_url && !imagensComErro.has(item.id)"
                            :src="item.miniatura_url"
                            :alt="item.nome"
                            loading="lazy"
                            class="h-full w-full object-cover"
                            @error="marcarImagemErro(item.id)"
                        />
                        <div
                            v-else
                            class="flex h-full w-full items-center justify-center text-muted-foreground/35"
                        >
                            <FileText class="w-10 h-10" />
                        </div>
                    </div>

                    <!-- Conteudo + Botoes de acesso -->
                    <div class="flex flex-1 flex-col p-4 gap-3.5">
                        <h2 class="font-bold text-sm sm:text-[15px] text-foreground leading-snug line-clamp-2">
                            {{ item.nome }}
                        </h2>

                        <div v-if="item.canais.length > 0" class="mt-auto">
                            <!-- 1 unico canal: botao cheio -->
                            <a
                                v-if="item.canais.length === 1"
                                :href="item.canais[0].url"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="flex items-center justify-center gap-2 h-10 w-full rounded-lg bg-primary text-primary-foreground font-medium text-xs sm:text-sm hover:opacity-95 transition-opacity active:scale-[0.99]"
                            >
                                <img
                                    v-if="item.canais[0].tipo === 'drive'"
                                    :src="googleDriveIcon"
                                    alt="Google Drive"
                                    class="w-4 h-4 object-contain shrink-0"
                                />
                                <img
                                    v-else-if="item.canais[0].tipo === 'mega'"
                                    :src="megaLogoIcon"
                                    alt="Mega"
                                    class="w-4 h-4 object-contain shrink-0"
                                />
                                <ExternalLink v-else class="w-4 h-4 shrink-0" />
                                <span>{{ item.canais[0].label }}</span>
                            </a>

                            <!-- Multiplos canais: botoes lado a lado -->
                            <div
                                v-else
                                class="grid gap-2"
                                :class="item.canais.length === 2 ? 'grid-cols-2' : 'grid-cols-3'"
                            >
                                <a
                                    v-for="canal in item.canais"
                                    :key="canal.tipo"
                                    :href="canal.url"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="flex items-center justify-center gap-1.5 h-10 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors active:scale-[0.98]"
                                >
                                    <img
                                        v-if="canal.tipo === 'drive'"
                                        :src="googleDriveIcon"
                                        alt="Google Drive"
                                        class="w-4 h-4 object-contain shrink-0"
                                    />
                                    <img
                                        v-else-if="canal.tipo === 'mega'"
                                        :src="megaLogoIcon"
                                        alt="Mega"
                                        class="w-4 h-4 object-contain shrink-0"
                                    />
                                    <ExternalLink v-else class="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    <span class="truncate">{{ canal.curto }}</span>
                                </a>
                            </div>
                        </div>

                        <p v-else class="mt-auto text-xs text-muted-foreground">
                            Link indisponível.
                        </p>
                    </div>
                </article>
            </div>
        </template>
    </div>
</template>