// Navegação do botão do Topo
function voltarParaGestao() {
    window.location.href = '../lobby/lobby.html';
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) {
        lucide.createIcons();
    }

    // ==========================================
    // GERENCIAMENTO DE LEMBRETES (CADERNO)
    // ==========================================
    let notes = JSON.parse(localStorage.getItem('hooks_notes')) || [
        {
            id: 1,
            title: 'Lembrar de:',
            content: 'fazer testes nas notas fiscais',
            date: new Date().toLocaleDateString('pt-BR')
        }
    ];

    let activeNoteId = notes[0] ? notes[0].id : null;
    let termoPesquisa = '';

    const notesListEl = document.getElementById('notesList');
    const noteTitleEl = document.getElementById('noteTitle');
    const noteContentEl = document.getElementById('noteContent');
    const addNoteBtn = document.getElementById('addNoteBtn');

    const btnBold = document.getElementById('btnBold');
    const btnHighlight = document.getElementById('btnHighlight');

    const btnTextColor = document.getElementById('btnTextColor');
    const colorPopover = document.getElementById('colorPopover');
    const colorIndicator = document.getElementById('colorIndicator');
    const colorCircles = document.querySelectorAll('.color-circle');

    // ELEMENTOS DE PESQUISA INTERNA DO CADERNO
    const btnToggleSearch = document.getElementById('btnToggleSearch');
    const notebookSearchBox = document.getElementById('notebookSearchBox');
    const searchNoteInput = document.getElementById('searchNoteInput');

    if (btnToggleSearch) {
        btnToggleSearch.addEventListener('click', () => {
            notebookSearchBox.classList.toggle('active');
            if (notebookSearchBox.classList.contains('active')) {
                searchNoteInput.focus();
            } else {
                searchNoteInput.value = '';
                termoPesquisa = '';
                renderNotesList();
            }
        });
    }

    if (searchNoteInput) {
        searchNoteInput.addEventListener('input', (e) => {
            termoPesquisa = e.target.value.toLowerCase().trim();
            renderNotesList();
        });
    }

    function renderNotesList() {
        notesListEl.innerHTML = '';
        
        const notasFiltradas = notes.filter(n => {
            if (!termoPesquisa) return true;
            const t = (n.title || '').toLowerCase();
            const c = (n.content || '').toLowerCase();
            return t.includes(termoPesquisa) || c.includes(termoPesquisa);
        });

        notasFiltradas.forEach(note => {
            const tab = document.createElement('div');
            tab.className = `note-tab ${note.id === activeNoteId ? 'active' : ''}`;
            tab.innerHTML = `
                <div class="note-tab-info">
                    <span class="note-tab-title">${note.title || 'Sem Título'}</span>
                    <span class="note-tab-date">${note.date}</span>
                </div>
                <button class="btn-delete-note" data-id="${note.id}" title="Excluir"><i data-lucide="trash-2"></i></button>
            `;

            tab.addEventListener('click', (e) => {
                if (!e.target.closest('.btn-delete-note')) {
                    activeNoteId = note.id;
                    loadActiveNote();
                    renderNotesList();
                }
            });

            notesListEl.appendChild(tab);
        });

        if (window.lucide) lucide.createIcons();

        document.querySelectorAll('.btn-delete-note').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = Number(btn.getAttribute('data-id'));
                notes = notes.filter(n => n.id !== id);
                if (activeNoteId === id) {
                    activeNoteId = notes.length ? notes[0].id : null;
                }
                saveNotes();
                renderNotesList();
                loadActiveNote();
            });
        });
    }

    function loadActiveNote() {
        const currentNote = notes.find(n => n.id === activeNoteId);
        if (currentNote) {
            noteTitleEl.value = currentNote.title;
            noteContentEl.innerHTML = currentNote.content;
            noteTitleEl.disabled = false;
            noteContentEl.contentEditable = "true";
        } else {
            noteTitleEl.value = '';
            noteContentEl.innerHTML = '';
            noteTitleEl.disabled = true;
            noteContentEl.contentEditable = "false";
        }
        updateToolbarState();
    }

    function saveNotes() {
        localStorage.setItem('hooks_notes', JSON.stringify(notes));
    }

    if (noteTitleEl) {
        noteTitleEl.addEventListener('input', () => {
            const note = notes.find(n => n.id === activeNoteId);
            if (note) {
                note.title = noteTitleEl.value;
                saveNotes();
                renderNotesList();
            }
        });
    }

    if (noteContentEl) {
        noteContentEl.addEventListener('input', () => {
            const note = notes.find(n => n.id === activeNoteId);
            if (note) {
                note.content = noteContentEl.innerHTML;
                saveNotes();
            }
        });
    }

    if (addNoteBtn) {
        addNoteBtn.addEventListener('click', () => {
            const newNote = {
                id: Date.now(),
                title: 'Nova Anotação',
                content: '',
                date: new Date().toLocaleDateString('pt-BR')
            };
            notes.unshift(newNote);
            activeNoteId = newNote.id;
            saveNotes();
            renderNotesList();
            loadActiveNote();
        });
    }

    // ==========================================
    // FERRAMENTAS DE FORMATAÇÃO
    // ==========================================
    function updateToolbarState() {
        const isBold = document.queryCommandState('bold');
        if (btnBold) {
            if (isBold) btnBold.classList.add('active');
            else btnBold.classList.remove('active');
        }
    }

    [btnBold, btnHighlight, btnTextColor].forEach(btn => {
        if (btn) {
            btn.addEventListener('mousedown', (e) => e.preventDefault());
        }
    });

    if (btnBold) {
        btnBold.addEventListener('click', () => {
            noteContentEl.focus();
            document.execCommand('bold', false, null);
            updateToolbarState();
            saveNotes();
        });
    }

    if (btnHighlight) {
        btnHighlight.addEventListener('click', () => {
            noteContentEl.focus();
            const yellowColor = '#F2C438';
            const backColor = document.queryCommandValue('backColor');
            const isAlreadyHighlighted = backColor === 'rgb(242, 196, 56)' || backColor === '#F2C438';

            if (isAlreadyHighlighted) {
                document.execCommand('hiliteColor', false, 'transparent');
            } else {
                document.execCommand('hiliteColor', false, yellowColor);
            }

            saveNotes();
        });
    }

    if (btnTextColor) {
        btnTextColor.addEventListener('click', (e) => {
            e.stopPropagation();
            if (colorPopover) colorPopover.classList.toggle('active');
        });
    }

    document.addEventListener('click', (e) => {
        if (colorPopover && !colorPopover.contains(e.target) && e.target !== btnTextColor) {
            colorPopover.classList.remove('active');
        }
    });

    colorCircles.forEach(circle => {
        circle.addEventListener('mousedown', (e) => e.preventDefault());

        circle.addEventListener('click', () => {
            noteContentEl.focus();
            const selectedColor = circle.getAttribute('data-color');

            colorCircles.forEach(c => c.classList.remove('active'));
            circle.classList.add('active');

            if (selectedColor === 'default') {
                const themeMainColor = getComputedStyle(document.body).getPropertyValue('--text-main').trim();
                document.execCommand('foreColor', false, themeMainColor);
                if (colorIndicator) colorIndicator.style.backgroundColor = themeMainColor;
            } else {
                document.execCommand('foreColor', false, selectedColor);
                if (colorIndicator) colorIndicator.style.backgroundColor = selectedColor;
            }

            if (colorPopover) colorPopover.classList.remove('active');
            saveNotes();
        });
    });

    if (noteContentEl) {
        noteContentEl.addEventListener('keyup', updateToolbarState);
        noteContentEl.addEventListener('mouseup', updateToolbarState);
    }

    renderNotesList();
    loadActiveNote();
});