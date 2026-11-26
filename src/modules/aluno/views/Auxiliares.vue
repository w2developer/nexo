<script setup>
    import { ref, computed, onMounted } from 'vue';
    import { supabase } from '@/lib/supabase';
    import {
        FolderOpen,
        ExternalLink,
        Search,
        Loader2,
        AlertCircle
    } from '@lucide/vue';
    import { toast } from '@/composables/useToast';

    import googleDriveIcon from '@/assets/png/google-drive-96.png';
    import megaLogoIcon from '@/assets/png/mega-logo-96.png';

    import Card from '@/components/ui/Card.vue';
    import CardContent from '@/components/ui/CardContent.vue';
    import Button from '@/components/ui/Button.vue';
    import Input from '@/components/ui/Input.vue';

    const carregando = ref(true);
    const erroCarregamento = ref('');
    const arquivosBrutos = ref([]);
    const termoPesquisa = ref('');
    const imagensComErro = ref(new Set());

    const marcarImagemErro = (id) => {
        const novo = new Set(imagensComErro.value);
        novo.add(id);
        imagensComErro.value = novo;
    };

    const arquivosLista = computed(() => {
        const ordenados = [...arquivosBrutos.value].sort((a, b) => {
            const ordemA = Number(a.ordem) > 0 ? Number(a.ordem) : Number.MAX_SAFE_INTEGER;
            const ordemB = Number(b.ordem) > 0 ? Number(b.ordem) : Number.MAX_SAFE_INTEGER;
            if (ordemA !== ordemB) return ordemA - ordemB;
            return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
        });

        return ordenados.map(item => {
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

    const arquivosFiltrados = computed(() => {
        const termo = termoPesquisa.value.toLowerCase().trim();
        if (!termo) return arquivosLista.value;

        return arquivosLista.value.filter(item =>
            item.nome.toLowerCase().includes(termo)
        );
    });

    const carregarArquivos = async () => {
        carregando.value = true;
        erroCarregamento.value = '';
        imagensComErro.value = new Set();

        try {
            const { data, error } = await supabase
                .from('arquivo_auxiliar')
                .select('id, nome, drive_url, mega_url, outro_url, miniatura_url, ordem')
                .order('ordem', { ascending: true })
                .order('nome', { ascending: true });

            if (error) throw error;
            arquivosBrutos.value = data || [];
        } catch (err) {
            console.error('Erro ao carregar arquivos auxiliares:', err);
            erroCarregamento.value = 'Não foi possível carregar os arquivos auxiliares.';
            toast.error('Erro', 'Não foi possível carregar os arquivos auxiliares.');
        } finally {
            carregando.value = false;
        }
    };

    onMounted(() => {
        carregarArquivos();
    });
</script>

<template>
    <div class="space-y-5">
        <!-- Topo + Busca -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Auxiliares
            </h1>

            <div v-if="!carregando && arquivosLista.length > 4" class="relative w-full sm:w-64">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                    v-model="termoPesquisa"
                    placeholder="Buscar arquivo..."
                    class="pl-9 h-9 bg-background text-sm"
                />
            </div>
        </div>

        <!-- Carregando -->
        <Card v-if="carregando">
            <CardContent class="p-10 text-center space-y-2 text-muted-foreground">
                <Loader2 class="w-6 h-6 mx-auto animate-spin text-primary" />
                <p class="text-sm">Carregando arquivos...</p>
            </CardContent>
        </Card>

        <!-- Erro -->
        <Card v-else-if="erroCarregamento">
            <CardContent class="p-10 text-center space-y-3">
                <AlertCircle class="w-8 h-8 mx-auto text-rose-500" />
                <p class="text-sm font-medium text-foreground">{{ erroCarregamento }}</p>
                <Button size="sm" variant="outline" @click="carregarArquivos()">
                    Tentar novamente
                </Button>
            </CardContent>
        </Card>

        <!-- Vazio -->
        <Card v-else-if="arquivosLista.length === 0">
            <CardContent class="p-10 text-center space-y-2 text-muted-foreground">
                <FolderOpen class="w-9 h-9 mx-auto text-muted-foreground/40" />
                <p class="text-sm font-medium text-foreground">
                    Nenhum arquivo auxiliar disponível.
                </p>
            </CardContent>
        </Card>

        <!-- Busca vazia -->
        <Card v-else-if="arquivosFiltrados.length === 0">
            <CardContent class="p-8 text-center space-y-3 text-muted-foreground">
                <p class="text-sm font-medium text-foreground">Nenhum arquivo encontrado.</p>
                <Button size="sm" variant="outline" @click="termoPesquisa = ''">
                    Limpar busca
                </Button>
            </CardContent>
        </Card>

        <!-- Grade Compacta de Arquivos Auxiliares (Horizontal no celular / 4 colunas no PC) -->
        <div
            v-else
            class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
        >
            <article
                v-for="item in arquivosFiltrados"
                :key="item.id"
                class="flex flex-row sm:flex-col items-center sm:items-stretch overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-shadow hover:shadow-sm"
            >
                <!-- Miniatura -->
                <div class="relative w-28 sm:w-full aspect-[16/10] ml-2.5 my-2.5 sm:m-0 rounded-lg sm:rounded-none bg-muted/50 sm:border-b border-border overflow-hidden shrink-0">
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
                        <FolderOpen class="w-7 h-7 sm:w-8 sm:h-8" />
                    </div>
                </div>

                <!-- Nome + Botoes compactos -->
                <div class="flex flex-1 flex-col min-w-0 p-2.5 sm:p-3 gap-2 sm:gap-2.5">
                    <h2 class="font-semibold text-[13px] sm:text-sm text-foreground leading-snug line-clamp-2">
                        {{ item.nome }}
                    </h2>

                    <div v-if="item.canais.length > 0" class="mt-auto">
                        <a
                            v-if="item.canais.length === 1"
                            :href="item.canais[0].url"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="flex items-center justify-center gap-1.5 h-8 w-full px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors active:scale-[0.98]"
                        >
                            <img
                                v-if="item.canais[0].tipo === 'drive'"
                                :src="googleDriveIcon"
                                alt="Google Drive"
                                class="w-3.5 h-3.5 object-contain shrink-0"
                            />
                            <img
                                v-else-if="item.canais[0].tipo === 'mega'"
                                :src="megaLogoIcon"
                                alt="Mega"
                                class="w-3.5 h-3.5 object-contain shrink-0"
                            />
                            <ExternalLink v-else class="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span class="truncate">{{ item.canais[0].label }}</span>
                        </a>

                        <div
                            v-else
                            class="grid gap-1.5"
                            :class="item.canais.length === 2 ? 'grid-cols-2' : 'grid-cols-3'"
                        >
                            <a
                                v-for="canal in item.canais"
                                :key="canal.tipo"
                                :href="canal.url"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="flex items-center justify-center gap-1.5 h-8 px-2 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors active:scale-[0.98]"
                            >
                                <img
                                    v-if="canal.tipo === 'drive'"
                                    :src="googleDriveIcon"
                                    alt="Google Drive"
                                    class="w-3.5 h-3.5 object-contain shrink-0"
                                />
                                <img
                                    v-else-if="canal.tipo === 'mega'"
                                    :src="megaLogoIcon"
                                    alt="Mega"
                                    class="w-3.5 h-3.5 object-contain shrink-0"
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
    </div>
</template>