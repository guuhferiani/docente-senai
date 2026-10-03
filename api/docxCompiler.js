// ==========================================================================
// DOCENTE SENAI - COMPILADOR OFICIAL DOCX (PLANO DE ENSINO MSEP)
// Baseado no modelo institucional SENAI-SP (MODELO PLANO DE ENSINO.docx)
// ==========================================================================

const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

function escapeXml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
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

/**
 * Localiza as 13 tabelas de nível superior no document.xml
 */
function findTopTables(xml) {
    const tblRegex = /<w:tbl[\s>]/g;
    const tblEndRegex = /<\/w:tbl>/g;
    const tokens = [];
    let m;
    while ((m = tblRegex.exec(xml)) !== null) tokens.push({ type: 'start', pos: m.index });
    while ((m = tblEndRegex.exec(xml)) !== null) tokens.push({ type: 'end', pos: m.index });
    tokens.sort((a, b) => a.pos - b.pos);

    const topTables = [];
    let depth = 0, currentStart = 0;
    tokens.forEach(t => {
        if (t.type === 'start') {
            if (depth === 0) currentStart = t.pos;
            depth++;
        } else {
            depth--;
            if (depth === 0) {
                topTables.push({ start: currentStart, end: t.pos + '</w:tbl>'.length });
            }
        }
    });
    return topTables;
}

/**
 * Gera parágrafo formatado padrão Arial tamanho 10 (sz 20)
 */
function makeP(text, isBold = false, align = 'left', sz = 20) {
    const jcXml = align === 'center' ? '<w:jc w:val="center"/>' : (align === 'right' ? '<w:jc w:val="right"/>' : '');
    const boldXml = isBold ? '<w:b/><w:bCs/>' : '';
    return `<w:p><w:pPr>${jcXml}<w:spacing w:before="40" w:after="40"/><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/>${boldXml}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/>${boldXml}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

/**
 * Compila e preenche o documento DOCX com base no plano fornecido
 */
function compilePlanoDocx(plan, templatePath) {
    const defaultTemplate = path.resolve(__dirname, '../_base-referencia/Planos Ensinos/MODELO PLANO DE ENSINO.docx');
    const resolvedPath = templatePath || defaultTemplate;

    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Arquivo modelo não encontrado em: ${resolvedPath}`);
    }

    const zip = new AdmZip(resolvedPath);
    let xml = zip.readAsText('word/document.xml');

    const situacoes = plan.situacoes || [];
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

    // Processamos cada uma das 13 tabelas substituindo suas seções de dados
    // Vamos reconstruir o document.xml de trás para frente para manter os índices válidos
    const replacements = [];

    // --- TABELA 13: TABELA DE NÍVEIS DE DESEMPENHO (topTables[12]) ---
    const niveis = calculateNiveisDesempenho(totalCrit, totalDesej);
    let t13Xml = xml.substring(topTables[12].start, topTables[12].end);
    const t13Rows = t13Xml.split('</w:tr>');
    // Mantém as 2 primeiras linhas (Título e Cabeçalho de Colunas)
    const t13Header = t13Rows.slice(0, 2).join('</w:tr>') + '</w:tr>';
    let t13DataRows = '';
    niveis.forEach(n => {
        t13DataRows += `<w:tr><w:trPr><w:trHeight w:val="212"/></w:trPr>` +
            `<w:tc><w:tcPr><w:tcW w:w="7650" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>` +
            `<w:p><w:pPr><w:spacing w:before="60" w:after="60"/><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr>` +
            `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>${escapeXml(n.crit)}</w:t></w:r></w:p></w:tc>` +
            `<w:tc><w:tcPr><w:tcW w:w="1276" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>` +
            `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr>` +
            `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>${n.nivel}</w:t></w:r></w:p></w:tc>` +
            `<w:tc><w:tcPr><w:tcW w:w="1134" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>` +
            `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr>` +
            `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>${n.nota}</w:t></w:r></w:p></w:tc>` +
            `</w:tr>`;
    });
    replacements.push({
        start: topTables[12].start,
        end: topTables[12].end,
        content: t13Header + t13DataRows + '</w:tbl>'
    });

    // Helper para gerar linhas do Instrumento de Registro
    function buildInstrumentoRows(sa, turma) {
        if (!sa || !sa.criterios || sa.criterios.length === 0) return '';
        let rowsHtml = '';
        
        sa.criterios.forEach(c => {
            const isBold = c.tipo === 'C';
            const capText = c.cap || '-';
            const critText = c.crit || '-';

            rowsHtml += `<w:tr><w:trPr><w:trHeight w:val="558"/></w:trPr>` +
                // Col 1: Capacidade
                `<w:tc><w:tcPr><w:tcW w:w="3261" w:type="dxa"/></w:tcPr>` +
                `<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr>` +
                `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>${escapeXml(capText)}</w:t></w:r></w:p></w:tc>` +
                // Col 2: Critério de Avaliação (Crítico em Negrito)
                `<w:tc><w:tcPr><w:tcW w:w="5245" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>` +
                `<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/>${isBold ? '<w:b/><w:bCs/>' : ''}<w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr>` +
                `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/>${isBold ? '<w:b/><w:bCs/>' : ''}<w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>${escapeXml(critText)}</w:t></w:r></w:p></w:tc>` +
                // Col 3: Aluno (vazio)
                `<w:tc><w:tcPr><w:tcW w:w="1134" w:type="dxa"/></w:tcPr>` +
                `<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr></w:p></w:tc>` +
                // Col 4: Professor (vazio)
                `<w:tc><w:tcPr><w:tcW w:w="991" w:type="dxa"/></w:tcPr>` +
                `<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr></w:p></w:tc>` +
                `</w:tr>`;
        });
        return rowsHtml;
    }

    // Helper para gerar linhas da Tabela de Estratégias (5 colunas)
    function buildEstrategiasRows(sa) {
        if (!sa) return '';
        const aulasStr = String(sa.aulas || '');
        const capList = [...(sa.capacidadesTecnicas || []), ...(sa.capacidadesSocioemocionais || [])].join('; ');
        const conList = (sa.conhecimentos || []).join('; ');
        const estStr = `Estratégias: ${sa.estrategiasEnsino || sa.estrategiaTipo || ''}\nAvaliação: ${sa.instrumentosAvaliacao || ''}`;
        const recStr = `Recursos e Ambientes: ${sa.recursos || ''}`;

        return `<w:tr><w:trPr><w:trHeight w:val="484"/></w:trPr>` +
            // Col 1: Nº horas / aulas
            `<w:tc><w:tcPr><w:tcW w:w="895" w:type="dxa"/><w:tcBorders><w:top w:val="single" w:sz="12" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="12" w:space="0" w:color="000000"/><w:bottom w:val="dotted" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="dotted" w:sz="4" w:space="0" w:color="000000"/></w:tcBorders></w:tcPr>` +
            `<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr>` +
            `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>${escapeXml(aulasStr)}</w:t></w:r></w:p></w:tc>` +
            // Col 2: Capacidades a serem trabalhadas
            `<w:tc><w:tcPr><w:tcW w:w="3660" w:type="dxa"/><w:tcBorders><w:top w:val="single" w:sz="12" w:space="0" w:color="000000"/><w:left w:val="dotted" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="dotted" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="dotted" w:sz="4" w:space="0" w:color="000000"/></w:tcBorders></w:tcPr>` +
            `<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr>` +
            `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>${escapeXml(capList)}</w:t></w:r></w:p></w:tc>` +
            // Col 3: Conhecimentos relacionados
            `<w:tc><w:tcPr><w:tcW w:w="4678" w:type="dxa"/><w:tcBorders><w:top w:val="single" w:sz="12" w:space="0" w:color="000000"/><w:left w:val="dotted" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="dotted" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="dotted" w:sz="4" w:space="0" w:color="000000"/></w:tcBorders></w:tcPr>` +
            `<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr>` +
            `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>${escapeXml(conList)}</w:t></w:r></w:p></w:tc>` +
            // Col 4: Estratégias de ensino e instrumentos de avaliação
            `<w:tc><w:tcPr><w:tcW w:w="3402" w:type="dxa"/><w:tcBorders><w:top w:val="single" w:sz="12" w:space="0" w:color="000000"/><w:left w:val="dotted" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="dotted" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="dotted" w:sz="4" w:space="0" w:color="000000"/></w:tcBorders></w:tcPr>` +
            `<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr>` +
            `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>${escapeXml(estStr)}</w:t></w:r></w:p></w:tc>` +
            // Col 5: Recursos e ambientes pedagógicos
            `<w:tc><w:tcPr><w:tcW w:w="2017" w:type="dxa"/><w:tcBorders><w:top w:val="single" w:sz="12" w:space="0" w:color="000000"/><w:left w:val="dotted" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="dotted" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="12" w:space="0" w:color="000000"/></w:tcBorders></w:tcPr>` +
            `<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr>` +
            `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>${escapeXml(recStr)}</w:t></w:r></w:p></w:tc>` +
            `</w:tr>`;
    }

    // Processa Instrumentos de Registro (Tabelas 3, 6, 9, 12 -> índices 2, 5, 8, 11)
    const instConfigs = [
        { tblIdx: 2, sa: sa1 },
        { tblIdx: 5, sa: sa2 },
        { tblIdx: 8, sa: sa3 },
        { tblIdx: 11, sa: sa4 }
    ];

    instConfigs.forEach(cfg => {
        if (cfg.sa) {
            let tXml = xml.substring(topTables[cfg.tblIdx].start, topTables[cfg.tblIdx].end);
            const rows = tXml.split('</w:tr>');
            let r2 = rows[1];
            if (plan.turma) {
                r2 = r2.replace(/Turma:\s*<\/w:t>/, `Turma: ${escapeXml(plan.turma)}</w:t>`);
            }
            const headerRows = [rows[0], r2, rows[2], rows[3]].join('</w:tr>') + '</w:tr>';
            const dataRows = buildInstrumentoRows(cfg.sa, plan.turma);
            replacements.push({
                start: topTables[cfg.tblIdx].start,
                end: topTables[cfg.tblIdx].end,
                content: headerRows + dataRows + '</w:tbl>'
            });
        }
    });

    // Processa Tabelas de Estratégias (Tabelas 2, 5, 8, 11 -> índices 1, 4, 7, 10)
    const estConfigs = [
        { tblIdx: 1, sa: sa1 },
        { tblIdx: 4, sa: sa2 },
        { tblIdx: 7, sa: sa3 },
        { tblIdx: 10, sa: sa4 }
    ];

    estConfigs.forEach(cfg => {
        if (cfg.sa) {
            let tXml = xml.substring(topTables[cfg.tblIdx].start, topTables[cfg.tblIdx].end);
            const innerStart = tXml.indexOf('<w:tbl', 10);
            const innerEnd = tXml.lastIndexOf('</w:tbl>');
            if (innerStart !== -1 && innerEnd !== -1) {
                const preInner = tXml.substring(0, innerStart);
                const postInner = tXml.substring(innerEnd + '</w:tbl>'.length);
                const innerTbl = tXml.substring(innerStart, innerEnd + '</w:tbl>'.length);
                const rows = innerTbl.split('</w:tr>');
                const header = rows.slice(0, 2).join('</w:tr>') + '</w:tr>';
                const dataRow = buildEstrategiasRows(cfg.sa);
                const newInner = header + dataRow + '</w:tbl>';
                replacements.push({
                    start: topTables[cfg.tblIdx].start,
                    end: topTables[cfg.tblIdx].end,
                    content: preInner + newInner + postInner
                });
            }
        }
    });

    // Processa Contextos das SAs (Tabelas 4, 7, 10 -> índices 3, 6, 9 para SA2, SA3, SA4)
    const ctxConfigs = [
        { tblIdx: 3, sa: sa2, num: 2 },
        { tblIdx: 6, sa: sa3, num: 3 },
        { tblIdx: 9, sa: sa4, num: 4 }
    ];

    ctxConfigs.forEach(cfg => {
        if (cfg.sa) {
            let tXml = xml.substring(topTables[cfg.tblIdx].start, topTables[cfg.tblIdx].end);
            const rows = tXml.split('</w:tr>');
            if (rows.length >= 3) {
                const st = (cfg.sa.estrategiaTipo || '').toLowerCase();
                const isSP = st.includes('problema') ? 'x' : ' ';
                const isEC = st.includes('caso') ? 'x' : ' ';
                const isPA = st.includes('pesquisa') ? 'x' : ' ';
                const isPI = st.includes('integrador') ? 'x' : ' ';
                const isProj = (st.includes('projeto') && !isPI) ? 'x' : ' ';

                const r1Text = `Estratégia de aprendizagem desafiadora - Bloco ${cfg.num}: ${cfg.sa.titulo || ''}    Situação-problema ( ${isSP} ) Estudo de caso ( ${isEC} ) Pesquisa Aplicada ( ${isPA} ) Projeto ( ${isProj} ) Integrador ( ${isPI} )`;
                const r1 = `<w:tr><w:tc><w:tcPr><w:tcW w:w="9923" w:type="dxa"/><w:gridSpan w:val="2"/></w:tcPr>${makeP(r1Text, true)}</w:tc></w:tr>`;

                const r2P1 = makeP(`Contextualização: Título: ${cfg.sa.contextualizacaoTitulo || cfg.sa.titulo || ''}`, true);
                const r2P2 = makeP(cfg.sa.contextualizacao || '', false);
                const r2P3 = makeP(`Observações para o docente: ${cfg.sa.observacoesDocente || ''}`, false);
                const r2P4 = makeP(`Desafio: ${cfg.sa.desafio || ''}`, true);
                const r2P5 = makeP(`Resultados esperados: ${cfg.sa.resultadosEsperados || ''}`, false);
                const r2 = `<w:tr><w:tc><w:tcPr><w:tcW w:w="9923" w:type="dxa"/><w:gridSpan w:val="2"/></w:tcPr>${r2P1}${r2P2}${r2P3}${r2P4}${r2P5}</w:tc></w:tr>`;

                const r3 = rows[2] + '</w:tr>';
                replacements.push({
                    start: topTables[cfg.tblIdx].start,
                    end: topTables[cfg.tblIdx].end,
                    content: `<w:tbl>${r1}${r2}${r3}</w:tbl>`
                });
            }
        }
    });

    // Processa Tabela 1 (Header Geral + Contexto SA 1)
    let t1Xml = xml.substring(topTables[0].start, topTables[0].end);
    const t1Rows = t1Xml.split('</w:tr>');
    if (t1Rows.length >= 11) {
        const r1 = t1Rows[0] + '</w:tr>';
        const r2 = `<w:tr><w:tc><w:tcPr><w:tcW w:w="9923" w:type="dxa"/><w:gridSpan w:val="2"/></w:tcPr>${makeP(`Curso: ${plan.curso || ''}`, true)}</w:tc></w:tr>`;
        const r3 = `<w:tr><w:tc><w:tcPr><w:tcW w:w="9923" w:type="dxa"/><w:gridSpan w:val="2"/></w:tcPr>${makeP(`Unidade curricular (UC): ${plan.unidade || plan.curso || ''}`, true)}</w:tc></w:tr>`;
        
        const chStr = `Carga horária da UC: ${plan.cargaHoraria || 0} horas`;
        const naStr = `Nº de aulas: ${plan.numAulas || (plan.cargaHoraria ? `${plan.cargaHoraria} aulas` : '')}`;
        const r4 = `<w:tr><w:tc><w:tcPr><w:tcW w:w="4961" w:type="dxa"/></w:tcPr>${makeP(chStr, true)}</w:tc><w:tc><w:tcPr><w:tcW w:w="4962" w:type="dxa"/></w:tcPr>${makeP(naStr, true)}</w:tc></w:tr>`;

        let saHoursText = 'Carga horária prevista para o desenvolvimento da Situação de Aprendizagem :';
        situacoes.forEach((sa, idx) => {
            const h = sa.cargaHoraria || (sa.aulas ? Math.round((sa.aulas * 45) / 60) : 0);
            saHoursText += `\n◦ Situação de Aprendizagem 0${idx + 1}: ${h} horas (${sa.aulas || 0} aulas).`;
        });
        const r5Ps = saHoursText.split('\n').map((line, li) => makeP(line, li === 0));
        const r5 = `<w:tr><w:tc><w:tcPr><w:tcW w:w="9923" w:type="dxa"/><w:gridSpan w:val="2"/></w:tcPr>${r5Ps.join('')}</w:tc></w:tr>`;

        const r6 = `<w:tr><w:tc><w:tcPr><w:tcW w:w="9923" w:type="dxa"/><w:gridSpan w:val="2"/></w:tcPr>${makeP(`Objetivo da UC: ${plan.objetivoUC || 'Desenvolver capacidades técnicas e socioemocionais relativas à área de atuação.'}`, false)}</w:tc></w:tr>`;

        const isBasicas = (plan.capacidadesBasicas && plan.capacidadesBasicas.length > 0) ? 'x' : ' ';
        const isTecnicas = (plan.capacidadesTecnicas && plan.capacidadesTecnicas.length > 0) ? 'x' : 'x';
        const isSocio = (plan.capacidadesSocioemocionais && plan.capacidadesSocioemocionais.length > 0) ? 'x' : 'x';
        const r7Text = `Capacidades a serem desenvolvidas: Básicas ( ${isBasicas} ) Técnicas ( ${isTecnicas} ) Socioemocionais ( ${isSocio} )`;
        const r7 = `<w:tr><w:tc><w:tcPr><w:tcW w:w="9923" w:type="dxa"/><w:gridSpan w:val="2"/></w:tcPr>${makeP(r7Text, true)}</w:tc></w:tr>`;

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
        const r8Ps = capLines.map(line => makeP(line, line.startsWith('Capacidades Socioemocionais')));
        const r8 = `<w:tr><w:tc><w:tcPr><w:tcW w:w="9923" w:type="dxa"/><w:gridSpan w:val="2"/></w:tcPr>${r8Ps.join('')}</w:tc></w:tr>`;

        const conLines = ['Conhecimentos:'];
        (plan.conhecimentos || []).forEach(k => conLines.push(k));
        const r9Ps = conLines.map((l, li) => makeP(l, li === 0));
        const r9 = `<w:tr><w:tc><w:tcPr><w:tcW w:w="9923" w:type="dxa"/><w:gridSpan w:val="2"/></w:tcPr>${r9Ps.join('')}</w:tc></w:tr>`;

        const st1 = (sa1.estrategiaTipo || '').toLowerCase();
        const isSP1 = st1.includes('problema') ? 'x' : ' ';
        const isEC1 = st1.includes('caso') ? 'x' : ' ';
        const isPA1 = st1.includes('pesquisa') ? 'x' : ' ';
        const isPI1 = st1.includes('integrador') ? 'x' : ' ';
        const isProj1 = (st1.includes('projeto') && !isPI1) ? 'x' : ' ';
        const r10Text = `Estratégia de aprendizagem desafiadora - Bloco 1: ${sa1.titulo || ''}    Situação-problema ( ${isSP1} ) Estudo de caso ( ${isEC1} ) Pesquisa Aplicada ( ${isPA1} ) Projeto ( ${isProj1} ) Integrador ( ${isPI1} )`;
        const r10 = `<w:tr><w:tc><w:tcPr><w:tcW w:w="9923" w:type="dxa"/><w:gridSpan w:val="2"/></w:tcPr>${makeP(r10Text, true)}</w:tc></w:tr>`;

        const r11P1 = makeP(`Contextualização: Título: ${sa1.contextualizacaoTitulo || sa1.titulo || ''}`, true);
        const r11P2 = makeP(sa1.contextualizacao || '', false);
        const r11P3 = makeP(`Observações para o docente: ${sa1.observacoesDocente || ''}`, false);
        const r11P4 = makeP(`Desafio: ${sa1.desafio || ''}`, true);
        const r11P5 = makeP(`Resultados esperados: ${sa1.resultadosEsperados || ''}`, false);
        const r11 = `<w:tr><w:tc><w:tcPr><w:tcW w:w="9923" w:type="dxa"/><w:gridSpan w:val="2"/></w:tcPr>${r11P1}${r11P2}${r11P3}${r11P4}${r11P5}</w:tc></w:tr>`;

        const r12 = t1Rows[t1Rows.length - 2] + '</w:tr>';

        const newT1 = `<w:tbl>${r1}${r2}${r3}${r4}${r5}${r6}${r7}${r8}${r9}${r10}${r11}${r12}</w:tbl>`;
        replacements.push({
            start: topTables[0].start,
            end: topTables[0].end,
            content: newT1
        });
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
