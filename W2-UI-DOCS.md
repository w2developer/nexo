# Teste

# Contexto do Sistema: W2 UI Kit (Vue 3 + Tailwind CSS 4)

<!-- npm install clsx tailwind-merge @lucide/vue -->

## 📌 Regras de Ouro do Projeto
1. **Modelo Ownership:** Não usamos bibliotecas de componentes via NPM (como Vuetify ou Quasar). Os componentes pertencem ao projeto (`src/components/ui/`). Novas implementações devem seguir este padrão, usando código limpo, acessível e sem dependências pesadas.
2. **Stack Principal:** Vue 3 (Composition API, `<script setup>`, `defineModel`), Tailwind CSS 4, Lucide Vue para ícones.
3. **Padrão de Código:** Indentação estrita de 4 espaços (Tab = 4). Comentários devem ser curtos e diretos. Sempre em português brasileiro.
4. **Utilitário CN:** A fusão de classes do Tailwind é sempre feita através da função `cn()` (combinação de `clsx` e `tailwind-merge`) localizada em `src/utils/cn.js`.

---

## 📂 Estrutura de Diretórios e Componentes

Abaixo está o mapa de todos os componentes criados. Sempre verifique se o elemento já existe antes de criar um novo.

### 1. Utilitários e Composables
*   `src/utils/cn.js`: Utilitário central para merge seguro de classes Tailwind.
*   `src/composables/useClickOutside.js`: Detecta cliques fora de um elemento (usado em Dropdowns).
*   `src/composables/useToast.js`: Gerenciador de estado global para notificações (Toasts).
*   `src/composables/useCommandMenu.js`: Gerenciador de estado global para a Command Palette.

### 2. Layout Principal (`src/components/layout/`)
*   `AppLayout.vue`: O chassi da aplicação. Gerencia o grid e injeta o estado do menu mobile.
*   `Sidebar.vue`: Barra lateral de navegação. Renderiza os grupos de menus com Vue Router.
*   `SidebarItem.vue`: Item individual da Sidebar. Renderiza um `<router-link>` simples ou submenu animado.
*   `Navbar.vue`: Barra superior. Contém o gatilho mobile e gatilho do Command Menu.

### 3. Componentes de UI (`src/components/ui/`)
*   **Formulários:** `FormGroup.vue` (envelopador com label/descrição), `Input.vue`, `Textarea.vue`, `Select.vue`, `Checkbox.vue`, `Switch.vue`.
*   **Ações e Navegação:** `Button.vue` (suporta variant e size), `Dropdown.vue`, `Tabs.vue`, `TabsList.vue`, `TabsTrigger.vue`, `TabsContent.vue`.
*   **Dados e Layout:** `Card.vue` (e seus subcomponentes Header/Content), `Table.vue` (tabela híbrida responsiva em mobile), `Badge.vue`, `Accordion.vue` (sanfona animada).
*   **Feedback/Overlays:** `Modal.vue` (janela central), `CommandMenu.vue` (paleta global Ctrl+K), `Toaster.vue`/`Toast.vue`, `Tooltip.vue`, `Avatar.vue` (com fallback de iniciais), `Skeleton.vue` (loading fantasma).

---

## 🚀 Instrução para IAs Colaboradoras
Se for solicitado a criação de uma nova tela, formulário ou dashboard:
1. **NÃO escreva HTML puro estático** usando tags nativas para inputs, botões ou tabelas.
2. **USE os componentes desta documentação.** Importe e utilize `<FormGroup>`, `<Input>`, `<Card>`, `<Button>`, etc.
3. Utilize as props mapeadas nos exemplos abaixo.

---

## 📖 Exemplos Práticos e Referência de Código

### 1. Botões e Ações (`Button`, `Dropdown`)
```vue
<script setup>
import Button from '@/components/ui/Button.vue';
import Dropdown from '@/components/ui/Dropdown.vue';
import { Settings, LogOut } from '@lucide/vue';
</script>

<template>
    <div class="flex gap-4">
        <!-- Variantes: default, secondary, destructive, outline, ghost -->
        <Button size="default" variant="default">Salvar</Button>
        <Button size="sm" variant="destructive">Excluir</Button>
        <Button size="icon" variant="outline"><Settings class="w-4 h-4"/></Button>

        <Dropdown>
            <template #trigger>
                <Button variant="ghost">Opções</Button>
            </template>
            <template #content>
                <div class="p-2">
                    <a href="#" class="flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted">Perfil</a>
                    <a href="#" class="flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50">
                        <LogOut class="w-4 h-4"/> Sair
                    </a>
                </div>
            </template>
        </Dropdown>
    </div>
</template>
```

### 2. Formulários (`FormGroup`, `Input`, `Textarea`, `Select`, `Switch`, `Checkbox`)
```vue
<script setup>
import { ref } from 'vue';
import FormGroup from '@/components/ui/FormGroup.vue';
import Input from '@/components/ui/Input.vue';
import Textarea from '@/components/ui/Textarea.vue';
import Select from '@/components/ui/Select.vue';
import Switch from '@/components/ui/Switch.vue';
import Checkbox from '@/components/ui/Checkbox.vue';

const form = ref({ name: '', bio: '', role: 'user', active: true, terms: false });
</script>

<template>
    <form class="space-y-6 max-w-md">
        <FormGroup description="Como prefere ser chamado." id="name" label="Nome Completo">
            <Input :error="!form.name" id="name" placeholder="Digite seu nome" v-model="form.name"/>
        </FormGroup>

        <FormGroup id="bio" label="Biografia">
            <Textarea id="bio" rows="3" v-model="form.bio"/>
        </FormGroup>

        <FormGroup id="role" label="Nível de Acesso">
            <Select id="role" v-model="form.role">
                <option value="admin">Administrador</option>
                <option value="user">Usuário Comum</option>
            </Select>
        </FormGroup>

        <div class="flex items-center justify-between border border-border p-4 rounded-lg">
            <span class="text-sm font-medium">Conta Ativa</span>
            <Switch v-model="form.active"/>
        </div>

        <div class="flex items-center gap-3">
            <Checkbox id="terms" v-model="form.terms"/>
            <label for="terms" class="text-sm font-medium cursor-pointer">Aceito os termos</label>
        </div>
    </form>
</template>
```

### 3. Dados e Layout (`Card`, `Table`, `Badge`, `Accordion`)
```vue
<script setup>
import { ref } from 'vue';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Table from '@/components/ui/Table.vue';
import TableHeader from '@/components/ui/TableHeader.vue';
import TableBody from '@/components/ui/TableBody.vue';
import TableRow from '@/components/ui/TableRow.vue';
import TableHead from '@/components/ui/TableHead.vue';
import TableCell from '@/components/ui/TableCell.vue';
import Badge from '@/components/ui/Badge.vue';
import Accordion from '@/components/ui/Accordion.vue';
import AccordionItem from '@/components/ui/AccordionItem.vue';
import AccordionTrigger from '@/components/ui/AccordionTrigger.vue';
import AccordionContent from '@/components/ui/AccordionContent.vue';

const faqState = ref('item-1');
</script>

<template>
    <div class="space-y-8">
        <Card>
            <CardHeader>
                <h3 class="text-lg font-bold">Projetos</h3>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell class="font-medium">W2 UI Kit</TableCell>
                            <!-- Variantes: default, secondary, destructive, outline, success -->
                            <TableCell><Badge variant="success">Finalizado</Badge></TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        <Accordion v-model="faqState">
            <AccordionItem value="item-1">
                <AccordionTrigger>O que é o W2 UI?</AccordionTrigger>
                <AccordionContent>Nossa biblioteca interna de componentes.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
                <AccordionTrigger>Como usar?</AccordionTrigger>
                <AccordionContent>Copie os componentes e use o utility cn().</AccordionContent>
            </AccordionItem>
        </Accordion>
    </div>
</template>
```

### 4. Navegação por Abas (`Tabs`)
```vue
<script setup>
import { ref } from 'vue';
import Tabs from '@/components/ui/Tabs.vue';
import TabsList from '@/components/ui/TabsList.vue';
import TabsTrigger from '@/components/ui/TabsTrigger.vue';
import TabsContent from '@/components/ui/TabsContent.vue';

const currentTab = ref('login');
</script>

<template>
    <Tabs class="w-full max-w-md" v-model="currentTab">
        <TabsList class="grid w-full grid-cols-2">
            <TabsTrigger value="login">Entrar</TabsTrigger>
            <TabsTrigger value="register">Cadastrar</TabsTrigger>
        </TabsList>
        
        <TabsContent value="login">
            <p>Formulário de Login aqui.</p>
        </TabsContent>
        
        <TabsContent value="register">
            <p>Formulário de Cadastro aqui.</p>
        </TabsContent>
    </Tabs>
</template>
```

### 5. Feedback e Sobreposições (`Modal`, `Toaster`, `Tooltip`, `Avatar`, `Skeleton`)
```vue
<script setup>
import { ref, onMounted } from 'vue';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import Tooltip from '@/components/ui/Tooltip.vue';
import Avatar from '@/components/ui/Avatar.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import { toast } from '@/composables/useToast';
import { Info } from '@lucide/vue';

const isModalOpen = ref(false);
const isLoading = ref(true);

const handleAction = () => {
    toast.success('Sucesso', 'A operação foi concluída.');
    isModalOpen.value = false;
};

onMounted(() => setTimeout(() => isLoading.value = false, 2000));
</script>

<template>
    <div class="space-y-8 p-4">
        <!-- 1. Avatar e Tooltip -->
        <div class="flex items-center gap-4">
            <Avatar class="w-12 h-12" initials="WM" src="[https://github.com/github.png](https://github.com/github.png)"/>
            
            <Tooltip content="Informação importante" position="right">
                <Button size="icon" variant="ghost"><Info class="w-5 h-5"/></Button>
            </Tooltip>
        </div>

        <!-- 2. Skeleton (Loading) -->
        <div v-if="isLoading" class="flex gap-4">
            <Skeleton class="w-12 h-12 rounded-full"/>
            <div class="space-y-2">
                <Skeleton class="w-32 h-4"/>
                <Skeleton class="w-24 h-4"/>
            </div>
        </div>

        <!-- 3. Modal -->
        <Button @click="isModalOpen = true">Abrir Modal</Button>

        <!-- Prop size suporta: sm, md, lg, xl, full -->
        <Modal description="Deseja continuar?" size="md" title="Confirmar" v-model="isModalOpen">
            <p class="text-sm text-muted-foreground">O processo não poderá ser desfeito.</p>
            
            <template #footer>
                <Button @click="isModalOpen = false" variant="ghost">Cancelar</Button>
                <Button @click="handleAction" variant="default">Continuar</Button>
            </template>
        </Modal>
    </div>
</template>
```