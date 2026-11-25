<script setup>
    import { ref, computed, onMounted } from 'vue';
    import { useRouter } from 'vue-router';
    import { supabase } from '@/lib/supabase';
    import {
        FileText,
        ChevronRight,
        Search,
        Loader2,
        AlertCircle,
        GraduationCap
    } from '@lucide/vue';
    import { toast } from '@/composables/useToast';
    import { useAlunoSessao } from '../composables/useAlunoSessao';

    import Card from '@/components/ui/Card.vue';
    import CardContent from '@/components/ui/CardContent.vue';
    import Button from '@/components/ui/Button.vue';
    import Input from '@/components/ui/Input.vue';

    const router = useRouter();
    const { alunoId, carregarSessaoAluno } = useAlunoSessao();

    const carregando = ref(true);
    const erroCarregamento = ref('');
    const cursosMatriculados = ref([]);
    const apostilas = ref([]);
    const termoPesquisa = ref('');

    const cursosComContagem = computed(() => {
        const contagemPorCurso = new Map();

        apostilas.value.forEach(item => {
            if (!item.curso_id) return;
            contagemPorCurso.set(
                item.curso_id,
                (contagemPorCurso.get(item.curso_id) || 0) + 1
            );
        });

        return cursosMatriculados.value.map(curso => ({
            ...curso,
            totalApostilas: contagemPorCurso.get(curso.curso_id) || 0
        }));
    });

    const cursosFiltrados = computed(() => {
        const termo = termoPesquisa.value.toLowerCase().trim();
        if (!termo) return cursosComContagem.value;

        return cursosComContagem.value.filter(curso =>
            curso.nome.toLowerCase().includes(termo)
        );
    });

    const abrirCurso = (cursoId) => {
        router.push(`/aluno/apostilas/${cursoId}`);
    };

    const carregarDados = async () => {
        carregando.value = true;
        erroCarregamento.value = '';

        try {
            if (!alunoId.value) {
                carregarSessaoAluno();
            }

            if (!alunoId.value) {
                erroCarregamento.value = 'Sessão do aluno não identificada. Faça login novamente.';
                return;
            }

            const { data: dadosMatriculas, error: erroMat } = await supabase
                .from('matricula')
                .select('id, curso_id, situacao, curso:curso_id ( id, nome )')
                .eq('aluno_id', alunoId.value)
                .in('situacao', ['cursando', 'concluido'])
                .order('id', { ascending: false });

            if (erroMat) throw erroMat;

            // Deduplica cursos priorizando matricula em andamento
            const mapaCursos = new Map();
            (dadosMatriculas || []).forEach(mat => {
                if (!mat.curso_id || !mat.curso) return;
                const existente = mapaCursos.get(mat.curso_id);

                if (!existente || (existente.situacao !== 'cursando' && mat.situacao === 'cursando')) {
                    mapaCursos.set(mat.curso_id, {
                        matricula_id: mat.id,
                        curso_id: mat.curso_id,
                        situacao: mat.situacao,
                        nome: mat.curso.nome
                    });
                }
            });

            cursosMatriculados.value = Array.from(mapaCursos.values()).sort((a, b) => {
                if (a.situacao === 'cursando' && b.situacao !== 'cursando') return -1;
                if (a.situacao !== 'cursando' && b.situacao === 'cursando') return 1;
                return a.nome.localeCompare(b.nome, 'pt-BR');
            });

            const idsCursos = cursosMatriculados.value.map(c => c.curso_id);

            if (idsCursos.length === 0) {
                apostilas.value = [];
                return;
            }

            const { data: dadosApostilas, error: erroApo } = await supabase
                .from('apostila')
                .select('id, curso_id')
                .in('curso_id', idsCursos);

            if (erroApo) throw erroApo;
            apostilas.value = dadosApostilas || [];
        } catch (err) {
            console.error('Erro ao carregar cursos para apostilas:', err);
            erroCarregamento.value = 'Não foi possível carregar suas apostilas.';
            toast.error('Erro', 'Não foi possível carregar as apostilas.');
        } finally {
            carregando.value = false;
        }
    };

    onMounted(() => {
        carregarSessaoAluno();
        carregarDados();
    });
</script>

<template>
    <div class="space-y-5">
        <!-- Topo -->
        <div class="flex items-center justify-between gap-3">
            <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Apostilas
            </h1>
        </div>

        <!-- Busca exibida apenas quando houver muitos cursos -->
        <div v-if="!carregando && cursosComContagem.length > 4" class="relative w-full sm:max-w-xs">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
                v-model="termoPesquisa"
                placeholder="Buscar curso..."
                class="pl-9 h-9 bg-background text-sm"
            />
        </div>

        <!-- Carregando -->
        <Card v-if="carregando">
            <CardContent class="p-10 text-center space-y-2 text-muted-foreground">
                <Loader2 class="w-6 h-6 mx-auto animate-spin text-primary" />
                <p class="text-sm">Carregando cursos...</p>
            </CardContent>
        </Card>

        <!-- Erro -->
        <Card v-else-if="erroCarregamento">
            <CardContent class="p-10 text-center space-y-3">
                <AlertCircle class="w-8 h-8 mx-auto text-rose-500" />
                <p class="text-sm font-medium text-foreground">{{ erroCarregamento }}</p>
                <Button size="sm" variant="outline" @click="carregarDados()">
                    Tentar novamente
                </Button>
            </CardContent>
        </Card>

        <!-- Sem cursos -->
        <Card v-else-if="cursosComContagem.length === 0">
            <CardContent class="p-10 text-center space-y-2 text-muted-foreground">
                <GraduationCap class="w-9 h-9 mx-auto text-muted-foreground/40" />
                <p class="text-sm font-medium text-foreground">Nenhum curso disponível.</p>
            </CardContent>
        </Card>

        <!-- Busca vazia -->
        <Card v-else-if="cursosFiltrados.length === 0">
            <CardContent class="p-8 text-center space-y-3 text-muted-foreground">
                <p class="text-sm font-medium text-foreground">Nenhum curso encontrado.</p>
                <Button size="sm" variant="outline" @click="termoPesquisa = ''">
                    Limpar busca
                </Button>
            </CardContent>
        </Card>

        <!-- Grade de Cursos -->
        <div
            v-else
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
        >
            <button
                v-for="curso in cursosFiltrados"
                :key="curso.curso_id"
                type="button"
                @click="abrirCurso(curso.curso_id)"
                class="group flex flex-col rounded-xl border border-border bg-card p-4 sm:p-5 text-left shadow-xs transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.99] cursor-pointer"
            >
                <div class="flex items-start justify-between gap-3 w-full min-h-[52px]">
                    <div class="flex items-start gap-3 min-w-0">
                        <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                            <FileText class="w-5 h-5" />
                        </div>

                        <div class="min-w-0">
                            <h2 class="font-bold text-sm sm:text-base text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                                {{ curso.nome }}
                            </h2>
                            <div class="flex items-center gap-2 mt-1">
                                <span
                                    class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium border leading-none"
                                    :class="
                                        curso.situacao === 'cursando'
                                            ? 'bg-primary/10 text-primary border-primary/20'
                                            : 'bg-muted text-muted-foreground border-border'
                                    "
                                >
                                    {{ curso.situacao === 'cursando' ? 'Cursando' : 'Concluído' }}
                                </span>
                                <span class="text-xs text-muted-foreground tabular-nums">
                                    {{ curso.totalApostilas }}
                                    {{ curso.totalApostilas === 1 ? 'apostila' : 'apostilas' }}
                                </span>
                            </div>
                        </div>
                    </div>

                    <ChevronRight class="w-4 h-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                </div>
            </button>
        </div>
    </div>
</template>