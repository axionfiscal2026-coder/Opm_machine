// Navegação do botão do Topo
function voltarParaGestao() {
    window.location.href = '../lobby/lobby.html';
}

document.addEventListener('DOMContentLoaded', () => {

    // --- ALTERNÂNCIA DIRETA DE FERRAMENTAS (REGRA DE 3 <-> VALIDADE) ---
    const btnAlternarCalc = document.getElementById('btnAlternarCalc');
    const switchBtnText = document.getElementById('switchBtnText');
    const calcRegra3 = document.getElementById('calcRegra3');
    const calcValidade = document.getElementById('calcValidade');
    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');
    const toolTag = document.getElementById('toolTag');

    // Modos: 'regra3' <-> 'validade'
    let modoCalculadoraAtual = 'regra3';

    btnAlternarCalc.addEventListener('click', () => {
        if (modoCalculadoraAtual === 'regra3') {
            modoCalculadoraAtual = 'validade';
            calcRegra3.style.display = 'none';
            calcValidade.style.display = 'block';
            switchBtnText.innerText = 'Calculadora Regra de 3';
            toolTag.innerText = 'CONTROLE DE VALIDADE';
            pageTitle.innerText = 'Cálculo e Conferência de Validade';
            pageSubtitle.innerText = 'Verifique se a validade atende ao tempo mínimo exigido por setor.';
        } else {
            modoCalculadoraAtual = 'regra3';
            calcRegra3.style.display = 'block';
            calcValidade.style.display = 'none';
            switchBtnText.innerText = 'Cálculo Validade';
            toolTag.innerText = 'FERRAMENTAS AUXILIARES';
            pageTitle.innerText = 'Cálculo Proporcional de Notas';
            pageSubtitle.innerText = 'Calcule o valor total correspondente a uma quantidade de itens na nota.';
        }
    });

    // --- REGRA DE TRÊS ---
    const qtdTotal = document.getElementById('qtdTotal');
    const valTotal = document.getElementById('valTotal');
    const qtdParcial = document.getElementById('qtdParcial');
    const valParcial = document.getElementById('valParcial');
    const btnCalcular = document.getElementById('btnCalcular');
    const btnLimpar = document.getElementById('btnLimpar');
    const formulaBox = document.getElementById('formulaExplanation');

    function formatarParaMoeda(valor, codigo = 'BRL') {
        return valor.toLocaleString('pt-BR', { style: 'currency', currency: codigo });
    }

    function converterMoedaParaNumero(texto) {
        if (!texto) return 0;
        const apenasNumeros = texto.replace(/\D/g, '');
        return parseFloat(apenasNumeros) / 100;
    }

    function aplicarMascaraMoeda(input) {
        let valorNum = converterMoedaParaNumero(input.value);
        if (isNaN(valorNum) || valorNum === 0) {
            input.value = '';
        } else {
            input.value = formatarParaMoeda(valorNum);
        }
    }

    if (valTotal) {
        valTotal.addEventListener('input', (e) => {
            aplicarMascaraMoeda(e.target);
            executarCalculoSePronto();
        });
    }

    function calcularRegra3() {
        const qTotal = parseFloat(qtdTotal.value);
        const vTotal = converterMoedaParaNumero(valTotal.value);
        const qParcial = parseFloat(qtdParcial.value);

        if (isNaN(qTotal) || qTotal <= 0 || isNaN(vTotal) || vTotal <= 0 || isNaN(qParcial) || qParcial <= 0) {
            return;
        }

        const valorUnitarioExato = vTotal / qTotal;
        const resultadoValExato = (qParcial * vTotal) / qTotal;

        valParcial.value = formatarParaMoeda(resultadoValExato);

        const valorUnitarioArredondado = Math.round(valorUnitarioExato * 100) / 100;
        const contaManualArredondada = Math.round((qParcial * valorUnitarioArredondado) * 100) / 100;
        const resultadoExatoArredondado = Math.round(resultadoValExato * 100) / 100;

        const temDiferencaArredondamento = contaManualArredondada !== resultadoExatoArredondado;

        let HTMLObservacao = '';
        if (temDiferencaArredondamento) {
            HTMLObservacao = `
                <div class="obs-note">
                    <strong>Obs:</strong> Ao fazer a conta manual multiplicando a quantidade pelo valor unitário exibido (${formatarParaMoeda(valorUnitarioArredondado)}), resulta em ${formatarParaMoeda(contaManualArredondada)}. A variação de centavos ocorre devido às dízimas/casas decimais ocultas no cálculo exato.
                </div>
            `;
        }

        formulaBox.innerHTML = `
            <strong>Resumo do Cálculo:</strong><br>
            • Valor Unitário do produto: <strong>${formatarParaMoeda(valorUnitarioExato)}</strong>/un<br>
            • ${qParcial} unidades × ${formatarParaMoeda(valorUnitarioExato)} = <strong>${formatarParaMoeda(resultadoValExato)}</strong>
            ${HTMLObservacao}
        `;
    }

    function executarCalculoSePronto() {
        if (qtdTotal.value && valTotal.value && qtdParcial.value) calcularRegra3();
    }

    function limparRegra3() {
        qtdTotal.value = '';
        valTotal.value = '';
        qtdParcial.value = '';
        valParcial.value = '';
        formulaBox.innerHTML = 'Preencha os três campos acima para calcular o valor proporcional.';
        qtdTotal.focus();
    }

    if (btnCalcular) btnCalcular.addEventListener('click', calcularRegra3);
    if (btnLimpar) btnLimpar.addEventListener('click', limparRegra3);
    if (qtdTotal) qtdTotal.addEventListener('input', executarCalculoSePronto);
    if (qtdParcial) qtdParcial.addEventListener('input', executarCalculoSePronto);

    // --- CÁLCULO DE VALIDADE ---
    const selectEstoque = document.getElementById('selectEstoque');
    const inputDataValidade = document.getElementById('inputDataValidade');
    const validityStatusBox = document.getElementById('validityStatusBox');
    const validityBadge = document.getElementById('validityBadge');
    const validityMainTitle = document.getElementById('validityMainTitle');
    const validitySubText = document.getElementById('validitySubText');
    const validityDetailsBox = document.getElementById('validityDetailsBox');

    const valDetailToday = document.getElementById('valDetailToday');
    const valDetailRemaining = document.getElementById('valDetailRemaining');
    const valDetailMinRequired = document.getElementById('valDetailMinRequired');
    const valDetailDivergent = document.getElementById('valDetailDivergent');
    const valDivergentContainer = document.getElementById('valDivergentContainer');

    function processarCalculoValidade() {
        const valDataStr = inputDataValidade.value;
        if (!valDataStr) {
            validityStatusBox.className = 'validity-result-box empty';
            validityBadge.innerText = 'Aguardando Data';
            validityMainTitle.innerText = 'Selecione uma data para verificar a conformidade';
            validitySubText.innerText = 'O cálculo verificará os dias restantes a partir de hoje em relação ao tempo mínimo exigido pelo setor.';
            validityDetailsBox.style.display = 'none';
            return;
        }

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const partesData = valDataStr.split('-');
        const dataValidade = new Date(partesData[0], partesData[1] - 1, partesData[2]);

        const diffTempoMs = dataValidade.getTime() - hoje.getTime();
        const diffDias = Math.ceil(diffTempoMs / (1000 * 60 * 60 * 24));

        const setor = selectEstoque.value;
        let minDiasExigidos = 365;
        let textoMinExigido = '1 ano (365 dias)';

        if (setor === 'almox_lab') {
            minDiasExigidos = 90;
            textoMinExigido = '3 meses (90 dias)';
        }

        const dataFormatadaHoje = hoje.toLocaleDateString('pt-BR');
        valDetailToday.innerText = dataFormatadaHoje;
        valDetailMinRequired.innerText = textoMinExigido;

        validityDetailsBox.style.display = 'block';

        if (diffDias < 0) {
            validityStatusBox.className = 'validity-result-box invalid';
            validityBadge.innerText = 'INVÁLIDO / PRODUTO VENCIDO';
            validityMainTitle.innerText = 'Produto fora do prazo (Já vencido)';
            validitySubText.innerText = `A data de validade informada venceu há ${Math.abs(diffDias)} dia(s).`;
            
            valDetailRemaining.innerText = `${diffDias} dias (Vencido)`;
            valDetailDivergent.innerText = `Vencido há ${Math.abs(diffDias)} dia(s)`;
            valDivergentContainer.style.display = 'flex';
        } else if (diffDias >= minDiasExigidos) {
            validityStatusBox.className = 'validity-result-box valid';
            validityBadge.innerText = 'VÁLIDO / CONFORME';
            validityMainTitle.innerText = 'Produto dentro do prazo estipulado';
            validitySubText.innerText = `A validade atende aos requisitos mínimos de ${textoMinExigido} do setor selecionado.`;

            valDetailRemaining.innerText = `${diffDias} dias restantes`;
            valDetailDivergent.innerText = 'Nenhuma (Conforme)';
            valDivergentContainer.style.display = 'none';
        } else {
            const diasFaltantes = minDiasExigidos - diffDias;
            validityStatusBox.className = 'validity-result-box invalid';
            validityBadge.innerText = 'INVÁLIDO / DIVERGENTE';
            validityMainTitle.innerText = 'Validade abaixo do mínimo exigido';
            validitySubText.innerText = `O produto tem apenas ${diffDias} dias de validade, mas o setor exige pelo menos ${textoMinExigido}.`;

            valDetailRemaining.innerText = `${diffDias} dias restantes`;
            valDetailDivergent.innerText = `Faltam ${diasFaltantes} dia(s) para atingir o mínimo de ${textoMinExigido}`;
            valDivergentContainer.style.display = 'flex';
        }
    }

    if (inputDataValidade) inputDataValidade.addEventListener('change', processarCalculoValidade);
    if (selectEstoque) selectEstoque.addEventListener('change', processarCalculoValidade);
});