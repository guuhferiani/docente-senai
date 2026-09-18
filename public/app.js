// ==========================================================================
// DOCENTE SENAI - STATE MANAGEMENT & LOCAL STORAGE
// Workflow: From Scratch (File Upload / Direct Input)
// ==========================================================================

const STORAGE_KEY = 'docente_senai_state_v3';
const GEMINI_STORAGE_KEY = 'docente_senai_gemini_key';

function getGeminiApiKey() {
    return localStorage.getItem(GEMINI_STORAGE_KEY) || localStorage.getItem('docente_senai_groq_key') || '';
}

function setGeminiApiKey(key) {
    if (key && key.trim()) {
        localStorage.setItem(GEMINI_STORAGE_KEY, key.trim());
    } else {
        localStorage.removeItem(GEMINI_STORAGE_KEY);
        localStorage.removeItem('docente_senai_groq_key');
    }
}

async function checkGeminiStatus() {
    const localKey = getGeminiApiKey();
    const dot = document.getElementById('ai-header-dot');
    const text = document.getElementById('ai-header-text');

    try {
        const res = await fetch('/api/ai-status');
        const data = await res.json();
        const hasKey = (localKey && localKey.trim().length > 10) || data.geminiConfigured;
        
        if (hasKey) {
            if (dot) dot.className = 'ai-pulse-dot active';
            if (text) text.textContent = '🟢 IA Gemini Ativa';
        } else {
            if (dot) dot.className = 'ai-pulse-dot';
            if (text) text.textContent = '⚡ Ativar IA (Gemini)';
        }
        return hasKey;
    } catch (e) {
        if (localKey && localKey.trim().length > 10) {
            if (dot) dot.className = 'ai-pulse-dot active';
            if (text) text.textContent = '🟢 IA Gemini Ativa';
            return true;
        }
        if (dot) dot.className = 'ai-pulse-dot';
        if (text) text.textContent = '⚡ Ativar IA (Gemini)';
        return false;
    }
}

async function updateModalAiStatus() {
    const localKey = getGeminiApiKey();
    const modalDot = document.getElementById('ai-modal-dot');
    const modalTitle = document.getElementById('ai-modal-title');
    const modalDesc = document.getElementById('ai-modal-desc');

    try {
        const res = await fetch('/api/ai-status');
        const data = await res.json();
        
        if (data.geminiConfigured) {
            if (modalDot) modalDot.className = 'status-indicator-dot active';
            if (modalTitle) modalTitle.textContent = 'Conectado via Servidor (.env)';
            if (modalDesc) modalDesc.textContent = 'A chave GEMINI_API_KEY do servidor está configurada e ativa.';
        } else if (localKey && localKey.length > 10) {
            if (modalDot) modalDot.className = 'status-indicator-dot active';
            if (modalTitle) modalTitle.textContent = 'Conectado via Navegador (LocalStorage)';
            if (modalDesc) modalDesc.textContent = 'Chave do Google Gemini salva no seu navegador.';
        } else {
            if (modalDot) modalDot.className = 'status-indicator-dot';
            if (modalTitle) modalTitle.textContent = 'Modo Heurístico Multiárea (Offline)';
            if (modalDesc) modalDesc.textContent = 'Insira uma chave do Google Gemini abaixo para ativar a geração por IA.';
        }
    } catch (e) {
        if (localKey && localKey.length > 10) {
            if (modalDot) modalDot.className = 'status-indicator-dot active';
            if (modalTitle) modalTitle.textContent = 'Chave Local Configurada';
            if (modalDesc) modalDesc.textContent = 'Pronto para envio.';
        }
    }
}

let currentStep = 1;
let currentCourseData = {
    courseKey: "custom",
    courseName: "",             // Nome do Curso Matriz / Habilitação Profissional
    courseUnit: "",             // Nome da Unidade Curricular específica
    unitSigla: "",
    cursoTipo: "tecnico",       // 'tecnico' | 'cai' | 'fic' | 'superior'
    duracaoAula: 45,            // 45 para Técnico; 60 para CAI, FIC e Superior
    numAulas: "",               // Ex: "107 aulas de 45 minutos cada"
    modalidade: "presencial",   // 'presencial' | 'semipresencial'
    aulasPresenciais: "",
    aulasEad: "",
    objetivoUC: "",             // Preenchido pelo professor ou IA
    workload: "",
    turma: "",
    semAno: "",
    docente: "",
    escola: 'Escola SENAI "Mariano Ferraz"',
    fileName: null,
    detectedUCs: [],            // UCs extraídas da matriz do curso
    semestresEstrutura: null,    // 3 ou 4 semestres
    hasRemotoEstrutura: false
};
let currentMsepPlan = null;

function getDefaultDurationForTipo(tipo) {
    return (tipo === 'tecnico') ? 45 : 60;
}

// ==============================================================================
// Pedagogical Hours & Classes Conversion Helpers (Book MSEP)
// ==============================================================================
function calculateClasses(workloadHours, classDurationMinutes) {
    const hours = parseInt(workloadHours) || 0;
    const duration = parseInt(classDurationMinutes) || 45;
    if (!hours || hours <= 0) return 0;
    return Math.round((hours * 60) / duration);
}

function updateClassCalculationUI() {
    const inpWorkload = document.getElementById('inp-workload');
    const hours = inpWorkload && inpWorkload.value ? parseInt(inpWorkload.value) : 0;
    
    const selectDuracao = document.getElementById('select-duracao-aula');
    const defaultDur = getDefaultDurationForTipo(currentCourseData.cursoTipo || 'tecnico');
    const duracao = selectDuracao ? parseInt(selectDuracao.value) : (currentCourseData.duracaoAula || defaultDur);
    
    const badge = document.getElementById('badge-calc-result');
    const explanation = document.getElementById('calc-explanation-text');
    
    if (!hours || hours <= 0) {
        if (badge) {
            badge.textContent = "Informe a carga horária acima";
            badge.style.background = "#f1f5f9";
            badge.style.color = "#64748b";
            badge.style.borderColor = "#cbd5e1";
        }
        if (explanation) {
            explanation.innerHTML = `Cursos Técnicos são calculados em <strong>aulas de 45 minutos</strong>. Cursos CAI (Aprendizagem), FIC e Superior utilizam <strong>aulas de 60 minutos</strong>.`;
        }
        updateEadBreakdownSummary(0);
        return;
    }

    const totalAulas = calculateClasses(hours, duracao);
    let numAulasFormatted = `${totalAulas} aulas de ${duracao} minutos cada`;
    
    if (currentCourseData.modalidade === 'semipresencial') {
        const pres = parseInt(document.getElementById('inp-aulas-presenciais')?.value) || 0;
        const ead = parseInt(document.getElementById('inp-aulas-ead')?.value) || 0;
        if (pres || ead) {
            numAulasFormatted += ` (Presencial: ${pres} | Não Presencial: ${ead})`;
        }
    }
    
    currentCourseData.numAulas = numAulasFormatted;
    currentCourseData.duracaoAula = duracao;

    if (badge) {
        badge.innerHTML = `<strong>${hours}h</strong> = <strong style="font-size: 1rem;">${totalAulas} aulas</strong> (${duracao} min/aula)`;
        badge.style.background = "#d1fae5";
        badge.style.color = "#065f46";
        badge.style.borderColor = "#a7f3d0";
    }

    const tipoLabels = {
        tecnico: 'Curso Técnico (45 min)',
        cai: 'Aprendizagem Industrial - CAI (60 min)',
        fic: 'Formação Inicial e Continuada - FIC (60 min)',
        superior: 'Ensino Superior (60 min)'
    };
    const tipoLabel = tipoLabels[currentCourseData.cursoTipo] || 'Oficial SENAI';
    if (explanation) {
        explanation.innerHTML = `Equivalência Oficial MSEP (${tipoLabel}): ${hours}h × 60 min ÷ ${duracao} min = <strong>${totalAulas} aulas</strong> no Plano de Ensino.`;
    }

    updateEadBreakdownSummary(totalAulas);
}

// Condicional de Campos (Ajuste 2: IRRAC exclusivo para FIC; SGE para CAI/CT/Superior)
function applyModalityConditionals(tipo) {
    const isFic = (tipo === 'fic');
    const badgeSigla = document.getElementById('badge-sigla-fic-only');
    const helpSigla = document.getElementById('help-unit-sigla');
    const inpSigla = document.getElementById('inp-unit-sigla');

    if (inpSigla) {
        if (isFic) {
            inpSigla.placeholder = "Ex: DEV-SIST ou BANC-DADOS";
            if (badgeSigla) badgeSigla.style.display = 'inline-block';
            if (helpSigla) helpSigla.style.display = 'none';
        } else {
            inpSigla.placeholder = "(Opcional - Cursos regulares usam diário do SGE)";
            if (badgeSigla) badgeSigla.style.display = 'none';
            if (helpSigla) helpSigla.style.display = 'block';
        }
    }

    // Step 4 IRRAC Export Card
    const cardIrrac = document.getElementById('card-export-irrac');
    const noticeIrrac = document.getElementById('irrac-notice-banner');
    const btnIrrac = document.getElementById('btn-download-xlsx');

    if (cardIrrac && btnIrrac) {
        if (isFic) {
            cardIrrac.classList.remove('disabled');
            if (noticeIrrac) noticeIrrac.style.display = 'none';
            btnIrrac.disabled = false;
            btnIrrac.title = "Baixar Planilha IRRAC Oficial (.xlsx)";
        } else {
            cardIrrac.classList.add('disabled');
            if (noticeIrrac) noticeIrrac.style.display = 'block';
            btnIrrac.disabled = true;
            btnIrrac.title = "Planilha IRRAC exclusiva para FIC. Cursos regulares utilizam diário do SGE.";
        }
    }
}

// Render dynamic clickable UC chips
function renderUCChips() {
    const wrapper = document.getElementById('uc-selection-wrapper');
    const container = document.getElementById('uc-chips-container');
    const badgeEstrutura = document.getElementById('uc-structure-badge');

    if (!wrapper || !container) return;

    if (!currentCourseData.detectedUCs || currentCourseData.detectedUCs.length === 0) {
        wrapper.style.display = 'none';
        return;
    }

    wrapper.style.display = 'block';

    // Show course structure (3 vs 4 semestres, EaD)
    if (badgeEstrutura) {
        if (currentCourseData.semestresEstrutura) {
            badgeEstrutura.style.display = 'inline-flex';
            const eadText = currentCourseData.hasRemotoEstrutura ? ' • com EaD / Remoto' : '';
            badgeEstrutura.textContent = `Estrutura: ${currentCourseData.semestresEstrutura} Semestres${eadText}`;
        } else {
            badgeEstrutura.style.display = 'none';
        }
    }

    container.innerHTML = currentCourseData.detectedUCs.map((uc, idx) => {
        const isSelected = (currentCourseData.courseUnit && currentCourseData.courseUnit.toLowerCase() === uc.nome.toLowerCase());
        const hasEad = (uc.remotoHoras && uc.remotoHoras > 0) || uc.hasRemoto;
        return `
            <div class="uc-chip ${isSelected ? 'active' : ''}" data-uc-idx="${idx}">
                <span class="uc-chip-name">${uc.nome}</span>
                <span class="uc-chip-hours">${uc.cargaHoraria}h</span>
                ${hasEad ? `<span class="uc-chip-badge-ead">EaD ${uc.remotoHoras ? `(${uc.remotoHoras}h)` : ''}</span>` : ''}
            </div>
        `;
    }).join('');

    container.querySelectorAll('.uc-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const idx = parseInt(chip.getAttribute('data-uc-idx'));
            const uc = currentCourseData.detectedUCs[idx];
            if (uc) {
                selectCourseUnit(uc);
                showToast(`UC selecionada: "${uc.nome}" (${uc.cargaHoraria}h)`);
            }
        });
    });
}

// Select a UC from detected list
function selectCourseUnit(uc) {
    if (!uc || !uc.nome) return;
    currentCourseData.courseUnit = uc.nome;
    currentCourseData.workload = uc.cargaHoraria || 80;
    currentCourseData.unitSigla = generateSigla(uc.nome);

    // Populate input fields
    const inpUnit = document.getElementById('inp-course-unit');
    if (inpUnit) inpUnit.value = uc.nome;

    const inpWorkload = document.getElementById('inp-workload');
    if (inpWorkload) inpWorkload.value = uc.cargaHoraria || 80;

    const inpSigla = document.getElementById('inp-unit-sigla');
    if (inpSigla) inpSigla.value = currentCourseData.unitSigla;

    // Check remote hours (Ajuste 4)
    const hasRemote = (uc.remotoHoras && uc.remotoHoras > 0) || uc.hasRemoto;
    const btnModPresencial = document.getElementById('btn-mod-presencial');
    const btnModSemipresencial = document.getElementById('btn-mod-semipresencial');
    const eadBox = document.getElementById('ead-breakdown-box');

    if (hasRemote) {
        currentCourseData.modalidade = 'semipresencial';
        if (btnModSemipresencial) btnModSemipresencial.classList.add('active');
        if (btnModPresencial) btnModPresencial.classList.remove('active');
        if (eadBox) eadBox.style.display = 'block';

        const totalAulas = calculateClasses(uc.cargaHoraria, currentCourseData.duracaoAula || 45);
        const eadHours = uc.remotoHoras || Math.round(uc.cargaHoraria * 0.2);
        const eadAulas = calculateClasses(eadHours, currentCourseData.duracaoAula || 45);
        const presAulas = Math.max(0, totalAulas - eadAulas);

        currentCourseData.aulasEad = eadAulas;
        currentCourseData.aulasPresenciais = presAulas;

        const inpPres = document.getElementById('inp-aulas-presenciais');
        const inpEad = document.getElementById('inp-aulas-ead');
        if (inpPres) inpPres.value = presAulas;
        if (inpEad) inpEad.value = eadAulas;
    } else {
        currentCourseData.modalidade = 'presencial';
        if (btnModPresencial) btnModPresencial.classList.add('active');
        if (btnModSemipresencial) btnModSemipresencial.classList.remove('active');
        if (eadBox) eadBox.style.display = 'none';

        currentCourseData.aulasEad = '';
        currentCourseData.aulasPresenciais = '';
        const inpPres = document.getElementById('inp-aulas-presenciais');
        const inpEad = document.getElementById('inp-aulas-ead');
        if (inpPres) inpPres.value = '';
        if (inpEad) inpEad.value = '';
    }

    renderUCChips();
    updateClassCalculationUI();
    saveToLocalStorage();
}

function updateEadBreakdownSummary(totalAulas) {
    const eadBox = document.getElementById('ead-breakdown-box');
    if (!eadBox || eadBox.style.display === 'none') return;

    const inpPres = document.getElementById('inp-aulas-presenciais');
    const inpEad = document.getElementById('inp-aulas-ead');
    const pres = parseInt(inpPres?.value) || 0;
    const ead = parseInt(inpEad?.value) || 0;
    const sum = pres + ead;
    
    const pill = document.getElementById('ead-summary-pill');
    const display = document.getElementById('ead-total-display');
    
    if (display) {
        display.textContent = `${sum} / ${totalAulas} aulas distribuídas (${pres} presencial + ${ead} EaD)`;
    }
    if (pill) {
        if (sum === totalAulas && totalAulas > 0) {
            pill.className = 'ead-summary-pill balanced';
            pill.title = 'A soma das aulas bate exatamente com o total!';
        } else {
            pill.className = 'ead-summary-pill unbalanced';
            pill.title = `Diferença: faltam ou sobram ${Math.abs(totalAulas - sum)} aulas na distribuição`;
        }
    }
}


// Dynamic Semester / Year Helpers & Custom Floating Selects
function getAutoSemestreAno() {
    const now = new Date();
    const sem = (now.getMonth() < 6) ? "1º Sem" : "2º Sem";
    const ano = String(now.getFullYear());
    return { sem, ano, formatted: `${sem}/${ano}` };
}

function updateSemAnoCombined() {
    const wrapSem = document.getElementById('wrap-semestre');
    const wrapAno = document.getElementById('wrap-ano');
    const inp = document.getElementById('inp-sem-ano');

    const sem = wrapSem ? (wrapSem.getAttribute('data-selected-val') || '2º Sem') : '2º Sem';
    const ano = wrapAno ? (wrapAno.getAttribute('data-selected-val') || String(new Date().getFullYear())) : String(new Date().getFullYear());

    const combined = `${sem}/${ano}`;
    if (inp) inp.value = combined;
    currentCourseData.semAno = combined;
    syncCourseDataFromInputs();
    saveToLocalStorage();
}

function initSemestreAnoOptions() {
    const anoContainer = document.getElementById('ano-options-menu');
    if (!anoContainer) return;

    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear - 2; y <= currentYear + 4; y++) {
        years.push(y);
    }

    anoContainer.innerHTML = years.map(y => `
        <div class="custom-select-item ${y === currentYear ? 'active' : ''}" data-val="${y}">
            <div class="item-title">${y}</div>
        </div>
    `).join('');

    // Attach click listeners to Semestre custom dropdown items
    document.querySelectorAll('#wrap-semestre .custom-select-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const val = item.getAttribute('data-val');
            const label = item.querySelector('.item-title').textContent.trim();

            const wrap = document.getElementById('wrap-semestre');
            if (wrap) {
                wrap.setAttribute('data-selected-val', val);
                const labelEl = document.getElementById('label-semestre');
                if (labelEl) labelEl.textContent = label;
                wrap.querySelectorAll('.custom-select-item').forEach(it => it.classList.remove('active'));
                item.classList.add('active');
                wrap.classList.remove('open');
            }

            updateSemAnoCombined();
        });
    });

    // Attach click listeners to Ano custom dropdown items
    document.querySelectorAll('#wrap-ano .custom-select-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const val = item.getAttribute('data-val');
            const label = item.querySelector('.item-title').textContent.trim();

            const wrap = document.getElementById('wrap-ano');
            if (wrap) {
                wrap.setAttribute('data-selected-val', val);
                const labelEl = document.getElementById('label-ano');
                if (labelEl) labelEl.textContent = label;
                wrap.querySelectorAll('.custom-select-item').forEach(it => it.classList.remove('active'));
                item.classList.add('active');
                wrap.classList.remove('open');
            }

            updateSemAnoCombined();
        });
    });

    // Attach trigger listeners
    ['trigger-semestre', 'trigger-ano'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const wrap = btn.closest('.custom-select-wrap');
                const isOpen = wrap.classList.contains('open');
                document.querySelectorAll('.custom-select-wrap.open').forEach(w => {
                    if (w !== wrap) w.classList.remove('open');
                });
                wrap.classList.toggle('open', !isOpen);
            });
        }
    });
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initSemestreAnoOptions();
    initEventListeners();
    checkGeminiStatus();

    // Check for saved local state
    const hasSavedState = loadFromLocalStorage();
    if (hasSavedState && currentCourseData && (currentCourseData.courseName || currentCourseData.fileName || currentMsepPlan)) {
        populateStep2Inputs();
        updateStep1FileCard();
        if (currentMsepPlan) {
            renderMSEPViewer();
            renderExportAndDocView();
        }
        goToStep(currentStep || 1, false);
        setStorageStatus('Rascunho recuperado', true);
    } else {
        resetFormToBlank();
        goToStep(1, false);
    }
});

// Event Listeners Initialization
function initEventListeners() {
    // Stepper buttons
    document.querySelectorAll('.step-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const step = parseInt(btn.dataset.step);
            goToStep(step);
        });
    });

    // Step 1 Continue Button
    document.getElementById('btn-step1-continue').addEventListener('click', () => {
        goToStep(2);
    });

    // Dropzone & File Upload
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const btnBrowse = document.getElementById('btn-browse-file');

    btnBrowse.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });

    // Remove attached file button
    const btnRemoveFile = document.getElementById('btn-remove-attached-file');
    if (btnRemoveFile) {
        btnRemoveFile.addEventListener('click', (e) => {
            e.stopPropagation();
            handleRemoveAttachedFile();
        });
    }

    // Step 2 live input listeners for real-time saving
    const step2Inputs = [
        'inp-course-name', 'inp-course-unit', 'inp-unit-sigla', 'inp-workload', 'inp-school',
        'inp-docente', 'inp-turma', 'inp-sem-ano', 'inp-objetivo-uc',
        'inp-aulas-presenciais', 'inp-aulas-ead'
    ];
    step2Inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                if (id === 'inp-workload' || id === 'inp-aulas-presenciais' || id === 'inp-aulas-ead') {
                    updateClassCalculationUI();
                }
                syncCourseDataFromInputs();
                saveToLocalStorage();
            });
        }
    });

    // Course Type Card Selection (Técnico / CAI / FIC / Superior)
    document.querySelectorAll('.course-type-card').forEach(card => {
        card.addEventListener('click', () => {
            const radio = card.querySelector('input[type="radio"]');
            if (radio) {
                radio.checked = true;
                const val = radio.value;
                document.querySelectorAll('.course-type-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                currentCourseData.cursoTipo = val;
                
                const defaultDur = getDefaultDurationForTipo(val);
                const selectDuracao = document.getElementById('select-duracao-aula');
                if (selectDuracao) {
                    selectDuracao.value = String(defaultDur);
                    currentCourseData.duracaoAula = defaultDur;
                }
                applyModalityConditionals(val);
                updateClassCalculationUI();
                syncCourseDataFromInputs();
                saveToLocalStorage();
            }
        });
    });

    // Class Duration Custom Selector
    const selectDuracao = document.getElementById('select-duracao-aula');
    if (selectDuracao) {
        selectDuracao.addEventListener('change', () => {
            currentCourseData.duracaoAula = parseInt(selectDuracao.value);
            updateClassCalculationUI();
            syncCourseDataFromInputs();
            saveToLocalStorage();
        });
    }

    // Modalidade Toggle (Presencial vs Semipresencial com EaD)
    const btnModPresencial = document.getElementById('btn-mod-presencial');
    const btnModSemipresencial = document.getElementById('btn-mod-semipresencial');
    const eadBox = document.getElementById('ead-breakdown-box');

    if (btnModPresencial && btnModSemipresencial) {
        btnModPresencial.addEventListener('click', () => {
            btnModPresencial.classList.add('active');
            btnModSemipresencial.classList.remove('active');
            currentCourseData.modalidade = 'presencial';
            if (eadBox) eadBox.style.display = 'none';
            updateClassCalculationUI();
            syncCourseDataFromInputs();
            saveToLocalStorage();
        });

        btnModSemipresencial.addEventListener('click', () => {
            btnModSemipresencial.classList.add('active');
            btnModPresencial.classList.remove('active');
            currentCourseData.modalidade = 'semipresencial';
            if (eadBox) eadBox.style.display = 'block';

            // Auto-calculate suggested 80% Presencial / 20% EaD if empty
            const rawHours = document.getElementById('inp-workload')?.value;
            const hours = rawHours ? parseInt(rawHours) : 0;
            const dur = parseInt(document.getElementById('select-duracao-aula')?.value) || 45;
            const total = calculateClasses(hours, dur);
            const inpPres = document.getElementById('inp-aulas-presenciais');
            const inpEad = document.getElementById('inp-aulas-ead');
            if (inpPres && inpEad && (!inpPres.value && !inpEad.value) && total > 0) {
                inpPres.value = Math.round(total * 0.8);
                inpEad.value = total - parseInt(inpPres.value);
            }
            updateClassCalculationUI();
            syncCourseDataFromInputs();
            saveToLocalStorage();
        });
    }

    // Navigation buttons
    document.getElementById('btn-back-step-1').addEventListener('click', () => goToStep(1));
    document.getElementById('btn-generate-msep-flow').addEventListener('click', handleGenerateMSEP);
    document.getElementById('btn-proceed-export').addEventListener('click', () => {
        syncMsepPlanFromUI();
        saveToLocalStorage();
        renderExportAndDocView();
        goToStep(4);
    });

    // Dynamic SA Control: Add new SA
    document.getElementById('btn-add-sa').addEventListener('click', handleAddNewSA);

    // Export buttons
    document.getElementById('btn-download-xlsx').addEventListener('click', handleDownloadIRRAC);
    document.getElementById('btn-print-plano').addEventListener('click', () => {
        const originalTitle = document.title;
        const cleanName = (currentCourseData.courseName || 'SENAI_MSEP').replace(/[^a-zA-Z0-9-_]/g, '_');
        document.title = `Plano de Ensino - ${cleanName}`;
        window.print();
        setTimeout(() => {
            document.title = originalTitle;
        }, 1000);
    });
    document.getElementById('btn-toggle-plano-preview').addEventListener('click', () => {
        const docView = document.getElementById('official-doc-view');
        docView.scrollIntoView({ behavior: 'smooth' });
    });

    // Header Reset Action
    const btnReset = document.getElementById('btn-reset-plan');
    if (btnReset) {
        btnReset.addEventListener('click', handleResetPlan);
    }

    // AI Modal Handlers (Google Gemini)
    const btnAiConfig = document.getElementById('btn-ai-config');
    const modalAi = document.getElementById('modal-ai-config');
    const btnCloseAi = document.getElementById('btn-close-ai-modal');
    const btnToggleKey = document.getElementById('btn-toggle-key');
    const inpGeminiKey = document.getElementById('inp-gemini-key');
    const btnTestGemini = document.getElementById('btn-test-gemini-key');
    const btnSaveGemini = document.getElementById('btn-save-gemini-key');
    const aiTestResult = document.getElementById('ai-test-result');

    if (btnAiConfig && modalAi) {
        btnAiConfig.addEventListener('click', () => {
            if (inpGeminiKey) inpGeminiKey.value = getGeminiApiKey() || '';
            if (aiTestResult) aiTestResult.style.display = 'none';
            updateModalAiStatus();
            modalAi.style.display = 'flex';
        });
    }

    if (btnCloseAi && modalAi) {
        btnCloseAi.addEventListener('click', () => {
            modalAi.style.display = 'none';
        });
    }

    if (modalAi) {
        modalAi.addEventListener('click', (e) => {
            if (e.target === modalAi) {
                modalAi.style.display = 'none';
            }
        });
    }

    if (btnToggleKey && inpGeminiKey) {
        btnToggleKey.addEventListener('click', () => {
            inpGeminiKey.type = (inpGeminiKey.type === 'password') ? 'text' : 'password';
        });
    }

    if (btnTestGemini && inpGeminiKey && aiTestResult) {
        btnTestGemini.addEventListener('click', async () => {
            const key = inpGeminiKey.value.trim();
            aiTestResult.style.display = 'block';
            aiTestResult.className = 'ai-test-alert loading';
            aiTestResult.innerHTML = '⏳ Conectando à API do Google Gemini...';

            try {
                const res = await fetch('/api/test-gemini', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey: key })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    aiTestResult.className = 'ai-test-alert success';
                    aiTestResult.innerHTML = `✅ <strong>Conexão bem-sucedida!</strong><br>${data.message}`;
                } else {
                    aiTestResult.className = 'ai-test-alert error';
                    aiTestResult.innerHTML = `❌ <strong>Erro na conexão:</strong> ${data.error || 'Chave inválida'}`;
                }
            } catch (e) {
                aiTestResult.className = 'ai-test-alert error';
                aiTestResult.innerHTML = `❌ <strong>Erro de rede:</strong> ${e.message}`;
            }
        });
    }

    if (btnSaveGemini && inpGeminiKey && modalAi) {
        btnSaveGemini.addEventListener('click', async () => {
            const key = inpGeminiKey.value.trim();
            setGeminiApiKey(key);
            await checkGeminiStatus();
            modalAi.style.display = 'none';
            showToast(key ? '✨ Chave do Google Gemini salva com sucesso! IA Ativa.' : 'Chave removida. Modo Heurístico ativado.');
        });
    }

    // Global click outside listener to close custom dropdowns
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-select-wrap')) {
            document.querySelectorAll('.custom-select-wrap.open').forEach(w => w.classList.remove('open'));
        }
    });
}

// Step Navigation
function goToStep(stepNumber, shouldSave = true) {
    currentStep = stepNumber;

    document.querySelectorAll('.step-btn').forEach(btn => {
        const step = parseInt(btn.dataset.step);
        if (step === currentStep) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    document.querySelectorAll('.step-view').forEach(view => {
        view.classList.remove('active');
    });

    const targetView = document.getElementById(`step-${currentStep}`);
    if (targetView) {
        targetView.classList.add('active');
    }

    if (shouldSave) {
        saveToLocalStorage();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Reset form to clean state
function resetFormToBlank() {
    const auto = getAutoSemestreAno();
    currentCourseData = {
        courseKey: "custom",
        courseName: "",
        courseUnit: "",
        unitSigla: "",
        cursoTipo: "tecnico",
        duracaoAula: 45,
        numAulas: "",
        modalidade: "presencial",
        aulasPresenciais: "",
        aulasEad: "",
        objetivoUC: "",
        workload: "",
        turma: "",
        semAno: auto.formatted,
        docente: "",
        escola: 'Escola SENAI "Mariano Ferraz"',
        fileName: null,
        detectedUCs: [],
        semestresEstrutura: null,
        hasRemotoEstrutura: false
    };
    currentMsepPlan = null;
    populateStep2Inputs();
    updateStep1FileCard();
}

// Populate Step 2 Inputs from state
function populateStep2Inputs() {
    const inpName = document.getElementById('inp-course-name');
    if (inpName) inpName.value = currentCourseData.courseName || '';

    const inpUnit = document.getElementById('inp-course-unit');
    if (inpUnit) inpUnit.value = currentCourseData.courseUnit || '';

    document.getElementById('inp-unit-sigla').value = currentCourseData.unitSigla || '';
    document.getElementById('inp-workload').value = currentCourseData.workload || '';
    document.getElementById('inp-school').value = currentCourseData.escola || 'Escola SENAI "Mariano Ferraz"';
    document.getElementById('inp-docente').value = currentCourseData.docente || '';
    document.getElementById('inp-turma').value = currentCourseData.turma || '';
    
    // Objetivo da UC
    const inpObj = document.getElementById('inp-objetivo-uc');
    if (inpObj) inpObj.value = currentCourseData.objetivoUC || '';

    // Course Type Radio Cards (Técnico / CAI / FIC / Superior)
    const selectedTipo = currentCourseData.cursoTipo || 'tecnico';
    document.querySelectorAll('.course-type-card').forEach(card => {
        const radio = card.querySelector('input[type="radio"]');
        if (radio && radio.value === selectedTipo) {
            radio.checked = true;
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });

    // Duração da aula
    const selectDuracao = document.getElementById('select-duracao-aula');
    if (selectDuracao) {
        selectDuracao.value = String(currentCourseData.duracaoAula || getDefaultDurationForTipo(selectedTipo));
    }

    // Modalidade (Presencial vs Semipresencial)
    const btnModPresencial = document.getElementById('btn-mod-presencial');
    const btnModSemipresencial = document.getElementById('btn-mod-semipresencial');
    const eadBox = document.getElementById('ead-breakdown-box');
    const isSemi = (currentCourseData.modalidade === 'semipresencial');

    if (btnModPresencial && btnModSemipresencial) {
        if (isSemi) {
            btnModSemipresencial.classList.add('active');
            btnModPresencial.classList.remove('active');
            if (eadBox) eadBox.style.display = 'block';
        } else {
            btnModPresencial.classList.add('active');
            btnModSemipresencial.classList.remove('active');
            if (eadBox) eadBox.style.display = 'none';
        }
    }

    // Aulas presenciais e EaD
    const inpPres = document.getElementById('inp-aulas-presenciais');
    const inpEad = document.getElementById('inp-aulas-ead');
    if (inpPres) inpPres.value = currentCourseData.aulasPresenciais || '';
    if (inpEad) inpEad.value = currentCourseData.aulasEad || '';

    // Handle Semestre / Ano dual custom selection
    if (!currentCourseData.semAno) {
        const auto = getAutoSemestreAno();
        currentCourseData.semAno = auto.formatted;
    }

    let parsedSem = (new Date().getMonth() < 6) ? "1º Sem" : "2º Sem";
    let parsedAno = String(new Date().getFullYear());

    if (currentCourseData.semAno.includes("1º")) {
        parsedSem = "1º Sem";
    } else if (currentCourseData.semAno.includes("2º")) {
        parsedSem = "2º Sem";
    }

    const yearMatch = currentCourseData.semAno.match(/\d{4}/);
    if (yearMatch) {
        parsedAno = yearMatch[0];
    }

    const wrapSem = document.getElementById('wrap-semestre');
    const labelSem = document.getElementById('label-semestre');
    if (wrapSem) {
        wrapSem.setAttribute('data-selected-val', parsedSem);
        if (labelSem) labelSem.textContent = (parsedSem === '1º Sem') ? '1º Semestre' : '2º Semestre';
        wrapSem.querySelectorAll('.custom-select-item').forEach(it => {
            if (it.getAttribute('data-val') === parsedSem) {
                it.classList.add('active');
            } else {
                it.classList.remove('active');
            }
        });
    }

    const wrapAno = document.getElementById('wrap-ano');
    const labelAno = document.getElementById('label-ano');
    if (wrapAno) {
        wrapAno.setAttribute('data-selected-val', parsedAno);
        if (labelAno) labelAno.textContent = parsedAno;
        wrapAno.querySelectorAll('.custom-select-item').forEach(it => {
            if (it.getAttribute('data-val') === parsedAno) {
                it.classList.add('active');
            } else {
                it.classList.remove('active');
            }
        });
    }

    const inp = document.getElementById('inp-sem-ano');
    if (inp) inp.value = `${parsedSem}/${parsedAno}`;
    currentCourseData.semAno = inp ? inp.value : `${parsedSem}/${parsedAno}`;

    const badge = document.getElementById('selected-course-badge');
    if (badge) {
        badge.textContent = currentCourseData.unitSigla ? `UC: ${currentCourseData.unitSigla}` : (currentCourseData.courseUnit ? currentCourseData.courseUnit : (currentCourseData.courseName ? currentCourseData.courseName : 'Novo Curso'));
    }

    // Render detected UCs if available
    renderUCChips();

    // Apply modality conditionals (IRRAC disabled for CAI/Técnico)
    applyModalityConditionals(selectedTipo);

    // Refresh real-time hours to class conversion
    updateClassCalculationUI();
}

// Sync inputs to currentCourseData
function syncCourseDataFromInputs() {
    currentCourseData.courseName = document.getElementById('inp-course-name')?.value.trim() || '';
    currentCourseData.courseUnit = document.getElementById('inp-course-unit')?.value.trim() || currentCourseData.courseUnit || currentCourseData.courseName;
    currentCourseData.unitSigla = document.getElementById('inp-unit-sigla')?.value.trim() || '';
    const rawHours = document.getElementById('inp-workload')?.value;
    currentCourseData.workload = rawHours ? parseInt(rawHours) : '';
    currentCourseData.escola = document.getElementById('inp-school')?.value.trim() || '';
    currentCourseData.docente = document.getElementById('inp-docente')?.value.trim() || '';
    currentCourseData.turma = document.getElementById('inp-turma')?.value.trim() || '';
    currentCourseData.objetivoUC = document.getElementById('inp-objetivo-uc')?.value.trim() || '';

    // Duração e Aulas
    const selectDuracao = document.getElementById('select-duracao-aula');
    currentCourseData.duracaoAula = selectDuracao ? parseInt(selectDuracao.value) : getDefaultDurationForTipo(currentCourseData.cursoTipo);
    
    currentCourseData.aulasPresenciais = document.getElementById('inp-aulas-presenciais')?.value.trim() || '';
    currentCourseData.aulasEad = document.getElementById('inp-aulas-ead')?.value.trim() || '';

    const wrapSem = document.getElementById('wrap-semestre');
    const wrapAno = document.getElementById('wrap-ano');
    const inpSemAno = document.getElementById('inp-sem-ano');

    if (wrapSem && wrapAno && inpSemAno) {
        const sem = wrapSem.getAttribute('data-selected-val') || '2º Sem';
        const ano = wrapAno.getAttribute('data-selected-val') || String(new Date().getFullYear());
        inpSemAno.value = `${sem}/${ano}`;
        currentCourseData.semAno = inpSemAno.value;
    } else if (inpSemAno && inpSemAno.value) {
        currentCourseData.semAno = inpSemAno.value.trim();
    }

    const badge = document.getElementById('selected-course-badge');
    if (badge) {
        badge.textContent = currentCourseData.unitSigla ? `UC: ${currentCourseData.unitSigla}` : (currentCourseData.courseName ? currentCourseData.courseName : 'Novo Curso');
    }
}

// Intelligent Sigla Generator
function generateSigla(name) {
    if (!name) return "";
    const upper = name.toUpperCase();
    if (upper.includes("DESENVOLVIMENTO") || upper.includes("SISTEMA")) return "DEV-SIST";
    if (upper.includes("ELETRICISTA") || upper.includes("PREDIAL")) return "ELET-PRED";
    if (upper.includes("EMPILHADEIRA") || upper.includes("NR-11") || upper.includes("NR11")) return "NR11-EMP";
    if (upper.includes("DESENHO") || upper.includes("MECÂNICO") || upper.includes("MECANICO")) return "DES-MEC";
    if (upper.includes("VEÍCULOS") || upper.includes("VEICULOS") || upper.includes("LEVES")) return "AUT-LEVES";
    if (upper.includes("MAQUINISTA")) return "MAQUINISTA";
    if (upper.includes("BOAS PRÁTICAS") || upper.includes("MERCADO")) return "BOAS-PRAT";
    if (upper.includes("ANTIGRAVITY")) return "ANTIGRAVITY";
    if (upper.includes("CHATGPT") || upper.includes("IA GENERATIVA")) return "CHATGPT";

    const words = upper.split(/[\s\-_]+/).filter(w => w.length > 2);
    if (words.length >= 2) {
        return (words[0].substring(0, 4) + "-" + words[1].substring(0, 4)).toUpperCase();
    }
    return upper.substring(0, 8).toUpperCase();
}

// Handle Custom File Upload with AI Parsing & UC Detection
function handleFileUpload(file) {
    const fileName = file.name;
    const fileSizeKB = Math.round(file.size / 1024);
    const cleanName = fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").trim();
    
    currentCourseData.fileName = fileName;
    currentCourseData.courseKey = 'custom';
    currentCourseData.courseName = cleanName.toUpperCase();
    currentCourseData.courseUnit = '';
    currentCourseData.unitSigla = '';
    currentCourseData.workload = "";
    currentCourseData.detectedUCs = [];
    currentCourseData.semestresEstrutura = null;
    currentCourseData.hasRemotoEstrutura = false;
    
    updateStep1FileCard(fileSizeKB, '⏳ Analisando Plano de Curso com IA (detectando nível, estrutura e UCs)...');
    showToast(`Carregando "${fileName}" e analisando matriz curricular...`);

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const base64Data = e.target.result.split(',')[1];
            const response = await fetch('/api/parse-course-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: fileName,
                    fileData: base64Data,
                    apiKey: getGeminiApiKey()
                })
            });

            if (response.ok) {
                const parsed = await response.json();
                if (parsed.cursoNome) {
                    currentCourseData.courseName = parsed.cursoNome;
                }
                if (parsed.cursoTipo) {
                    currentCourseData.cursoTipo = parsed.cursoTipo;
                    currentCourseData.duracaoAula = getDefaultDurationForTipo(parsed.cursoTipo);
                }
                currentCourseData.semestresEstrutura = parsed.semestres;
                currentCourseData.hasRemotoEstrutura = !!(parsed.hasRemoto || parsed.hasRemoteHours);

                if (parsed.unidades && Array.isArray(parsed.unidades) && parsed.unidades.length > 0) {
                    currentCourseData.detectedUCs = parsed.unidades;
                    // Auto-select the first UC from matrix
                    selectCourseUnit(parsed.unidades[0]);
                } else {
                    currentCourseData.detectedUCs = [];
                    currentCourseData.courseUnit = cleanName;
                    currentCourseData.unitSigla = generateSigla(cleanName);
                }

                populateStep2Inputs();
                updateStep1FileCard(fileSizeKB);
                saveToLocalStorage();

                const tipoNames = {
                    tecnico: 'Curso Técnico (45 min/aula)',
                    cai: 'Aprendizagem Industrial - CAI (60 min/aula)',
                    fic: 'Formação Inicial - FIC (60 min/aula)',
                    superior: 'Ensino Superior (60 min/aula)'
                };
                const detectedName = tipoNames[currentCourseData.cursoTipo] || currentCourseData.cursoTipo;
                const ucCount = currentCourseData.detectedUCs.length;
                const ucMsg = ucCount > 0 ? ` • ${ucCount} Unidades Curriculares detectadas` : '';
                showToast(`✅ Identificado: ${detectedName}${ucMsg}!`);
            } else {
                throw new Error('Falha ao processar arquivo no servidor');
            }
        } catch (err) {
            console.warn('Fallback after parse error:', err);
            currentCourseData.courseUnit = cleanName;
            currentCourseData.unitSigla = generateSigla(cleanName);
            populateStep2Inputs();
            updateStep1FileCard(fileSizeKB);
            saveToLocalStorage();
            showToast(`Plano anexado! Revise os dados no Passo 2.`);
        }
    };
    reader.onerror = function() {
        populateStep2Inputs();
        updateStep1FileCard(fileSizeKB);
        saveToLocalStorage();
    };
    reader.readAsDataURL(file);
}

// Update Step 1 File Preview Card
function updateStep1FileCard(fileSizeKB = null, statusMsg = null) {
    const card = document.getElementById('attached-file-card');
    const nameEl = document.getElementById('attached-file-name');
    const sizeEl = document.getElementById('attached-file-size');
    const labelEl = document.getElementById('step1-selected-name');

    if (currentCourseData.fileName) {
        card.style.display = 'flex';
        nameEl.textContent = currentCourseData.fileName;
        sizeEl.textContent = statusMsg || (fileSizeKB ? `${fileSizeKB} KB • Documento pronto para processamento` : `Documento carregado`);
        if (labelEl) {
            labelEl.textContent = `${currentCourseData.fileName} (${currentCourseData.courseName || 'Processado'})`;
        }
    } else {
        card.style.display = 'none';
        if (labelEl) {
            labelEl.textContent = currentCourseData.courseName ? `${currentCourseData.courseName} (Manual)` : 'Nenhum arquivo anexado (ou avance para preencher manualmente)';
        }
    }
}

// Remove attached file
function handleRemoveAttachedFile() {
    currentCourseData.fileName = null;
    currentCourseData.detectedUCs = [];
    currentCourseData.semestresEstrutura = null;
    currentCourseData.hasRemotoEstrutura = false;
    const fileInput = document.getElementById('file-input');
    if (fileInput) fileInput.value = '';
    updateStep1FileCard();
    saveToLocalStorage();
    showToast('Arquivo desanexado.');
}

// Generate MSEP Plan via Backend API
async function handleGenerateMSEP() {
    syncCourseDataFromInputs();

    if (!currentCourseData.courseName) {
        showToast('Por favor, informe o Nome do Curso Matriz / Habilitação.');
        document.getElementById('inp-course-name').focus();
        return;
    }

    if (!currentCourseData.courseUnit) {
        currentCourseData.courseUnit = document.getElementById('inp-course-unit')?.value.trim() || currentCourseData.courseName;
    }

    if (!currentCourseData.workload || isNaN(currentCourseData.workload) || currentCourseData.workload <= 0) {
        showToast('Por favor, informe a Carga Horária da UC (ex: 60, 80, 120h).');
        document.getElementById('inp-workload').focus();
        return;
    }

    if (!currentCourseData.unitSigla) {
        currentCourseData.unitSigla = generateSigla(currentCourseData.courseUnit || currentCourseData.courseName);
        document.getElementById('inp-unit-sigla').value = currentCourseData.unitSigla;
    }

    if (!currentCourseData.turma) {
        currentCourseData.turma = `TURMA ${new Date().getFullYear()}`;
    }
    if (!currentCourseData.semAno) {
        currentCourseData.semAno = `2º Sem/${new Date().getFullYear()}`;
    }
    if (!currentCourseData.escola) {
        currentCourseData.escola = 'Escola SENAI "Mariano Ferraz"';
    }
    if (!currentCourseData.docente) {
        currentCourseData.docente = 'Docente Responsável';
    }

    showToast('Gerando Situações de Aprendizagem MSEP Modular...');

    try {
        const payload = {
            ...currentCourseData,
            geminiApiKey: getGeminiApiKey()
        };

        const response = await fetch('/api/generate-msep', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const data = await response.json();
            currentMsepPlan = data.plan;
            saveToLocalStorage();
            renderMSEPViewer();
            goToStep(3);

            if (currentMsepPlan._generatedByAI) {
                showToast(`✨ Plano MSEP gerado via ${currentMsepPlan._aiProvider || 'Google Gemini'} com ${currentMsepPlan.situacoes.length} SAs!`);
            } else {
                showToast(`📋 Plano MSEP gerado com sucesso com ${currentMsepPlan.situacoes.length} SAs!`);
            }
        } else {
            throw new Error('Falha na resposta do servidor');
        }
    } catch (err) {
        console.error('Error generating MSEP:', err);
        showToast('Erro ao gerar MSEP. Verifique os dados inseridos.');
    }
}

// Update Hours Balance Indicator
function updateHoursBalanceIndicator() {
    if (!currentMsepPlan) return;

    let totalAllocated = 0;
    currentMsepPlan.situacoes.forEach(sa => {
        totalAllocated += parseInt(sa.aulas) || 0;
    });

    const targetWorkload = parseInt(currentMsepPlan.cargaHoraria) || 40;
    const pill = document.getElementById('hours-balance-pill');
    document.getElementById('hours-allocated').textContent = totalAllocated;
    document.getElementById('hours-total').textContent = targetWorkload;

    if (totalAllocated === targetWorkload) {
        pill.classList.remove('mismatch');
        pill.title = "Carga horária perfeitamente balanceada!";
    } else {
        pill.classList.add('mismatch');
        pill.title = `Atenção: A soma das SAs (${totalAllocated}h) difere da carga horária total (${targetWorkload}h)`;
    }
}

// Render Interactive MSEP Editor (Step 3)
function renderMSEPViewer() {
    if (!currentMsepPlan) return;

    const container = document.getElementById('sa-container');
    container.innerHTML = '';

    document.getElementById('msep-view-title').textContent = `${currentMsepPlan.curso}`;
    updateHoursBalanceIndicator();

    currentMsepPlan.situacoes.forEach((sa, saIdx) => {
        const saCard = document.createElement('div');
        saCard.className = 'sa-card';
        saCard.id = `sa-card-${saIdx}`;
        saCard.innerHTML = `
            <div class="sa-card-header">
                <div class="sa-title-wrap">
                    <span class="sa-badge">SA ${sa.numero}</span>
                    <input type="text" class="form-control sa-title-input" data-sa-idx="${saIdx}" value="${sa.titulo}" style="font-weight: 700; font-size: 1.05rem;">
                </div>
                <div class="sa-header-controls">
                    <div class="sa-hours-box">
                        <input type="number" class="form-control form-control-sm sa-hours-input" data-sa-idx="${saIdx}" value="${sa.aulas}" style="width: 75px; text-align: center; font-weight: 700;" title="Horas desta SA">
                        <span class="sa-hours-label">Aulas</span>
                    </div>
                    <button class="btn btn-danger btn-xs btn-delete-sa" data-sa-idx="${saIdx}" title="Excluir esta Situação de Aprendizagem">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        Excluir SA
                    </button>
                </div>
            </div>

            <div class="sa-grid">
                <div class="sa-section-block">
                    <h4>🏢 Contextualização (Cenário / Empresa Simulada)</h4>
                    <textarea class="sa-context-input" data-sa-idx="${saIdx}" rows="5">${sa.contextualizacao}</textarea>
                </div>

                <div class="sa-section-block">
                    <h4>🎯 Desafio Prático & Entregas</h4>
                    <textarea class="sa-desafio-input" data-sa-idx="${saIdx}" rows="5">${sa.desafio}</textarea>
                </div>
            </div>

            <div class="sa-grid">
                <div class="sa-section-block">
                    <h4>👨‍🏫 Mediação e Observações para o Docente</h4>
                    <textarea class="sa-obs-input" data-sa-idx="${saIdx}" rows="3">${sa.observacoesDocente}</textarea>
                </div>

                <div class="sa-section-block">
                    <h4>📦 Resultados Esperados (Entregáveis)</h4>
                    <textarea class="sa-res-input" data-sa-idx="${saIdx}" rows="3">${sa.resultadosEsperados}</textarea>
                </div>
            </div>

            <!-- Criteria Table for this SA -->
            <div style="margin-top: 1.25rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
                    <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-main);">📋 Matriz de Critérios de Avaliação (IRRAC)</h4>
                    <button class="btn btn-outline btn-xs btn-add-crit" data-sa-idx="${saIdx}">+ Adicionar Critério</button>
                </div>
                <div class="table-responsive">
                    <table class="criteria-table" id="criteria-table-${saIdx}">
                        <thead>
                            <tr>
                                <th style="width: 25%;">Capacidade</th>
                                <th style="width: 50%;">Critério de Desempenho Observável</th>
                                <th style="width: 18%; text-align: center;">Classificação</th>
                                <th style="width: 7%; text-align: center;">Ações</th>
                            </tr>
                        </thead>
                        <tbody id="criteria-tbody-${saIdx}">
                            ${sa.criterios.map((c, cIdx) => `
                                <tr id="crit-row-${saIdx}-${cIdx}">
                                    <td>
                                        <input type="text" class="form-control form-control-sm crit-cap-input" data-sa-idx="${saIdx}" data-c-idx="${cIdx}" value="${c.cap || ''}" placeholder="(Continuação)">
                                    </td>
                                    <td>
                                        <input type="text" class="form-control form-control-sm crit-text-input" data-sa-idx="${saIdx}" data-c-idx="${cIdx}" value="${c.crit}" style="${c.tipo === 'C' ? 'font-weight: 700;' : ''}">
                                    </td>
                                    <td style="text-align: center;">
                                        <div class="custom-select-wrap" data-sa-idx="${saIdx}" data-c-idx="${cIdx}" data-selected-val="${c.tipo || 'C'}">
                                            <button type="button" class="custom-select-trigger" aria-haspopup="listbox">
                                                <span class="custom-select-label">${c.tipo === 'C' ? 'Crítico (C)' : 'Desejável (D)'}</span>
                                                <svg class="custom-select-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                            </button>
                                            <div class="custom-select-dropdown" role="listbox">
                                                <div class="custom-select-item ${c.tipo === 'C' ? 'active' : ''}" data-val="C">
                                                    <span class="item-title">Crítico (C)</span>
                                                    <span class="item-desc">Item obrigatório para aprovação</span>
                                                </div>
                                                <div class="custom-select-item ${c.tipo === 'D' ? 'active' : ''}" data-val="D">
                                                    <span class="item-title">Desejável (D)</span>
                                                    <span class="item-desc">Item de aprimoramento e notas</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style="text-align: center;">
                                        <button class="btn btn-outline btn-xs btn-delete-crit" data-sa-idx="${saIdx}" data-c-idx="${cIdx}" title="Excluir linha">🗑️</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        container.appendChild(saCard);
    });

    attachDynamicMSEPHandlers();
}

// Attach Event Listeners to Dynamically Rendered MSEP Elements
function attachDynamicMSEPHandlers() {
    const liveSelectors = ['.sa-title-input', '.sa-context-input', '.sa-desafio-input', '.sa-obs-input', '.sa-res-input', '.crit-cap-input', '.crit-text-input'];
    liveSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(inp => {
            inp.addEventListener('input', () => {
                syncMsepPlanFromUI();
                saveToLocalStorage();
            });
            inp.addEventListener('change', () => {
                syncMsepPlanFromUI();
                saveToLocalStorage();
            });
        });
    });

    // Custom Dropdown Triggers
    document.querySelectorAll('.custom-select-trigger').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const wrap = btn.closest('.custom-select-wrap');
            const isOpen = wrap.classList.contains('open');
            document.querySelectorAll('.custom-select-wrap.open').forEach(w => {
                if (w !== wrap) w.classList.remove('open');
            });
            wrap.classList.toggle('open', !isOpen);
        });
    });

    // Custom Dropdown Item Selection
    document.querySelectorAll('.custom-select-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const wrap = item.closest('.custom-select-wrap');
            const val = item.getAttribute('data-val');
            const label = item.querySelector('.item-title').textContent.trim();

            wrap.setAttribute('data-selected-val', val);
            wrap.querySelector('.custom-select-label').textContent = label;

            wrap.querySelectorAll('.custom-select-item').forEach(it => it.classList.remove('active'));
            item.classList.add('active');

            wrap.classList.remove('open');

            syncMsepPlanFromUI();
            saveToLocalStorage();
        });
    });

    // Hours inputs
    document.querySelectorAll('.sa-hours-input').forEach(inp => {
        inp.addEventListener('input', (e) => {
            const saIdx = parseInt(e.target.dataset.saIdx);
            if (currentMsepPlan && currentMsepPlan.situacoes[saIdx]) {
                currentMsepPlan.situacoes[saIdx].aulas = parseInt(e.target.value) || 0;
            }
            updateHoursBalanceIndicator();
            saveToLocalStorage();
        });
    });

    // Delete SA buttons
    document.querySelectorAll('.btn-delete-sa').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const saIdx = parseInt(btn.dataset.saIdx);
            if (currentMsepPlan.situacoes.length <= 1) {
                showToast('O Plano de Ensino precisa ter pelo menos 1 Situação de Aprendizagem.');
                return;
            }
            const sa = currentMsepPlan.situacoes[saIdx];
            openModal({
                title: `Excluir Situação de Aprendizagem ${sa.numero}?`,
                desc: `Tem certeza que deseja remover "${sa.titulo}" e seus critérios de avaliação?`,
                confirmText: 'Excluir SA',
                cancelText: 'Cancelar',
                iconType: 'danger',
                isDanger: true,
                onConfirm: () => {
                    syncMsepPlanFromUI();
                    currentMsepPlan.situacoes.splice(saIdx, 1);
                    currentMsepPlan.situacoes.forEach((item, i) => {
                        item.numero = String(i + 1).padStart(2, '0');
                    });
                    saveToLocalStorage();
                    renderMSEPViewer();
                    showToast('Situação de Aprendizagem removida.');
                }
            });
        });
    });

    // Add Criterion buttons
    document.querySelectorAll('.btn-add-crit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const saIdx = parseInt(btn.dataset.saIdx);
            syncMsepPlanFromUI();
            currentMsepPlan.situacoes[saIdx].criterios.push({
                row: 15 + currentMsepPlan.situacoes[saIdx].criterios.length,
                cap: "",
                crit: "Executa os procedimentos técnicos atendendo aos requisitos de qualidade e conformidade.",
                tipo: "C"
            });
            saveToLocalStorage();
            renderMSEPViewer();
            showToast('Novo critério adicionado.');
        });
    });

    // Delete Criterion buttons
    document.querySelectorAll('.btn-delete-crit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const saIdx = parseInt(btn.dataset.saIdx);
            const cIdx = parseInt(btn.dataset.cIdx);
            syncMsepPlanFromUI();
            currentMsepPlan.situacoes[saIdx].criterios.splice(cIdx, 1);
            saveToLocalStorage();
            renderMSEPViewer();
        });
    });
}

// Add New SA
function handleAddNewSA() {
    if (!currentMsepPlan) return;
    syncMsepPlanFromUI();

    const newNum = String(currentMsepPlan.situacoes.length + 1).padStart(2, '0');
    currentMsepPlan.situacoes.push({
        numero: newNum,
        titulo: `Situação de Aprendizagem ${newNum} - Projeto Prático Aplicado`,
        aulas: 10,
        estrategiaTipo: "Projeto",
        capacidadesTecnicas: ["Executar rotinas e procedimentos técnicos da especialidade."],
        capacidadesSocioemocionais: ["Demonstrar atenção a detalhes.", "Demonstrar responsabilidade."],
        conhecimentos: ["Técnicas avançadas e boas práticas profissionais."],
        contextualizacao: "Uma nova demanda operacional surge no setor industrial requerendo análise técnica, planejamento e intervenção prática com foco em produtividade e qualidade.",
        observacoesDocente: "Orientar os alunos na aplicação autônoma dos conhecimentos prévios e incentivar o trabalho em equipe.",
        desafio: "Planejar, implementar e documentar a solução técnica solicitada atendendo aos padrões de engenharia e segurança.",
        resultadosEsperados: "Produto/serviço técnico concluído com relatório de validação assinado.",
        estrategiasEnsino: "Projeto prático em equipe; Aula em laboratório/oficina; Apresentação técnica.",
        instrumentosAvaliacao: "Avaliação de desempenho prático; Relatório técnico do projeto.",
        recursos: "Ambiente pedagógico especializado e ferramentas do curso.",
        criterios: [
            { row: 15, cap: "Capacidade Técnica Adicional", crit: "Executa os procedimentos com precisão e conformidade técnica.", tipo: "C" },
            { row: 16, cap: "", crit: "Aplica normas e regulamentações técnicas e de segurança da área.", tipo: "D" },
            { row: 17, cap: "Demonstrar responsabilidade", crit: "Cumpre os prazos e diretrizes técnicas do projeto de forma metódica.", tipo: "C" },
            { row: 18, cap: "", crit: "Demonstra postura colaborativa e organização no ambiente de trabalho.", tipo: "D" }
        ]
    });

    saveToLocalStorage();
    renderMSEPViewer();
    showToast(`Situação de Aprendizagem ${newNum} adicionada!`);
}

// Synchronize edits made in Step 3 UI back into state
function syncMsepPlanFromUI() {
    if (!currentMsepPlan) return;

    let globalRowCounter = 15;

    currentMsepPlan.situacoes.forEach((sa, saIdx) => {
        const titleInp = document.querySelector(`.sa-title-input[data-sa-idx="${saIdx}"]`);
        if (titleInp) sa.titulo = titleInp.value;

        const hoursInp = document.querySelector(`.sa-hours-input[data-sa-idx="${saIdx}"]`);
        if (hoursInp) sa.aulas = parseInt(hoursInp.value) || 0;

        const ctxInp = document.querySelector(`.sa-context-input[data-sa-idx="${saIdx}"]`);
        if (ctxInp) sa.contextualizacao = ctxInp.value;

        const desafioInp = document.querySelector(`.sa-desafio-input[data-sa-idx="${saIdx}"]`);
        if (desafioInp) sa.desafio = desafioInp.value;

        const obsInp = document.querySelector(`.sa-obs-input[data-sa-idx="${saIdx}"]`);
        if (obsInp) sa.observacoesDocente = obsInp.value;

        const resInp = document.querySelector(`.sa-res-input[data-sa-idx="${saIdx}"]`);
        if (resInp) sa.resultadosEsperados = resInp.value;

        sa.criterios.forEach((c, cIdx) => {
            const capInp = document.querySelector(`.crit-cap-input[data-sa-idx="${saIdx}"][data-c-idx="${cIdx}"]`);
            if (capInp) c.cap = capInp.value;

            const textInp = document.querySelector(`.crit-text-input[data-sa-idx="${saIdx}"][data-c-idx="${cIdx}"]`);
            if (textInp) c.crit = textInp.value;

            const wrap = document.querySelector(`.custom-select-wrap[data-sa-idx="${saIdx}"][data-c-idx="${cIdx}"]`);
            if (wrap) {
                c.tipo = wrap.getAttribute('data-selected-val') || 'C';
            }

            c.row = globalRowCounter++;
        });

        globalRowCounter++;
    });
}

// Render Step 4: Export Summary & Printable Official SENAI Document
function renderExportAndDocView() {
    if (!currentMsepPlan) return;

    let totalCrit = 0;
    let totalDesej = 0;

    currentMsepPlan.situacoes.forEach(sa => {
        sa.criterios.forEach(c => {
            if (c.tipo === 'C') totalCrit++;
            if (c.tipo === 'D') totalDesej++;
        });
    });

    document.getElementById('stat-crit-count').textContent = totalCrit;
    document.getElementById('stat-desej-count').textContent = totalDesej;
    document.getElementById('stat-total-count').textContent = totalCrit + totalDesej;

    const docContainer = document.getElementById('printable-doc-content');

    const activeTipo = currentMsepPlan.cursoTipo || currentCourseData.cursoTipo || 'tecnico';
    const tipoLabels = {
        tecnico: 'Curso Técnico de Nível Médio',
        cai: 'Curso de Aprendizagem Industrial (CAI)',
        fic: 'Formação Inicial e Continuada (FIC)',
        superior: 'Ensino Superior (Graduação / Tecnologia)'
    };
    const tipoLabel = tipoLabels[activeTipo] || 'Curso Técnico';

    // Apply modality conditionals (disable IRRAC for CAI/CT)
    applyModalityConditionals(activeTipo);

    const modalidadeLabel = (currentMsepPlan.modalidade === 'semipresencial' || currentCourseData.modalidade === 'semipresencial')
        ? 'Semipresencial (com EaD)'
        : '100% Presencial';

    let docHTML = `
        <div class="senai-doc-header">
            <h1>${currentMsepPlan.escola}</h1>
            <h2>PLANO DE ENSINO</h2>
            <div class="senai-banner-black">SITUAÇÃO DE APRENDIZAGEM</div>
        </div>

        <table class="senai-table-doc">
            <tr>
                <td style="width: 65%;"><strong>Curso:</strong> ${currentMsepPlan.curso}</td>
                <td style="width: 35%;"><strong>Nível / Tipo:</strong> ${tipoLabel}</td>
            </tr>
            <tr>
                <td style="width: 65%;"><strong>Unidade Curricular (UC):</strong> ${currentMsepPlan.unidade || currentMsepPlan.curso}</td>
                <td style="width: 35%;"><strong>Modalidade:</strong> ${modalidadeLabel}</td>
            </tr>
            <tr>
                <td style="width: 50%;"><strong>Carga horária da UC:</strong> ${currentMsepPlan.cargaHoraria} horas</td>
                <td style="width: 50%;"><strong>Nº de aulas:</strong> ${currentMsepPlan.numAulas || `${currentMsepPlan.cargaHoraria} aulas`}</td>
            </tr>
            <tr>
                <td colspan="2">
                    <strong>Carga horária prevista para o desenvolvimento da Situação de Aprendizagem:</strong><br>
                    ${currentMsepPlan.situacoes.map(sa => `• Situação de Aprendizagem ${sa.numero}: ${sa.aulas} aulas`).join('<br>')}
                </td>
            </tr>
            <tr>
                <td colspan="2"><strong>Objetivo da UC:</strong> ${currentMsepPlan.objetivoUC || currentCourseData.objetivoUC || 'Desenvolver as competências técnicas e socioemocionais preconizadas na matriz curricular.'}</td>
            </tr>
        </table>
    `;

    currentMsepPlan.situacoes.forEach((sa, idx) => {
        docHTML += `
            <div class="${idx > 0 ? 'print-page-break' : ''}">
                <div class="doc-sa-title">SITUAÇÃO DE APRENDIZAGEM ${sa.numero} - ${sa.titulo}</div>
                
                <table class="senai-table-doc">
                    <tr>
                        <td>
                            <strong>Capacidades Técnicas:</strong><br>
                            ${(sa.capacidadesTecnicas || []).map(c => `• ${c}`).join('<br>')}
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <strong>Capacidades Socioemocionais:</strong><br>
                            ${(sa.capacidadesSocioemocionais || []).map(c => `• ${c}`).join('<br>')}
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <strong>Conhecimentos Relacionados:</strong><br>
                            ${(sa.conhecimentos || []).map(k => `• ${k}`).join('<br>')}
                        </td>
                    </tr>
                </table>

                <table class="senai-table-doc">
                    <tr>
                        <th>Estratégia de aprendizagem ${sa.numero}: ${sa.estrategiaTipo}</th>
                    </tr>
                    <tr>
                        <td>
                            <strong>Contextualização:</strong><br>
                            ${sa.contextualizacao}
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <strong>Observações para o docente:</strong><br>
                            ${sa.observacoesDocente}
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <strong>Desafio:</strong><br>
                            ${sa.desafio}
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <strong>Resultados esperados:</strong><br>
                            ${sa.resultadosEsperados}
                        </td>
                    </tr>
                </table>

                <div class="doc-sa-title">ESTRATÉGIAS DE ENSINO, INSTRUMENTOS DE AVALIAÇÃO E RECURSOS DIDÁTICOS</div>
                <table class="senai-table-doc">
                    <thead>
                        <tr>
                            <th style="width: 15%;">Nº Horas / Aulas</th>
                            <th style="width: 45%;">Estratégias de Ensino e Instrumentos de Avaliação</th>
                            <th style="width: 40%;">Recursos e Ambientes Pedagógicos</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${sa.aulas} aulas</td>
                            <td>
                                <strong>Estratégias de Ensino:</strong><br>${sa.estrategiasEnsino}<br><br>
                                <strong>Instrumentos de Avaliação:</strong><br>${sa.instrumentosAvaliacao}
                            </td>
                            <td>${sa.recursos}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="doc-sa-title">INSTRUMENTO DE REGISTRO - CRITÉRIOS DE AVALIAÇÃO</div>
                <table class="senai-table-doc">
                    <thead>
                        <tr>
                            <th style="width: 30%;">Capacidade</th>
                            <th style="width: 55%;">Critérios de Avaliação</th>
                            <th style="width: 15%; text-align: center;">Tipo</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sa.criterios.map(c => `
                            <tr>
                                <td>${c.cap || '-'}</td>
                                <td class="${c.tipo === 'C' ? 'doc-bold' : ''}">${c.crit}</td>
                                <td style="text-align: center; font-weight: bold;">${c.tipo === 'C' ? 'Crítico (C)' : 'Desejável (D)'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    });

    // Performance Conversion Table
    docHTML += `
        <div class="print-page-break">
            <div class="senai-doc-header">
                <h2>TABELA DE NÍVEIS DE DESEMPENHO E CONVERSÃO</h2>
            </div>
            <table class="senai-table-doc">
                <thead>
                    <tr>
                        <th style="width: 60%;">Critérios de Avaliação</th>
                        <th style="width: 20%; text-align: center;">Nível de Desempenho</th>
                        <th style="width: 20%; text-align: center;">Conversão em Notas</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td>Atingiu 100% dos critérios críticos (${totalCrit})</td><td style="text-align:center;">5</td><td style="text-align:center;">100</td></tr>
                    <tr><td>Atingiu no mínimo 80% dos critérios críticos</td><td style="text-align:center;">4</td><td style="text-align:center;">85</td></tr>
                    <tr><td>Atingiu no mínimo 60% dos critérios críticos</td><td style="text-align:center;">3</td><td style="text-align:center;">65</td></tr>
                    <tr><td>Atingiu no mínimo 40% dos critérios críticos</td><td style="text-align:center;">2</td><td style="text-align:center;">45</td></tr>
                    <tr><td>Atingiu menos de 40% dos critérios críticos</td><td style="text-align:center;">1</td><td style="text-align:center;">25</td></tr>
                </tbody>
            </table>
        </div>
    `;

    docContainer.innerHTML = docHTML;
}

// Download IRRAC XLSX File
async function handleDownloadIRRAC() {
    const activeTipo = currentCourseData.cursoTipo || currentMsepPlan?.cursoTipo;
    if (activeTipo !== 'fic') {
        showToast('⚠️ A planilha IRRAC é exclusiva para cursos FIC. Cursos CAI e Técnicos utilizam o diário de classe do SGE.');
        return;
    }

    syncMsepPlanFromUI();
    saveToLocalStorage();
    showToast('Compilando planilha XLSX oficial...');

    const payload = {
        courseName: currentMsepPlan.curso,
        courseUnit: currentMsepPlan.unidade || currentMsepPlan.curso,
        unitSigla: currentMsepPlan.sigla,
        workload: currentMsepPlan.cargaHoraria,
        turma: currentMsepPlan.turma,
        semAno: currentMsepPlan.semAno,
        docente: currentMsepPlan.docente,
        escola: currentMsepPlan.escola,
        situacoes: currentMsepPlan.situacoes
    };

    try {
        const response = await fetch('/api/export-irrac', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            let downloadFilename = `IRRAC - ${currentMsepPlan.sigla || 'CURSO'}.xlsx`;
            const disposition = response.headers.get('Content-Disposition');
            if (disposition && disposition.includes('filename=')) {
                const match = disposition.match(/filename="?([^"]+)"?/);
                if (match && match[1]) downloadFilename = match[1];
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = downloadFilename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            showToast(`Planilha "${downloadFilename}" baixada com sucesso!`);
        } else {
            throw new Error('Falha ao compilar XLSX');
        }
    } catch (err) {
        console.error('Download error:', err);
        showToast('Erro ao baixar planilha. Tente novamente.');
    }
}

// Local Storage Helper Functions
function saveToLocalStorage() {
    try {
        const state = {
            currentStep,
            currentCourseData,
            currentMsepPlan,
            savedAt: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        setStorageStatus('Salvo no Navegador');
    } catch (err) {
        console.warn('Could not save to localStorage:', err);
    }
}

function loadFromLocalStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const state = JSON.parse(raw);
        if (state.currentCourseData) currentCourseData = state.currentCourseData;
        if (state.currentMsepPlan) currentMsepPlan = state.currentMsepPlan;
        if (state.currentStep) currentStep = state.currentStep;
        return true;
    } catch (err) {
        console.warn('Error reading from localStorage:', err);
        return false;
    }
}

function handleResetPlan() {
    openModal({
        title: 'Iniciar Novo Planejamento?',
        desc: 'Todas as alterações, Situações de Aprendizagem e rascunhos salvos no navegador serão limpos para você começar um novo curso do zero.',
        confirmText: 'Sim, Iniciar do Zero',
        cancelText: 'Cancelar',
        iconType: 'primary',
        isDanger: false,
        onConfirm: () => {
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch (e) {}
            resetFormToBlank();
            goToStep(1, false);
            showToast('Novo planejamento iniciado do zero.');
        }
    });
}

// Modern Modal Dialog Helper
function openModal({
    title = 'Confirmação',
    desc = 'Tem certeza que deseja prosseguir?',
    iconType = 'primary', // 'primary', 'danger', 'warning'
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    isDanger = false,
    onConfirm = () => {}
}) {
    const overlay = document.getElementById('modal-overlay');
    const titleEl = document.getElementById('modal-title');
    const descEl = document.getElementById('modal-desc');
    const iconBadge = document.getElementById('modal-icon-badge');
    const btnConfirm = document.getElementById('modal-btn-confirm');
    const btnCancel = document.getElementById('modal-btn-cancel');

    if (!overlay) return;

    titleEl.textContent = title;
    descEl.textContent = desc;
    btnConfirm.textContent = confirmText;
    btnCancel.textContent = cancelText;

    iconBadge.className = `modal-icon-badge ${iconType}`;

    if (isDanger) {
        btnConfirm.className = 'btn btn-danger';
    } else {
        btnConfirm.className = 'btn btn-primary';
    }

    overlay.style.display = 'flex';
    requestAnimationFrame(() => {
        overlay.classList.add('active');
    });

    const closeModal = () => {
        overlay.classList.remove('active');
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 200);
        btnConfirm.onclick = null;
        btnCancel.onclick = null;
        document.removeEventListener('keydown', handleKey);
    };

    const handleKey = (e) => {
        if (e.key === 'Escape') closeModal();
        if (e.key === 'Enter') {
            closeModal();
            onConfirm();
        }
    };

    btnCancel.onclick = closeModal;
    btnConfirm.onclick = () => {
        closeModal();
        onConfirm();
    };

    overlay.onclick = (e) => {
        if (e.target === overlay) closeModal();
    };

    document.addEventListener('keydown', handleKey);
}

function setStorageStatus(text, isTemporaryHighlight = false) {
    const el = document.getElementById('storage-status-text');
    if (el) {
        el.textContent = text;
    }
}

// Toast Helper
function showToast(message) {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}
