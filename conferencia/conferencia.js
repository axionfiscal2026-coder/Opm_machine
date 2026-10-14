let malotesList = JSON.parse(localStorage.getItem('opm_malotes_list')) || [];
let fornecedoresMap = JSON.parse(localStorage.getItem('opm_fornecedores_map')) || {};
let responsaveisList = JSON.parse(localStorage.getItem('opm_responsaveis_list')) || ['BRUNO', 'GAB', 'CARLOS', 'JOAO'];
let estoquesList = JSON.parse(localStorage.getItem('opm_estoques_list')) || ['ALMOXARIFADO CENTRAL', 'FARMACIA', 'EXPEDIÇÃO'];

// CONTROLE DE PAGINAÇÃO DO ARMAZÉM / HISTÓRICO
let paginaAtualArmazem = 1;
const ITENS_POR_PAGINA = 5;

// UNIDADE E ORIGEM SELEÇÃO
let unidadeSelecionadaAtual = 'antenor';
let tipoOrigemAtual = 'interno';

// RESET AUTOMÁTICO TODO DOMINGO ÀS 23:00
function calcularProximoDomingo23h(baseTime = Date.now()) {
    const d = new Date(baseTime);
    const diaSemana = d.getDay(); // 0 = Domingo, 1 = Segunda, etc.
    
    // Dias até o próximo domingo
    let diasAtéDomingo = (7 - diaSemana) % 7;
    if (diasAtéDomingo === 0) {
        // Se já for domingo, checa se já passou das 23:00
        const horaAtual = d.getHours();
        const minAtual = d.getMinutes();
        const secAtual = d.getSeconds();
        const jaPassouDas23h = (horaAtual > 23) || (horaAtual === 23 && (minAtual > 0 || secAtual > 0));
        
        if (jaPassouDas23h) {
            diasAtéDomingo = 7;
        }
    }

    d.setDate(d.getDate() + diasAtéDomingo);
    d.setHours(23, 0, 0, 0);
    return d.getTime();
}

let nextResetTimestamp = parseInt(localStorage.getItem('opm_next_reset_ts'), 10) || calcularProximoDomingo23h();

// ARRAY TEMPORÁRIO PARA AS NOTAS DO MALOTE ATUAL EM MONTAGEM/EDIÇÃO
let notasEnvioMaloteTemp = [];
let maloteIdEmEdicao = null;

// ARMAZENA DADOS TEMPORÁRIOS DA CONFERÊNCIA EM 2 ETAPAS
let maloteEmConferenciaAtual = null;

// ARMAZENA DADOS DA BIPAGEM EM ESPERA PARA CADASTRO RÁPIDO DE FORNECEDOR
let bipPendente = null;

document.addEventListener('DOMContentLoaded', () => {
    window.malotesList = malotesList;
    window.fornecedoresMap = fornecedoresMap;
    window.responsaveisList = responsaveisList;
    window.estoquesList = estoquesList;
    window.nextResetTimestamp = nextResetTimestamp;
    
    verificarEExecutarResetDomingo23h();
    setInterval(verificarEExecutarResetDomingo23h, 30000); // Verifica periodicamente

    atualizarSetorAutomatico();
    carregarSelectResponsaveis();
    carregarSelectEstoques();

    // RESTAURA TIPO DE ORIGEM SELEÇÃO
    alternarTipoOrigem('interno');

    // RESTAURA O ÚLTIMO MODO DE ENTRADA SELECIONADO (BARCODE OU MANUAL)
    const ultimoModo = localStorage.getItem('opm_modo_entrada_nf') || 'barcode';
    const radioEl = document.querySelector(`input[name="modoEntradaNf"][value="${ultimoModo}"]`);
    if (radioEl) radioEl.checked = true;
    alternarModoEntradaNf(ultimoModo);

    renderizarListaNotasEnvio();
    renderizarModulos();

    // Listener para monitorar digitação / colagem automática da chave de acesso (DANFE)
    const inputBarcode = document.getElementById('barcodeInput');
    if (inputBarcode) {
        inputBarcode.addEventListener('input', processarEntradaChaveAcesso);
        inputBarcode.addEventListener('paste', () => setTimeout(processarEntradaChaveAcesso, 50));
    }
});

/* ALTERAR MODO DO FILTRO DE SETOR (ORIGEM / DESTINO) */
function alternarModoFiltroSetor(aba) {
    if (aba === 'devolutiva') {
        const modo = document.getElementById('filtroModoSetorDevolutiva').value;
        const lbl = document.getElementById('lblFiltroSetorDevolutiva');
        if (lbl) lbl.innerText = modo === 'ORIGEM' ? 'SETOR ORIGEM' : 'SETOR DESTINO';
        filtrarMalotesAbertos();
    } else if (aba === 'armazem') {
        const modo = document.getElementById('filtroModoSetorArmazem').value;
        const lbl = document.getElementById('lblFiltroSetorArmazem');
        if (lbl) lbl.innerText = modo === 'ORIGEM' ? 'SETOR ORIGEM' : 'SETOR DESTINO';
        filtrarArmazemComResetPagina();
    }
}

/* ALTERAR UNIDADE (ANTENOR DUARTE VILELA / FILIAIS) */
function selecionarUnidade(unidade) {
    unidadeSelecionadaAtual = unidade;
    document.getElementById('btnUnitAntenor').classList.toggle('active', unidade === 'antenor');
    document.getElementById('btnUnitFiliais').classList.toggle('active', unidade === 'filiais');
}

/* ALTERAR TIPO DE ORIGEM (INTERNO / EXTERNA) */
function alternarTipoOrigem(origem) {
    tipoOrigemAtual = origem;

    const gridTop = document.getElementById('gridTopConfigEnvio');
    const groupVerba = document.getElementById('groupTipoVerba');
    const groupEstoque = document.getElementById('groupLocalEstoque');
    const setorInp = document.getElementById('envioSetorInput');
    const setorSel = document.getElementById('envioSetorSelect');

    const selVerba = document.getElementById('envioTipoVerba');
    const selResp = document.getElementById('envioResponsavel');
    const selEstoque = document.getElementById('envioLocalEstoque');

    const lblResp = document.getElementById('lblResponsavel');

    if (origem === 'externa') {
        // Oculta Tipo de Verba e Local de Estoque
        if (groupVerba) groupVerba.style.display = 'none';
        if (groupEstoque) groupEstoque.style.display = 'none';

        // Ajusta grid para 2 colunas
        if (gridTop) gridTop.classList.add('modo-externo-grid');

        // Troca campo Setor de readonly para dropdown de seleção
        if (setorInp) setorInp.style.display = 'none';
        if (setorSel) setorSel.style.display = 'block';

        // Altera rótulo de Responsável para CONFERENTE
        if (lblResp) lblResp.innerHTML = `<i class="fa-solid fa-user-check"></i> CONFERENTE *`;

        selVerba.removeAttribute('required');
        selResp.setAttribute('required', 'required');
        selEstoque.removeAttribute('required');
    } else {
        // Exibe Tipo de Verba e Local de Estoque
        if (groupVerba) groupVerba.style.display = 'flex';
        if (groupEstoque) groupEstoque.style.display = 'flex';

        // Restaura grid para 4 colunas
        if (gridTop) gridTop.classList.remove('modo-externo-grid');

        // Restaura campo Setor para readonly automático
        if (setorInp) setorInp.style.display = 'block';
        if (setorSel) setorSel.style.display = 'none';

        // Restaura rótulo para RESPONSÁVEL
        if (lblResp) lblResp.innerHTML = `<i class="fa-solid fa-user"></i> RESPONSÁVEL *`;

        selVerba.setAttribute('required', 'required');
        selResp.setAttribute('required', 'required');
        selEstoque.setAttribute('required', 'required');

        atualizarSetorAutomatico();
    }

    // ATUALIZA INTERFACE MANUAL ENTRE INTERNO E EXTERNO
    atualizarVisibilidadeManual();
}

function atualizarVisibilidadeManual() {
    const modo = localStorage.getItem('opm_modo_entrada_nf') || 'barcode';
    const boxInt = document.getElementById('boxManualInterno');
    const boxExt = document.getElementById('boxManualExterno');

    if (modo === 'manual') {
        if (tipoOrigemAtual === 'externa') {
            if (boxInt) boxInt.style.display = 'none';
            if (boxExt) boxExt.style.display = 'block';
        } else {
            if (boxInt) boxInt.style.display = 'block';
            if (boxExt) boxExt.style.display = 'none';
        }
    }
}

/* AÇÃO DO BOTÃO VOLTAR SUPERIOR (DIRECIONA PARA O LOBBY) */
function voltarPaginaAnterior() {
    window.location.href = '../lobby/lobby.html';
}

/* SISTEMA DE RESET AUTOMÁTICO DOMINGO ÀS 23:00 (SOMENTE ABA HISTÓRICO/ARMAZÉM) */
function verificarEExecutarResetDomingo23h() {
    const agora = Date.now();
    if (agora >= nextResetTimestamp) {
        // Reseta somente o que estiver arquivado no Histórico (status 'ARMAZÉM')
        malotesList = malotesList.filter(m => m.statusMalote !== 'ARMAZÉM');
        nextResetTimestamp = calcularProximoDomingo23h(agora);
        localStorage.setItem('opm_next_reset_ts', nextResetTimestamp);
        salvarESincronizar();
        renderizarModulos();
        mostrarNotificacaoToast("Limpeza automática do Histórico executada!");
    } else {
        localStorage.setItem('opm_next_reset_ts', nextResetTimestamp);
    }
}

function alternarAbaPrincipal(aba) {
    document.getElementById('abaEnvioWrapper').style.display = aba === 'envio' ? 'block' : 'none';
    document.getElementById('abaDevolutivaWrapper').style.display = aba === 'devolutiva' ? 'block' : 'none';
    document.getElementById('abaArmazemWrapper').style.display = aba === 'armazem' ? 'block' : 'none';

    document.getElementById('btnTabEnvio').classList.toggle('active', aba === 'envio');
    document.getElementById('btnTabDevolutiva').classList.toggle('active', aba === 'devolutiva');
    document.getElementById('btnTabArmazem').classList.toggle('active', aba === 'armazem');

    renderizarModulos();

    if (aba === 'envio') {
        setTimeout(() => {
            focarCampoAtivo();
        }, 100);
    }
}

/* CARREGAR E GERENCIAR RESPONSÁVEIS */
function carregarSelectResponsaveis() {
    const sel = document.getElementById('envioResponsavel');
    if (!sel) return;
    const valAtual = sel.value;
    sel.innerHTML = `<option value="">Selecione...</option>` + 
        responsaveisList.map(r => `<option value="${r}">${r}</option>`).join('');
    if (valAtual && responsaveisList.includes(valAtual)) sel.value = valAtual;
}

function abrirModalGerenciarResponsavel() {
    renderizarListaResponsaveisModal();
    document.getElementById('modalGerenciarResponsavel').style.display = 'flex';
}

function fecharModalGerenciarResponsavel() {
    document.getElementById('modalGerenciarResponsavel').style.display = 'none';
}

function renderizarListaResponsaveisModal() {
    const container = document.getElementById('listaResponsaveisCadastrados');
    if (!container) return;
    if (responsaveisList.length === 0) {
        container.innerHTML = `<div style="padding:15px; text-align:center; color:var(--text-muted);">Nenhum usuário cadastrado.</div>`;
        return;
    }
    container.innerHTML = responsaveisList.map((resp, idx) => `
        <div class="modal-item-row">
            <span>${resp}</span>
            <button type="button" class="btn-del-modal-item" onclick="removerResponsavel(${idx})" title="Remover"><i class="fa-solid fa-trash"></i></button>
        </div>
    `).join('');
}

function adicionarNovoResponsavel() {
    const inp = document.getElementById('inputNovoResponsavel');
    const val = inp.value.trim().toUpperCase();
    if (!val) {
        alert("Digite o nome do novo usuário.");
        return;
    }
    if (responsaveisList.includes(val)) {
        alert("Usuário já cadastrado.");
        return;
    }
    responsaveisList.push(val);
    inp.value = '';
    salvarESincronizar();
    carregarSelectResponsaveis();
    renderizarListaResponsaveisModal();
    mostrarNotificacaoToast("Usuário adicionado com sucesso!");
}

function removerResponsavel(index) {
    responsaveisList.splice(index, 1);
    salvarESincronizar();
    carregarSelectResponsaveis();
    renderizarListaResponsaveisModal();
    mostrarNotificacaoToast("Usuário removido.");
}

/* CARREGAR E GERENCIAR ESTOQUES */
function carregarSelectEstoques() {
    const sel = document.getElementById('envioLocalEstoque');
    if (!sel) return;
    const valAtual = sel.value;
    sel.innerHTML = `<option value="">Selecione...</option>` + 
        estoquesList.map(e => `<option value="${e}">${e}</option>`).join('');
    if (valAtual && estoquesList.includes(valAtual)) sel.value = valAtual;
}

function abrirModalGerenciarEstoque() {
    renderizarListaEstoquesModal();
    document.getElementById('modalGerenciarEstoque').style.display = 'flex';
}

function fecharModalGerenciarEstoque() {
    document.getElementById('modalGerenciarEstoque').style.display = 'none';
}

function renderizarListaEstoquesModal() {
    const container = document.getElementById('listaEstoquesCadastrados');
    if (!container) return;
    if (estoquesList.length === 0) {
        container.innerHTML = `<div style="padding:15px; text-align:center; color:var(--text-muted);">Nenhum local cadastrado.</div>`;
        return;
    }
    container.innerHTML = estoquesList.map((est, idx) => `
        <div class="modal-item-row">
            <span>${est}</span>
            <button type="button" class="btn-del-modal-item" onclick="removerEstoque(${idx})" title="Remover"><i class="fa-solid fa-trash"></i></button>
        </div>
    `).join('');
}

function adicionarNovoEstoque() {
    const inp = document.getElementById('inputNovoEstoque');
    const val = inp.value.trim().toUpperCase();
    if (!val) {
        alert("Digite o nome do local de estoque.");
        return;
    }
    if (estoquesList.includes(val)) {
        alert("Local de estoque já cadastrado.");
        return;
    }
    estoquesList.push(val);
    inp.value = '';
    salvarESincronizar();
    carregarSelectEstoques();
    renderizarListaEstoquesModal();
    mostrarNotificacaoToast("Local de estoque adicionado!");
}

function removerEstoque(index) {
    estoquesList.splice(index, 1);
    salvarESincronizar();
    carregarSelectEstoques();
    renderizarListaEstoquesModal();
    mostrarNotificacaoToast("Local de estoque removido.");
}

/* ALTERNÂNCIA E PERSISTÊNCIA DO MODO DE ENTRADA */
function alternarModoEntradaNf(modo) {
    localStorage.setItem('opm_modo_entrada_nf', modo);

    const boxBarcode = document.getElementById('sectionBarcodeScanner');
    const boxManual = document.getElementById('sectionManualInput');

    if (modo === 'barcode') {
        boxBarcode.style.display = 'block';
        boxManual.style.display = 'none';
    } else {
        boxBarcode.style.display = 'none';
        boxManual.style.display = 'block';
        atualizarVisibilidadeManual();
    }
    focarCampoAtivo();
}

function focarCampoAtivo() {
    const modo = localStorage.getItem('opm_modo_entrada_nf') || 'barcode';
    if (modo === 'barcode') {
        const inp = document.getElementById('barcodeInput');
        if (inp) inp.focus();
    } else {
        if (tipoOrigemAtual === 'externa') {
            const inp = document.getElementById('manualExtNumNf');
            if (inp) inp.focus();
        } else {
            const inp = document.getElementById('manualNfInput');
            if (inp) inp.focus();
        }
    }
}

/* PREENCHIMENTO AUTOMÁTICO DO CAMPO SETOR */
function atualizarSetorAutomatico() {
    if (tipoOrigemAtual === 'externa') return;
    const verba = document.getElementById('envioTipoVerba').value;
    const campoSetorInp = document.getElementById('envioSetorInput');
    if (verba === 'RESTRICAO') {
        campoSetorInp.value = 'PRESTAÇÃO DE CONTAS';
    } else {
        campoSetorInp.value = 'FINANCEIRO';
    }
}

/* HELPER PARA CORRESPONDÊNCIA DE UNIDADE/ABA */
function verificarPertenceUnidadeAtual(itemUnidade, itemAba) {
    const unNormalizada = (itemUnidade || itemAba || '').toString().toLowerCase();
    
    if (unidadeSelecionadaAtual === 'antenor') {
        return unNormalizada.includes('antenor') || unNormalizada.includes('vilela') || unNormalizada === 'antenor_vilela';
    } else {
        return unNormalizada.includes('filial') || unNormalizada.includes('filiais');
    }
}

/* CONSULTA E VALIDAÇÃO DA NOTA NAS BASES */
function consultarEValidarNota(numNfBusca) {
    const cleanNum = String(numNfBusca).trim();
    if (!cleanNum) return null;

    if (tipoOrigemAtual === 'externa') {
        return {
            sucesso: true,
            numeroNf: cleanNum,
            fornecedor: 'N/A',
            origem: 'Externa'
        };
    }

    const unNomeFormatado = unidadeSelecionadaAtual === 'antenor' ? 'Antenor Duarte Vilela' : 'Filiais';

    const finalizadas = window.gestaoFinalizadasNFs || JSON.parse(localStorage.getItem('opm_notas_finalizadas_local')) || JSON.parse(localStorage.getItem('opm_notas_finalizadas')) || [];
    
    const notaFinalizada = finalizadas.find(n => {
        const numMatch = String(n.numeroNf || n.nf).trim() === cleanNum;
        if (!numMatch) return false;
        return verificarPertenceUnidadeAtual(n.unidade, n.aba);
    });

    if (notaFinalizada) {
        return {
            sucesso: true,
            numeroNf: String(notaFinalizada.numeroNf || notaFinalizada.nf).trim(),
            fornecedor: notaFinalizada.empresa || notaFinalizada.fornecedor || 'N/A',
            origem: 'Finalizadas'
        };
    }

    const tratativas = window.tratativasSalvas || JSON.parse(localStorage.getItem('opm_tratativas_salvas')) || [];
    
    const notaTratativa = tratativas.find(t => {
        const numMatch = String(t.numeroNf || t.nf).trim() === cleanNum;
        if (!numMatch) return false;
        return verificarPertenceUnidadeAtual(t.unidade, t.aba);
    });

    if (notaTratativa) {
        const estaCalculada = notaTratativa.calculada !== undefined ? notaTratativa.calculada : true;
        if (!estaCalculada) {
            return {
                sucesso: false,
                mensagem: `Nota fiscal #${cleanNum} não calculada, não foi possível adicionar.`
            };
        }
        return {
            sucesso: true,
            numeroNf: String(notaTratativa.numeroNf || notaTratativa.nf).trim(),
            fornecedor: notaTratativa.empresa || notaTratativa.fornecedor || 'N/A',
            origem: 'Tratativas (Calculada)'
        };
    }

    return {
        sucesso: false,
        mensagem: `Nota fiscal #${cleanNum} não localizada na unidade ${unNomeFormatado.toUpperCase()}.`
    };
}

function tentarAdicionarNotaValidada(numNf, fornecedorFallback = '') {
    const numClean = String(numNf).trim();
    if (!numClean) return;

    if (notasEnvioMaloteTemp.some(n => n.numeroNf === numClean)) {
        mostrarNotificacaoToast(`Nota Fiscal #${numClean} já foi incluída no malote.`);
        return;
    }

    const res = consultarEValidarNota(numClean);

    if (!res.sucesso) {
        alert(res.mensagem);
        return;
    }

    const fornecedorFinal = (res.fornecedor && res.fornecedor !== 'N/A') ? res.fornecedor : (fornecedorFallback || 'N/A');

    notasEnvioMaloteTemp.push({
        idNf: Date.now() + Math.random(),
        numeroNf: res.numeroNf,
        fornecedor: fornecedorFinal,
        origem: res.origem,
        viaCarimbadaVoltou: 'NAO',
        devolvida: 'NAO',
        estornada: 'NAO',
        statusNotaFiscal: ' - '
    });

    renderizarListaNotasEnvio();
    mostrarNotificacaoToast(`Nota Fiscal #${res.numeroNf} adicionada ao malote!`);
}

function renderizarListaNotasEnvio() {
    const container = document.getElementById('container-nfs-envio');
    const counter = document.getElementById('countNotasIncluidas');
    const btnLimpar = document.getElementById('btnLimparMaloteForm');
    
    if (!container) return;

    if (counter) counter.innerText = notasEnvioMaloteTemp.length;

    if (btnLimpar) {
        btnLimpar.style.display = notasEnvioMaloteTemp.length > 0 ? 'inline-flex' : 'none';
    }

    if (notasEnvioMaloteTemp.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 24px; color: var(--text-muted); background: #FAFAFA; border: 1px dashed var(--card-border); border-radius: 10px;">
                <i class="fa-solid fa-inbox" style="font-size: 1.5rem; margin-bottom: 6px;"></i><br>
                Nenhuma nota fiscal adicionada ao malote ainda.
            </div>`;
        return;
    }

    container.innerHTML = notasEnvioMaloteTemp.map((nota, index) => `
        <div class="bloco-nf-envio-item">
            <div class="nf-item-info">
                <strong>NF #${nota.numeroNf}</strong> — <span>${nota.fornecedor}</span>
                <span class="nf-item-badge-source">${nota.origem || 'VALIDADA'}</span>
            </div>
            <button type="button" class="btn-remover-nf" onclick="removerNotaEnvio(${index})" title="Remover Nota">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `).join('');
}

function removerNotaEnvio(index) {
    notasEnvioMaloteTemp.splice(index, 1);
    renderizarListaNotasEnvio();
    mostrarNotificacaoToast("Nota removida do malote.");
}

function limparFormularioEnvio() {
    document.getElementById('form-envio-malote').reset();
    notasEnvioMaloteTemp = [];
    maloteIdEmEdicao = null;
    
    document.getElementById('tituloBlocoEnvio').innerText = "MONTAGEM DE MALOTE PARA SAÍDA";
    document.getElementById('btnSubmitEnvio').innerHTML = `<i class="fa-solid fa-print"></i> Registrar e Gerar Protocolo`;
    document.getElementById('btnCancelarEdicao').style.display = 'none';

    const radioInt = document.getElementById('radioOrigemInterno');
    if (radioInt) radioInt.checked = true;
    alternarTipoOrigem('interno');

    const ultimoModo = localStorage.getItem('opm_modo_entrada_nf') || 'barcode';
    const radioEl = document.querySelector(`input[name="modoEntradaNf"][value="${ultimoModo}"]`);
    if (radioEl) radioEl.checked = true;
    alternarModoEntradaNf(ultimoModo);

    renderizarListaNotasEnvio();
    atualizarSetorAutomatico();
    focarCampoAtivo();
}

function cancelarEdicaoMalote() {
    limparFormularioEnvio();
    mostrarNotificacaoToast("Edição cancelada.");
    alternarAbaPrincipal('devolutiva');
}

function editarMalotePendente(idMalote) {
    const malote = malotesList.find(m => m.id === idMalote);
    if (!malote) return;

    maloteIdEmEdicao = malote.id;
    notasEnvioMaloteTemp = JSON.parse(JSON.stringify(malote.itens || []));

    const tipoOrig = malote.tipoOrigem || 'interno';
    const radioOrig = document.querySelector(`input[name="tipoOrigemMalote"][value="${tipoOrig}"]`);
    if (radioOrig) radioOrig.checked = true;
    alternarTipoOrigem(tipoOrig);

    if (tipoOrig === 'interno') {
        const selectVerba = document.getElementById('envioTipoVerba');
        if (selectVerba) selectVerba.value = malote.tipoVerba === 'RESTRIÇÃO' ? 'RESTRICAO' : 'RECURSO_PROPRIO';
        atualizarSetorAutomatico();
    } else {
        const selectSetor = document.getElementById('envioSetorSelect');
        if (selectSetor && malote.origemSetor) selectSetor.value = malote.origemSetor;
    }

    if (malote.responsavel) document.getElementById('envioResponsavel').value = malote.responsavel;
    if (malote.localEstoque) document.getElementById('envioLocalEstoque').value = malote.localEstoque;

    document.getElementById('tituloBlocoEnvio').innerText = tipoOrig === 'externa' ? `EDIÇÃO REGISTRO DE NOTAS` : `EDIÇÃO DE MALOTE: ${malote.codigo}`;
    document.getElementById('btnSubmitEnvio').innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Atualizar Registro`;
    document.getElementById('btnCancelarEdicao').style.display = 'inline-flex';

    renderizarListaNotasEnvio();
    alternarAbaPrincipal('envio');
}

function excluirMalotePendente(idMalote) {
    const malote = malotesList.find(m => m.id === idMalote);
    if (!malote) return;

    const descr = malote.tipoOrigem === 'externa' ? 'registro de notas' : `malote ${malote.codigo}`;
    if (confirm(`Tem certeza que deseja excluir permanentemente o ${descr}?`)) {
        malotesList = malotesList.filter(m => m.id !== idMalote);
        salvarESincronizar();
        renderizarModulos();
        mostrarNotificacaoToast("Registro excluído com sucesso!");
    }
}

function processarDigitacaoManualNf() {
    const input = document.getElementById('manualNfInput');
    if (!input) return;

    const texto = input.value.trim();
    if (!texto) {
        alert("Digite ao menos um número de Nota Fiscal.");
        return;
    }

    const listaNotas = texto.split(',').map(n => n.trim()).filter(n => n.length > 0);

    listaNotas.forEach(num => {
        tentarAdicionarNotaValidada(num);
    });

    input.value = '';
}

function processarDigitacaoManualExterno() {
    const inpNum = document.getElementById('manualExtNumNf');
    const inpForn = document.getElementById('manualExtFornecedor');

    const numNf = inpNum ? inpNum.value.trim() : '';
    const fornecedor = inpForn ? inpForn.value.trim() : '';

    if (!numNf) {
        alert("Preencha o Número da Nota Fiscal.");
        if (inpNum) inpNum.focus();
        return;
    }

    if (!fornecedor) {
        alert("Preencha o Nome do Fornecedor.");
        if (inpForn) inpForn.focus();
        return;
    }

    tentarAdicionarNotaValidada(numNf, fornecedor);

    inpNum.value = '';
    inpForn.value = '';
    inpNum.focus();
}

function tratarInputManualNf(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (tipoOrigemAtual === 'externa') {
            processarDigitacaoManualExterno();
        } else {
            processarDigitacaoManualNf();
        }
    }
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

        if (!nomeEmpresa && tipoOrigemAtual === 'interno') {
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

        tentarAdicionarNotaValidada(numNf, nomeEmpresa || 'N/A');
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
            tentarAdicionarNotaValidada(bipPendente.numeroNf, nomeEmpresa);
        }
        bipPendente = null;
    }

    focarCampoAtivo();
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

    if (typeof window.syncMalotesFirebase === "function") {
        window.fornecedoresMap = fornecedoresMap;
        window.syncMalotesFirebase();
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
        } else if (typeof window.syncMalotesFirebase === "function") {
            window.fornecedoresMap = fornecedoresMap;
            window.syncMalotesFirebase();
        }

        renderizarTabelaFornecedores();
        mostrarNotificacaoToast("Fornecedor excluído com sucesso!");
    }
}

function handleSalvarEnvioMalote(e) {
    e.preventDefault();

    const resp = document.getElementById('envioResponsavel').value;
    const est = document.getElementById('envioLocalEstoque').value;

    if (tipoOrigemAtual === 'interno') {
        if (!resp) {
            alert("Selecione o Usuário Responsável.");
            return;
        }
        if (!est) {
            alert("Selecione o Local de Estoque.");
            return;
        }
    } else {
        if (!resp) {
            alert("Selecione o Conferente.");
            return;
        }
    }

    if (notasEnvioMaloteTemp.length === 0) {
        alert("Preencha e adicione ao menos uma Nota Fiscal ao malote.");
        return;
    }

    processarSalvamentoMalote();
}

function processarSalvamentoMalote() {
    let tipoVerba = 'N/A';
    let setorOrigem = 'CENTRAL DE NOTAS';
    let setorDestino = '';

    if (tipoOrigemAtual === 'externa') {
        setorOrigem = document.getElementById('envioSetorSelect').value;
        setorDestino = 'CENTRAL DE NOTAS';
    } else {
        const verbaVal = document.getElementById('envioTipoVerba').value;
        tipoVerba = verbaVal === 'RESTRICAO' ? 'RESTRIÇÃO' : 'RECURSO PRÓPRIO';
        setorDestino = document.getElementById('envioSetorInput').value;
    }

    const responsavel = document.getElementById('envioResponsavel').value;
    const localEstoque = tipoOrigemAtual === 'externa' ? 'N/A' : document.getElementById('envioLocalEstoque').value;

    const stringDataExibicao = new Date().toLocaleString('pt-BR');
    const qtdVias = tipoVerba === 'RESTRIÇÃO' ? 3 : 2;

    if (maloteIdEmEdicao) {
        const idx = malotesList.findIndex(m => m.id === maloteIdEmEdicao);
        if (idx !== -1) {
            malotesList[idx].unidade = unidadeSelecionadaAtual === 'antenor' ? 'ANTENOR DUARTE VILELA' : 'FILIAIS';
            malotesList[idx].tipoOrigem = tipoOrigemAtual;
            malotesList[idx].tipoVerba = tipoVerba;
            malotesList[idx].qtdVias = qtdVias;
            malotesList[idx].origemSetor = setorOrigem;
            malotesList[idx].destinoSetor = setorDestino;
            malotesList[idx].responsavel = responsavel;
            malotesList[idx].localEstoque = localEstoque;
            malotesList[idx].dataEnvio = stringDataExibicao;
            malotesList[idx].itens = JSON.parse(JSON.stringify(notasEnvioMaloteTemp));

            salvarESincronizar();
            imprimirRelatorioEnvioMalote(malotesList[idx]);
            mostrarNotificacaoToast("Registro atualizado com sucesso!");
        }
    } else {
        const codigoMalote = 'MLT-' + Math.floor(100000 + Math.random() * 900000);
        const novoMalote = {
            id: Date.now(),
            codigo: codigoMalote,
            unidade: unidadeSelecionadaAtual === 'antenor' ? 'ANTENOR DUARTE VILELA' : 'FILIAIS',
            tipoOrigem: tipoOrigemAtual,
            tipoVerba: tipoVerba,
            qtdVias: qtdVias,
            origemSetor: setorOrigem,
            destinoSetor: setorDestino,
            responsavel: responsavel,
            localEstoque: localEstoque,
            dataEnvio: stringDataExibicao,
            statusMalote: 'EM_TRANSITO',
            obsRetorno: '',
            itens: JSON.parse(JSON.stringify(notasEnvioMaloteTemp))
        };

        malotesList.unshift(novoMalote);
        salvarESincronizar();

        imprimirRelatorioEnvioMalote(novoMalote);
        mostrarNotificacaoToast("Registro salvo com sucesso!");
    }

    limparFormularioEnvio();
    alternarAbaPrincipal('devolutiva');
}

function imprimirRelatorioEnvioMalote(malote) {
    const isExt = malote.tipoOrigem === 'externa';
    const win = window.open('', '_blank');
    win.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>RELATORIO DE CONFERENCIA DE NOTAS FISCAIS</title>
            <style>
                @page { size: auto; margin: 0; }
                body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; padding: 40px; color: #1E293B; line-height: 1.5; background: #FFF; }
                .header { text-align: center; border-bottom: 2px solid #035AA6; padding-bottom: 12px; margin-bottom: 24px; }
                .header h2 { color: #035AA6; margin: 0; font-size: 1.4rem; text-transform: uppercase; font-weight: 800; }
                .header h3 { color: #035AA6; margin: 6px 0 0 0; font-size: 1.1rem; text-transform: uppercase; font-weight: 800; }
                
                .meta-box { background: #FEF2F2; border: 1px solid #FCA5A5; padding: 14px 18px; border-radius: 8px; font-size: 0.9rem; margin-bottom: 24px; }
                .meta-box div { margin-bottom: 4px; }
                
                table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px; }
                th, td { border: 1px solid #CBD5E1; padding: 10px 12px; font-size: 0.88rem; text-align: left; }
                th { background: #F1F5F9; color: #035AA6; font-weight: 800; text-transform: uppercase; }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>CENTRAL DE NOTAS</h2>
                <h3>RELATORIO DE CONFERENCIA DE NOTAS FISCAIS</h3>
            </div>

            <div class="meta-box">
                <div><strong>Unidade:</strong> ${malote.unidade || 'ANTENOR DUARTE VILELA'}</div>
                <div><strong>Origem:</strong> ${malote.origemSetor || 'CENTRAL DE NOTAS'} | <strong>Destino:</strong> ${malote.destinoSetor} | <strong>${isExt ? 'Conferente' : 'Responsável'}:</strong> ${malote.responsavel || '-'}</div>
                ${!isExt ? `<div><strong>Tipo de Verba:</strong> ${malote.tipoVerba} \vert{} <strong>Emissão:</strong> ${malote.dataEnvio}</div>` : `<div><strong>Emissão:</strong> ${malote.dataEnvio}</div>`}
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Nº NOTA FISCAL</th>
                        <th>FORNECEDOR</th>
                        ${!isExt ? `<th>LOCAL ESTOQUE</th>` : ''}
                    </tr>
                </thead>
                <tbody>
                    ${malote.itens.map(i => `
                        <tr>
                            <td><strong>${i.numeroNf}</strong></td>
                            <td>${i.fornecedor}</td>${!isExt ? `<td>${malote.localEstoque || '-'}</td>` : ''}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </body>
        </html>
    `);
    win.document.close();
}

function renderizarModulos() {
    renderizarDevolutivas();
    renderizarArmazem();
}

function renderizarDevolutivas() {
    const container = document.getElementById('containerMalotesParaConferencia');
    if (!container) return;

    const termo = (document.getElementById('inputPesquisaMalote')?.value || '').toLowerCase();
    const filtroVerba = document.getElementById('filtroTipoVerbaDevolutiva')?.value || '';
    const modoSetor = document.getElementById('filtroModoSetorDevolutiva')?.value || 'DESTINO';
    const filtroSetor = document.getElementById('filtroSetorDevolutiva')?.value || '';

    const filtrados = malotesList.filter(m => {
        const emTransito = m.statusMalote === 'EM_TRANSITO';
        const porCod = m.codigo.toLowerCase().includes(termo);
        const porNf = m.itens.some(i => i.numeroNf.toLowerCase().includes(termo) || i.fornecedor.toLowerCase().includes(termo));
        const verbaMatch = !filtroVerba || m.tipoVerba === filtroVerba || m.tipoOrigem === 'externa';

        let setorMatch = true;
        if (filtroSetor) {
            if (modoSetor === 'ORIGEM') {
                setorMatch = m.origemSetor === filtroSetor;
            } else {
                setorMatch = m.destinoSetor === filtroSetor;
            }
        }

        return emTransito && (porCod || porNf) && verbaMatch && setorMatch;
    });

    if (filtrados.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 30px; color: var(--text-muted);">Nenhum registro pendente para conferência.</div>`;
        return;
    }

    container.innerHTML = filtrados.map(m => {
        const isExt = m.tipoOrigem === 'externa';
        return `
            <div class="card-malote-item">
                <div class="card-malote-header">
                    <div>
                        ${!isExt ? `<strong>MALOTE: ${m.codigo}</strong> | ` : ''}Enviado em: ${m.dataEnvio} 
                        ${!isExt ? `<span class="tag-verba ${m.tipoVerba === 'RESTRIÇÃO' ? 'tag-restricao' : 'tag-proprio'}">${m.tipoVerba}</span>` : ''}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button type="button" class="btn-card-action btn-card-view" onclick="visualizarProtocoloEnvioDevolutiva(${m.id})" title="Visualizar Protocolo de Envio">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                        <button type="button" class="btn-card-action btn-card-edit" onclick="editarMalotePendente(${m.id})" title="Editar Registros">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button type="button" class="btn-card-action btn-card-delete" onclick="excluirMalotePendente(${m.id})" title="Excluir Registros">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div style="font-size: 0.85rem; margin-bottom: 8px;">
                    <strong>Unidade:</strong> ${m.unidade || 'ANTENOR DUARTE VILELA'} | <strong>Setor Origem:</strong> ${m.origemSetor || 'CENTRAL DE NOTAS'} | <strong>Setor Destino:</strong> ${m.destinoSetor} | <strong>${isExt ? 'Conferente' : 'Responsável'}:</strong> ${m.responsavel || '-'} ${!isExt ? `| <strong>Estoque:</strong> ${m.localEstoque || '-'}` : ''} | <strong>Qtd. NFs:</strong> ${m.itens.length}
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 8px;">
                    <button type="button" class="btn-primary-action" onclick="iniciarConferenciaDevolutiva(${m.id})">
                        <i class="fa-solid fa-clipboard-check"></i> CONFERIR RETORNO DE RELATÓRIO
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function visualizarProtocoloEnvioDevolutiva(idMalote) {
    const malote = malotesList.find(m => m.id === idMalote);
    if (malote) {
        imprimirRelatorioEnvioMalote(malote);
    }
}

/* DECIDE O FLUXO DE CONFERÊNCIA (DIRETO ETAPA 2 PARA EXTERNO) */
function iniciarConferenciaDevolutiva(maloteId) {
    const malote = malotesList.find(m => m.id === maloteId);
    if (!malote) return;

    if (malote.tipoOrigem === 'externa') {
        maloteEmConferenciaAtual = JSON.parse(JSON.stringify(malote));
        abrirModalEtapa2();
    } else {
        abrirModalEtapa1(maloteId);
    }
}

/* MODAL ETAPA 1 */
function abrirModalEtapa1(maloteId) {
    const malote = malotesList.find(m => m.id === maloteId);
    if (!malote) return;

    maloteEmConferenciaAtual = JSON.parse(JSON.stringify(malote));

    document.getElementById('modalEtapa1MaloteId').value = malote.id;
    document.getElementById('modalEtapa1Codigo').innerText = malote.codigo;
    document.getElementById('obsEtapa1').value = malote.obsRetorno || '';

    const bVia = document.getElementById('bulkViaCarimbadaSelect');
    const bDev = document.getElementById('bulkDevolvidaSelect');
    if (bVia) bVia.value = "";
    if (bDev) bDev.value = "";

    document.getElementById('modalEtapa1MetaInfo').innerText = 
        `Setor Origem: ${malote.origemSetor || 'CENTRAL DE NOTAS'} | Destino: ${malote.destinoSetor} | Responsável: ${malote.responsavel || '-'} | Verba: ${malote.tipoVerba}`;

    const tbody = document.getElementById('tbodyEtapa1');
    tbody.innerHTML = malote.itens.map((item, idx) => `
        <tr>
            <td><strong>${item.numeroNf}</strong></td>
            <td>${item.fornecedor}</td>
            <td class="text-center">
                <select class="select-tbl-simnao select-via-carimbada-item" id="selectViaCarimbada_${idx}" onchange="atualizarEstiloSelect(this)">
                    <option value="NAO" ${item.viaCarimbadaVoltou === 'SIM' ? '' : 'selected'}>NÃO</option>
                    <option value="SIM" ${item.viaCarimbadaVoltou === 'SIM' ? 'selected' : ''}>SIM</option>
                </select>
            </td>
            <td class="text-center">
                <select class="select-tbl-simnao select-devolvida-item" id="selectDevolvida_${idx}" onchange="atualizarEstiloSelect(this)">
                    <option value="NAO" ${item.devolvida === 'SIM' ? '' : 'selected'}>NÃO</option>
                    <option value="SIM" ${item.devolvida === 'SIM' ? 'selected' : ''}>SIM</option>
                </select>
            </td>
        </tr>
    `).join('');

    setTimeout(() => {
        tbody.querySelectorAll('.select-tbl-simnao').forEach(sel => atualizarEstiloSelect(sel));
    }, 50);

    document.getElementById('modalConferirEtapa1').style.display = 'flex';
}

function marcarTodosEtapa1(campo, valor) {
    if (!valor) return;
    const seletor = campo === 'viaCarimbada' ? '.select-via-carimbada-item' : '.select-devolvida-item';
    const selects = document.querySelectorAll(seletor);
    selects.forEach(sel => {
        sel.value = valor;
        atualizarEstiloSelect(sel);
    });
}

function atualizarEstiloSelect(selectEl) {
    if (selectEl.value === 'SIM') {
        selectEl.classList.add('select-sim');
        selectEl.classList.remove('select-nao');
    } else {
        selectEl.classList.add('select-nao');
        selectEl.classList.remove('select-sim');
    }
}

function fecharModalEtapa1() {
    document.getElementById('modalConferirEtapa1').style.display = 'none';
}

function avancarParaEtapa2() {
    if (!maloteEmConferenciaAtual) return;

    const obsVal = document.getElementById('obsEtapa1').value.trim();

    maloteEmConferenciaAtual.itens.forEach((item, idx) => {
        const viaVal = document.getElementById(`selectViaCarimbada_${idx}`).value;
        const devVal = document.getElementById(`selectDevolvida_${idx}`).value;

        item.viaCarimbadaVoltou = viaVal;
        item.devolvida = devVal;
    });

    maloteEmConferenciaAtual.obsRetorno = obsVal;

    fecharModalEtapa1();
    abrirModalEtapa2();
}

/* MODAL ETAPA 2 */
function abrirModalEtapa2() {
    if (!maloteEmConferenciaAtual) return;

    const isExt = maloteEmConferenciaAtual.tipoOrigem === 'externa';

    const modalTitleEl = document.querySelector('#modalConferirEtapa2 .modal-header h3');
    if (modalTitleEl) {
        if (isExt) {
            modalTitleEl.innerHTML = `<i class="fa-solid fa-clipboard-check"></i> Finalização da Conferência`;
        } else {
            modalTitleEl.innerHTML = `<i class="fa-solid fa-clipboard-check"></i> Finalização da Conferência — Malote <span id="modalEtapa2Codigo">${maloteEmConferenciaAtual.codigo}</span>`;
        }
    }

    const btnVoltar = document.getElementById('btnVoltarEtapa2');
    if (btnVoltar) btnVoltar.style.display = isExt ? 'none' : 'inline-flex';

    if (isExt) {
        document.getElementById('modalEtapa2MetaInfo').innerText = 
            `Setor Origem: ${maloteEmConferenciaAtual.origemSetor || 'PRESTAÇÃO DE CONTAS'} | Destino: ${maloteEmConferenciaAtual.destinoSetor || 'CENTRAL DE NOTAS'} | Conferente: ${maloteEmConferenciaAtual.responsavel || '-'}`;
    } else {
        document.getElementById('modalEtapa2MetaInfo').innerText = 
            `Setor Origem: ${maloteEmConferenciaAtual.origemSetor || 'CENTRAL DE NOTAS'} | Destino: ${maloteEmConferenciaAtual.destinoSetor} | Responsável: ${maloteEmConferenciaAtual.responsavel || '-'} | Verba: ${maloteEmConferenciaAtual.tipoVerba}`;
    }

    const bEst = document.getElementById('bulkEstornadaSelect');
    if (bEst) bEst.value = "";

    const tbody = document.getElementById('tbodyEtapa2');
    tbody.innerHTML = maloteEmConferenciaAtual.itens.map((item, idx) => {
        const isEstornada = item.estornada === 'SIM';
        return `
            <tr>
                <td><strong>${item.numeroNf}</strong></td>
                <td>${item.fornecedor}</td>
                <td class="text-center">
                    <select class="select-tbl-simnao select-estornada-item" id="selectEstornada_${idx}" onchange="tratarTrocaEstorno(${idx}, this)">
                        <option value="NAO" ${!isEstornada ? 'selected' : ''}>NÃO</option>
                        <option value="SIM" ${isEstornada ? 'selected' : ''}>SIM</option>
                    </select>
                </td>
                <td class="text-center" id="cellFisico_${idx}">
                    ${renderStatusNotaFiscal(isEstornada, isExt)}
                </td>
            </tr>
        `;
    }).join('');

    setTimeout(() => {
        tbody.querySelectorAll('.select-tbl-simnao').forEach(sel => atualizarEstiloSelect(sel));
    }, 50);

    document.getElementById('modalConferirEtapa2').style.display = 'flex';
}

function marcarTodosEtapa2Estorno(valor) {
    if (!valor) return;
    const selects = document.querySelectorAll('.select-estornada-item');
    selects.forEach((sel, idx) => {
        sel.value = valor;
        tratarTrocaEstorno(idx, sel);
    });
}

function renderStatusNotaFiscal(isEstornada, isExt = false) {
    if (isEstornada) {
        return `<span class="badge-status-nf-sim">Nota Recebida</span>`;
    } else {
        if (isExt) {
            return `<span class="badge-status-nf-nao">Nota Não Recebida</span>`;
        }
        return `<span class="text-status-nf-nao">-</span>`;
    }
}

function tratarTrocaEstorno(idx, selectEl) {
    atualizarEstiloSelect(selectEl);
    const cellFisico = document.getElementById(`cellFisico_${idx}`);
    const isSim = selectEl.value === 'SIM';
    const isExt = maloteEmConferenciaAtual && maloteEmConferenciaAtual.tipoOrigem === 'externa';

    if (cellFisico) {
        cellFisico.innerHTML = renderStatusNotaFiscal(isSim, isExt);
    }
}

function fecharModalEtapa2() {
    document.getElementById('modalConferirEtapa2').style.display = 'none';
}

function voltarParaEtapa1() {
    fecharModalEtapa2();
    document.getElementById('modalConferirEtapa1').style.display = 'flex';
}

/* FINALIZAÇÃO DA CONFERÊNCIA */
function finalizarConferenciaArmazem() {
    if (!maloteEmConferenciaAtual) return;

    const isExt = maloteEmConferenciaAtual.tipoOrigem === 'externa';

    maloteEmConferenciaAtual.itens.forEach((item, idx) => {
        const estVal = document.getElementById(`selectEstornada_${idx}`).value;
        item.estornada = estVal;
        
        if (estVal === 'SIM') {
            item.statusNotaFiscal = 'Nota Recebida';
        } else {
            item.statusNotaFiscal = isExt ? 'Nota Não Recebida' : ' - ';
        }
    });

    maloteEmConferenciaAtual.statusMalote = 'ARMAZÉM';
    maloteEmConferenciaAtual.dataFinalizacaoArmazem = new Date().toLocaleString('pt-BR');

    const index = malotesList.findIndex(m => m.id === maloteEmConferenciaAtual.id);
    if (index !== -1) {
        malotesList[index] = maloteEmConferenciaAtual;
    } else {
        malotesList.unshift(maloteEmConferenciaAtual);
    }

    salvarESincronizar();
    fecharModalEtapa2();

    const idMaloteFinalizado = maloteEmConferenciaAtual.id;
    maloteEmConferenciaAtual = null;

    paginaAtualArmazem = 1;
    alternarAbaPrincipal('armazem');
    mostrarNotificacaoToast("Relatório finalizado e arquivado no Histórico!");

    visualizarRelatorioCompletoArmazem(idMaloteFinalizado);
}

function filtrarArmazemComResetPagina() {
    paginaAtualArmazem = 1;
    renderizarArmazem();
}

/* HISTÓRICO DE RELATÓRIOS */
function renderizarArmazem() {
    const container = document.getElementById('containerArmazemList');
    if (!container) return;

    const termo = (document.getElementById('inputPesquisaArmazem')?.value || '').toLowerCase();
    const modoSetor = document.getElementById('filtroModoSetorArmazem')?.value || 'DESTINO';
    const filtroSetor = document.getElementById('filtroSetorArmazem')?.value || '';

    const filtrados = malotesList.filter(m => {
        const noArmazem = m.statusMalote === 'ARMAZÉM';
        const porCod = m.codigo.toLowerCase().includes(termo);
        const porNf = m.itens.some(i => i.numeroNf.toLowerCase().includes(termo) || i.fornecedor.toLowerCase().includes(termo));
        
        let setorMatch = true;
        if (filtroSetor) {
            if (modoSetor === 'ORIGEM') {
                setorMatch = m.origemSetor === filtroSetor;
            } else {
                setorMatch = m.destinoSetor === filtroSetor;
            }
        }

        return noArmazem && (porCod || porNf) && setorMatch;
    });

    const totalRegistros = filtrados.length;
    const totalPaginas = Math.ceil(totalRegistros / ITENS_POR_PAGINA) || 1;

    if (paginaAtualArmazem > totalPaginas) paginaAtualArmazem = totalPaginas;
    if (paginaAtualArmazem < 1) paginaAtualArmazem = 1;

    const inicio = (paginaAtualArmazem - 1) * ITENS_POR_PAGINA;
    const fim = Math.min(inicio + ITENS_POR_PAGINA, totalRegistros);
    const itensPagina = filtrados.slice(inicio, fim);

    if (totalRegistros === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">Nenhum relatório arquivado no Histórico.</div>`;
        atualizarBarraPaginacaoArmazem(0, 0, 0, 1);
        return;
    }

    container.innerHTML = itensPagina.map(m => {
        const isExt = m.tipoOrigem === 'externa';
        const corBordaLateral = isExt ? '#EAB308' : '#10B981';

        return `
            <div class="card-malote-item" style="border-left: 5px solid ${corBordaLateral};">
                <div class="card-malote-header">
                    <div>
                        ${!isExt ? `<strong>MALOTE: ${m.codigo}</strong> | ` : ''}Finalizado em: ${m.dataFinalizacaoArmazem || m.dataEnvio} 
                        ${!isExt ? `<span class="tag-verba ${m.tipoVerba === 'RESTRIÇÃO' ? 'tag-restricao' : 'tag-proprio'}">${m.tipoVerba}</span>` : ''}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="badge-status-malote st-armazém">Conferido</span>
                        <button type="button" class="btn-card-action btn-card-delete" onclick="excluirMalotePendente(${m.id})" title="Excluir Registro do Histórico">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div style="font-size: 0.85rem; margin-bottom: 8px;">
                    <strong>Unidade:</strong> ${m.unidade || 'ANTENOR DUARTE VILELA'} | <strong>Setor Origem:</strong> ${m.origemSetor || 'CENTRAL DE NOTAS'} | <strong>Setor Destino:</strong> ${m.destinoSetor} | <strong>${isExt ? 'Conferente' : 'Responsável'}:</strong> ${m.responsavel || '-'} ${!isExt ? `| <strong>Estoque:</strong> ${m.localEstoque || '-'}` : ''} | <strong>Qtd. NFs:</strong> ${m.itens.length}
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 8px;">
                    <button type="button" class="btn-primary-action" style="background-color: var(--primary-med);" onclick="visualizarRelatorioCompletoArmazem(${m.id})">
                        <i class="fa-solid fa-eye"></i> Ver Relatório Completo
                    </button>
                </div>
            </div>
        `;
    }).join('');

    atualizarBarraPaginacaoArmazem(inicio + 1, fim, totalRegistros, totalPaginas);
}

function atualizarBarraPaginacaoArmazem(de, ate, total, totalPaginas) {
    const infoText = document.getElementById('paginationInfoText');
    const pageIndicator = document.getElementById('paginationPageIndicator');
    const btnPrev = document.getElementById('btnPagePrev');
    const btnNext = document.getElementById('btnPageNext');

    if (infoText) infoText.innerText = `Mostrando ${total === 0 ? 0 : de}–${ate} de ${total} registros`;
    if (pageIndicator) pageIndicator.innerText = `${paginaAtualArmazem}/${totalPaginas}`;

    if (btnPrev) btnPrev.disabled = (paginaAtualArmazem <= 1);
    if (btnNext) btnNext.disabled = (paginaAtualArmazem >= totalPaginas);
}

function mudarPaginaArmazem(delta) {
    paginaAtualArmazem += delta;
    renderizarArmazem();
}

/* RELATÓRIO CONSOLIDADO */
function visualizarRelatorioCompletoArmazem(idMalote) {
    const malote = malotesList.find(m => m.id === idMalote);
    if (!malote) return;

    const isExt = malote.tipoOrigem === 'externa';

    const win = window.open('', '_blank');
    win.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>RELATORIO DE CONFERENCIA DE NOTAS FISCAIS</title>
            <style>
                @page { size: auto; margin: 0; }
                body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; padding: 40px; color: #1E293B; line-height: 1.5; background: #FFF; }
                .header { text-align: center; border-bottom: 2px solid #035AA6; padding-bottom: 12px; margin-bottom: 20px; }
                .header h2 { color: #035AA6; margin: 0; font-size: 1.4rem; font-weight: 800; }
                .header h3 { color: #475569; margin: 5px 0 0 0; font-size: 1.05rem; font-weight: 800; }
                .meta-box { background: #F1F5F9; border: 1px solid #CBD5E1; padding: 12px 16px; border-radius: 8px; font-size: 0.9rem; margin-bottom: 24px; }
                .meta-box div { margin-bottom: 4px; }
                .section-title { font-size: 0.95rem; color: #035AA6; border-bottom: 1.5px solid #E2E8F0; padding-bottom: 4px; margin: 20px 0 10px 0; font-weight: 800; text-transform: uppercase; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { border: 1px solid #CBD5E1; padding: 9px 12px; font-size: 0.85rem; text-align: left; }
                th { background: #E2E8F0; color: #035AA6; font-weight: 800; text-transform: uppercase; }
                .tag-sim { background: #D1FAE5; color: #065F46; font-weight: bold; padding: 2px 8px; border-radius: 4px; }
                .tag-nao { background: #FEE2E2; color: #991B1B; font-weight: bold; padding: 2px 8px; border-radius: 4px; }
                .obs-box { background: #FAFAFA; border: 1px solid #E2E8F0; padding: 12px; border-radius: 8px; font-size: 0.88rem; margin-top: 10px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>CENTRAL DE NOTAS</h2>
                <h3>RELATORIO DE CONFERENCIA DE NOTAS FISCAIS</h3>
            </div>

            <div class="meta-box">
                ${!isExt ? `<div><strong>CÓDIGO DO MALOTE:</strong> ${malote.codigo}</div>` : ''}
                <div><strong>UNIDADE:</strong> ${malote.unidade || 'ANTENOR DUARTE VILELA'}</div>
                <div><strong>SETOR ORIGEM:</strong> ${malote.origemSetor || 'CENTRAL DE NOTAS'} | <strong>SETOR DESTINO:</strong> ${malote.destinoSetor}</div>
                <div><strong>${isExt ? 'CONFERENTE' : 'RESPONSÁVEL'}:</strong> ${malote.responsavel || '-'} ${!isExt ? `| <strong>LOCAL ESTOQUE:</strong> ${malote.localEstoque || '-'}` : ''}</div>
                ${!isExt ? `<div><strong>TIPO DE VERBA:</strong> ${malote.tipoVerba}</div>` : ''}
                <div><strong>CONFERENCIA FINALIZADA EM:</strong> ${malote.dataFinalizacaoArmazem || '-'}</div>
            </div>

            ${!isExt ? `
            <div class="section-title">ETAPA 1 - DEVOLUTIVA DOS ESPELHOS</div>
            <table>
                <thead>
                    <tr>
                        <th>Nº NF</th>
                        <th>FORNECEDOR</th>
                        <th style="text-align:center;">VIA CARIMBADA?</th>
                        <th style="text-align:center;">DEVOLVIDA?</th>
                    </tr>
                </thead>
                <tbody>
                    ${malote.itens.map(i => `
                        <tr>
                            <td><strong>${i.numeroNf}</strong></td>
                            <td>${i.fornecedor}</td>
                            <td style="text-align:center;"><span class="${i.viaCarimbadaVoltou === 'SIM' ? 'tag-sim' : 'tag-nao'}">${i.viaCarimbadaVoltou || 'NÃO'}</span></td>
                            <td style="text-align:center;"><span class="${i.devolvida === 'SIM' ? 'tag-sim' : 'tag-nao'}">${i.devolvida || 'NÃO'}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : ''}

            <div class="section-title">CONFERENCIA DE EXTORNO DE NOTAS FISCAIS</div>
            <table>
                <thead>
                    <tr>
                        <th>Nº NF</th>
                        <th>FORNECEDOR</th>
                        <th style="text-align:center;">NOTA ESTORNADA?</th>
                        <th style="text-align:center;">STATUS NOTA FISCAL</th>
                    </tr>
                </thead>
                <tbody>
                    ${malote.itens.map(i => {
                        const isEst = i.estornada === 'SIM';
                        let stTxt = '-';
                        if (isEst) stTxt = '<span class="tag-sim">Nota Recebida</span>';
                        else if (isExt) stTxt = '<span class="tag-nao">Nota Não Recebida</span>';

                        return `
                            <tr>
                                <td><strong>${i.numeroNf}</strong></td>
                                <td>${i.fornecedor}</td>
                                <td style="text-align:center;"><span class="${isEst ? 'tag-sim' : 'tag-nao'}">${i.estornada || 'NÃO'}</span></td>
                                <td style="text-align:center;">${stTxt}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>

            <div class="section-title">OBSERVAÇÕES REGISTRADAS</div>
            <div class="obs-box">
                ${malote.obsRetorno || 'Nenhuma observação registrada durante a conferência.'}
            </div>
        </body>
        </html>
    `);
    win.document.close();
}

function salvarESincronizar() {
    localStorage.setItem('opm_malotes_list', JSON.stringify(malotesList));
    localStorage.setItem('opm_fornecedores_map', JSON.stringify(fornecedoresMap));
    localStorage.setItem('opm_responsaveis_list', JSON.stringify(responsaveisList));
    localStorage.setItem('opm_estoques_list', JSON.stringify(estoquesList));
    localStorage.setItem('opm_next_reset_ts', nextResetTimestamp);
    if (typeof window.syncMalotesFirebase === 'function') window.syncMalotesFirebase();
}

function filtrarMalotesAbertos() {
    renderizarDevolutivas();
}

function mostrarNotificacaoToast(msg) {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;
    document.getElementById('toast-msg').innerText = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
}