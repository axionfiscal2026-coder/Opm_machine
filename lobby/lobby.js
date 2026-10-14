let paginaAtual = 0;
const totalCards = 10;
const cardsPorPagina = 3;
const totalPaginas = Math.ceil(totalCards / cardsPorPagina);

document.addEventListener('DOMContentLoaded', () => {
    gerarPontosPaginacao();
    atualizarCarrossel();
});

// Atualiza o deslocamento visual do carrossel
function atualizarCarrossel() {
    const grid = document.getElementById('lobbyCardsGrid');
    const btnPrev = document.getElementById('btnPrevLobby');
    const btnNext = document.getElementById('btnNextLobby');

    if (!grid) return;

    // Calcula a porcentagem de deslocamento
    const porcentagemDeslocamento = paginaAtual * 100;
    const gapAjuste = paginaAtual * 24; // 24px de gap entre cards
    
    grid.style.transform = `translateX(calc(-${porcentagemDeslocamento}% - ${gapAjuste}px))`;

    // Atualiza estado dos botões transparentes das pontas
    if (btnPrev) btnPrev.disabled = paginaAtual === 0;
    if (btnNext) btnNext.disabled = paginaAtual >= totalPaginas - 1;

    atualizarPontos();
}

function mudarPaginaLobby(direcao) {
    paginaAtual += direcao;
    if (paginaAtual < 0) paginaAtual = 0;
    if (paginaAtual >= totalPaginas) paginaAtual = totalPaginas - 1;
    
    atualizarCarrossel();
}

function irParaPagina(index) {
    paginaAtual = index;
    atualizarCarrossel();
}

function gerarPontosPaginacao() {
    const dotsContainer = document.getElementById('dotsContainer');
    if (!dotsContainer) return;

    dotsContainer.innerHTML = '';
    for (let i = 0; i < totalPaginas; i++) {
        const dot = document.createElement('div');
        dot.className = `dot ${i === paginaAtual ? 'active' : ''}`;
        dot.onclick = () => irParaPagina(i);
        dotsContainer.appendChild(dot);
    }
}

function atualizarPontos() {
    const dots = document.querySelectorAll('.pagination-dots .dot');
    dots.forEach((dot, idx) => {
        if (idx === paginaAtual) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
}

// Navegação de Módulos mapeada com as pastas da estrutura de arquivos
function navegarPara(modulo) {
    switch (modulo) {
        case 'cronograma':
            window.location.href = '../cronograma/cronograma.html';
            break;
        case 'entrada-nf':
            window.location.href = '../entradanf/entradanf.html';
            break;
        case 'nf-finalizadas':
            window.location.href = '../nffinalizadas/nffinalizadas.html';
            break;
        case 'tratativas':
            window.location.href = '../tratativas/tratativas.html';
            break;
        case 'conferencia-devolucao':
            window.location.href = '../conferencia/conferencia.html';
            break;
        case 'visao-geral':
            window.location.href = '../visaogeral/visaogeral.html';
            break;
        case 'modelo-cartas':
            window.location.href = '../modelocartas/cartas.html';
            break;
        case 'calculadora':
            window.location.href = '../calculadora/calculadora.html';
            break;
        case 'painel-principal':
            window.location.href = '../painelprincipal/painelprincipal.html';
            break;
        case 'consulta-produtos':
            window.location.href = '../consultaprodutos/consultaprodutos.html';
            break;
        default:
            alert('Módulo em desenvolvimento.');
            break;
    }
}

function fazerLogout() {
    if (confirm("Deseja realmente sair do sistema?")) {
        window.location.href = '../index.html';
    }
}