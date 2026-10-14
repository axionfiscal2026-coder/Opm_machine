let cartaAtual = '';
let contadorItensValidade = 1;
let contadorRecursosVerba = 1;
let contadorNotasTrocaVerba = 1;

// Estado de edição direta global para qualquer gerador aberto
let modoEdicaoDiretaAtual = false;

// Estado do modal de gerenciamento de opções
let tipoOpcaoGerenciando = ''; // 'descritivo', 'motivo', 'justificativa' ou 'recurso'

// Armazenamento inicial padrão de opções (caso não existam no localStorage)
const OPCOES_PADRAO = {
    descritivo: [
        "Inclusão de verba no campo de informações adicionais",
        "Ajuste nos dados adicionais da NF",
        "Inclusão de Ordem de Compra"
    ],
    motivo: [
        "Nota fiscal está sem verba nos dados adicionais",
        "Em razão da verba solicitada anteriormente na carta de correção estar atualmente sem saldo disponível, por essa razão será necessário trocar pela verba atualizada",
        "Atraso no recebimento da mercadoria",
        "Aguardando liberação financeira"
    ],
    justificativa: [
        "Prorrogação solicitada devido ao alinhamento de caixa para o dia",
        "Necessidade de readequação do fluxo de pagamento para o dia",
        "Solicitação acordada com o setor de compras para o dia"
    ],
    recurso: [
        "1010 2020 3030 4040",
        "5050 6060 7070 8080"
    ]
};

// Obter saudação padrão dependendo da hora atual (00:00 - 11:59 => Bom Dia, 12:00+ => Boa Tarde)
function obterSaudacaoAutomatica(comExclamacao = false) {
    const hora = new Date().getHours();
    const texto = hora < 12 ? "Bom Dia" : "Boa Tarde";
    return comExclamacao ? `${texto}!` : texto;
}

// Renderiza o campo de Seleção de Saudação como Visível porém Indisponível (disabled)
function renderizarCampoSaudacaoDesabilitado(idCampo) {
    const saudacaoAuto = obterSaudacaoAutomatica();
    return `
        <div class="form-group" style="max-width: 140px;">
            <label for="${idCampo}">Saudação</label>
            <select id="${idCampo}" disabled>
                <option value="${saudacaoAuto}" selected>${saudacaoAuto}</option>
            </select>
        </div>
    `;
}

// Inicializar e buscar opções cadastradas
function obterOpcoesSalvas(tipo) {
    const salvas = localStorage.getItem(`opm_cartas_opcoes_${tipo}`);
    if (salvas) {
        try {
            return JSON.parse(salvas);
        } catch (e) {
            console.error(e);
        }
    }
    return OPCOES_PADRAO[tipo] || [];
}

function salvarOpcoes(tipo, lista) {
    localStorage.setItem(`opm_cartas_opcoes_${tipo}`, JSON.stringify(lista));
}

// Função para voltar ao lobby/gestão
function voltarParaGestao() {
    window.location.href = '../lobby/lobby.html';
}

// ==========================================
// FILTRO DE PESQUISA DE CARDS
// ==========================================
function filtrarCards() {
    const termo = document.getElementById('searchInput').value.toLowerCase().trim();
    const cards = document.querySelectorAll('#cardsGrid .card-item');

    cards.forEach(card => {
        const titulo = card.querySelector('h3')?.innerText.toLowerCase() || '';
        const descricao = card.querySelector('p')?.innerText.toLowerCase() || '';

        if (titulo.includes(termo) || descricao.includes(termo)) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}

// ==========================================
// VALIDAÇÃO DO BOTÃO COPIAR
// ==========================================
function validarEstadoBotaoCopiar() {
    const copyBtn = document.getElementById('copyBtn');
    const letterBox = document.getElementById('letterOutput');

    if (!copyBtn || !letterBox) return;

    if (modoEdicaoDiretaAtual) {
        copyBtn.setAttribute('disabled', 'true');
        copyBtn.title = 'Tranque o texto para poder copiar a carta';
        return;
    }

    const possuiCamposPendentes = letterBox.querySelector('mark.highlight') !== null;

    if (possuiCamposPendentes) {
        copyBtn.setAttribute('disabled', 'true');
        copyBtn.title = 'Preencha todos os campos pendentes (em amarelo) para habilitar a cópia';
    } else {
        copyBtn.removeAttribute('disabled');
        copyBtn.title = '';
    }
}

// ==========================================
// ABERTURA E FECHAMENTO DO GERADOR
// ==========================================
function abrirGerador(tipo, titulo) {
    cartaAtual = tipo;
    modoEdicaoDiretaAtual = false;
    
    const btnEditar = document.getElementById('btnEditarAtual');
    if (btnEditar) {
        btnEditar.innerHTML = '<i class="fa-solid fa-lock"></i> Trancado';
        btnEditar.classList.remove('unlocked');
    }

    const letterOutput = document.getElementById('letterOutput');
    letterOutput.setAttribute('contenteditable', 'false');
    letterOutput.oninput = validarEstadoBotaoCopiar;

    document.getElementById('cardsGridArea').style.display = 'none';
    document.getElementById('generatorArea').style.display = 'block';
    document.getElementById('modalTitle').innerText = titulo;

    const dynamicFields = document.getElementById('dynamicFields');

    if (tipo === 'carta-correcao') {
        dynamicFields.innerHTML = renderizarFormularioCartaCorrecao();
        atualizarCartaCorrecao();

    } else if (tipo === 'prorrogacao-boleto') {
        dynamicFields.innerHTML = renderizarFormularioProrrogacaoBoleto();
        atualizarCartaProrrogacao();

    } else if (tipo === 'boleto-sem-registro') {
        dynamicFields.innerHTML = `
            <div class="form-group-row">
                ${renderizarCampoSaudacaoDesabilitado('saudacaoBoletoSemReg')}
                <div class="form-group">
                    <label for="destinatarioBoletoSemReg">Nome do Destinatário (Opcional)</label>
                    <input type="text" id="destinatarioBoletoSemReg" placeholder="Ex: Maria Fernanda" oninput="atualizarCartaBoletoSemRegistro()">
                </div>
            </div>

            <div class="form-group-row">
                <div class="form-group">
                    <label for="notaFiscalBoletoSemReg">Nota Fiscal nº</label>
                    <input type="text" id="notaFiscalBoletoSemReg" placeholder="Ex: 54321" oninput="atualizarCartaBoletoSemRegistro()">
                </div>
                <div class="form-group">
                    <label for="fornecedorBoletoSemReg">Fornecedor</label>
                    <input type="text" id="fornecedorBoletoSemReg" placeholder="Ex: DISTRIBUIDORA XYZ" oninput="atualizarCartaBoletoSemRegistro()">
                </div>
            </div>
        `;
        atualizarCartaBoletoSemRegistro();

    } else if (tipo === 'troca-verba') {
        contadorNotasTrocaVerba = 1;
        contadorRecursosVerba = 1;
        dynamicFields.innerHTML = renderizarFormularioTrocaVerba();
        atualizarCartaTrocaVerba();

    } else if (tipo === 'validade-curta') {
        contadorItensValidade = 1;
        dynamicFields.innerHTML = `
            <div class="form-group-row">
                ${renderizarCampoSaudacaoDesabilitado('saudacaoValidade')}
                <div class="form-group">
                    <label for="destinatarioValidade">Nome do Destinatário (Opcional)</label>
                    <input type="text" id="destinatarioValidade" placeholder="Ex: Maria Fernanda" oninput="atualizarCartaValidadeCurta()">
                </div>
            </div>

            <div class="form-group-row">
                <div class="form-group">
                    <label for="fornecedorValidade">Fornecedor</label>
                    <input type="text" id="fornecedorValidade" placeholder="Ex: ALFALAGOS LTDA" oninput="atualizarCartaValidadeCurta()">
                </div>
                <div class="form-group">
                    <label for="notaFiscalValidade">Nota Fiscal (NF nº)</label>
                    <input type="text" id="notaFiscalValidade" placeholder="Ex: 430365" oninput="atualizarCartaValidadeCurta()">
                </div>
            </div>

            <hr style="border: none; border-top: 1px solid var(--card-border); margin: 16px 0;">

            <div id="listaItensContainer">
                ${gerarHtmlItemBlock(1)}
            </div>

            <button type="button" class="btn-add-item" onclick="adicionarItemValidade()">
                <i class="fa-solid fa-plus"></i> Adicionar outro item
            </button>
        `;
        atualizarCartaValidadeCurta();
    }
}

function fecharGerador() {
    document.getElementById('cardsGridArea').style.display = 'block';
    document.getElementById('generatorArea').style.display = 'none';
}

function formatarValor(valor, valorPadrao, extraAttrs = '') {
    if (!valor || valor === valorPadrao) {
        return `<mark class="highlight" ${extraAttrs}>${valorPadrao}</mark>`;
    }
    return `<span class="texto-preenchido-bold">${valor}</span>`;
}

// ==========================================
// FUNÇÕES DOS BOTÕES LIMPAR E TRANCADO DO GERADOR
// ==========================================
function alternarEdicaoDiretaAtual() {
    modoEdicaoDiretaAtual = !modoEdicaoDiretaAtual;
    const btnEditar = document.getElementById('btnEditarAtual');
    const letterBox = document.getElementById('letterOutput');

    if (modoEdicaoDiretaAtual) {
        btnEditar.innerHTML = '<i class="fa-solid fa-lock-open"></i> Editar';
        btnEditar.classList.add('unlocked');
        letterBox.setAttribute('contenteditable', 'true');
        letterBox.focus();
    } else {
        btnEditar.innerHTML = '<i class="fa-solid fa-lock"></i> Trancado';
        btnEditar.classList.remove('unlocked');
        letterBox.setAttribute('contenteditable', 'false');
    }

    validarEstadoBotaoCopiar();
}

function limparFormularioAtual() {
    modoEdicaoDiretaAtual = false;
    const btnEditar = document.getElementById('btnEditarAtual');
    if (btnEditar) {
        btnEditar.innerHTML = '<i class="fa-solid fa-lock"></i> Trancado';
        btnEditar.classList.remove('unlocked');
    }
    const letterBox = document.getElementById('letterOutput');
    letterBox.setAttribute('contenteditable', 'false');

    if (cartaAtual === 'carta-correcao') {
        const varianteAtiva = document.querySelector('input[name="varianteCartaCorrecao"]:checked')?.value || 'modelo-1';
        document.getElementById('dynamicFields').innerHTML = renderizarFormularioCartaCorrecao();
        // Restaura a variante ativa
        const radioParaMarcar = document.querySelector(`input[name="varianteCartaCorrecao"][value="${varianteAtiva}"]`);
        if (radioParaMarcar) {
            radioParaMarcar.checked = true;
        }
        toggleProrrogacaoExtra();
        atualizarCartaCorrecao();
    } else if (cartaAtual === 'troca-verba') {
        const tipoAtivo = document.getElementById('tipoTrocaVerba')?.value || 'recurso-proprio';
        const escopoAtivo = document.querySelector('input[name="escopoTrocaVerba"]:checked')?.value || 'unico';
        document.getElementById('dynamicFields').innerHTML = renderizarFormularioTrocaVerba();
        document.getElementById('tipoTrocaVerba').value = tipoAtivo;
        const radioEscopo = document.querySelector(`input[name="escopoTrocaVerba"][value="${escopoAtivo}"]`);
        if (radioEscopo) radioEscopo.checked = true;
        alternarCamposTrocaVerba();
    } else {
        abrirGerador(cartaAtual, document.getElementById('modalTitle').innerText);
    }
}

// ==========================================
// GERENCIADOR DE OPÇÕES DROPDOWN (MODAL)
// ==========================================
function abrirModalGerenciadorOpcoes(tipo) {
    tipoOpcaoGerenciando = tipo;
    const modal = document.getElementById('opcoesModal');
    const titulo = document.getElementById('modalOpcoesTitulo');
    
    if (tipo === 'descritivo') {
        titulo.innerHTML = '<i class="fa-solid fa-list-check"></i> Gerenciar Opções de Descritivo';
    } else if (tipo === 'motivo') {
        titulo.innerHTML = '<i class="fa-solid fa-list-check"></i> Gerenciar Opções de Motivo';
    } else if (tipo === 'justificativa') {
        titulo.innerHTML = '<i class="fa-solid fa-list-check"></i> Gerenciar Opções de Justificativa';
    } else if (tipo === 'recurso') {
        titulo.innerHTML = '<i class="fa-solid fa-list-check"></i> Gerenciar Opções de Recurso';
    }

    renderizarListaOpcoesModal();
    modal.style.display = 'flex';
}

function fecharModalOpcoes() {
    document.getElementById('opcoesModal').style.display = 'none';
    tipoOpcaoGerenciando = '';
}

function renderizarListaOpcoesModal() {
    const container = document.getElementById('modalOpcoesListaContainer');
    const lista = obterOpcoesSalvas(tipoOpcaoGerenciando);

    if (lista.length === 0) {
        container.innerHTML = `<li style="justify-content: center; color: var(--text-muted);">Nenhuma opção cadastrada.</li>`;
        return;
    }

    let html = '';
    lista.forEach((item, index) => {
        html += `
            <li>
                <span>${item}</span>
                <button type="button" class="btn-delete-opcao-item" onclick="removerOpcaoItem(${index})" title="Remover Opção">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </li>
        `;
    });

    container.innerHTML = html;
}

function adicionarNovaOpcaoItem() {
    const input = document.getElementById('novoItemOpcaoInput');
    const val = input.value.trim();

    if (!val) return;

    let lista = obterOpcoesSalvas(tipoOpcaoGerenciando);
    lista.push(val);
    salvarOpcoes(tipoOpcaoGerenciando, lista);

    input.value = '';
    renderizarListaOpcoesModal();
    atualizarDropdownsOpcoesInterface();
}

function removerOpcaoItem(index) {
    let lista = obterOpcoesSalvas(tipoOpcaoGerenciando);
    lista.splice(index, 1);
    salvarOpcoes(tipoOpcaoGerenciando, lista);

    renderizarListaOpcoesModal();
    atualizarDropdownsOpcoesInterface();
}

function atualizarDropdownsOpcoesInterface() {
    const selDesc = document.getElementById('selectDescritivoCorrecao');
    if (selDesc) {
        const valAnt = selDesc.value;
        selDesc.innerHTML = renderizarOptionsParaSelect('descritivo');
        selDesc.value = valAnt;
    }

    const selMotivo = document.getElementById('selectMotivoCorrecao') || document.getElementById('selectMotivoProrrogacao');
    if (selMotivo) {
        const valAnt = selMotivo.value;
        selMotivo.innerHTML = renderizarOptionsParaSelect('motivo');
        selMotivo.value = valAnt;
    }

    const selJust = document.getElementById('selectJustificativaProrrogacao');
    if (selJust) {
        const valAnt = selJust.value;
        selJust.innerHTML = renderizarOptionsParaSelect('justificativa');
        selJust.value = valAnt;
    }

    const selRecursos = document.querySelectorAll('.select-recurso-custom');
    selRecursos.forEach(sel => {
        const valAnt = sel.value;
        sel.innerHTML = renderizarOptionsParaSelect('recurso');
        sel.value = valAnt;
    });

    if (cartaAtual === 'carta-correcao') atualizarCartaCorrecao();
    else if (cartaAtual === 'prorrogacao-boleto') atualizarCartaProrrogacao();
    else if (cartaAtual === 'troca-verba') atualizarCartaTrocaVerba();
}

function renderizarOptionsParaSelect(tipo) {
    const lista = obterOpcoesSalvas(tipo);
    let html = `<option value="">-- Selecione uma opção --</option>`;
    lista.forEach(op => {
        html += `<option value="${op}">${op}</option>`;
    });
    return html;
}

// ==========================================
// FORMULÁRIO PRORROGAÇÃO DE BOLETO
// ==========================================
function renderizarFormularioProrrogacaoBoleto() {
    const optionsMotivo = renderizarOptionsParaSelect('motivo');
    const optionsJustificativa = renderizarOptionsParaSelect('justificativa');

    return `
        <div class="form-group-row">
            ${renderizarCampoSaudacaoDesabilitado('saudacaoProrrogacao')}
            <div class="form-group">
                <label for="destinatarioProrrogacao">Nome do Destinatário (Opcional)</label>
                <input type="text" id="destinatarioProrrogacao" placeholder="Ex: Maria Fernanda" oninput="atualizarCartaProrrogacao()">
            </div>
        </div>

        <div class="form-group-row">
            <div class="form-group">
                <label for="notaFiscalProrrogacao">Nota Fiscal (Nº NF)</label>
                <input type="text" id="notaFiscalProrrogacao" placeholder="Ex: 53100" oninput="atualizarCartaProrrogacao()">
            </div>
            <div class="form-group">
                <label for="fornecedorProrrogacao">Fornecedor</label>
                <input type="text" id="fornecedorProrrogacao" placeholder="Ex: NILZA MARIA" oninput="atualizarCartaProrrogacao()">
            </div>
        </div>

        <div class="form-group-row">
            <div class="form-group">
                <label for="tituloProrrogacao">Título</label>
                <input type="text" id="tituloProrrogacao" placeholder="Ex: 53100/1" oninput="atualizarCartaProrrogacao()">
            </div>
            <div class="form-group">
                <label for="ordemCompraProrrogacao">O.C (Ordem de Compra)</label>
                <input type="text" id="ordemCompraProrrogacao" placeholder="Ex: 389883" oninput="atualizarCartaProrrogacao()">
            </div>
        </div>

        <div class="form-group">
            <label for="vencimentoOriginalProrrogacao">Vencimento Original</label>
            <input type="date" id="vencimentoOriginalProrrogacao" onchange="atualizarCartaProrrogacao()">
        </div>

        <div class="form-group">
            <label for="selectMotivoProrrogacao">Motivo:</label>
            <div class="input-with-gear-row">
                <select id="selectMotivoProrrogacao" onchange="atualizarCartaProrrogacao()">
                    ${optionsMotivo}
                </select>
                <button type="button" class="btn-gear-manage" onclick="abrirModalGerenciadorOpcoes('motivo')" title="Gerenciar opções de Motivo">
                    <i class="fa-solid fa-gear"></i>
                </button>
            </div>
        </div>

        <div class="form-group">
            <label for="selectJustificativaProrrogacao">Justificativa:</label>
            <div class="input-with-gear-row">
                <select id="selectJustificativaProrrogacao" onchange="atualizarCartaProrrogacao()">
                    ${optionsJustificativa}
                </select>
                <button type="button" class="btn-gear-manage" onclick="abrirModalGerenciadorOpcoes('justificativa')" title="Gerenciar opções de Justificativa">
                    <i class="fa-solid fa-gear"></i>
                </button>
            </div>
        </div>

        <div class="form-group">
            <label for="novaDataJustificativaProrrogacao">Data para a Justificativa</label>
            <input type="date" id="novaDataJustificativaProrrogacao" onchange="atualizarCartaProrrogacao()">
        </div>
    `;
}

// ==========================================
// RENDERIZAÇÃO FORMULÁRIO CARTA DE CORREÇÃO
// ==========================================
function renderizarFormularioCartaCorrecao() {
    const optionsDescritivo = renderizarOptionsParaSelect('descritivo');
    const optionsMotivo = renderizarOptionsParaSelect('motivo');

    return `
        <div class="prorrogacao-extra-box" id="boxProrrogacaoExtraCorrecao">
            <label class="prorrogacao-toggle-label">
                <input type="checkbox" id="checkProrrogacaoExtra" onchange="toggleProrrogacaoExtra()">
                <i class="fa-solid fa-calendar-plus"></i> Pedir prorrogação de boleto em conjunto
            </label>
            <div id="campoDataProrrogacaoExtra" style="display: none; margin-top: 12px;">
                <div class="form-group-row">
                    <div class="form-group">
                        <label style="font-size: 0.8rem; font-weight: 700; color: var(--primary-dark);">Nova Data de Vencimento</label>
                        <input type="date" id="dataProrrogacaoExtraInput" onchange="atualizarCartaCorrecao()">
                    </div>
                    <div class="form-group">
                        <label style="font-size: 0.8rem; font-weight: 700; color: var(--primary-dark);">Valor (R$)</label>
                        <input type="text" id="valorProrrogacaoExtraInput" placeholder="Ex: 1.500,00" oninput="atualizarCartaCorrecao()">
                    </div>
                </div>
            </div>
        </div>

        <div class="variant-selector-container">
            <span class="variant-selector-label">Selecione o Modelo de Carta de Correção</span>
            <div class="variant-options-grid">
                <label class="variant-card-option">
                    <input type="radio" name="varianteCartaCorrecao" value="modelo-1" checked onchange="atualizarCartaCorrecao()">
                    <div class="variant-card-content">
                        <strong><i class="fa-solid fa-file-lines"></i> Modelo 1</strong>
                        <span>Modelo com observação simples e descritivo</span>
                    </div>
                </label>
                <label class="variant-card-option">
                    <input type="radio" name="varianteCartaCorrecao" value="modelo-2" onchange="atualizarCartaCorrecao()">
                    <div class="variant-card-content">
                        <strong><i class="fa-solid fa-file-signature"></i> Modelo 2</strong>
                        <span>Modelo detalhado com descritivo e motivo</span>
                    </div>
                </label>
            </div>
        </div>

        <div class="form-group-row">
            ${renderizarCampoSaudacaoDesabilitado('saudacaoCorrecao')}
            <div class="form-group">
                <label for="destinatarioCorrecao">Nome do Destinatário (Opcional)</label>
                <input type="text" id="destinatarioCorrecao" placeholder="Ex: Maria Fernanda" oninput="atualizarCartaCorrecao()">
            </div>
        </div>

        <div class="form-group-row">
            <div class="form-group">
                <label for="notaFiscalCorrecao">Nota Fiscal (Nº NF)</label>
                <input type="text" id="notaFiscalCorrecao" placeholder="Ex: 34892" oninput="atualizarCartaCorrecao()">
            </div>
            <div class="form-group" id="boxSequenciaCorrecao" style="display: none;">
                <label for="sequenciaCorrecao">Sequência NF</label>
                <input type="text" id="sequenciaCorrecao" placeholder="Ex: 001" oninput="atualizarCartaCorrecao()">
            </div>
        </div>

        <div class="form-group-row">
            <div class="form-group">
                <label for="fornecedorCorrecao">Fornecedor</label>
                <input type="text" id="fornecedorCorrecao" placeholder="Ex: B.D." oninput="atualizarCartaCorrecao()">
            </div>
            <div class="form-group" id="boxOrdemCompraCorrecao">
                <label for="ordemCompraCorrecao">O.C (Ordem de Compra)</label>
                <input type="text" id="ordemCompraCorrecao" placeholder="Ex: 388120" oninput="atualizarCartaCorrecao()">
            </div>
        </div>

        <div class="form-group" id="boxDescritivoCorrecao">
            <label for="selectDescritivoCorrecao">Favor constar o seguinte descritivo:</label>
            <div class="input-with-gear-row">
                <select id="selectDescritivoCorrecao" onchange="atualizarCartaCorrecao()">
                    ${optionsDescritivo}
                </select>
                <button type="button" class="btn-gear-manage" onclick="abrirModalGerenciadorOpcoes('descritivo')" title="Gerenciar opções de Descritivo">
                    <i class="fa-solid fa-gear"></i>
                </button>
            </div>
        </div>

        <div class="form-group" id="boxMotivoCorrecao" style="display: none;">
            <label for="selectMotivoCorrecao">Motivo:</label>
            <div class="input-with-gear-row">
                <select id="selectMotivoCorrecao" onchange="atualizarCartaCorrecao()">
                    ${optionsMotivo}
                </select>
                <button type="button" class="btn-gear-manage" onclick="abrirModalGerenciadorOpcoes('motivo')" title="Gerenciar opções de Motivo">
                    <i class="fa-solid fa-gear"></i>
                </button>
            </div>
        </div>
    `;
}

function toggleProrrogacaoExtra() {
    const check = document.getElementById('checkProrrogacaoExtra')?.checked;
    const boxData = document.getElementById('campoDataProrrogacaoExtra');
    if (boxData) {
        boxData.style.display = check ? 'block' : 'none';
    }
    atualizarCartaCorrecao();
}

function construirBlocoProrrogacaoEmConjunto() {
    const pedirProrrogacao = document.getElementById('checkProrrogacaoExtra')?.checked;
    if (!pedirProrrogacao) return '';

    const rawDataExtra = document.getElementById('dataProrrogacaoExtraInput')?.value;
    const valorExtraVal = document.getElementById('valorProrrogacaoExtraInput')?.value.trim();

    let dataFormatada = 'xx/xx/xxxx';
    if (rawDataExtra) {
        const p = rawDataExtra.split('-');
        dataFormatada = `${p[2]}/${p[1]}/${p[0]}`;
    }

    const dataFinal = formatarValor(dataFormatada, 'xx/xx/xxxx');
    const valorFinal = formatarValor(valorExtraVal, 'xxx');

    return `Aproveito para solicitar também a prorrogação do boleto para o dia ${dataFinal} (ou o envio dos dados bancários da empresa), para realizarmos a liquidação desta nota o quanto antes, visto que o título original já encontra-se em atraso.\n\nValor: R$ ${valorFinal}\n\nObservação importante: Como a liquidação desta nota será realizada utilizando recurso de verba pública (Emenda Federal), o nosso financeiro é impedido de efetuar pagamentos com encargos adicionais. Portanto, em caso de emissão de um novo boleto, peço que se possível, o mesmo seja gerado sem a incidência de juros ou multas`;
}

// ==========================================
// FORMULÁRIO E LÓGICA DE TROCA DE VERBA ATUALIZADA
// ==========================================
function renderizarFormularioTrocaVerba() {
    return `
        <div class="form-group">
            <label for="tipoTrocaVerba">Tipo de Carta de Troca de Verba</label>
            <select id="tipoTrocaVerba" onchange="alternarCamposTrocaVerba()">
                <option value="recurso-proprio">Substituição por Recurso Próprio</option>
                <option value="sem-saldo">Substituição por Falta de Saldo</option>
            </select>
        </div>

        <div class="variant-selector-container">
            <span class="variant-selector-label">Escopo</span>
            <div class="variant-options-grid">
                <label class="variant-card-option">
                    <input type="radio" name="escopoTrocaVerba" value="unico" checked onchange="alternarCamposTrocaVerba()">
                    <div class="variant-card-content">
                        <strong><i class="fa-solid fa-file-lines"></i> Único</strong>
                        <span>Nota Fiscal única</span>
                    </div>
                </label>
                <label class="variant-card-option">
                    <input type="radio" name="escopoTrocaVerba" value="multiplas" onchange="alternarCamposTrocaVerba()">
                    <div class="variant-card-content">
                        <strong><i class="fa-solid fa-folder-tree"></i> Múltiplas</strong>
                        <span>Múltiplas Notas Fiscais</span>
                    </div>
                </label>
            </div>
        </div>

        <div id="areaNotaSimplesTrocaVerba">
            <div class="form-group-row">
                <div class="form-group">
                    <label for="notaFiscalTrocaVerba">Nota Fiscal</label>
                    <input type="text" id="notaFiscalTrocaVerba" placeholder="Ex: 12345" oninput="atualizarCartaTrocaVerba()">
                </div>
                <div class="form-group">
                    <label for="sequenciaTrocaVerba">Sequência</label>
                    <input type="text" id="sequenciaTrocaVerba" placeholder="Ex: 001" oninput="atualizarCartaTrocaVerba()">
                </div>
            </div>

            <div class="form-group">
                <label for="fornecedorTrocaVerba">Fornecedor</label>
                <input type="text" id="fornecedorTrocaVerba" placeholder="Ex: FORNECEDOR ABC" oninput="atualizarCartaTrocaVerba()">
            </div>
        </div>

        <div id="areaNotasMultiplasTrocaVerba" style="display: none;">
            <hr style="border: none; border-top: 1px solid var(--card-border); margin: 16px 0;">
            <label style="font-size: 0.8rem; font-weight: 700; color: var(--primary-dark); display: block; margin-bottom: 8px;">
                Notas Fiscais
            </label>
            <div id="listaNotasTrocaContainer">
                ${gerarHtmlNotaTrocaBlock(1)}
            </div>
            <button type="button" class="btn-add-item" onclick="adicionarNotaTrocaVerba()">
                <i class="fa-solid fa-plus"></i> Adicionar outra nota fiscal
            </button>
        </div>

        <div id="areaRecursosCustomizados" style="display: none;">
            <hr style="border: none; border-top: 1px solid var(--card-border); margin: 16px 0;">
            <div class="form-group">
                <label for="selectRecursoTroca">Recurso</label>
                <div class="input-with-gear-row">
                    <select id="selectRecursoTroca" class="select-recurso-custom" onchange="atualizarCartaTrocaVerba()">
                        ${renderizarOptionsParaSelect('recurso')}
                    </select>
                    <button type="button" class="btn-gear-manage" onclick="abrirModalGerenciadorOpcoes('recurso')" title="Gerenciar opções de Recurso">
                        <i class="fa-solid fa-gear"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function gerarHtmlNotaTrocaBlock(id) {
    return `
        <div class="item-block" id="notaTrocaBlock_${id}">
            <div class="item-block-header">
                <h4>Nota Fiscal #${id}</h4>
                ${id > 1 ? `<button type="button" class="btn-remove-item" onclick="removerNotaTrocaVerba(${id})"><i class="fa-solid fa-trash"></i> Remover</button>` : ''}
            </div>
            <div class="form-group-row">
                <div class="form-group">
                    <label>Nota Fiscal</label>
                    <input type="text" class="nota-multi-num" placeholder="Ex: 12345" oninput="atualizarCartaTrocaVerba()">
                </div>
                <div class="form-group">
                    <label>Sequência</label>
                    <input type="text" class="nota-multi-seq" placeholder="Ex: 001" oninput="atualizarCartaTrocaVerba()">
                </div>
            </div>
            <div class="form-group">
                <label>Fornecedor</label>
                <input type="text" class="nota-multi-forn" placeholder="Ex: FORNECEDOR ABC" oninput="atualizarCartaTrocaVerba()">
            </div>
        </div>
    `;
}

function adicionarNotaTrocaVerba() {
    contadorNotasTrocaVerba++;
    const container = document.getElementById('listaNotasTrocaContainer');
    if (container) {
        container.insertAdjacentHTML('beforeend', gerarHtmlNotaTrocaBlock(contadorNotasTrocaVerba));
        atualizarCartaTrocaVerba();
    }
}

function removerNotaTrocaVerba(id) {
    const el = document.getElementById(`notaTrocaBlock_${id}`);
    if (el) {
        el.remove();
        atualizarCartaTrocaVerba();
    }
}

function alternarCamposTrocaVerba() {
    const tipo = document.getElementById('tipoTrocaVerba').value;
    const escopo = document.querySelector('input[name="escopoTrocaVerba"]:checked')?.value || 'unico';

    const areaSimples = document.getElementById('areaNotaSimplesTrocaVerba');
    const areaMulti = document.getElementById('areaNotasMultiplasTrocaVerba');
    const areaRecurso = document.getElementById('areaRecursosCustomizados');

    if (escopo === 'unico') {
        if (areaSimples) areaSimples.style.display = 'block';
        if (areaMulti) areaMulti.style.display = 'none';
    } else {
        if (areaSimples) areaSimples.style.display = 'none';
        if (areaMulti) areaMulti.style.display = 'block';
    }

    if (tipo === 'sem-saldo') {
        if (areaRecurso) areaRecurso.style.display = 'block';
    } else {
        if (areaRecurso) areaRecurso.style.display = 'none';
    }

    atualizarCartaTrocaVerba();
}

function atualizarCartaTrocaVerba() {
    const tipo = document.getElementById('tipoTrocaVerba')?.value || 'recurso-proprio';
    const escopo = document.querySelector('input[name="escopoTrocaVerba"]:checked')?.value || 'unico';
    let blocos = [];

    if (tipo === 'recurso-proprio') {
        if (escopo === 'unico') {
            const nfVal = document.getElementById('notaFiscalTrocaVerba')?.value.trim();
            const seqVal = document.getElementById('sequenciaTrocaVerba')?.value.trim();
            const fornVal = document.getElementById('fornecedorTrocaVerba')?.value.trim();

            const notaFiscal = formatarValor(nfVal, 'xxxx');
            const sequencia = formatarValor(seqVal, 'xxxx');
            const fornecedor = formatarValor(fornVal, 'xxxxx');

            blocos.push(`Solicito, por gentileza, a troca da verba que está vinculada à Nota Fiscal ${notaFiscal} (Sequência: ${sequencia}), do fornecedor ${fornecedor}`);
        } else {
            blocos.push(`Solicito, por gentileza, a troca da verba que está vinculada às seguintes Notas Fiscais`);

            const blocks = document.querySelectorAll('#listaNotasTrocaContainer .item-block');
            let arrNotas = [];
            blocks.forEach(block => {
                const numVal = block.querySelector('.nota-multi-num')?.value.trim();
                const seqVal = block.querySelector('.nota-multi-seq')?.value.trim();
                const fornVal = block.querySelector('.nota-multi-forn')?.value.trim();

                const n = formatarValor(numVal, 'xxxx');
                const s = formatarValor(seqVal, 'xxxx');
                const f = formatarValor(fornVal, 'xxxxx');

                arrNotas.push(`${n} (Sequência: ${s}) - do fornecedor ${f}`);
            });

            blocos.push(arrNotas.join('\n'));
        }
        blocos.push(`A verba deve ser substituída por RECURSO PROPRIO.`);

    } else if (tipo === 'sem-saldo') {
        blocos.push(`${obterSaudacaoAutomatica(true)}`);

        if (escopo === 'unico') {
            const nfVal = document.getElementById('notaFiscalTrocaVerba')?.value.trim();
            const seqVal = document.getElementById('sequenciaTrocaVerba')?.value.trim();
            const fornVal = document.getElementById('fornecedorTrocaVerba')?.value.trim();

            const notaFiscal = formatarValor(nfVal, 'xxxx');
            const sequencia = formatarValor(seqVal, 'xxxx');
            const fornecedor = formatarValor(fornVal, 'xxxxx');

            blocos.push(`Solicito, por gentileza, a troca da verba que está vinculada à Nota Fiscal ${notaFiscal} (Sequência: ${sequencia}) do fornecedor ${fornecedor}`);
        } else {
            blocos.push(`Solicito, por gentileza, a troca da verba que está vinculada às seguintes Notas Fiscais`);

            const blocks = document.querySelectorAll('#listaNotasTrocaContainer .item-block');
            let arrNotas = [];
            blocks.forEach(block => {
                const numVal = block.querySelector('.nota-multi-num')?.value.trim();
                const seqVal = block.querySelector('.nota-multi-seq')?.value.trim();
                const fornVal = block.querySelector('.nota-multi-forn')?.value.trim();

                const n = formatarValor(numVal, 'xxxx');
                const s = formatarValor(seqVal, 'xxxx');
                const f = formatarValor(fornVal, 'xxxxx');

                arrNotas.push(`${n} (Sequência: ${s}) - do fornecedor ${f}`);
            });

            blocos.push(arrNotas.join('\n'));
        }

        blocos.push(`O motivo da troca se dá pelo fato de que o recurso vinculado atualmente está sem saldo na conta para realizar a liquidação do título.`);

        const recVal = document.getElementById('selectRecursoTroca')?.value;
        const recurso = formatarValor(recVal, 'xxxx');
        blocos.push(`verba deve ser substituída pelo recurso: ${recurso}`);
    }

    const htmlCarta = blocos.join('\n\n');
    document.getElementById('letterOutput').innerHTML = htmlCarta;
    validarEstadoBotaoCopiar();
}

// ==========================================
// CONSTRUÇÃO E ATUALIZAÇÃO DA CARTA DE CORREÇÃO
// ==========================================
function construirTextoCartaCorrecao() {
    const radioSelecionado = document.querySelector('input[name="varianteCartaCorrecao"]:checked')?.value || 'modelo-1';
    const saudacao = obterSaudacaoAutomatica();
    const destinatario = document.getElementById('destinatarioCorrecao')?.value.trim() || '';

    const nfVal = document.getElementById('notaFiscalCorrecao')?.value.trim();
    const seqVal = document.getElementById('sequenciaCorrecao')?.value.trim();
    const fornVal = document.getElementById('fornecedorCorrecao')?.value.trim();
    const ocVal = document.getElementById('ordemCompraCorrecao')?.value.trim();

    const descVal = document.getElementById('selectDescritivoCorrecao')?.value;
    const motivoVal = document.getElementById('selectMotivoCorrecao')?.value;

    const boxSeq = document.getElementById('boxSequenciaCorrecao');
    const boxOc = document.getElementById('boxOrdemCompraCorrecao');
    const boxMotivo = document.getElementById('boxMotivoCorrecao');

    const blocoProrrogacao = construirBlocoProrrogacaoEmConjunto();

    if (radioSelecionado === 'modelo-1') {
        if (boxSeq) boxSeq.style.display = 'none';
        if (boxOc) boxOc.style.display = 'block';
        if (boxMotivo) boxMotivo.style.display = 'none';

        const notaFiscal = formatarValor(nfVal, 'xxxx');
        const ordemCompra = formatarValor(ocVal, 'xxxxx');
        const fornecedor = formatarValor(fornVal, 'xxxx');
        const descritivo = formatarValor(descVal, 'xxxxx');

        let linhaSaudacao = destinatario ? `${saudacao} , ${destinatario}!` : `${saudacao} ,`;
        let textoPorGentileza = `Por gentileza ,solicitar carta de correção considerando verba referente a nota fiscal ${notaFiscal} - O.C ${ordemCompra} , do Fornecedor  ${fornecedor}.`;
        let msgFixa = "Nota fiscal está sem verba nos dados adicionais.";
        let linhaDescritivo = `Favor constar na carta de correção o seguinte descritivo: ${descritivo}`;

        let blocosTexto = [linhaSaudacao, textoPorGentileza, msgFixa, linhaDescritivo];
        if (blocoProrrogacao) blocosTexto.push(blocoProrrogacao);
        blocosTexto.push('Atenciosamente..');

        return blocosTexto.join('\n\n');

    } else if (radioSelecionado === 'modelo-2') {
        if (boxSeq) boxSeq.style.display = 'block';
        if (boxOc) boxOc.style.display = 'block';
        if (boxMotivo) boxMotivo.style.display = 'block';

        const notaFiscal = formatarValor(nfVal, 'xxxx');
        const sequencia = formatarValor(seqVal, 'xxxx');
        const fornecedor = formatarValor(fornVal, 'xxxx');
        const ordemCompra = formatarValor(ocVal, 'xxxx');
        const descritivo = formatarValor(descVal, 'xxxxx');
        const motivo = formatarValor(motivoVal, 'xxxx');

        let linhaSaudacao = destinatario ? `${saudacao}! , ${destinatario}` : `${saudacao}!`;

        let blocoInfoNF = `N° NF: ${notaFiscal}\nFornecedor: ${fornecedor}\nSequência NF: ${sequencia}\nOrdem de compra: ${ordemCompra}`;

        let blocos = [
            linhaSaudacao,
            `Por gentileza, solicito a emissão de uma nova Carta de Correção (CC-e) referente à Nota Fiscal abaixo:`,
            blocoInfoNF,
            `Favor constar na carta de correção o seguinte descritivo: ${descritivo}`,
            `Motivo: ${motivo}`
        ];

        if (blocoProrrogacao) blocos.push(blocoProrrogacao);

        blocos.push(`Solicito, por gentileza, que a resposta seja encaminhada a todos os e-mails copiados nesta mensagem.`);
        blocos.push(`Desde já, agradeço pela atenção e apoio.`);
        blocos.push('Atenciosamente,');

        return blocos.join('\n\n');
    }
}

function atualizarCartaCorrecao() {
    const htmlCarta = construirTextoCartaCorrecao();
    document.getElementById('letterOutput').innerHTML = htmlCarta;
    validarEstadoBotaoCopiar();
}

// ==========================================
// CONSTRUÇÃO E ATUALIZAÇÃO DA CARTA DE PRORROGAÇÃO DE BOLETO
// ==========================================
function construirTextoCartaProrrogacao() {
    const saudacao = obterSaudacaoAutomatica(true);
    const destinatario = document.getElementById('destinatarioProrrogacao')?.value.trim() || '';

    const nfVal = document.getElementById('notaFiscalProrrogacao')?.value.trim();
    const fornVal = document.getElementById('fornecedorProrrogacao')?.value.trim();
    const tituloVal = document.getElementById('tituloProrrogacao')?.value.trim();
    const ocVal = document.getElementById('ordemCompraProrrogacao')?.value.trim();
    const rawVencOrig = document.getElementById('vencimentoOriginalProrrogacao')?.value;

    const motivoVal = document.getElementById('selectMotivoProrrogacao')?.value;
    const justificativaVal = document.getElementById('selectJustificativaProrrogacao')?.value;
    const rawDataJust = document.getElementById('novaDataJustificativaProrrogacao')?.value;

    let dateVencOrigFormatted = 'xx/xx/xxxx';
    if (rawVencOrig) {
        const p = rawVencOrig.split('-');
        dateVencOrigFormatted = `${p[2]}/${p[1]}/${p[0]}`;
    }

    let dateJustFormatted = 'xx/xx/xxxx';
    if (rawDataJust) {
        const p = rawDataJust.split('-');
        dateJustFormatted = `${p[2]}/${p[1]}/${p[0]}`;
    }

    const notaFiscal = formatarValor(nfVal, 'xxxx');
    const fornecedor = formatarValor(fornVal, 'xxxxx');
    const titulo = formatarValor(tituloVal, 'xxxxx');
    const ordemCompra = formatarValor(ocVal, 'xxxxx');
    const vencimentoOriginal = formatarValor(dateVencOrigFormatted, 'xx/xx/xxxx');

    const motivo = formatarValor(motivoVal, 'xxxxx');
    const justificativaTexto = formatarValor(justificativaVal, 'xxxxxxxx');
    const dataJustificativa = formatarValor(dateJustFormatted, 'xx/xx/xxxx');

    let linhaSaudacao = destinatario ? `${saudacao.replace('!', '')}, ${destinatario}!` : saudacao;

    let blocoInfo = `N° NF: ${notaFiscal}\nFornecedor: ${fornecedor}\nTítulo: ${titulo}\nOrdem de compra: ${ordemCompra}\nVencimento original: ${vencimentoOriginal}`;

    let linhaJustificativa = `Justificativa: ${justificativaTexto} ${dataJustificativa}.`;

    let blocos = [
        linhaSaudacao,
        `Por gentileza, solicito prorrogação do boleto referente à NF abaixo:`,
        blocoInfo,
        `Motivo: ${motivo}`,
        linhaJustificativa,
        `Desde já, agradeço pela atenção e apoio.\nPermaneço a disposição.`,
        'Atenciosamente,'
    ];

    return blocos.join('\n\n');
}

function atualizarCartaProrrogacao() {
    const htmlCarta = construirTextoCartaProrrogacao();
    document.getElementById('letterOutput').innerHTML = htmlCarta;
    validarEstadoBotaoCopiar();
}

// ==========================================
// LÓGICA DAS DEMAIS CARTAS INDIVIDUAIS
// ==========================================
function atualizarCartaBoletoSemRegistro() {
    const saudacao = obterSaudacaoAutomatica(true);
    const destinatario = document.getElementById('destinatarioBoletoSemReg')?.value.trim() || '';
    const nfVal = document.getElementById('notaFiscalBoletoSemReg')?.value.trim();
    const fornVal = document.getElementById('fornecedorBoletoSemReg')?.value.trim();

    const notaFiscal = formatarValor(nfVal, 'xxx');
    const fornecedor = formatarValor(fornVal, 'xxxxx');

    let linhaSaudacao = destinatario ? `${saudacao.replace('!', '')}, ${destinatario}!` : saudacao;

    let blocos = [
        linhaSaudacao,
        `Por gentileza, Solicitamos o envio do Boleto referente à Nota Fiscal nº ${notaFiscal}, FORNECEDOR ${fornecedor}\npois até o momento não identificamos o Boleto sem o registro no DDA.`,
        `Caso não seja possível o envio do boleto, solicitamos, por gentileza, o\nencaminhamento dos Dados Bancários para pagamento`
    ];

    const htmlCarta = blocos.join('\n\n');
    document.getElementById('letterOutput').innerHTML = htmlCarta;
    validarEstadoBotaoCopiar();
}

function gerarHtmlItemBlock(id) {
    return `
        <div class="item-block" id="itemBlock_${id}">
            <div class="item-block-header">
                <h4>Item #${id}</h4>
                ${id > 1 ? `<button type="button" class="btn-remove-item" onclick="removerItemValidade(${id})"><i class="fa-solid fa-trash"></i> Remover</button>` : ''}
            </div>
            <div class="form-group-row">
                <div class="form-group" style="max-width: 130px;">
                    <label>Cód. Item</label>
                    <input type="text" class="item-codigo" placeholder="Ex: 21433" oninput="atualizarCartaValidadeCurta()">
                </div>
                <div class="form-group">
                    <label>Nome / Descrição do Item</label>
                    <input type="text" class="item-nome" placeholder="Ex: Cloreto de Sódio 20%" oninput="atualizarCartaValidadeCurta()">
                </div>
            </div>
            <div class="form-group-row">
                <div class="form-group">
                    <label>Quantidade</label>
                    <input type="text" class="item-qtd" placeholder="Ex: 2.200" oninput="atualizarCartaValidadeCurta()">
                </div>
                <div class="form-group">
                    <label>Validade</label>
                    <input type="date" class="item-validade" onchange="atualizarCartaValidadeCurta()">
                </div>
            </div>
        </div>
    `;
}

function adicionarItemValidade() {
    contadorItensValidade++;
    const container = document.getElementById('listaItensContainer');
    container.insertAdjacentHTML('beforeend', gerarHtmlItemBlock(contadorItensValidade));
    atualizarCartaValidadeCurta();
}

function removerItemValidade(id) {
    const el = document.getElementById(`itemBlock_${id}`);
    if (el) {
        el.remove();
        atualizarCartaValidadeCurta();
    }
}

function atualizarCartaValidadeCurta() {
    const saudacao = obterSaudacaoAutomatica();
    const destinatario = document.getElementById('destinatarioValidade')?.value.trim() || '';
    const fornVal = document.getElementById('fornecedorValidade')?.value.trim();
    const nfVal = document.getElementById('notaFiscalValidade')?.value.trim();

    let linhaSaudacao = destinatario ? `${saudacao}, ${destinatario}!` : `${saudacao},`;

    const fornecedor = formatarValor(fornVal, 'xxxxx');
    const notaFiscal = formatarValor(nfVal, 'xxxxx');

    const itemBlocks = document.querySelectorAll('#dynamicFields .item-block');
    const totalItens = itemBlocks.length;

    const fraseConsta = totalItens > 1 
        ? 'Constam na nota os seguintes itens:' 
        : 'Consta na nota o seguinte item:';

    let textoItensArr = [];

    itemBlocks.forEach(block => {
        const codVal = block.querySelector('.item-codigo')?.value.trim();
        const nomeVal = block.querySelector('.item-nome')?.value.trim();
        const qtdVal = block.querySelector('.item-qtd')?.value.trim();
        const rawDate = block.querySelector('.item-validade')?.value;

        let dateFormattedVal = '';
        if (rawDate) {
            const partes = rawDate.split('-');
            dateFormattedVal = `${partes[2]}/${partes[1]}/${partes[0]}`;
        }

        const cod = formatarValor(codVal, 'xxxx');
        const nome = formatarValor(nomeVal, 'xxxxxxxxxxx');
        const qtd = formatarValor(qtdVal, 'xxxxx');
        const val = formatarValor(dateFormattedVal, 'xx/xx/xxxx');

        textoItensArr.push(`Item ${cod} – ${nome};\nQuantidade: ${qtd} unidades;\nValidade: ${val}.`);
    });

    const blocoItens = textoItensArr.join('\n\n');

    const htmlCarta = `${linhaSaudacao}\n\nRecebemos da(o) ${fornecedor} a NF nº ${notaFiscal}.\n\n${fraseConsta}\n\n${blocoItens}\n\nPodemos prosseguir com a entrada desta nota fiscal, considerando a validade informada?\n\nAtenciosamente,`;

    document.getElementById('letterOutput').innerHTML = htmlCarta;
    validarEstadoBotaoCopiar();
}

function copiarCarta() {
    const copyBtn = document.getElementById('copyBtn');
    if (copyBtn.hasAttribute('disabled')) return;

    const letterBox = document.getElementById('letterOutput');
    const texto = letterBox.innerText;

    if (!texto) return;

    navigator.clipboard.writeText(texto).then(() => {
        const originalText = copyBtn.innerHTML;
        
        copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copiado!';

        setTimeout(() => {
            copyBtn.innerHTML = originalText;
        }, 2000);
    });
}