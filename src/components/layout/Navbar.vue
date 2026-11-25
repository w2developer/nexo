<script setup>
    import { inject, ref, onMounted, computed, unref } from 'vue';
    import { useRouter, useRoute } from 'vue-router';
    import {
        Menu,
        User,
        LogOut,
        Moon,
        Sun,
        Bell,
        AlertTriangle,
        Award,
        CheckCircle2
    } from '@lucide/vue';
    import Button from '../ui/Button.vue';
    import Dropdown from '../ui/Dropdown.vue';
    import Breadcrumb from '../ui/Breadcrumb.vue';
    import Switch from '@/components/ui/Switch.vue';
    import { useTheme } from '@/composables/useTheme';

    import { usePendencias } from '@/composables/usePendencias';
    import { useRealtime } from '@/composables/useRealtime';

    const { iniciarConexaoGlobal, desconectarGlobal } = useRealtime();
    const { isDark } = useTheme();
    const {
        listaFaltantes,
        faltantesAcaoImediata,
        faltantesCriticos,
        listaCertificados,
        carregarDadosGlobais,
        limparDadosGlobais
    } = usePendencias();

    const toggleMobile = inject('toggleMobile');
    const router = useRouter();
    const route = useRoute();
    const navigation = inject('navigation', []);

    const tipoUsuario = ref((sessionStorage.getItem('tipo_usuario') || '').toLowerCase());
    const nomeUsuario = ref('Usuário');
    const cargoUsuario = ref('');

    // Sino de notificacoes exclusivo da Secretaria
    const ehSecretaria = computed(() => tipoUsuario.value === 'secretaria');

    const breadcrumbItems = computed(() => {
        const role = tipoUsuario.value || 'aluno';
        let basePath = `/${role}`;
        if (role === 'aluno') basePath += '/painel';
        else if (role === 'professor') basePath += '/presenca';
        else if (role === 'secretaria') basePath += '/dashboard';
        else if (role === 'admin') basePath = '/admin';

        const items = [{ label: 'Início', to: basePath, icon: 'home' }];
        const currentPath = route.path;
        let foundExact = false;
        let bestPrefixMatch = null;

        const findInNavigation = (navItems, parents = []) => {
            for (const item of navItems) {
                if (Array.isArray(item.items)) {
                    findInNavigation(item.items, parents);
                    if (foundExact) return;
                    continue;
                }

                if (item.to === currentPath) {
                    parents.forEach((p) => items.push({ label: p.title }));
                    if (item.to !== basePath) {
                        items.push({ label: item.title });
                    }
                    foundExact = true;
                    return;
                }

                if (
                    item.to &&
                    item.to !== '/' &&
                    currentPath.startsWith(`${item.to}/`) &&
                    (!bestPrefixMatch || item.to.length > bestPrefixMatch.item.to.length)
                ) {
                    bestPrefixMatch = { item, parents };
                }

                if (item.children) {
                    findInNavigation(item.children, [...parents, item]);
                    if (foundExact) return;
                }
            }
        };

        const navList = unref(navigation) || [];
        findInNavigation(navList);

        if (!foundExact && currentPath !== basePath) {
            if (bestPrefixMatch) {
                bestPrefixMatch.parents.forEach((p) => items.push({ label: p.title }));
                items.push({ label: bestPrefixMatch.item.title, to: bestPrefixMatch.item.to });
                if (route.meta?.breadcrumb) {
                    items.push({ label: route.meta.breadcrumb });
                }
            } else {
                const labelFallback = route.meta?.breadcrumb;
                if (labelFallback) {
                    items.push({ label: labelFallback });
                } else {
                    const parts = currentPath.split('/').filter(Boolean);
                    if (parts.length > 1) {
                        items.push({ label: parts[parts.length - 1] });
                    }
                }
            }
        }

        return items;
    });

    // Notificacoes estruturadas para a Secretaria
    const todasNotificacoes = computed(() => {
        if (!ehSecretaria.value) return [];

        const notificacoes = [];

        if (listaFaltantes.value.length > 0) {
            const semRetorno = faltantesAcaoImediata.value.length;
            const criticos = faltantesCriticos.value.length;
            let descricao = 'Sem presença há +14 dias';

            if (criticos > 0) {
                descricao = `${semRetorno} sem retorno · ${criticos} há +30 dias`;
            } else if (semRetorno > 0) {
                descricao = `${semRetorno} aguardando contato`;
            }

            notificacoes.push({
                id: 'faltantes',
                titulo: 'Alunos Faltantes',
                descricao,
                quantidade: listaFaltantes.value.length,
                icone: AlertTriangle,
                estiloIcone: 'text-rose-600 dark:text-rose-400',
                estiloBadge: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
                acao: () => router.push({ path: '/secretaria/dashboard', query: { aba: 'faltantes' } })
            });
        }

        if (listaCertificados.value.length > 0) {
            notificacoes.push({
                id: 'certificados',
                titulo: 'Certificados',
                descricao: 'Aguardando emissão ou entrega',
                quantidade: listaCertificados.value.length,
                icone: Award,
                estiloIcone: 'text-indigo-600 dark:text-indigo-400',
                estiloBadge: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
                acao: () => router.push({ path: '/secretaria/dashboard', query: { aba: 'certificados' } })
            });
        }

        return notificacoes;
    });

    const totalNotificacoes = computed(() => {
        return todasNotificacoes.value.reduce((total, notif) => total + notif.quantidade, 0);
    });

    const badgeSinoFormatado = computed(() => {
        if (totalNotificacoes.value <= 0) return '';
        return totalNotificacoes.value > 99 ? '99+' : String(totalNotificacoes.value);
    });

    onMounted(() => {
        iniciarConexaoGlobal();

        const tipo = (sessionStorage.getItem('tipo_usuario') || '').toLowerCase();
        const nome = sessionStorage.getItem('nome_usuario');
        tipoUsuario.value = tipo;

        if (tipo) {
            const formatadorCargos = {
                professor: 'Professor (a)',
                secretaria: 'Secretário (a)',
                admin: 'Administrador (a)',
                aluno: 'Aluno (a)'
            };
            cargoUsuario.value =
                formatadorCargos[tipo] ||
                (tipo.charAt(0).toUpperCase() + tipo.slice(1));
        }

        if (nome) {
            nomeUsuario.value = nome;
        } else {
            const token = sessionStorage.getItem('token_acesso');
            if (token) {
                try {
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    if (payload && payload.nome) {
                        nomeUsuario.value = payload.nome;
                        sessionStorage.setItem('nome_usuario', payload.nome);
                    }
                } catch (e) {
                    console.error('Erro ao decodificar token:', e);
                }
            }
        }

        if (tipo === 'secretaria') {
            carregarDadosGlobais();
        }
    });

    const handleLogout = () => {
        sessionStorage.removeItem('token_acesso');
        sessionStorage.removeItem('tipo_usuario');
        sessionStorage.removeItem('nome_usuario');
        sessionStorage.removeItem('resumo_turno_secretaria_visto');
        sessionStorage.removeItem('faixa_pendencias_secretaria_oculta');

        limparDadosGlobais();
        desconectarGlobal();

        router.push('/login');
    };
</script>

<template>
    <header class="flex h-16 items-center justify-between border-b border-border bg-background px-4 shadow-sm">
        <div class="flex items-center">
            <Button variant="ghost" size="icon" class="mr-2 lg:hidden" @click="toggleMobile">
                <Menu class="h-5 w-5" />
            </Button>
            <Breadcrumb :items="breadcrumbItems" class="hidden md:flex ml-2" />
        </div>

        <div class="flex items-center gap-2 sm:gap-4">
            <div class="flex items-center gap-2">
                <Sun class="w-4 h-4 text-muted-foreground" />
                <Switch id="toggle-tema" v-model="isDark" variant="violet" />
                <Moon class="w-4 h-4 text-muted-foreground" />
            </div>

            <!-- Dropdown do Sino de Notificacoes (Exclusivo Secretaria) -->
            <Dropdown v-if="ehSecretaria" align="right">
                <template #trigger>
                    <button
                        class="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
                        title="Pendências da secretaria"
                        aria-label="Pendências da secretaria"
                    >
                        <Bell class="w-5 h-5" />
                        <span
                            v-if="totalNotificacoes > 0"
                            class="absolute -top-0.5 -right-0.5 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background tabular-nums"
                        >
                            {{ badgeSinoFormatado }}
                        </span>
                    </button>
                </template>

                <template #content>
                    <div class="w-full">
                        <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
                            <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Pendências
                            </h4>
                            <span
                                v-if="totalNotificacoes > 0"
                                class="text-[11px] font-medium text-muted-foreground tabular-nums shrink-0"
                            >
                                {{ totalNotificacoes }} total
                            </span>
                        </div>

                        <div
                            v-if="todasNotificacoes.length === 0"
                            class="px-4 py-5 text-center space-y-1.5"
                        >
                            <CheckCircle2 class="w-6 h-6 mx-auto text-emerald-500" />
                            <p class="text-sm font-medium text-foreground">Tudo em dia!</p>
                            <p class="text-xs text-muted-foreground">Nenhuma pendência no momento.</p>
                        </div>

                        <div v-else class="p-1.5 space-y-1">
                            <button
                                v-for="notif in todasNotificacoes"
                                :key="notif.id"
                                type="button"
                                @click="notif.acao"
                                class="w-full px-2 py-2 rounded-md hover:bg-muted/70 transition-colors cursor-pointer text-left space-y-0.5"
                            >
                                <div class="flex items-center justify-between gap-2">
                                    <div class="flex items-center gap-1.5 min-w-0">
                                        <component
                                            :is="notif.icone"
                                            class="w-3.5 h-3.5 shrink-0"
                                            :class="notif.estiloIcone"
                                        />
                                        <span class="text-[13px] font-medium text-foreground leading-tight truncate">
                                            {{ notif.titulo }}
                                        </span>
                                    </div>

                                    <span
                                        class="px-1.5 py-0.5 rounded-full text-[11px] font-bold leading-none tabular-nums shrink-0"
                                        :class="notif.estiloBadge"
                                    >
                                        {{ notif.quantidade }}
                                    </span>
                                </div>

                                <p class="text-[11px] text-muted-foreground leading-snug pl-5">
                                    {{ notif.descricao }}
                                </p>
                            </button>
                        </div>
                    </div>
                </template>
            </Dropdown>

            <!-- Dropdown de Usuario -->
            <Dropdown align="right">
                <template #trigger>
                    <button class="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer">
                        <User class="h-5 w-5" />
                    </button>
                </template>

                <template #content>
                    <div class="px-4 py-3 border-b border-border mb-1">
                        <p class="text-sm font-medium text-foreground truncate max-w-[180px]">{{ nomeUsuario }}</p>
                        <p class="text-xs text-muted-foreground truncate">Cargo: {{ cargoUsuario }}</p>
                    </div>

                    <div class="px-1">
                        <button
                            @click="handleLogout"
                            class="w-full flex cursor-pointer items-center gap-2 px-3 py-2 text-sm rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-left"
                        >
                            <LogOut class="h-4 w-4" />
                            Sair
                        </button>
                    </div>
                </template>
            </Dropdown>
        </div>
    </header>
</template>