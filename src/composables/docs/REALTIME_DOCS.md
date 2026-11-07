# 📡 Documentação: Gerenciador Global de Realtime (Supabase)

## 📌 O Problema
Antes, cada tela (Dashboard, Presença, Matrícula) abria sua própria conexão com o Supabase usando `supabase.channel()`. 
Isso causava:
1. Esgotamento do limite de conexões do plano do Supabase.
2. Lentidão no sistema (múltiplos WebSockets abertos).
3. Conflito de dados quando o usuário trocava de tela sem atualizar a página.

## 💡 A Solução (O "Maestro")
O composable `useRealtime.js` cria **uma única conexão mestre** com o banco de dados. Quando uma tabela sofre um `INSERT`, `UPDATE` ou `DELETE`, o maestro capta essa mudança e grita para o navegador inteiro usando eventos nativos do JavaScript (`document.dispatchEvent`).
Qualquer tela pode simplesmente "ouvir" esse grito e se atualizar, sem precisar falar com o banco diretamente para criar canais.

---

## 🛠️ 1. Como Iniciar e Desligar o Maestro

A conexão mestre deve ser iniciada quando o usuário entra no sistema e desligada quando ele sai. O local ideal para isso é o `Navbar.vue` (ou `App.vue`).

```vue
<!-- Exemplo no Navbar.vue -->
<script setup>
import { onMounted } from 'vue';
import { useRealtime } from '@/composables/useRealtime';

const { iniciarConexaoGlobal, desconectarGlobal } = useRealtime();

onMounted(() => {
    // 1. Liga o motor quando o Navbar carregar
    iniciarConexaoGlobal();
});

const sairDoSistema = () => {
    // 2. Desliga o motor ao fazer logout para não gastar recursos
    desconectarGlobal();
    // ... limpa sessionStorage e redireciona para /login
};
</script>
```

---

## 🎧 2. Como "Ouvir" as mudanças em qualquer Tela

Para reagir a uma mudança no banco em qualquer arquivo `.vue`, você não importa mais o Supabase. Você apenas usa `document.addEventListener`.

**⚠️ Regra de Ouro:** Sempre que usar `addEventListener` no `onMounted`, você **DEVE** usar `removeEventListener` no `onUnmounted`. Se não fizer isso, a tela vai continuar escutando o evento mesmo depois de fechada, causando vazamento de memória e chamadas duplicadas.

```vue
<!-- Exemplo: TelaControleAlunos.vue -->
<script setup>
import { onMounted, onUnmounted } from 'vue';

const buscarAlunos = async () => {
    // ... sua função normal de buscar dados com await supabase...
    console.log("Atualizando lista de alunos...");
};

onMounted(() => {
    buscarAlunos();

    // Começa a escutar as mudanças na tabela de ALUNO e MATRICULA
    document.addEventListener('db-update-aluno', buscarAlunos);
    document.addEventListener('db-update-matricula', buscarAlunos);
});

onUnmounted(() => {
    // Para de escutar quando o usuário sai desta tela
    document.removeEventListener('db-update-aluno', buscarAlunos);
    document.removeEventListener('db-update-matricula', buscarAlunos);
});
</script>
```

---

## 🔍 3. Como ler exatamente o que mudou (Payload)

Se você não quer recarregar a lista inteira, mas apenas pegar a nova mensagem que chegou (ex: no Chat), o evento nativo traz os dados completos do Supabase dentro de `event.detail`.

```vue
<!-- Exemplo: Chat.vue -->
<script setup>
import { onMounted, onUnmounted } from 'vue';

const receberNovaMensagem = (event) => {
    const payload = event.detail; // Aqui estão os dados do Supabase!

    if (payload.eventType === 'INSERT') {
        console.log("Nova mensagem chegou:", payload.new.texto);
        // listaMensagens.value.push(payload.new);
    } 
    else if (payload.eventType === 'UPDATE') {
        console.log("Mensagem foi editada ou recebeu like:", payload.new);
    }
    else if (payload.eventType === 'DELETE') {
        console.log("Mensagem deletada ID:", payload.old.id);
    }
};

onMounted(() => {
    document.addEventListener('db-update-chat-mensagem', receberNovaMensagem);
});

onUnmounted(() => {
    document.removeEventListener('db-update-chat-mensagem', receberNovaMensagem);
});
</script>
```

---

## ➕ 4. Como habilitar novas tabelas no futuro

O `useRealtime.js` já possui todas as tabelas do seu banco mapeadas, mas algumas estão comentadas (inativas) para economizar processamento enquanto as telas (como o Chat) ainda não existem.

Quando você for criar o Chat, basta ir no arquivo `src/composables/useRealtime.js`, procurar a seção de "EVENTOS INATIVOS" e retirar os comentários:

```javascript
// Antes (Comentado):
/*
.on('postgres_changes', { event: '*', schema: 'public', table: 'chat_mensagem' }, (payload) => {
    document.dispatchEvent(new CustomEvent('db-update-chat-mensagem', { detail: payload }));
})
*/

// Depois (Ativo):
.on('postgres_changes', { event: '*', schema: 'public', table: 'chat_mensagem' }, (payload) => {
    document.dispatchEvent(new CustomEvent('db-update-chat-mensagem', { detail: payload }));
})
```