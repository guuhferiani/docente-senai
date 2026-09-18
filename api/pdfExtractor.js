const zlib = require('zlib');
const https = require('https');

/**
 * Pure Node.js in-memory PDF text extractor
 * Decompresses FlateDecode streams, parses ToUnicode CMaps (UCS-2/UTF-16BE hex strings),
 * and handles standard literal text streams.
 */
function extractPdfText(buffer) {
    if (!buffer || !Buffer.isBuffer(buffer)) return '';
    let cursor = 0;
    let streams = [];
    while (true) {
        const streamIdx = buffer.indexOf('stream', cursor);
        if (streamIdx === -1) break;
        let start = streamIdx + 6;
        if (buffer[start] === 0x0d && buffer[start + 1] === 0x0a) start += 2;
        else if (buffer[start] === 0x0a) start += 1;
        const end = buffer.indexOf('endstream', start);
        if (end === -1) break;
        try {
            const dec = zlib.inflateSync(buffer.subarray(start, end));
            streams.push(dec.toString('latin1'));
        } catch (e) {}
        cursor = end + 9;
    }

    // 1. Parse Adobe Identity / ToUnicode CMaps
    let cmap = new Map();
    for (const s of streams) {
        if (!s.includes('begincmap')) continue;

        // bfchar: <srcHex> <dstHex>
        const bfcharBlocks = s.matchAll(/(\d+)\s+beginbfchar\s*(.*?)\s*endbfchar/gs);
        for (const b of bfcharBlocks) {
            const pairs = b[2].matchAll(/<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>/g);
            for (const p of pairs) {
                cmap.set(parseInt(p[1], 16), String.fromCharCode(parseInt(p[2], 16)));
            }
        }

        // bfrange format 1: <start> <end> [ <dst1> <dst2> ... ]
        // bfrange format 2: <start> <end> <dstBase>
        const bfrangeBlocks = s.matchAll(/(\d+)\s+beginbfrange\s*(.*?)\s*endbfrange/gs);
        for (const b of bfrangeBlocks) {
            const arrRanges = b[2].matchAll(/<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>\s*\[(.*?)\]/gs);
            for (const ar of arrRanges) {
                const start = parseInt(ar[1], 16);
                const dsts = [...ar[3].matchAll(/<([0-9a-fA-F]+)>/g)].map(x => String.fromCharCode(parseInt(x[1], 16)));
                for (let i = 0; i < dsts.length; i++) {
                    cmap.set(start + i, dsts[i]);
                }
            }
            const cleanBlock = b[2].replace(/<[0-9a-fA-F]+>\s+<[0-9a-fA-F]+>\s*\[.*?\]/gs, '');
            const simpleRanges = cleanBlock.matchAll(/<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>/g);
            for (const sr of simpleRanges) {
                const start = parseInt(sr[1], 16);
                const end = parseInt(sr[2], 16);
                const base = parseInt(sr[3], 16);
                for (let c = start; c <= end; c++) {
                    cmap.set(c, String.fromCharCode(base + (c - start)));
                }
            }
        }
    }

    function decodeHex(hexStr) {
        const clean = hexStr.replace(/\s+/g, '');
        let res = '';
        for (let i = 0; i < clean.length; i += 4) {
            const hexChunk = clean.substr(i, 4);
            if (hexChunk.length < 4) break;
            const code = parseInt(hexChunk, 16);
            if (cmap.has(code)) {
                res += cmap.get(code);
            } else if (code >= 32 && code <= 126) {
                res += String.fromCharCode(code);
            } else {
                res += ' ';
            }
        }
        return res;
    }

    // 2. Decode text streams
    let allText = [];
    for (const s of streams) {
        if (s.includes('begincmap')) continue;
        const tjMatches = s.matchAll(/\[(.*?)\]\s*TJ|(\([^\)]*\)|<[0-9a-fA-F\s]+>)\s*Tj/gs);
        for (const m of tjMatches) {
            if (m[1]) {
                const tokens = m[1].matchAll(/\((.*?)\)|<([0-9a-fA-F\s]+)>/gs);
                let chunk = '';
                for (const t of tokens) {
                    if (t[1] !== undefined) chunk += t[1];
                    else if (t[2] !== undefined) chunk += decodeHex(t[2]);
                }
                if (chunk) allText.push(chunk);
            } else if (m[2]) {
                if (m[2].startsWith('<')) {
                    allText.push(decodeHex(m[2].slice(1, -1)));
                } else {
                    allText.push(m[2].slice(1, -1));
                }
            }
        }
    }

    return allText.join(' ')
        .replace(/\\([0-7]{1,3})/g, (match, oct) => String.fromCharCode(parseInt(oct, 8)))
        .replace(/\\(.)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Heuristically parses SENAI Course Plan text to detect Level, Structure, and UCs
 */
function parseCoursePlanHeuristic(text, fileName = '') {
    // Isolate preface (first 2500 chars) and neutralize institutional title to avoid false positives
    const preface = text.slice(0, 2500).replace(/Serviço\s+Nacional\s+de\s+Aprendizagem\s+Industrial/gi, 'SENAI');

    // 1. Detect Course Level / Type
    let cursoTipo = 'fic';
    if (/^ct[_\s-]/i.test(fileName) || /Habilita..o\s+(?:Profissional\s+)?T.cnica|T.cnico\s+em/i.test(preface)) {
        cursoTipo = 'tecnico';
    } else if (/^cai[_\s-]/i.test(fileName) || /Aprendizagem\s+Industrial/i.test(preface)) {
        cursoTipo = 'cai';
    } else if (/Superior|Gradua..o|Tecn.logo\s+em|Bacharelado|Engenharia/i.test(preface)) {
        cursoTipo = 'superior';
    } else if (/Aperfei.oamento|Qualifica..o|Inicia..o|FIC\b/i.test(preface)) {
        cursoTipo = 'fic';
    }

    // 2. Extract Course Name
    let cursoNome = '';
    const mTec = preface.match(/Habilita..o\s+(?:Profissional\s+)?(?:de\s+)?T.cnico\s+em\s+([0-9A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ\s]{4,60})/i)
        || preface.match(/T[EÉ]CNICO\s+EM\s+([0-9A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ\s]{4,60})/i);
    const mCai = preface.match(/Aprendizagem\s+Industrial\s*(?::\s*|\s+)([0-9A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ\s]{4,60})/i);
    const mFic = preface.match(/(?:Aperfeiçoamento|Qualificação|Iniciação)\s+Profissional\s*(?::\s*|\s+)([0-9A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇa-záéíóúâêîôûãõç\s\-_/]{4,60})/i);

    if (cursoTipo === 'tecnico' && mTec) {
        cursoNome = "Técnico em " + mTec[1].trim();
    } else if (cursoTipo === 'cai' && mCai) {
        cursoNome = mCai[1].trim();
    } else if (mFic) {
        cursoNome = mFic[1].trim();
    } else {
        cursoNome = fileName.replace(/\.pdf$/i, '').replace(/^(?:CAI|CT|FIC)[_\s-]+/i, '').replace(/[_-]/g, ' ').trim();
    }

    // Clean extraneous phrases from cursoNome
    cursoNome = cursoNome.replace(/\b(Plano de Curso|SENAI.*|SÃO PAULO.*|Página.*|SUMÁRIO.*|Eixo Tecnológico.*|De acordo com.*|Diretoria.*)$/i, '').trim();
    cursoNome = cursoNome.replace(/^(?:Aperfeiçoamento|Qualificação|Iniciação)\s+Profissional\s*(?:–|-|:)?\s*/i, '').trim();
    cursoNome = cursoNome.replace(/\s+/g, ' ');

    // 3. Detect 3 vs 4 Semesters
    let semestres = null;
    if (cursoTipo === 'tecnico' || cursoTipo === 'cai') {
        if (/\b4\s*semestres\b|\b4º\s*semestre\b/i.test(text)) {
            semestres = 4;
        } else if (/\b3\s*semestres\b|\b3º\s*semestre\b/i.test(text)) {
            semestres = 3;
        }
    }

    // 4. Detect Remote / Non-presential Activities
    const hasRemoto = /n[aã]o\s+presencia(?:l|is)|a\s+dist[aâ]ncia|EAD\b/i.test(text);

    // 5. Extract Unidades Curriculares from Text
    const unidades = [];
    const seenUcs = new Set();

    // Focus search on Quadro de Organização Curricular (after Table of Contents)
    let searchScope = text;
    const quadroMatches = [...text.matchAll(/Quadro[s]?\s+de\s+Organização\s+Curricular/gi)].filter(m => m.index > 5000);
    if (quadroMatches.length > 0) {
        const startIdx = quadroMatches[0].index;
        searchScope = text.slice(startIdx, startIdx + 5000);
    }

    // Clean structural words that glue to UC names in PDF text stream
    searchScope = searchScope.replace(/Módulo\s+[A-Za-z0-9À-ÿ]+\b/gi, ' ');
    searchScope = searchScope.replace(/Semestre\s+[A-Za-z0-9À-ÿ]+\b/gi, ' ');
    searchScope = searchScope.replace(/Operacionalização\s+em\s+\d+\s+semestres/gi, ' ');
    searchScope = searchScope.replace(/n[aã]o\s+presencial/gi, ' ');
    searchScope = searchScope.replace(/\bpresencial\b/gi, ' ');
    searchScope = searchScope.replace(/\bAtividade[s]?\b/gi, ' ');

    const tablePattern = /([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][a-záéíóúâêîôûãõçA-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ\s\-_/]{4,70})\s+(\d{2,3})\s*(?:h|horas|\b)/g;
    let m;
    while ((m = tablePattern.exec(searchScope)) !== null) {
        let rawName = m[1].replace(/\s+/g, ' ').trim();
        rawName = rawName.replace(/^(?:Módulo|Etapa|Semestre|Nível|Legislação|Quadro|Operacionalização|Horas|Atividade)[^\w]*[A-Za-z0-9]*\s*/i, '').trim();
        const ch = parseInt(m[2]);
        const isBlacklisted = /\b(?:página|departamento|conselho|resolução|artigo|título|carga\s+hor[aá]ria|total|itiner[aá]rio|sum[aá]rio|anexo|etapa|nível\s+de\s+ensino|legisla[çc][aã]o|unidade\s+curricular)\b/i.test(rawName)
            || /^(?:entre|acima|como|pelo|pela|conforme|segundo|de\s+acordo|a\s+partir)\b/i.test(rawName);

        if (!isBlacklisted && ch >= 20 && ch <= 400 && rawName.length >= 6 && rawName.length <= 65) {
            const key = rawName.toUpperCase();
            if (!seenUcs.has(key)) {
                seenUcs.add(key);
                unidades.push({
                    nome: rawName,
                    cargaHoraria: ch,
                    semestre: null,
                    remotoHoras: (hasRemoto && ch >= 60) ? Math.round(ch * 0.2) : 0
                });
            }
        }
    }

    // Fallback if no UCs found in quadro scope
    if (unidades.length === 0) {
        let mFallback;
        while ((mFallback = tablePattern.exec(text)) !== null) {
            let rawName = mFallback[1].replace(/\s+/g, ' ').trim();
            rawName = rawName.replace(/^(?:Módulo|Etapa|Semestre|Nível|Legislação|Quadro|Operacionalização|Horas|Atividade)[^\w]*[A-Za-z0-9]*\s*/i, '').trim();
            const ch = parseInt(mFallback[2]);
            const isBlacklisted = /\b(?:página|departamento|conselho|resolução|artigo|título|carga\s+hor[aá]ria|total|itiner[aá]rio|sum[aá]rio|anexo|etapa|nível\s+de\s+ensino|legisla[çc][aã]o|unidade\s+curricular)\b/i.test(rawName)
                || /^(?:entre|acima|como|pelo|pela|conforme|segundo|de\s+acordo|a\s+partir)\b/i.test(rawName);
            if (!isBlacklisted && ch >= 20 && ch <= 400 && rawName.length >= 6 && rawName.length <= 65) {
                const key = rawName.toUpperCase();
                if (!seenUcs.has(key)) {
                    seenUcs.add(key);
                    unidades.push({
                        nome: rawName,
                        cargaHoraria: ch,
                        semestre: null,
                        remotoHoras: (hasRemoto && ch >= 60) ? Math.round(ch * 0.2) : 0
                    });
                }
            }
        }
    }

    return {
        cursoNome,
        cursoTipo,
        semestres,
        hasRemoto,
        hasRemoteHours: hasRemoto,
        unidades: unidades.slice(0, 25),
        _extractedVia: 'heuristica'
    };
}

/**
 * AI-Powered Parser using Google Gemini with automatic fallback to heuristics
 */
async function parseCoursePlanWithGemini(text, fileName, apiKey) {
    if (!apiKey || apiKey === 'sua_chave_gemini_aqui' || apiKey.trim().length < 10) {
        return parseCoursePlanHeuristic(text, fileName);
    }

    const cleanSnippet = text.length > 35000 ? (text.slice(0, 20000) + "\n...\n" + text.slice(text.indexOf('ORGANIZAÇÃO CURRICULAR') !== -1 ? text.indexOf('ORGANIZAÇÃO CURRICULAR') : 20000, 35000)) : text;

    const prompt = `Você é um Especialista em Organização Curricular e Engenharia Pedagógica do SENAI-SP.
Analise o texto extraído de um Plano de Curso do SENAI (Nome do arquivo: "${fileName}") e extraia a estrutura curricular em formato JSON rigoroso:

1. "cursoNome": Nome oficial da Habilitação / Curso Matriz (ex: "Técnico em Desenvolvimento de Sistemas", "Eletricista de Manutenção", "Mecânico de Usinagem"). Não coloque nome de unidade curricular aqui.
2. "cursoTipo": Nível do curso:
   - "tecnico": Curso Técnico de Nível Médio
   - "cai": Curso de Aprendizagem Industrial
   - "fic": Formação Inicial e Continuada (Qualificação ou Aperfeiçoamento)
   - "superior": Curso Superior de Tecnologia (CST) ou Graduação
3. "semestres": 3 ou 4 se for curso regular (CT ou CAI), ou null se for curso livre/FIC.
4. "hasRemoto": true se houver previsão de atividades não presenciais / remotas / EaD no plano; false caso contrário.
5. "unidades": Array com a lista das Unidades Curriculares (UCs) da matriz curricular:
   - "nome": Nome oficial da Unidade Curricular (ex: "Levantamento de Requisitos", "Lógica de Programação e Algoritmos", "Banco de Dados", "Programação Web Back-End").
   - "cargaHoraria": Carga horária total daquela UC em horas (ex: 60, 75, 80, 120).
   - "semestre": Semestre ao qual pertence (1, 2, 3 ou 4) se identificável, ou null.
   - "remotoHoras": Quantidade de horas não presenciais / remotas da UC se houver, ou 0.

Retorne APENAS um JSON válido no formato:
{
  "cursoNome": "...",
  "cursoTipo": "tecnico",
  "semestres": 3,
  "hasRemoto": true,
  "unidades": [
    { "nome": "Levantamento de Requisitos", "cargaHoraria": 60, "semestre": 1, "remotoHoras": 0 },
    { "nome": "Lógica de Programação e Algoritmos", "cargaHoraria": 75, "semestre": 1, "remotoHoras": 0 }
  ]
}

Texto do Plano de Curso:
${cleanSnippet}`;

    const candidateModels = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-flash-latest", "gemini-2.5-flash"];
    
    for (const modelName of candidateModels) {
        try {
            const requestBody = JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.1,
                    responseMimeType: "application/json"
                }
            });

            const plan = await new Promise((resolve) => {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey.trim()}`;
                const req = https.request(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(requestBody)
                    },
                    timeout: 20000
                }, (res) => {
                    let resData = '';
                    res.on('data', chunk => { resData += chunk; });
                    res.on('end', () => {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            try {
                                const parsed = JSON.parse(resData);
                                let content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                                content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
                                const firstBrace = content.indexOf('{');
                                const lastBrace = content.lastIndexOf('}');
                                if (firstBrace !== -1 && lastBrace !== -1) {
                                    content = content.slice(firstBrace, lastBrace + 1);
                                }
                                const data = JSON.parse(content);
                                data._extractedVia = `Google Gemini (${modelName})`;
                                resolve(data);
                            } catch (e) {
                                resolve(null);
                            }
                        } else {
                            resolve(null);
                        }
                    });
                });
                req.on('error', () => resolve(null));
                req.on('timeout', () => { req.destroy(); resolve(null); });
                req.write(requestBody);
                req.end();
            });

            if (plan && plan.unidades && plan.unidades.length > 0) {
                return plan;
            }
        } catch (err) {}
    }

    // Fallback to heuristic
    return parseCoursePlanHeuristic(text, fileName);
}

module.exports = {
    extractPdfText,
    parseCoursePlanHeuristic,
    parseCoursePlanWithGemini
};
