<script setup>
    import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
    import { supabase } from '@/lib/supabase';
    import {
        Plus,
        Search,
        Menu,
        Pencil,
        Trash2,
        Loader2,
        ChevronRight,
        Layers,
        Upload,
        FileText,
        X
    } from '@lucide/vue';
    import { toast } from '@/composables/useToast';
    import {
        ordenarPorOrdemENome,
        moverItemNaLista,
        posicionarItemPorNumero,
        calcularNormalizacaoOrdem
    } from '../utils/ordenacao';

    import Card from '@/components/ui/Card.vue';
    import CardContent from '@/components/ui/CardContent.vue';
    import Button from '@/components/ui/Button.vue';
    import Input from '@/components/ui/Input.vue';
    import Select from '@/components/ui/Select.vue';
    import Badge from '@/components/ui/Badge.vue';
    import FormGroup from '@/components/ui/FormGroup.vue';
    import Dropdown from '@/components/ui/Dropdown.vue';
    import Modal from '@/components/ui/Modal.vue';
    import ControleOrdem from './ControleOrdem.vue';
    import BotaoCanalLink from './BotaoCanalLink.vue';
    import ModalGerenciarModulos from './ModalGerenciarModulos.vue';

    const BUCKET_ATIVIDADES = 'atividades';
    const TAMANHO_MAX_PDF_BYTES = 10 * 1024 * 1024;

    const emit = defineEmits(['update-total']);

    // Dados do banco
    const cursos = ref([]);
    const modulos = ref([]);
    const cursoModulos = ref([]);
    const dificuldades = ref([]);
    const atividades = ref([]);

    // Estados de interface
    const termoPesquisa = ref('');
    const filtroCurso = ref('todos');
    const carregando = ref(true);
    const salvando = ref(false);
    const excluindo = ref(false);
    const reordenando = ref(false);
    const moduloExpandido = ref(null);
    let realtimeChannel = null;
    let realtimeTimerAtividades = null;
    let realtimeTimerModulos = null;

    // Estados de Drag & Drop (separados para modulos e atividades)
    const dragModuloOrigem = ref(null);
    const dragModuloAlvo = ref(null);
    const dragAtividadeOrigem = ref(null);
    const dragAtividadeAlvo = ref(null);

    // Modal de modulos
    const modalModulosAberto = ref(false);

    // Modal de atividade e upload de PDF
    const modalFormularioAberto = ref(false);
    const editandoId = ref(null);
    const moduloOriginalEdicao = ref('sem_modulo');
    const inputPdfRef = ref(null);
    const arquivoPdfSelecionado = ref(null);
    const pdfUrlOriginal = ref('');
    const removerPdfAtual = ref(false);
    const form = ref({
        modulo_id: '',
        dificuldade_id: '',
        nome: '',
        ordem: '1',
        pdf_url: '',
        drive_url: '',
        mega_url: '',
        outro_url: ''
    });

    // Modal de exclusao
    const modalExcluirAberto = ref(false);
    const atividadeParaExcluir = ref(null);

    watch(
        () => atividades.value.length,
        (total) => emit('update-total', total)
    );

    watch(modalFormularioAberto, (aberto) => {
        if (!aberto) {
            arquivoPdfSelecionado.value = null;
            removerPdfAtual.value = false;
            limparInputPdf();
        }
    });

    const getChaveModulo = (moduloId) => {
        return moduloId ? String(moduloId) : 'sem_modulo';
    };

    const obterAtividadesDoModulo = (chaveModulo) => {
        return ordenarPorOrdemENome(
            atividades.value.filter(item => getChaveModulo(item.modulo_id) === chaveModulo)
        );
    };

    const cursoFiltradoId = computed(() => {
        if (filtroCurso.value === 'todos' || filtroCurso.value === 'sem_curso') {
            return null;
        }
        return Number(filtroCurso.value);
    });

    const opcoesFiltroCurso = computed(() => [
        { label: 'Todos os cursos', value: 'todos' },
        ...cursos.value.map(c => ({ label: c.nome, value: String(c.id) })),
        { label: 'Sem curso vinculado', value: 'sem_curso' }
    ]);

    const opcoesModuloModal = computed(() => [
        { label: 'Sem módulo vinculado', value: '' },
        ...modulos.value.map(m => ({ label: m.nome, value: String(m.id) }))
    ]);

    const opcoesDificuldadeModal = computed(() =>
        dificuldades.value.map(d => ({
            label: `${d.nome} (${d.pontos} pts)`,
            value: String(d.id)
        }))
    );

    const mapaDificuldades = computed(() => {
        return new Map(dificuldades.value.map(d => [d.id, d]));
    });

    const mapaCursosPorModulo = computed(() => {
        const mapaCursos = new Map(cursos.value.map(c => [c.id, c]));
        const resultado = new Map();

        cursoModulos.value.forEach(rel => {
            const curso = mapaCursos.get(rel.curso_id);
            if (!curso) return;

            if (!resultado.has(rel.modulo_id)) {
                resultado.set(rel.modulo_id, []);
            }
            resultado.get(rel.modulo_id).push({
                ...curso,
                ordemNoCurso: rel.ordem || 0
            });
        });

        resultado.forEach(lista => {
            lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        });

        return resultado;
    });

    const possuiPdfAtualAtivo = computed(() => {
        return Boolean(form.value.pdf_url && !removerPdfAtual.value && !arquivoPdfSelecionado.value);
    });

    // Agrupamento de atividades por modulo (ordenado por curso_modulo.ordem quando filtrado por curso)
    const gruposModulos = computed(() => {
        const termo = termoPesquisa.value.toLowerCase().trim();
        const atividadesPorModulo = new Map();
        const semModuloItens = [];

        atividades.value.forEach(item => {
            if (!item.modulo_id) {
                semModuloItens.push(item);
                return;
            }
            if (!atividadesPorModulo.has(item.modulo_id)) {
                atividadesPorModulo.set(item.modulo_id, []);
            }
            atividadesPorModulo.get(item.modulo_id).push(item);
        });

        const listaGrupos = [];

        modulos.value.forEach(mod => {
            const cursosDoModulo = mapaCursosPorModulo.value.get(mod.id) || [];

            if (filtroCurso.value === 'sem_curso' && cursosDoModulo.length > 0) {
                return;
            }
            if (
                cursoFiltradoId.value !== null &&
                !cursosDoModulo.some(c => c.id === cursoFiltradoId.value)
            ) {
                return;
            }

            const itensModulo = atividadesPorModulo.get(mod.id) || [];
            const correspondeModuloOuCurso =
                !termo ||
                mod.nome.toLowerCase().includes(termo) ||
                cursosDoModulo.some(c => c.nome.toLowerCase().includes(termo));

            const itensFiltrados = correspondeModuloOuCurso
                ? [...itensModulo]
                : itensModulo.filter(item => item.nome.toLowerCase().includes(termo));

            if (termo && !correspondeModuloOuCurso && itensFiltrados.length === 0) {
                return;
            }

            const relacaoCursoAtual = cursoFiltradoId.value !== null
                ? cursosDoModulo.find(c => c.id === cursoFiltradoId.value)
                : null;

            listaGrupos.push({
                id: String(mod.id),
                moduloId: mod.id,
                nome: mod.nome,
                semModulo: false,
                ordemNoCurso: relacaoCursoAtual?.ordemNoCurso || 0,
                cursos: cursosDoModulo,
                itens: ordenarPorOrdemENome(itensFiltrados)
            });
        });

        const gruposOrdenados = cursoFiltradoId.value !== null
            ? ordenarPorOrdemENome(listaGrupos, 'ordemNoCurso', 'nome')
            : [...listaGrupos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

        // Inclui grupo "Sem modulo vinculado" apenas quando houver atividades soltas
        if (
            semModuloItens.length > 0 &&
            (filtroCurso.value === 'todos' || filtroCurso.value === 'sem_curso')
        ) {
            const itensSoltos = termo
                ? semModuloItens.filter(item => item.nome.toLowerCase().includes(termo))
                : [...semModuloItens];

            if (itensSoltos.length > 0) {
                gruposOrdenados.push({
                    id: 'sem_modulo',
                    moduloId: null,
                    nome: 'Sem módulo vinculado',
                    semModulo: true,
                    ordemNoCurso: 0,
                    cursos: [],
                    itens: ordenarPorOrdemENome(itensSoltos)
                });
            }
        }

        return gruposOrdenados;
    });

    const podeReordenarModulos = computed(() => {
        return (
            cursoFiltradoId.value !== null &&
            !termoPesquisa.value.trim() &&
            !reordenando.value &&
            gruposModulos.value.length > 1
        );
    });

    const podeReordenarAtividades = (grupo) => {
        return !termoPesquisa.value.trim() && !reordenando.value && grupo.itens.length > 1;
    };

    const isGrupoExpandido = (grupoId) => {
        if (termoPesquisa.value.trim()) {
            return true;
        }
        return moduloExpandido.value === grupoId;
    };

    const toggleGrupoModulo = (grupoId) => {
        moduloExpandido.value = moduloExpandido.value === grupoId ? null : grupoId;
    };

    const getBadgeDificuldade = (dificuldadeId) => {
        const dif = mapaDificuldades.value.get(dificuldadeId);
        if (!dif) {
            return { texto: '---', variant: 'secondary' };
        }

        const variantesPorOrdem = {
            1: 'success',
            2: 'info',
            3: 'warning',
            4: 'destructive'
        };

        return {
            texto: `${dif.nome} • ${dif.pontos} pts`,
            variant: variantesPorOrdem[dif.ordem] || 'secondary'
        };
    };

    const validarUrl = (valor) => {
        if (!valor) return true;

        try {
            const url = new URL(valor);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    };

    const formatarTamanhoArquivo = (bytes) => {
        if (!bytes) return '';
        if (bytes < 1024 * 1024) {
            return `${Math.max(1, Math.round(bytes / 1024))} KB`;
        }
        return `${(bytes / (1024 * 1024)).toFixed(2).replace('.', ',')} MB`;
    };

    // ========================================================
    // PERSISTENCIA DE ORDEM
    // ========================================================

    const persistirAlteracoesOrdemAtividades = async (alteracoes) => {
        if (!alteracoes.length) return;

        const resultados = await Promise.all(
            alteracoes.map(({ id, ordem }) =>
                supabase
                    .from('atividade')
                    .update({ ordem })
                    .eq('id', id)
            )
        );

        const erro = resultados.find(res => res.error)?.error;
        if (erro) throw erro;
    };

    const persistirAlteracoesOrdemModulos = async (cursoId, alteracoes) => {
        if (!alteracoes.length) return;

        const resultados = await Promise.all(
            alteracoes.map(({ id: moduloId, ordem }) =>
                supabase
                    .from('curso_modulo')
                    .update({ ordem })
                    .eq('curso_id', cursoId)
                    .eq('modulo_id', moduloId)
            )
        );

        const erro = resultados.find(res => res.error)?.error;
        if (erro) throw erro;
    };

    const substituirAtividadesDeModulosLocalmente = (chavesAfetadas, novosItens) => {
        const conjuntoChaves = new Set(chavesAfetadas);
        const restantes = atividades.value.filter(
            item => !conjuntoChaves.has(getChaveModulo(item.modulo_id))
        );
        atividades.value = [...restantes, ...novosItens];
    };

    // ========================================================
    // REORDENACAO DE MODULOS NO CURSO FILTRADO
    // ========================================================

    const aplicarReordenacaoModulo = async (indiceOrigem, indiceDestino) => {
        if (!podeReordenarModulos.value || indiceOrigem === indiceDestino) return;

        const cursoId = cursoFiltradoId.value;
        const estadoAnterior = [...cursoModulos.value];
        const listaMovida = moverItemNaLista(gruposModulos.value, indiceOrigem, indiceDestino);
        const { listaNormalizada, alteracoes } = calcularNormalizacaoOrdem(
            listaMovida,
            'moduloId',
            'ordemNoCurso'
        );

        if (!alteracoes.length) return;

        const mapaNovaOrdem = new Map(
            listaNormalizada.map(grupo => [grupo.moduloId, grupo.ordemNoCurso])
        );

        cursoModulos.value = cursoModulos.value.map(rel => {
            if (rel.curso_id === cursoId && mapaNovaOrdem.has(rel.modulo_id)) {
                return { ...rel, ordem: mapaNovaOrdem.get(rel.modulo_id) };
            }
            return rel;
        });

        reordenando.value = true;
        try {
            await persistirAlteracoesOrdemModulos(cursoId, alteracoes);
        } catch (err) {
            cursoModulos.value = estadoAnterior;
            console.error('Erro ao reordenar módulos no curso:', err);
            toast.error('Erro', 'Não foi possível salvar a nova ordem dos módulos.');
        } finally {
            reordenando.value = false;
        }
    };

    const moverModulo = (index, direcao) => {
        aplicarReordenacaoModulo(index, index + direcao);
    };

    const onDragStartModulo = (index, event) => {
        if (!podeReordenarModulos.value || dragAtividadeOrigem.value) {
            event.preventDefault();
            return;
        }

        dragModuloOrigem.value = index;
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', `modulo:${index}`);
        }
    };

    const onDragOverModulo = (index, event) => {
        if (dragModuloOrigem.value === null) return;
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
        dragModuloAlvo.value = index;
    };

    const onDropModulo = (index, event) => {
        if (dragModuloOrigem.value === null) return;
        event.preventDefault();

        const origem = dragModuloOrigem.value;
        dragModuloOrigem.value = null;
        dragModuloAlvo.value = null;

        if (origem !== index) {
            aplicarReordenacaoModulo(origem, index);
        }
    };

    const onDragEndModulo = () => {
        dragModuloOrigem.value = null;
        dragModuloAlvo.value = null;
    };

    // ========================================================
    // REORDENACAO DE ATIVIDADES DENTRO DO MODULO
    // ========================================================

    const aplicarReordenacaoAtividade = async (grupoId, indiceOrigem, indiceDestino) => {
        if (termoPesquisa.value.trim() || reordenando.value || indiceOrigem === indiceDestino) return;

        const itensGrupo = obterAtividadesDoModulo(grupoId);
        if (itensGrupo.length < 2) return;

        const estadoAnterior = [...atividades.value];
        const listaMovida = moverItemNaLista(itensGrupo, indiceOrigem, indiceDestino);
        const { listaNormalizada, alteracoes } = calcularNormalizacaoOrdem(listaMovida);

        if (!alteracoes.length) return;

        substituirAtividadesDeModulosLocalmente([grupoId], listaNormalizada);
        reordenando.value = true;

        try {
            await persistirAlteracoesOrdemAtividades(alteracoes);
        } catch (err) {
            atividades.value = estadoAnterior;
            console.error('Erro ao reordenar atividades:', err);
            toast.error('Erro', 'Não foi possível salvar a nova ordem das atividades.');
        } finally {
            reordenando.value = false;
        }
    };

    const moverAtividade = (grupoId, index, direcao) => {
        aplicarReordenacaoAtividade(grupoId, index, index + direcao);
    };

    const onDragStartAtividade = (grupo, index, event) => {
        if (!podeReordenarAtividades(grupo)) {
            event.preventDefault();
            return;
        }

        dragAtividadeOrigem.value = { grupoId: grupo.id, index };
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', `atividade:${grupo.id}:${index}`);
        }
    };

    const onDragOverAtividade = (grupoId, index, event) => {
        if (!dragAtividadeOrigem.value || dragAtividadeOrigem.value.grupoId !== grupoId) return;

        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
        dragAtividadeAlvo.value = { grupoId, index };
    };

    const onDropAtividade = (grupoId, index, event) => {
        if (!dragAtividadeOrigem.value) return;
        event.preventDefault();

        const origem = dragAtividadeOrigem.value;
        dragAtividadeOrigem.value = null;
        dragAtividadeAlvo.value = null;

        if (origem.grupoId === grupoId && origem.index !== index) {
            aplicarReordenacaoAtividade(grupoId, origem.index, index);
        }
    };

    const onDragEndAtividade = () => {
        dragAtividadeOrigem.value = null;
        dragAtividadeAlvo.value = null;
    };

    // ========================================================
    // HELPERS DO SUPABASE STORAGE
    // ========================================================

    const limparInputPdf = () => {
        if (inputPdfRef.value) {
            inputPdfRef.value.value = '';
        }
    };

    const abrirSeletorPdf = () => {
        if (salvando.value) return;
        inputPdfRef.value?.click();
    };

    const selecionarArquivoPdf = (event) => {
        const arquivo = event.target.files?.[0];
        if (!arquivo) return;

        const ehPdf =
            arquivo.type === 'application/pdf' ||
            arquivo.name.toLowerCase().endsWith('.pdf');

        if (!ehPdf) {
            toast.error('Arquivo inválido', 'Envie apenas arquivos no formato PDF.');
            limparInputPdf();
            return;
        }

        if (arquivo.size > TAMANHO_MAX_PDF_BYTES) {
            toast.error('Arquivo muito grande', 'O PDF deve ter no máximo 10 MB.');
            limparInputPdf();
            return;
        }

        arquivoPdfSelecionado.value = arquivo;
        removerPdfAtual.value = false;
    };

    const cancelarPdfSelecionado = () => {
        arquivoPdfSelecionado.value = null;
        limparInputPdf();
    };

    const marcarRemocaoPdfAtual = () => {
        removerPdfAtual.value = true;
        arquivoPdfSelecionado.value = null;
        limparInputPdf();
    };

    const gerarNomeArquivoPdf = () => {
        const identificador = crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        return `${identificador}.pdf`;
    };

    const extrairCaminhoStorage = (url) => {
        if (!url) return null;

        const marcador = `/storage/v1/object/public/${BUCKET_ATIVIDADES}/`;
        const indice = url.indexOf(marcador);
        if (indice === -1) return null;

        const caminhoBruto = url.slice(indice + marcador.length).split('?')[0];
        return caminhoBruto ? decodeURIComponent(caminhoBruto) : null;
    };

    const enviarPdfStorage = async (arquivo) => {
        const caminho = gerarNomeArquivoPdf();

        const { error: erroUpload } = await supabase.storage
            .from(BUCKET_ATIVIDADES)
            .upload(caminho, arquivo, {
                contentType: 'application/pdf',
                upsert: false
            });

        if (erroUpload) throw erroUpload;

        const { data } = supabase.storage
            .from(BUCKET_ATIVIDADES)
            .getPublicUrl(caminho);

        return {
            caminho,
            publicUrl: data.publicUrl
        };
    };

    const removerArquivoStorage = async (urlOuCaminho, ehCaminhoDireto = false) => {
        const caminho = ehCaminhoDireto
            ? urlOuCaminho
            : extrairCaminhoStorage(urlOuCaminho);

        if (!caminho) return;

        const { error } = await supabase.storage
            .from(BUCKET_ATIVIDADES)
            .remove([caminho]);

        if (error) {
            console.error('Erro ao remover PDF do Storage:', error);
        }
    };

    // ========================================================
    // CARREGAMENTO DE DADOS
    // ========================================================

    const carregarCursos = async () => {
        const { data, error } = await supabase
            .from('curso')
            .select('id, nome')
            .order('nome', { ascending: true });

        if (error) throw error;
        cursos.value = data || [];
    };

    const carregarModulos = async () => {
        const [resModulos, resRel] = await Promise.all([
            supabase
                .from('modulo')
                .select('id, nome')
                .order('nome', { ascending: true }),
            supabase
                .from('curso_modulo')
                .select('curso_id, modulo_id, ordem')
                .order('ordem', { ascending: true })
        ]);

        if (resModulos.error) throw resModulos.error;
        if (resRel.error) throw resRel.error;

        modulos.value = resModulos.data || [];
        cursoModulos.value = resRel.data || [];
    };

    const carregarDificuldades = async () => {
        const { data, error } = await supabase
            .from('dificuldade_atividade')
            .select('id, nome, pontos, ordem')
            .order('ordem', { ascending: true });

        if (error) throw error;
        dificuldades.value = data || [];
    };

    const carregarAtividades = async () => {
        const { data, error } = await supabase
            .from('atividade')
            .select('id, modulo_id, dificuldade_id, nome, ordem, pdf_url, drive_url, mega_url, outro_url')
            .order('ordem', { ascending: true })
            .order('nome', { ascending: true });

        if (error) throw error;
        atividades.value = data || [];
        emit('update-total', atividades.value.length);
    };

    const carregarTudo = async (silencioso = false) => {
        if (!silencioso) carregando.value = true;

        try {
            await Promise.all([
                carregarCursos(),
                carregarModulos(),
                carregarDificuldades(),
                carregarAtividades()
            ]);
        } catch (err) {
            console.error('Erro ao carregar dados de atividades:', err);
            toast.error('Erro', 'Não foi possível carregar os dados das atividades.');
        } finally {
            if (!silencioso) carregando.value = false;
        }
    };

    const agendarRealtimeAtividades = () => {
        if (reordenando.value || salvando.value || excluindo.value) return;

        clearTimeout(realtimeTimerAtividades);
        realtimeTimerAtividades = setTimeout(() => {
            carregarAtividades().catch(err => console.error(err));
        }, 250);
    };

    const agendarRealtimeModulos = () => {
        if (reordenando.value) return;

        clearTimeout(realtimeTimerModulos);
        realtimeTimerModulos = setTimeout(() => {
            carregarModulos().catch(err => console.error(err));
        }, 250);
    };

    // ========================================================
    // CRUD: ATIVIDADES
    // ========================================================

    const aoTrocarModuloModal = (novoModuloId) => {
        form.value.modulo_id = novoModuloId;
        const chaveDestino = getChaveModulo(novoModuloId);
        const itensDestino = obterAtividadesDoModulo(chaveDestino);

        if (editandoId.value && chaveDestino === moduloOriginalEdicao.value) {
            const indiceAtual = itensDestino.findIndex(item => item.id === editandoId.value);
            form.value.ordem = String(indiceAtual !== -1 ? indiceAtual + 1 : itensDestino.length);
        } else {
            form.value.ordem = String(itensDestino.length + 1);
        }
    };

    const abrirModalNova = () => {
        editandoId.value = null;
        pdfUrlOriginal.value = '';
        removerPdfAtual.value = false;
        arquivoPdfSelecionado.value = null;
        limparInputPdf();

        const moduloInicial =
            moduloExpandido.value && moduloExpandido.value !== 'sem_modulo'
                ? moduloExpandido.value
                : '';
        const chaveInicial = getChaveModulo(moduloInicial);
        const itensIniciais = obterAtividadesDoModulo(chaveInicial);

        moduloOriginalEdicao.value = chaveInicial;
        form.value = {
            modulo_id: moduloInicial,
            dificuldade_id: '',
            nome: '',
            ordem: String(itensIniciais.length + 1),
            pdf_url: '',
            drive_url: '',
            mega_url: '',
            outro_url: ''
        };
        modalFormularioAberto.value = true;
    };

    const abrirModalEdicao = (atividade) => {
        editandoId.value = atividade.id;
        pdfUrlOriginal.value = atividade.pdf_url || '';
        removerPdfAtual.value = false;
        arquivoPdfSelecionado.value = null;
        limparInputPdf();

        const chaveModulo = getChaveModulo(atividade.modulo_id);
        const itensModulo = obterAtividadesDoModulo(chaveModulo);
        const indiceAtual = itensModulo.findIndex(item => item.id === atividade.id);
        const ordemExibicao = indiceAtual !== -1 ? indiceAtual + 1 : (atividade.ordem || 1);

        moduloOriginalEdicao.value = chaveModulo;
        form.value = {
            modulo_id: atividade.modulo_id ? String(atividade.modulo_id) : '',
            dificuldade_id: atividade.dificuldade_id ? String(atividade.dificuldade_id) : '',
            nome: atividade.nome || '',
            ordem: String(ordemExibicao),
            pdf_url: atividade.pdf_url || '',
            drive_url: atividade.drive_url || '',
            mega_url: atividade.mega_url || '',
            outro_url: atividade.outro_url || ''
        };
        modalFormularioAberto.value = true;
    };

    const salvarAtividade = async () => {
        if (salvando.value) return;

        const nomeLimpo = form.value.nome.trim();
        const driveLimpo = form.value.drive_url.trim();
        const megaLimpo = form.value.mega_url.trim();
        const outroLimpo = form.value.outro_url.trim();
        const moduloIdFinal = form.value.modulo_id ? Number(form.value.modulo_id) : null;
        const dificuldadeIdFinal = form.value.dificuldade_id ? Number(form.value.dificuldade_id) : null;
        const chaveDestino = getChaveModulo(moduloIdFinal);
        const mudouDeModulo = Boolean(editandoId.value && chaveDestino !== moduloOriginalEdicao.value);

        const itensDestinoAtual = obterAtividadesDoModulo(chaveDestino);
        const totalMaximo = editandoId.value && !mudouDeModulo
            ? Math.max(1, itensDestinoAtual.length)
            : itensDestinoAtual.length + 1;
        const ordemDigitada = Number.parseInt(form.value.ordem, 10);
        const ordemDesejada = Number.isNaN(ordemDigitada)
            ? totalMaximo
            : Math.min(Math.max(1, ordemDigitada), totalMaximo);

        const teraPdf = Boolean(
            arquivoPdfSelecionado.value ||
            (form.value.pdf_url && !removerPdfAtual.value)
        );

        if (!nomeLimpo) {
            toast.error('Atenção', 'Informe o nome da atividade.');
            return;
        }

        if (!dificuldadeIdFinal) {
            toast.error('Atenção', 'Selecione a dificuldade da atividade.');
            return;
        }

        if (!teraPdf && !driveLimpo && !megaLimpo && !outroLimpo) {
            toast.error('Atenção', 'Envie um arquivo PDF ou informe ao menos um link de acesso.');
            return;
        }

        if (!validarUrl(driveLimpo) || !validarUrl(megaLimpo) || !validarUrl(outroLimpo)) {
            toast.error('Link inválido', 'Use URLs válidas iniciadas com http:// ou https://.');
            return;
        }

        salvando.value = true;
        let novoCaminhoUpload = null;

        try {
            let pdfUrlFinal = removerPdfAtual.value ? null : (form.value.pdf_url || null);

            if (arquivoPdfSelecionado.value) {
                const resultadoUpload = await enviarPdfStorage(arquivoPdfSelecionado.value);
                novoCaminhoUpload = resultadoUpload.caminho;
                pdfUrlFinal = resultadoUpload.publicUrl;
            }

            const payload = {
                modulo_id: moduloIdFinal,
                dificuldade_id: dificuldadeIdFinal,
                nome: nomeLimpo,
                ordem: ordemDesejada,
                pdf_url: pdfUrlFinal,
                drive_url: driveLimpo || null,
                mega_url: megaLimpo || null,
                outro_url: outroLimpo || null
            };

            if (editandoId.value) {
                const { data, error } = await supabase
                    .from('atividade')
                    .update({
                        ...payload,
                        atualizado_em: new Date().toISOString()
                    })
                    .eq('id', editandoId.value)
                    .select('id, modulo_id, dificuldade_id, nome, ordem, pdf_url, drive_url, mega_url, outro_url')
                    .single();

                if (error) throw error;

                // Remove o PDF anterior do Storage somente apos confirmar a gravacao no banco
                if (pdfUrlOriginal.value && pdfUrlOriginal.value !== pdfUrlFinal) {
                    await removerArquivoStorage(pdfUrlOriginal.value);
                }

                if (data) {
                    if (mudouDeModulo) {
                        const baseDestino = [...itensDestinoAtual, data];
                        const destinoReposicionado = posicionarItemPorNumero(baseDestino, data.id, ordemDesejada);
                        const { listaNormalizada: destinoNorm, alteracoes: altDestino } =
                            calcularNormalizacaoOrdem(destinoReposicionado);

                        const baseOrigem = obterAtividadesDoModulo(moduloOriginalEdicao.value).filter(
                            item => item.id !== data.id
                        );
                        const { listaNormalizada: origemNorm, alteracoes: altOrigem } =
                            calcularNormalizacaoOrdem(baseOrigem);

                        await persistirAlteracoesOrdemAtividades([...altDestino, ...altOrigem]);
                        substituirAtividadesDeModulosLocalmente(
                            [moduloOriginalEdicao.value, chaveDestino],
                            [...origemNorm, ...destinoNorm]
                        );
                    } else {
                        const baseDestino = itensDestinoAtual.map(item =>
                            item.id === data.id ? data : item
                        );
                        const destinoReposicionado = posicionarItemPorNumero(baseDestino, data.id, ordemDesejada);
                        const { listaNormalizada, alteracoes } = calcularNormalizacaoOrdem(destinoReposicionado);

                        if (alteracoes.length > 0) {
                            await persistirAlteracoesOrdemAtividades(alteracoes);
                        }

                        substituirAtividadesDeModulosLocalmente([chaveDestino], listaNormalizada);
                    }
                }

                toast.success('Sucesso', 'Atividade atualizada com sucesso!');
            } else {
                const { data, error } = await supabase
                    .from('atividade')
                    .insert([payload])
                    .select('id, modulo_id, dificuldade_id, nome, ordem, pdf_url, drive_url, mega_url, outro_url')
                    .single();

                if (error) throw error;

                if (data) {
                    const baseDestino = [...itensDestinoAtual, data];
                    const destinoReposicionado = posicionarItemPorNumero(baseDestino, data.id, ordemDesejada);
                    const { listaNormalizada, alteracoes } = calcularNormalizacaoOrdem(destinoReposicionado);

                    if (alteracoes.length > 0) {
                        await persistirAlteracoesOrdemAtividades(alteracoes);
                    }

                    substituirAtividadesDeModulosLocalmente([chaveDestino], listaNormalizada);
                }

                toast.success('Sucesso', 'Atividade cadastrada com sucesso!');
            }

            modalFormularioAberto.value = false;
        } catch (err) {
            // Desfaz upload se a gravacao no banco falhar
            if (novoCaminhoUpload) {
                await removerArquivoStorage(novoCaminhoUpload, true);
            }

            console.error('Erro ao salvar atividade:', err);
            toast.error('Erro', 'Não foi possível salvar a atividade.');
        } finally {
            salvando.value = false;
        }
    };

    const abrirModalExcluir = (atividade) => {
        atividadeParaExcluir.value = atividade;
        modalExcluirAberto.value = true;
    };

    const confirmarExclusao = async () => {
        if (!atividadeParaExcluir.value || excluindo.value) return;

        excluindo.value = true;
        try {
            const pdfParaRemover = atividadeParaExcluir.value.pdf_url;
            const nomeRemovido = atividadeParaExcluir.value.nome;
            const idRemovido = atividadeParaExcluir.value.id;
            const chaveModulo = getChaveModulo(atividadeParaExcluir.value.modulo_id);

            const { error } = await supabase
                .from('atividade')
                .delete()
                .eq('id', idRemovido);

            if (error) throw error;

            if (pdfParaRemover) {
                await removerArquivoStorage(pdfParaRemover);
            }

            const restantesModulo = obterAtividadesDoModulo(chaveModulo).filter(
                item => item.id !== idRemovido
            );
            const { listaNormalizada, alteracoes } = calcularNormalizacaoOrdem(restantesModulo);

            if (alteracoes.length > 0) {
                await persistirAlteracoesOrdemAtividades(alteracoes);
            }

            substituirAtividadesDeModulosLocalmente([chaveModulo], listaNormalizada);

            toast.success('Excluída', `A atividade "${nomeRemovido}" foi removida.`);
            modalExcluirAberto.value = false;
            atividadeParaExcluir.value = null;
        } catch (err) {
            console.error('Erro ao excluir atividade:', err);
            toast.error('Erro', 'Não foi possível excluir a atividade.');
        } finally {
            excluindo.value = false;
        }
    };

    onMounted(() => {
        carregarTudo();

        realtimeChannel = supabase
            .channel('aba_atividades_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'atividade' },
                () => agendarRealtimeAtividades()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'modulo' },
                () => agendarRealtimeModulos()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'curso_modulo' },
                () => agendarRealtimeModulos()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'curso' },
                () => carregarCursos().catch(err => console.error(err))
            )
            .subscribe();
    });

    onUnmounted(() => {
        clearTimeout(realtimeTimerAtividades);
        clearTimeout(realtimeTimerModulos);
        if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel);
        }
    });
</script>

<template>
    <div class="space-y-6">
        <!-- Busca, Filtro por Curso e Acoes -->
        <Card>
            <CardContent class="p-4 flex flex-col xl:flex-row xl:items-end justify-between gap-4">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 max-w-2xl">
                    <FormGroup label="Pesquisar Atividade" id="pesquisa-atividade">
                        <div class="relative">
                            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            <Input
                                v-model="termoPesquisa"
                                placeholder="Buscar por atividade, módulo ou curso..."
                                class="pl-9"
                            />
                        </div>
                    </FormGroup>

                    <FormGroup label="Filtrar por Curso" id="filtro-curso-atividade">
                        <Select
                            v-model="filtroCurso"
                            :options="opcoesFiltroCurso"
                        />
                    </FormGroup>
                </div>

                <div class="flex flex-wrap items-center justify-end gap-2 shrink-0">
                    <Button
                        variant="outline"
                        class="h-10 shrink-0 bg-background text-foreground border-border hover:bg-muted"
                        @click="modalModulosAberto = true"
                    >
                        <Layers class="w-4 h-4 mr-1.5" />
                        Gerenciar Módulos
                    </Button>

                    <Button
                        variant="default"
                        class="h-10 shrink-0"
                        @click="abrirModalNova"
                    >
                        <Plus class="w-4 h-4 mr-1.5" />
                        Nova Atividade
                    </Button>
                </div>
            </CardContent>
        </Card>

        <!-- Lista Agrupada por Modulo (Recolhida por Padrao) -->
        <Card class="min-h-[60dvh]">
            <div v-if="carregando" class="p-8 text-center text-muted-foreground">
                Carregando atividades...
            </div>

            <div v-else-if="gruposModulos.length === 0" class="p-8 text-center text-muted-foreground">
                {{
                    termoPesquisa || filtroCurso !== 'todos'
                        ? 'Nenhum módulo ou atividade encontrada para os filtros aplicados.'
                        : 'Nenhum módulo ou atividade cadastrada. Comece criando um módulo ou uma nova atividade.'
                }}
            </div>

            <div v-else class="flex flex-col">
                <div
                    v-for="(grupo, grupoIndex) in gruposModulos"
                    :key="grupo.id"
                    :draggable="podeReordenarModulos"
                    class="border-b border-border last:border-0 flex flex-col transition-colors"
                    :class="[
                        isGrupoExpandido(grupo.id) ? 'bg-muted/30' : '',
                        dragModuloOrigem === grupoIndex ? 'opacity-40 bg-muted/60' : '',
                        dragModuloAlvo === grupoIndex && dragModuloOrigem !== grupoIndex
                            ? 'ring-2 ring-inset ring-indigo-500/60 bg-indigo-50/40 dark:bg-indigo-500/10'
                            : ''
                    ]"
                    @dragstart="onDragStartModulo(grupoIndex, $event)"
                    @dragover="onDragOverModulo(grupoIndex, $event)"
                    @drop="onDropModulo(grupoIndex, $event)"
                    @dragend="onDragEndModulo"
                >
                    <!-- Cabecalho Retratil do Modulo -->
                    <div
                        class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 md:p-4 cursor-pointer hover:bg-muted/60 transition-colors"
                        @click="toggleGrupoModulo(grupo.id)"
                    >
                        <div class="flex items-center gap-3 min-w-0">
                            <!-- Controle de ordem do modulo (visivel ao filtrar um curso especifico) -->
                            <ControleOrdem
                                v-if="cursoFiltradoId !== null && !grupo.semModulo"
                                :ordem="grupo.ordemNoCurso || grupoIndex + 1"
                                :desabilitado="!podeReordenarModulos"
                                :pode-subir="grupoIndex > 0"
                                :pode-descer="grupoIndex < gruposModulos.length - 1"
                                :titulo-arrastar="termoPesquisa ? 'Limpe a busca para reordenar módulos' : 'Arraste para reordenar o módulo neste curso'"
                                @subir="moverModulo(grupoIndex, -1)"
                                @descer="moverModulo(grupoIndex, 1)"
                            />

                            <div
                                class="text-muted-foreground transition-transform duration-300 ease-in-out shrink-0"
                                :class="{ 'rotate-90 text-indigo-600 dark:text-indigo-400': isGrupoExpandido(grupo.id) }"
                            >
                                <ChevronRight class="w-5 h-5" />
                            </div>

                            <span
                                class="font-bold text-sm sm:text-base truncate"
                                :class="grupo.semModulo ? 'text-muted-foreground' : 'text-foreground'"
                            >
                                {{ grupo.nome }}
                            </span>

                            <Badge variant="secondary" class="text-[11px] px-2 py-0 shrink-0">
                                {{ grupo.itens.length }} {{ grupo.itens.length === 1 ? 'atividade' : 'atividades' }}
                            </Badge>
                        </div>

                        <!-- Cursos vinculados ao modulo -->
                        <div
                            v-if="!grupo.semModulo"
                            class="flex flex-wrap items-center gap-1.5 pl-8 sm:pl-0"
                        >
                            <template v-if="grupo.cursos.length > 0">
                                <Badge
                                    v-for="curso in grupo.cursos"
                                    :key="curso.id"
                                    variant="outline"
                                    class="text-[10px] px-2 py-0"
                                >
                                    {{ curso.nome }}
                                </Badge>
                            </template>
                            <span v-else class="text-xs text-muted-foreground">
                                Sem cursos vinculados
                            </span>
                        </div>
                    </div>

                    <!-- Corpo Expansivel com as Atividades do Modulo -->
                    <div
                        class="grid transition-all duration-300 ease-in-out"
                        :class="isGrupoExpandido(grupo.id) ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'"
                    >
                        <div class="overflow-hidden">
                            <div class="border-t border-border bg-background">
                                <div
                                    v-if="grupo.itens.length === 0"
                                    class="px-4 py-6 md:pl-12 text-sm text-muted-foreground"
                                >
                                    Nenhuma atividade cadastrada neste módulo.
                                </div>

                                <template v-else>
                                    <div class="hidden md:flex items-center gap-3 px-4 py-2.5 pl-12 border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                                        <div class="w-16 text-center">Ordem</div>
                                        <div class="flex-1">Nome da Atividade</div>
                                        <div class="w-36 text-center">Dificuldade</div>
                                        <div class="w-16 text-center">PDF</div>
                                        <div class="w-16 text-center">Drive</div>
                                        <div class="w-16 text-center">Mega</div>
                                        <div class="w-16 text-center">Outro</div>
                                        <div class="w-16 text-center">Ações</div>
                                    </div>

                                    <div
                                        v-for="(item, index) in grupo.itens"
                                        :key="item.id"
                                        :draggable="podeReordenarAtividades(grupo)"
                                        class="border-b border-border last:border-0 flex items-center justify-between gap-2 md:gap-3 p-3 md:px-4 md:py-3 md:pl-12 hover:bg-muted/40 transition-colors"
                                        :class="[
                                            dragAtividadeOrigem?.grupoId === grupo.id && dragAtividadeOrigem?.index === index
                                                ? 'opacity-40 bg-muted/60'
                                                : '',
                                            dragAtividadeAlvo?.grupoId === grupo.id &&
                                            dragAtividadeAlvo?.index === index &&
                                            dragAtividadeOrigem?.index !== index
                                                ? 'ring-2 ring-inset ring-indigo-500/60 bg-indigo-50/40 dark:bg-indigo-500/10'
                                                : ''
                                        ]"
                                        @dragstart.stop="onDragStartAtividade(grupo, index, $event)"
                                        @dragover.stop="onDragOverAtividade(grupo.id, index, $event)"
                                        @drop.stop="onDropAtividade(grupo.id, index, $event)"
                                        @dragend.stop="onDragEndAtividade"
                                    >
                                        <!-- Controle de Ordem Compacto -->
                                        <div class="md:w-16 flex justify-center shrink-0">
                                            <ControleOrdem
                                                :ordem="item.ordem || index + 1"
                                                :desabilitado="!podeReordenarAtividades(grupo)"
                                                :pode-subir="index > 0"
                                                :pode-descer="index < grupo.itens.length - 1"
                                                :titulo-arrastar="termoPesquisa ? 'Limpe a busca para reordenar' : 'Arraste para reordenar neste módulo'"
                                                @subir="moverAtividade(grupo.id, index, -1)"
                                                @descer="moverAtividade(grupo.id, index, 1)"
                                            />
                                        </div>

                                        <div class="flex flex-col flex-1 min-w-0">
                                            <span class="font-medium text-sm text-foreground leading-tight truncate">
                                                {{ item.nome }}
                                            </span>

                                            <div class="md:hidden flex flex-wrap items-center gap-1.5 mt-2">
                                                <Badge
                                                    :variant="getBadgeDificuldade(item.dificuldade_id).variant"
                                                    class="text-[10px] px-2 py-0"
                                                >
                                                    {{ getBadgeDificuldade(item.dificuldade_id).texto }}
                                                </Badge>

                                                <BotaoCanalLink tipo="pdf" :url="item.pdf_url" mostrar-label />
                                                <BotaoCanalLink tipo="drive" :url="item.drive_url" mostrar-label />
                                                <BotaoCanalLink tipo="mega" :url="item.mega_url" mostrar-label />
                                                <BotaoCanalLink tipo="outro" :url="item.outro_url" mostrar-label />
                                            </div>
                                        </div>

                                        <div class="hidden md:flex w-36 justify-center shrink-0">
                                            <Badge
                                                :variant="getBadgeDificuldade(item.dificuldade_id).variant"
                                                class="text-[11px] whitespace-nowrap"
                                            >
                                                {{ getBadgeDificuldade(item.dificuldade_id).texto }}
                                            </Badge>
                                        </div>

                                        <div class="hidden md:flex w-16 justify-center shrink-0">
                                            <BotaoCanalLink tipo="pdf" :url="item.pdf_url" />
                                        </div>

                                        <div class="hidden md:flex w-16 justify-center shrink-0">
                                            <BotaoCanalLink tipo="drive" :url="item.drive_url" />
                                        </div>

                                        <div class="hidden md:flex w-16 justify-center shrink-0">
                                            <BotaoCanalLink tipo="mega" :url="item.mega_url" />
                                        </div>

                                        <div class="hidden md:flex w-16 justify-center shrink-0">
                                            <BotaoCanalLink tipo="outro" :url="item.outro_url" />
                                        </div>

                                        <div class="w-auto md:w-16 flex justify-center shrink-0">
                                            <Dropdown align="right">
                                                <template #trigger>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        class="bg-background border border-border text-foreground hover:bg-muted px-2 rounded-md transition-colors shadow-sm"
                                                    >
                                                        <Menu class="w-4 h-4" />
                                                    </Button>
                                                </template>
                                                <template #content>
                                                    <button
                                                        @click="abrirModalEdicao(item)"
                                                        class="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                                                    >
                                                        <Pencil class="w-4 h-4" /> Editar Atividade
                                                    </button>
                                                    <hr class="my-1 border-border" />
                                                    <button
                                                        @click="abrirModalExcluir(item)"
                                                        class="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                                    >
                                                        <Trash2 class="w-4 h-4" /> Excluir Atividade
                                                    </button>
                                                </template>
                                            </Dropdown>
                                        </div>
                                    </div>
                                </template>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Card>

        <!-- Modal: Gerenciar Modulos -->
        <ModalGerenciarModulos
            v-model="modalModulosAberto"
            :cursos="cursos"
            :modulos="modulos"
            :curso-modulos="cursoModulos"
            @atualizado="carregarModulos"
        />

        <!-- Modal: Cadastro e Edicao de Atividade -->
        <Modal
            v-model="modalFormularioAberto"
            :title="editandoId ? 'Editar Atividade' : 'Nova Atividade'"
            size="md"
        >
            <div class="space-y-4 p-2">
                <FormGroup label="Módulo" id="ati-modulo">
                    <Select
                        :model-value="form.modulo_id"
                        :options="opcoesModuloModal"
                        :disabled="salvando"
                        @update:model-value="aoTrocarModuloModal"
                    />
                </FormGroup>

                <FormGroup label="Dificuldade *" id="ati-dificuldade">
                    <Select
                        v-model="form.dificuldade_id"
                        :options="opcoesDificuldadeModal"
                        placeholder="Selecione a dificuldade..."
                        :disabled="salvando"
                    />
                </FormGroup>

                <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div class="sm:col-span-3">
                        <FormGroup label="Nome da Atividade *" id="ati-nome">
                            <Input
                                v-model="form.nome"
                                placeholder="Ex: Atividade 01 - Planilha de Controle"
                                :disabled="salvando"
                                @keyup.enter="salvarAtividade"
                            />
                        </FormGroup>
                    </div>

                    <div class="sm:col-span-1">
                        <FormGroup label="Ordem" id="ati-ordem">
                            <Input
                                v-model="form.ordem"
                                type="number"
                                min="1"
                                :disabled="salvando"
                                @keyup.enter="salvarAtividade"
                            />
                        </FormGroup>
                    </div>
                </div>

                <!-- Upload de PDF para o Supabase Storage -->
                <FormGroup label="Arquivo PDF (Upload - máx. 10 MB)" id="ati-pdf-upload">
                    <input
                        id="ati-pdf-upload"
                        ref="inputPdfRef"
                        type="file"
                        accept="application/pdf,.pdf"
                        class="hidden"
                        :disabled="salvando"
                        @change="selecionarArquivoPdf"
                    />

                    <!-- Novo arquivo selecionado (pendente de envio) -->
                    <div
                        v-if="arquivoPdfSelecionado"
                        class="flex items-center justify-between gap-3 rounded-md border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-500/10 px-3 py-2.5"
                    >
                        <div class="flex items-center gap-2.5 min-w-0">
                            <FileText class="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <div class="min-w-0">
                                <p class="text-xs font-medium text-foreground truncate">
                                    {{ arquivoPdfSelecionado.name }}
                                </p>
                                <p class="text-[11px] text-muted-foreground">
                                    {{ formatarTamanhoArquivo(arquivoPdfSelecionado.size) }} • Pronto para enviar
                                </p>
                            </div>
                        </div>

                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            class="h-7 px-2 text-muted-foreground hover:text-foreground shrink-0"
                            :disabled="salvando"
                            title="Cancelar arquivo selecionado"
                            @click="cancelarPdfSelecionado"
                        >
                            <X class="w-4 h-4" />
                        </Button>
                    </div>

                    <!-- PDF ja salvo na atividade (modo edicao) -->
                    <div
                        v-else-if="possuiPdfAtualAtivo"
                        class="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5"
                    >
                        <div class="flex items-center gap-2 min-w-0">
                            <FileText class="w-4 h-4 text-muted-foreground shrink-0" />
                            <a
                                :href="form.pdf_url"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="text-xs font-medium text-foreground hover:underline truncate"
                            >
                                PDF atual anexado (Abrir)
                            </a>
                        </div>

                        <div class="flex items-center gap-1.5 shrink-0">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                class="h-7 px-2.5 text-xs bg-background"
                                :disabled="salvando"
                                @click="abrirSeletorPdf"
                            >
                                Substituir
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                class="h-7 px-2 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                                :disabled="salvando"
                                title="Remover PDF"
                                @click="marcarRemocaoPdfAtual"
                            >
                                <Trash2 class="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>

                    <!-- Botao inicial de selecao de PDF -->
                    <Button
                        v-else
                        type="button"
                        variant="outline"
                        class="w-full justify-center bg-background border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                        :disabled="salvando"
                        @click="abrirSeletorPdf"
                    >
                        <Upload class="w-4 h-4 mr-2" />
                        Selecionar arquivo PDF
                    </Button>
                </FormGroup>

                <FormGroup label="Google Drive (PDF)" id="ati-drive">
                    <Input
                        v-model="form.drive_url"
                        type="url"
                        placeholder="https://drive.google.com/..."
                        :disabled="salvando"
                        @keyup.enter="salvarAtividade"
                    />
                </FormGroup>

                <FormGroup label="Mega (PDF)" id="ati-mega">
                    <Input
                        v-model="form.mega_url"
                        type="url"
                        placeholder="https://mega.nz/..."
                        :disabled="salvando"
                        @keyup.enter="salvarAtividade"
                    />
                </FormGroup>

                <FormGroup label="Outro Link (PDF)" id="ati-outro">
                    <Input
                        v-model="form.outro_url"
                        type="url"
                        placeholder="https://..."
                        :disabled="salvando"
                        @keyup.enter="salvarAtividade"
                    />
                </FormGroup>
            </div>

            <template #footer>
                <Button variant="ghost" @click="modalFormularioAberto = false" :disabled="salvando">
                    Cancelar
                </Button>
                <Button variant="default" @click="salvarAtividade" :disabled="salvando">
                    <Loader2 v-if="salvando" class="w-4 h-4 mr-1.5 animate-spin" />
                    {{ salvando ? 'Salvando...' : (editandoId ? 'Salvar Alterações' : 'Cadastrar') }}
                </Button>
            </template>
        </Modal>

        <!-- Modal: Exclusao de Atividade -->
        <Modal
            v-model="modalExcluirAberto"
            title="Excluir Atividade"
            size="sm"
        >
            <p v-if="atividadeParaExcluir" class="text-sm text-muted-foreground">
                Deseja remover <strong class="text-foreground">{{ atividadeParaExcluir.nome }}</strong>? Ela deixará de aparecer na área do aluno.
            </p>

            <template #footer>
                <Button variant="ghost" @click="modalExcluirAberto = false" :disabled="excluindo">
                    Cancelar
                </Button>
                <Button variant="destructive" @click="confirmarExclusao" :disabled="excluindo">
                    <Loader2 v-if="excluindo" class="w-4 h-4 mr-1.5 animate-spin" />
                    {{ excluindo ? 'Excluindo...' : 'Excluir' }}
                </Button>
            </template>
        </Modal>
    </div>
</template>