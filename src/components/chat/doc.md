# 📚 Documentação Frontend: Chat Interno (Comunicação em Tempo Real)

Este documento descreve como consumir o composable `useChat.js` para construir uma interface visual (UI) de chat reativa, com suporte a recibos de leitura, status online e indicadores de digitação.

---

## 1. Configuração Obrigatória no Supabase (SQL)

Para que o sistema de mensagens não lidas ("Visto") funcione, a tabela `chat_mensagem` precisa de uma nova coluna e de permissões de atualização. Execute no SQL Editor:

```sql
-- 1. Adiciona a coluna de controle de leitura
ALTER TABLE public.chat_mensagem ADD COLUMN lida BOOLEAN DEFAULT false;

-- 2. Permite que os utilizadores atualizem as mensagens (para as marcar como lidas)
CREATE POLICY "Atualizar status de leitura" ON public.chat_mensagem FOR UPDATE TO authenticated USING (true);
```

---

## 2. Variáveis de Estado (O que injetar no Template Vue)

Extraia estas variáveis do `useChat()` para construir a sua reatividade visual.

| Variável | Tipo | Descrição | Sugestão de Uso na UI |
| :--- | :--- | :--- | :--- |
| `colegas` | Array | Lista de todos os membros da equipa, exceto o utilizador logado. | `v-for="c in colegas"` para construir a barra lateral de contactos. |
| `mensagens` | Array | Histórico de mensagens da conversa atualmente aberta. | `v-for="msg in mensagens"` para renderizar os balões de conversa. |
| `colegaAtivo` | Object/Null | O objeto do utilizador com quem está a conversar. | Usar `v-if="!colegaAtivo"` para mostrar a lista, e `v-else` para mostrar o chat. |
| `carregando` | Boolean | `true` durante a transição de abertura de uma sala. | Exibir um *spinner* ou bloquear a UI momentaneamente. |
| `usuariosOnline` | Array de Strings | Contém os IDs de todos os utilizadores com o sistema aberto agora. | `v-if="usuariosOnline.includes(colega.id)"` para renderizar o ponto verde (online). |
| `quemEstaDigitando` | Array de Strings | IDs dos utilizadores que estão a escrever na sala ativa. | `v-if="quemEstaDigitando.length > 0"` exibe a animação "A escrever...". |
| `naoLidasGlobais` | Object | Dicionário com a contagem de não lidas por `sala_id`. | Exibir um ícone numérico (Badge) junto ao nome do contacto na lista. |

---

## 3. Funções e Ações (Eventos da Interface)

Associe estas funções aos cliques e eventos do seu HTML.

| Função | Parâmetros | Quando e onde disparar |
| :--- | :--- | :--- |
| `initChat` | `(id, nome)` | No `onMounted` do seu Layout principal. Regista a presença e liga o WebSocket. |
| `abrirChatCom` | `(colega)` | No evento `@click` em cima do nome de um contacto na lista lateral. |
| `fecharChat` | - | Num botão "Voltar" (`<`) ou ao pressionar a tecla `Esc`. |
| `enviarMensagem` | `(texto)` | No evento `@submit.prevent` do formulário. **Importante:** use `await` e bloqueie o botão. |
| `excluirMensagem` | `(msg_id)` | Num ícone de caixote do lixo (`Trash`) que aparece ao passar o rato na sua própria mensagem. |
| `sinalizarDigitacao` | - | No evento `@input` do seu `<input>` ou `<textarea>`. Informa a outra pessoa que está a escrever. |

---

## 4. Guia de Implementação do Layout (Passo a Passo)

### Passo A: Inicialização Global
O chat não deve iniciar apenas quando abre a janela. Inicie-o no nível mais alto da aplicação (ex: `App.vue` ou `LayoutDashboard.vue`) para que o utilizador apareça *Online* para os outros mesmo quando não tem o chat aberto.

### Passo B: Construção da Lista de Contactos (Sidebar)
1. **Iteração:** Crie um botão para cada utilizador: `<button v-for="colega in colegas" @click="abrirChatCom(colega)">`
2. **Ponto Online:** Dentro do botão, faça uma verificação de presença: 
   `<div :class="usuariosOnline.includes(colega.id) ? 'bg-green-500' : 'bg-gray-300'"></div>`
3. **Notificação de Não Lidas:** (Opcional) Pode cruzar o `colega.id` com as `naoLidasGlobais` para exibir quantas mensagens estão à espera.

### Passo C: Construção do Bate-Papo
1. **Scroll Automático:** 
   O Vue não rola a tela sozinho. Deve usar um `watch` para monitorizar a variável `mensagens`. Sempre que ela mudar, aplique um `nextTick` e rode o container para a base (`scrollTop = scrollHeight`).
2. **Alinhamento dos Balões:** 
   Avalie a propriedade `remetente_id` de cada mensagem.
   - Se `msg.remetente_id === currentUser.id`: É sua. Use `justify-end` e balão azul.
   - Se for diferente: É do colega. Use `justify-start` e balão cinza.
3. **Indicador de "Visto" (Duplo Check):**
   Nas mensagens azuis (as suas), adicione um ícone de "check". Se `msg.lida === true`, altere a cor do ícone para azul vibrante para simular a confirmação de leitura.
4. **Digitando:**
   Acima do formulário de envio, coloque uma div simples:
   `<div v-if="quemEstaDigitando.length > 0" class="text-xs text-gray-500">O colega está a escrever...</div>`

### Passo D: Formulário de Envio
No campo de texto, adicione o evento de digitação:
`<input v-model="texto" @input="sinalizarDigitacao" />`
Isto enviará pequenos pacotes (Broadcasts) via WebSocket para a outra ponta, sem tocar na base de dados (o composable trata de limpar a indicação se a pessoa parar de escrever por 3 segundos).

---

## 5. Exemplos Práticos de Uso (Código Frontend)

Aqui estão exemplos diretos de como implementar o composable nos seus componentes Vue.

### Exemplo 1: Inicialização (No Layout Principal ou App.vue)
O ideal é iniciar o chat no topo da aplicação para que o seu status "Online" seja transmitido mesmo que a janela do chat esteja fechada.

```vue
<script setup>
    import { onMounted } from 'vue';
    import { useChat } from '@/composables/useChat';

    const { initChat } = useChat();

    onMounted(() => {
        // Exemplo: Recuperar os dados do utilizador logado no seu sistema
        const userId = '123e4567-e89b-12d3-a456-426614174000'; 
        const userName = 'Mateus Santos';
        
        // Arranca o motor do chat
        initChat(userId, userName);
    });
</script>
```

### Exemplo 2: A Lista de Colegas (Barra Lateral)
Como exibir a equipa, verificar quem está online e mostrar as mensagens não lidas.

```vue
<template>
    <div class="lista-contatos">
        <button 
            v-for="colega in colegas" 
            :key="colega.id" 
            @click="abrirChatCom(colega)"
        >
            <!-- Nome do Colega -->
            <span>{{ colega.nome }}</span>

            <!-- Indicador Online / Offline -->
            <span v-if="usuariosOnline.includes(colega.id)">🟢 Online</span>
            <span v-else>⚪ Offline</span>

            <!-- Badge de Mensagens Não Lidas (Opcional) -->
            <span v-if="naoLidasGlobais[colega.sala_id] > 0">
                {{ naoLidasGlobais[colega.sala_id] }} novas
            </span>
        </button>
    </div>
</template>

<script setup>
    import { useChat } from '@/composables/useChat';

    const { 
        colegas, 
        usuariosOnline, 
        naoLidasGlobais, 
        abrirChatCom 
    } = useChat();
</script>
```

### Exemplo 3: A Janela de Bate-Papo
Como renderizar os balões, o indicador de "digitando", o duplo check de leitura e o formulário de envio.

```vue
<template>
    <div v-if="colegaAtivo" class="chat-container">
        <!-- Cabeçalho -->
        <header>
            <button @click="fecharChat">Voltar</button>
            <h2>Chat com {{ colegaAtivo.nome }}</h2>
        </header>

        <!-- Área de Mensagens -->
        <main ref="containerMensagens" class="mensagens-lista">
            <div 
                v-for="msg in mensagens" 
                :key="msg.id"
                :class="msg.remetente_id === currentUser.id ? 'minha-mensagem' : 'mensagem-colega'"
            >
                <p>{{ msg.texto }}</p>
                
                <!-- Status da Mensagem (Só aparece nas suas mensagens) -->
                <div v-if="msg.remetente_id === currentUser.id">
                    <span v-if="msg.lida">✓✓ Lida</span>
                    <span v-else>✓ Enviada</span>
                    
                    <button @click="excluirMensagem(msg.id)">Apagar</button>
                </div>
            </div>
        </main>

        <!-- Indicador de Digitação -->
        <div v-if="quemEstaDigitando.length > 0">
            O colega está a escrever...
        </div>

        <!-- Formulário -->
        <form @submit.prevent="enviar">
            <input 
                v-model="texto" 
                @input="sinalizarDigitacao" 
                placeholder="Escreva a sua mensagem..." 
            />
            <button type="submit" :disabled="!texto.trim()">Enviar</button>
        </form>
    </div>
</template>

<script setup>
    import { ref, watch, nextTick } from 'vue';
    import { useChat } from '@/composables/useChat';

    const { 
        colegaAtivo, 
        mensagens, 
        currentUser, 
        quemEstaDigitando,
        enviarMensagem, 
        excluirMensagem, 
        sinalizarDigitacao,
        fecharChat
    } = useChat();

    const texto = ref('');
    const containerMensagens = ref(null);

    // Scroll automático para a última mensagem
    watch(mensagens, async () => {
        await nextTick();
        if (containerMensagens.value) {
            containerMensagens.value.scrollTop = containerMensagens.value.scrollHeight;
        }
    }, { deep: true });

    // Função de envio separada para limpar o input rapidamente
    const enviar = async () => {
        if (!texto.value.trim()) return;
        
        const mensagemPronta = texto.value;
        texto.value = ''; // Limpa o campo visualmente no momento do clique
        
        await enviarMensagem(mensagemPronta);
    };
</script>
```