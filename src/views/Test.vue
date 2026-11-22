<script setup>
    import { ref } from 'vue';

    import Table from '@/components/ui/Table.vue';
    import TableHeader from '@/components/ui/TableHeader.vue';
    import TableHead from '@/components/ui/TableHead.vue';
    import TableBody from '@/components/ui/TableBody.vue';
    import TableRow from '@/components/ui/TableRow.vue';
    import TableCell from '@/components/ui/TableCell.vue';

    const dados = [
        {id: "1", nome: "Mateus Santos", idade: 22, salario: 0},
        {id: "2", nome: "João Victor", idade: 25, salario: 0},
        {id: "3", nome: "Júlia Silva", idade: 20, salario: 0},
    ]

</script>

<template>
    <div class="flex p-2 w-full">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead align="center">ID</TableHead>
                    <TableHead>NOME</TableHead>
                    <TableHead align="center">IDADE</TableHead>
                    <TableHead align="center">SALÁRIO</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                <TableRow v-for="item in dados" :key="item.id">
                    <TableCell align="center">{{ item.id }}</TableCell>
                    <TableCell>{{ item.nome }}</TableCell>
                    <TableCell align="center">{{ item.idade }}</TableCell>
                    <TableCell align="center">{{ item.salario }}</TableCell>
                </TableRow>
            </TableBody>
        </Table>
    </div>
</template>