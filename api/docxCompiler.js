// ==============================================================================
// DOCENTE SENAI - COMPILADOR OFICIAL DOCX (PLANO DE ENSINO MSEP)
// Padrão Institucional SENAI-SP: Book MSEP Digital e Matriz de Avaliação IRRAC
// ==============================================================================

const path = require('path');
const fs = require('fs');
const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    VerticalAlign,
    BorderStyle,
    ImageRun,
    PageBreak,
    ShadingType
} = require('docx');

/**
 * Remove caracteres de controle proibidos pelo XML do Word
 * e limpa espaçamentos extras.
 */
function sanitize(val) {
    if (val === null || val === undefined) return '';
    return String(val)
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
        .trim();
}

/**
 * Remove prefixos redundantes do título da SA (ex: "Situação de Aprendizagem 01 - ", "SA 1: ")
 */
function cleanSaTitle(rawTitle) {
    if (!rawTitle) return '';
    let title = String(rawTitle).trim();
    const prefixRegex = /^(?:situaç[ãa]o\s+de\s+aprendizagem|sa|bloco)\s*\d*\s*[-–:]*\s*/i;
    while (prefixRegex.test(title)) {
        title = title.replace(prefixRegex, '').trim();
    }
    return title;
}

/**
 * Calcula a tabela oficial de 10 Níveis de Desempenho (10 a 1) e conversão em notas (100 a 10)
 * rigorosamente conforme as diretrizes do SENAI-SP (Prompt 07 e documentos oficiais MSEP):
 * - Nível 10: 100% Críticos + 100% Desejáveis -> 100
 * - Níveis 9 a 6: 100% Críticos + decréscimo de Desejáveis -> 95, 85, 75, 60
 * - Nível 5: 100% Críticos + 0 Desejáveis -> 50 (patamar de aprovação)
 * - Níveis 4 a 1: Fração de Críticos + 0 Desejáveis -> 40, 30, 20, 10
 */
function calculateNiveisDesempenho(totalCrit, totalDesej) {
    const C = Math.max(0, totalCrit || 0);
    const D = Math.max(0, totalDesej || 0);
    const total = C + D;

    const d9 = Math.max(0, Math.min(D > 1 ? D - 1 : D, Math.round(D * 0.9)));
    const d8 = Math.max(0, Math.min(d9, Math.round(D * 0.7)));
    const d7 = Math.max(0, Math.min(d8, Math.round(D * 0.5)));
    const d6 = Math.max(0, Math.min(d7, Math.round(D * 0.25)));

    const c4 = Math.max(1, Math.min(C > 1 ? C - 1 : C, Math.round(C * 0.8)));
    const c3 = Math.max(1, Math.min(c4, Math.round(C * 0.6)));
    const c2 = Math.max(1, Math.min(c3, Math.round(C * 0.4)));
    const c1 = Math.max(1, Math.min(c2, Math.round(C * 0.2)));

    return [
        { crit: `${C} Críticos + ${D} Desejáveis (Total: ${total})`, nivel: 10, nota: 100 },
        { crit: `${C} Críticos + ${d9} Desejáveis`, nivel: 9, nota: 95 },
        { crit: `${C} Críticos + ${d8} Desejáveis`, nivel: 8, nota: 85 },
        { crit: `${C} Críticos + ${d7} Desejáveis`, nivel: 7, nota: 75 },
        { crit: `${C} Críticos + ${d6} Desejáveis`, nivel: 6, nota: 60 },
        { crit: `${C} Críticos + 0 Desejáveis`, nivel: 5, nota: 50 },
        { crit: `${c4} Críticos + 0 Desejáveis`, nivel: 4, nota: 40 },
        { crit: `${c3} Críticos + 0 Desejáveis`, nivel: 3, nota: 30 },
        { crit: `${c2} Críticos + 0 Desejáveis`, nivel: 2, nota: 20 },
        { crit: `${c1} Críticos + 0 Desejáveis`, nivel: 1, nota: 10 }
    ];
}

// Estilo de bordas oficiais para documentos institucionais SENAI-SP
const BORDER_BLACK = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const TABLE_BORDERS = {
    top: BORDER_BLACK,
    bottom: BORDER_BLACK,
    left: BORDER_BLACK,
    right: BORDER_BLACK,
    insideHorizontal: BORDER_BLACK,
    insideVertical: BORDER_BLACK
};

const CELL_PADDING = { top: 80, bottom: 80, left: 120, right: 120 };

function createCell(children, options = {}) {
    return new TableCell({
        children: Array.isArray(children) ? children : [children],
        width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
        columnSpan: options.columnSpan,
        rowSpan: options.rowSpan,
        shading: options.fill ? { fill: options.fill, val: ShadingType.CLEAR, color: "auto" } : undefined,
        verticalAlign: options.vAlign || VerticalAlign.CENTER,
        margins: options.margins || CELL_PADDING
    });
}

function createParagraph(text, options = {}) {
    const runs = [];
    const rawLines = sanitize(text).split('\n');

    rawLines.forEach((line, idx) => {
        if (idx > 0) {
            runs.push(new TextRun({ break: 1 }));
        }
        runs.push(new TextRun({
            text: line,
            bold: !!options.bold,
            italics: !!options.italics,
            color: options.color || "000000",
            size: options.size || 20 // 10pt
        }));
    });

    return new Paragraph({
        alignment: options.alignment || AlignmentType.LEFT,
        spacing: options.spacing || { before: 30, after: 30, line: 240 },
        children: runs
    });
}

function createBulletList(items, emptyText = '-') {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if (list.length === 0) {
        return [createParagraph(emptyText, { size: 19 })];
    }
    return list.map(item =>
        new Paragraph({
            spacing: { before: 20, after: 20, line: 240 },
            bullet: { level: 0 },
            children: [
                new TextRun({ text: sanitize(item), size: 19 })
            ]
        })
    );
}

/**
 * Compila o plano em formato DOCX oficial SENAI-SP garantindo total aderência às diretrizes
 * institucionais (Book MSEP Digital e Matriz de Critérios IRRAC)
 */
async function compilePlanoDocx(plan) {
    if (!plan) throw new Error('Dados do plano não fornecidos');

    const rawSituacoes = Array.isArray(plan.situacoes) ? plan.situacoes : [];
    const situacoes = rawSituacoes.length > 0 ? rawSituacoes : [
        {
            numero: "01",
            titulo: "Situação de Aprendizagem Prática",
            aulas: parseInt(plan.cargaHoraria) || 40,
            estrategiaTipo: "Situação-problema",
            capacidadesTecnicas: plan.capacidadesTecnicas || [],
            capacidadesSocioemocionais: plan.capacidadesSocioemocionais || [],
            conhecimentos: plan.conhecimentos || [],
            contextualizacao: "Cenário prático industrial relativo à unidade curricular.",
            desafio: "Solucionar os desafios técnicos propostos.",
            resultadosEsperados: "Entregas validadas conforme critérios de desempenho.",
            criterios: [
                { cap: "Capacidade técnica fundamental", crit: "Executa os procedimentos técnicos com exatidão.", tipo: "C" },
                { cap: "Capacidade técnica fundamental", crit: "Aplica normas de qualidade e segurança.", tipo: "D" }
            ]
        }
    ];

    const escola = sanitize(plan.escola) || 'ESCOLA SENAI "MARIANO FERRAZ"';
    const curso = sanitize(plan.curso || plan.courseName) || 'Curso SENAI';
    const unidade = sanitize(plan.unidade || plan.courseUnit) || curso;
    const cargaHoraria = parseInt(plan.cargaHoraria || plan.workload) || 40;
    const numAulas = sanitize(plan.numAulas) || `${cargaHoraria} aulas`;
    const objetivoUC = sanitize(plan.objetivoUC) || 'Desenvolver capacidades técnicas e socioemocionais relativas à área de atuação.';
    const turma = sanitize(plan.turma) || '___________________';
    const docente = sanitize(plan.docente || plan.professor) || 'Docente Responsável';
    const semAno = sanitize(plan.semAno) || '';

    const tipoLabels = {
        tecnico: 'Curso Técnico de Nível Médio',
        cai: 'Curso de Aprendizagem Industrial (CAI)',
        fic: 'Formação Inicial e Continuada (FIC)',
        superior: 'Ensino Superior (Graduação / Tecnologia)'
    };
    const activeTipo = plan.cursoTipo || 'tecnico';
    const tipoLabel = tipoLabels[activeTipo] || 'Curso Técnico';
    const modalidadeLabel = (plan.modalidade === 'semipresencial') ? 'Semipresencial (com EaD)' : '100% Presencial';

    // Logotipo oficial SENAI São Paulo
    let logoRun = null;
    const logoCandidates = [
        path.resolve(__dirname, '../public/senai-logo.png'),
        path.resolve(__dirname, '../public/SENAI_São_Paulo_logo.png')
    ];
    for (const cand of logoCandidates) {
        if (fs.existsSync(cand)) {
            try {
                const imgBuf = fs.readFileSync(cand);
                logoRun = new ImageRun({
                    data: imgBuf,
                    transformation: { width: 170, height: 42 }
                });
                break;
            } catch (e) {
                console.warn('Could not load logo:', e.message);
            }
        }
    }

    const docElements = [];

    // --- 1. CABEÇALHO INSTITUCIONAL OFICIAL ---
    if (logoRun) {
        docElements.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 60 },
            children: [logoRun]
        }));
    }

    docElements.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 40 },
        children: [new TextRun({ text: escola.toUpperCase(), bold: true, size: 24 })]
    }));

    docElements.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: "PLANO DE ENSINO", bold: true, size: 22 })]
    }));

    // Faixa preta oficial: SITUAÇÃO DE APRENDIZAGEM
    docElements.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: TABLE_BORDERS,
        rows: [
            new TableRow({
                children: [
                    createCell(
                        createParagraph("SITUAÇÃO DE APRENDIZAGEM", {
                            bold: true,
                            color: "FFFFFF",
                            size: 21,
                            alignment: AlignmentType.CENTER,
                            spacing: { before: 60, after: 60, line: 240 }
                        }),
                        { fill: "000000" }
                    )
                ]
            })
        ]
    }));

    // Espaçador
    docElements.push(new Paragraph({ spacing: { before: 40, after: 40 } }));

    // --- 2. TABELA 1: DADOS GERAIS DO CURSO E DA UC ---
    const saHoursParagraphs = [
        new Paragraph({
            spacing: { before: 20, after: 20, line: 240 },
            children: [
                new TextRun({ text: "Carga horária prevista para o desenvolvimento da Situação de Aprendizagem:", bold: true, size: 19 })
            ]
        })
    ];
    situacoes.forEach((sa, idx) => {
        const num = sa.numero || (idx + 1 < 10 ? `0${idx + 1}` : `${idx + 1}`);
        const h = sa.cargaHoraria || (sa.aulas ? Math.round((sa.aulas * 45) / 60) : 0);
        saHoursParagraphs.push(new Paragraph({
            spacing: { before: 10, after: 10, line: 240 },
            children: [
                new TextRun({ text: `◦ Situação de Aprendizagem ${num}: ${h} horas (${sa.aulas || 0} aulas).`, size: 19 })
            ]
        }));
    });

    const table1 = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: TABLE_BORDERS,
        rows: [
            new TableRow({
                children: [
                    createCell([
                        new Paragraph({
                            spacing: { before: 20, after: 20 },
                            children: [
                                new TextRun({ text: "Curso: ", bold: true, size: 19 }),
                                new TextRun({ text: curso, size: 19 })
                            ]
                        })
                    ], { width: 65 }),
                    createCell([
                        new Paragraph({
                            spacing: { before: 20, after: 20 },
                            children: [
                                new TextRun({ text: "Nível / Tipo: ", bold: true, size: 19 }),
                                new TextRun({ text: tipoLabel, size: 19 })
                            ]
                        })
                    ], { width: 35 })
                ]
            }),
            new TableRow({
                children: [
                    createCell([
                        new Paragraph({
                            spacing: { before: 20, after: 20 },
                            children: [
                                new TextRun({ text: "Unidade Curricular (UC): ", bold: true, size: 19 }),
                                new TextRun({ text: unidade, size: 19 })
                            ]
                        })
                    ], { width: 65 }),
                    createCell([
                        new Paragraph({
                            spacing: { before: 20, after: 20 },
                            children: [
                                new TextRun({ text: "Modalidade: ", bold: true, size: 19 }),
                                new TextRun({ text: modalidadeLabel, size: 19 })
                            ]
                        })
                    ], { width: 35 })
                ]
            }),
            new TableRow({
                children: [
                    createCell([
                        new Paragraph({
                            spacing: { before: 20, after: 20 },
                            children: [
                                new TextRun({ text: "Docente Principal: ", bold: true, size: 19 }),
                                new TextRun({ text: docente, size: 19 })
                            ]
                        })
                    ], { width: 65 }),
                    createCell([
                        new Paragraph({
                            spacing: { before: 20, after: 20 },
                            children: [
                                new TextRun({ text: "Turma / Semestre: ", bold: true, size: 19 }),
                                new TextRun({ text: `${turma}${semAno ? ` (${semAno})` : ''}`, size: 19 })
                            ]
                        })
                    ], { width: 35 })
                ]
            }),
            new TableRow({
                children: [
                    createCell([
                        new Paragraph({
                            spacing: { before: 20, after: 20 },
                            children: [
                                new TextRun({ text: "Carga horária da UC: ", bold: true, size: 19 }),
                                new TextRun({ text: `${cargaHoraria} horas`, size: 19 })
                            ]
                        })
                    ], { width: 50 }),
                    createCell([
                        new Paragraph({
                            spacing: { before: 20, after: 20 },
                            children: [
                                new TextRun({ text: "Nº de aulas: ", bold: true, size: 19 }),
                                new TextRun({ text: numAulas, size: 19 })
                            ]
                        })
                    ], { width: 50 })
                ]
            }),
            new TableRow({
                children: [
                    createCell(saHoursParagraphs, { columnSpan: 2 })
                ]
            }),
            new TableRow({
                children: [
                    createCell([
                        new Paragraph({
                            spacing: { before: 20, after: 20 },
                            children: [
                                new TextRun({ text: "Objetivo da UC: ", bold: true, size: 19 }),
                                new TextRun({ text: objetivoUC, size: 19 })
                            ]
                        })
                    ], { columnSpan: 2 })
                ]
            })
        ]
    });
    docElements.push(table1);

    // --- 3. SEÇÕES INDIVIDUAIS DE CADA SITUAÇÃO DE APRENDIZAGEM ---
    situacoes.forEach((sa, idx) => {
        const saNum = sa.numero || (idx + 1 < 10 ? `0${idx + 1}` : `${idx + 1}`);
        const saCleanTitle = cleanSaTitle(sa.titulo);
        const titleSuffix = saCleanTitle ? ` - ${saCleanTitle}` : '';

        // Quebra de página para manter cada SA organizada e legível
        docElements.push(new Paragraph({
            children: [new PageBreak()]
        }));

        // Título da Situação de Aprendizagem
        docElements.push(new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 100, after: 60 },
            children: [
                new TextRun({
                    text: `SITUAÇÃO DE APRENDIZAGEM ${saNum}${titleSuffix}`.toUpperCase(),
                    bold: true,
                    size: 21
                })
            ]
        }));

        // Tabela de Capacidades e Conhecimentos da SA
        const capBasicas = Array.isArray(sa.capacidadesBasicas) ? sa.capacidadesBasicas : [];
        const capTecnicas = Array.isArray(sa.capacidadesTecnicas) ? sa.capacidadesTecnicas : [];
        const capSocio = Array.isArray(sa.capacidadesSocioemocionais) ? sa.capacidadesSocioemocionais : [];
        const conhecimentos = Array.isArray(sa.conhecimentos) ? sa.conhecimentos : [];

        const capRows = [];

        if (capBasicas.length > 0) {
            capRows.push(new TableRow({
                children: [
                    createCell([
                        new Paragraph({
                            spacing: { before: 20, after: 20 },
                            children: [new TextRun({ text: "Capacidades Básicas:", bold: true, size: 19 })]
                        }),
                        ...createBulletList(capBasicas)
                    ])
                ]
            }));
        }

        capRows.push(new TableRow({
            children: [
                createCell([
                    new Paragraph({
                        spacing: { before: 20, after: 20 },
                        children: [new TextRun({ text: "Capacidades Técnicas:", bold: true, size: 19 })]
                    }),
                    ...createBulletList(capTecnicas)
                ])
            ]
        }));

        capRows.push(new TableRow({
            children: [
                createCell([
                    new Paragraph({
                        spacing: { before: 20, after: 20 },
                        children: [new TextRun({ text: "Capacidades Socioemocionais:", bold: true, size: 19 })]
                    }),
                    ...createBulletList(capSocio)
                ])
            ]
        }));

        capRows.push(new TableRow({
            children: [
                createCell([
                    new Paragraph({
                        spacing: { before: 20, after: 20 },
                        children: [new TextRun({ text: "Conhecimentos Relacionados:", bold: true, size: 19 })]
                    }),
                    ...createBulletList(conhecimentos)
                ])
            ]
        }));

        const tblCapCon = new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: TABLE_BORDERS,
            rows: capRows
        });
        docElements.push(tblCapCon);
        docElements.push(new Paragraph({ spacing: { before: 40, after: 40 } }));

        // Tabela de Estrutura da Situação de Aprendizagem (Contexto, Desafio, etc.)
        const ctxParagraphs = [
            new Paragraph({
                spacing: { before: 20, after: 20 },
                children: [new TextRun({ text: "Contextualização:", bold: true, size: 19 })]
            })
        ];
        if (sa.contextualizacaoTitulo) {
            ctxParagraphs.push(new Paragraph({
                spacing: { before: 10, after: 10 },
                children: [
                    new TextRun({ text: "Título: ", bold: true, size: 19 }),
                    new TextRun({ text: sanitize(sa.contextualizacaoTitulo), size: 19 })
                ]
            }));
        }
        if (sa.contextualizacao) {
            ctxParagraphs.push(new Paragraph({
                spacing: { before: 10, after: 20 },
                children: [new TextRun({ text: sanitize(sa.contextualizacao), size: 19 })]
            }));
        }

        const tblEstrutura = new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: TABLE_BORDERS,
            rows: [
                new TableRow({
                    children: [
                        createCell([
                            new Paragraph({
                                spacing: { before: 30, after: 30 },
                                children: [
                                    new TextRun({
                                        text: `Estratégia de aprendizagem ${saNum}: ${sanitize(sa.estrategiaTipo) || 'Situação-problema'}`,
                                        bold: true,
                                        size: 19
                                    })
                                ]
                            })
                        ], { fill: "F3F4F6" })
                    ]
                }),
                new TableRow({
                    children: [createCell(ctxParagraphs)]
                }),
                new TableRow({
                    children: [
                        createCell([
                            new Paragraph({
                                spacing: { before: 20, after: 10 },
                                children: [new TextRun({ text: "Observações para o docente:", bold: true, size: 19 })]
                            }),
                            new Paragraph({
                                spacing: { before: 0, after: 20 },
                                children: [new TextRun({ text: sanitize(sa.observacoesDocente) || '-', size: 19 })]
                            })
                        ])
                    ]
                }),
                new TableRow({
                    children: [
                        createCell([
                            new Paragraph({
                                spacing: { before: 20, after: 10 },
                                children: [new TextRun({ text: "Desafio:", bold: true, size: 19 })]
                            }),
                            new Paragraph({
                                spacing: { before: 0, after: 20 },
                                children: [new TextRun({ text: sanitize(sa.desafio) || '-', size: 19 })]
                            })
                        ])
                    ]
                }),
                new TableRow({
                    children: [
                        createCell([
                            new Paragraph({
                                spacing: { before: 20, after: 10 },
                                children: [new TextRun({ text: "Resultados esperados:", bold: true, size: 19 })]
                            }),
                            new Paragraph({
                                spacing: { before: 0, after: 20 },
                                children: [new TextRun({ text: sanitize(sa.resultadosEsperados) || '-', size: 19 })]
                            })
                        ])
                    ]
                })
            ]
        });
        docElements.push(tblEstrutura);
        docElements.push(new Paragraph({ spacing: { before: 60, after: 40 } }));

        // Título oficial: ESTRATÉGIAS DE ENSINO (5 colunas MSEP)
        docElements.push(new Paragraph({
            spacing: { before: 60, after: 40 },
            children: [
                new TextRun({
                    text: "ESTRATÉGIAS DE ENSINO, INSTRUMENTOS DE AVALIAÇÃO E RECURSOS DIDÁTICOS",
                    bold: true,
                    size: 20
                })
            ]
        }));

        const capListAll = [...capBasicas, ...capTecnicas, ...capSocio];
        const tbl5Cols = new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: TABLE_BORDERS,
            rows: [
                new TableRow({
                    children: [
                        createCell(createParagraph("Nº Horas / Aulas", { bold: true, size: 18, alignment: AlignmentType.CENTER }), { width: 12, fill: "F3F4F6" }),
                        createCell(createParagraph("Capacidades a serem trabalhadas", { bold: true, size: 18 }), { width: 25, fill: "F3F4F6" }),
                        createCell(createParagraph("Conhecimentos relacionados", { bold: true, size: 18 }), { width: 25, fill: "F3F4F6" }),
                        createCell(createParagraph("Estratégias de ensino e instrumentos de avaliação", { bold: true, size: 18 }), { width: 22, fill: "F3F4F6" }),
                        createCell(createParagraph("Recursos e ambientes pedagógicos", { bold: true, size: 18 }), { width: 16, fill: "F3F4F6" })
                    ]
                }),
                new TableRow({
                    children: [
                        createCell(createParagraph(`${sa.aulas || 0} aulas`, { bold: true, size: 19, alignment: AlignmentType.CENTER }), { width: 12 }),
                        createCell(createBulletList(capListAll), { width: 25 }),
                        createCell(createBulletList(conhecimentos), { width: 25 }),
                        createCell([
                            new Paragraph({
                                spacing: { before: 10, after: 5 },
                                children: [new TextRun({ text: "Estratégias:", bold: true, size: 18 })]
                            }),
                            new Paragraph({
                                spacing: { before: 0, after: 15 },
                                children: [new TextRun({ text: sanitize(sa.estrategiasEnsino) || sanitize(sa.estrategiaTipo) || '-', size: 18 })]
                            }),
                            new Paragraph({
                                spacing: { before: 10, after: 5 },
                                children: [new TextRun({ text: "Avaliação:", bold: true, size: 18 })]
                            }),
                            new Paragraph({
                                spacing: { before: 0, after: 10 },
                                children: [new TextRun({ text: sanitize(sa.instrumentosAvaliacao) || '-', size: 18 })]
                            })
                        ], { width: 22 }),
                        createCell(createParagraph(sanitize(sa.recursos) || '-', { size: 18 }), { width: 16 })
                    ]
                })
            ]
        });
        docElements.push(tbl5Cols);
        docElements.push(new Paragraph({ spacing: { before: 60, after: 40 } }));

        // Título oficial: INSTRUMENTO DE REGISTRO
        docElements.push(new Paragraph({
            spacing: { before: 60, after: 40 },
            children: [
                new TextRun({ text: "INSTRUMENTO DE REGISTRO", bold: true, size: 20 })
            ]
        }));

        // Linha Nome do Aluno, Turma e Docente
        const tblAlunoTurma = new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: TABLE_BORDERS,
            rows: [
                new TableRow({
                    children: [
                        createCell([
                            new Paragraph({
                                spacing: { before: 20, after: 20 },
                                children: [
                                    new TextRun({ text: "Nome do aluno: ", bold: true, size: 19 }),
                                    new TextRun({ text: "____________________________________", size: 19 })
                                ]
                            })
                        ], { width: 50 }),
                        createCell([
                            new Paragraph({
                                spacing: { before: 20, after: 20 },
                                children: [
                                    new TextRun({ text: "Turma: ", bold: true, size: 19 }),
                                    new TextRun({ text: turma, size: 19 })
                                ]
                            })
                        ], { width: 25 }),
                        createCell([
                            new Paragraph({
                                spacing: { before: 20, after: 20 },
                                children: [
                                    new TextRun({ text: "Docente: ", bold: true, size: 19 }),
                                    new TextRun({ text: docente, size: 19 })
                                ]
                            })
                        ], { width: 25 })
                    ]
                })
            ]
        });
        docElements.push(tblAlunoTurma);

        // Tabela Rubrica de Avaliação com Critérios (4 colunas oficiais)
        const criterios = Array.isArray(sa.criterios) ? sa.criterios : [];
        const critRows = [
            new TableRow({
                children: [
                    createCell(createParagraph("Capacidades básicas ou técnicas e socioemocionais", { bold: true, size: 18 }), { width: 30, fill: "F3F4F6" }),
                    createCell(createParagraph("Critérios de Avaliação", { bold: true, size: 18 }), { width: 50, fill: "F3F4F6" }),
                    createCell(createParagraph("Aluno", { bold: true, size: 18, alignment: AlignmentType.CENTER }), { width: 10, fill: "F3F4F6" }),
                    createCell(createParagraph("Professor", { bold: true, size: 18, alignment: AlignmentType.CENTER }), { width: 10, fill: "F3F4F6" })
                ]
            })
        ];

        criterios.forEach(c => {
            const isCritico = c.tipo === 'C';
            critRows.push(new TableRow({
                children: [
                    createCell(createParagraph(sanitize(c.cap) || '-', { size: 18 }), { width: 30 }),
                    createCell(createParagraph(sanitize(c.crit) || '-', { bold: isCritico, size: 18 }), { width: 50 }),
                    createCell(createParagraph("", { size: 18 }), { width: 10 }),
                    createCell(createParagraph("", { size: 18 }), { width: 10 })
                ]
            }));
        });

        const tblRubrica = new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: TABLE_BORDERS,
            rows: critRows
        });
        docElements.push(tblRubrica);

        // Legenda oficial
        docElements.push(new Paragraph({
            spacing: { before: 20, after: 40 },
            children: [
                new TextRun({ text: "Legenda: ", bold: true, size: 16 }),
                new TextRun({ text: "A = Atingiu | N = Não atingiu | ", size: 16 }),
                new TextRun({ text: "Negrito", bold: true, size: 16 }),
                new TextRun({ text: " = Crítico | Sem negrito = Desejável", size: 16 })
            ]
        }));
    });

    // --- 4. TABELA OFICIAL DE NÍVEIS DE DESEMPENHO (10 A 1) ---
    let totalCrit = 0;
    let totalDesej = 0;
    situacoes.forEach(sa => {
        (sa.criterios || []).forEach(c => {
            if (c.tipo === 'C') totalCrit++;
            else if (c.tipo === 'D') totalDesej++;
        });
    });

    const niveisList = calculateNiveisDesempenho(totalCrit, totalDesej);

    docElements.push(new Paragraph({
        children: [new PageBreak()]
    }));

    docElements.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 30 },
        children: [
            new TextRun({ text: "TABELA DE NÍVEIS DE DESEMPENHO", bold: true, size: 22 })
        ]
    }));

    docElements.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 80 },
        children: [
            new TextRun({ text: "Legenda: ", bold: true, size: 16, color: "555555" }),
            new TextRun({ text: "Negrito = Crítico | Sem negrito = Desejável | A = Atingiu | N = Não atingiu", size: 16, color: "555555" })
        ]
    }));

    const niveisRows = [
        new TableRow({
            children: [
                createCell(createParagraph("Critérios de Avaliação", { bold: true, size: 18 }), { width: 60, fill: "F3F4F6" }),
                createCell(createParagraph("Nível de desempenho", { bold: true, size: 18, alignment: AlignmentType.CENTER }), { width: 20, fill: "F3F4F6" }),
                createCell(createParagraph("Conversão em notas", { bold: true, size: 18, alignment: AlignmentType.CENTER }), { width: 20, fill: "F3F4F6" })
            ]
        })
    ];

    niveisList.forEach(n => {
        niveisRows.push(new TableRow({
            children: [
                createCell(createParagraph(n.crit, { size: 18 }), { width: 60 }),
                createCell(createParagraph(String(n.nivel), { bold: true, size: 18, alignment: AlignmentType.CENTER }), { width: 20 }),
                createCell(createParagraph(String(n.nota), { bold: true, size: 18, alignment: AlignmentType.CENTER }), { width: 20 })
            ]
        }));
    });

    const tblNiveis = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: TABLE_BORDERS,
        rows: niveisRows
    });
    docElements.push(tblNiveis);

    // Bloco de Assinatura e Encerramento Institucional do Docente
    docElements.push(new Paragraph({ spacing: { before: 140, after: 30 } }));
    docElements.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 20, after: 10 },
        children: [
            new TextRun({ text: "________________________________________________________", size: 19, color: "555555" })
        ]
    }));
    docElements.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 10 },
        children: [
            new TextRun({ text: `Docente Responsável: ${docente}`, bold: true, size: 20 })
        ]
    }));
    docElements.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 40 },
        children: [
            new TextRun({ text: `${escola} — SENAI-SP`, size: 18, color: "555555" })
        ]
    }));

    // --- 5. MONTAGEM FINAL DO DOCUMENTO COM PADRÕES INSTITUCIONAIS ---
    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: { font: "Arial", size: 20 },
                    paragraph: { spacing: { before: 30, after: 30, line: 240 } }
                }
            }
        },
        sections: [{
            properties: {
                page: {
                    margin: { top: 720, right: 720, bottom: 720, left: 720 }
                }
            },
            children: docElements
        }]
    });

    return await Packer.toBuffer(doc);
}

module.exports = {
    compilePlanoDocx,
    calculateNiveisDesempenho
};
