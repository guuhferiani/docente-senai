// ==========================================================================
// DOCENTE SENAI - COMPILADOR OFICIAL DOCX (PLANO DE ENSINO MSEP)
// Baseado no modelo institucional SENAI-SP (MODELO PLANO DE ENSINO.docx)
// ==========================================================================

const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

const FONT = '<w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/>';

/**
 * Remove caracteres proibidos pelo XML 1.0 (caracteres de controle vindos da
 * extração de PDF / respostas da IA e surrogates órfãos). Qualquer um deles
 * dentro do document.xml faz o Word/Google Docs recusarem o arquivo.
 */
function sanitizeText(str) {
    return String(str)
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
        .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
}

function escapeXml(str) {
    if (str === null || str === undefined || str === '') return '';
    return sanitizeText(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

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
 * Calcula os 10 níveis oficiais de desempenho (10 a 1) e notas (100 a 10)
 * de acordo com a diretriz do SENAI-SP (Prompt 07 e documentos de referência).
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

// --------------------------------------------------------------------------
// Utilitários estruturais de XML (com controle de profundidade, para que
// tabelas aninhadas não quebrem a separação de linhas/células)
// --------------------------------------------------------------------------

/**
 * Retorna as faixas {start, end} dos elementos <w:TAG> de nível superior
 * dentro de `xml`, respeitando o aninhamento (ex.: tabelas dentro de células).
 */
function findTopLevel(xml, tag) {
    const re = new RegExp(`<(/?)w:${tag}(?=[\\s>/])[^>]*?(/?)>`, 'g');
    const ranges = [];
    let m, depth = 0, start = -1;
    while ((m = re.exec(xml)) !== null) {
        if (m[2] === '/') { // elemento auto-fechado
            if (depth === 0) ranges.push({ start: m.index, end: re.lastIndex });
            continue;
        }
        if (m[1] !== '/') {
            if (depth === 0) start = m.index;
            depth++;
        } else {
            depth--;
            if (depth === 0) ranges.push({ start, end: re.lastIndex });
        }
    }
    return ranges;
}

/**
 * Localiza as 13 tabelas de nível superior no document.xml
 */
function findTopTables(xml) {
    return findTopLevel(xml, 'tbl');
}

/**
 * Divide uma tabela em cabeçalho (<w:tbl> + tblPr + tblGrid) e linhas de nível superior.
 * Preservar tblPr/tblGrid é obrigatório: sem eles o Word considera o arquivo corrompido.
 */
function splitTable(tblXml) {
    const rowRanges = findTopLevel(tblXml, 'tr');
    const head = tblXml.substring(0, rowRanges.length ? rowRanges[0].start : tblXml.lastIndexOf('</w:tbl>'));
    const rows = rowRanges.map(r => tblXml.substring(r.start, r.end));
    return { head, rows };
}

function joinTable(head, rows) {
    return head + rows.join('') + '</w:tbl>';
}

/** Remove identificadores w14 para evitar IDs duplicados ao clonar linhas do modelo. */
function stripIds(xml) {
    return xml.replace(/\s+w14:(?:paraId|textId)="[^"]*"/g, '');
}

/**
 * Substitui o conteúdo da célula `cellIdx` de uma linha, preservando o <w:tcPr>
 * original (larguras, mesclagens, bordas e sombreamento do modelo).
 */
function setCellContent(trXml, cellIdx, contentXml) {
    const cells = findTopLevel(trXml, 'tc');
    const c = cells[cellIdx];
    if (!c) return trXml;
    const cellXml = trXml.substring(c.start, c.end);
    const prEnd = cellXml.indexOf('</w:tcPr>');
    const prefix = prEnd !== -1
        ? cellXml.substring(0, prEnd + '</w:tcPr>'.length)
        : cellXml.substring(0, cellXml.indexOf('>') + 1);
    // Toda célula precisa terminar com pelo menos um parágrafo
    const body = contentXml && contentXml.includes('<w:p') ? contentXml : makeP('');
    return trXml.substring(0, c.start) + prefix + body + '</w:tc>' + trXml.substring(c.end);
}

// --------------------------------------------------------------------------
// Geradores de parágrafos e células
// --------------------------------------------------------------------------

/** Gera os runs de texto, convertendo quebras de linha em <w:br/>. */
function makeRunContent(text) {
    const lines = sanitizeText(text === null || text === undefined ? '' : text).split(/\r?\n/);
    return lines.map(l => `<w:t xml:space="preserve">${escapeXml(l)}</w:t>`).join('<w:br/>');
}

/**
 * Gera parágrafo formatado padrão Arial tamanho 10 (sz 20).
 * Obs.: no <w:pPr> o <w:spacing> deve vir ANTES do <w:jc> (ordem exigida pelo schema OOXML).
 */
function makeP(text, isBold = false, align = 'left', sz = 20, compact = false) {
    const spacingXml = compact
        ? '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>'
        : '<w:spacing w:before="40" w:after="40"/>';
    const jcXml = align === 'center' ? '<w:jc w:val="center"/>' : (align === 'right' ? '<w:jc w:val="right"/>' : '');
    const boldXml = isBold ? '<w:b/><w:bCs/>' : '';
    const rPr = `<w:rPr>${FONT}${boldXml}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>`;
    return `<w:p><w:pPr>${spacingXml}${jcXml}${rPr}</w:pPr><w:r>${rPr}${makeRunContent(text)}</w:r></w:p>`;
}

/** Gera uma célula simples com largura fixa. */
function makeTc(width, paragraphXml, vCenter = false) {
    const vAlign = vCenter ? '<w:vAlign w:val="center"/>' : '';
    return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${vAlign}</w:tcPr>${paragraphXml}</w:tc>`;
}

function estrategiaChecks(estrategiaTipo) {
    const st = (estrategiaTipo || '').toLowerCase();
    const isPI = st.includes('integrador');
    return {
        sp: st.includes('problema') ? 'x' : ' ',
        ec: st.includes('caso') ? 'x' : ' ',
        pa: st.includes('pesquisa') ? 'x' : ' ',
        pi: isPI ? 'x' : ' ',
        proj: (st.includes('projeto') && !isPI) ? 'x' : ' '
    };
}

function buildEstrategiaHeaderP(num, sa) {
    const k = estrategiaChecks(sa.estrategiaTipo);
    return makeP(`Estratégia de aprendizagem desafiadora - Bloco ${num}: ${sa.titulo || ''}    Situação-problema ( ${k.sp} ) Estudo de caso ( ${k.ec} ) Pesquisa Aplicada ( ${k.pa} ) Projeto ( ${k.proj} ) Integrador ( ${k.pi} )`, true);
}

function buildContextualizacaoPs(sa) {
    return makeP(`Contextualização: Título: ${sa.contextualizacaoTitulo || sa.titulo || ''}`, true) +
        makeP(sa.contextualizacao || '', false) +
        makeP(`Observações para o docente: ${sa.observacoesDocente || ''}`, false) +
        makeP(`Desafio: ${sa.desafio || ''}`, true) +
        makeP(`Resultados esperados: ${sa.resultadosEsperados || ''}`, false);
}

/**
 * Compila e preenche o documento DOCX com base no plano fornecido
 */
function compilePlanoDocx(plan, templatePath) {
    const defaultTemplate = path.resolve(__dirname, '../template/plano-ensino/MODELO PLANO DE ENSINO.docx');
    const resolvedPath = templatePath || defaultTemplate;

    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Arquivo modelo não encontrado em: ${resolvedPath}`);
    }

    const zip = new AdmZip(resolvedPath);
    let xml = zip.readAsText('word/document.xml');

    const situacoes = (plan.situacoes || []).map(sa => ({
        ...sa,
        titulo: cleanSaTitle(sa.titulo),
        contextualizacaoTitulo: cleanSaTitle(sa.contextualizacaoTitulo)
    }));
    const sa1 = situacoes[0] || {};
    const sa2 = situacoes[1] || null;
    const sa3 = situacoes[2] || null;
    const sa4 = situacoes[3] || null;

    // 1. Contagem geral de critérios para a Tabela de Níveis
    let totalCrit = 0;
    let totalDesej = 0;
    situacoes.forEach(sa => {
        (sa.criterios || []).forEach(c => {
            if (c.tipo === 'C') totalCrit++;
            else if (c.tipo === 'D') totalDesej++;
        });
    });

    const topTables = findTopTables(xml);
    if (topTables.length < 13) {
        throw new Error(`Estrutura do modelo inesperada: encontradas apenas ${topTables.length} tabelas no nível raiz.`);
    }

    const tableXml = idx => xml.substring(topTables[idx].start, topTables[idx].end);

    // Processamos cada uma das 13 tabelas substituindo suas seções de dados
    // Vamos reconstruir o document.xml de trás para frente para manter os índices válidos
    const replacements = [];
    const replaceTable = (idx, content) => replacements.push({ start: topTables[idx].start, end: topTables[idx].end, content });

    // --- TABELA 13: TABELA DE NÍVEIS DE DESEMPENHO (topTables[12]) ---
    {
        const niveis = calculateNiveisDesempenho(totalCrit, totalDesej);
        const t = splitTable(tableXml(12));
        // Mantém as 2 primeiras linhas (Título e Cabeçalho de Colunas)
        const dataRows = niveis.map(n =>
            `<w:tr><w:trPr><w:trHeight w:val="212"/></w:trPr>` +
            makeTc(7650, makeP(n.crit, false, 'left', 20, false).replace('<w:spacing w:before="40" w:after="40"/>', '<w:spacing w:before="60" w:after="60"/>'), true) +
            makeTc(1276, makeP(String(n.nivel), true, 'center', 20, true), true) +
            makeTc(1134, makeP(String(n.nota), true, 'center', 20, true), true) +
            `</w:tr>`
        );
        replaceTable(12, joinTable(t.head, [...t.rows.slice(0, 2), ...dataRows]));
    }

    // Helper para gerar linhas do Instrumento de Registro
    function buildInstrumentoRows(sa) {
        if (!sa || !sa.criterios || sa.criterios.length === 0) return [];
        return sa.criterios.map(c => {
            const isBold = c.tipo === 'C';
            return `<w:tr><w:trPr><w:trHeight w:val="558"/></w:trPr>` +
                // Col 1: Capacidade
                makeTc(3261, makeP(c.cap || '-', false, 'left', 20, true)) +
                // Col 2: Critério de Avaliação (Crítico em Negrito)
                makeTc(5245, makeP(c.crit || '-', isBold, 'left', 20, true), true) +
                // Col 3: Aluno (vazio)
                makeTc(1134, makeP('', false, 'left', 20, true)) +
                // Col 4: Professor (vazio)
                makeTc(991, makeP('', false, 'left', 20, true)) +
                `</w:tr>`;
        });
    }

    // Processa Instrumentos de Registro (Tabelas 3, 6, 9, 12 -> índices 2, 5, 8, 11)
    [
        { tblIdx: 2, sa: sa1 },
        { tblIdx: 5, sa: sa2 },
        { tblIdx: 8, sa: sa3 },
        { tblIdx: 11, sa: sa4 }
    ].forEach(cfg => {
        if (!cfg.sa) return;
        const t = splitTable(tableXml(cfg.tblIdx));
        if (t.rows.length < 4) return;
        let r2 = t.rows[1];
        if (plan.turma) {
            r2 = r2.replace(/Turma:\s*<\/w:t>/, () => `Turma: ${escapeXml(plan.turma)}</w:t>`);
        }
        const header = [t.rows[0], r2, t.rows[2], t.rows[3]];
        replaceTable(cfg.tblIdx, joinTable(t.head, [...header, ...buildInstrumentoRows(cfg.sa)]));
    });

    // Processa Tabelas de Estratégias (Tabelas 2, 5, 8, 11 -> índices 1, 4, 7, 10)
    // A tabela externa contém uma tabela aninhada de 5 colunas com o conteúdo real.
    [
        { tblIdx: 1, sa: sa1 },
        { tblIdx: 4, sa: sa2 },
        { tblIdx: 7, sa: sa3 },
        { tblIdx: 10, sa: sa4 }
    ].forEach(cfg => {
        if (!cfg.sa) return;
        const outerXml = tableXml(cfg.tblIdx);
        const outer = splitTable(outerXml);
        if (!outer.rows.length) return;
        const outerRow = outer.rows[0];
        const nestedRange = findTopLevel(outerRow, 'tbl')[0];
        if (!nestedRange) return;
        const nested = splitTable(outerRow.substring(nestedRange.start, nestedRange.end));
        if (nested.rows.length < 3) return;

        const sa = cfg.sa;
        const capList = [...(sa.capacidadesTecnicas || []), ...(sa.capacidadesSocioemocionais || [])].join('; ');
        const conList = (sa.conhecimentos || []).join('; ');
        const estStr = `Estratégias: ${sa.estrategiasEnsino || sa.estrategiaTipo || ''}\nAvaliação: ${sa.instrumentosAvaliacao || ''}`;
        const recStr = `Recursos e Ambientes: ${sa.recursos || ''}`;

        // Clona a primeira linha vazia do modelo (preserva bordas/larguras) e preenche as 5 colunas
        let dataRow = stripIds(nested.rows[2]);
        dataRow = setCellContent(dataRow, 0, makeP(String(sa.aulas || ''), false, 'center', 20, true));
        dataRow = setCellContent(dataRow, 1, makeP(capList, false, 'left', 20, true));
        dataRow = setCellContent(dataRow, 2, makeP(conList, false, 'left', 20, true));
        dataRow = setCellContent(dataRow, 3, makeP(estStr, false, 'left', 20, true));
        dataRow = setCellContent(dataRow, 4, makeP(recStr, false, 'left', 20, true));

        const newNested = joinTable(nested.head, [nested.rows[0], nested.rows[1], dataRow]);
        const newOuterRow = outerRow.substring(0, nestedRange.start) + newNested + outerRow.substring(nestedRange.end);
        replaceTable(cfg.tblIdx, joinTable(outer.head, [newOuterRow, ...outer.rows.slice(1)]));
    });

    // Processa Contextos das SAs (Tabelas 4, 7, 10 -> índices 3, 6, 9 para SA2, SA3, SA4)
    [
        { tblIdx: 3, sa: sa2, num: 2 },
        { tblIdx: 6, sa: sa3, num: 3 },
        { tblIdx: 9, sa: sa4, num: 4 }
    ].forEach(cfg => {
        if (!cfg.sa) return;
        const t = splitTable(tableXml(cfg.tblIdx));
        if (t.rows.length < 3) return;
        const rows = [...t.rows];
        rows[0] = setCellContent(rows[0], 0, buildEstrategiaHeaderP(cfg.num, cfg.sa));
        rows[1] = setCellContent(rows[1], 0, buildContextualizacaoPs(cfg.sa));
        replaceTable(cfg.tblIdx, joinTable(t.head, rows));
    });

    // Processa Tabela 1 (Header Geral + Contexto SA 1)
    {
        const t = splitTable(tableXml(0));
        if (t.rows.length >= 12) {
            const rows = [...t.rows];
            rows[1] = setCellContent(rows[1], 0, makeP(`Curso: ${plan.curso || ''}`, true));
            rows[2] = setCellContent(rows[2], 0, makeP(`Unidade curricular (UC): ${plan.unidade || plan.curso || ''}`, true));

            const chStr = `Carga horária da UC: ${plan.cargaHoraria || 0} horas`;
            const naStr = `Nº de aulas: ${plan.numAulas || (plan.cargaHoraria ? `${plan.cargaHoraria} aulas` : '')}`;
            rows[3] = setCellContent(rows[3], 0, makeP(chStr, true));
            rows[3] = setCellContent(rows[3], 1, makeP(naStr, true));

            const saHoursLines = ['Carga horária prevista para o desenvolvimento da Situação de Aprendizagem :'];
            situacoes.forEach((sa, idx) => {
                const h = sa.cargaHoraria || (sa.aulas ? Math.round((sa.aulas * 45) / 60) : 0);
                saHoursLines.push(`◦ Situação de Aprendizagem 0${idx + 1}: ${h} horas (${sa.aulas || 0} aulas).`);
            });
            rows[4] = setCellContent(rows[4], 0, saHoursLines.map((line, li) => makeP(line, li === 0)).join(''));

            rows[5] = setCellContent(rows[5], 0, makeP(`Objetivo da UC: ${plan.objetivoUC || 'Desenvolver capacidades técnicas e socioemocionais relativas à área de atuação.'}`, false));

            const isBasicas = (plan.capacidadesBasicas && plan.capacidadesBasicas.length > 0) ? 'x' : ' ';
            const isTecnicas = 'x';
            const isSocio = 'x';
            rows[6] = setCellContent(rows[6], 0, makeP(`Capacidades a serem desenvolvidas: Básicas ( ${isBasicas} ) Técnicas ( ${isTecnicas} ) Socioemocionais ( ${isSocio} )`, true));

            const capLines = [];
            let capCounter = 1;
            (plan.capacidadesTecnicas || []).forEach(c => {
                capLines.push(`${capCounter++}. ${c}`);
            });
            if (plan.capacidadesSocioemocionais && plan.capacidadesSocioemocionais.length > 0) {
                capLines.push('Capacidades Socioemocionais:');
                let socioCounter = 1;
                plan.capacidadesSocioemocionais.forEach(s => {
                    capLines.push(`${socioCounter++}. ${s}`);
                });
            }
            rows[7] = setCellContent(rows[7], 0, capLines.map(line => makeP(line, line.startsWith('Capacidades Socioemocionais'))).join(''));

            const conLines = ['Conhecimentos:', ...(plan.conhecimentos || [])];
            rows[8] = setCellContent(rows[8], 0, conLines.map((l, li) => makeP(l, li === 0)).join(''));

            rows[9] = setCellContent(rows[9], 0, buildEstrategiaHeaderP(1, sa1));
            rows[10] = setCellContent(rows[10], 0, buildContextualizacaoPs(sa1));
            // rows[0] (título) e rows[11] (Anexos) permanecem como no modelo

            replaceTable(0, joinTable(t.head, rows));
        }
    }

    // Aplica substituições em ordem decrescente de índice
    replacements.sort((a, b) => b.start - a.start);
    replacements.forEach(rep => {
        xml = xml.substring(0, rep.start) + rep.content + xml.substring(rep.end);
    });

    zip.updateFile('word/document.xml', Buffer.from(xml, 'utf8'));
    return zip.toBuffer();
}

module.exports = {
    compilePlanoDocx,
    calculateNiveisDesempenho
};
