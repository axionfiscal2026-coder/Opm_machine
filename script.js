// Estado atual do perfil selecionado ('notas' ou 'gestao')
let perfilSelecionado = 'notas';

function mudarPerfil(tipo) {
    perfilSelecionado = tipo;
    const btnNotas = document.getElementById('btnPerfilNotas');
    const btnGestao = document.getElementById('btnPerfilGestao');
    const brandSubtitle = document.getElementById('brandSubtitle');
    const errorDiv = document.getElementById('errorMessage');

    if (errorDiv) errorDiv.style.display = 'none';

    if (tipo === 'notas') {
        btnNotas.classList.add('active');
        btnGestao.classList.remove('active');
        if (brandSubtitle) brandSubtitle.textContent = 'Central de Notas';
    } else {
        btnGestao.classList.add('active');
        btnNotas.classList.remove('active');
        if (brandSubtitle) brandSubtitle.textContent = 'Gestão';
    }
}

function toggleMostrarSenha() {
    const passInput = document.getElementById('password');
    const eyeIcon = document.getElementById('eyeIcon');

    if (passInput.type === 'password') {
        passInput.type = 'text';
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
    } else {
        passInput.type = 'password';
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
    }
}

// Função de Login integrada com o Firebase Authentication e Validação de Perfil
async function realizarLogin(e) {
    if (e && e.preventDefault) e.preventDefault();

    const userInput = document.getElementById('username').value.trim().toLowerCase();
    const passInput = document.getElementById('password').value.trim();
    const errorDiv = document.getElementById('errorMessage');

    // Verifica se o Firebase Auth foi inicializado corretamente no HTML
    if (!window.firebaseAuth) {
        console.error("Firebase Auth não inicializado.");
        if (errorDiv) {
            errorDiv.style.display = 'flex';
            errorDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Erro de conexão com o Firebase.`;
        }
        return;
    }

    try {
        // Importa a função de autenticação do Firebase dinamicamente
        const { signInWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js");

        // Autentica no Firebase com as credenciais informadas
        const userCredential = await signInWithEmailAndPassword(window.firebaseAuth, userInput, passInput);
        const user = userCredential.user;
        const emailLogado = user.email.toLowerCase();

        // 🔒 TRAVA DE SEGURANÇA DE PERFIS:
        // Valida se o e-mail autenticado corresponde estritamente ao perfil selecionado na tela
        if (perfilSelecionado === 'notas' && emailLogado !== 'centralnotas@opm.com') {
            if (errorDiv) {
                errorDiv.style.display = 'flex';
                errorDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Este usuário não pertence ao perfil Central de Notas!`;
            }
            return;
        }

        if (perfilSelecionado === 'gestao' && emailLogado !== 'gestao@opm.com') {
            if (errorDiv) {
                errorDiv.style.display = 'flex';
                errorDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Este usuário não pertence ao perfil Gestão!`;
            }
            return;
        }

        // Se passou em todas as validações, oculta erros
        if (errorDiv) errorDiv.style.display = 'none';

        // Salva os dados na sessão local do navegador
        localStorage.setItem('opm_operador_logado', JSON.stringify({
            uid: user.uid,
            email: user.email,
            perfil: perfilSelecionado,
            dataLogin: new Date().toISOString()
        }));

        // Redireciona com base no perfil validado
        if (perfilSelecionado === 'notas') {
            window.location.href = './lobby/lobby.html';
        } else {
            window.location.href = './lobbyv2/lobbyv2.html';
        }

    } catch (error) {
        console.error("Erro no login do Firebase:", error.code);
        if (errorDiv) {
            errorDiv.style.display = 'flex';
            errorDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> E-mail ou senha incorretos!`;
        }
    }
}