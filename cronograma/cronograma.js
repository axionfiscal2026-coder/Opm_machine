// ============================================================================
// PAINEL DE CRONOGRAMA & PRIORIDADES — OPERATOR MACHINE
// ============================================================================

let abaEmpresaAtual = 'antenor';
let abaSecaoAtual = 'urgentes_entrada';
let ultimoHashEstado = '';

document.addEventListener('DOMContentLoaded', () => {
    window.atualizarPainelCronograma();
    
    window.addEventListener('storage', () => {
        window.atualizarPainelCronograma();
    });

    setInterval(() => {
        const hashAtual = calcularHashEstadoLocal();
        if (hashAtual !== ultimoHashEstado) {
            ultimoHashEstado = hashAtual;
            window.atualizarPainelCronograma();
        }
    }, 400);
});

function calcularHashEstadoLocal() {
    const u = localStorage.getItem('opm_listas_urgencia') || '';
    const e = localStorage.getItem('opm_notas_entrada') || '';
    const t = localStorage.getItem('opm_tratativas_salvas') || localStorage.getItem('opm_notas_tratativa') || '';
    const fl = localStorage.getItem('opm_notas_finalizadas_local') || localStorage.getItem('opm_notas_finalizadas') || '';
    return `${u.length}_${e.length}_${t.length}_${fl.length}`;
}

function trocarAbaEmpresa(novaEmpresa) {
    abaEmpresaAtual = novaEmpresa;

    document.querySelectorAll('.tab-empresa-btn').forEach(btn => btn.classList.remove('active'));
    if (novaEmpresa === 'antenor') {
        document.getElementById('tab-empresa-antenor')?.classList.add('active');
    } else {
        document.getElementById('tab-empresa-filiais')?.classList.add('active');
    }

    window.atualizarPainelCronograma();
}

function trocarAbaSecao(novaSecao) {
    abaSecaoAtual = novaSecao;

    document.querySelectorAll('.tab-secao-btn').forEach(btn => btn.classList.remove('active'));
    
    if (novaSecao === 'urgentes_entrada') {
        document.getElementById('tab-secao-urgentes')?.classList.add('active');
    } else if (novaSecao === 'listas_urgencia') {
        document.getElementById('tab-secao-listas-urgentes')?.classList.add('active');
    }

    window.atualizarPainelCronograma();
}

function voltarParaGestao() {
    window.location.href = '../lobby/lobby.html';
}

function toggleMinimizarLegenda() {
    const card = document.getElementById('statusLegendCard');
    const icon = document.getElementById('iconToggleLegenda');
    if (!card || !icon) return;

    card.classList.toggle('minimized');
    if (card.classList.contains('minimized')) {
        icon.className = 'fa-solid fa-chevron-down';
    } else {
        icon.className = 'fa-solid fa-chevron-up';
    }
}

function toggleExpandCard(element, e) {
    const card = element.closest('.lista-card-container');
    if (card) {
        card.classList.toggle('expanded');
    }
}

function obterListasUrgenciaTotal() {
    const gerais = JSON.parse(localStorage.getItem('opm_listas_urgencia')) || [];
    if (window.listasUrgencia && window.listasUrgencia.length > 0) return window.listasUrgencia;
    return gerais;
}

function pertenceAbaAtual(item) {
    const cat = String(item.categoria || item.estrutura || item.unidade || item.aba || 'antenor').toLowerCase();
    return cat.includes(abaEmpresaAtual);
}

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

function determinarStatusNota(numeroNf, empresa, pendingNFs, tratativasNFs, finishedNFs) {
    const numBuscado = extrairApenasNumeros(numeroNf);

    if (!numBuscado) {
        return {
            classeLinha: 'tr-status-indisponivel',
            classePill: 'pill-indisponivel',
            andamento: 'NAO LOCALIZADO',
            status: 'INDISPONIVEL',
            disponivel: false
        };
    }

    const notaFinalizada = finishedNFs.find(f => {
        const numF = f.numeroNf || f.nf || f.numero;
        const empF = f.empresa || f.fornecedor;
        return saoMesmaNota(numBuscado, empresa, numF, empF);
    });

    if (notaFinalizada) {
        return {
            classeLinha: 'tr-status-verde',
            classePill: 'pill-verde',
            andamento: 'Entrada Concluída',
            status: '<i class="fa-solid fa-circle-check"></i> ENTRADA CONCLUÍDA',
            disponivel: true
        };
    }

    const notaTratativa = tratativasNFs.find(t => {
        const numT = t.numeroNf || t.nf || t.numero;
        const empT = t.empresa || t.fornecedor;
        return saoMesmaNota(numBuscado, empresa, numT, empT);
    });

    if (notaTratativa) {
        const subAba = String(notaTratativa.subAba || notaTratativa.tipoCalculo || notaTratativa.statusCalculo || notaTratativa.aba || '').toLowerCase();
        
        if (subAba.includes('nao') || subAba.includes('não') || notaTratativa.calculada === false) {
            return {
                classeLinha: 'tr-status-laranja',
                classePill: 'pill-laranja',
                andamento: 'Nota Não Calculada',
                status: '<i class="fa-solid fa-clock"></i> AGUARDANDO VALIDAÇÃO',
                disponivel: true
            };
        }

        return {
            classeLinha: 'tr-status-amarelo',
            classePill: 'pill-amarelo',
            andamento: 'Nota Calculada',
            status: '<i class="fa-solid fa-check"></i> ENTRADA CONCLUÍDA',
            disponivel: true
        };
    }

    const notaEntrada = pendingNFs.find(p => {
        const numP = p.numeroNf || p.nf || p.numero;
        const empP = p.empresa || p.fornecedor;
        return saoMesmaNota(numBuscado, empresa, numP, empP);
    });

    if (notaEntrada) {
        return {
            classeLinha: 'tr-status-cinza',
            classePill: 'pill-cinza',
            andamento: 'CADASTRADA',
            status: 'AGUARDANDO ENTRADA',
            disponivel: true
        };
    }

    return {
        classeLinha: 'tr-status-indisponivel',
        classePill: 'pill-indisponivel',
        andamento: 'NAO LOCALIZADO',
        status: 'INDISPONIVEL',
        disponivel: false
    };
}

window.atualizarPainelCronograma = function() {
    const container = document.getElementById('cronogramaContentArea');
    if (!container) return;

    const pendingNFs = window.pendingNFs || JSON.parse(localStorage.getItem('opm_notas_entrada')) || [];
    
    const tratativasSalvas = JSON.parse(localStorage.getItem('opm_tratativas_salvas')) || [];
    const tratativasAntigas = JSON.parse(localStorage.getItem('opm_notas_tratativa')) || [];
    const tratativasGerais = window.tratativasNFs || window.notasGerais || [];
    const tratativasNFs = [...tratativasSalvas, ...tratativasAntigas, ...tratativasGerais];

    const finLocais = JSON.parse(localStorage.getItem('opm_notas_finalizadas_local')) || [];
    const finGerais = JSON.parse(localStorage.getItem('opm_notas_finalizadas')) || [];
    const finFirebase = window.finishedNFs || window.gestaoFinalizadasNFs || [];
    const finishedNFs = [...finLocais, ...finGerais, ...finFirebase];

    const listasUrgencia = obterListasUrgenciaTotal();

    atualizarContadoresGerais(pendingNFs, listasUrgencia);

    container.innerHTML = '';

    if (abaSecaoAtual === 'urgentes_entrada') {
        renderizarAba1UrgentesEntrada(pendingNFs, tratativasNFs, finishedNFs, container);
    } else if (abaSecaoAtual === 'listas_urgencia') {
        renderizarAba2ListasUrgencia(listasUrgencia, pendingNFs, tratativasNFs, finishedNFs, container);
    }
};

function atualizarContadoresGerais(pending, listasUrg) {
    const urgEntradaCount = pending.filter(n => (n.urgente === 'Sim' || n.prioridade === 'URGENTE') && pertenceAbaAtual(n)).length;
    const listUrgCount = listasUrg.filter(l => pertenceAbaAtual(l)).length;

    const el1 = document.getElementById('count-urgentes-entrada');
    const el2 = document.getElementById('count-listas-urgencia');

    if (el1) el1.innerText = urgEntradaCount;
    if (el2) el2.innerText = listUrgCount;
}

function renderizarAba1UrgentesEntrada(pendingNFs, tratativasNFs, finishedNFs, container) {
    const todasNotasSistema = [...pendingNFs, ...tratativasNFs, ...finishedNFs];
    const notasUrgentesUnicas = [];
    const idsProcessados = new Set();

    todasNotasSistema.forEach(nota => {
        const num = extrairApenasNumeros(nota.numeroNf || nota.nf);
        const ehUrgente = nota.urgente === 'Sim' || nota.prioridade === 'URGENTE';
        
        if (num && ehUrgente && pertenceAbaAtual(nota) && !idsProcessados.has(num)) {
            idsProcessados.add(num);
            notasUrgentesUnicas.push(nota);
        }
    });

    if (notasUrgentesUnicas.length === 0) {
        container.innerHTML = `
            <div class="empty-state-box">
                <i class="fa-solid fa-circle-check"></i>
                <p>Nenhuma nota marcada como urgente no formulário de entrada para esta estrutura.</p>
            </div>
        `;
        return;
    }

    let html = `
        <div class="cronograma-table-wrapper">
            <table class="cronograma-table">
                <thead>
                    <tr>
                        <th>Nº NF</th>
                        <th>EMPRESA / FORNECEDOR</th>
                        <th>UNIDADE</th>
                        <th>ANDAMENTO</th>
                        <th>STATUS</th>
                    </tr>
                </thead>
                <tbody>
    `;

    notasUrgentesUnicas.forEach(nota => {
        const numNf = nota.numeroNf || nota.nf;
        const emp = nota.empresa || nota.fornecedor || '-';
        const st = determinarStatusNota(numNf, emp, pendingNFs, tratativasNFs, finishedNFs);

        html += `
            <tr class="${st.classeLinha}">
                <td><strong>${numNf}</strong></td>
                <td>${emp}</td>
                <td>${nota.unidade || (abaEmpresaAtual === 'antenor' ? 'ANTENOR DUARTE VILELA' : 'FILIAL')}</td>
                <td><strong>${st.andamento}</strong></td>
                <td><span class="status-pill ${st.classePill}">${st.status}</span></td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = html;
}

function renderizarAba2ListasUrgencia(listasUrgencia, pendingNFs, tratativasNFs, finishedNFs, container) {
    const listasFiltradas = listasUrgencia.filter(l => pertenceAbaAtual(l));

    if (listasFiltradas.length === 0) {
        container.innerHTML = `
            <div class="empty-state-box">
                <i class="fa-solid fa-folder-open"></i>
                <p>Nenhuma lista de urgência ativa criada no Gerenciamento de Fluxo para esta estrutura.</p>
            </div>
        `;
        return;
    }

    listasFiltradas.forEach(lista => {
        const cardBox = document.createElement('div');
        cardBox.className = 'lista-card-container';

        const nomeListaFormatado = lista.nomeLista || lista.nome || 'Lista de Urgência';
        const dataCriacaoFormatada = lista.dataCriacao || lista.data || '-';

        let tableHtml = `
            <div class="lista-card-header" onclick="toggleExpandCard(this, event)">
                <h4><i class="fa-solid fa-bolt" style="color: #EF4444;"></i> ${nomeListaFormatado}</h4>
                <div class="header-meta-drs">
                    <small style="color: var(--text-muted); font-weight: 700;">Criada em: ${dataCriacaoFormatada}</small>
                    <button type="button" class="btn-toggle-card"><i class="fa-solid fa-chevron-down"></i></button>
                </div>
            </div>
            <div class="lista-card-body">
                <div class="cronograma-table-wrapper">
                    <table class="cronograma-table">
                        <thead>
                            <tr>
                                <th>Nº NF</th>
                                <th>EMPRESA / FORNECEDOR</th>
                                <th>UNIDADE</th>
                                <th>ANDAMENTO</th>
                                <th>STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        const itens = lista.notas || lista.itens || lista.listNf || [];

        if (itens.length === 0) {
            tableHtml += `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Esta lista não possui notas cadastradas.</td></tr>`;
        } else {
            itens.forEach(item => {
                const numNf = item.numeroNf || item.nf || item.numero || item;
                const emp = item.empresa || item.fornecedor || '';
                const un = item.unidade || (abaEmpresaAtual === 'antenor' ? 'ANTENOR DUARTE VILELA' : 'FILIAL');

                const st = determinarStatusNota(numNf, emp, pendingNFs, tratativasNFs, finishedNFs);

                tableHtml += `
                    <tr class="${st.classeLinha}">
                        <td><strong>${numNf}</strong></td>
                        <td>${emp || '-'}</td>
                        <td>${un}</td>
                        <td><strong>${st.andamento}</strong></td>
                        <td><span class="status-pill ${st.classePill}">${st.status}</span></td>
                    </tr>
                `;
            });
        }

        tableHtml += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        cardBox.innerHTML = tableHtml;
        container.appendChild(cardBox);
    });
}