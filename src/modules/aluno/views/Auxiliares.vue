<script setup>
    import { onMounted, ref } from 'vue'
    import { Link, RefreshCw } from '@lucide/vue'
    import { supabase } from '@/lib/supabase'
    import Card from '@/components/ui/Card.vue'
    import Button from '@/components/ui/Button.vue'
    import Skeleton from '@/components/ui/Skeleton.vue'
    import Tooltip from '@/components/ui/Tooltip.vue'

    import Mega from '@/assets/png/mega-logo-96.png'
    import GoogleDrive from '@/assets/png/google-drive-96.png'

    const arquivos = ref([])
    const carregando = ref(true)
    const erro = ref('')

    const buscarArquivos = async () => {
        carregando.value = true
        erro.value = ''

        try {
            const { data, error } = await supabase
                .from('arquivo_auxiliar')
                .select('id, nome, drive_url, mega_url, outro_url')
                .order('nome', { ascending: true })

            if (error) {
                throw error
            }

            arquivos.value = data ?? []
        } catch (err) {
            console.error('Erro ao buscar arquivos auxiliares:', err)
            erro.value = 'Não foi possível carregar os arquivos auxiliares.'
        } finally {
            carregando.value = false
        }
    }

    // Retorna apenas os links com URL valida (diferente de null ou string vazia)
    const obterLinksDownload = (arquivo) => {
        return [
            {
                tipo: 'drive',
                label: 'Google Drive',
                url: arquivo.drive_url,
                icone: GoogleDrive
            },
            {
                tipo: 'mega',
                label: 'Mega',
                url: arquivo.mega_url,
                icone: Mega
            },
            {
                tipo: 'outro',
                label: 'Outro link',
                url: arquivo.outro_url,
                icone: null
            }
        ].filter((link) => Boolean(link.url && link.url.trim()))
    }

    onMounted(() => {
        buscarArquivos()
    })
</script>

<template>
    <div class="mx-auto w-full max-w-5xl p-4 sm:p-6">
        <div v-if="carregando" class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
            <Card
                v-for="item in 4"
                :key="item"
                class="flex min-h-14 items-center justify-between gap-4 px-4 py-3"
            >
                <Skeleton class="h-4 w-40" />
                <div class="flex items-center gap-2">
                    <Skeleton class="size-9" />
                    <Skeleton class="size-9" />
                </div>
            </Card>
        </div>

        <Card
            v-else-if="erro"
            class="flex flex-col items-center justify-center gap-3 p-6 text-center"
        >
            <p class="text-sm text-muted-foreground">{{ erro }}</p>
            <Button variant="outline" size="sm" @click="buscarArquivos">
                <RefreshCw class="mr-2 size-4" />
                Tentar novamente
            </Button>
        </Card>

        <Card
            v-else-if="arquivos.length === 0"
            class="flex items-center justify-center p-6 text-center"
        >
            <p class="text-sm text-muted-foreground">
                Nenhum arquivo auxiliar disponível no momento.
            </p>
        </Card>

        <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
            <Card
                v-for="arquivo in arquivos"
                :key="arquivo.id"
                class="flex min-h-14 flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:border-slate-300"
            >
                <span class="text-sm font-medium text-foreground">
                    {{ arquivo.nome }}
                </span>

                <div
                    v-if="obterLinksDownload(arquivo).length > 0"
                    class="flex flex-wrap items-center gap-2"
                >
                    <Tooltip
                        v-for="link in obterLinksDownload(arquivo)"
                        :key="link.tipo"
                        :content="link.label"
                    >
                        <Button
                            as="a"
                            :href="link.url"
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="outline"
                            size="icon"
                            :aria-label="`Baixar via ${link.label}`"
                        >
                            <img
                                v-if="link.icone"
                                :src="link.icone"
                                :alt="link.label"
                                class="size-4 object-contain"
                            />
                            <Link v-else class="size-4" />
                        </Button>
                    </Tooltip>
                </div>

                <span v-else class="text-xs text-muted-foreground">
                    Sem links disponíveis
                </span>
            </Card>
        </div>
    </div>
</template>