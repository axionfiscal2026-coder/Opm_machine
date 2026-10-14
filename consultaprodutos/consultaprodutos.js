let produtosGerais = JSON.parse(localStorage.getItem('opm_produtos_lista')) || [];
let locaisEstoqueList = JSON.parse(localStorage.getItem('opm_locais_estoque')) || [
    'FARMACIA ALMOXARIFADO',
    'ALMOXARIFADO CENTRAL',
    'FARMACIA QT ESTOQUE'
];
let classificacoesList = JSON.parse(localStorage.getItem('opm_classificacoes_lista')) || [
    'MEDICAMENTO',
    'MATERIAL MEDICO',
    'SANEANTE',
    'EQUIPAMENTO'
];

let gerenciadorTipoAtual = ''; // 'local' ou 'classificacao'
let paginaAtual = 1;
const itensPorPagina = 10;

// Estado de Ordenação
let ordenacaoAtual = {
    coluna: null,
    direcao: 'original'
};

document.addEventListener('DOMContentLoaded', () => {
    window.produtosGerais = produtosGerais;
    window.locaisEstoqueList = locaisEstoqueList;
    window.classificacoesList = classificacoesList;

    renderSelectsOptions();
    renderizarTabelaPaginada();
});

// MÁSCARA MONETÁRIA (R$ 0,00)
function formatarMoeda(input) {
    let valor = input.value.replace(/\D/g, "");
    if (valor === "") {
        input.value = "";
        return;
    }
    
    let numero = (parseInt(valor, 10) / 100).toFixed(2);
    
    input.value = "R$ " + numero
        .replace(".", ",")
        .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
}

function toggleFormulario() {
    const collapsible = document.getElementById('formCollapsibleContent');
    const btnPlus = document.getElementById('btnToggleForm');

    if (!collapsible) return;

    if (collapsible.style.display === 'none' || collapsible.style.display === '') {
        collapsible.style.display = 'block';
        if (btnPlus) btnPlus.innerHTML = '<i class="fa-solid fa-minus"></i>';
    } else {
        collapsible.style.display = 'none';
        if (btnPlus) btnPlus.innerHTML = '<i class="fa-solid fa-plus"></i>';
        cancelarEdicao();
    }
}

function renderSelectsOptions() {
    // Select Local
    const selectLocal = document.getElementById('selectLocal');
    if (selectLocal) {
        const valAtual = selectLocal.value;
        selectLocal.innerHTML = '<option value="" selected>Selecione um local...</option>';
        locaisEstoqueList.forEach(loc => {
            const opt = document.createElement('option');
            opt.value = loc;
            opt.textContent = loc;
            selectLocal.appendChild(opt);
        });
        if (valAtual && locaisEstoqueList.includes(valAtual)) {
            selectLocal.value = valAtual;
        }
    }

    // Select Classificação
    const selectClass = document.getElementById('selectClassificacao');
    if (selectClass) {
        const valAtual = selectClass.value;
        selectClass.innerHTML = '<option value="" selected>Selecione uma classificação...</option>';
        classificacoesList.forEach(cls => {
            const opt = document.createElement('option');
            opt.value = cls;
            opt.textContent = cls;
            selectClass.appendChild(opt);
        });
        if (valAtual && classificacoesList.includes(valAtual)) {
            selectClass.value = valAtual;
        }
    }
}

// MODAL GERENCIADOR (ENGRENAGEM)
function abrirModalGerenciador(tipo) {
    gerenciadorTipoAtual = tipo;
    const modal = document.getElementById('modalGerenciador');
    const titulo = document.getElementById('modalGerenciadorTitulo');
    const labelInput = document.getElementById('modalInputLabel');

    if (tipo === 'local') {
        titulo.innerHTML = '<i class="fa-solid fa-list-check"></i> Gerenciar Locais de Estoque';
        labelInput.innerText = 'Adicionar Novo Local:';
    } else {
        titulo.innerHTML = '<i class="fa-solid fa-list-check"></i> Gerenciar Classificações';
        labelInput.innerText = 'Adicionar Nova Classificação:';
    }

    document.getElementById('inputNovaOpcaoModal').value = '';
    renderModalOptionsList();
    modal.style.display = 'flex';
}

function fecharModalGerenciador() {
    document.getElementById('modalGerenciador').style.display = 'none';
}

function renderModalOptionsList() {
    const ul = document.getElementById('modalOptionsList');
    if (!ul) return;

    ul.innerHTML = '';
    const lista = gerenciadorTipoAtual === 'local' ? locaisEstoqueList : classificacoesList;

    lista.forEach((item, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${item}</span>
            <button type="button" class="btn-del-modal-item" onclick="removerOpcaoModal(${index})" title="Remover">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;
        ul.appendChild(li);
    });
}

function adicionarOpcaoModal() {
    const input = document.getElementById('inputNovaOpcaoModal');
    const val = input.value.trim().toUpperCase();

    if (!val) {
        alert("Por favor, digite um nome válido.");
        return;
    }

    if (gerenciadorTipoAtual === 'local') {
        if (!locaisEstoqueList.includes(val)) {
            locaisEstoqueList.push(val);
            localStorage.setItem('opm_locais_estoque', JSON.stringify(locaisEstoqueList));
        }
    } else {
        if (!classificacoesList.includes(val)) {
            classificacoesList.push(val);
            localStorage.setItem('opm_classificacoes_lista', JSON.stringify(classificacoesList));
        }
    }

    input.value = '';
    renderModalOptionsList();
    renderSelectsOptions();

    if (typeof window.syncWithFirebase === "function") window.syncWithFirebase();
}

function removerOpcaoModal(index) {
    if (confirm("Deseja remover esta opção?")) {
        if (gerenciadorTipoAtual === 'local') {
            locaisEstoqueList.splice(index, 1);
            localStorage.setItem('opm_locais_estoque', JSON.stringify(locaisEstoqueList));
        } else {
            classificacoesList.splice(index, 1);
            localStorage.setItem('opm_classificacoes_lista', JSON.stringify(classificacoesList));
        }

        renderModalOptionsList();
        renderSelectsOptions();

        if (typeof window.syncWithFirebase === "function") window.syncWithFirebase();
    }
}

function voltarParaGestao() {
    window.location.href = '../lobby/lobby.html';
}

function handleFormSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    const codigo = document.getElementById('inputCodigo').value.trim();
    const nomeProduto = document.getElementById('inputNomeProduto').value.trim();
    const localEstoque = document.getElementById('selectLocal').value;
    const classificacao = document.getElementById('selectClassificacao').value;
    const valorUnitario = document.getElementById('inputValorUnitario').value.trim();
    const editId = document.getElementById('edit-product-id').value;

    if (!codigo || !nomeProduto) {
        alert("Preencha o Código e o Nome do Produto.");
        return;
    }

    if (editId !== "") {
        // EDIÇÃO
        const index = produtosGerais.findIndex(p => String(p.id) === String(editId));
        if (index !== -1) {
            produtosGerais[index].codigo = codigo;
            produtosGerais[index].nomeProduto = nomeProduto;
            produtosGerais[index].localEstoque = localEstoque || '';
            produtosGerais[index].classificacao = classificacao || '';
            produtosGerais[index].valorUnitario = valorUnitario || '';
        }
        mostrarNotificacaoToast("Produto atualizado com sucesso!");
    } else {
        // NOVO CADASTRO
        const novoProduto = {
            id: Date.now(),
            codigo: codigo,
            nomeProduto: nomeProduto,
            localEstoque: localEstoque || '',
            classificacao: classificacao || '',
            valorUnitario: valorUnitario || '',
            dataCadastro: new Date().toLocaleString('pt-BR')
        };
        produtosGerais.push(novoProduto);
        mostrarNotificacaoToast("Produto cadastrado com sucesso!");
    }

    window.produtosGerais = produtosGerais;
    localStorage.setItem('opm_produtos_lista', JSON.stringify(produtosGerais));

    if (typeof window.syncWithFirebase === "function") {
        window.syncWithFirebase();
    }

    cancelarEdicao();
    renderizarTabelaPaginada();
}

function editarProduto(idProduto) {
    const p = produtosGerais.find(item => String(item.id) === String(idProduto));
    if (!p) return;

    const collapsible = document.getElementById('formCollapsibleContent');
    const btnPlus = document.getElementById('btnToggleForm');
    if (collapsible) collapsible.style.display = 'block';
    if (btnPlus) btnPlus.innerHTML = '<i class="fa-solid fa-minus"></i>';

    document.getElementById('edit-product-id').value = p.id;
    document.getElementById('inputCodigo').value = p.codigo;
    document.getElementById('inputNomeProduto').value = p.nomeProduto;
    document.getElementById('selectLocal').value = p.localEstoque || '';
    document.getElementById('selectClassificacao').value = p.classificacao || '';
    document.getElementById('inputValorUnitario').value = p.valorUnitario || '';

    document.getElementById('btnSubmitText').innerText = 'ATUALIZAR';
    document.getElementById('btnCancelarEdicao').style.display = 'inline-flex';

    const formCardTop = document.getElementById('formCardTop');
    if (formCardTop) formCardTop.scrollIntoView({ behavior: 'smooth' });
}

function cancelarEdicao() {
    document.getElementById('edit-product-id').value = '';
    document.getElementById('inputCodigo').value = '';
    document.getElementById('inputNomeProduto').value = '';
    document.getElementById('selectLocal').value = '';
    document.getElementById('selectClassificacao').value = '';
    document.getElementById('inputValorUnitario').value = '';

    document.getElementById('btnSubmitText').innerText = 'CADASTRAR';
    document.getElementById('btnCancelarEdicao').style.display = 'none';
}

function excluirProduto(idProduto) {
    if (confirm("Tem certeza que deseja excluir este produto?")) {
        produtosGerais = produtosGerais.filter(p => String(p.id) !== String(idProduto));
        window.produtosGerais = produtosGerais;
        localStorage.setItem('opm_produtos_lista', JSON.stringify(produtosGerais));

        if (typeof window.syncWithFirebase === "function") {
            window.syncWithFirebase();
        }

        mostrarNotificacaoToast("Produto excluído com sucesso!");
        renderizarTabelaPaginada();
    }
}

// LÓGICA DE ORDENAÇÃO
function ordenarTabelaPor(coluna) {
    if (ordenacaoAtual.coluna === coluna) {
        if (ordenacaoAtual.direcao === 'asc') {
            ordenacaoAtual.direcao = 'desc';
        } else if (ordenacaoAtual.direcao === 'desc') {
            ordenacaoAtual.direcao = 'original';
            ordenacaoAtual.coluna = null;
        }
    } else {
        ordenacaoAtual.coluna = coluna;
        ordenacaoAtual.direcao = 'asc';
    }

    atualizarIconesOrdenacao();
    renderizarTabelaPaginada();
}

function atualizarIconesOrdenacao() {
    ['codigo', 'nomeProduto', 'localEstoque', 'classificacao', 'valorUnitario'].forEach(col => {
        const span = document.getElementById(`sortIcon_${col}`);
        if (!span) return;

        if (ordenacaoAtual.coluna === col) {
            if (ordenacaoAtual.direcao === 'asc') span.innerText = ' ▲';
            else if (ordenacaoAtual.direcao === 'desc') span.innerText = ' ▼';
            else span.innerText = '';
        } else {
            span.innerText = '';
        }
    });
}

function filtrarNotasTabela() {
    paginaAtual = 1;
    renderizarTabelaPaginada();
}

function renderizarTabelaPaginada() {
    const tbody = document.getElementById('tabelaTratativasBody');
    if (!tbody) return;

    const termo = (document.getElementById('searchInput')?.value || '').toLowerCase();

    // 1. FILTRAGEM
    let listaTrabalho = produtosGerais.filter(p => {
        const cod = (p.codigo || '').toLowerCase();
        const nome = (p.nomeProduto || '').toLowerCase();
        const loc = (p.localEstoque || '').toLowerCase();
        const cls = (p.classificacao || '').toLowerCase();
        const val = (p.valorUnitario || '').toLowerCase();

        return cod.includes(termo) || nome.includes(termo) || loc.includes(termo) || cls.includes(termo) || val.includes(termo);
    });

    // 2. ORDENAÇÃO
    if (ordenacaoAtual.coluna && ordenacaoAtual.direcao !== 'original') {
        const key = ordenacaoAtual.coluna;
        const dir = ordenacaoAtual.direcao === 'asc' ? 1 : -1;

        listaTrabalho.sort((a, b) => {
            let valA = (a[key] || '').toString();
            let valB = (b[key] || '').toString();

            if (key === 'valorUnitario') {
                valA = parseFloat(valA.replace(/\D/g, "")) || 0;
                valB = parseFloat(valB.replace(/\D/g, "")) || 0;
                return (valA - valB) * dir;
            }

            const numA = Number(valA);
            const numB = Number(valB);
            if (!isNaN(numA) && !isNaN(numB)) {
                return (numA - numB) * dir;
            }

            return valA.localeCompare(valB, 'pt-BR', { sensitivity: 'base' }) * dir;
        });
    }

    // 3. PAGINAÇÃO
    const totalRegistros = listaTrabalho.length;
    const totalPaginas = Math.ceil(totalRegistros / itensPorPagina) || 1;

    if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;
    if (paginaAtual < 1) paginaAtual = 1;

    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const paginados = listaTrabalho.slice(inicio, fim);

    tbody.innerHTML = '';
    if (paginados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">Nenhum produto encontrado.</td></tr>`;
    } else {
        paginados.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${p.codigo}</strong></td>
                <td>${p.nomeProduto}</td>
                <td>${p.localEstoque || '-'}</td>
                <td>${p.classificacao || '-'}</td>
                <td><strong>${p.valorUnitario || '-'}</strong></td>
                <td class="text-center">
                    <div class="action-buttons-group">
                        <button type="button" class="btn-action-tbl btn-editar" onclick="editarProduto('${p.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
                        <button type="button" class="btn-action-tbl btn-excluir" onclick="excluirProduto('${p.id}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
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

function abrirModalRelatorio() {
    renderizarTabelaRelatorio(produtosGerais);
    document.getElementById('modalRelatorio').style.display = 'flex';
    document.getElementById('reportTimestamp').innerText = `Gerado em: ${new Date().toLocaleString('pt-BR')}`;
}

function fecharModalRelatorio() {
    document.getElementById('modalRelatorio').style.display = 'none';
}

function renderizarTabelaRelatorio(lista) {
    const tbody = document.getElementById('reportTableBody');
    if (!tbody) return;

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 15px;">Nenhum produto disponível para relatório.</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    lista.forEach((p) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align: center;"><input type="checkbox" class="report-row-check" value="${p.id}" checked></td>
            <td><strong>${p.codigo}</strong></td>
            <td>${p.nomeProduto}</td>
            <td>${p.localEstoque || '-'}</td>
            <td>${p.classificacao || '-'}</td>
            <td><strong>${p.valorUnitario || '-'}</strong></td>
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
        alert("Selecione pelo menos um produto para gerar a visualização.");
        return;
    }

    const filtrados = produtosGerais.filter(p => idsSelecionados.includes(p.id));
    
    const novaJanela = window.open('', '_blank');
    novaJanela.document.write(`
        <html>
        <head>
            <title>Relatório de Produtos</title>
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
            <h2>CONSULTA DE PRODUTOS - RELATÓRIO</h2>
            <div class="timestamp">Gerado em: ${new Date().toLocaleString('pt-BR')}</div>
            <table>
                <thead>
                    <tr>
                        <th>CÓDIGO</th>
                        <th>NOME DO PRODUTO</th>
                        <th>LOCAL DE ESTOQUE</th>
                        <th>CLASSIFICAÇÃO</th>
                        <th>VALOR UNITÁRIO</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtrados.map(p => `
                        <tr>
                            <td><strong>${p.codigo}</strong></td>
                            <td>${p.nomeProduto}</td>
                            <td>${p.localEstoque || '-'}</td>
                            <td>${p.classificacao || '-'}</td>
                            <td><strong>${p.valorUnitario || '-'}</strong></td>
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