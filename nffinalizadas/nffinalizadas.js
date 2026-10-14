let notasFinalizadasLocais = JSON.parse(localStorage.getItem('opm_notas_finalizadas_local')) || [];
let abaAtual = 'antenor';
let paginaAtual = 1;
const itensPorPagina = 10;
let notaSelecionadaCache = null;
let idNotaParaEstorno = null;

document.addEventListener('DOMContentLoaded', () => {
    forcarResetContador45DiasHoje();

    carregarOpcoesNfPendentes();
    renderUserSelectOptions();
    renderTipoListItems();
    renderEstoqueListItems();
    renderizarTabelaPaginada();
    iniciarCronometro45Dias();

    document.addEventListener('click', (e) => {
        const containers = document.querySelectorAll('.custom-dropdown-container');
        containers.forEach(container => {
            if (!container.contains(e.target)) {
                const menu = container.querySelector('.custom-dropdown-menu');
                const trigger = container.querySelector('.custom-select-trigger');
                if (menu) menu.classList.remove('show');
                if (trigger) trigger.classList.remove('active');
            }
        });
    });
});

function forcarResetContador45DiasHoje() {
    const chaveControle = 'opm_reset_45d_iniciado_v2';
    const jaReiniciouHoje = localStorage.getItem(chaveControle);

    if (!jaReiniciouHoje) {
        const novoTarget = Date.now() + (45 * 24 * 60 * 60 * 1000);
        window.reset61DaysTs = novoTarget;
        localStorage.setItem('opm_reset_61d_ts', novoTarget);
        localStorage.setItem(chaveControle, 'true');
        
        if (typeof window.syncWithFirebase === "function") {
            window.syncWithFirebase();
        }
    }
}

function toggleCamuflados() {
    const details = document.getElementById('collapsibleDetails');
    const header = document.querySelector('.collapsible-header');
    if (details) {
        const estaVisivel = details.style.display !== 'none';
        details.style.display = estaVisivel ? 'none' : 'block';
        if (header) header.classList.toggle('active', !estaVisivel);
    }
}

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

    const formSectionTitle = document.getElementById('formSectionTitle');
    if (formSectionTitle) {
        formSectionTitle.innerText = `CONTROLE DE NOTAS - FINALIZADAS (${abaAtual === 'antenor' ? 'ANTENOR DUARTE' : 'FILIAIS'})`;
    }

    const tabelaAbaTitulo = document.getElementById('tabelaAbaTitulo');
    if (tabelaAbaTitulo) {
        tabelaAbaTitulo.innerText = `Notas Cadastradas — ${abaAtual === 'antenor' ? 'ANTENOR DUARTE' : 'FILIAIS'}`;
    }

    resetarFormulario();
    carregarOpcoesNfPendentes();
    filtrarNotasTabela();
}

window.verificarResetAutomatico45Dias = function() {
    const agora = Date.now();
    let targetTs = window.reset61DaysTs || Number(localStorage.getItem('opm_reset_61d_ts'));

    if (!targetTs || agora >= targetTs) {
        targetTs = agora + (45 * 24 * 60 * 60 * 1000);
        window.reset61DaysTs = targetTs;
        localStorage.setItem('opm_reset_61d_ts', targetTs);

        notasFinalizadasLocais = [];
        localStorage.setItem('opm_notas_finalizadas_local', JSON.stringify([]));
        localStorage.setItem('opm_notas_finalizadas', JSON.stringify([]));
        if (window.gestaoFinalizadasNFs) window.gestaoFinalizadasNFs = [];

        if (typeof window.syncWithFirebase === "function") {
            window.syncWithFirebase();
        }
        renderizarTabelaPaginada();
    }
};

function iniciarCronometro45Dias() {
    setInterval(() => {
        window.verificarResetAutomatico45Dias();
        const agora = Date.now();
        const targetTs = window.reset61DaysTs || Number(localStorage.getItem('opm_reset_61d_ts')) || (agora + (45 * 24 * 60 * 60 * 1000));
        const dif = Math.max(0, targetTs - agora);

        const dias = Math.floor(dif / (1000 * 60 * 60 * 24));
        const horas = Math.floor((dif % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutos = Math.floor((dif % (1000 * 60 * 60)) / (1000 * 60));

        const timerEl = document.getElementById('timerText');
        if (timerEl) {
            timerEl.innerText = `${dias}d ${String(horas).padStart(2, '0')}h ${String(minutos).padStart(2, '0')}m`;
        }
    }, 1000);
}

function toggleNfDropdown() {
    const menu = document.getElementById('nfDropdownMenu');
    const trigger = document.getElementById('nfSelectTrigger');
    if (menu) menu.classList.toggle('show');
    if (trigger) trigger.classList.toggle('active');
}

function obterNotasPendentesAbaAtual() {
    const pendentes = window.pendingNFs || JSON.parse(localStorage.getItem('opm_notas_entrada')) || [];
    return pendentes.filter(n => (n.categoria || n.unidade || 'antenor').toLowerCase().includes(abaAtual));
}

window.carregarOpcoesNfPendentes = function() {
    renderListItemsDropdownNF(obterNotasPendentesAbaAtual());
};

function renderListItemsDropdownNF(lista) {
    const listContainer = document.getElementById('nfListItems');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    if (lista.length === 0) {
        listContainer.innerHTML = `<div class="dropdown-item-row" style="color: var(--text-muted);">Nenhuma NF pendente nesta aba</div>`;
    } else {
        lista.forEach(nota => {
            const item = document.createElement('div');
            item.className = 'dropdown-item-row';
            item.innerText = `NF: ${nota.numeroNf || nota.nf} - Empresa: ${nota.empresa || nota.fornecedor}`;
            item.onclick = () => selecionarNotaPendenteDropdown(nota.id || nota.numeroNf);
            listContainer.appendChild(item);
        });
    }
}

function filtrarDropdownNF(termo) {
    const pendentesAba = obterNotasPendentesAbaAtual();
    const filtradas = pendentesAba.filter(n => 
        String(n.numeroNf || n.nf || '').toLowerCase().includes(termo.toLowerCase()) || 
        String(n.empresa || n.fornecedor || '').toLowerCase().includes(termo.toLowerCase())
    );
    renderListItemsDropdownNF(filtradas);
}

function selecionarNotaPendenteDropdown(idNota) {
    const pendentes = window.pendingNFs || JSON.parse(localStorage.getItem('opm_notas_entrada')) || [];
    const nota = pendentes.find(n => String(n.id) === String(idNota) || String(n.numeroNf) === String(idNota));

    if (nota) {
        notaSelecionadaCache = nota;
        
        document.getElementById('selectNumeroNf').value = nota.id || nota.numeroNf;
        document.getElementById('selectedNfText').innerText = `NF: ${nota.numeroNf || nota.nf} - ${nota.empresa || nota.fornecedor}`;
        
        document.getElementById('inputNumNfManual').value = nota.numeroNf || nota.nf || '';
        document.getElementById('inputNomeEmpresa').value = nota.empresa || nota.fornecedor || '';

        const valUnid = nota.unidade || '-';
        if (!valUnid || valUnid === '-' || valUnid.toLowerCase() === 'nenhuma') {
            document.getElementById('unidadeReadonlyBox').style.display = 'none';
            document.getElementById('unidadeSelectGroup').style.display = 'flex';
            document.getElementById('selectUnidadeEdit').value = '';
        } else {
            document.getElementById('unidadeReadonlyBox').style.display = 'block';
            document.getElementById('unidadeSelectGroup').style.display = 'none';
            document.getElementById('inputUnidadeReadonly').value = valUnid;
        }

        const valTipo = nota.tipo || 'Nenhuma';
        if (valTipo.toLowerCase() === 'nenhuma' || valTipo === 'INDEFINIDO') {
            document.getElementById('tipoReadonlyBox').style.display = 'none';
            document.getElementById('tipoSelectGroup').style.display = 'block';
            setTipoSelecionado('Nenhuma');
        } else {
            document.getElementById('tipoReadonlyBox').style.display = 'block';
            document.getElementById('tipoSelectGroup').style.display = 'none';
            document.getElementById('inputTipoReadonly').value = valTipo;
            document.getElementById('inputTipoVal').value = valTipo;
        }

        const valEstoque = nota.localEstoque || 'Nenhuma';
        if (valEstoque.toLowerCase() === 'nenhuma' || valEstoque === 'INDEFINIDO') {
            document.getElementById('estoqueReadonlyBox').style.display = 'none';
            document.getElementById('estoqueSelectGroup').style.display = 'block';
            setEstoqueSelecionado('Nenhuma');
        } else {
            document.getElementById('estoqueReadonlyBox').style.display = 'block';
            document.getElementById('estoqueSelectGroup').style.display = 'none';
            document.getElementById('inputEstoqueReadonly').value = valEstoque;
            document.getElementById('inputEstoqueVal').value = valEstoque;
        }

        const valOp = nota.operacao || 'Nenhuma';
        if (valOp.toLowerCase() === 'nenhuma' || valOp === 'INDEFINIDO') {
            document.getElementById('operacaoReadonlyBox').style.display = 'none';
            document.getElementById('operacaoSelectGroup').style.display = 'block';
            document.getElementById('selectOperacaoEdit').value = 'Nenhuma';
        } else {
            document.getElementById('operacaoReadonlyBox').style.display = 'block';
            document.getElementById('operacaoSelectGroup').style.display = 'none';
            document.getElementById('inputOperacaoReadonly').value = valOp;
        }

        document.getElementById('camposComplementares').style.display = 'block';
        document.getElementById('btnCancelarSelecao').style.display = 'inline-flex';
        toggleNfDropdown();
    }
}

function toggleTipoDropdown() {
    const menu = document.getElementById('tipoDropdownMenu');
    const trigger = document.getElementById('tipoSelectTrigger');
    if (menu) menu.classList.toggle('show');
    if (trigger) trigger.classList.toggle('active');
}

window.renderTipoListItems = function() {
    const container = document.getElementById('tipoListItems');
    if (!container) return;

    const lista = window.tiposList || ['DEVOLUÇÃO', 'Nota de Serviço', 'Patrimonio', 'OPME'];
    container.innerHTML = '';

    const optNenhuma = document.createElement('div');
    optNenhuma.className = 'dropdown-item-row';
    optNenhuma.innerHTML = `<span>Nenhuma</span>`;
    optNenhuma.onclick = () => setTipoSelecionado('Nenhuma');
    container.appendChild(optNenhuma);

    lista.forEach(item => {
        const row = document.createElement('div');
        row.className = 'dropdown-item-row';
        row.innerHTML = `
            <span onclick="setTipoSelecionado('${item}')" style="flex: 1;">${item}</span>
            <i class="fa-solid fa-trash btn-delete-option-icon" onclick="excluirOpcaoTipo(event, '${item}')" title="Excluir Tipo"></i>
        `;
        container.appendChild(row);
    });
};

function setTipoSelecionado(val) {
    document.getElementById('inputTipoVal').value = val;
    document.getElementById('selectedTipoText').innerText = val;
    const menu = document.getElementById('tipoDropdownMenu');
    if (menu) menu.classList.remove('show');
    const trigger = document.getElementById('tipoSelectTrigger');
    if (trigger) trigger.classList.remove('active');
}

function filtrarOpcoesTipo(termo) {
    const container = document.getElementById('tipoListItems');
    if (!container) return;

    const lista = window.tiposList || ['DEVOLUÇÃO', 'Nota de Serviço', 'Patrimonio', 'OPME'];
    const termoLower = termo.toLowerCase();

    container.innerHTML = '';

    if ('nenhuma'.includes(termoLower)) {
        const optNenhuma = document.createElement('div');
        optNenhuma.className = 'dropdown-item-row';
        optNenhuma.innerHTML = `<span>Nenhuma</span>`;
        optNenhuma.onclick = () => setTipoSelecionado('Nenhuma');
        container.appendChild(optNenhuma);
    }

    lista.filter(i => i.toLowerCase().includes(termoLower)).forEach(item => {
        const row = document.createElement('div');
        row.className = 'dropdown-item-row';
        row.innerHTML = `
            <span onclick="setTipoSelecionado('${item}')" style="flex: 1;">${item}</span>
            <i class="fa-solid fa-trash btn-delete-option-icon" onclick="excluirOpcaoTipo(event, '${item}')" title="Excluir Tipo"></i>
        `;
        container.appendChild(row);
    });
}

function promptAdicionarNovoTipo() {
    const nov = prompt("Digite o novo Tipo:");
    if (nov && nov.trim() !== "") {
        const valClean = nov.trim();
        if (!window.tiposList) window.tiposList = [];

        if (!window.tiposList.includes(valClean)) {
            window.tiposList.push(valClean);
            renderTipoListItems();
            setTipoSelecionado(valClean);

            if (typeof window.syncWithFirebase === "function") window.syncWithFirebase();
        } else {
            alert("Este tipo já está cadastrado.");
        }
    }
}

function excluirOpcaoTipo(e, item) {
    e.stopPropagation();
    if (confirm(`Deseja excluir a opção "${item}"?`)) {
        window.tiposList = (window.tiposList || []).filter(t => t !== item);
        renderTipoListItems();
        if (document.getElementById('inputTipoVal').value === item) {
            setTipoSelecionado('Nenhuma');
        }
        if (typeof window.syncWithFirebase === "function") window.syncWithFirebase();
    }
}

function toggleEstoqueDropdown() {
    const menu = document.getElementById('estoqueDropdownMenu');
    const trigger = document.getElementById('estoqueSelectTrigger');
    if (menu) menu.classList.toggle('show');
    if (trigger) trigger.classList.toggle('active');
}

window.renderEstoqueListItems = function() {
    const container = document.getElementById('estoqueListItems');
    if (!container) return;

    const lista = window.estoquesList || ['ALMOXARIFADO CENTRAL', 'FARMÁCIA ALMOXARIFADO', 'FARMÁCIA QT ESTOQUE'];
    container.innerHTML = '';

    const optNenhuma = document.createElement('div');
    optNenhuma.className = 'dropdown-item-row';
    optNenhuma.innerHTML = `<span>Nenhuma</span>`;
    optNenhuma.onclick = () => setEstoqueSelecionado('Nenhuma');
    container.appendChild(optNenhuma);

    lista.forEach(item => {
        const row = document.createElement('div');
        row.className = 'dropdown-item-row';
        row.innerHTML = `
            <span onclick="setEstoqueSelecionado('${item}')" style="flex: 1;">${item}</span>
            <i class="fa-solid fa-trash btn-delete-option-icon" onclick="excluirOpcaoEstoque(event, '${item}')" title="Excluir Local"></i>
        `;
        container.appendChild(row);
    });
};

function setEstoqueSelecionado(val) {
    document.getElementById('inputEstoqueVal').value = val;
    document.getElementById('selectedEstoqueText').innerText = val;
    const menu = document.getElementById('estoqueDropdownMenu');
    if (menu) menu.classList.remove('show');
    const trigger = document.getElementById('estoqueSelectTrigger');
    if (trigger) trigger.classList.remove('active');
}

function filtrarOpcoesEstoque(termo) {
    const container = document.getElementById('estoqueListItems');
    if (!container) return;

    const lista = window.estoquesList || ['ALMOXARIFADO CENTRAL', 'FARMÁCIA ALMOXARIFADO', 'FARMÁCIA QT ESTOQUE'];
    const termoLower = termo.toLowerCase();

    container.innerHTML = '';

    if ('nenhuma'.includes(termoLower)) {
        const optNenhuma = document.createElement('div');
        optNenhuma.className = 'dropdown-item-row';
        optNenhuma.innerHTML = `<span>Nenhuma</span>`;
        optNenhuma.onclick = () => setEstoqueSelecionado('Nenhuma');
        container.appendChild(optNenhuma);
    }

    lista.filter(i => i.toLowerCase().includes(termoLower)).forEach(item => {
        const row = document.createElement('div');
        row.className = 'dropdown-item-row';
        row.innerHTML = `
            <span onclick="setEstoqueSelecionado('${item}')" style="flex: 1;">${item}</span>
            <i class="fa-solid fa-trash btn-delete-option-icon" onclick="excluirOpcaoEstoque(event, '${item}')" title="Excluir Local"></i>
        `;
        container.appendChild(row);
    });
}

function promptAdicionarNovoEstoque() {
    const nov = prompt("Digite o novo Local de Estoque:");
    if (nov && nov.trim() !== "") {
        const valClean = nov.trim().toUpperCase();
        if (!window.estoquesList) window.estoquesList = [];

        if (!window.estoquesList.includes(valClean)) {
            window.estoquesList.push(valClean);
            renderEstoqueListItems();
            setEstoqueSelecionado(valClean);

            if (typeof window.syncWithFirebase === "function") window.syncWithFirebase();
        } else {
            alert("Este local já está cadastrado.");
        }
    }
}

function excluirOpcaoEstoque(e, item) {
    e.stopPropagation();
    if (confirm(`Deseja excluir o local "${item}"?`)) {
        window.estoquesList = (window.estoquesList || []).filter(s => s !== item);
        renderEstoqueListItems();
        if (document.getElementById('inputEstoqueVal').value === item) {
            setEstoqueSelecionado('Nenhuma');
        }
        if (typeof window.syncWithFirebase === "function") window.syncWithFirebase();
    }
}

window.renderUserSelectOptions = function() {
    const select = document.getElementById('selectUsuarioResp');
    if (!select) return;

    const userList = window.userList || ['BRUNO', 'GAB', 'CARLOS', 'JOAO'];
    const valAtual = select.value;

    select.innerHTML = '<option value="">Selecione um usuário...</option>';
    userList.forEach(user => {
        const opt = document.createElement('option');
        opt.value = user.toUpperCase();
        opt.text = user.toUpperCase();
        select.appendChild(opt);
    });

    select.value = valAtual;
};

function abrirModalGerenciarUsuarios() {
    renderUsersModalList();
    document.getElementById('inputNovoUsuarioModal').value = '';
    document.getElementById('modalGerenciarUsuarios').style.display = 'flex';
}

function fecharModalGerenciarUsuarios() {
    document.getElementById('modalGerenciarUsuarios').style.display = 'none';
}

function renderUsersModalList() {
    const listContainer = document.getElementById('modalUsersListBox');
    if (!listContainer) return;

    const userList = window.userList || ['BRUNO', 'GAB', 'CARLOS', 'JOAO'];
    listContainer.innerHTML = '';

    if (userList.length === 0) {
        listContainer.innerHTML = `<div class="user-list-row" style="color: var(--text-muted); justify-content: center;">Nenhum usuário cadastrado</div>`;
        return;
    }

    userList.forEach(user => {
        const row = document.createElement('div');
        row.className = 'user-list-row';
        row.innerHTML = `
            <span>${user.toUpperCase()}</span>
            <i class="fa-solid fa-trash btn-delete-user-icon" onclick="excluirUsuarioModal('${user}')" title="Excluir Usuário"></i>
        `;
        listContainer.appendChild(row);
    });
}

function adicionarNovoUsuarioModal() {
    const input = document.getElementById('inputNovoUsuarioModal');
    const nome = input.value.trim().toUpperCase();

    if (!nome) {
        alert("Digite o nome do novo usuário.");
        return;
    }

    if (!window.userList) window.userList = ['BRUNO', 'GAB', 'CARLOS', 'JOAO'];

    if (window.userList.includes(nome)) {
        alert("Este usuário já está cadastrado.");
        return;
    }

    window.userList.push(nome);
    input.value = '';
    renderUsersModalList();
    renderUserSelectOptions();

    document.getElementById('selectUsuarioResp').value = nome;

    if (typeof window.syncWithFirebase === "function") {
        window.syncWithFirebase();
    }
}

function excluirUsuarioModal(nomeUsuario) {
    if (confirm(`Deseja remover o usuário "${nomeUsuario.toUpperCase()}"?`)) {
        window.userList = (window.userList || []).filter(u => u.toUpperCase() !== nomeUsuario.toUpperCase());
        renderUsersModalList();
        renderUserSelectOptions();

        if (typeof window.syncWithFirebase === "function") {
            window.syncWithFirebase();
        }
    }
}

function promptAdicionarUnidade() {
    const nov = prompt("Digite a nova Unidade:");
    if (nov && nov.trim() !== "") {
        const sel = document.getElementById('selectUnidadeEdit');
        const opt = document.createElement('option');
        opt.value = nov.trim().toUpperCase();
        opt.text = nov.trim().toUpperCase();
        sel.appendChild(opt);
        sel.value = opt.value;
    }
}

function handleFormSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    if (!notaSelecionadaCache) {
        alert("Por favor, selecione uma nota fiscal.");
        return;
    }

    const numNfVal = notaSelecionadaCache.numeroNf || notaSelecionadaCache.nf;
    const empresaVal = notaSelecionadaCache.empresa || notaSelecionadaCache.fornecedor;

    const isUnidEdit = document.getElementById('unidadeSelectGroup').style.display !== 'none';
    const unidadeVal = isUnidEdit ? (document.getElementById('selectUnidadeEdit').value || '-') : document.getElementById('inputUnidadeReadonly').value;

    const isTipoEdit = document.getElementById('tipoSelectGroup').style.display !== 'none';
    const tipoVal = isTipoEdit ? document.getElementById('inputTipoVal').value : document.getElementById('inputTipoReadonly').value;

    const isEstoqueEdit = document.getElementById('estoqueSelectGroup').style.display !== 'none';
    const localEstoqueVal = isEstoqueEdit ? document.getElementById('inputEstoqueVal').value : document.getElementById('inputEstoqueReadonly').value;

    const isOpEdit = document.getElementById('operacaoSelectGroup').style.display !== 'none';
    const operacaoVal = isOpEdit ? (document.getElementById('selectOperacaoEdit').value || 'Nenhuma') : document.getElementById('inputOperacaoReadonly').value;

    const usuarioResp = document.getElementById('selectUsuarioResp').value.trim();
    if (!usuarioResp) {
        alert("Por favor, selecione quem está finalizando esta nota (FINALIZADO POR).");
        return;
    }

    const agora = new Date();
    const dataHoraFormatada = `${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;

    const novaFinalizada = {
        id: Date.now(),
        categoria: abaAtual,
        numeroNf: numNfVal,
        nf: numNfVal,
        empresa: empresaVal,
        fornecedor: empresaVal,
        unidade: unidadeVal,
        finalizadoPor: usuarioResp.toUpperCase(),
        tipo: tipoVal || 'Nenhuma',
        localEstoque: localEstoqueVal || 'Nenhuma',
        operacao: operacaoVal || 'Nenhuma',
        dataHora: dataHoraFormatada
    };

    notasFinalizadasLocais.push(novaFinalizada);
    
    localStorage.setItem('opm_notas_finalizadas_local', JSON.stringify(notasFinalizadasLocais));
    localStorage.setItem('opm_notas_finalizadas', JSON.stringify(notasFinalizadasLocais));

    window.gestaoFinalizadasNFs = notasFinalizadasLocais;
    window.finishedNFs = notasFinalizadasLocais;

    if (notaSelecionadaCache) {
        let pendentes = JSON.parse(localStorage.getItem('opm_notas_entrada')) || window.pendingNFs || [];
        pendentes = pendentes.filter(n => String(n.id) !== String(notaSelecionadaCache.id) && String(n.numeroNf) !== String(numNfVal));
        window.pendingNFs = pendentes;
        localStorage.setItem('opm_notas_entrada', JSON.stringify(pendentes));
    }

    if (typeof window.syncWithFirebase === "function") {
        window.syncWithFirebase();
    }

    mostrarNotificacaoToast("Nota finalizada com sucesso!");
    resetarFormulario();
    renderizarTabelaPaginada();
}

function resetarFormulario() {
    const form = document.getElementById('cdnf-finalizadas-form');
    if (form) form.reset();
    document.getElementById('camposComplementares').style.display = 'none';
    document.getElementById('btnCancelarSelecao').style.display = 'none';
    document.getElementById('selectNumeroNf').value = '';
    document.getElementById('selectedNfText').innerText = '-- Selecione uma NF pendente --';
    document.getElementById('selectUsuarioResp').value = '';

    setTipoSelecionado('Nenhuma');
    setEstoqueSelecionado('Nenhuma');
    
    const details = document.getElementById('collapsibleDetails');
    const header = document.querySelector('.collapsible-header');
    if (details) details.style.display = 'none';
    if (header) header.classList.remove('active');

    notaSelecionadaCache = null;
    carregarOpcoesNfPendentes();
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

function filtrarNotasTabela() {
    paginaAtual = 1;
    renderizarTabelaPaginada();
}

function renderizarTabelaPaginada() {
    const tbody = document.getElementById('tabelaFinalizadasBody');
    if (!tbody) return;

    const termo = (document.getElementById('searchInput')?.value || '').toLowerCase();

    const filtradas = notasFinalizadasLocais.filter(nota => {
        const catMatch = (nota.categoria || 'antenor') === abaAtual;
        const textMatch = (nota.numeroNf || '').toLowerCase().includes(termo) || 
                          (nota.empresa || '').toLowerCase().includes(termo) ||
                          (nota.unidade && nota.unidade.toLowerCase().includes(termo)) ||
                          (nota.finalizadoPor || '').toLowerCase().includes(termo);
        return catMatch && textMatch;
    });

    const totalRegistros = filtradas.length;
    const totalPaginas = Math.ceil(totalRegistros / itensPorPagina) || 1;

    if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;
    if (paginaAtual < 1) paginaAtual = 1;

    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const paginadas = filtradas.slice(inicio, fim);

    const contagemChaves = {};
    notasFinalizadasLocais.forEach(n => {
        if ((n.categoria || 'antenor') === abaAtual) {
            const key = `${(n.numeroNf || '').toLowerCase()}_${(n.empresa || '').toLowerCase()}`;
            contagemChaves[key] = (contagemChaves[key] || 0) + 1;
        }
    });

    tbody.innerHTML = '';
    if (paginadas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">Nenhuma nota finalizada registrada nesta aba.</td></tr>`;
    } else {
        paginadas.forEach(nota => {
            const key = `${(nota.numeroNf || '').toLowerCase()}_${(nota.empresa || '').toLowerCase()}`;
            const ehRepetida = contagemChaves[key] > 1;
            const estiloTextoVermelho = ehRepetida ? 'style="color: #DC2626; font-weight: 800;"' : '';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td ${estiloTextoVermelho}><strong>${nota.numeroNf || nota.nf}</strong></td>
                <td ${estiloTextoVermelho}>${nota.empresa || nota.fornecedor}</td>
                <td ${estiloTextoVermelho}>${nota.unidade || '-'}</td>
                <td><strong>${nota.finalizadoPor}</strong></td>
                <td><button type="button" class="btn-ver-mais" onclick="abrirDetalhesNota('${nota.id}')">Ver mais</button></td>
                <td class="text-center">
                    <div class="action-buttons-group">
                        <button type="button" class="btn-action-tbl btn-estornar" onclick="abrirModalEstorno('${nota.id}')" title="Estornar para EntradaNF"><i class="fa-solid fa-rotate-left"></i></button>
                        <button type="button" class="btn-action-tbl btn-excluir" onclick="excluirNotaFinalizada('${nota.id}')" title="Excluir Nota"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </td>
            `;
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

function mudarPagina(direcao) {
    paginaAtual += direcao;
    renderizarTabelaPaginada();
}

function excluirNotaFinalizada(idNota) {
    if (confirm("Tem certeza que deseja excluir esta nota definitivamente?")) {
        notasFinalizadasLocais = notasFinalizadasLocais.filter(n => String(n.id) !== String(idNota));
        localStorage.setItem('opm_notas_finalizadas_local', JSON.stringify(notasFinalizadasLocais));
        localStorage.setItem('opm_notas_finalizadas', JSON.stringify(notasFinalizadasLocais));
        window.gestaoFinalizadasNFs = notasFinalizadasLocais;

        if (typeof window.syncWithFirebase === "function") {
            window.syncWithFirebase();
        }

        mostrarNotificacaoToast("Nota excluída com sucesso!");
        renderizarTabelaPaginada();
    }
}

function abrirModalEstorno(idNota) {
    idNotaParaEstorno = idNota;
    document.getElementById('inputMotivoEstorno').value = '';
    document.getElementById('modalEstorno').style.display = 'flex';
}

function fecharModalEstorno() {
    idNotaParaEstorno = null;
    document.getElementById('modalEstorno').style.display = 'none';
}

function confirmarEstornoModal() {
    if (!idNotaParaEstorno) return;

    const motivo = document.getElementById('inputMotivoEstorno').value.trim();
    if (!motivo) {
        alert("Por favor, informe o motivo do estorno.");
        return;
    }

    const nota = notasFinalizadasLocais.find(n => String(n.id) === String(idNotaParaEstorno));
    if (!nota) return;

    const agora = new Date();
    const dataHoraEstorno = `${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;

    notasFinalizadasLocais = notasFinalizadasLocais.filter(n => String(n.id) !== String(idNotaParaEstorno));
    localStorage.setItem('opm_notas_finalizadas_local', JSON.stringify(notasFinalizadasLocais));
    localStorage.setItem('opm_notas_finalizadas', JSON.stringify(notasFinalizadasLocais));
    window.gestaoFinalizadasNFs = notasFinalizadasLocais;

    let pendentes = JSON.parse(localStorage.getItem('opm_notas_entrada')) || window.pendingNFs || [];
    pendentes.push({
        id: Date.now(),
        categoria: nota.categoria || abaAtual,
        numeroNf: nota.numeroNf || nota.nf,
        empresa: nota.empresa || nota.fornecedor,
        unidade: nota.unidade || '-',
        tipo: nota.tipo || 'Nenhuma',
        localEstoque: nota.localEstoque || 'Nenhuma',
        operacao: nota.operacao || 'Nenhuma',
        urgente: 'Não',
        observacoes: 'Nenhuma observação',
        estornada: true,
        dataHoraEstorno: dataHoraEstorno,
        motivoEstorno: motivo,
        dataHora: `${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`
    });

    window.pendingNFs = pendentes;
    localStorage.setItem('opm_notas_entrada', JSON.stringify(pendentes));

    if (typeof window.syncWithFirebase === "function") {
        window.syncWithFirebase();
    }

    fecharModalEstorno();
    mostrarNotificacaoToast("Nota estornada com sucesso para Entrada NF!");
    filtrarNotasTabela();
}

function abrirDetalhesNota(idNota) {
    const nota = notasFinalizadasLocais.find(n => String(n.id) === String(idNota));
    if (!nota) return;

    const content = document.getElementById('modalDetalhesContent');
    content.innerHTML = `
        <div class="modal-info-row"><strong>Aba:</strong> ${nota.categoria === 'filiais' ? 'FILIAIS' : 'ANTENOR DUARTE'}</div>
        <div class="modal-info-row"><strong>Nº NF:</strong> ${nota.numeroNf || nota.nf}</div>
        <div class="modal-info-row"><strong>Empresa:</strong> ${nota.empresa || nota.fornecedor}</div>
        <div class="modal-info-row"><strong>Unidade:</strong> ${nota.unidade || '-'}</div>
        <div class="modal-info-row"><strong>Finalizado por:</strong> <strong>${nota.finalizadoPor}</strong></div>
        <div class="modal-info-row"><strong>Tipo:</strong> ${nota.tipo || '-'}</div>
        <div class="modal-info-row"><strong>Local Estoque:</strong> ${nota.localEstoque || '-'}</div>
        <div class="modal-info-row"><strong>Operação:</strong> ${nota.operacao || '-'}</div>

        <div class="modal-info-row" style="margin-top: 12px; font-size: 0.8rem; color: var(--text-muted); border-top: 1px solid #E5E7EB; padding-top: 8px;">
            <i class="fa-solid fa-clock"></i> Finalizada em: ${nota.dataHora}
        </div>
    `;
    document.getElementById('modalDetalhes').style.display = 'flex';
}

function fecharModalDetalhes() {
    document.getElementById('modalDetalhes').style.display = 'none';
}

function abrirModalRelatorio() {
    const reportNomeAba = document.getElementById('reportNomeAba');
    if (reportNomeAba) reportNomeAba.innerText = abaAtual === 'antenor' ? 'ANTENOR DUARTE' : 'FILIAIS';

    const filtradasAba = notasFinalizadasLocais.filter(n => (n.categoria || 'antenor') === abaAtual);
    renderizarTabelaRelatorio(filtradasAba);

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
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 15px;">Nenhuma nota finalizada disponível para relatório nesta aba.</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    lista.forEach((nota) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align: center;"><input type="checkbox" class="report-row-check" value="${nota.id}" checked></td>
            <td><strong>${nota.numeroNf || nota.nf}</strong></td>
            <td>${nota.empresa || nota.fornecedor}</td>
            <td>${nota.unidade || '-'}</td>
            <td>${nota.finalizadoPor}</td>
            <td>${nota.tipo || '-'}</td>
            <td>${nota.localEstoque || '-'}</td>
            <td>${nota.operacao || '-'}</td>
            <td>${nota.dataHora || '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}

function toggleMarcarTodas(masterCheckbox) {
    const checks = document.querySelectorAll('.report-row-check');
    checks.forEach(chk => chk.checked = masterCheckbox.checked);
}

function gerarVisualizacaoPDF() {
    const checks = document.querySelectorAll('.report-row-check:checked');
    const idsSelecionados = Array.from(checks).map(c => Number(c.value));

    if (idsSelecionados.length === 0) {
        alert("Selecione pelo menos uma nota para gerar a visualização.");
        return;
    }

    const isFiliais = abaAtual === 'filiais';
    const notasFiltradas = notasFinalizadasLocais.filter(n => (n.categoria || 'antenor') === abaAtual && idsSelecionados.includes(n.id));
    
    const novaJanela = window.open('', '_blank');
    novaJanela.document.write(`
        <html>
        <head>
            <title>Relatório de Notas Finalizadas - ${isFiliais ? 'FILIAIS' : 'ANTENOR DUARTE'}</title>
            <style>
                body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; padding: 30px; color: #2D3748; }
                h2 { text-align: center; font-size: 1.2rem; color: #035AA6; margin-bottom: 5px; }
                .timestamp { text-align: center; font-size: 0.8rem; color: #718096; margin-bottom: 25px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th, td { border: 1px solid #CBD5E0; padding: 10px 12px; font-size: 0.85rem; text-align: left; }
                th { background-color: #D9D2BF; color: #035AA6; font-weight: 700; }
            </style>
        </head>
        <body>
            <h2>CENTRAL DE NOTAS - RELATÓRIO DE FINALIZADAS (${isFiliais ? 'FILIAIS' : 'ANTENOR DUARTE'})</h2>
            <div class="timestamp">Gerado em: ${new Date().toLocaleString('pt-BR')}</div>
            <table>
                <thead>
                    <tr>
                        <th>Nº NF</th>
                        <th>Empresa</th>
                        <th>Unidade</th>
                        <th>Finalizado Por</th>
                        <th>Tipo</th>
                        <th>Local Estoque</th>
                        <th>Operação</th>
                        <th>Finalizado</th>
                    </tr>
                </thead>
                <tbody>
                    ${notasFiltradas.map(n => `
                        <tr>
                            <td><strong>${n.numeroNf || n.nf}</strong></td>
                            <td>${n.empresa || n.fornecedor}</td>
                            <td>${n.unidade || '-'}</td>
                            <td>${n.finalizadoPor}</td>
                            <td>${n.tipo || '-'}</td>
                            <td>${n.localEstoque || '-'}</td>
                            <td>${n.operacao || '-'}</td>
                            <td>${n.dataHora || '-'}</td>
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