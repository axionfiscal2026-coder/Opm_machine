// ============================================================================
// SISTEMA OPERACIONAL OPM — GERENCIAMENTO DE FLUXO E HUB CENTRAL DE NOTAS
// ============================================================================

// ===============================
// ESTADO DA APLICAÇÃO
// ===============================
let abaPrincipalAtiva = 'hub'; 
let estruturaAtiva = 'antenor'; 
let estruturaCriacaoAtiva = 'antenor';

let tipoListaSendoCriada = null; 
let idListaSendoEditada = null;

let ultimoHashGeral = '';

// ESTADOS DE PAGINAÇÃO
let paginaHubAtual = 1;
let paginaSelecaoCriacaoAtual = 1;
const ITENS_POR_PAGINA = 10;

// ===============================
// CHAVES DE ARMAZENAMENTO LOCAL
// ===============================
const STORAGE_KEYS = {
    ENTRADA: 'opm_notas_entrada',
    ENTRADA_ALT: 'pendingNFs',
    TRATATIVAS: 'opm_tratativas_salvas',
    TRATATIVAS_ANTIGAS: 'opm_notas_tratativa',
    FINALIZADAS: 'opm_notas_finalizadas_local',
    FINALIZADAS_GERAIS: 'opm_notas_finalizadas',
    FINALIZADAS_ALT: 'finishedNFs',
    HUB_NOTAS: 'opm_hub_notas', 
    LISTAS_URGENCIA: 'opm_listas_urgencia',
    USUARIOS_RESPONSAVEIS: 'opm_usuarios_responsaveis'
};

// ===============================
// INICIALIZAÇÃO E TEMPO REAL
// ===============================
document.addEventListener('DOMContentLoaded', () => {
    carregarEInicializarDados();
    verificarEResetarListasDiarias();
    renderizarInterfaceGlobal();
    carregarEPreencherUsuariosSelect();

    window.addEventListener('storage', () => {
        atualizarInterfaceTempoReal();
    });

    setInterval(() => {
        const hashAtual = calcularHashEstadoGeral();
        if (hashAtual !== ultimoHashGeral) {
            ultimoHashGeral = hashAtual;
            atualizarInterfaceTempoReal();
        }
    }, 300);

    setInterval(() => {
        verificarEResetarListasDiarias();
    }, 1000);
});

window.atualizarInterfaceTempoReal = function() {
    populandoFiltroUnidadesFiliais();
    if (abaPrincipalAtiva === 'hub') {
        renderizarTabelaHub();
    } else if (abaPrincipalAtiva === 'criar-formulario' && tipoListaSendoCriada) {
        renderizarTabelaSelecaoNotasCriacao();
    } else if (abaPrincipalAtiva === 'listas-urgencia') {
        renderizarGridListasUrgencia();
    }
};

function calcularHashEstadoGeral() {
    const e1 = localStorage.getItem(STORAGE_KEYS.ENTRADA) || '';
    const e2 = localStorage.getItem(STORAGE_KEYS.ENTRADA_ALT) || '';
    const t1 = localStorage.getItem(STORAGE_KEYS.TRATATIVAS) || '';
    const t2 = localStorage.getItem(STORAGE_KEYS.TRATATIVAS_ANTIGAS) || '';
    const f1 = localStorage.getItem(STORAGE_KEYS.FINALIZADAS) || '';
    const f2 = localStorage.getItem(STORAGE_KEYS.FINALIZADAS_ALT) || '';
    const hb = localStorage.getItem(STORAGE_KEYS.HUB_NOTAS) || '';
    const u = localStorage.getItem(STORAGE_KEYS.LISTAS_URGENCIA) || '';
    return `${e1.length}_${e2.length}_${t1.length}_${t2.length}_${f1.length}_${f2.length}_${hb.length}_${u.length}`;
}

function toggleFiltrosHub() {
    const boxFiltros = document.getElementById('filterPanelBoxHub');
    const icon = document.getElementById('iconToggleFiltersHub');
    
    if (!boxFiltros || !icon) return;

    if (boxFiltros.classList.contains('collapsed')) {
        boxFiltros.classList.remove('collapsed');
        icon.className = 'fa-solid fa-chevron-down';
    } else {
        boxFiltros.classList.add('collapsed');
        icon.className = 'fa-solid fa-chevron-right';
    }
}

// ===============================
// MANUTENÇÃO E EXPIRAÇÃO DE LISTAS
// ===============================
function obterDataHojeFormatada() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

async function verificarEResetarListasDiarias() {
    let listasUrg = JSON.parse(localStorage.getItem(STORAGE_KEYS.LISTAS_URGENCIA)) || [];
    let listasUrgManter = [];
    const agoraMs = Date.now();
    let alterouLocal = false;

    for (let urg of listasUrg) {
        const concluida = await verificarSeListaEstaConcluida(urg);

        if (concluida) {
            if (!urg.concluidoEmMs) {
                urg.concluidoEmMs = agoraMs;
                alterouLocal = true;
            }

            const tempoDecorridoMs = agoraMs - urg.concluidoEmMs;
            const umaHoraMs = 60 * 60 * 1000;

            if (tempoDecorridoMs < umaHoraMs) {
                listasUrgManter.push(urg);
            } else {
                alterouLocal = true;
            }
        } else {
            urg.concluidoEmMs = null;
            listasUrgManter.push(urg);
        }
    }

    if (listasUrg.length !== listasUrgManter.length || alterouLocal) {
        localStorage.setItem(STORAGE_KEYS.LISTAS_URGENCIA, JSON.stringify(listasUrgManter));
        sincronizarGeralComFirebase();
    }

    if (abaPrincipalAtiva === 'listas-urgencia') renderizarGridListasUrgencia();
}

// ===============================
// NORMALIZAÇÃO E MATCH
// ===============================
function extrairApenasNumeros(valor) {
    if (valor === undefined || valor === null) return '';
    return String(valor).replace(/\D/g, '').trim();
}

function normalizarNomeEmpresa(nome) {
    if (!nome) return '';
    return String(nome)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "")
        .trim();
}

function saoMesmaNota(numA, empA, numB, empB) {
    const nA = extrairApenasNumeros(numA);
    const nB = extrairApenasNumeros(numB);

    if (!nA || !nB || nA !== nB) return false;

    const eA = normalizarNomeEmpresa(empA);
    const eB = normalizarNomeEmpresa(empB);

    if (!eA || !eB) return true;

    return eA === eB || eA.includes(eB) || eB.includes(eA);
}

// ===============================
// STATUS DE FLUXO
// ===============================
function determinarStatusNotaFluxo(numeroNf, empresa, pendingNFs, tratativasNFs, finishedNFs, origemItem = '') {
    const numBuscado = extrairApenasNumeros(numeroNf);

    const notaFinalizada = finishedNFs.find(f => saoMesmaNota(numBuscado, empresa, f.numeroNf || f.nf || f.numero, f.empresa || f.fornecedor));

    if (notaFinalizada) {
        return {
            rowClass: 'tr-row-verde',
            badgeClass: 'verde',
            entradaLabel: 'FINALIZADO',
            andamentoLabel: 'Entrada Concluída',
            statusLabel: 'ENTRADA CONCLUÍDA',
            statusIcon: '<i class="fa-solid fa-circle-check"></i>',
            concluido: true,
            estaNoEntradaNf: true
        };
    }

    const notaTratativa = tratativasNFs.find(t => saoMesmaNota(numBuscado, empresa, t.numeroNf || t.nf || t.numero, t.empresa || t.fornecedor));

    if (notaTratativa) {
        const subAba = String(notaTratativa.subAba || notaTratativa.tipoCalculo || notaTratativa.statusCalculo || notaTratativa.aba || notaTratativa.abaCalculada || '').toLowerCase();

        if (subAba.includes('nao') || subAba.includes('não') || notaTratativa.calculada === false) {
            return {
                rowClass: 'tr-row-laranja',
                badgeClass: 'laranja',
                entradaLabel: 'EM ANDAMENTO',
                andamentoLabel: 'Nota Não Calculada',
                statusLabel: 'AGUARDANDO VALIDAÇÃO',
                statusIcon: '<i class="fa-solid fa-clock"></i>',
                concluido: false,
                estaNoEntradaNf: true
            };
        }

        return {
            rowClass: 'tr-row-amarelo',
            badgeClass: 'amarelo',
            entradaLabel: 'FINALIZADO',
            andamentoLabel: 'Nota Calculada',
            statusLabel: 'ENTRADA CONCLUÍDA',
            statusIcon: '<i class="fa-solid fa-check"></i>',
            concluido: true,
            estaNoEntradaNf: true
        };
    }

    const notaEntrada = pendingNFs.find(p => saoMesmaNota(numBuscado, empresa, p.numeroNf || p.nf || p.numero, p.empresa || p.fornecedor));

    if (notaEntrada) {
        return {
            rowClass: '',
            badgeClass: 'cinza',
            entradaLabel: 'LOCALIZADO',
            andamentoLabel: 'Cadastrada na Entrada',
            statusLabel: 'AGUARDANDO ENTRADA',
            statusIcon: '',
            concluido: false,
            estaNoEntradaNf: true
        };
    }

    return {
        rowClass: 'tr-row-cinza',
        badgeClass: 'cinza',
        entradaLabel: 'ENTRADA MANUAL',
        andamentoLabel: 'NÃO LOCALIZADO',
        statusLabel: 'INDISPONÍVEL (FORA DO SISTEMA)',
        statusIcon: '<i class="fa-solid fa-ban"></i>',
        concluido: false,
        estaNoEntradaNf: false
    };
}

// ===============================
// DADOS
// ===============================
function carregarEInicializarDados() {
    let entradas = JSON.parse(localStorage.getItem(STORAGE_KEYS.ENTRADA));
    let tratativas = JSON.parse(localStorage.getItem(STORAGE_KEYS.TRATATIVAS));
    let finalizadas = JSON.parse(localStorage.getItem(STORAGE_KEYS.FINALIZADAS));

    if (!entradas || entradas.length === 0) {
        entradas = gerarDadosFicticiosEntrada();
        localStorage.setItem(STORAGE_KEYS.ENTRADA, JSON.stringify(entradas));
    }

    if (!tratativas || tratativas.length === 0) {
        tratativas = gerarDadosFicticiosTratativas();
        localStorage.setItem(STORAGE_KEYS.TRATATIVAS, JSON.stringify(tratativas));
    }

    if (!finalizadas || finalizadas.length === 0) {
        finalizadas = gerarDadosFicticiosFinalizadas();
        localStorage.setItem(STORAGE_KEYS.FINALIZADAS, JSON.stringify(finalizadas));
    }

    let listasUrg = JSON.parse(localStorage.getItem(STORAGE_KEYS.LISTAS_URGENCIA));
    if (!listasUrg) {
        listasUrg = gerarDadosFicticiosListasUrgencia();
        localStorage.setItem(STORAGE_KEYS.LISTAS_URGENCIA, JSON.stringify(listasUrg));
    }

    let usuarios = JSON.parse(localStorage.getItem(STORAGE_KEYS.USUARIOS_RESPONSAVEIS));
    if (!usuarios || usuarios.length === 0) {
        usuarios = ['BRUNO', 'GAB', 'CARLOS', 'JOAO'];
        localStorage.setItem(STORAGE_KEYS.USUARIOS_RESPONSAVEIS, JSON.stringify(usuarios));
    }

    sincronizarGeralComFirebase();
}

async function sincronizarGeralComFirebase() {
    const listasUrgencia = JSON.parse(localStorage.getItem(STORAGE_KEYS.LISTAS_URGENCIA)) || [];
    const pendingNFs = JSON.parse(localStorage.getItem(STORAGE_KEYS.ENTRADA)) || JSON.parse(localStorage.getItem(STORAGE_KEYS.ENTRADA_ALT)) || [];
    const finishedNFs = JSON.parse(localStorage.getItem(STORAGE_KEYS.FINALIZADAS)) || JSON.parse(localStorage.getItem(STORAGE_KEYS.FINALIZADAS_ALT)) || [];
    const hubNFs = JSON.parse(localStorage.getItem(STORAGE_KEYS.HUB_NOTAS)) || [];

    window.listasUrgencia = listasUrgencia;
    window.pendingNFs = pendingNFs;
    window.finishedNFs = finishedNFs;
    window.hubNFs = hubNFs;

    if (window.docRefAppFluxo) {
        try {
            const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js");
            await setDoc(window.docRefAppFluxo, {
                listasUrgencia: listasUrgencia,
                pendingNFs: pendingNFs,
                finishedNFs: finishedNFs,
                hubNFs: hubNFs,
                lastUpdated: Date.now()
            }, { merge: true });
        } catch (e) {
            console.warn("Sincronização remota via Firestore aguardando conexão:", e);
        }
    }

    window.dispatchEvent(new Event('storage'));
}

async function buscarTodasNotasDoSistema() {
    const e1 = JSON.parse(localStorage.getItem(STORAGE_KEYS.ENTRADA)) || [];
    const e2 = JSON.parse(localStorage.getItem(STORAGE_KEYS.ENTRADA_ALT)) || [];
    const eGerais = window.pendingNFs || [];
    
    const mapEntrada = new Map();
    [...e1, ...e2, ...eGerais].forEach(n => {
        const num = extrairApenasNumeros(n.numeroNf || n.nf || n.numero);
        if (num && !mapEntrada.has(num)) mapEntrada.set(num, n);
    });
    const pendingNFs = Array.from(mapEntrada.values());

    const t1 = JSON.parse(localStorage.getItem(STORAGE_KEYS.TRATATIVAS)) || [];
    const t2 = JSON.parse(localStorage.getItem(STORAGE_KEYS.TRATATIVAS_ANTIGAS)) || [];
    const tGerais = window.tratativasNFs || [];
    const tratativasNFs = [...t1, ...t2, ...tGerais];

    const f1 = JSON.parse(localStorage.getItem(STORAGE_KEYS.FINALIZADAS)) || [];
    const f2 = JSON.parse(localStorage.getItem(STORAGE_KEYS.FINALIZADAS_GERAIS)) || [];
    const f3 = JSON.parse(localStorage.getItem(STORAGE_KEYS.FINALIZADAS_ALT)) || [];
    const fGerais = window.finishedNFs || [];
    const finishedNFs = [...f1, ...f2, ...f3, ...fGerais];

    const h1 = JSON.parse(localStorage.getItem(STORAGE_KEYS.HUB_NOTAS)) || [];
    const hGerais = window.hubNFs || [];
    const mapHub = new Map();
    [...h1, ...hGerais].forEach(n => {
        const num = extrairApenasNumeros(n.numeroNf || n.nf || n.numero);
        if (num && !mapHub.has(num)) mapHub.set(num, n);
    });
    const hubNFs = Array.from(mapHub.values());

    return { pendingNFs, tratativasNFs, finishedNFs, hubNFs };
}

async function populandoFiltroUnidadesFiliais() {
    const selectUnidade = document.getElementById('filterUnidade');
    if (!selectUnidade) return;

    const valorSelecionado = selectUnidade.value;
    const { pendingNFs } = await buscarTodasNotasDoSistema();

    const unidadesSet = new Set();
    pendingNFs.forEach(n => {
        const cat = (n.categoria || n.estrutura || '').toLowerCase();
        if (cat.includes('filiai') || cat.includes('filial')) {
            const un = (n.unidade || '').trim().toUpperCase();
            if (un && un !== 'ANTENOR DUARTE VILELA') {
                unidadesSet.add(un);
            }
        }
    });

    selectUnidade.innerHTML = '<option value="">Todas as Unidades</option>';
    Array.from(unidadesSet).sort().forEach(un => {
        const opt = document.createElement('option');
        opt.value = un;
        opt.innerText = un;
        selectUnidade.appendChild(opt);
    });

    selectUnidade.value = valorSelecionado;
}

// ===============================
// USUÁRIOS
// ===============================
function carregarEPreencherUsuariosSelect() {
    const select = document.getElementById('selectCriadoPor');
    const containerModal = document.getElementById('containerUsuariosCadastrados');
    const usuarios = JSON.parse(localStorage.getItem(STORAGE_KEYS.USUARIOS_RESPONSAVEIS)) || ['BRUNO', 'GAB', 'CARLOS', 'JOAO'];

    const optionsHtml = `<option value="">Selecione um usuário...</option>` + 
        usuarios.map(u => `<option value="${u}">${u}</option>`).join('');

    if (select) {
        const valAtual = select.value;
        select.innerHTML = optionsHtml;
        select.value = valAtual;
    }

    if (containerModal) {
        containerModal.innerHTML = '';
        if (usuarios.length === 0) {
            containerModal.innerHTML = `<div style="padding: 12px; text-align: center; color: var(--text-muted);">Nenhum usuário cadastrado.</div>`;
            return;
        }

        usuarios.forEach((usr, index) => {
            const div = document.createElement('div');
            div.className = 'user-item-row';
            div.innerHTML = `
                <span>${usr}</span>
                <button type="button" class="btn-delete-user" onclick="removerUsuarioLista(${index})" title="Excluir Usuário"><i class="fa-solid fa-trash"></i></button>
            `;
            containerModal.appendChild(div);
        });
    }
}

function adicionarNovoUsuarioLista() {
    const input = document.getElementById('inputNovoUsuarioNome');
    if (!input) return;

    const nome = input.value.trim().toUpperCase();
    if (!nome) {
        alert("Digite o nome do usuário.");
        return;
    }

    let usuarios = JSON.parse(localStorage.getItem(STORAGE_KEYS.USUARIOS_RESPONSAVEIS)) || [];
    if (usuarios.includes(nome)) {
        alert("Este usuário já está cadastrado.");
        return;
    }

    usuarios.push(nome);
    localStorage.setItem(STORAGE_KEYS.USUARIOS_RESPONSAVEIS, JSON.stringify(usuarios));
    input.value = '';

    carregarEPreencherUsuariosSelect();
    sincronizarGeralComFirebase();
    mostrarToast(`Usuário "${nome}" adicionado com sucesso!`);
}

function removerUsuarioLista(index) {
    let usuarios = JSON.parse(localStorage.getItem(STORAGE_KEYS.USUARIOS_RESPONSAVEIS)) || [];
    if (confirm(`Deseja remover o usuário "${usuarios[index]}"?`)) {
        usuarios.splice(index, 1);
        localStorage.setItem(STORAGE_KEYS.USUARIOS_RESPONSAVEIS, JSON.stringify(usuarios));
        carregarEPreencherUsuariosSelect();
        sincronizarGeralComFirebase();
        mostrarToast("Usuário removido.");
    }
}

// ===============================
// NAVEGAÇÃO
// ===============================
function trocarAbaPrincipal(novaAba) {
    abaPrincipalAtiva = novaAba;

    document.querySelectorAll('.main-tabs .tab-button').forEach(btn => btn.classList.remove('active'));
    
    const btnAba = document.getElementById(`tab-btn-${novaAba}`);
    if (btnAba) btnAba.classList.add('active');

    document.querySelectorAll('.tab-section-content').forEach(sec => sec.style.display = 'none');
    
    const secTarget = document.getElementById(`section-${novaAba}`);
    if (secTarget) secTarget.style.display = 'block';

    renderizarInterfaceGlobal();
}

function trocarAbaEstrutura(novaEstrutura) {
    estruturaAtiva = novaEstrutura;
    paginaHubAtual = 1;

    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
        if (btn.id.includes(novaEstrutura)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const nomeEstruturaFormatado = novaEstrutura === 'antenor' ? 'ANTENOR DUARTE VILELA' : 'FILIAIS';

    const boxUnidade = document.getElementById('filterUnidadeBox');
    if (boxUnidade) {
        boxUnidade.style.display = novaEstrutura === 'filiais' ? 'flex' : 'none';
        if (novaEstrutura !== 'filiais') {
            document.getElementById('filterUnidade').value = '';
        }
    }
    
    const elHub = document.getElementById('lblEstruturaHubTabela');
    if (elHub) elHub.innerText = nomeEstruturaFormatado;

    const elUrg = document.getElementById('lblEstruturaListasUrg');
    if (elUrg) elUrg.innerText = nomeEstruturaFormatado;

    renderizarInterfaceGlobal();
}

function trocarEstruturaCriacao(novaEstrutura) {
    estruturaCriacaoAtiva = novaEstrutura;
    paginaSelecaoCriacaoAtual = 1;

    document.querySelectorAll('#subTabsCriacaoWrapper .sub-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`subtab-criar-${novaEstrutura}`).classList.add('active');

    const nomeEstruturaFormatado = novaEstrutura === 'antenor' ? 'ANTENOR DUARTE VILELA' : 'FILIAIS';
    const elDisp = document.getElementById('lblEstruturaNotasDisponiveis');
    if (elDisp) elDisp.innerText = nomeEstruturaFormatado;

    const inputBuscaSel = document.getElementById('inputBuscaSelecaoNotas');
    if (inputBuscaSel) inputBuscaSel.value = '';

    renderizarTabelaSelecaoNotasCriacao();
}

function renderizarInterfaceGlobal() {
    populandoFiltroUnidadesFiliais();
    if (abaPrincipalAtiva === 'hub') {
        renderizarTabelaHub();
    } else if (abaPrincipalAtiva === 'criar-formulario' && tipoListaSendoCriada) {
        renderizarTabelaSelecaoNotasCriacao();
    } else if (abaPrincipalAtiva === 'listas-urgencia') {
        renderizarGridListasUrgencia();
    }
}

// ===============================
// BUSCA GLOBAL COM MENSAGEM CORRIGIDA
// ===============================
function tratarInputBuscaGlobal(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        executarBuscaGlobal();
    }
}

async function executarBuscaGlobal() {
    const input = document.getElementById('globalSearchInput');
    if (!input) return;

    let termoDigitado = input.value.trim();
    let termo = extrairApenasNumeros(termoDigitado) || termoDigitado.toLowerCase();
    if (!termo) {
        alert("Digite o número da NF ou o nome da empresa para pesquisar.");
        return;
    }

    const { tratativasNFs, finishedNFs, hubNFs } = await buscarTodasNotasDoSistema();

    const corresponde = (item) => {
        const numNfStr = extrairApenasNumeros(item.numeroNf || item.nf || item.numero);
        const empresaStr = normalizarNomeEmpresa(item.empresa || item.fornecedor);
        return (numNfStr && numNfStr.includes(termo)) || (empresaStr && empresaStr.includes(termo));
    };

    let notaHub = hubNFs.find(corresponde);
    if (notaHub) {
        exibirModalDetalhesNotaGlobal(notaHub, 'HUB_ENTRADAS');
        input.value = '';
        return;
    }

    let notaTratativa = tratativasNFs.find(corresponde);
    if (notaTratativa) {
        exibirModalDetalhesNotaGlobal(notaTratativa, 'TRATATIVAS');
        input.value = '';
        return;
    }

    let notaFinalizada = finishedNFs.find(corresponde);
    if (notaFinalizada) {
        exibirModalDetalhesNotaGlobal(notaFinalizada, 'NFFINALIZADAS');
        input.value = '';
        return;
    }

    alert(`Nota Fiscal N° "${termoDigitado}", Não foi localizada nenhum registro ou movimentação dessa nota dentro do banco de dados`);
}

function exibirModalDetalhesNotaGlobal(nota, localSistema) {
    const body = document.getElementById('modalDetalhesNfBody');
    if (!body) return;

    let detalhesHtml = '';

    if (localSistema === 'HUB_ENTRADAS') {
        const abaStr = (nota.categoria || 'conferencia').toUpperCase();
        const subLocalStr = (nota.subLocal || 'geral').toUpperCase();

        detalhesHtml = `
            <div class="modal-info-row"><strong>Localização no Hub:</strong> <span class="badge-capsula azul"><i class="fa-solid fa-boxes-packing"></i> ${abaStr} (${subLocalStr})</span></div>
            <div class="modal-info-row"><strong>Data de Entrada:</strong> ${nota.dataHora || '-'}</div>
        `;
    } else if (localSistema === 'TRATATIVAS') {
        const subAba = String(nota.subAba || nota.tipoCalculo || nota.statusCalculo || nota.aba || nota.abaCalculada || '').toLowerCase();
        const eCalculada = !(subAba.includes('nao') || subAba.includes('não') || nota.calculada === false);

        const statusCalculoBadge = eCalculada 
            ? `<span class="badge-capsula amarelo"><i class="fa-solid fa-check"></i> NOTA CALCULADA</span>`
            : `<span class="badge-capsula laranja"><i class="fa-solid fa-clock"></i> NOTA NÃO CALCULADA</span>`;

        detalhesHtml = `
            <div class="modal-info-row"><strong>Status de Cálculo:</strong> ${statusCalculoBadge}</div>
            <div class="modal-info-row"><strong>Motivo da Pendência:</strong> ${nota.motivoPendencia || '-'}</div>
            <div class="modal-info-row"><strong>Vencimento do Boleto:</strong> ${nota.vencimentoBoleto || '-'}</div>
            <div class="modal-info-row"><strong>Usuário Responsável:</strong> ${(nota.usuarioResponsavel || '-').toUpperCase()}</div>
            <div class="modal-info-row"><strong>Data de Entrada em Tratativa:</strong> ${nota.dataHoraCriacao || nota.dataHora || '-'}</div>
        `;
    } else if (localSistema === 'NFFINALIZADAS') {
        detalhesHtml = `
            <div class="modal-info-row"><strong>Status Final:</strong> <span class="badge-capsula verde"><i class="fa-solid fa-circle-check"></i> NOTA FINALIZADA</span></div>
            <div class="modal-info-row"><strong>Data/Hora Conclusão:</strong> ${nota.dataHora || '-'}</div>
            <div class="modal-info-row"><strong>Finalizado Por:</strong> ${(nota.finalizadoPor || 'SISTEMA').toUpperCase()}</div>
        `;
    }

    body.innerHTML = `
        <div class="modal-info-row"><strong>Nº Nota Fiscal:</strong> ${nota.numeroNf || nota.nf}</div>
        <div class="modal-info-row"><strong>Empresa / Fornecedor:</strong> ${nota.empresa || nota.fornecedor}</div>
        <div class="modal-info-row"><strong>Unidade:</strong> ${nota.unidade || '-'}</div>
        ${detalhesHtml}
    `;

    abrirModal('modalDetalhesNf');
}

// ===============================
// TABELA DO HUB
// ===============================
function limparFiltrosHub() {
    document.getElementById('filterText').value = '';
    document.getElementById('filterPrioridade').value = '';
    document.getElementById('filterOrdenacao').value = 'data_desc';
    const selectUnidade = document.getElementById('filterUnidade');
    if (selectUnidade) selectUnidade.value = '';
    paginaHubAtual = 1;
    renderizarTabelaHub();
}

function filtrarTabelaHub() {
    paginaHubAtual = 1;
    renderizarTabelaHub();
}

async function renderizarTabelaHub() {
    const tbody = document.getElementById('tabelaEntradaHubBody');
    if (!tbody) return;

    const { pendingNFs, tratativasNFs, finishedNFs } = await buscarTodasNotasDoSistema();

    let lista = pendingNFs.filter(n => {
        const pertence = (n.categoria || n.estrutura || n.unidade || 'antenor').toLowerCase().includes(estruturaAtiva);
        if (!pertence) return false;

        const num = extrairApenasNumeros(n.numeroNf || n.nf || n.numero);
        const emp = n.empresa || n.fornecedor;

        const jaTratativa = tratativasNFs.some(t => saoMesmaNota(num, emp, t.numeroNf || t.nf || t.numero, t.empresa || t.fornecedor));
        const jaFinalizada = finishedNFs.some(f => saoMesmaNota(num, emp, f.numeroNf || f.nf || f.numero, f.empresa || f.fornecedor));

        return !jaTratativa && !jaFinalizada;
    });

    const termo = (document.getElementById('filterText')?.value || '').toLowerCase();
    const prioridadeFiltro = document.getElementById('filterPrioridade')?.value || '';
    const unidadeFiltro = document.getElementById('filterUnidade')?.value || '';

    if (termo) {
        lista = lista.filter(n => String(n.numeroNf || n.nf).toLowerCase().includes(termo) || (n.empresa || n.fornecedor || '').toLowerCase().includes(termo));
    }

    if (unidadeFiltro && estruturaAtiva === 'filiais') {
        lista = lista.filter(n => (n.unidade || '').trim().toUpperCase() === unidadeFiltro.toUpperCase());
    }

    if (prioridadeFiltro) {
        lista = lista.filter(n => {
            const prio = n.prioridade || (n.urgente === 'Sim' ? 'URGENTE' : 'NORMAL');
            return prio === prioridadeFiltro;
        });
    }

    const ord = document.getElementById('filterOrdenacao')?.value || 'data_desc';
    lista.sort((a, b) => {
        const empA = (a.empresa || a.fornecedor || '').toLowerCase();
        const empB = (b.empresa || b.fornecedor || '').toLowerCase();
        const numA = parseInt(extrairApenasNumeros(a.numeroNf || a.nf || a.numero)) || 0;
        const numB = parseInt(extrairApenasNumeros(b.numeroNf || b.nf || b.numero)) || 0;

        if (ord === 'num_crescente') {
            return numA - numB;
        } else if (ord === 'num_decrescente') {
            return numB - numA;
        } else if (ord === 'alfabetica') {
            return empA.localeCompare(empB);
        } else {
            // 'data_desc' (Recentes)
            return (b.id || 0) - (a.id || 0);
        }
    });

    const totalItens = lista.length;
    const totalPaginas = Math.ceil(totalItens / ITENS_POR_PAGINA) || 1;

    if (paginaHubAtual > totalPaginas) paginaHubAtual = totalPaginas;
    if (paginaHubAtual < 1) paginaHubAtual = 1;

    const inicio = (paginaHubAtual - 1) * ITENS_POR_PAGINA;
    const listaPaginada = lista.slice(inicio, inicio + ITENS_POR_PAGINA);

    tbody.innerHTML = '';
    if (listaPaginada.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">Nenhuma nota cadastrada aguardando entrada para esta estrutura.</td></tr>`;
        renderizarPaginador('paginacaoHubControls', paginaHubAtual, totalPaginas, totalItens, inicio, 0, (p) => { paginaHubAtual = p; renderizarTabelaHub(); });
        return;
    }

    listaPaginada.forEach(nota => {
        const prioridade = nota.prioridade || (nota.urgente === 'Sim' ? 'URGENTE' : 'NORMAL');
        const prioClass = prioridade.toLowerCase().replace(' ', '-');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${nota.numeroNf || nota.nf}</strong></td>
            <td>${nota.empresa || nota.fornecedor}</td>
            <td>${nota.unidade || '-'}</td>
            <td>${nota.dataHora || nota.dataCriacao || '-'}</td>
            <td><span class="badge-prioridade normal"><i class="fa-solid fa-boxes-packing"></i> AGUARDANDO ENTRADA</span></td>
            <td><span class="badge-prioridade ${prioClass}">${prioridade}</span></td>
        `;
        tbody.appendChild(tr);
    });

    renderizarPaginador('paginacaoHubControls', paginaHubAtual, totalPaginas, totalItens, inicio, listaPaginada.length, (p) => { paginaHubAtual = p; renderizarTabelaHub(); });
}

// ===============================
// CRIAÇÃO E SELEÇÃO DE NOTAS DE URGÊNCIA
// ===============================
function abrirFormularioCriacaoDirect(tipo) {
    tipoListaSendoCriada = tipo;
    idListaSendoEditada = null;
    paginaSelecaoCriacaoAtual = 1;

    abaPrincipalAtiva = 'criar-formulario';
    document.querySelectorAll('.main-tabs .tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-section-content').forEach(sec => sec.style.display = 'none');
    document.getElementById('section-formulario-criacao').style.display = 'block';

    document.getElementById('tipoListaAtual').value = tipo;
    document.getElementById('formCriacaoLista').reset();

    const inputNome = document.getElementById('nomeListaInput');
    inputNome.required = false;

    const selectCriadoPor = document.getElementById('selectCriadoPor');
    selectCriadoPor.required = true;

    carregarEPreencherUsuariosSelect();
    trocarEstruturaCriacao(estruturaAtiva);
}

async function renderizarTabelaSelecaoNotasCriacao() {
    const tbody = document.getElementById('tabelaSelecaoNotasBody');
    if (!tbody) return;

    const { pendingNFs, tratativasNFs, finishedNFs } = await buscarTodasNotasDoSistema();

    let notasDisponiveisEntrada = pendingNFs.filter(n => {
        const pertence = (n.categoria || n.estrutura || n.unidade || 'antenor').toLowerCase().includes(estruturaCriacaoAtiva);
        if (!pertence) return false;

        const num = extrairApenasNumeros(n.numeroNf || n.nf || n.numero);
        const emp = n.empresa || n.fornecedor;

        const jaTratativa = tratativasNFs.some(t => saoMesmaNota(num, emp, t.numeroNf || t.nf || t.numero, t.empresa || t.fornecedor));
        const jaFinalizada = finishedNFs.some(f => saoMesmaNota(num, emp, f.numeroNf || f.nf || f.numero, f.empresa || f.fornecedor));

        return !jaTratativa && !jaFinalizada;
    });

    const termoBuscaSelecao = (document.getElementById('inputBuscaSelecaoNotas')?.value || '').toLowerCase().trim();
    if (termoBuscaSelecao) {
        const termoNum = extrairApenasNumeros(termoBuscaSelecao);
        notasDisponiveisEntrada = notasDisponiveisEntrada.filter(n => {
            const numNfStr = extrairApenasNumeros(n.numeroNf || n.nf);
            const empresaStr = (n.empresa || n.fornecedor || '').toLowerCase();
            return (termoNum && numNfStr.includes(termoNum)) || empresaStr.includes(termoBuscaSelecao);
        });
    }

    const listasUrg = JSON.parse(localStorage.getItem(STORAGE_KEYS.LISTAS_URGENCIA)) || [];
    const notasListasAtivas = new Map();

    for (let lst of listasUrg) {
        const concluida = await verificarSeListaEstaConcluida(lst);
        if (!concluida) {
            const itens = lst.notas || lst.itens || [];
            itens.forEach(it => {
                const num = extrairApenasNumeros(it.numeroNf || it.nf || it.numero);
                if (num) {
                    notasListasAtivas.set(num, lst.nome || 'Outra Lista Ativa');
                }
            });
        }
    }

    const totalItens = notasDisponiveisEntrada.length;
    const totalPaginas = Math.ceil(totalItens / ITENS_POR_PAGINA) || 1;

    if (paginaSelecaoCriacaoAtual > totalPaginas) paginaSelecaoCriacaoAtual = totalPaginas;
    if (paginaSelecaoCriacaoAtual < 1) paginaSelecaoCriacaoAtual = 1;

    const inicio = (paginaSelecaoCriacaoAtual - 1) * ITENS_POR_PAGINA;
    const listaPaginada = notasDisponiveisEntrada.slice(inicio, inicio + ITENS_POR_PAGINA);

    tbody.innerHTML = '';
    if (listaPaginada.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 15px; color: var(--text-muted);">Nenhuma nota disponível para esta estrutura com os critérios informados.</td></tr>`;
        renderizarPaginador('paginacaoSelecaoControls', paginaSelecaoCriacaoAtual, totalPaginas, totalItens, inicio, 0, (p) => { paginaSelecaoCriacaoAtual = p; renderizarTabelaSelecaoNotasCriacao(); });
        return;
    }

    listaPaginada.forEach(nota => {
        const numNotaStr = extrairApenasNumeros(nota.numeroNf || nota.nf);
        const prioridade = nota.prioridade || (nota.urgente === 'Sim' ? 'URGENTE' : 'NORMAL');
        const prioClass = prioridade.toLowerCase().replace(' ', '-');
        
        const eUrgenteForm = prioridade === 'URGENTE';
        const nomeListaJaExistente = notasListasAtivas.get(numNotaStr);
        const estaEmListaAtiva = Boolean(nomeListaJaExistente);

        const indisponivel = eUrgenteForm || estaEmListaAtiva;

        let avisoMotivo = '';
        if (estaEmListaAtiva) {
            avisoMotivo = `<small style="color:#DC2626; display:block;">(Indisponível - Nota já em "${nomeListaJaExistente}")</small>`;
        } else if (eUrgenteForm) {
            avisoMotivo = `<small style="color:#DC2626; display:block;">(Indisponível - Nota Urgente)</small>`;
        }

        const tr = document.createElement('tr');
        if (indisponivel) tr.className = 'tr-disabled';

        tr.innerHTML = `
            <td class="text-center">
                <input type="checkbox" class="chk-nota-selecao" value="${nota.id || nota.numeroNf || nota.nf}" ${indisponivel ? 'disabled title="Nota indisponível para seleção"' : ''} onchange="atualizarContadorNotasSelecionadas()">
            </td>
            <td><strong>${nota.numeroNf || nota.nf}</strong> ${avisoMotivo}</td>
            <td>${nota.empresa || nota.fornecedor}</td>
            <td>${nota.unidade || '-'}</td>
            <td>${nota.dataHora || nota.dataCriacao || '-'}</td>
            <td><span class="badge-prioridade ${prioClass}">${prioridade}</span></td>
        `;
        tbody.appendChild(tr);
    });

    renderizarPaginador('paginacaoSelecaoControls', paginaSelecaoCriacaoAtual, totalPaginas, totalItens, inicio, listaPaginada.length, (p) => { paginaSelecaoCriacaoAtual = p; renderizarTabelaSelecaoNotasCriacao(); });

    atualizarContadorNotasSelecionadas();
}

function toggleMarcarTodasSelecao(chkMaster) {
    document.querySelectorAll('.chk-nota-selecao:not([disabled])').forEach(chk => chk.checked = chkMaster.checked);
    atualizarContadorNotasSelecionadas();
}

function atualizarContadorNotasSelecionadas() {
    const totalChecks = document.querySelectorAll('.chk-nota-selecao:checked').length;
    const badge = document.getElementById('lblCountNotasSelecionadas');
    if (badge) badge.innerText = `${totalChecks} nota(s) selecionada(s)`;
}

function limparTodosCamposESelecao() {
    document.getElementById('formCriacaoLista').reset();
    document.querySelectorAll('.chk-nota-selecao').forEach(chk => chk.checked = false);
    const chkMaster = document.getElementById('chkAllSelecaoLista');
    if (chkMaster) chkMaster.checked = false;

    atualizarContadorNotasSelecionadas();
    mostrarToast("Todos os campos e seleções foram limpos.");
}

function cancelarCriacaoLista() {
    tipoListaSendoCriada = null;
    idListaSendoEditada = null;
    trocarAbaPrincipal('listas-urgencia');
}

async function salvarNovaLista(e) {
    e.preventDefault();

    const { pendingNFs } = await buscarTodasNotasDoSistema();
    const checks = document.querySelectorAll('.chk-nota-selecao:checked');

    if (checks.length === 0) {
        alert("É OBRIGATÓRIO selecionar ao menos uma nota disponível na lista.");
        return;
    }

    let nome = document.getElementById('nomeListaInput').value.trim();
    const criadoPor = document.getElementById('selectCriadoPor')?.value;

    if (!criadoPor) {
        alert("Selecione quem SOLICITOU a lista.");
        return;
    }

    const agora = new Date();
    const dataHoraStr = `${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    const hojeStr = obterDataHojeFormatada();

    if (!nome) {
        nome = `Lista de Urgência - ${hojeStr}`;
    }

    let notasItemLista = [];
    checks.forEach(chk => {
        const val = chk.value;
        const notaEntrada = pendingNFs.find(n => String(n.id) === String(val) || String(n.numeroNf || n.nf) === String(val));
        if (notaEntrada) {
            notasItemLista.push({
                ...notaEntrada,
                numeroNf: notaEntrada.numeroNf || notaEntrada.nf,
                empresa: notaEntrada.empresa || notaEntrada.fornecedor,
                fornecedor: notaEntrada.empresa || notaEntrada.fornecedor,
                origem: 'ENTRADANF'
            });
        }
    });

    const novaListaObj = {
        id: idListaSendoEditada || Date.now(),
        nome: nome,
        tipo: 'URGENCIA',
        subtipo: 'URGÊNCIA',
        modoEntrada: 'ENTRADANF',
        estrutura: estruturaCriacaoAtiva,
        categoria: estruturaCriacaoAtiva,
        dataCriacao: dataHoraStr,
        dataSimples: hojeStr,
        usuarioCriacao: criadoPor,
        notas: notasItemLista,
        itens: notasItemLista,
        concluidoEmMs: null
    };

    let listasSalvas = JSON.parse(localStorage.getItem(STORAGE_KEYS.LISTAS_URGENCIA)) || [];
    listasSalvas.unshift(novaListaObj);
    localStorage.setItem(STORAGE_KEYS.LISTAS_URGENCIA, JSON.stringify(listasSalvas));

    await sincronizarGeralComFirebase();

    mostrarToast(`Lista "${nome}" salva com sucesso!`);
    trocarAbaPrincipal('listas-urgencia');
}

// ===============================
// PAGINAÇÃO GENÉRICA
// ===============================
function renderizarPaginador(containerId, pagAtual, totalPaginas, totalItens, inicio, contagemPagina, onPageChange) {
    let container = document.getElementById(containerId);
    if (!container) return;

    const fim = inicio + contagemPagina;
    const exibeInicio = totalItens === 0 ? 0 : inicio + 1;

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 4px; font-size: 0.85rem; color: var(--text-muted);">
            <div>Mostrando <strong>${exibeInicio}-${fim}</strong> de <strong>${totalItens}</strong> registros</div>
            <div style="display: flex; gap: 6px; align-items: center;">
                <button type="button" class="btn-page-nav" ${pagAtual <= 1 ? 'disabled' : ''} style="padding: 4px 10px; border-radius: 6px; border: 1px solid var(--card-border); background: #fff; cursor: pointer;">
                    <i class="fa-solid fa-chevron-left"></i> Anterior
                </button>
                <span style="font-weight: bold; margin: 0 6px;">${pagAtual} / ${totalPaginas}</span>
                <button type="button" class="btn-page-nav next" ${pagAtual >= totalPaginas ? 'disabled' : ''} style="padding: 4px 10px; border-radius: 6px; border: 1px solid var(--card-border); background: #fff; cursor: pointer;">
                    Próximo <i class="fa-solid fa-chevron-right"></i>
                </button>
            </div>
        </div>
    `;

    const btnPrev = container.querySelector('.btn-page-nav:not(.next)');
    const btnNext = container.querySelector('.btn-page-nav.next');

    if (btnPrev && pagAtual > 1) {
        btnPrev.onclick = () => onPageChange(pagAtual - 1);
    }
    if (btnNext && pagAtual < totalPaginas) {
        btnNext.onclick = () => onPageChange(pagAtual + 1);
    }
}

// ===============================
// ABA URGENCIA
// ===============================
async function verificarSeListaEstaConcluida(lista) {
    const itens = lista.notas || lista.itens || [];
    if (!itens || itens.length === 0) return false;

    const { pendingNFs, tratativasNFs, finishedNFs } = await buscarTodasNotasDoSistema();

    return itens.every(n => {
        const num = n.numeroNf || n.nf || n.numero || n;
        const emp = n.empresa || n.fornecedor || '';
        const st = determinarStatusNotaFluxo(num, emp, pendingNFs, tratativasNFs, finishedNFs, n.origem);
        return st.concluido;
    });
}

function listaContemNotaOuEmpresaOuNome(lista, termo) {
    if (!termo) return true;

    const termoLimpo = termo.toLowerCase().trim();
    const termoNum = extrairApenasNumeros(termo);

    const nomeListaStr = (lista.nome || '').toLowerCase();
    if (nomeListaStr.includes(termoLimpo)) return true;

    const itens = lista.notas || lista.itens || [];
    
    return itens.some(it => {
        const numNfStr = extrairApenasNumeros(it.numeroNf || it.nf || it.numero);
        const empStr = normalizarNomeEmpresa(it.empresa || it.fornecedor);

        const matchNum = termoNum && numNfStr && numNfStr.includes(termoNum);
        const matchEmp = empStr && empStr.includes(normalizarNomeEmpresa(termoLimpo));

        return matchNum || matchEmp;
    });
}

async function renderizarGridListasUrgencia() {
    const grid = document.getElementById('gridListasUrgencia');
    if (!grid) return;

    const listas = JSON.parse(localStorage.getItem(STORAGE_KEYS.LISTAS_URGENCIA)) || [];
    let filtradas = listas.filter(l => (l.estrutura || l.categoria || '').toLowerCase().includes(estruturaAtiva));

    const termoBusca = (document.getElementById('inputBuscaListasUrgencia')?.value || '').trim();
    if (termoBusca) {
        filtradas = filtradas.filter(l => listaContemNotaOuEmpresaOuNome(l, termoBusca));
    }

    grid.innerHTML = '';
    if (filtradas.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">Nenhuma lista de urgência localizada.</div>`;
        return;
    }

    const agoraMs = Date.now();

    for (let lista of filtradas) {
        const totalNormais = (lista.notas || lista.itens || []).length;
        const estaConcluida = await verificarSeListaEstaConcluida(lista);

        let htmlTimerUrgencia = '';
        if (estaConcluida && lista.concluidoEmMs) {
            const umaHoraMs = 60 * 60 * 1000;
            const msRestante = Math.max(0, umaHoraMs - (agoraMs - lista.concluidoEmMs));
            const minRestante = Math.floor(msRestante / 60000);
            const segRestante = Math.floor((msRestante % 60000) / 1000);
            const timerStr = `${String(minRestante).padStart(2, '0')}:${String(segRestante).padStart(2, '0')}`;
            htmlTimerUrgencia = `<span class="card-timer-badge urgent-timer" title="Tempo até exclusão automática"><i class="fa-solid fa-stopwatch"></i> ${timerStr}</span>`;
        }

        const card = document.createElement('div');
        card.className = `lista-created-card ${estaConcluida ? 'card-concluida' : ''}`;
        
        card.innerHTML = `
            <div>
                <div class="lista-card-header">
                    <div>
                        <div class="lista-card-title">${lista.nome} ${estaConcluida ? '<i class="fa-solid fa-circle-check" style="color: #10B981; margin-left: 4px;"></i>' : ''}</div>
                    </div>
                    <span class="badge-prioridade super-urgente">URGÊNCIA</span>
                </div>

                <div class="lista-card-metrics">
                    <div class="metric-item"><strong>${totalNormais}</strong><span>Normais</span></div>
                </div>
            </div>

            <div class="card-footer-info-row">
                <div class="card-footer-left-info">
                    <span>Criado por <strong>${lista.usuarioCriacao || 'ADMIN'}</strong> em ${lista.dataCriacao}</span>
                    ${htmlTimerUrgencia}
                </div>
                <div class="lista-card-actions">
                    <button type="button" class="btn-card-action" onclick="visualizarDetalhesLista('${lista.id}')" title="Visualizar"><i class="fa-solid fa-eye"></i></button>
                    <button type="button" class="btn-card-action delete" onclick="excluirLista('${lista.id}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    }
}

async function excluirLista(id) {
    if (confirm("Deseja realmente excluir esta lista? Esta ação não poderá ser desfeita.")) {
        let listas = JSON.parse(localStorage.getItem(STORAGE_KEYS.LISTAS_URGENCIA)) || [];
        listas = listas.filter(l => String(l.id) !== String(id));
        localStorage.setItem(STORAGE_KEYS.LISTAS_URGENCIA, JSON.stringify(listas));

        await sincronizarGeralComFirebase();

        mostrarToast("Lista excluída com sucesso.");
        atualizarInterfaceTempoReal();
    }
}

async function visualizarDetalhesLista(id) {
    const listas = JSON.parse(localStorage.getItem(STORAGE_KEYS.LISTAS_URGENCIA)) || [];
    const lista = listas.find(l => String(l.id) === String(id));

    if (!lista) return;

    document.getElementById('lblModalTituloLista').innerText = lista.nome;
    
    document.getElementById('lblModalHeaderInfoLista').innerHTML = `
        <strong>Estrutura:</strong> ${(lista.estrutura || lista.categoria) === 'antenor' ? 'ANTENOR DUARTE VILELA' : 'FILIAIS'} | 
        <strong>Solicitado Por:</strong> ${lista.usuarioCriacao || 'ADMIN'} | 
        <strong>Data:</strong> ${lista.dataCriacao}
    `;

    const thead = document.getElementById('tabelaVisualizacaoListaHeader');
    const tbody = document.getElementById('tabelaVisualizacaoListaBody');
    tbody.innerHTML = '';

    thead.innerHTML = `
        <tr>
            <th>Nº NF</th>
            <th>EMPRESA / FORNECEDOR</th>
            <th>UNIDADE</th>
            <th>ANDAMENTO</th>
            <th>STATUS</th>
        </tr>
    `;

    const { pendingNFs, tratativasNFs, finishedNFs } = await buscarTodasNotasDoSistema();
    const itens = lista.notas || lista.itens || [];

    itens.forEach((item) => {
        const num = item.numeroNf || item.nf || item.numero || item;
        const emp = item.empresa || item.fornecedor || '';
        const un = item.unidade || (estruturaAtiva === 'antenor' ? 'ANTENOR DUARTE VILELA' : 'FILIAL');

        const st = determinarStatusNotaFluxo(num, emp, pendingNFs, tratativasNFs, finishedNFs, item.origem);

        const tr = document.createElement('tr');
        if (st.rowClass) tr.className = st.rowClass;

        tr.innerHTML = `
            <td><strong>${num}</strong></td>
            <td>${emp || '-'}</td>
            <td>${un}</td>
            <td><strong>${st.andamentoLabel}</strong></td>
            <td><span class="badge-capsula ${st.badgeClass}">${st.statusIcon} ${st.statusLabel}</span></td>
        `;
        tbody.appendChild(tr);
    });

    abrirModal('modalVisualizarLista');
}

// ===============================
// MODAIS E AUXILIARES
// ===============================
function abrirModal(idModal) {
    document.getElementById(idModal).style.display = 'flex';
}

function fecharModal(idModal) {
    document.getElementById(idModal).style.display = 'none';
}

function voltarParaGestao() {
    window.location.href = '../lobbyv2/lobbyv2.html';
}

function mostrarToast(mensagem) {
    const toast = document.getElementById('toast-notification');
    const msgSpan = document.getElementById('toast-msg');
    if (toast && msgSpan) {
        msgSpan.innerText = mensagem;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3500);
    }
}

function gerarDadosFicticiosEntrada() {
    return [
        { id: 101, categoria: 'antenor', numeroNf: '10450', empresa: 'ONCOPRO DISTRIBUIDORA', unidade: 'ANTENOR DUARTE VILELA', urgente: 'Não', prioridade: 'NORMAL', dataHora: '06/09/2026 às 08:30' },
        { id: 102, categoria: 'antenor', numeroNf: '10451', empresa: 'MEDFARMA HOSPITALAR', unidade: 'ANTENOR DUARTE VILELA', urgente: 'Sim', prioridade: 'URGENTE', dataHora: '06/09/2026 às 09:15' },
        { id: 104, categoria: 'filiais', numeroNf: '20890', empresa: 'EXPRESS SUPRIMENTOS', unidade: 'JALES', urgente: 'Não', prioridade: 'NORMAL', dataHora: '06/09/2026 às 10:00' },
        { id: 105, categoria: 'filiais', numeroNf: '20891', empresa: 'GLOBO PHARMA', unidade: 'INFANTO JUVENIL', urgente: 'Sim', prioridade: 'URGENTE', dataHora: '06/09/2026 às 10:30' }
    ];
}

function gerarDadosFicticiosTratativas() {
    return [
        { id: 201, categoria: 'antenor', numeroNf: '10300', empresa: 'DIVERGENTE MED', unidade: 'ANTENOR DUARTE VILELA', motivoPendencia: 'VALIDADE CURTA', vencimentoBoleto: '10/09/2026', usuarioResponsavel: 'BRUNO', dataHoraCriacao: '05/09/2026 às 14:00', abaCalculada: 'NAO_CALCULADA' },
        { id: 202, categoria: 'filiais', numeroNf: '20700', empresa: 'MECANICA UNIAO', unidade: 'JALES', motivoPendencia: 'CARTA DE CORREÇÃO', vencimentoBoleto: '15/09/2026', usuarioResponsavel: 'GAB', dataHoraCriacao: '05/09/2026 às 16:20', abaCalculada: 'CALCULADA' }
    ];
}

function gerarDadosFicticiosFinalizadas() {
    return [
        { id: 301, categoria: 'antenor', numeroNf: '10100', empresa: 'CONCLUIDA PHARMA', unidade: 'ANTENOR DUARTE VILELA', finalizadoPor: 'BRUNO', dataHora: '06/09/2026 às 11:00' },
        { id: 302, categoria: 'filiais', numeroNf: '20100', empresa: 'LOGISTICA EXPRESS', unidade: 'JALES', finalizadoPor: 'JOAO', dataHora: '06/09/2026 às 11:30' }
    ];
}

function gerarDadosFicticiosListasUrgencia() {
    return [
        {
            id: 501,
            nome: 'Lista de Urgência - 07/09/2026',
            tipo: 'URGENCIA',
            subtipo: 'URGÊNCIA',
            estrutura: 'antenor',
            categoria: 'antenor',
            dataCriacao: '07/09/2026 às 08:00',
            dataSimples: obterDataHojeFormatada(),
            usuarioCriacao: 'ADMIN',
            concluidoEmMs: null,
            notas: [
                { id: 102, numeroNf: '10451', empresa: 'MEDFARMA HOSPITALAR', unidade: 'ANTENOR DUARTE VILELA', prioridade: 'URGENTE', origem: 'ENTRADANF' }
            ]
        }
    ];
}