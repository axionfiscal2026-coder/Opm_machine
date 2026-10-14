let notasEntrada = JSON.parse(localStorage.getItem('opm_notas_entrada')) || [];
let usuariosCadastrados = JSON.parse(localStorage.getItem('opm_usuarios_list')) || ['bruno', 'gab', 'carlos', 'joao'];
let motivosCadastrados = JSON.parse(localStorage.getItem('opm_motivos_list')) || [
    "VALIDADE CURTA", "CARTA DE CORREÇÃO", "PRORROGAÇÃO DE BOLETO", "CALCULO DE TRIBUTO", "PATRIMONIO"
];
let tratativasSalvas = JSON.parse(localStorage.getItem('opm_tratativas_salvas')) || [];

let abaAtual = 'antenor'; // 'antenor' ou 'filiais'
let subAbaAtual = 'calculada'; // 'calculada' ou 'nao_calculada'
let modoSelecaoNota = 'selecionar'; // 'selecionar' ou 'adicionar'
let idTratativaParaEstornar = null;
let idTratativaParaFinalizar = null;
let idTratativaParaMigrar = null;
let relatorioModoResolvido = false;

// VARIÁVEIS DE PAGINAÇÃO DE NOTAS
let paginaAtual = 1;
const ITENS_POR_PAGINA = 10;

document.addEventListener('DOMContentLoaded', () => {
    forcarResetContador45DiasHoje();

    carregarOpcoesDropdownNotas();
    carregarOpcoesUsuarios();
    carregarOpcoesMotivos();
    renderizarTabelaTratativas();
    iniciarCronometro45Dias();
    
    document.addEventListener('click', (e) => {
        const container = document.getElementById('customDropdownNf');
        if (container && !container.contains(e.target)) {
            fecharDropdownNf();
        }
    });
});

function forcarResetContador45DiasHoje() {
    const chaveControle = 'opm_tratativas_reset_45d_iniciado_v2';
    const jaReiniciouHoje = localStorage.getItem(chaveControle);

    if (!jaReiniciouHoje) {
        const novoTarget = Date.now() + (45 * 24 * 60 * 60 * 1000);
        window.resetTratativasTs = novoTarget;
        localStorage.setItem('opm_tratativas_reset_ts', novoTarget);
        localStorage.setItem(chaveControle, 'true');
        
        if (typeof window.syncWithFirebaseGeral === "function") {
            window.syncWithFirebaseGeral();
        }
    }
}

window.verificarResetAutomatico45DiasTratativas = function() {
    const agora = Date.now();
    let targetTs = window.resetTratativasTs || Number(localStorage.getItem('opm_tratativas_reset_ts'));

    if (!targetTs || agora >= targetTs) {
        targetTs = agora + (45 * 24 * 60 * 60 * 1000);
        window.resetTratativasTs = targetTs;
        localStorage.setItem('opm_tratativas_reset_ts', targetTs);

        // Limpeza automática das tratativas resolvidas e calculadas após os 45 dias
        tratativasSalvas = tratativasSalvas.filter(t => {
            const eCalculada = t.calculada !== undefined ? t.calculada : true;
            const eResolvida = t.resolvida || t.motivoPendencia === 'PENDÊNCIA RESOLVIDA';
            return !(eCalculada && eResolvida);
        });

        localStorage.setItem('opm_tratativas_salvas', JSON.stringify(tratativasSalvas));

        if (typeof window.syncWithFirebaseGeral === "function") {
            window.tratativasSalvas = tratativasSalvas;
            window.syncWithFirebaseGeral();
        }
        renderizarTabelaTratativas();
    }
};

function iniciarCronometro45Dias() {
    setInterval(() => {
        window.verificarResetAutomatico45DiasTratativas();
        const agora = Date.now();
        const targetTs = window.resetTratativasTs || Number(localStorage.getItem('opm_tratativas_reset_ts')) || (agora + (45 * 24 * 60 * 60 * 1000));
        const dif = Math.max(0, targetTs - agora);

        const dias = Math.floor(dif / (1000 * 60 * 60 * 24));
        const horas = Math.floor((dif % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutos = Math.floor((dif % (1000 * 60 * 60)) / (1000 * 60));

        const textSpan = document.getElementById('resetTimerText');
        if (textSpan) {
            textSpan.innerText = `${dias}d ${String(horas).padStart(2, '0')}h ${String(minutos).padStart(2, '0')}m`;
        }
    }, 1000);
}

function voltarParaGestao() {
    window.location.href = '../lobby/lobby.html';
}

function obterDataHoraAtualFormatada() {
    const agora = new Date();
    const dataStr = agora.toLocaleDateString('pt-BR');
    const horaStr = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${dataStr} às ${horaStr}`;
}

function alternarTela(destino) {
    const formAreaWrapper = document.getElementById('formAreaWrapper');
    const historySec = document.getElementById('historySection');

    if (destino === 'tabela') {
        if (formAreaWrapper) formAreaWrapper.style.display = 'none';
        if (historySec) historySec.style.display = 'block';
        paginaAtual = 1;
        renderizarTabelaTratativas();
    } else {
        if (formAreaWrapper) formAreaWrapper.style.display = 'block';
        if (historySec) historySec.style.display = 'none';
    }
}

function trocarAbaEmpresa(novaAba) {
    abaAtual = novaAba;
    paginaAtual = 1;

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

    const formTitle = document.getElementById('formTitle');
    if (formTitle) formTitle.innerText = `Nova Tratativa — ${abaAtual === 'antenor' ? 'ANTENOR DUARTE' : 'FILIAIS'}`;

    const tabelaAbaTitulo = document.getElementById('tabelaAbaTitulo');
    if (tabelaAbaTitulo) tabelaAbaTitulo.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> Tratativas Registradas — ${abaAtual === 'antenor' ? 'ANTENOR DUARTE' : 'FILIAIS'}`;

    document.getElementById('tratativa-form').reset();
    limparSelecaoNf();

    carregarOpcoesDropdownNotas();
    renderizarTabelaTratativas();
}

function trocarSubAba(novaSubAba) {
    subAbaAtual = novaSubAba;
    paginaAtual = 1;

    const btnCalc = document.getElementById('subtab-calculada');
    const btnNaoCalc = document.getElementById('subtab-nao-calculada');
    const btnRelatorio = document.getElementById('btnRelatorioAba');

    if (btnCalc) btnCalc.classList.toggle('active', novaSubAba === 'calculada');
    if (btnNaoCalc) btnNaoCalc.classList.toggle('active', novaSubAba === 'nao_calculada');

    if (btnRelatorio) {
        btnRelatorio.style.display = novaSubAba === 'calculada' ? 'inline-flex' : 'none';
    }

    renderizarTabelaTratativas();
}

function alternarModoNota(modo) {
    modoSelecaoNota = modo;
    const btnSel = document.getElementById('btnModoSelecionar');
    const btnAdd = document.getElementById('btnModoAdicionar');
    const blocoSel = document.getElementById('blocoSelecionarNota');
    const blocoAdd = document.getElementById('blocoAdicionarNota');
    const banner = document.getElementById('autoFieldsContainer');

    if (btnSel) btnSel.classList.toggle('active', modo === 'selecionar');
    if (btnAdd) btnAdd.classList.toggle('active', modo === 'adicionar');

    if (modo === 'selecionar') {
        if (blocoSel) blocoSel.style.display = 'block';
        if (blocoAdd) blocoAdd.style.display = 'none';
        document.getElementById('manualNumNf').value = '';
        document.getElementById('manualFornecedor').value = '';
    } else {
        if (blocoSel) blocoSel.style.display = 'none';
        if (blocoAdd) blocoAdd.style.display = 'block';
        if (banner) banner.style.display = 'none';
        limparSelecaoNf();
    }
}

function obterNotasEntradaAbaAtual() {
    if (window.pendingNFs) notasEntrada = window.pendingNFs;
    return notasEntrada.filter(n => (n.categoria || 'antenor') === abaAtual);
}

function toggleDropdownNf() {
    const container = document.getElementById('customDropdownNf');
    const panel = document.getElementById('dropdownPopupPanel');
    if (!container || !panel) return;

    const isOpen = container.classList.contains('open');
    if (isOpen) {
        fecharDropdownNf();
    } else {
        container.classList.add('open');
        panel.style.display = 'block';
        const inputBusca = document.getElementById('inputBuscaNotaDropdown');
        if (inputBusca) {
            inputBusca.value = '';
            inputBusca.focus();
        }
        carregarOpcoesDropdownNotas();
    }
}

function fecharDropdownNf() {
    const container = document.getElementById('customDropdownNf');
    const panel = document.getElementById('dropdownPopupPanel');
    if (container) container.classList.remove('open');
    if (panel) panel.style.display = 'none';
}

function carregarOpcoesDropdownNotas(termoBusca = '') {
    const optionsList = document.getElementById('dropdownOptionsList');
    if (!optionsList) return;

    const notasAba = obterNotasEntradaAbaAtual();
    const termo = termoBusca.toLowerCase().trim();

    const notasFiltradas = notasAba.filter(nota => {
        if (!termo) return true;
        const num = String(nota.numeroNf || '').toLowerCase();
        const emp = String(nota.empresa || '').toLowerCase();
        return num.includes(termo) || emp.includes(termo);
    });

    optionsList.innerHTML = '';

    if (notasFiltradas.length === 0) {
        optionsList.innerHTML = `<div style="padding: 10px 12px; font-size: 0.85rem; color: var(--text-muted); text-align: center;">Nenhuma NF encontrada</div>`;
        return;
    }

    notasFiltradas.forEach(nota => {
        const div = document.createElement('div');
        div.className = 'dropdown-option-item';
        div.innerText = `NF: ${nota.numeroNf} | Empresa: ${nota.empresa}`;
        div.onclick = (e) => {
            e.stopPropagation();
            selecionarNotaDropdown(nota.id);
        };
        optionsList.appendChild(div);
    });
}

function filtrarListaDropdownNotas(termo) {
    carregarOpcoesDropdownNotas(termo);
}

function selecionarNotaDropdown(idNota) {
    const hiddenInput = document.getElementById('selectNfHidden');
    const selectedText = document.getElementById('dropdownSelectedText');
    const banner = document.getElementById('autoFieldsContainer');

    if (!hiddenInput || !selectedText) return;

    hiddenInput.value = idNota;
    const nota = notasEntrada.find(n => String(n.id) === String(idNota));

    if (nota) {
        selectedText.innerText = `NF: ${nota.numeroNf} | Empresa: ${nota.empresa}`;
        selectedText.style.color = 'var(--text-main)';
        
        document.getElementById('autoNumNf').innerText = nota.numeroNf || '-';
        document.getElementById('autoEmpresa').innerText = nota.empresa || '-';
        document.getElementById('autoUnidade').innerText = nota.unidade || '-';
        banner.style.display = 'flex';
    }

    fecharDropdownNf();
}

function limparSelecaoNf() {
    const hiddenInput = document.getElementById('selectNfHidden');
    const selectedText = document.getElementById('dropdownSelectedText');
    if (hiddenInput) hiddenInput.value = '';
    if (selectedText) {
        selectedText.innerText = '-- Selecione uma NF pendente --';
        selectedText.style.color = 'var(--text-muted)';
    }

    const banner = document.getElementById('autoFieldsContainer');
    if (banner) banner.style.display = 'none';

    carregarOpcoesDropdownNotas();
}

function carregarOpcoesUsuarios() {
    const select = document.getElementById('usuarioResponsavel');
    if (!select) return;

    if (window.userList && window.userList.length > 0) usuariosCadastrados = window.userList;

    const valorAtual = select.value;
    select.innerHTML = `<option value="">Selecione...</option>`;

    usuariosCadastrados.forEach(user => {
        const option = document.createElement('option');
        option.value = user;
        option.innerText = user.toUpperCase();
        select.appendChild(option);
    });

    select.value = valorAtual;
}

function abrirModalGerenciarUsuarios() {
    renderizarListaUsuariosModal();
    document.getElementById('modalGerenciarUsuarios').style.display = 'flex';
}

function fecharModalGerenciarUsuarios() {
    document.getElementById('modalGerenciarUsuarios').style.display = 'none';
    carregarOpcoesUsuarios();
}

function renderizarListaUsuariosModal() {
    const ul = document.getElementById('listaUsuariosCadastrados');
    if (!ul) return;

    ul.innerHTML = '';
    if (usuariosCadastrados.length === 0) {
        ul.innerHTML = `<li style="color: var(--text-muted); text-align: center;">Nenhum usuário cadastrado.</li>`;
        return;
    }

    usuariosCadastrados.forEach((usr) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${usr.toUpperCase()}</span>
            <button type="button" class="btn-delete-unidade" onclick="excluirUsuario('${usr}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
        `;
        ul.appendChild(li);
    });
}

function adicionarNovoUsuario() {
    const input = document.getElementById('novoUsuarioInput');
    const valor = input.value.trim().toLowerCase();
    if (!valor) return;

    if (usuariosCadastrados.includes(valor)) {
        alert("Este usuário já está cadastrado.");
        return;
    }

    usuariosCadastrados.push(valor);
    localStorage.setItem('opm_usuarios_list', JSON.stringify(usuariosCadastrados));

    if (typeof window.syncWithFirebaseGeral === "function") {
        window.userList = usuariosCadastrados;
        window.syncWithFirebaseGeral();
    }

    input.value = '';
    renderizarListaUsuariosModal();
}

function excluirUsuario(usr) {
    if (confirm(`Deseja remover o usuário "${usr.toUpperCase()}"?`)) {
        usuariosCadastrados = usuariosCadastrados.filter(u => u !== usr);
        localStorage.setItem('opm_usuarios_list', JSON.stringify(usuariosCadastrados));

        if (typeof window.syncWithFirebaseGeral === "function") {
            window.userList = usuariosCadastrados;
            window.syncWithFirebaseGeral();
        }

        renderizarListaUsuariosModal();
    }
}

function carregarOpcoesMotivos() {
    const selectForm = document.getElementById('motivoPendencia');
    const selectFiltro = document.getElementById('filterMotivo');

    if (window.motivosList && window.motivosList.length > 0) motivosCadastrados = window.motivosList;

    if (selectForm) {
        const valSel = selectForm.value;
        selectForm.innerHTML = `<option value="">Selecione...</option>`;
        motivosCadastrados.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.innerText = m;
            selectForm.appendChild(opt);
        });
        selectForm.value = valSel;
    }

    if (selectFiltro) {
        const valFiltro = selectFiltro.value;
        selectFiltro.innerHTML = `<option value="">Todos os Motivos</option>`;
        motivosCadastrados.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.innerText = m;
            selectFiltro.appendChild(opt);
        });
        const optRes = document.createElement('option');
        optRes.value = 'PENDÊNCIA RESOLVIDA';
        optRes.innerText = 'PENDÊNCIA RESOLVIDA';
        selectFiltro.appendChild(optRes);

        selectFiltro.value = valFiltro;
    }
}

function abrirModalGerenciarMotivos() {
    renderizarListaMotivosModal();
    document.getElementById('modalGerenciarMotivos').style.display = 'flex';
}

function fecharModalGerenciarMotivos() {
    document.getElementById('modalGerenciarMotivos').style.display = 'none';
    carregarOpcoesMotivos();
}

function renderizarListaMotivosModal() {
    const ul = document.getElementById('listaMotivosCadastrados');
    if (!ul) return;

    ul.innerHTML = '';
    if (motivosCadastrados.length === 0) {
        ul.innerHTML = `<li style="color: var(--text-muted); text-align: center;">Nenhum motivo cadastrado.</li>`;
        return;
    }

    motivosCadastrados.forEach((m) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${m}</span>
            <button type="button" class="btn-delete-unidade" onclick="excluirMotivo('${m}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
        `;
        ul.appendChild(li);
    });
}

function adicionarNovoMotivo() {
    const input = document.getElementById('novoMotivoInput');
    const valor = input.value.trim().toUpperCase();
    if (!valor) return;

    if (motivosCadastrados.includes(valor)) {
        alert("Este motivo já está cadastrado.");
        return;
    }

    motivosCadastrados.push(valor);
    localStorage.setItem('opm_motivos_list', JSON.stringify(motivosCadastrados));

    if (typeof window.syncWithFirebaseGeral === "function") {
        window.motivosList = motivosCadastrados;
        window.syncWithFirebaseGeral();
    }

    input.value = '';
    renderizarListaMotivosModal();
}

function excluirMotivo(m) {
    if (confirm(`Deseja remover o motivo "${m}"?`)) {
        motivosCadastrados = motivosCadastrados.filter(item => item !== m);
        localStorage.setItem('opm_motivos_list', JSON.stringify(motivosCadastrados));

        if (typeof window.syncWithFirebaseGeral === "function") {
            window.motivosList = motivosCadastrados;
            window.syncWithFirebaseGeral();
        }

        renderizarListaMotivosModal();
    }
}

function solicitarStatusCalculada(e) {
    if (e && e.preventDefault) e.preventDefault();

    if (modoSelecaoNota === 'selecionar') {
        const idNota = document.getElementById('selectNfHidden').value;
        if (!idNota) {
            alert("Selecione uma Nota Fiscal válida.");
            return;
        }
    } else {
        const numManual = document.getElementById('manualNumNf').value.trim();
        const fornManual = document.getElementById('manualFornecedor').value.trim();
        if (!numManual || !fornManual) {
            alert("Preencha o Número da NF e o Nome do Fornecedor.");
            return;
        }
    }

    document.getElementById('modalPerguntarCalculada').style.display = 'flex';
}

function fecharModalPerguntarCalculada() {
    document.getElementById('modalPerguntarCalculada').style.display = 'none';
}

function confirmarSalvarTratativa(foiCalculada) {
    fecharModalPerguntarCalculada();

    let numeroNfFinal = '';
    let empresaFinal = '';
    let unidadeFinal = abaAtual === 'antenor' ? 'ANTENOR DUARTE VILELA' : 'FILIAL';
    let notaOriginalObj = null;

    if (modoSelecaoNota === 'selecionar') {
        const idNota = document.getElementById('selectNfHidden').value;
        const indexNota = notasEntrada.findIndex(n => String(n.id) === String(idNota));
        if (indexNota === -1) return;

        notaOriginalObj = notasEntrada[indexNota];
        numeroNfFinal = notaOriginalObj.numeroNf;
        empresaFinal = notaOriginalObj.empresa;
        unidadeFinal = notaOriginalObj.unidade || unidadeFinal;

        notasEntrada.splice(indexNota, 1);
        localStorage.setItem('opm_notas_entrada', JSON.stringify(notasEntrada));
    } else {
        numeroNfFinal = document.getElementById('manualNumNf').value.trim();
        empresaFinal = document.getElementById('manualFornecedor').value.trim();
        notaOriginalObj = {
            id: Date.now(),
            categoria: abaAtual,
            numeroNf: numeroNfFinal,
            empresa: empresaFinal,
            unidade: unidadeFinal,
            urgente: 'Não'
        };
    }

    const usuario = document.getElementById('usuarioResponsavel').value;
    const vencimento = document.getElementById('vencimentoBoleto').value;
    const motivo = document.getElementById('motivoPendencia').value;
    const observacao = document.getElementById('observacao').value.trim() || 'Sem observação';

    const novaTratativa = {
        id: Date.now(),
        notaOriginal: notaOriginalObj,
        categoria: abaAtual,
        calculada: foiCalculada,
        resolvida: false,
        dataHoraResolvida: '',
        numeroNf: numeroNfFinal,
        empresa: empresaFinal,
        unidade: unidadeFinal,
        usuarioResponsavel: usuario,
        vencimentoBoleto: vencimento ? formatarDataExibicao(vencimento) : '-',
        vencimentoBoletoRaw: vencimento || '',
        motivoPendencia: motivo,
        observacao: observacao,
        dataHoraCriacao: new Date().toLocaleString('pt-BR')
    };

    tratativasSalvas.unshift(novaTratativa);

    localStorage.setItem('opm_tratativas_salvas', JSON.stringify(tratativasSalvas));

    if (typeof window.syncWithFirebaseGeral === "function") {
        window.pendingNFs = notasEntrada;
        window.tratativasSalvas = tratativasSalvas;
        window.syncWithFirebaseGeral();
    }

    document.getElementById('tratativa-form').reset();
    limparSelecaoNf();
    alternarModoNota('selecionar');

    mostrarToast(`Tratativa salva na aba ${foiCalculada ? 'NOTA CALCULADA' : 'NÃO CALCULADA'}!`);
    carregarOpcoesDropdownNotas();
}

function obterClasseMotivo(motivoText) {
    if (!motivoText) return 'motivo-outros';
    const mot = motivoText.toUpperCase();
    if (mot.includes('PENDÊNCIA RESOLVIDA')) return 'motivo-resolvida';
    if (mot.includes('VALIDADE CURTA')) return 'motivo-validade-curta';
    if (mot.includes('CARTA DE CORREÇÃO')) return 'motivo-carta-correcao';
    if (mot.includes('PRORROGAÇÃO DE BOLETO')) return 'motivo-prorrogacao-boleto';
    if (mot.includes('CALCULO DE TRIBUTO') || mot.includes('CÁLCULO DE TRIBUTO')) return 'motivo-calculo-tributo';
    if (mot.includes('PATRIMONIO') || mot.includes('PATRIMÔNIO')) return 'motivo-patrimonio';
    return 'motivo-outros';
}

function renderizarTabelaTratativas() {
    const tbody = document.getElementById('tabelaTratativasBody');
    if (!tbody) return;

    if (window.tratativasSalvas) tratativasSalvas = window.tratativasSalvas;

    const termo = (document.getElementById('searchInput')?.value || '').toLowerCase();
    const filtroMotivo = document.getElementById('filterMotivo')?.value || '';

    const filtradas = tratativasSalvas.filter(t => {
        const catMatch = (t.categoria || 'antenor') === abaAtual;
        
        const statusCalc = t.calculada !== undefined ? t.calculada : true;
        const subAbaMatch = subAbaAtual === 'calculada' ? statusCalc : !statusCalc;

        const textMatch = t.numeroNf.toLowerCase().includes(termo) ||
                          t.empresa.toLowerCase().includes(termo) ||
                          (t.unidade && t.unidade.toLowerCase().includes(termo)) ||
                          (t.usuarioResponsavel && t.usuarioResponsavel.toLowerCase().includes(termo));
        const motivoMatch = !filtroMotivo || t.motivoPendencia.includes(filtroMotivo);

        return catMatch && subAbaMatch && textMatch && motivoMatch;
    });

    const totalItens = filtradas.length;
    const totalPaginas = Math.ceil(totalItens / ITENS_POR_PAGINA) || 1;

    if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;
    if (paginaAtual < 1) paginaAtual = 1;

    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
    const fim = inicio + ITENS_POR_PAGINA;
    const itensPagina = filtradas.slice(inicio, fim);

    tbody.innerHTML = '';

    if (totalItens === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">Nenhuma tratativa encontrada nesta categoria.</td></tr>`;
        atualizarControlesPaginacao(1);
        return;
    }

    itensPagina.forEach(item => {
        const tr = document.createElement('tr');
        if (item.resolvida) tr.classList.add('row-resolvida');

        const classeMotivo = obterClasseMotivo(item.motivoPendencia);
        let botoesAcaoHtml = '';

        if (item.resolvida) {
            botoesAcaoHtml = `
                <button type="button" class="btn-action-tbl btn-excluir" onclick="excluirTratativa('${item.id}')" title="Excluir Definitivamente"><i class="fa-solid fa-trash"></i></button>
            `;
        } else {
            let btnFinalizarHtml = '';
            if (subAbaAtual === 'nao_calculada') {
                btnFinalizarHtml = `<button type="button" class="btn-action-tbl btn-finalizar-laranja" onclick="abrirModalMigrarCalculada('${item.id}')" title="Migrar para Nota Calculada"><i class="fa-solid fa-check"></i></button>`;
            } else {
                btnFinalizarHtml = `<button type="button" class="btn-action-tbl btn-finalizar" onclick="abrirModalFinalizar('${item.id}')" title="Finalizar Tratativa"><i class="fa-solid fa-check"></i></button>`;
            }

            botoesAcaoHtml = `
                ${btnFinalizarHtml}
                <button type="button" class="btn-action-tbl btn-estornar" onclick="abrirModalEstorno('${item.id}')" title="Estornar para Entrada NF"><i class="fa-solid fa-rotate-left"></i></button>
                <button type="button" class="btn-action-tbl btn-editar" onclick="abrirModalEditarTratativa('${item.id}')" title="Editar Tratativa"><i class="fa-solid fa-pen"></i></button>
            `;
        }

        tr.innerHTML = `
            <td><strong>${item.numeroNf}</strong></td>
            <td>${item.empresa}</td>
            <td><strong>${item.vencimentoBoleto}</strong></td>
            <td><span class="tag-motivo ${classeMotivo}"><i class="fa-solid ${item.resolvida ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i> ${item.motivoPendencia}</span></td>
            <td><button type="button" class="btn-ver-mais" onclick="abrirDetalhesTratativa('${item.id}')">Ver mais</button></td>
            <td class="text-center">
                <div class="action-buttons-group">
                    ${botoesAcaoHtml}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    atualizarControlesPaginacao(totalPaginas);
}

function atualizarControlesPaginacao(totalPaginas) {
    const btnPrev = document.getElementById('btnPagPrev');
    const btnNext = document.getElementById('btnPagNext');
    const numbersContainer = document.getElementById('pagNumbers');

    if (btnPrev) btnPrev.disabled = paginaAtual <= 1;
    if (btnNext) btnNext.disabled = paginaAtual >= totalPaginas;

    if (numbersContainer) {
        numbersContainer.innerText = `${paginaAtual}/${totalPaginas}`;
    }
}

function mudarPagina(delta) {
    paginaAtual += delta;
    renderizarTabelaTratativas();
}

function abrirModalEditarTratativa(idTratativa) {
    const item = tratativasSalvas.find(t => String(t.id) === String(idTratativa));
    if (!item) return;

    document.getElementById('editTratativaId').value = item.id;
    document.getElementById('editVencimento').value = item.vencimentoBoletoRaw || '';
    document.getElementById('editUnidade').value = item.unidade || '';
    document.getElementById('editObservacao').value = item.observacao || '';

    const selMotivo = document.getElementById('editMotivo');
    selMotivo.innerHTML = motivosCadastrados.map(m => `<option value="${m}" ${item.motivoPendencia === m ? 'selected' : ''}>${m}</option>`).join('');
    selMotivo.innerHTML += `<option value="PENDÊNCIA RESOLVIDA" ${item.motivoPendencia === 'PENDÊNCIA RESOLVIDA' ? 'selected' : ''}>PENDÊNCIA RESOLVIDA</option>`;

    const selUsuario = document.getElementById('editUsuario');
    selUsuario.innerHTML = usuariosCadastrados.map(u => `<option value="${u}" ${(item.usuarioResponsavel || '').toLowerCase() === u.toLowerCase() ? 'selected' : ''}>${u.toUpperCase()}</option>`).join('');

    document.getElementById('modalEditarTratativa').style.display = 'flex';
}

function fecharModalEditarTratativa() {
    document.getElementById('modalEditarTratativa').style.display = 'none';
}

function salvarModalEdicaoTratativa() {
    const idTratativa = document.getElementById('editTratativaId').value;
    const idx = tratativasSalvas.findIndex(t => String(t.id) === String(idTratativa));
    if (idx === -1) return;

    const novoVenc = document.getElementById('editVencimento').value;
    const novoMotivo = document.getElementById('editMotivo').value;
    const novoUsuario = document.getElementById('editUsuario').value;
    const novaUnidade = document.getElementById('editUnidade').value.trim() || '-';
    const novaObs = document.getElementById('editObservacao').value.trim() || 'Sem observação';

    tratativasSalvas[idx].vencimentoBoletoRaw = novoVenc;
    tratativasSalvas[idx].vencimentoBoleto = novoVenc ? formatarDataExibicao(novoVenc) : '-';
    tratativasSalvas[idx].motivoPendencia = novoMotivo;
    tratativasSalvas[idx].usuarioResponsavel = novoUsuario;
    tratativasSalvas[idx].unidade = novaUnidade;
    tratativasSalvas[idx].observacao = novaObs;

    if (novoMotivo === 'PENDÊNCIA RESOLVIDA') {
        tratativasSalvas[idx].resolvida = true;
        if (!tratativasSalvas[idx].dataHoraResolvida) {
            tratativasSalvas[idx].dataHoraResolvida = obterDataHoraAtualFormatada();
        }
    }

    localStorage.setItem('opm_tratativas_salvas', JSON.stringify(tratativasSalvas));

    if (typeof window.syncWithFirebaseGeral === "function") {
        window.tratativasSalvas = tratativasSalvas;
        window.syncWithFirebaseGeral();
    }

    fecharModalEditarTratativa();
    mostrarToast("Tratativa atualizada com sucesso!");
    renderizarTabelaTratativas();
}

function filtrarTratativasTabela() {
    paginaAtual = 1;
    renderizarTabelaTratativas();
}

function abrirDetalhesTratativa(idTratativa) {
    const item = tratativasSalvas.find(t => String(t.id) === String(idTratativa));
    if (!item) return;

    const rotuloUsuario = item.resolvida ? 'Finalizado por' : 'Usuário Responsável';

    let dataHoraResolvidaExibicao = item.dataHoraResolvida;
    if (item.resolvida && !dataHoraResolvidaExibicao) {
        dataHoraResolvidaExibicao = item.dataHoraCriacao || obterDataHoraAtualFormatada();
    }

    const content = document.getElementById('modalDetalhesContent');
    content.innerHTML = `
        <div class="modal-info-row"><strong>Nº NF:</strong> ${item.numeroNf}</div>
        <div class="modal-info-row"><strong>Empresa:</strong> ${item.empresa}</div>
        <div class="modal-info-row"><strong>Unidade:</strong> ${item.unidade || '-'}</div>
        <div class="modal-info-row"><strong>${rotuloUsuario}:</strong> ${item.usuarioResponsavel ? item.usuarioResponsavel.toUpperCase() : '-'}</div>
        <div class="modal-info-row"><strong>Vencimento Boleto:</strong> ${item.vencimentoBoleto}</div>
        <div class="modal-info-row"><strong>Motivo Pendência:</strong> ${item.motivoPendencia}</div>
        
        ${item.resolvida ? `<div class="modal-info-row"><strong>Finalizado em:</strong> ${dataHoraResolvidaExibicao}</div>` : ''}

        <div class="modal-info-row" style="margin-top: 14px;">
            <strong>Observação:</strong>
            <p style="background: #FAFAFA; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--card-border); margin-top: 4px; font-size: 0.88rem;">${item.observacao}</p>
        </div>

        <div class="modal-info-row" style="margin-top: 14px; font-size: 0.78rem; color: var(--text-muted); border-top: 1px solid #E5E7EB; padding-top: 8px;">
            <i class="fa-solid fa-clock"></i> Cadastrado em: ${item.dataHoraCriacao || '-'}
        </div>
    `;

    document.getElementById('modalDetalhesTratativa').style.display = 'flex';
}

function fecharModalDetalhes() {
    document.getElementById('modalDetalhesTratativa').style.display = 'none';
}

function abrirModalMigrarCalculada(idTratativa) {
    idTratativaParaMigrar = idTratativa;
    const item = tratativasSalvas.find(t => String(t.id) === String(idTratativa));
    if (!item) return;

    const elTexto = document.getElementById('textoMigrarCalculada');
    if (elTexto) {
        elTexto.innerHTML = `A nota <strong>Nº ${item.numeroNf}</strong> foi calculada?<br>Deseja migrá-la para a aba de <strong>NOTA CALCULADA</strong>?`;
    }

    document.getElementById('modalMigrarCalculada').style.display = 'flex';
}

function fecharModalMigrarCalculada() {
    idTratativaParaMigrar = null;
    document.getElementById('modalMigrarCalculada').style.display = 'none';
}

function confirmarMigracaoCalculada() {
    const idx = tratativasSalvas.findIndex(t => String(t.id) === String(idTratativaParaMigrar));
    if (idx === -1) return;

    tratativasSalvas[idx].calculada = true;

    localStorage.setItem('opm_tratativas_salvas', JSON.stringify(tratativasSalvas));

    if (typeof window.syncWithFirebaseGeral === "function") {
        window.tratativasSalvas = tratativasSalvas;
        window.syncWithFirebaseGeral();
    }

    fecharModalMigrarCalculada();
    mostrarToast("Nota migrada para NOTA CALCULADA com sucesso!");
    renderizarTabelaTratativas();
}

function abrirModalFinalizar(idTratativa) {
    idTratativaParaFinalizar = idTratativa;
    const item = tratativasSalvas.find(t => String(t.id) === String(idTratativa));
    if (!item) return;

    const textoConfirmacao = document.getElementById('textoConfirmacaoFinalizar');
    if (textoConfirmacao) {
        textoConfirmacao.innerHTML = `A pendência referente à nota <strong>Nº ${item.numeroNf}</strong> foi resolvida?`;
    }

    document.getElementById('modalFinalizar').style.display = 'flex';
}

function fecharModalFinalizar() {
    idTratativaParaFinalizar = null;
    document.getElementById('modalFinalizar').style.display = 'none';
}

function confirmarResolucaoPendencia() {
    const idx = tratativasSalvas.findIndex(t => String(t.id) === String(idTratativaParaFinalizar));
    if (idx === -1) return;

    const dataHoraAtual = obterDataHoraAtualFormatada();

    tratativasSalvas[idx].resolvida = true;
    tratativasSalvas[idx].motivoPendencia = 'PENDÊNCIA RESOLVIDA';
    tratativasSalvas[idx].dataHoraResolvida = dataHoraAtual;

    localStorage.setItem('opm_tratativas_salvas', JSON.stringify(tratativasSalvas));

    if (typeof window.syncWithFirebaseGeral === "function") {
        window.tratativasSalvas = tratativasSalvas;
        window.syncWithFirebaseGeral();
    }

    fecharModalFinalizar();
    mostrarToast("Pendência marcada como resolvida!");
    renderizarTabelaTratativas();
}

function excluirTratativa(idTratativa) {
    if (confirm("Tem certeza que deseja excluir esta tratativa permanentemente?")) {
        tratativasSalvas = tratativasSalvas.filter(t => String(t.id) !== String(idTratativa));
        localStorage.setItem('opm_tratativas_salvas', JSON.stringify(tratativasSalvas));

        if (typeof window.syncWithFirebaseGeral === "function") {
            window.tratativasSalvas = tratativasSalvas;
            window.syncWithFirebaseGeral();
        }

        mostrarToast("Tratativa excluída!");
        renderizarTabelaTratativas();
    }
}

function abrirModalEstorno(idTratativa) {
    idTratativaParaEstornar = idTratativa;
    document.getElementById('motivoEstornoTexto').value = '';
    document.getElementById('modalEstorno').style.display = 'flex';
}

function fecharModalEstorno() {
    idTratativaParaEstornar = null;
    document.getElementById('modalEstorno').style.display = 'none';
}

function confirmarEstornoNota() {
    const motivoTexto = document.getElementById('motivoEstornoTexto').value.trim();

    if (!motivoTexto) {
        alert("O motivo do estorno é obrigatório.");
        return;
    }

    const indexTratativa = tratativasSalvas.findIndex(t => String(t.id) === String(idTratativaParaEstornar));
    if (indexTratativa === -1) return;

    const tratativa = tratativasSalvas[indexTratativa];

    let notaDevolvida = tratativa.notaOriginal || {
        id: Date.now(),
        categoria: tratativa.categoria,
        numeroNf: tratativa.numeroNf,
        empresa: tratativa.empresa,
        unidade: tratativa.unidade,
        urgente: 'Não',
        observacoes: tratativa.observacao
    };

    notaDevolvida.estornada = true;
    notaDevolvida.motivoEstorno = motivoTexto;
    notaDevolvida.dataHoraEstorno = new Date().toLocaleString('pt-BR');

    notasEntrada.unshift(notaDevolvida);
    tratativasSalvas.splice(indexTratativa, 1);

    localStorage.setItem('opm_notas_entrada', JSON.stringify(notasEntrada));
    localStorage.setItem('opm_tratativas_salvas', JSON.stringify(tratativasSalvas));

    if (typeof window.syncWithFirebaseGeral === "function") {
        window.pendingNFs = notasEntrada;
        window.tratativasSalvas = tratativasSalvas;
        window.syncWithFirebaseGeral();
    }

    fecharModalEstorno();
    mostrarToast("Nota estornada com sucesso para Entrada NF!");
    carregarOpcoesDropdownNotas();
    renderizarTabelaTratativas();
}

function abrirModalRelatorioOpcoes() {
    document.getElementById('modalRelatorioOpcoes').style.display = 'flex';
}

function fecharModalRelatorioOpcoes() {
    document.getElementById('modalRelatorioOpcoes').style.display = 'none';
}

function gerarRelatorioEspecifico(modoResolvido) {
    relatorioModoResolvido = modoResolvido;
    fecharModalRelatorioOpcoes();

    const reportNomeAba = document.getElementById('reportNomeAba');
    if (reportNomeAba) reportNomeAba.innerText = abaAtual === 'antenor' ? 'ANTENOR DUARTE' : 'FILIAIS';

    const tratativasFiltradas = tratativasSalvas.filter(t => 
        (t.categoria || 'antenor') === abaAtual && 
        (t.calculada !== undefined ? t.calculada : true) &&
        (modoResolvido ? t.resolvida : !t.resolvida)
    );

    renderizarTabelaRelatorio(tratativasFiltradas);

    const agora = new Date();
    document.getElementById('reportTimestamp').innerText = `Gerado em: ${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;
    document.getElementById('modalRelatorio').style.display = 'flex';
}

function fecharModalRelatorio() {
    document.getElementById('modalRelatorio').style.display = 'none';
}

function renderizarTabelaRelatorio(lista) {
    const thead = document.getElementById('reportTableHead');
    const tbody = document.getElementById('reportTableBody');
    if (!tbody || !thead) return;

    if (relatorioModoResolvido) {
        thead.innerHTML = `
            <tr>
                <th style="width: 40px; text-align: center;">Incluir</th>
                <th>Nº NF</th>
                <th>Empresa</th>
                <th>Unidade</th>
                <th>Usuário</th>
                <th>Pendência</th>
                <th>Finalizado</th>
            </tr>
        `;
    } else {
        thead.innerHTML = `
            <tr>
                <th style="width: 40px; text-align: center;">Incluir</th>
                <th>Nº NF</th>
                <th>Empresa</th>
                <th>Unidade</th>
                <th>Usuário</th>
                <th>Motivo Pendência</th>
                <th>Venc. Boleto</th>
                <th>Observação</th>
            </tr>
        `;
    }

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 15px;">Nenhuma tratativa registrada para este relatório.</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    lista.forEach((item) => {
        const tr = document.createElement('tr');
        if (relatorioModoResolvido) {
            let dataResolvidoExibir = item.dataHoraResolvida;
            if (!dataResolvidoExibir) {
                dataResolvidoExibir = item.dataHoraCriacao || obterDataHoraAtualFormatada();
            }

            tr.innerHTML = `
                <td style="text-align: center;"><input type="checkbox" class="report-row-check" value="${item.id}" checked></td>
                <td><strong>${item.numeroNf}</strong></td>
                <td>${item.empresa}</td>
                <td>${item.unidade || '-'}</td>
                <td>${(item.usuarioResponsavel || '-').toUpperCase()}</td>
                <td>${item.motivoPendencia}</td>
                <td>${dataResolvidoExibir}</td>
            `;
        } else {
            tr.innerHTML = `
                <td style="text-align: center;"><input type="checkbox" class="report-row-check" value="${item.id}" checked></td>
                <td><strong>${item.numeroNf}</strong></td>
                <td>${item.empresa}</td>
                <td>${item.unidade || '-'}</td>
                <td>${(item.usuarioResponsavel || '-').toUpperCase()}</td>
                <td>${item.motivoPendencia}</td>
                <td>${item.vencimentoBoleto}</td>
                <td>${item.observacao || '-'}</td>
            `;
        }
        tbody.appendChild(tr);
    });
}

function toggleMarcarTodasRelatorio(masterCheckbox) {
    const checks = document.querySelectorAll('.report-row-check');
    checks.forEach(chk => chk.checked = masterCheckbox.checked);
}

function gerarVisualizacaoPDFTratativas() {
    const checks = document.querySelectorAll('.report-row-check:checked');
    const idsSelecionados = Array.from(checks).map(c => Number(c.value));

    if (idsSelecionados.length === 0) {
        alert("Selecione ao menos uma tratativa para gerar o PDF.");
        return;
    }

    const tratativasAba = tratativasSalvas.filter(t => (t.categoria || 'antenor') === abaAtual && idsSelecionados.includes(t.id));
    const isFiliais = abaAtual === 'filiais';

    const winPrint = window.open('', '_blank');

    winPrint.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Relatório de Tratativas - OPM</title>
            <style>
                @page {
                    size: A4 portrait;
                    margin: 15mm;
                }
                body { 
                    font-family: 'Plus Jakarta Sans', Arial, sans-serif; 
                    padding: 20px; 
                    color: #2D3748; 
                    background-color: #ffffff;
                }
                h2 { text-align: center; font-size: 1.25rem; color: #035AA6; margin-bottom: 6px; }
                .timestamp { text-align: center; font-size: 0.85rem; color: #718096; margin-bottom: 25px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th, td { border: 1px solid #CBD5E0; padding: 10px 12px; font-size: 0.85rem; text-align: left; }
                th { 
                    background-color: #D9D2BF !important; 
                    color: #035AA6 !important; 
                    font-weight: 700;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
            </style>
        </head>
        <body>
            <h2>CENTRAL DE NOTAS - RELATÓRIO DE TRATATIVAS (${isFiliais ? 'FILIAIS' : 'ANTENOR DUARTE'})</h2>
            <div class="timestamp">Gerado em: ${new Date().toLocaleString('pt-BR')}</div>
            <table>
                <thead>
                    ${relatorioModoResolvido ? `
                        <tr>
                            <th>Nº NF</th>
                            <th>Empresa</th>
                            <th>Unidade</th>
                            <th>Usuário</th>
                            <th>Pendência</th>
                            <th>Finalizado</th>
                        </tr>
                    ` : `
                        <tr>
                            <th>Nº NF</th>
                            <th>Empresa</th>
                            <th>Unidade</th>
                            <th>Usuário</th>
                            <th>Motivo Pendência</th>
                            <th>Venc. Boleto</th>
                            <th>Observação</th>
                        </tr>
                    `}
                </thead>
                <tbody>
                    ${tratativasAba.map(t => relatorioModoResolvido ? `
                        <tr>
                            <td><strong>${t.numeroNf}</strong></td>
                            <td>${t.empresa}</td>
                            <td>${t.unidade || '-'}</td>
                            <td>${(t.usuarioResponsavel || '-').toUpperCase()}</td>
                            <td>${t.motivoPendencia}</td>
                            <td>${t.dataHoraResolvida || t.dataHoraCriacao || '-'}</td>
                        </tr>
                    ` : `
                        <tr>
                            <td><strong>${t.numeroNf}</strong></td>
                            <td>${t.empresa}</td>
                            <td>${t.unidade || '-'}</td>
                            <td>${(t.usuarioResponsavel || '-').toUpperCase()}</td>
                            <td>${t.motivoPendencia}</td>
                            <td>${t.vencimentoBoleto}</td>
                            <td>${t.observacao || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </body>
        </html>
    `);

    winPrint.document.close();
}

function formatarDataExibicao(dataIso) {
    if (!dataIso) return '-';
    const partes = dataIso.split('-');
    if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
    return dataIso;
}

function mostrarToast(msg) {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;
    const msgSpan = document.getElementById('toast-msg');
    if (msgSpan) msgSpan.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 3500);
}