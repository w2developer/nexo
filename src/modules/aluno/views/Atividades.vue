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
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import { Eye, FileText, CheckCircle2, Clock } from '@lucide/vue'

const breadcrumbItems = [
    { label: 'Painel', to: '/aluno/painel', icon: 'home' },
    { label: 'Atividades' },
]

const atividades = ref([
    {
        id: 1,
        titulo: 'Lista de Exercícios - Matemática',
        disciplina: 'Matemática',
        dataEntrega: '20/10/2026',
        status: 'pendente',
    },
    {
        id: 2,
        titulo: 'Resumo sobre Revolução Francesa',
        disciplina: 'História',
        dataEntrega: '15/10/2026',
        status: 'entregue',
    },
    {
        id: 3,
        titulo: 'Trabalho de Biologia',
        disciplina: 'Biologia',
        dataEntrega: '25/10/2026',
        status: 'pendente',
    },
])

const getStatusText = (status) => {
    return status === 'entregue' ? 'Entregue' : 'Pendente'
}

const getStatusVariant = (status) => {
    return status === 'entregue' ? 'default' : 'destructive'
}
</script>

<template>
    <div class="space-y-6">
        <header>
            <h1 class="text-3xl font-bold tracking-tight">Atividades</h1>
            <p class="text-muted-foreground mt-2">Confira suas atividades e trabalhos pendentes.</p>
        </header>

        <!-- Desktop Table -->
        <div
            class="hidden md:block rounded-md border border-border bg-background shadow-lg bg-card text-card-foreground shadow-sm"
        >
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Título</TableHead>
                        <TableHead>Disciplina</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead class="text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow v-for="atividade in atividades" :key="atividade.id">
                        <TableCell class="font-medium">{{ atividade.titulo }}</TableCell>
                        <TableCell>{{ atividade.disciplina }}</TableCell>
                        <TableCell>
                            <Badge :variant="getStatusVariant(atividade.status)">
                                {{ getStatusText(atividade.status) }}
                            </Badge>
                        </TableCell>
                        <TableCell class="text-right">
                            <Button variant="outline" size="sm" class="gap-2">
                                <Eye class="w-4 h-4" /> Ver
                            </Button>
                        </TableCell>
                    </TableRow>
                    <TableRow v-if="atividades.length === 0">
                        <TableCell colspan="5" class="h-24 text-center text-muted-foreground">
                            Nenhuma atividade encontrada.
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </div>

        <!-- Mobile Cards -->
        <div class="grid grid-cols-1 gap-4 md:hidden">
            <Card v-for="atividade in atividades" :key="atividade.id">
                <CardHeader class="pb-2">
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="font-semibold">{{ atividade.titulo }}</h3>
                            <p class="text-sm text-muted-foreground">{{ atividade.disciplina }}</p>
                        </div>
                        <Badge :variant="getStatusVariant(atividade.status)">
                            {{ getStatusText(atividade.status) }}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <div class="flex flex-col gap-4 mt-2">
                        <div class="flex items-center text-sm text-muted-foreground">
                            <Clock class="w-4 h-4 mr-2" />
                            Entrega: {{ atividade.dataEntrega }}
                        </div>
                        <Button variant="outline" class="w-full gap-2">
                            <Eye class="w-4 h-4" /> Ver Atividade
                        </Button>
                    </div>
                </CardContent>
            </Card>
            <div
                v-if="atividades.length === 0"
                class="text-center py-8 text-muted-foreground border rounded-xl bg-card"
            >
                Nenhuma atividade encontrada.
            </div>
        </div>
    </div>
</template>
