<script setup>
    import { ref, computed, onMounted } from 'vue';
    import { useRoute, useRouter } from 'vue-router';
    import { supabase } from '@/lib/supabase';
    import { ArrowLeft, Save, Clock, RotateCcw, ChevronRight } from '@lucide/vue';
    import { toast } from '@/composables/useToast';
    import { formatarNome } from '@/utils/formatters';
    import { 
        DIAS_SEMANA_GRADE, 
        TURNOS_GRADE, 
        criarChaveSlot 
    } from '@/utils/scheduleHelpers';

    import Button from '@/components/ui/Button.vue';
    import Card from '@/components/ui/Card.vue';
    import CardContent from '@/components/ui/CardContent.vue';
    import Badge from '@/components/ui/Badge.vue';
    import Switch from '@/components/ui/Switch.vue';
    import Avatar from '@/components/ui/Avatar.vue';

    const route = useRoute();
    const router = useRouter();
    const matriculaId = route.params.id;

    // Estados
    const matricula = ref(null);
    const carregando = ref(true);
    const salvando = ref(false);
    const diaExpandido = ref(null);
    const slotsAtivos = ref(new Set());

    // Total de horas na semana
    const totalHorasAtivas = computed(() => slotsAtivos.value.size);

    // Abre ou fecha a sublista do dia
    const toggleExpandirDia = (diaValue) => {
        diaExpandido.value = diaExpandido.value === diaValue ? null : diaValue;
    };

    // Verificadores de estado
    const isSlotAtivo = (dia, turno, horaInicio) => {
        return slotsAtivos.value.has(criarChaveSlot(dia, turno, horaInicio));
    };

    const isTurnoDiaCompleto = (dia, turnoObj) => {
        return turnoObj.slots.every(s => isSlotAtivo(dia, turnoObj.value, s.hora_inicio));
    };

    const isDiaCompleto = (dia) => {
        return TURNOS_GRADE.every(t => isTurnoDiaCompleto(dia, t));
    };

    const isTurnoSemanaCompleta = (turnoValue) => {
        const turnoObj = TURNOS_GRADE.find(t => t.value === turnoValue);
        if (!turnoObj) return false;
        return DIAS_SEMANA_GRADE.every(d => isTurnoDiaCompleto(d.value, turnoObj));
    };

    const contarHorasDia = (dia) => {
        let count = 0;
        TURNOS_GRADE.forEach(t => {
            t.slots.forEach(s => {
                if (isSlotAtivo(dia, t.value, s.hora_inicio)) count++;
            });
        });
        return count;
    };

    // Ações dos Switches
    const toggleSlot = (dia, turno, horaInicio, valor) => {
        const novoSet = new Set(slotsAtivos.value);
        const chave = criarChaveSlot(dia, turno, horaInicio);

        if (valor) novoSet.add(chave);
        else novoSet.delete(chave);

        slotsAtivos.value = novoSet;
    };

    const toggleTurnoDia = (dia, turnoObj, valor) => {
        const novoSet = new Set(slotsAtivos.value);

        turnoObj.slots.forEach(s => {
            const chave = criarChaveSlot(dia, turnoObj.value, s.hora_inicio);
            if (valor) novoSet.add(chave);
            else novoSet.delete(chave);
        });

        slotsAtivos.value = novoSet;
    };

    const toggleDiaInteiro = (dia, valor) => {
        const novoSet = new Set(slotsAtivos.value);

        TURNOS_GRADE.forEach(t => {
            t.slots.forEach(s => {
                const chave = criarChaveSlot(dia, t.value, s.hora_inicio);
                if (valor) novoSet.add(chave);
                else novoSet.delete(chave);
            });
        });

        slotsAtivos.value = novoSet;
    };

    const toggleTurnoSemana = (turnoValue, valor) => {
        const turnoObj = TURNOS_GRADE.find(t => t.value === turnoValue);
        if (!turnoObj) return;

        const novoSet = new Set(slotsAtivos.value);

        DIAS_SEMANA_GRADE.forEach(d => {
            turnoObj.slots.forEach(s => {
                const chave = criarChaveSlot(d.value, turnoObj.value, s.hora_inicio);
                if (valor) novoSet.add(chave);
                else novoSet.delete(chave);
            });
        });

        slotsAtivos.value = novoSet;
    };

    const limparTudo = () => {
        slotsAtivos.value = new Set();
    };

    // Busca dados da matrícula
    const carregarDados = async () => {
        carregando.value = true;
        try {
            const { data, error } = await supabase
                .from('matricula')
                .select('id, ead, horario, aluno(id, nome, codigo), curso(nome)')
                .eq('id', matriculaId)
                .single();

            if (error) throw error;
            matricula.value = data;

            const novoSet = new Set();
            const listaSalva = data.horario?.horario;

            if (Array.isArray(listaSalva)) {
                listaSalva.forEach(item => {
                    if (item.dia_semana && item.turno && item.hora_inicio) {
                        novoSet.add(criarChaveSlot(item.dia_semana, item.turno, item.hora_inicio));
                    }
                });
            }

            slotsAtivos.value = novoSet;
        } catch (err) {
            console.error("Erro ao carregar matrícula:", err);
            toast.error("Erro", "Não foi possível carregar os horários do aluno.");
            router.back();
        } finally {
            carregando.value = false;
        }
    };

    // Salva JSONB no banco
    const salvarHorarios = async () => {
        salvando.value = true;
        try {
            const arrayHorarios = [];

            DIAS_SEMANA_GRADE.forEach(dia => {
                TURNOS_GRADE.forEach(turno => {
                    turno.slots.forEach(slot => {
                        if (isSlotAtivo(dia.value, turno.value, slot.hora_inicio)) {
                            arrayHorarios.push({
                                turno: turno.value,
                                dia_semana: dia.value,
                                hora_inicio: slot.hora_inicio,
                                hora_fim: slot.hora_fim
                            });
                        }
                    });
                });
            });

            const { error } = await supabase
                .from('matricula')
                .update({
                    horario: { horario: arrayHorarios },
                    atualizado_em: new Date().toISOString()
                })
                .eq('id', matriculaId);

            if (error) throw error;

            toast.success("Sucesso", "Grade de horários salva com sucesso!");
            router.back();
        } catch (err) {
            console.error("Erro ao salvar horários:", err);
            toast.error("Erro", "Não foi possível salvar os horários.");
        } finally {
            salvando.value = false;
        }
    };

    onMounted(carregarDados);
</script>

<template>
    <div class="space-y-4">
        <!-- Cabeçalho Responsivo do Aluno -->
        <Card>
            <CardContent class="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <!-- Info do Aluno -->
                <div class="flex items-center gap-3 min-w-0 flex-1">
                    <Button variant="outline" size="sm" @click="router.back()" class="px-2.5 shrink-0">
                        <ArrowLeft class="w-4 h-4" />
                    </Button>

                    <template v-if="!carregando && matricula">
                        <Avatar :name="matricula.aluno?.nome" class="shrink-0" />
                        <div class="min-w-0 flex-1">
                            <h2 class="font-bold text-base sm:text-lg text-slate-900 leading-tight truncate">
                                {{ formatarNome(matricula.aluno?.nome) }}
                            </h2>
                            <p class="text-xs text-slate-500 truncate">
                                {{ matricula.curso?.nome || 'Curso não informado' }} • Cód: {{ matricula.aluno?.codigo }}
                            </p>
                        </div>
                    </template>
                    <div v-else class="text-sm text-muted-foreground">Carregando aluno...</div>
                </div>

                <!-- Barra de Ações e Contador -->
                <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between lg:justify-end gap-2.5 border-t lg:border-t-0 pt-3 lg:pt-0 border-border shrink-0">
                    <div class="flex items-center justify-between sm:justify-start gap-2">
                        <Badge variant="secondary" class="px-3 py-1 text-xs flex items-center gap-1.5 shrink-0">
                            <Clock class="w-3.5 h-3.5" />
                            {{ totalHorasAtivas }}h semanais
                        </Badge>

                        <Button 
                            variant="ghost" 
                            size="sm" 
                            @click="limparTudo" 
                            :disabled="salvando || totalHorasAtivas === 0"
                            class="text-slate-600"
                        >
                            <RotateCcw class="w-4 h-4 mr-1" />
                            Limpar
                        </Button>
                    </div>

                    <Button 
                        variant="default" 
                        size="sm" 
                        @click="salvarHorarios" 
                        :disabled="salvando || carregando"
                        class="w-full sm:w-auto justify-center"
                    >
                        <Save class="w-4 h-4 mr-1.5" />
                        {{ salvando ? 'Salvando...' : 'Salvar Horários' }}
                    </Button>
                </div>
            </CardContent>
        </Card>

        <!-- Atalho Global de Turnos (Cor: Violet) -->
        <Card v-if="!carregando">
            <CardContent class="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-violet-600 shrink-0"></span>
                    <span class="text-sm font-semibold text-slate-700">
                        Ativar turno na semana toda (Seg a Sáb):
                    </span>
                </div>

                <div class="flex flex-wrap items-center gap-4 sm:gap-6">
                    <div 
                        v-for="turno in TURNOS_GRADE" 
                        :key="'global-' + turno.value"
                        class="flex items-center gap-2"
                    >
                        <Switch 
                            variant="violet"
                            :id="'switch-global-' + turno.value"
                            :model-value="isTurnoSemanaCompleta(turno.value)"
                            @update:model-value="toggleTurnoSemana(turno.value, $event)"
                        />
                        <label :for="'switch-global-' + turno.value" class="text-sm font-medium text-slate-700 cursor-pointer select-none">
                            {{ turno.label }}
                        </label>
                    </div>
                </div>
            </CardContent>
        </Card>

        <!-- Lista Expansível por Dia da Semana -->
        <Card>
            <div v-if="carregando" class="p-12 text-center text-muted-foreground">
                Carregando grade de horários...
            </div>

            <div v-else class="flex flex-col">
                <div 
                    v-for="dia in DIAS_SEMANA_GRADE" 
                    :key="dia.value"
                    class="border-b border-border last:border-0 flex flex-col transition-colors"
                    :class="{'bg-slate-50/40': diaExpandido === dia.value}"
                >
                    <!-- Linha Principal do Dia -->
                    <div 
                        class="flex items-center justify-between gap-3 p-3.5 md:p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                        @click="toggleExpandirDia(dia.value)"
                    >
                        <!-- Esquerda: Seta + Nome do Dia + Contador -->
                        <div class="flex items-center gap-3 min-w-0">
                            <div 
                                class="text-slate-400 transition-transform duration-300 ease-in-out shrink-0"
                                :class="{'rotate-90 text-indigo-600': diaExpandido === dia.value}"
                            >
                                <ChevronRight class="w-5 h-5" />
                            </div>

                            <span class="font-bold text-slate-900 text-sm sm:text-base">
                                {{ dia.label }}
                            </span>

                            <Badge 
                                :variant="contarHorasDia(dia.value) > 0 ? 'default' : 'secondary'" 
                                class="text-[11px] px-2 py-0"
                            >
                                {{ contarHorasDia(dia.value) }}h
                            </Badge>
                        </div>

                        <!-- Direita: Switch do Dia Todo (Cor: Emerald) -->
                        <div class="flex items-center gap-2 shrink-0" @click.stop>
                            <label :for="`dia-${dia.value}`" class="text-xs font-medium text-slate-600 cursor-pointer select-none">
                                Dia todo
                            </label>
                            <Switch 
                                variant="emerald"
                                :id="`dia-${dia.value}`"
                                :model-value="isDiaCompleto(dia.value)"
                                @update:model-value="toggleDiaInteiro(dia.value, $event)"
                            />
                        </div>
                    </div>

                    <!-- Sublista Expansível: Turnos Lado a Lado -->
                    <div 
                        class="grid transition-all duration-300 ease-in-out"
                        :class="diaExpandido === dia.value ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'"
                    >
                        <div class="overflow-hidden">
                            <div class="p-4 pt-1 pl-4 md:pl-12 bg-slate-50/50 border-t border-slate-100">
                                <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-2">
                                    <!-- Card de cada Turno -->
                                    <div 
                                        v-for="turno in TURNOS_GRADE" 
                                        :key="`${dia.value}-${turno.value}`"
                                        class="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm space-y-3"
                                    >
                                        <!-- Cabeçalho do Turno (Cor: Amber) -->
                                        <div class="flex items-center justify-between pb-2 border-b border-slate-100">
                                            <div class="flex items-center gap-1.5">
                                                <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                                                <span class="text-xs font-bold uppercase tracking-wider text-slate-700">
                                                    {{ turno.label }}
                                                </span>
                                            </div>

                                            <div class="flex items-center gap-2">
                                                <label 
                                                    :for="`turno-${dia.value}-${turno.value}`" 
                                                    class="text-[11px] font-medium text-slate-500 cursor-pointer select-none"
                                                >
                                                    Turno completo
                                                </label>
                                                <Switch 
                                                    variant="amber"
                                                    :id="`turno-${dia.value}-${turno.value}`"
                                                    :model-value="isTurnoDiaCompleto(dia.value, turno)"
                                                    @update:model-value="toggleTurnoDia(dia.value, turno, $event)"
                                                />
                                            </div>
                                        </div>

                                        <!-- Lista de Horas (Cor: Default/Primary) -->
                                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2">
                                            <div 
                                                v-for="slot in turno.slots" 
                                                :key="slot.hora_inicio"
                                                class="flex items-center justify-between px-2.5 py-1.5 rounded-md border transition-colors"
                                                :class="isSlotAtivo(dia.value, turno.value, slot.hora_inicio) 
                                                    ? 'bg-indigo-50/60 border-indigo-200 text-indigo-950' 
                                                    : 'bg-slate-50/50 border-slate-200 text-slate-600'"
                                            >
                                                <label 
                                                    :for="`slot-${dia.value}-${turno.value}-${slot.hora_inicio}`"
                                                    class="text-xs font-medium cursor-pointer select-none"
                                                >
                                                    {{ slot.hora_inicio }} - {{ slot.hora_fim }}
                                                </label>

                                                <Switch 
                                                    variant="default"
                                                    :id="`slot-${dia.value}-${turno.value}-${slot.hora_inicio}`"
                                                    :model-value="isSlotAtivo(dia.value, turno.value, slot.hora_inicio)"
                                                    @update:model-value="toggleSlot(dia.value, turno.value, slot.hora_inicio, $event)"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    </div>
</template>