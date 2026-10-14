let notasGerais = JSON.parse(localStorage.getItem('opm_notas_entrada')) || [];

// UNIDADES ISOLADAS POR ABA (ANTENOR VS FILIAIS)
let unidadesAntenorList = JSON.parse(localStorage.getItem('opm_unidades_antenor')) || ['ANTENOR DUARTE VILELA'];
let unidadesFiliaisList = JSON.parse(localStorage.getItem('opm_unidades_filiais')) || ['JALES', 'INFANTO JUVENIL'];

let fornecedoresMap = JSON.parse(localStorage.getItem('opm_fornecedores_map')) || {};

let abaAtual = 'antenor'; // 'antenor' ou 'filiais'
let modoEntradaAtual = 'manual'; // 'manual' ou 'barcode'
let paginaAtual = 1;
const itensPorPagina = 10;
let editandoNotaIdInline = null;

// ARMAZENA DADOS DA BIPAGEM EM ESPERA PARA CADASTRO RÁPIDO DE FORNECEDOR
let bipPendente = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!unidadesAntenorList.includes('ANTENOR DUARTE VILELA')) {
        unidadesAntenorList.unshift('ANTENOR DUARTE VILELA');
    }

    renderFormTratativa();
    renderizarTabelaPaginada();

    const inputBarcode = document.getElementById('barcodeInput');
    if (inputBarcode) {
        inputBarcode.addEventListener('input', processarEntradaChaveAcesso);
        inputBarcode.addEventListener('paste', () => setTimeout(processarEntradaChaveAcesso, 50));
    }
});

window.renderNFTable = function() {
    if (window.pendingNFs) {
        notasGerais = window.pendingNFs;
        localStorage.setItem('opm_notas_entrada', JSON.stringify(notasGerais));
    }
    if (window.unidadesAntenorList) {
        unidadesAntenorList = window.unidadesAntenorList;
        if (!unidadesAntenorList.includes('ANTENOR DUARTE VILELA')) {
            unidadesAntenorList.unshift('ANTENOR DUARTE VILELA');
        }
        localStorage.setItem('opm_unidades_antenor', JSON.stringify(unidadesAntenorList));
    }
    if (window.unidadesFiliaisList) {
        unidadesFiliaisList = window.unidadesFiliaisList;
        localStorage.setItem('opm_unidades_filiais', JSON.stringify(unidadesFiliaisList));
    }
    if (window.fornecedoresMap) {
        fornecedoresMap = window.fornecedoresMap;
        localStorage.setItem('opm_fornecedores_map', JSON.stringify(fornecedoresMap));
        if (document.getElementById('modalFornecedores') && document.getElementById('modalFornecedores').style.display === 'flex') {
            renderizarTabelaFornecedores();
        }
    }
    renderizarTabelaPaginada();
};

function trocarAba(novaAba) {
    abaAtual = novaAba;

    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    
    if (novaAba === 'antenor') {
        const t1 = document.getElementById('tab-antenor');
        const t2 = document.getElementById('tab-antenor-hist');
        if (t1) t1.classList.add('active');
        if (t2) t2.classList.add('active');
    } else {
        const t1 = document.getElementById('tab-filiais');
        const t2 = document.getElementById('tab-filiais-hist');
        if (t1) t1.classList.add('active');
        if (t2) t2.classList.add('active');
    }

    const tituloHist = document.getElementById('tabelaAbaTitulo');
    if (tituloHist) {
        tituloHist.innerText = `Notas Cadastradas — ${abaAtual === 'antenor' ? 'ANTENOR DUARTE' : 'FILIAIS'}`;
    }

    cancelarEdicao();
    renderFormTratativa();
    filtrarNotasTabela();
}

function selecionarModoEntrada(modo) {
    modoEntradaAtual = modo;
    
    const btnManual = document.getElementById('btnModoManual');
    const btnBarcode = document.getElementById('btnModoBarcode');
    const wrapperBarcode = document.getElementById('wrapperBarcodeScanner');
    const btnAddOutra = document.getElementById('btnAddOutraNota');

    if (modo === 'manual') {
        if (btnManual) btnManual.classList.add('active');
        if (btnBarcode) btnBarcode.classList.remove('active');
        if (wrapperBarcode) wrapperBarcode.style.display = 'none';
        if (btnAddOutra) btnAddOutra.style.display = 'inline-flex';
    } else {
        if (btnManual) btnManual.classList.remove('active');
        if (btnBarcode) btnBarcode.classList.add('active');
        if (wrapperBarcode) wrapperBarcode.style.display = 'block';
        if (btnAddOutra) btnAddOutra.style.display = 'none';

        setTimeout(() => {
            const input = document.getElementById('barcodeInput');
            if (input) input.focus();
        }, 100);
    }

    renderFormTratativa();
}

function obterNotasDaAbaAtual() {
    return notasGerais.filter(n => {
        const cat = n.categoria || 'antenor';
        return cat === abaAtual;
    });
}

function alternarTela(destino) {
    const formAreaWrapper = document.getElementById('formAreaWrapper');
    const historySec = document.getElementById('historySection');

    if (destino === 'tabela') {
        if (formAreaWrapper) formAreaWrapper.style.display = 'none';
        if (historySec) historySec.style.display = 'block';
        renderizarTabelaPaginada();
    } else {
        if (formAreaWrapper) formAreaWrapper.style.display = 'block';
        if (historySec) historySec.style.display = 'none';
    }
}

function voltarParaGestao() {
    window.location.href = '../lobby/lobby.html';
}

function renderFormTratativa() {
    const container = document.getElementById('blocos-notas-container');
    const footerActions = document.getElementById('formFooterActions');
    if (!container || !footerActions) return;

    document.getElementById('edit-index').value = '';
    
    const showAddOutra = modoEntradaAtual === 'manual' ? 'inline-flex' : 'none';

    footerActions.innerHTML = `
        <button type="button" class="btn-adicionar-outro" onclick="adicionarBlocoNota()" id="btnAddOutraNota" style="display: ${showAddOutra};">
            <i class="fa-solid fa-plus"></i> Adicionar outra NF
        </button>
        <div style="display: flex; gap: 10px;">
            <button type="button" class="btn-ver-notas-toggle" onclick="alternarTela('tabela')" title="Ver Notas Cadastradas">
                <i class="fa-solid fa-table-list"></i> Ver Notas
            </button>
            <button type="submit" class="btn-save" id="btn-submit-action">
                <i class="fa-solid fa-floppy-disk"></i> Dar Entrada
            </button>
        </div>
    `;

    container.innerHTML = '';
    if (modoEntradaAtual === 'manual') {
        adicionarBlocoNota();
    }
}

function obterListaUnidadesAbaAtual() {
    if (abaAtual === 'antenor') {
        if (!unidadesAntenorList.includes('ANTENOR DUARTE VILELA')) {
            unidadesAntenorList.unshift('ANTENOR DUARTE VILELA');
        }
        return unidadesAntenorList;
    }
    return unidadesFiliaisList;
}

function obterOptionsUnidadesHTML(unidadeSelecionada = '') {
    const lista = obterListaUnidadesAbaAtual();
    if (lista.length === 0) {
        return `<option value="">Nenhuma unidade cadastrada</option>`;
    }
    return lista.map(u => `<option value="${u}" ${u === unidadeSelecionada ? 'selected' : ''}>${u}</option>`).join('');
}

function adicionarBlocoNota(dadosPreenchidos = null) {
    const container = document.getElementById('blocos-notas-container');
    const index = container.children.length;
    const numNotaSeq = index + 1;

    const bloco = document.createElement('div');
    bloco.className = 'bloco-nota-item';
    bloco.dataset.index = index;

    let headerHtml = `
        <div class="bloco-nota-header">
            <span>Nota #${numNotaSeq} ${dadosPreenchidos ? '<small style="color: var(--primary-med); font-weight: normal;">(Bipada via Código de Barras)</small>' : ''}</span>
            ${(index > 0 || modoEntradaAtual === 'barcode') ? `<button type="button" class="btn-remover-bloco" onclick="removerBlocoNota(this)"><i class="fa-solid fa-trash"></i></button>` : ''}
        </div>
    `;

    const valNumNf = dadosPreenchidos ? dadosPreenchidos.numeroNf : '';
    const valEmpresa = dadosPreenchidos ? dadosPreenchidos.empresa : '';

    let valUnidade = dadosPreenchidos ? dadosPreenchidos.unidade : '';
    if (!valUnidade && abaAtual === 'antenor') {
        valUnidade = 'ANTENOR DUARTE VILELA';
    }

    const unidadeCampoHtml = `
        <div class="form-group">
            <label>Unidade</label>
            <div class="unidade-select-wrapper">
                <select class="select-unidade">
                    <option value="">Selecione...</option>
                    ${obterOptionsUnidadesHTML(valUnidade)}
                </select>
                <button type="button" class="btn-config-unidade" onclick="abrirModalGerenciarUnidades()" title="Gerenciar Unidades da Aba">
                    <i class="fa-solid fa-gear"></i>
                </button>
            </div>
        </div>
    `;

    bloco.innerHTML = `
        ${headerHtml}
        <div class="form-grid" style="align-items: flex-end;">
            <div class="form-group">
                <label>Número da NF *</label>
                <input type="text" class="input-num-nf" value="${valNumNf}" placeholder="Ex: 10452" required>
            </div>
            <div class="form-group">
                <label>Nome da Empresa *</label>
                <input type="text" class="input-nome-empresa" value="${valEmpresa}" placeholder="Ex: ONCOPRO" required>
            </div>
            ${unidadeCampoHtml}
            <div class="form-group">
                <label>Urgente *</label>
                <div class="radio-group-flex">
                    <label class="radio-label"><input type="radio" name="urgente_${index}" value="Sim"> Sim</label>
                    <label class="radio-label"><input type="radio" name="urgente_${index}" value="Não" checked> Não</label>
                </div>
            </div>
        </div>
    `;

    container.appendChild(bloco);
}

function removerBlocoNota(btn) {
    const bloco = btn.closest('.bloco-nota-item');
    bloco.remove();
    reindexarBlocosNotas();
}

function reindexarBlocosNotas() {
    const blocos = document.querySelectorAll('#blocos-notas-container .bloco-nota-item');
    blocos.forEach((bloco, idx) => {
        const headerSpan = bloco.querySelector('.bloco-nota-header span');
        if (headerSpan) headerSpan.innerText = `Nota #${idx + 1}`;
    });
}

function processarEntradaChaveAcesso() {
    const input = document.getElementById('barcodeInput');
    if (!input) return;

    let codigo = input.value.replace(/\D/g, '').trim();

    if (codigo.length >= 44) {
        const cnpjBruto = codigo.substring(6, 20);
        const numNfBruto = codigo.substring(25, 34);
        const numNf = parseInt(numNfBruto, 10).toString();
        const cnpjFormatado = formatarCNPJ(cnpjBruto);

        let nomeEmpresa = fornecedoresMap[cnpjBruto] || fornecedoresMap[cnpjFormatado];

        if (!nomeEmpresa) {
            bipPendente = {
                cnpjBruto: cnpjBruto,
                cnpjFormatado: cnpjFormatado,
                numeroNf: numNf
            };

            document.getElementById('fornCnpjInput').value = cnpjFormatado;
            document.getElementById('fornNomeInput').value = '';
            abrirModalFornecedores();

            mostrarNotificacaoToast("CNPJ não encontrado no cadastro de fornecedores!");
            input.value = '';
            return;
        }

        const padraoUnidade = abaAtual === 'antenor' ? 'ANTENOR DUARTE VILELA' : '';
        adicionarBlocoNota({
            numeroNf: numNf,
            empresa: nomeEmpresa,
            unidade: padraoUnidade
        });

        mostrarNotificacaoToast(`NF #${numNf} identificada com sucesso!`);
        input.value = '';
    }
}

function tratarBipagemBarcode(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        processarEntradaChaveAcesso();
    }
}

function formatarCNPJ(v) {
    v = v.replace(/\D/g, "");
    if (v.length !== 14) return v;
    return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function limparApenasNumerosCNPJ(v) {
    return v.replace(/\D/g, "");
}

function abrirModalFornecedores() {
    renderizarTabelaFornecedores();
    document.getElementById('modalFornecedores').style.display = 'flex';
}

function fecharModalFornecedores() {
    document.getElementById('modalFornecedores').style.display = 'none';
    
    if (bipPendente) {
        const nomeEmpresa = fornecedoresMap[bipPendente.cnpjBruto] || fornecedoresMap[bipPendente.cnpjFormatado];
        if (nomeEmpresa) {
            const padraoUnidade = abaAtual === 'antenor' ? 'ANTENOR DUARTE VILELA' : '';
            adicionarBlocoNota({
                numeroNf: bipPendente.numeroNf,
                empresa: nomeEmpresa,
                unidade: padraoUnidade
            });
            mostrarNotificacaoToast(`NF #${bipPendente.numeroNf} adicionada após cadastro do fornecedor!`);
        }
        bipPendente = null;
    }

    const inputBarcode = document.getElementById('barcodeInput');
    if (inputBarcode && modoEntradaAtual === 'barcode') {
        inputBarcode.focus();
    }
}

function salvarFornecedor() {
    const inputCnpj = document.getElementById('fornCnpjInput');
    const inputNome = document.getElementById('fornNomeInput');

    const cnpjLimpo = limparApenasNumerosCNPJ(inputCnpj.value);
    const cnpjFmt = formatarCNPJ(cnpjLimpo);
    const nome = inputNome.value.trim();

    if (!cnpjLimpo || cnpjLimpo.length !== 14) {
        alert("Digite um CNPJ válido com 14 dígitos.");
        return;
    }

    if (!nome) {
        alert("Preencha o Nome do Fornecedor / Empresa.");
        return;
    }

    fornecedoresMap[cnpjLimpo] = nome;
    fornecedoresMap[cnpjFmt] = nome;

    localStorage.setItem('opm_fornecedores_map', JSON.stringify(fornecedoresMap));

    if (typeof window.syncWithFirebase === "function") {
        window.fornecedoresMap = fornecedoresMap;
        window.syncWithFirebase();
    }

    inputCnpj.value = '';
    inputNome.value = '';

    mostrarNotificacaoToast("Fornecedor cadastrado com sucesso!");
    renderizarTabelaFornecedores();

    if (bipPendente) {
        fecharModalFornecedores();
    }
}

function renderizarTabelaFornecedores() {
    const tbody = document.getElementById('tabelaFornecedoresBody');
    if (!tbody) return;

    const termo = (document.getElementById('searchFornecedorInput')?.value || '').toLowerCase();
    
    const mapaUnico = {};
    Object.keys(fornecedoresMap).forEach(key => {
        const cnpjNum = limparApenasNumerosCNPJ(key);
        if (cnpjNum && cnpjNum.length === 14) {
            mapaUnico[cnpjNum] = fornecedoresMap[key];
        }
    });

    const cnpjsNumericos = Object.keys(mapaUnico);

    const cnpjsFiltrados = cnpjsNumericos.filter(cnpjNum => {
        const cnpjFmt = formatarCNPJ(cnpjNum);
        const nome = mapaUnico[cnpjNum].toLowerCase();
        return cnpjFmt.includes(termo) || cnpjNum.includes(termo) || nome.includes(termo);
    });

    tbody.innerHTML = '';
    if (cnpjsFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 15px; color: var(--text-muted);">Nenhum fornecedor cadastrado.</td></tr>`;
        return;
    }

    cnpjsFiltrados.forEach(cnpjNum => {
        const cnpjFmt = formatarCNPJ(cnpjNum);
        tbody.innerHTML += `
            <tr>
                <td><strong>${cnpjFmt}</strong></td>
                <td>${mapaUnico[cnpjNum]}</td>
                <td class="text-center">
                    <button type="button" class="btn-action-tbl btn-excluir" onclick="excluirFornecedor('${cnpjNum}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

function excluirFornecedor(cnpjNum) {
    const cnpjFmt = formatarCNPJ(cnpjNum);
    const nomeEmpresa = fornecedoresMap[cnpjNum] || fornecedoresMap[cnpjFmt];

    if (confirm(`Deseja remover definitivamente o fornecedor com CNPJ ${cnpjFmt}?`)) {
        delete fornecedoresMap[cnpjNum];
        delete fornecedoresMap[cnpjFmt];

        localStorage.setItem('opm_fornecedores_map', JSON.stringify(fornecedoresMap));

        if (typeof window.forcarExclusaoFornecedorFirebase === "function" && nomeEmpresa) {
            window.fornecedoresMap = fornecedoresMap;
            window.forcarExclusaoFornecedorFirebase(nomeEmpresa);
        } else if (typeof window.syncWithFirebase === "function") {
            window.fornecedoresMap = fornecedoresMap;
            window.syncWithFirebase();
        }

        renderizarTabelaFornecedores();
        mostrarNotificacaoToast("Fornecedor excluído e removido do Firebase!");
    }
}

function abrirModalGerenciarUnidades() {
    const titleEl = document.getElementById('modalUnidadeAbaNome');
    if (titleEl) titleEl.innerText = abaAtual === 'antenor' ? 'ANTENOR DUARTE' : 'FILIAIS';

    renderizarListaUnidades();
    document.getElementById('modalGerenciarUnidades').style.display = 'flex';
}

function fecharModalGerenciarUnidades() {
    document.getElementById('modalGerenciarUnidades').style.display = 'none';
    
    document.querySelectorAll('.select-unidade').forEach(select => {
        const valAtual = select.value;
        select.innerHTML = `<option value="">Selecione...</option>` + obterOptionsUnidadesHTML(valAtual);
        select.value = valAtual;
    });
}

function renderizarListaUnidades() {
    const ul = document.getElementById('listaUnidadesCadastradas');
    if (!ul) return;
    ul.innerHTML = '';

    const lista = obterListaUnidadesAbaAtual();

    if (lista.length === 0) {
        ul.innerHTML = `<li style="color: var(--text-muted); text-align: center;">Nenhuma unidade cadastrada.</li>`;
        return;
    }

    lista.forEach((un, idx) => {
        const li = document.createElement('li');
        
        const ehOpcaoFixa = (abaAtual === 'antenor' && un === 'ANTENOR DUARTE VILELA');
        const btnDeleteHtml = ehOpcaoFixa 
            ? `<small style="color: var(--text-muted); font-size: 0.75rem;">(Fixa)</small>` 
            : `<button type="button" class="btn-delete-unidade" onclick="excluirUnidade(${idx})" title="Excluir"><i class="fa-solid fa-trash"></i></button>`;

        li.innerHTML = `
            <span>${un}</span>
            ${btnDeleteHtml}
        `;
        ul.appendChild(li);
    });
}

function adicionarNovaUnidade() {
    const input = document.getElementById('novaUnidadeInput');
    const valor = input.value.trim();
    if (!valor) return;

    const lista = obterListaUnidadesAbaAtual();

    if (lista.some(u => u.toLowerCase() === valor.toLowerCase())) {
        alert("Esta unidade já está cadastrada nesta aba.");
        return;
    }

    lista.push(valor);

    if (abaAtual === 'antenor') {
        localStorage.setItem('opm_unidades_antenor', JSON.stringify(unidadesAntenorList));
    } else {
        localStorage.setItem('opm_unidades_filiais', JSON.stringify(unidadesFiliaisList));
    }

    if (typeof window.syncWithFirebase === "function") {
        window.unidadesAntenorList = unidadesAntenorList;
        window.unidadesFiliaisList = unidadesFiliaisList;
        window.syncWithFirebase();
    }

    input.value = '';
    renderizarListaUnidades();
}

function excluirUnidade(idx) {
    const lista = obterListaUnidadesAbaAtual();
    const item = lista[idx];

    if (abaAtual === 'antenor' && item === 'ANTENOR DUARTE VILELA') {
        alert("A opção 'ANTENOR DUARTE VILELA' é padrão e não pode ser removida.");
        return;
    }

    if (confirm("Deseja excluir esta unidade?")) {
        lista.splice(idx, 1);

        if (abaAtual === 'antenor') {
            localStorage.setItem('opm_unidades_antenor', JSON.stringify(unidadesAntenorList));
        } else {
            localStorage.setItem('opm_unidades_filiais', JSON.stringify(unidadesFiliaisList));
        }

        if (typeof window.syncWithFirebase === "function") {
            window.unidadesAntenorList = unidadesAntenorList;
            window.unidadesFiliaisList = unidadesFiliaisList;
            window.syncWithFirebase();
        }

        renderizarListaUnidades();
    }
}

function handleFormSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    const editIndex = document.getElementById('edit-index').value;
    const agora = new Date();
    const dataHoraFormatada = `${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;

    if (editIndex !== "") {
        const index = notasGerais.findIndex(n => n.id === Number(editIndex));
        if (index !== -1) {
            const bloco = document.querySelector('.bloco-nota-item');
            notasGerais[index].numeroNf = bloco.querySelector('.input-num-nf').value;
            notasGerais[index].empresa = bloco.querySelector('.input-nome-empresa').value;
            notasGerais[index].urgente = bloco.querySelector('input[name^="urgente_"]:checked').value;
            const selUn = bloco.querySelector('.select-unidade');
            notasGerais[index].unidade = selUn ? selUn.value : '';
        }
        mostrarNotificacaoToast("Entrada atualizada com sucesso!");
    } else {
        const blocos = document.querySelectorAll('.bloco-nota-item');
        let novasEntradas = [];
        const finalizadas = window.finishedNFs || [];
        const tratativas = window.notasGerais || JSON.parse(localStorage.getItem('opm_notas_tratativa')) || [];

        for (let idx = 0; idx < blocos.length; idx++) {
            const bloco = blocos[idx];
            const numNf = bloco.querySelector('.input-num-nf').value.trim();
            const empresa = bloco.querySelector('.input-nome-empresa').value.trim();
            if (!numNf || !empresa) continue;

            const selUn = bloco.querySelector('.select-unidade');
            const unidadeVal = selUn ? selUn.value : '';

            const jaFinalizada = finalizadas.some(f => 
                f.numeroNf.toLowerCase() === numNf.toLowerCase() && 
                f.empresa.toLowerCase() === empresa.toLowerCase()
            );

            if (jaFinalizada) {
                const continuar = confirm(`Existe uma mesma nota marcada como finalizada.\n\nNúmero NF: ${numNf}\nFornecedor: ${empresa}\n\nDeseja continuar ou cancelar?`);
                if (!continuar) return;
            }

            const jaEmTratativa = tratativas.some(t => 
                t.numeroNf.toLowerCase() === numNf.toLowerCase() && 
                t.empresa.toLowerCase() === empresa.toLowerCase()
            );

            if (jaEmTratativa) {
                const continuarTratativa = confirm(`Existe uma mesma nota marcada como em tratativa.\n\nNúmero NF: ${numNf}\nEmpresa: ${empresa}\n\nDeseja continuar ou cancelar?`);
                if (!continuarTratativa) return;
            }

            const urgenteRadio = bloco.querySelector(`input[name^="urgente_"]:checked`);
            const urgente = urgenteRadio ? urgenteRadio.value : 'Não';

            novasEntradas.push({
                id: Date.now() + idx,
                categoria: abaAtual,
                numeroNf: numNf,
                empresa: empresa,
                unidade: unidadeVal,
                urgente: urgente,
                observacoes: 'Nenhuma observação',
                dataHora: dataHoraFormatada
            });
        }

        if (novasEntradas.length === 0) {
            alert("Preencha ao menos uma nota com Número da NF e Nome da Empresa.");
            return;
        }

        notasGerais.push(...novasEntradas);
        mostrarNotificacaoToast(`${novasEntradas.length} entrada(s) salva(s) com sucesso!`);
    }

    localStorage.setItem('opm_notas_entrada', JSON.stringify(notasGerais));

    if (typeof window.syncWithFirebase === "function") {
        window.pendingNFs = notasGerais;
        window.syncWithFirebase();
    }

    cancelarEdicao();
    filtrarNotasTabela();
}

function cancelarEdicao() {
    renderFormTratativa();
}

function filtrarNotasTabela() {
    paginaAtual = 1;
    renderizarTabelaPaginada();
}

function renderizarTabelaPaginada() {
    const tbody = document.getElementById('tabelaTratativasBody');
    const thDetalhes = document.getElementById('thDetalhes');
    if (!tbody) return;

    if (thDetalhes) {
        if (editandoNotaIdInline !== null) {
            thDetalhes.innerText = 'URGENTE';
        } else {
            thDetalhes.innerText = 'DETALHES';
        }
    }

    const termo = (document.getElementById('searchInput')?.value || '').toLowerCase();

    const notasDaAba = obterNotasDaAbaAtual();
    const filtradas = notasDaAba.filter(nota => {
        const unMatch = nota.unidade ? nota.unidade.toLowerCase().includes(termo) : false;
        return nota.numeroNf.toLowerCase().includes(termo) || 
               nota.empresa.toLowerCase().includes(termo) ||
               unMatch;
    });

    const totalRegistros = filtradas.length;
    const totalPaginas = Math.ceil(totalRegistros / itensPorPagina) || 1;

    if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;
    if (paginaAtual < 1) paginaAtual = 1;

    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const paginadas = filtradas.slice(inicio, fim);

    const contagemChaves = {};
    notasDaAba.forEach(n => {
        const key = `${n.numeroNf.toLowerCase()}_${n.empresa.toLowerCase()}`;
        contagemChaves[key] = (contagemChaves[key] || 0) + 1;
    });

    tbody.innerHTML = '';

    if (paginadas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">Nenhuma nota encontrada.</td></tr>`;
    } else {
        paginadas.forEach(nota => {
            const tr = document.createElement('tr');
            
            if (editandoNotaIdInline === String(nota.id)) {
                tr.innerHTML = `
                    <td><input type="text" id="inline-nf-${nota.id}" value="${nota.numeroNf}" style="width: 80px; padding: 6px; border-radius: 6px; border: 1px solid var(--card-border); font-size: 0.88rem;"></td>
                    <td><input type="text" id="inline-empresa-${nota.id}" value="${nota.empresa}" style="width: 100%; padding: 6px; border-radius: 6px; border: 1px solid var(--card-border); font-size: 0.88rem;"></td>
                    <td>
                        <select id="inline-unidade-${nota.id}" style="padding: 6px; border-radius: 6px; border: 1px solid var(--card-border); font-size: 0.88rem; width: 100%;">
                            <option value="">Selecione...</option>
                            ${obterOptionsUnidadesHTML(nota.unidade)}
                        </select>
                    </td>
                    <td>
                        <select id="inline-urgente-${nota.id}" style="padding: 6px; border-radius: 6px; border: 1px solid var(--card-border); font-size: 0.88rem; width: 100%;">
                            <option value="Sim" ${nota.urgente === 'Sim' ? 'selected' : ''}>Sim</option>
                            <option value="Não" ${nota.urgente === 'Não' ? 'selected' : ''}>Não</option>
                        </select>
                    </td>
                    <td class="text-center">
                        <div class="action-buttons-group">
                            <button type="button" class="btn-action-tbl btn-salvar-row" onclick="salvarEdicaoInline('${nota.id}')" title="Salvar"><i class="fa-solid fa-check"></i></button>
                            <button type="button" class="btn-action-tbl btn-cancelar-row" onclick="cancelarEdicaoInline()" title="Cancelar"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                    </td>
                `;
            } else {
                const key = `${nota.numeroNf.toLowerCase()}_${nota.empresa.toLowerCase()}`;
                const ehRepetida = contagemChaves[key] > 1;
                const estiloTextoVermelho = ehRepetida ? 'style="color: #DC2626; font-weight: 800;"' : '';

                const iconeUrgenteHtml = nota.urgente === 'Sim' ? `<i class="fa-solid fa-triangle-exclamation icone-urgente-piscando" title="Urgente"></i>` : '';
                const iconeEstornadaHtml = nota.estornada ? `<i class="fa-solid fa-rotate-left" style="color: #D97706; margin-left: 6px; cursor: pointer;" title="extornada"></i>` : '';

                const temObs = (nota.observacoes && nota.observacoes !== 'Nenhuma observação' && nota.observacoes.trim() !== '') || nota.estornada;
                const classeBtnObs = temObs ? 'btn-ver-mais com-obs' : 'btn-ver-mais';

                tr.innerHTML = `
                    <td ${estiloTextoVermelho}><strong>${nota.numeroNf}</strong> ${iconeUrgenteHtml} ${iconeEstornadaHtml}</td>
                    <td ${estiloTextoVermelho}>${nota.empresa}</td>
                    <td ${estiloTextoVermelho}>${nota.unidade || '-'}</td>
                    <td><button type="button" class="${classeBtnObs}" onclick="abrirDetalhesNota('${nota.id}')">Ver mais</button></td>
                    <td class="text-center">
                        <div class="action-buttons-group">
                            <button type="button" class="btn-action-tbl btn-editar" onclick="ativarEdicaoInline('${nota.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
                            <button type="button" class="btn-action-tbl btn-excluir" onclick="excluirNota('${nota.id}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                `;
            }
            tbody.appendChild(tr);
        });
    }

    const infoText = document.getElementById('paginationInfo');
    if (infoText) {
        const startNum = totalRegistros > 0 ? inicio + 1 : 0;
        const endNum = Math.min(fim, totalRegistros);
        infoText.innerText = `Mostrando ${startNum}–${endNum} de ${totalRegistros} registros`;
    }

    const pageInd = document.getElementById('pageIndicator');
    if (pageInd) pageInd.innerText = `${paginaAtual}/${totalPaginas}`;

    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    if (prevBtn) prevBtn.disabled = paginaAtual === 1;
    if (nextBtn) nextBtn.disabled = paginaAtual >= totalPaginas;
}

function ativarEdicaoInline(idNota) {
    editandoNotaIdInline = String(idNota);
    renderizarTabelaPaginada();
}

function cancelarEdicaoInline() {
    editandoNotaIdInline = null;
    renderizarTabelaPaginada();
}

function salvarEdicaoInline(idNota) {
    const index = notasGerais.findIndex(n => String(n.id) === String(idNota));
    if (index === -1) return;

    const inputNf = document.getElementById(`inline-nf-${idNota}`);
    const inputEmpresa = document.getElementById(`inline-empresa-${idNota}`);
    const selectUrgente = document.getElementById(`inline-urgente-${idNota}`);
    const selectUnidade = document.getElementById(`inline-unidade-${idNota}`);

    if (inputNf) notasGerais[index].numeroNf = inputNf.value.trim();
    if (inputEmpresa) notasGerais[index].empresa = inputEmpresa.value.trim();
    if (selectUrgente) notasGerais[index].urgente = selectUrgente.value;
    if (selectUnidade) notasGerais[index].unidade = selectUnidade.value;

    localStorage.setItem('opm_notas_entrada', JSON.stringify(notasGerais));

    if (typeof window.syncWithFirebase === "function") {
        window.pendingNFs = notasGerais;
        window.syncWithFirebase();
    }

    editandoNotaIdInline = null;
    mostrarNotificacaoToast("Nota atualizada diretamente!");
    renderizarTabelaPaginada();
}

function mudarPagina(direcao) {
    paginaAtual += direcao;
    renderizarTabelaPaginada();
}

function excluirNota(idNota) {
    if (confirm("Tem certeza que deseja excluir esta entrada?")) {
        notasGerais = notasGerais.filter(n => String(n.id) !== String(idNota));
        localStorage.setItem('opm_notas_entrada', JSON.stringify(notasGerais));
        
        if (typeof window.syncWithFirebase === "function") {
            window.pendingNFs = notasGerais;
            window.syncWithFirebase();
        }

        mostrarNotificacaoToast("Entrada excluída com sucesso!");
        filtrarNotasTabela();
    }
}

function abrirDetalhesNota(idNota) {
    const nota = notasGerais.find(n => String(n.id) === String(idNota));
    if (!nota) return;

    const content = document.getElementById('modalDetalhesContent');
    
    let htmlEstorno = '';
    if (nota.estornada) {
        htmlEstorno = `
            <div style="margin-top: 10px; padding: 10px; background-color: #FEF3C7; border: 1px solid #FCD34D; border-radius: 8px;">
                <div style="color: #D97706; font-weight: 800; font-size: 0.88rem; display: flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-rotate-left"></i> Nota Extornada
                </div>
                <div style="font-size: 0.82rem; color: #92400E; margin-top: 4px;">
                    <strong>Motivo:</strong> ${nota.motivoEstorno || 'Não informado'}
                </div>
            </div>
        `;
    }

    const textoRodape = nota.estornada 
        ? `<i class="fa-solid fa-clock"></i> Estornado em: ${nota.dataHoraEstorno || nota.dataHora}`
        : `<i class="fa-solid fa-clock"></i> Cadastrada em: ${nota.dataHora}`;

    content.innerHTML = `
        <div class="modal-info-row"><strong>Aba:</strong> ${nota.categoria === 'filiais' ? 'FILIAIS' : 'ANTENOR DUARTE'}</div>
        <div class="modal-info-row"><strong>Nº NF:</strong> ${nota.numeroNf}</div>
        <div class="modal-info-row"><strong>Empresa:</strong> ${nota.empresa}</div>
        <div class="modal-info-row"><strong>Unidade:</strong> ${nota.unidade || '-'}</div>
        <div class="modal-info-row"><strong>Urgente:</strong> ${nota.urgente}</div>
        
        <div class="modal-info-row" style="margin-top: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <strong>Observações:</strong>
                <button type="button" style="background: none; border: none; color: var(--primary-dark); cursor: pointer; font-size: 1rem; padding: 2px;" onclick="toggleEditarObservacao('${idNota}')" title="Editar Observação">
                    <i class="fa-solid fa-pen"></i>
                </button>
            </div>
            <div id="obsViewBox-${idNota}">
                <p style="color: var(--text-main); background: #FAFAFA; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--card-border); font-size: 0.88rem; min-height: 42px;">${nota.observacoes}</p>
            </div>
            <div id="obsEditBox-${idNota}" style="display: none; margin-top: 6px;">
                <textarea id="inputObsModal-${idNota}" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--primary-med); font-size: 0.88rem; height: 80px; resize: vertical; outline: none;">${nota.observacoes === 'Nenhuma observação' ? '' : nota.observacoes}</textarea>
                <div style="display: flex; gap: 8px; margin-top: 6px; justify-content: flex-end;">
                    <button type="button" class="btn-save" style="padding: 6px 14px; font-size: 0.8rem;" onclick="salvarObservacaoModal('${idNota}')">
                        <i class="fa-solid fa-check"></i> Salvar
                    </button>
                </div>
            </div>
        </div>

        ${htmlEstorno}

        <div class="modal-info-row" style="margin-top: 16px; font-size: 0.8rem; color: var(--text-muted); border-top: 1px solid #E5E7EB; padding-top: 8px;">
            ${textoRodape}
        </div>
    `;
    document.getElementById('modalDetalhes').style.display = 'flex';
}

function fecharModalDetalhes() {
    document.getElementById('modalDetalhes').style.display = 'none';
}

function toggleEditarObservacao(idNota) {
    const viewBox = document.getElementById(`obsViewBox-${idNota}`);
    const editBox = document.getElementById(`obsEditBox-${idNota}`);

    if (viewBox && editBox) {
        const estaVisivelEdit = editBox.style.display === 'block';
        if (estaVisivelEdit) {
            viewBox.style.display = 'block';
            editBox.style.display = 'none';
        } else {
            viewBox.style.display = 'none';
            editBox.style.display = 'block';
            
            const textarea = document.getElementById(`inputObsModal-${idNota}`);
            if (textarea) {
                textarea.focus();
            }
        }
    }
}

function salvarObservacaoModal(idNota) {
    const nota = notasGerais.find(n => String(n.id) === String(idNota));
    const input = document.getElementById(`inputObsModal-${idNota}`);

    if (nota && input) {
        nota.observacoes = input.value.trim() || 'Nenhuma observação';
        localStorage.setItem('opm_notas_entrada', JSON.stringify(notasGerais));

        if (typeof window.syncWithFirebase === "function") {
            window.pendingNFs = notasGerais;
            window.syncWithFirebase();
        }

        mostrarNotificacaoToast("Observação atualizada com sucesso!");
        abrirDetalhesNota(idNota);
        renderizarTabelaPaginada();
    }
}

function abrirModalRelatorio() {
    const reportNomeAba = document.getElementById('reportNomeAba');
    if (reportNomeAba) reportNomeAba.innerText = abaAtual === 'antenor' ? 'ANTENOR DUARTE' : 'FILIAIS';

    renderizarTabelaRelatorio(obterNotasDaAbaAtual());
    document.getElementById('modalRelatorio').style.display = 'flex';
    
    const agora = new Date();
    document.getElementById('reportTimestamp').innerText = `Gerado em: ${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;
}

function fecharModalRelatorio() {
    document.getElementById('modalRelatorio').style.display = 'none';
}

function renderizarTabelaRelatorio(lista) {
    const tbody = document.getElementById('reportTableBody');
    if (!tbody) return;

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 15px;">Nenhuma nota disponível nesta aba para relatório.</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    lista.forEach((nota) => {
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td style="text-align: center;"><input type="checkbox" class="report-row-check" value="${nota.id}" checked></td>
            <td><strong>${nota.numeroNf}</strong></td>
            <td>${nota.empresa}</td>
            <td>${nota.unidade || '-'}</td>
            <td>${nota.observacoes || '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}

function toggleMarcarTodas(masterCheckbox) {
    const checks = document.querySelectorAll('.report-row-check');
    checks.forEach(chk => chk.checked = masterCheckbox.checked);
}

/* GERA A JANELA DE IMPRESSÃO LIMPA SEM DADOS DO NAVEGADOR NO CABEÇALHO/RODAPÉ E SEM COLUNAS EXTRAS */
function gerarVisualizacaoPDF() {
    const checks = document.querySelectorAll('.report-row-check:checked');
    const idsSelecionados = Array.from(checks).map(c => Number(c.value));

    if (idsSelecionados.length === 0) {
        alert("Selecione pelo menos uma nota para gerar a visualização.");
        return;
    }

    const notasFiltradas = obterNotasDaAbaAtual().filter(n => idsSelecionados.includes(n.id));
    const isFiliais = abaAtual === 'filiais';
    
    const novaJanela = window.open('', '_blank');
    novaJanela.document.write(`
        <html>
        <head>
            <title>Relatório de Entradas - ${isFiliais ? 'FILIAIS' : 'ANTENOR DUARTE'}</title>
            <style>
                @page {
                    size: auto;
                    margin: 10mm;
                }
                body { 
                    font-family: 'Plus Jakarta Sans', Arial, sans-serif; 
                    padding: 20px; 
                    color: #2D3748; 
                }
                h2 { 
                    text-align: center; 
                    font-size: 1.2rem; 
                    color: #035AA6; 
                    margin-bottom: 5px; 
                }
                .timestamp { 
                    text-align: center; 
                    font-size: 0.8rem; 
                    color: #718096; 
                    margin-bottom: 25px; 
                }
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-top: 10px; 
                }
                th, td { 
                    border: 1px solid #CBD5E0; 
                    padding: 8px 10px; 
                    font-size: 0.82rem; 
                    text-align: left; 
                }
                th { 
                    background-color: #D9D2BF; 
                    color: #035AA6; 
                    font-weight: 700; 
                }
            </style>
        </head>
        <body>
            <h2>CENTRAL DE NOTAS - RELATÓRIO DE ENTRADAS (${isFiliais ? 'FILIAIS' : 'ANTENOR DUARTE'})</h2>
            <div class="timestamp">Gerado em: ${new Date().toLocaleString('pt-BR')}</div>
            <table>
                <thead>
                    <tr>
                        <th>Nº NF</th>
                        <th>Empresa</th>
                        <th>Unidade</th>
                        <th>Observações / Detalhes</th>
                    </tr>
                </thead>
                <tbody>
                    ${notasFiltradas.map(n => `
                        <tr>
                            <td><strong>${n.numeroNf}</strong></td>
                            <td>${n.empresa}</td>
                            <td>${n.unidade || '-'}</td>
                            <td>${n.observacoes || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </body>
        </html>
    `);
    novaJanela.document.close();
}

function mostrarNotificacaoToast(msg) {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;
    const msgSpan = document.getElementById('toast-msg');
    if (msgSpan) msgSpan.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3500);
}