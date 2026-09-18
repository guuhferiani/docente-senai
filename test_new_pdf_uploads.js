const http = require('http');
const fs = require('fs');
const path = require('path');

function sendPost(endpoint, payload) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(payload);
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: endpoint,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = http.request(options, (res) => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(buffer.toString()));
                } else {
                    reject(new Error(`Status: ${res.statusCode} - ${buffer.toString()}`));
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function testNewPdfs() {
    console.log("==========================================================================");
    console.log("🧪 TESTANDO OS NOVOS DOCUMENTOS DE PLANO DE CURSO VIA API HTTP");
    console.log("==========================================================================\n");

    const newCourses = [
        {
            file: 'CAI_ASSISTENTE_ADMINISTRATIVO.pdf',
            expectedTipo: 'cai',
            expectedDuration: 60
        },
        {
            file: 'CT_ADMINISTRAÇÃO.pdf',
            expectedTipo: 'tecnico',
            expectedDuration: 45
        }
    ];

    for (const item of newCourses) {
        console.log(`\n📄 [TESTE DE UPLOAD] Enviando: ${item.file}...`);
        const filePath = path.join(__dirname, '_base-referencia', 'Plano Cursos', item.file);
        const fileBuffer = fs.readFileSync(filePath);
        const base64Data = fileBuffer.toString('base64');

        // 1. Chamar endpoint de parsing de PDF
        const parseRes = await sendPost('/api/parse-course-plan', {
            fileName: item.file,
            fileData: base64Data
        });

        console.log(`   ✅ Sucesso no parsing!`);
        console.log(`   📚 Curso Detectado: "${parseRes.cursoNome}"`);
        console.log(`   🏷️  Tipo de Curso: "${parseRes.cursoTipo}" (Esperado: "${item.expectedTipo}")`);
        console.log(`   📅 Semestres: ${parseRes.semestres}`);
        console.log(`   🌐 Remoto / EaD: ${parseRes.hasRemoto}`);
        console.log(`   📋 UCs Detectadas (${parseRes.unidades.length}):`);
        parseRes.unidades.slice(0, 5).forEach((u, i) => {
            console.log(`      ${i + 1}. ${u.nome} (${u.cargaHoraria}h, EaD: ${u.remotoHoras}h)`);
        });

        if (parseRes.cursoTipo !== item.expectedTipo) {
            throw new Error(`Tipo divergente para ${item.file}: obtido ${parseRes.cursoTipo}, esperado ${item.expectedTipo}`);
        }
        if (parseRes.unidades.length === 0) {
            throw new Error(`Nenhuma UC detectada para ${item.file}!`);
        }

        // 2. Simular seleção da primeira UC e geração de MSEP
        const targetUc = parseRes.unidades[0];
        console.log(`\n   ⚡ [GERAÇÃO MSEP] Gerando MSEP para a UC: "${targetUc.nome}" (${targetUc.cargaHoraria}h)...`);
        
        const msepPayload = {
            courseKey: "custom",
            courseName: parseRes.cursoNome,
            courseUnit: targetUc.nome,
            unitSigla: targetUc.nome.split(' ').map(w => w[0]).join('').slice(0, 8).toUpperCase(),
            workload: targetUc.cargaHoraria,
            cursoTipo: parseRes.cursoTipo,
            duracaoAula: (parseRes.cursoTipo === 'tecnico') ? 45 : 60,
            semestreEscolhido: parseRes.semestres ? "1º Semestre" : null,
            aulasPresenciais: targetUc.cargaHoraria - (targetUc.remotoHoras || 0),
            aulasEad: targetUc.remotoHoras || 0,
            docente: "Docente SENAI",
            turma: `TURMA-${parseRes.cursoTipo.toUpperCase()}-2026`,
            semAno: "2º Sem/2026",
            escola: 'Escola SENAI "Mariano Ferraz"'
        };

        const msepRes = await sendPost('/api/generate-msep', msepPayload);
        const plan = msepRes.plan;
        console.log(`   ✅ MSEP Gerado com Sucesso: ${plan.situacoes.length} Situações de Aprendizagem!`);
        console.log(`   ⏱️  Curso Matriz registrado no MSEP: "${plan.curso}"`);
        console.log(`   📌 Unidade Curricular registrada no MSEP: "${plan.unidade}"`);
        
        let totalAulas = 0;
        plan.situacoes.forEach(sa => { totalAulas += sa.aulas; });
        console.log(`   ⏳ Total Horas Alocadas: ${totalAulas}h / ${targetUc.cargaHoraria}h`);
    }

    console.log("\n==========================================================================");
    console.log("🎉 AMBOS OS NOVOS PLANOS DE CURSO FORAM VALIDADOS COM SUCESSO INTEGRAL!");
    console.log("==========================================================================\n");
}

testNewPdfs().catch(err => {
    console.error("❌ ERRO NO TESTE:", err);
    process.exit(1);
});
