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
import { Download, BookOpen, FileText } from '@lucide/vue'

const breadcrumbItems = [
    { label: 'Painel', to: '/aluno/painel', icon: 'home' },
    { label: 'Apostilas' },
]

const apostilas = ref([
    {
        id: 1,
        titulo: 'Apostila de Matemática - Módulo 1',
        disciplina: 'Matemática',
        tamanho: '2.4 MB',
        dataAdicao: '01/10/2026',
    },
    {
        id: 2,
        titulo: 'Geografia - Climas do Brasil',
        disciplina: 'Geografia',
        tamanho: '1.8 MB',
        dataAdicao: '05/10/2026',
    },
    {
        id: 3,
        titulo: 'Literatura Modernista',
        disciplina: 'Literatura',
        tamanho: '3.1 MB',
        dataAdicao: '08/10/2026',
    },
])
</script>

<template>
    <div class="space-y-6">
        <header>
            <h1 class="text-3xl font-bold tracking-tight">Apostilas</h1>
            <p class="text-muted-foreground mt-2">
                Acesse e baixe os materiais didáticos e apostilas do semestre.
            </p>
        </header>

        <!-- Desktop Table -->
        <div class="hidden md:block rounded-md border bg-card text-card-foreground shadow-sm">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead>Disciplina</TableHead>
                        <TableHead>Tamanho</TableHead>
                        <TableHead>Adicionado em</TableHead>
                        <TableHead class="text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow v-for="apostila in apostilas" :key="apostila.id">
                        <TableCell class="font-medium flex items-center gap-2">
                            <BookOpen class="w-4 h-4 text-primary" />
                            {{ apostila.titulo }}
                        </TableCell>
                        <TableCell>{{ apostila.disciplina }}</TableCell>
                        <TableCell>{{ apostila.tamanho }}</TableCell>
                        <TableCell>{{ apostila.dataAdicao }}</TableCell>
                        <TableCell class="text-right">
                            <Button variant="outline" size="sm" class="gap-2">
                                <Download class="w-4 h-4" /> Baixar
                            </Button>
                        </TableCell>
                    </TableRow>
                    <TableRow v-if="apostilas.length === 0">
                        <TableCell colspan="5" class="h-24 text-center text-muted-foreground">
                            Nenhuma apostila encontrada.
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </div>

        <!-- Mobile Cards -->
        <div class="grid grid-cols-1 gap-4 md:hidden">
            <Card v-for="apostila in apostilas" :key="apostila.id">
                <CardHeader class="pb-2">
                    <div class="flex gap-3">
                        <div class="mt-1 bg-primary/10 p-2 rounded-lg text-primary">
                            <BookOpen class="w-5 h-5" />
                        </div>
                        <div>
                            <h3 class="font-semibold">{{ apostila.titulo }}</h3>
                            <p class="text-sm text-muted-foreground">{{ apostila.disciplina }}</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div class="flex flex-col gap-4 mt-2">
                        <div
                            class="flex items-center justify-between text-sm text-muted-foreground"
                        >
                            <span>Adicionado: {{ apostila.dataAdicao }}</span>
                            <span>{{ apostila.tamanho }}</span>
                        </div>
                        <Button variant="outline" class="w-full gap-2">
                            <Download class="w-4 h-4" /> Baixar Apostila
                        </Button>
                    </div>
                </CardContent>
            </Card>
            <div
                v-if="apostilas.length === 0"
                class="text-center py-8 text-muted-foreground border rounded-xl bg-card"
            >
                Nenhuma apostila encontrada.
            </div>
        </div>
    </div>
</template>
