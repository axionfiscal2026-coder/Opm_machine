// VARIÁVEIS DE ESTADO GLOBAL
let abaEmpresaVG = 'antenor'; // 'antenor' ou 'filiais'
let subAbaTratativaVG = 'calculada'; // 'calculada' ou 'nao_calculada'

const itensPorPagina = 5;

let paginas = {
    entrada: 1,
    tratativa: 1,
    finGestao: 1,
    pendResolvidas: 1
};

document.addEventListener('DOMContentLoaded', () => {
    carregarDadosLocais();
    carregarFiltroMotivosOpcoes();
    atualizarTodasTabelasVG();

    window.addEventListener('storage', () => {
        carregarDadosLocais();
        atualizarTodasTabelasVG();
    });
});

function carregarDadosLocais() {
    window.listaEntradas = JSON.parse(localStorage.getItem('opm_notas_entrada')) || [];
    window.listaFinalizadasGestao = JSON.parse(localStorage.getItem('opm_notas_finalizadas_local')) || [];
    window.listaTratativaSalvas = JSON.parse(localStorage.getItem('opm_tratativas_salvas')) || [];
    window.motivosList = JSON.parse(localStorage.getItem('opm_motivos_list')) || [
        "VALIDADE CURTA", "CARTA DE CORREÇÃO", "PRORROGAÇÃO DE BOLETO", "CALCULO DE TRIBUTO", "PATRIMONIO"
    ];
}

function voltarParaGestao() {
    window.location.href = '../lobbyv2/lobbyv2.html';
}

/* TROCA DE ABAS DE EMPRESA (ANTENOR DUARTE / FILIAIS) */
function trocarAbaEmpresaVG(novaAba) {
    abaEmpresaVG = novaAba;

    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    if (novaAba === 'antenor') {
        const t = document.getElementById('tab-antenor');
        if (t) t.classList.add('active');
    } else {
        const t = document.getElementById('tab-filiais');
        if (t) t.classList.add('active');
    }

    paginas.entrada = 1;
    paginas.tratativa = 1;
    paginas.finGestao = 1;
    paginas.pendResolvidas = 1;

    atualizarTodasTabelasVG();
}

/* TROCA DE SUB-ABAS DA TRATATIVA (CALCULADA / NÃO CALCULADA) */
function trocarSubAbaTratativaVG(novaSubAba) {
    subAbaTratativaVG = novaSubAba;

    const btnCalc = document.getElementById('subtab-vg-calculada');
    const btnNaoCalc = document.getElementById('subtab-vg-nao-calculada');

    if (btnCalc) btnCalc.classList.toggle('active', novaSubAba === 'calculada');
    if (btnNaoCalc) btnNaoCalc.classList.toggle('active', novaSubAba === 'nao_calculada');

    paginas.tratativa = 1;
    renderTratativas();
}

function carregarFiltroMotivosOpcoes() {
    const selectFiltro = document.getElementById('filtroMotivoTratativa');
    if (!selectFiltro) return;

    const motivos = window.motivosList || [];
    selectFiltro.innerHTML = '<option value="">Todos os motivos</option>';

    motivos.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.innerText = m;
        selectFiltro.appendChild(opt);
    });
}

window.atualizarTodasTabelasVG = function() {
    renderEntradas();
    renderTratativas();
    renderFinalizadasGestao();
    renderPendenciasResolvidas();
};

/* ----------------------------------------------------
   1. NOTAS DE ENTRADA
---------------------------------------------------- */
function renderEntradas() {
    const tbody = document.getElementById('tblEntradaBody');
    if (!tbody) return;

    const termo = (document.getElementById('searchEntrada')?.value || '').toLowerCase();
    
    const filtradas = (window.listaEntradas || []).filter(n => {
        const catMatch = (n.categoria || 'antenor') === abaEmpresaVG;
        const textMatch = (n.numeroNf || '').toLowerCase().includes(termo) || 
                          (n.empresa || '').toLowerCase().includes(termo);
        return catMatch && textMatch;
    });

    const paginadas = paginarLista(filtradas, paginas.entrada, 'entrada', 'infoEntrada', 'pageEntrada', 'prevEntrada', 'nextEntrada');

    tbody.innerHTML = '';
    if (paginadas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 15px;">Nenhuma nota cadastrada nesta aba.</td></tr>`;
        return;
    }

    paginadas.forEach(nota => {
        const iconeUrgente = nota.urgente === 'Sim' ? `<i class="fa-solid fa-triangle-exclamation icone-urgente-piscando" title="Urgente"></i>` : '';
        const iconeEstornada = nota.estornada ? `<i class="fa-solid fa-rotate-left" style="color: #D97706; margin-left: 6px;" title="Estornada"></i>` : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${nota.numeroNf || nota.nf}</strong> ${iconeUrgente} ${iconeEstornada}</td>
            <td>${nota.empresa || nota.fornecedor}</td>
            <td><button type="button" class="btn-ver-mais" onclick="abrirDetalhesEntrada('${nota.id}')">Ver mais</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function filtrarEntradas() {
    paginas.entrada = 1;
    renderEntradas();
}

function abrirDetalhesEntrada(idNota) {
    const nota = (window.listaEntradas || []).find(n => String(n.id) === String(idNota));
    if (!nota) return;

    let htmlEstorno = '';
    let rodapeDataHora = '';

    if (nota.estornada) {
        htmlEstorno = `
            <div style="margin-top: 10px; padding: 10px; background-color: #FEF3C7; border: 1px solid #FCD34D; border-radius: 8px;">
                <div style="color: #D97706; font-weight: 800; font-size: 0.88rem;"><i class="fa-solid fa-rotate-left"></i> Nota Estornada</div>
                <div style="font-size: 0.82rem; color: #92400E; margin-top: 4px;"><strong>Motivo:</strong> ${nota.motivoEstorno || 'Não informado'}</div>
            </div>
        `;
        rodapeDataHora = `<i class="fa-solid fa-clock"></i> Estornado em: ${nota.dataHoraEstorno || nota.dataHora || '-'}`;
    } else {
        rodapeDataHora = `<i class="fa-solid fa-clock"></i> Cadastrada em: ${nota.dataHora || '-'}`;
    }

    const content = `
        <div class="modal-info-row"><strong>Nº NF:</strong> ${nota.numeroNf || nota.nf}</div>
        <div class="modal-info-row"><strong>Empresa:</strong> ${nota.empresa || nota.fornecedor}</div>
        <div class="modal-info-row"><strong>Unidade:</strong> ${nota.unidade || '-'}</div>
        <div class="modal-info-row"><strong>Urgente:</strong> ${nota.urgente || 'Não'}</div>
        <div class="modal-info-row"><strong>Observações:</strong> ${nota.observacoes || 'Nenhuma observação'}</div>
        ${htmlEstorno}
        <div class="modal-info-row" style="margin-top: 12px; font-size: 0.8rem; color: var(--text-muted); border-top: 1px solid #E5E7EB; padding-top: 8px;">
            ${rodapeDataHora}
        </div>
    `;
    exibirModalVG(content);
}

/* ----------------------------------------------------
   2. NOTAS EM TRATATIVA
---------------------------------------------------- */
function renderTratativas() {
    const tbody = document.getElementById('tblTratativaBody');
    if (!tbody) return;

    const termo = (document.getElementById('searchTratativa')?.value || '').toLowerCase();
    const filtroMotivo = document.getElementById('filtroMotivoTratativa')?.value || '';

    const filtradas = (window.listaTratativaSalvas || []).filter(n => {
        const catMatch = (n.categoria || 'antenor') === abaEmpresaVG;
        const statusCalc = n.calculada !== undefined ? n.calculada : true;
        const subAbaMatch = subAbaTratativaVG === 'calculada' ? statusCalc : !statusCalc;
        const naoResolvidaMatch = !n.resolvida; // Apenas pendências em aberto

        const textMatch = (n.numeroNf || '').toLowerCase().includes(termo) || 
                          (n.empresa || '').toLowerCase().includes(termo) || 
                          (n.usuarioResponsavel || '').toLowerCase().includes(termo);
        const motivoMatch = !filtroMotivo || (n.motivoPendencia || '').includes(filtroMotivo);

        return catMatch && subAbaMatch && naoResolvidaMatch && textMatch && motivoMatch;
    });

    const paginadas = paginarLista(filtradas, paginas.tratativa, 'tratativa', 'infoTratativa', 'pageTratativa', 'prevTratativa', 'nextTratativa');

    tbody.innerHTML = '';
    if (paginadas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 15px;">Nenhuma nota em tratativa nesta seção.</td></tr>`;
        return;
    }

    paginadas.forEach(nota => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${nota.numeroNf}</strong></td>
            <td>${nota.empresa}</td>
            <td><i class="fa-solid fa-user" style="font-size: 0.75rem; color: var(--primary-med);"></i> ${nota.usuarioResponsavel ? nota.usuarioResponsavel.toUpperCase() : '-'}</td>
            <td>${nota.vencimentoBoleto || '-'}</td>
            <td><span class="badge-motivo">${nota.motivoPendencia || '-'}</span></td>
            <td><button type="button" class="btn-ver-mais" onclick="abrirDetalhesTratativaVG('${nota.id}')">Ver mais</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function filtrarTratativas() {
    paginas.tratativa = 1;
    renderTratativas();
}

function abrirDetalhesTratativaVG(idNota) {
    const nota = (window.listaTratativaSalvas || []).find(n => String(n.id) === String(idNota));
    if (!nota) return;

    const content = `
        <div class="modal-info-row"><strong>Nº NF:</strong> ${nota.numeroNf}</div>
        <div class="modal-info-row"><strong>Empresa:</strong> ${nota.empresa}</div>
        <div class="modal-info-row"><strong>Unidade:</strong> ${nota.unidade || '-'}</div>
        <div class="modal-info-row"><strong>Responsável:</strong> ${nota.usuarioResponsavel ? nota.usuarioResponsavel.toUpperCase() : '-'}</div>
        <div class="modal-info-row"><strong>Vencimento Boleto:</strong> ${nota.vencimentoBoleto || '-'}</div>
        <div class="modal-info-row"><strong>Motivo Pendência:</strong> ${nota.motivoPendencia || '-'}</div>
        <div class="modal-info-row"><strong>Status Cálculo:</strong> ${nota.calculada ? 'Calculada' : 'Não Calculada'}</div>
        <div class="modal-info-row"><strong>Observações:</strong> ${nota.observacao || 'Nenhuma observação'}</div>
        <div class="modal-info-row" style="margin-top: 12px; font-size: 0.8rem; color: var(--text-muted); border-top: 1px solid #E5E7EB; padding-top: 8px;">
            <i class="fa-solid fa-clock"></i> Criada em: ${nota.dataHoraCriacao || '-'}
        </div>
    `;
    exibirModalVG(content);
}

/* ----------------------------------------------------
   3. NOTAS FINALIZADAS (GESTÃO)
---------------------------------------------------- */
function renderFinalizadasGestao() {
    const tbody = document.getElementById('tblFinalizadasGestaoBody');
    if (!tbody) return;

    const termo = (document.getElementById('searchFinalizadasGestao')?.value || '').toLowerCase();
    
    const filtradas = (window.listaFinalizadasGestao || []).filter(n => {
        const catMatch = (n.categoria || 'antenor') === abaEmpresaVG;
        const textMatch = (n.numeroNf || n.nf || '').toLowerCase().includes(termo) || 
                          (n.empresa || n.fornecedor || '').toLowerCase().includes(termo) || 
                          (n.finalizadoPor || '').toLowerCase().includes(termo);
        return catMatch && textMatch;
    });

    const paginadas = paginarLista(filtradas, paginas.finGestao, 'finGestao', 'infoFinalizadasGestao', 'pageFinalizadasGestao', 'prevFinalizadasGestao', 'nextFinalizadasGestao');

    tbody.innerHTML = '';
    if (paginadas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 15px;">Nenhuma nota finalizada registrada.</td></tr>`;
        return;
    }

    paginadas.forEach(nota => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${nota.numeroNf || nota.nf}</strong></td>
            <td>${nota.empresa || nota.fornecedor}</td>
            <td>${nota.finalizadoPor || '-'}</td>
            <td><button type="button" class="btn-ver-mais" onclick="abrirDetalhesFinalizadasGestao('${nota.id}')">Ver mais</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function filtrarFinalizadasGestao() {
    paginas.finGestao = 1;
    renderFinalizadasGestao();
}

function abrirDetalhesFinalizadasGestao(idNota) {
    const nota = (window.listaFinalizadasGestao || []).find(n => String(n.id) === String(idNota));
    if (!nota) return;

    const content = `
        <div class="modal-info-row"><strong>Nº NF:</strong> ${nota.numeroNf || nota.nf}</div>
        <div class="modal-info-row"><strong>Empresa:</strong> ${nota.empresa || nota.fornecedor}</div>
        <div class="modal-info-row"><strong>Unidade:</strong> ${nota.unidade || '-'}</div>
        <div class="modal-info-row"><strong>Finalizado por:</strong> ${nota.finalizadoPor || '-'}</div>
        <div class="modal-info-row"><strong>Tipo:</strong> ${nota.tipo || '-'}</div>
        <div class="modal-info-row"><strong>Local Estoque:</strong> ${nota.localEstoque || '-'}</div>
        <div class="modal-info-row"><strong>Operação:</strong> ${nota.operacao || '-'}</div>
        <div class="modal-info-row" style="margin-top: 12px; font-size: 0.8rem; color: var(--text-muted); border-top: 1px solid #E5E7EB; padding-top: 8px;">
            <i class="fa-solid fa-clock"></i> Finalizada em: ${nota.dataHora || '-'}
        </div>
    `;
    exibirModalVG(content);
}

/* ----------------------------------------------------
   4. HISTÓRICO DE PENDÊNCIAS RESOLVIDAS (TRATATIVAS)
---------------------------------------------------- */
function renderPendenciasResolvidas() {
    const tbody = document.getElementById('tblPendenciasResolvidasBody');
    if (!tbody) return;

    const termo = (document.getElementById('searchPendenciasResolvidas')?.value || '').toLowerCase();
    
    const filtradas = (window.listaTratativaSalvas || []).filter(n => {
        const catMatch = (n.categoria || 'antenor') === abaEmpresaVG;
        const resolvidaMatch = n.resolvida === true;
        const textMatch = (n.numeroNf || '').toLowerCase().includes(termo) || 
                          (n.empresa || '').toLowerCase().includes(termo) || 
                          (n.usuarioResponsavel || '').toLowerCase().includes(termo);
        return catMatch && resolvidaMatch && textMatch;
    });

    const paginadas = paginarLista(filtradas, paginas.pendResolvidas, 'pendResolvidas', 'infoPendenciasResolvidas', 'pagePendenciasResolvidas', 'prevPendenciasResolvidas', 'nextPendenciasResolvidas');

    tbody.innerHTML = '';
    if (paginadas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 15px;">Nenhuma pendência resolvida registrada.</td></tr>`;
        return;
    }

    paginadas.forEach(nota => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${nota.numeroNf}</strong></td>
            <td>${nota.empresa}</td>
            <td>${nota.usuarioResponsavel ? nota.usuarioResponsavel.toUpperCase() : '-'}</td>
            <td><span class="badge-motivo" style="background-color: #D1FAE5; color: #065F46;">${nota.motivoPendencia}</span></td>
            <td style="font-size: 0.8rem; color: var(--text-muted);">${nota.dataHoraResolvida || nota.dataHoraCriacao || '-'}</td>
            <td><button type="button" class="btn-ver-mais" onclick="abrirDetalhesTratativaVG('${nota.id}')">Ver mais</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function filtrarPendenciasResolvidas() {
    paginas.pendResolvidas = 1;
    renderPendenciasResolvidas();
}

/* ----------------------------------------------------
   PAGINAÇÃO E MODAL HELPERS
---------------------------------------------------- */
function paginarLista(lista, paginaAtual, chavePagina, elInfoId, elPageId, elPrevId, elNextId) {
    const totalRegistros = lista.length;
    const totalPaginas = Math.ceil(totalRegistros / itensPorPagina) || 1;

    if (paginas[chavePagina] > totalPaginas) paginas[chavePagina] = totalPaginas;
    if (paginas[chavePagina] < 1) paginas[chavePagina] = 1;

    const inicio = (paginas[chavePagina] - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;

    const elInfo = document.getElementById(elInfoId);
    const elPage = document.getElementById(elPageId);
    const elPrev = document.getElementById(elPrevId);
    const elNext = document.getElementById(elNextId);

    if (elInfo) elInfo.innerText = `Mostrando ${totalRegistros > 0 ? inicio + 1 : 0}–${Math.min(fim, totalRegistros)} de ${totalRegistros}`;
    if (elPage) elPage.innerText = `${paginas[chavePagina]}/${totalPaginas}`;
    if (elPrev) elPrev.disabled = paginas[chavePagina] === 1;
    if (elNext) elNext.disabled = paginas[chavePagina] >= totalPaginas;

    return lista.slice(inicio, fim);
}

function mudarPagina(chavePagina, direcao) {
    paginas[chavePagina] += direcao;
    if (chavePagina === 'entrada') renderEntradas();
    if (chavePagina === 'tratativa') renderTratativas();
    if (chavePagina === 'finGestao') renderFinalizadasGestao();
    if (chavePagina === 'pendResolvidas') renderPendenciasResolvidas();
}

function exibirModalVG(contentHtml) {
    const container = document.getElementById('modalDetalhesVGContent');
    if (container) {
        container.innerHTML = contentHtml;
        document.getElementById('modalDetalhesVG').style.display = 'flex';
    }
}

function fecharModalDetalhesVG() {
    const modal = document.getElementById('modalDetalhesVG');
    if (modal) modal.style.display = 'none';
}