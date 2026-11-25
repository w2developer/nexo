/**
 * Ordena itens pela coluna `ordem` (valores > 0 primeiro) com desempate alfabetico em `nome`.
 */
export const ordenarPorOrdemENome = (lista, campoOrdem = 'ordem', campoNome = 'nome') => {
    return [...lista].sort((a, b) => {
        const ordemA = Number(a[campoOrdem]) > 0 ? Number(a[campoOrdem]) : Number.MAX_SAFE_INTEGER;
        const ordemB = Number(b[campoOrdem]) > 0 ? Number(b[campoOrdem]) : Number.MAX_SAFE_INTEGER;

        if (ordemA !== ordemB) {
            return ordemA - ordemB;
        }

        const nomeA = a[campoNome] || '';
        const nomeB = b[campoNome] || '';
        return nomeA.localeCompare(nomeB, 'pt-BR');
    });
};

/**
 * Move um item de `indiceOrigem` para `indiceDestino` retornando um novo array.
 */
export const moverItemNaLista = (lista, indiceOrigem, indiceDestino) => {
    if (
        indiceOrigem === indiceDestino ||
        indiceOrigem < 0 ||
        indiceDestino < 0 ||
        indiceOrigem >= lista.length ||
        indiceDestino >= lista.length
    ) {
        return [...lista];
    }

    const copia = [...lista];
    const [itemMovido] = copia.splice(indiceOrigem, 1);
    copia.splice(indiceDestino, 0, itemMovido);
    return copia;
};

/**
 * Reposiciona um item existente na posicao 1-based desejada dentro da lista ordenada.
 */
export const posicionarItemPorNumero = (listaOrdenada, itemId, posicaoDesejada, campoId = 'id') => {
    const itemAtual = listaOrdenada.find(item => item[campoId] === itemId);
    if (!itemAtual) return [...listaOrdenada];

    const restantes = listaOrdenada.filter(item => item[campoId] !== itemId);
    const numeroLimpo = Number.parseInt(posicaoDesejada, 10);
    const posicaoNormalizada = Number.isNaN(numeroLimpo)
        ? restantes.length + 1
        : Math.min(Math.max(1, numeroLimpo), restantes.length + 1);

    restantes.splice(posicaoNormalizada - 1, 0, itemAtual);
    return restantes;
};

/**
 * Recalcula a sequencia 1..N da lista e retorna os itens normalizados
 * mais o diff contendo apenas os registros cuja ordem mudou.
 */
export const calcularNormalizacaoOrdem = (listaReordenada, campoId = 'id', campoOrdem = 'ordem') => {
    const alteracoes = [];
    const listaNormalizada = listaReordenada.map((item, index) => {
        const novaOrdem = index + 1;

        if (Number(item[campoOrdem]) !== novaOrdem) {
            alteracoes.push({
                id: item[campoId],
                ordem: novaOrdem
            });
        }

        return {
            ...item,
            [campoOrdem]: novaOrdem
        };
    });

    return {
        listaNormalizada,
        alteracoes
    };
};