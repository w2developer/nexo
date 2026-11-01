import { ref, watch, onMounted } from 'vue';

// Estado global compartilhado
const isDark = ref(false);
let inicializado = false;

export function useTheme() {
    // Aplica a classe .dark na tag <html> e salva preferência
    const aplicarTema = (escuro) => {
        if (typeof document === 'undefined') return;
        const html = document.documentElement;

        if (escuro) {
            html.classList.add('dark');
            localStorage.setItem('w2_tema', 'dark');
        } else {
            html.classList.remove('dark');
            localStorage.setItem('w2_tema', 'light');
        }
    };

    // Observa mudanças vindas do v-model do Switch
    watch(isDark, (novoValor) => {
        aplicarTema(novoValor);
    });

    // Carrega o tema salvo ou do sistema operacional
    const initTheme = () => {
        if (inicializado || typeof window === 'undefined') return;
        inicializado = true;

        const temaSalvo = localStorage.getItem('w2_tema');
        if (temaSalvo) {
            isDark.value = temaSalvo === 'dark';
        } else {
            isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        aplicarTema(isDark.value);
    };

    onMounted(() => {
        initTheme();
    });

    return {
        isDark,
        initTheme
    };
}