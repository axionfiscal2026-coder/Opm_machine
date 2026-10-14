let paginaAtual = 0;
const totalCards = 2;
const cardsPorPagina = 2;
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

// Navegação de Módulos mapeada para as pastas solicitadas
function navegarPara(modulo) {
    switch (modulo) {
        case 'solicitacoes':
            window.location.href = '../gerenciamentofluxo/gerenciamentofluxo.html';
            break;
        case 'visao-geral':
            window.location.href = '../visaogeralv2/visaogeralv2.html';
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