<script setup>
import { ref } from 'vue'
import Breadcrumb from '@/components/ui/Breadcrumb.vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Table from '@/components/ui/Table.vue'
import TableHeader from '@/components/ui/TableHeader.vue'
import TableRow from '@/components/ui/TableRow.vue'
import TableHead from '@/components/ui/TableHead.vue'
import TableBody from '@/components/ui/TableBody.vue'
import TableCell from '@/components/ui/TableCell.vue'
import Button from '@/components/ui/Button.vue'
import { ExternalLink, Link as LinkIcon, Video, Headphones } from '@lucide/vue'

const breadcrumbItems = [
    { label: 'Painel', to: '/aluno/painel', icon: 'home' },
    { label: 'Materiais Auxiliares' },
]

const materiaisAuxiliares = ref([
    {
        id: 1,
        titulo: 'Vídeo Aula - Equações de 2º Grau',
        tipo: 'Vídeo',
        disciplina: 'Matemática',
        link: '#',
        icon: Video,
    },
    {
        id: 2,
        titulo: 'Podcast sobre a Guerra Fria',
        tipo: 'Áudio',
        disciplina: 'História',
        link: '#',
        icon: Headphones,
    },
    {
        id: 3,
        titulo: 'Artigo: Genética Básica',
        tipo: 'Link Externo',
        disciplina: 'Biologia',
        link: '#',
        icon: LinkIcon,
    },
])
</script>

<template>
    <div class="space-y-6">
        <header>
            <h1 class="text-3xl font-bold tracking-tight">Materiais Auxiliares</h1>
            <p class="text-muted-foreground mt-2">
                Explore vídeos, artigos e links complementares para seus estudos.
            </p>
        </header>

        <!-- Desktop Table -->
        <div class="hidden md:block rounded-md border bg-card text-card-foreground shadow-sm">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Título</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Disciplina</TableHead>
                        <TableHead class="text-right">Acessar</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow v-for="material in materiaisAuxiliares" :key="material.id">
                        <TableCell class="font-medium flex items-center gap-2">
                            <component :is="material.icon" class="w-4 h-4 text-muted-foreground" />
                            {{ material.titulo }}
                        </TableCell>
                        <TableCell>{{ material.tipo }}</TableCell>
                        <TableCell>{{ material.disciplina }}</TableCell>
                        <TableCell class="text-right">
                            <Button
                                variant="ghost"
                                size="sm"
                                class="gap-2 text-primary hover:text-primary"
                            >
                                <ExternalLink class="w-4 h-4" /> Abrir
                            </Button>
                        </TableCell>
                    </TableRow>
                    <TableRow v-if="materiaisAuxiliares.length === 0">
                        <TableCell colspan="4" class="h-24 text-center text-muted-foreground">
                            Nenhum material auxiliar encontrado.
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </div>

        <!-- Mobile Cards -->
        <div class="grid grid-cols-1 gap-4 md:hidden">
            <Card v-for="material in materiaisAuxiliares" :key="material.id">
                <CardHeader class="pb-2">
                    <div class="flex gap-3 items-start">
                        <div class="mt-1 bg-secondary p-2 rounded-lg text-secondary-foreground">
                            <component :is="material.icon" class="w-5 h-5" />
                        </div>
                        <div>
                            <h3 class="font-semibold">{{ material.titulo }}</h3>
                            <p class="text-sm text-muted-foreground">
                                {{ material.disciplina }} • {{ material.tipo }}
                            </p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div class="mt-2">
                        <Button variant="outline" class="w-full gap-2">
                            <ExternalLink class="w-4 h-4" /> Acessar Material
                        </Button>
                    </div>
                </CardContent>
            </Card>
            <div
                v-if="materiaisAuxiliares.length === 0"
                class="text-center py-8 text-muted-foreground border rounded-xl bg-card"
            >
                Nenhum material auxiliar encontrado.
            </div>
        </div>
    </div>
</template>
