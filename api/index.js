const fs = require('fs');
const path = require('path');
const https = require('https');
const AdmZip = require('adm-zip');
const templateBase64 = require('../template_base64');

// Load environment variables from .env if present (Local / Self-hosted)
try {
    const envPath = path.resolve(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const eqIdx = trimmed.indexOf('=');
                if (eqIdx > 0) {
                    const k = trimmed.substring(0, eqIdx).trim();
                    const v = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
                    if (!process.env[k]) {
                        process.env[k] = v;
                    }
                }
            }
        });
    }
} catch (e) {}

// Multidisciplinary Sample Courses
const SAMPLE_COURSES = {
    "chatgpt": {
        area: "TI - Software",
        courseName: "Inteligências Artificiais Generativas Aplicada a Programação – ChatGPT",
        courseUnit: "Inteligências Artificiais Generativas Aplicada a Programação – ChatGPT",
        unitSigla: "ChatGPT",
        workload: 48,
        turma: "IAGP 2614IB",
        semAno: "2º Sem/2026",
        docente: "Gustavo Feriani",
        escola: "Escola SENAI \"Mariano Ferraz\"",
        capacidadesTecnicas: [
            "Identificar inteligências artificiais generativas, suas arquiteturas e funcionamento.",
            "Treinar IA, utilizando os fundamentos do aprendizado de máquina.",
            "Criar um chatbot personalizado utilizando o processamento de linguagem natural (NLP).",
            "Estruturar e codificar solução utilizando inteligências artificiais.",
            "Corrigir erros em scripts, builds e deploys com ChatGPT.",
            "Refatorar códigos com ChatGPT.",
            "Aplicar o processo de treinamento personalizado do ChatGPT através de API, incluindo a coleta e pré-processamento de dados, ajuste de parâmetros, e avaliação do modelo e redes neurais.",
            "Implementar o ChatGPT em aplicações de chatbot usando suas bibliotecas e APIs."
        ],
        capacidadesSocioemocionais: [
            "Demonstrar raciocínio lógico.",
            "Demonstrar atenção aos detalhes."
        ],
        conhecimentos: [
            "1. Inteligência Artificial: Definição, Modelos Supervisionados e Não Supervisionados, Redes Neurais e NLP.",
            "2. IA Generativa: Arquiteturas LLM, Tokenização, Métricas e Alucinações.",
            "3. Produtividade: Pesquisas, Resolução de Bugs, Refatoração e Clean Code.",
            "4. Integração: API da OpenAI, Autenticação, Endpoints, Testes e Fine-Tuning."
        ]
    },
    "antigravity": {
        area: "TI - Software",
        courseName: "Desenvolvimento de Aplicações com IA Generativa utilizando Google Antigravity",
        courseUnit: "Desenvolvimento de Aplicações com IA Generativa utilizando Google Antigravity",
        unitSigla: "Antigravity",
        workload: 40,
        turma: "DESGAGR 2614IB",
        semAno: "2º Sem/2026",
        docente: "Gustavo Feriani",
        escola: "Escola SENAI \"Mariano Ferraz\"",
        capacidadesTecnicas: [
            "Diferenciar IA tradicional e IA generativa, tendo em vista, finalidades, entradas e saídas.",
            "Utilizar modelos de IA generativa pré-treinados para interpretação de entradas e saídas.",
            "Elaborar prompts estruturados para obtenção de respostas, de acordo com requisitos.",
            "Realizar construção e implantação de protótipo, com utilização de Gemini/Imagen na plataforma Vertex AI.",
            "Utilizar ferramenta Antigravity para geração de código e estruturação de projetos.",
            "Validar protótipo funcional com IA generativa, por meio de aplicação de testes e IA responsável."
        ],
        capacidadesSocioemocionais: [
            "Demonstrar atenção a detalhes.",
            "Demonstrar raciocínio lógico.",
            "Demonstrar visão sistêmica.",
            "Demonstrar responsabilidade.",
            "Demonstrar tolerância ao estresse."
        ],
        conhecimentos: [
            "1. IA Generativa: Fundamentos e Limitações.",
            "2. Modelos de Linguagem: LLMs e Formatos (JSON, Tabelas).",
            "3. Engenharia de Prompts: Estrutura e Few-Shot.",
            "4. Antigravity: Geração de Código e Arquitetura.",
            "5. Validação e IA Responsável: Testes, Mitigação de Vieses e Ética."
        ]
    },
    "eletrica": {
        area: "Eletroeletrônica",
        courseName: "Comandos Elétricos e Acionamentos Industriais",
        courseUnit: "Comandos Elétricos Industriais",
        unitSigla: "COMANDOS",
        workload: 80,
        turma: "ELT-CMD 2026/2",
        semAno: "2º Sem/2026",
        docente: "Docente de Eletroeletrônica",
        escola: "Escola SENAI \"Mariano Ferraz\"",
        capacidadesTecnicas: [
            "Interpretar diagramas elétricos funcionais, unifilares e trifilares de comandos de motores.",
            "Dimensionar dispositivos de proteção, comando e seccionamento (disjuntores, contatores, relés térmicos).",
            "Montar painéis elétricos industriais e circuitos de força e comando seguindo normas técnicas (NR-10 e NBR 5410).",
            "Parametrizar inversores de frequência e soft-starters para controle de velocidade e partida suave de motores de indução.",
            "Diagnosticar e reparar falhas em circuitos de comandos elétricos utilizando instrumentos de medição (multímetro, alicate amperímetro)."
        ],
        capacidadesSocioemocionais: [
            "Demonstrar atenção a detalhes e segurança.",
            "Demonstrar raciocínio lógico no diagnóstico de falhas.",
            "Demonstrar responsabilidade e trabalho em equipe."
        ],
        conhecimentos: [
            "1. Componentes de Comando: Botoeiras, contatores, temporizadores, relés térmicos e sinalizadores.",
            "2. Partidas de Motores: Partida direta, direta com reversão, estrela-triângulo e compensadora.",
            "3. Acionamentos Eletrônicos: Soft-starter e Inversor de Frequência (curvas V/f, rampas de aceleração/desaceleração).",
            "4. Segurança em Eletricidade: NR-10, EPIs/EPCs, aterramento e seccionamento seguro."
        ]
    },
    "automacao": {
        area: "Automação Industrial",
        courseName: "Controladores Lógicos Programáveis - CLP",
        courseUnit: "Programação de Controladores Lógicos",
        unitSigla: "CLP-AUT",
        workload: 40,
        turma: "AUT-CLP 2026/2",
        semAno: "2º Sem/2026",
        docente: "Docente de Automação",
        escola: "Escola SENAI \"Mariano Ferraz\"",
        capacidadesTecnicas: [
            "Identificar a arquitetura de hardware de CLPs (entradas, saídas digitais/analógicas, CPU e memórias).",
            "Elaborar programas de controle em linguagem Ladder e Diagrama de Blocos Funcionais (FBD).",
            "Configurar redes industriais de comunicação para troca de dados entre CLP e sensores/atuadores.",
            "Validar rotinas de intertravamento e segurança operacional em bancadas didáticas ou plantas industriais simuladas."
        ],
        capacidadesSocioemocionais: [
            "Demonstrar raciocínio lógico.",
            "Demonstrar visão sistêmica.",
            "Demonstrar atenção a detalhes."
        ],
        conhecimentos: [
            "1. Hardware de CLP: Módulos de E/S discretas e analógicas, fontes de alimentação e barramentos.",
            "2. Linguagens de Programação (IEC 61131-3): Ladder (LAD) e Diagrama de Blocos de Funções (FBD).",
            "3. Instruções Avançadas: Temporizadores (TON/TOF), Contadores (CTU/CTD) e Comparadores.",
            "4. Redes e Diagnóstico: Protocolos industriais (Modbus/Profinet) e rotinas de simulação."
        ]
    }
};

async function generateMSEPPlan(courseInfo) {
    // Attempt Google Gemini AI Generation first if Key is Available
    const aiPlan = await generateWithGemini(courseInfo);
    if (aiPlan && aiPlan.situacoes && aiPlan.situacoes.length > 0) {
        return aiPlan;
    }

    const key = courseInfo.courseKey || '';
    const nameLower = (courseInfo.courseName || '').toLowerCase();

    if (SAMPLE_COURSES[key]) {
        return buildPresetPlan(SAMPLE_COURSES[key], courseInfo);
    }
    if (nameLower.includes('chatgpt')) return buildPresetPlan(SAMPLE_COURSES.chatgpt, courseInfo);
    if (nameLower.includes('antigravity')) return buildPresetPlan(SAMPLE_COURSES.antigravity, courseInfo);
    if (nameLower.includes('elétr') || nameLower.includes('comando') || nameLower.includes('motor')) return buildPresetPlan(SAMPLE_COURSES.eletrica, courseInfo);
    if (nameLower.includes('clp') || nameLower.includes('automa')) return buildPresetPlan(SAMPLE_COURSES.automacao, courseInfo);

    return buildGenericDynamicPlan(courseInfo);
}

function buildPresetPlan(preset, overrides) {
    const isEletrica = preset === SAMPLE_COURSES.eletrica;
    const isAutomacao = preset === SAMPLE_COURSES.automacao;

    const totalHours = overrides.workload || preset.workload;
    const cursoTipo = overrides.cursoTipo || 'tecnico';
    const duracao = parseInt(overrides.duracaoAula) || (cursoTipo === 'fic' ? 60 : 45);
    const totalAulas = Math.round((totalHours * 60) / duracao);
    let numAulasText = `${totalAulas} aulas de ${duracao} minutos cada`;
    if (overrides.modalidade === 'semipresencial' && (overrides.aulasPresenciais || overrides.aulasEad)) {
        numAulasText += ` (Presencial: ${overrides.aulasPresenciais || 0} | EaD: ${overrides.aulasEad || 0})`;
    }

    const base = {
        curso: overrides.courseName || preset.courseName,
        unidade: overrides.courseUnit || preset.courseUnit,
        sigla: overrides.unitSigla || preset.unitSigla,
        cursoTipo: cursoTipo,
        duracaoAula: duracao,
        modalidade: overrides.modalidade || 'presencial',
        cargaHoraria: totalHours,
        numAulas: overrides.numAulas || numAulasText,
        docente: overrides.docente || preset.docente,
        turma: overrides.turma || preset.turma,
        semAno: overrides.semAno || preset.semAno,
        escola: overrides.escola || preset.escola
    };

    if (overrides.objetivoUC && overrides.objetivoUC.trim().length > 5) {
        base.objetivoUC = overrides.objetivoUC.trim();
    } else if (isEletrica) {
        base.objetivoUC = "Desenvolver capacidades técnicas e socioemocionais relativas à montagem, parametrização de acionamentos e diagnóstico de falhas em sistemas de comandos elétricos industriais conforme normas técnicas e de segurança.";
        base.situacoes = [
            {
                numero: "01",
                titulo: "Diagramas, Dimensionamento e Partida Direta de Motores",
                aulas: 24,
                estrategiaTipo: "Situação-problema",
                capacidadesTecnicas: [preset.capacidadesTecnicas[0], preset.capacidadesTecnicas[1]],
                capacidadesSocioemocionais: [preset.capacidadesSocioemocionais[0], preset.capacidadesSocioemocionais[1]],
                conhecimentos: [preset.conhecimentos[0], preset.conhecimentos[1]],
                contextualizacao: "Uma indústria de alimentos precisa instalar uma nova esteira transportadora de embalagens. O motor trifásico de 5 CV deve ser acionado por botoeiras com retenção e possuir proteção completa contra sobrecarga e curto-circuito. Como eletricista técnico da planta, você deve analisar a demanda, dimensionar contatores e relés térmicos, desenhar o diagrama funcional e montar o painel de comando.",
                observacoesDocente: "Revisar normas de segurança em eletricidade (NR-10). Conduzir a montagem prática em bancada garantindo o uso correto de EPIs e ferramentas isoladas.",
                desafio: "Dimensionar os componentes elétricos de proteção e manobra, desenhar os esquemas funcionais de força e comando e montar o circuito de partida direta com reversão e sinalização luminosa de falha.",
                resultadosEsperados: "Painel de comando montado e testado em bancada, diagrama elétrico unifilar e trifilar assinado e memorial de cálculo dos condutores e disjuntores.",
                estrategiasEnsino: "Exposição dialogada; Aula prática de montagem em bancadas industriais; Simulação em software CAD elétrico.",
                instrumentosAvaliacao: "Prova prática de montagem e teste funcional; Ficha de inspeção técnica de painel; Checklist de segurança NR-10.",
                recursos: "Bancadas didáticas de comandos elétricos, contatores, relés térmicos, botoeiras, motores de indução trifásicos, multímetros e ferramentas manuais isoladas.",
                criterios: [
                    { row: 15, cap: preset.capacidadesTecnicas[0], crit: "Interpreta diagramas funcionais, identificando corretamente a simbologia de força e comando.", tipo: "C" },
                    { row: 16, cap: "", crit: "Elabora diagramas elétricos com clareza e aderência às normas técnicas vigentes.", tipo: "D" },
                    { row: 17, cap: preset.capacidadesTecnicas[1], crit: "Dimensiona contatores, disjuntores-motores e relés térmicos adequados à corrente nominal do motor.", tipo: "C" },
                    { row: 18, cap: "", crit: "Calcula a bitola de condutores considerando critérios de capacidade de corrente e queda de tensão.", tipo: "D" },
                    { row: 19, cap: "Demonstrar atenção a detalhes e segurança", crit: "Executa a fiação e o borneamento do painel seguindo rigorosamente o esquema elétrico e normas de segurança.", tipo: "C" },
                    { row: 20, cap: "", crit: "Organiza o encaminhamento de cabos em canaletas com acabamento estético e identificação de anilhas.", tipo: "D" }
                ]
            },
            {
                numero: "02",
                titulo: "Acionamentos Eletrônicos (Inversores e Soft-Starters)",
                aulas: 32,
                estrategiaTipo: "Projeto",
                capacidadesTecnicas: [preset.capacidadesTecnicas[3]],
                capacidadesSocioemocionais: [preset.capacidadesSocioemocionais[1]],
                conhecimentos: [preset.conhecimentos[2]],
                contextualizacao: "Um misturador industrial de produtos químicos tem sofrido frequentes quebras mecânicas devido ao tranco de partida direta. Além disso, o processo exige variação de velocidade conforme a viscosidade da mistura. A gerência de manutenção solicitou a modernização do acionamento utilizando inversor de frequência com rampas de aceleração suaves e controle por potenciômetro externo.",
                observacoesDocente: "Estimular o raciocínio lógico na parametrização dos menus do inversor (dados de placa do motor, frequências máxima/mínima, frenagem por injeção CC).",
                desafio: "Integrar um inversor de frequência ao circuito do misturador, configurar todos os parâmetros do motor, implementar controle por entradas digitais/analógicas e testar a frenagem e aceleração com segurança.",
                resultadosEsperados: "Inversor de frequência parametrizado e acionando o motor em diferentes faixas de velocidade com relatório de parâmetros configurados.",
                estrategiasEnsino: "Projeto prático em bancada; Parametrização orientada no teclado (IHM) do inversor; Medição de harmônicos e corrente.",
                instrumentosAvaliacao: "Avaliação de desempenho prático; Relatório de parametrização e teste de bancada; Ficha de observação técnica.",
                recursos: "Bancadas didáticas com inversores de frequência industriais, motores elétricos, tacômetros e osciloscópios/analisadores de energia.",
                criterios: [
                    { row: 22, cap: preset.capacidadesTecnicas[3], crit: "Parametriza inversores de frequência e soft-starters de acordo com os dados de placa do motor e requisitos da aplicação.", tipo: "C" },
                    { row: 23, cap: "", crit: "Configura rampas de aceleração/desaceleração e limites de corrente otimizando o consumo de energia.", tipo: "D" },
                    { row: 24, cap: "Demonstrar raciocínio lógico", crit: "Interpreta os códigos de alarme e falha exibidos na IHM do acionamento propondo a solução correta.", tipo: "C" },
                    { row: 25, cap: "", crit: "Relaciona a variação de frequência com a variação de torque e rotação mecânica do motor.", tipo: "D" }
                ]
            },
            {
                numero: "03",
                titulo: "Diagnóstico de Falhas, Manutenção e Comissionamento",
                aulas: 24,
                estrategiaTipo: "Estudo de caso / Resolução de Problemas",
                capacidadesTecnicas: [preset.capacidadesTecnicas[2], preset.capacidadesTecnicas[4]],
                capacidadesSocioemocionais: [preset.capacidadesSocioemocionais[0], preset.capacidadesSocioemocionais[2]],
                conhecimentos: [preset.conhecimentos[3]],
                contextualizacao: "O setor de envase parou inesperadamente. O operador relata que a máquina tenta partir, mas desarma a proteção imediatamente, sem acionar o motor de bombeamento. Como técnico plantonista, você deve isolar a área, testar continuidade, isolamento e tensão nas fases, identificar o componente danificado e restabelecer a operação no menor tempo possível.",
                observacoesDocente: "Inserir falhas reais ou controladas nas bancadas (contato auxiliar oxidado, bobina aberta, desbalanceamento de fases). Avaliar a metodologia sequencial de teste dos alunos.",
                desafio: "Investigar e solucionar a falha oculta no painel de comando elétrico utilizando multímetro e alicate amperímetro, substituindo o componente defeituoso e liberando a máquina para operação segura.",
                resultadosEsperados: "Ordem de Serviço (OS) preenchida com diagnóstico detalhado, causa-raiz identificada, medições registradas e circuito recomposto em pleno funcionamento.",
                estrategiasEnsino: "Estudo de caso com falhas reais inseridas em bancada; Metodologia de árvore de falhas; Dinâmica de intervenção segura com bloqueio LOTO.",
                instrumentosAvaliacao: "Prova prática cronometrada de diagnóstico de falhas; Relatório de Ordem de Serviço de Manutenção; Checklist de procedimentos seguros de medição.",
                recursos: "Painéis elétricos industriais operacionais, kits de teste com falhas induzidas, alicates amperímetros e EPIs completos.",
                criterios: [
                    { row: 27, cap: preset.capacidadesTecnicas[4], crit: "Localiza e corrige falhas em circuitos elétricos de comando e potência utilizando instrumentos de medição de forma correta.", tipo: "C" },
                    { row: 28, cap: "", crit: "Executa testes de continuidade e isolamento elétrico antes de energizar o circuito reparado.", tipo: "D" },
                    { row: 29, cap: preset.capacidadesTecnicas[2], crit: "Monta e reforma painéis elétricos industriais respeitando códigos de cores de cabos e normas de segurança NR-10.", tipo: "C" },
                    { row: 30, cap: "", crit: "Registra os procedimentos executados na documentação técnica e ordem de serviço de maneira metódica.", tipo: "D" },
                    { row: 31, cap: "Demonstrar responsabilidade e trabalho em equipe", crit: "Aplica procedimentos rigorosos de bloqueio, travamento e sinalização (LOTO) durante as intervenções de manutenção.", tipo: "C" },
                    { row: 32, cap: "", crit: "Colabora ativamente com os colegas de equipe para agilizar o tempo de retorno da planta industrial.", tipo: "D" }
                ]
            }
        ];
        return base;
    }

    if (isAutomacao) {
        base.objetivoUC = "Desenvolver capacidades relativas à programação, configuração e validação de rotinas em Controladores Lógicos Programáveis (CLP) para automação de processos industriais.";
        base.situacoes = [
            {
                numero: "01",
                titulo: "Hardware, Linguagem Ladder e Intertravamentos",
                aulas: 20,
                estrategiaTipo: "Situação-problema",
                capacidadesTecnicas: [preset.capacidadesTecnicas[0], preset.capacidadesTecnicas[1]],
                capacidadesSocioemocionais: [preset.capacidadesSocioemocionais[0], preset.capacidadesSocioemocionais[2]],
                conhecimentos: [preset.conhecimentos[0], preset.conhecimentos[1]],
                contextualizacao: "Uma célula de paletização automática necessita de um sistema de controle programável para comandar cilindros pneumáticos e esteiras transportadoras com segurança contra acionamentos acidentais. A equipe de automação deve mapear as entradas e saídas do CLP e desenvolver a lógica Ladder com intertravamentos de emergência.",
                observacoesDocente: "Conduzir a programação em software de simulação e posterior download para o CLP físico.",
                desafio: "Elaborar o programa em linguagem Ladder contendo rotinas de partida/parada com selo, temporização de ciclo e botões de emergência monitorados.",
                resultadosEsperados: "Programa Ladder testado e validado em bancada didática com documentação comentada de cada linha de instrução.",
                estrategiasEnsino: "Exposição dialogada; Programação prática no laboratório; Simulação de sensores virtuais.",
                instrumentosAvaliacao: "Avaliação prática de lógica Ladder; Ficha de verificação de funcionamento do CLP.",
                recursos: "Computadores com software de programação de CLP, cabos de comunicação e bastidores didáticos de CLP.",
                criterios: [
                    { row: 15, cap: preset.capacidadesTecnicas[0], crit: "Identifica a configuração física de entradas e saídas digitais e analógicas do CLP.", tipo: "C" },
                    { row: 16, cap: "", crit: "Mapeia as variáveis e tags de memória conforme a tabela de conexões do projeto.", tipo: "D" },
                    { row: 17, cap: preset.capacidadesTecnicas[1], crit: "Desenvolve a lógica de controle em linguagem Ladder atendendo aos requisitos de funcionamento e intertravamento.", tipo: "C" },
                    { row: 18, cap: "", crit: "Insere comentários detalhados e documentação técnica nas rotinas do programa.", tipo: "D" },
                    { row: 19, cap: "Demonstrar raciocínio lógico", crit: "Estrutura blocos lógicos sequenciais evitando conflitos de estados em atuadores industriais.", tipo: "C" },
                    { row: 20, cap: "", crit: "Otimiza o número de linhas de código mantendo a clareza e manutenibilidade do programa.", tipo: "D" }
                ]
            },
            {
                numero: "02",
                titulo: "Funções Avançadas, Redes e Comissionamento",
                aulas: 20,
                estrategiaTipo: "Projeto",
                capacidadesTecnicas: [preset.capacidadesTecnicas[2], preset.capacidadesTecnicas[3]],
                capacidadesSocioemocionais: [preset.capacidadesSocioemocionais[1]],
                conhecimentos: [preset.conhecimentos[2], preset.conhecimentos[3]],
                contextualizacao: "Uma linha de envase automático requer a contagem precisa de frascos por caixa, controle de temperatura de selagem por sensor analógico e comunicação via rede industrial com o supervisório da planta.",
                observacoesDocente: "Trabalhar blocos de comparação e tratamento de grandezas analógicas (conversão A/D e escalas de engenharia).",
                desafio: "Implementar rotinas de contagem (CTU), blocos de temporização (TON) e tratamento de sinais analógicos no CLP, comunicando os dados via rede industrial.",
                resultadosEsperados: "Sistema automatizado executando a contagem de peças e controle de processo com monitoramento online de variáveis.",
                estrategiasEnsino: "Projeto prático em bancada; Configuração de rede industrial; Validação com simuladores de processos.",
                instrumentosAvaliacao: "Prova prática de comissionamento de CLP; Relatório técnico do projeto.",
                recursos: "Kits didáticos de CLP com módulos analógicos, sensores industriais e softwares de monitoramento.",
                criterios: [
                    { row: 22, cap: preset.capacidadesTecnicas[2], crit: "Configura parâmetros de comunicação em rede industrial para troca de dados com dispositivos de campo.", tipo: "C" },
                    { row: 23, cap: "", crit: "Diagnostica o status de comunicação dos nós da rede através de ferramentas de diagnóstico.", tipo: "D" },
                    { row: 24, cap: preset.capacidadesTecnicas[3], crit: "Valida as rotinas operacionais garantindo o cumprimento de todos os requisitos de segurança e produtividade.", tipo: "C" },
                    { row: 25, cap: "", crit: "Elabora o manual de operação e comissionamento da automação para a equipe de operadores.", tipo: "D" },
                    { row: 26, cap: "Demonstrar visão sistêmica", crit: "Articula a integração entre sensores, CLP, atuadores e interface de monitoramento compreendendo a planta global.", tipo: "C" },
                    { row: 27, cap: "", crit: "Propõe melhorias no ciclo de automação visando ganho de cadência e economia energética.", tipo: "D" }
                ]
            }
        ];
        return base;
    }

    return buildGenericDynamicPlan(overrides || preset);
}

// ⚡ Google Gemini Pedagogical Generator (Gemini 2.5 Flash / Flash Lite)
async function generateWithGemini(courseInfo) {
    const apiKey = (courseInfo && (courseInfo.geminiApiKey || courseInfo.apiKey)) || process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'sua_chave_gemini_aqui' || apiKey.trim().length < 10) {
        return null;
    }

    const totalHours = parseInt(courseInfo.workload) || 40;
    const courseName = courseInfo.courseName || "Curso Técnico";
    const sigla = courseInfo.unitSigla || "CURSO";
    const cursoTipo = courseInfo.cursoTipo || "tecnico";
    const duracaoAula = parseInt(courseInfo.duracaoAula) || (cursoTipo === 'fic' ? 60 : 45);
    const totalAulas = Math.round((totalHours * 60) / duracaoAula);
    const tipoLabel = (cursoTipo === 'cai')
        ? 'Curso Regular de Aprendizagem Industrial (CAI)'
        : (cursoTipo === 'fic' ? 'Formação Inicial e Continuada (FIC)' : 'Curso Técnico de Nível Médio (Cursos Regulares)');
    const modalidadeLabel = (courseInfo.modalidade === 'semipresencial')
        ? `Semipresencial (${courseInfo.aulasPresenciais || 0} aulas presenciais e ${courseInfo.aulasEad || 0} aulas EaD / não presenciais)`
        : '100% Presencial';

    const prompt = `Você é um Engenheiro Pedagógico Especialista do SENAI-SP com domínio completo da Metodologia SENAI de Educação Profissional (MSEP), do Book MSEP e do Instrumento de Registro de Resultados da Avaliação com Critérios (IRRAC).

Gere um Plano de Ensino MSEP Modular para o seguinte curso:
- Curso / Unidade Curricular: "${courseName}"
- Nível / Tipo de Curso: "${tipoLabel}"
- Modalidade: "${modalidadeLabel}"
- Sigla da UC: "${sigla}"
- Carga Horária Total: ${totalHours} horas (correspondente a ${totalAulas} aulas de ${duracaoAula} minutos cada)
- Escola: "${courseInfo.escola || 'Escola SENAI'}"
- Docente: "${courseInfo.docente || 'Docente SENAI'}"
- Turma: "${courseInfo.turma || 'TURMA 2026'}"
- Semestre/Ano: "${courseInfo.semAno || '2º Sem/2026'}"
${courseInfo.objetivoUC ? `- Objetivo da Unidade Curricular (utilize este exatamente): "${courseInfo.objetivoUC}"` : ''}

Diretrizes Rigorosas do SENAI MSEP (Diretrizes Oficiais dos Prompts MSEP):
1. REGRA FUNDAMENTAL: NUNCA FAÇA ABREVIAÇÕES DE CONTEÚDOS, CAPACIDADES OU CONHECIMENTOS. Reescreva a descrição técnica completa de cada capacidade e conhecimento, NUNCA utilize códigos ou siglas como 'K1', 'CT02' ou 'CS3'.
2. Determine a quantidade adequada de Situações de Aprendizagem (SAs) para a carga horária (ex: 20h = 1 SA; 40-60h = 2 SAs; 80-100h = 3 SAs; 120-200h = 4 SAs).
3. A soma exata do campo 'aulas' de todas as SAs DEVE SER EXATAMENTE IGUAL a ${totalHours} horas.
4. Para cada SA:
   - 'numero': "01", "02", etc.
   - 'titulo': Título prático e estimulante contextualizado no mercado de trabalho industrial.
   - 'aulas': Quantidade de horas (inteiro).
   - 'estrategiaTipo': 'Situação-problema', 'Projeto', 'Estudo de caso' ou 'Pesquisa aplicada' (conforme sugerido no Book MSEP).
   - 'capacidadesTecnicas': Array com 2 a 4 capacidades técnicas completas sem abreviações.
   - 'capacidadesSocioemocionais': Array com 1 a 3 capacidades (ex: 'Demonstrar raciocínio lógico.', 'Demonstrar atenção a detalhes.', 'Demonstrar responsabilidade.').
   - 'conhecimentos': Array com tópicos de conhecimentos técnicos e normas pertinentes (redação completa).
   - 'contextualizacao': Narrativa imersiva de uma empresa ou cenário industrial real com um problema a ser resolvido.
   - 'observacoesDocente': Instruções e dicas pedagógicas para a condução do professor (foco, mediação, segurança).
   - 'desafio': O desafio prático que os alunos devem solucionar.
   - 'resultadosEsperados': Entregas tangíveis esperadas dos alunos (produtos, relatórios, protótipos).
   - 'estrategiasEnsino': Métodos didáticos (ex: 'Projeto prático em bancada; Trabalho em equipe; Resolução colaborativa').
   - 'instrumentosAvaliacao': Instrumentos avaliativos (ex: 'Avaliação prática de desempenho; Relatório técnico; Checklist').
   - 'recursos': Máquinas, bancadas didáticas, ferramentas, instrumentos ou softwares específicos da área.
   - 'criterios': Array de objetos com critérios de avaliação observáveis redigidos rigorosamente no PRESENTE DO INDICATIVO:
       - 'cap': Nome da capacidade ou "" se for desdobramento.
       - 'crit': Texto do critério observável (ex: 'Parametriza o equipamento de acordo com as especificações técnicas.').
       - 'tipo': "C" para Crítico (eliminatório) ou "D" para Desejável (formativo/qualidade). Balanceie rigorosamente entre C e D (50% C e 50% D).

Retorne APENAS um JSON no seguinte formato:
{
  "curso": "${courseName}",
  "unidade": "${courseInfo.courseUnit || courseName}",
  "sigla": "${sigla}",
  "cursoTipo": "${cursoTipo}",
  "duracaoAula": ${duracaoAula},
  "modalidade": "${courseInfo.modalidade || 'presencial'}",
  "cargaHoraria": ${totalHours},
  "numAulas": "${totalAulas} aulas de ${duracaoAula} minutos cada",
  "docente": "${courseInfo.docente || 'Docente SENAI'}",
  "turma": "${courseInfo.turma || 'TURMA 2026'}",
  "semAno": "${courseInfo.semAno || '2º Sem/2026'}",
  "escola": "${courseInfo.escola || 'Escola SENAI'}",
  "objetivoUC": "${courseInfo.objetivoUC || 'Desenvolver as competências técnicas e socioemocionais preconizadas na matriz curricular.'}",
  "situacoes": [ ... ]
}`;

    const candidateModels = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-flash-latest", "gemini-2.5-flash"];

    for (const modelName of candidateModels) {
        const plan = await callGemini(apiKey, prompt, modelName);
        if (plan) {
            if (courseInfo.objetivoUC && courseInfo.objetivoUC.trim()) {
                plan.objetivoUC = courseInfo.objetivoUC.trim();
            }
            plan.cursoTipo = cursoTipo;
            plan.duracaoAula = duracaoAula;
            plan.modalidade = courseInfo.modalidade || 'presencial';
            if (courseInfo.numAulas) plan.numAulas = courseInfo.numAulas;
            return plan;
        }
    }
    return null;
}

function callGemini(apiKey, prompt, modelName) {
    const requestBody = JSON.stringify({
        contents: [
            {
                role: "user",
                parts: [{ text: prompt }]
            }
        ],
        systemInstruction: {
            parts: [{ text: "Você é um Engenheiro Pedagógico Especialista do SENAI-SP com domínio completo da Metodologia SENAI de Educação Profissional (MSEP), do Book MSEP e do IRRAC. Responda exclusivamente com um JSON válido conforme especificado, sem nenhum texto introdutório ou formatação externa." }]
        },
        generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json"
        }
    });

    return new Promise((resolve) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey.trim()}`;
        const req = https.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestBody)
            },
            timeout: 25000
        }, (res) => {
            let resData = '';
            res.on('data', chunk => { resData += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(resData);
                        let content = '';
                        if (parsed.candidates && parsed.candidates[0] && parsed.candidates[0].content && parsed.candidates[0].content.parts) {
                            content = parsed.candidates[0].content.parts[0].text || '';
                        }
                        
                        content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
                        const firstBrace = content.indexOf('{');
                        const lastBrace = content.lastIndexOf('}');
                        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                            content = content.slice(firstBrace, lastBrace + 1);
                        }

                        const plan = JSON.parse(content);
                        plan._generatedByAI = true;
                        plan._aiProvider = `Google Gemini (${modelName})`;
                        
                        let globalRow = 15;
                        if (plan.situacoes && Array.isArray(plan.situacoes)) {
                            plan.situacoes.forEach(sa => {
                                if (sa.criterios && Array.isArray(sa.criterios)) {
                                    sa.criterios.forEach(c => {
                                        c.row = globalRow++;
                                    });
                                }
                                globalRow++;
                            });
                        }
                        return resolve(plan);
                    } catch (e) {
                        console.warn(`Gemini JSON parse error for ${modelName}:`, e.message);
                        resolve(null);
                    }
                } else {
                    console.warn(`Gemini API (${modelName}) returned status ${res.statusCode}:`, resData);
                    resolve(null);
                }
            });
        });

        req.on('error', (err) => {
            console.warn(`Gemini request failed for ${modelName}:`, err.message);
            resolve(null);
        });

        req.on('timeout', () => {
            req.destroy();
            console.warn(`Gemini request timed out for ${modelName}`);
            resolve(null);
        });

        req.write(requestBody);
        req.end();
    });
}

// Test Gemini API Key Connection
async function testGeminiConnection(keyToTest) {
    const apiKey = (keyToTest && keyToTest.trim()) || process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'sua_chave_gemini_aqui' || apiKey.trim().length < 10) {
        return { success: false, error: 'Chave de API não informada ou inválida.' };
    }

    const testModels = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-flash-latest"];
    for (const m of testModels) {
        const res = await runGeminiPing(apiKey, m);
        if (res.success) return res;
    }
    return { success: false, error: 'Não foi possível conectar a nenhum modelo do Google Gemini.' };
}

function runGeminiPing(apiKey, modelName) {
    const requestBody = JSON.stringify({
        contents: [
            { role: "user", parts: [{ text: "Responda apenas com a palavra OK." }] }
        ],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 10
        }
    });

    return new Promise((resolve) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey.trim()}`;
        const req = https.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestBody)
            },
            timeout: 10000
        }, (res) => {
            let resData = '';
            res.on('data', chunk => { resData += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ success: true, message: `Conexão com Google Gemini (${modelName}) validada com sucesso!` });
                } else {
                    let errMsg = `Erro ${res.statusCode}`;
                    try {
                        const parsed = JSON.parse(resData);
                        if (parsed.error && parsed.error.message) errMsg = parsed.error.message;
                    } catch (e) {}
                    resolve({ success: false, error: errMsg });
                }
            });
        });

        req.on('error', (err) => {
            resolve({ success: false, error: `Falha de rede: ${err.message}` });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ success: false, error: 'Tempo limite esgotado ao conectar ao Google Gemini.' });
        });

        req.write(requestBody);
        req.end();
    });
}

function buildGenericDynamicPlan(courseInfo) {
    const totalHours = parseInt(courseInfo.workload) || 40;
    const courseName = courseInfo.courseName || "Curso Técnico de Formação";
    const sigla = courseInfo.unitSigla || "CURSO";
    const nameLower = courseName.toLowerCase();

    // Domain heuristic profiles (strict word boundaries to avoid false positives like "confeitaria" or "marcenaria")
    let domain = "general";
    if (/\b(intelig[eê]ncia\s+artificial|ia|ai|generativa|llm|chatgpt|machine\s+learning|prompt)\b/i.test(courseName)) {
        domain = "ia";
    } else if (/\b(software|programa[cç][aã]o|sistemas?|web|dev|frontend|backend|fullstack|python|java|react|c#|javascript)\b/i.test(courseName)) {
        domain = "dev";
    } else if (/\b(el[eé]tric[ao]|instalador\s+predial|comandos?\s+el[eé]tricos?|pot[eê]ncia|alta\s+tens[aã]o|baixa\s+tens[aã]o|nr-?10)\b/i.test(courseName)) {
        domain = "eletrica";
    } else if (/\b(clp|automa[cç][aã]o|rob[oó]tic[ao]|mecatr[oô]nic[ao]|plc|scada)\b/i.test(courseName)) {
        domain = "automacao";
    } else if (/\b(usinag(em)?|mec[aâ]nic[ao]|torno|torneiro|fresador|cnc|caldeiraria|soldag(em)?|ajustagem)\b/i.test(courseName)) {
        domain = "mecanica";
    } else if (/\b(ve[ií]cul(o|os)|automotiv[ao]|inje[cç][aã]o\s+eletr[oô]nica|mec[aâ]nica\s+de\s+autos?|motor\s+a\s+combust[aã]o)\b/i.test(courseName)) {
        domain = "automotiva";
    } else if (/\b(log[ií]stic[ao]|estoque|empilhadeir[ao]|armazenag(em)?|supply\s+chain|expedi[cç][aã]o|nr-?11)\b/i.test(courseName)) {
        domain = "logistica";
    }

    const domainConfigs = {
        ia: {
            caps: [
                "Projetar e estruturar prompts avançados para geração de código, testes e documentação técnica.",
                "Integrar modelos de IA generativa e APIs com validação de métricas de acurácia e conformidade ética.",
                "Implementar rotinas de automação assistida por IA respeitando privacidade de dados e segurança.",
                "Avaliar criticamente os resultados gerados por modelos de linguagem, corrigindo inconsistências e alucinações."
            ],
            socio: ["Demonstrar pensamento crítico e visão sistêmica.", "Demonstrar atenção a detalhes e rigor ético.", "Demonstrar adaptabilidade frente a inovações."],
            conhecimentos: [
                "1. Fundamentos de LLMs: Arquitetura Transformer, tokens, embeddings e contexto.",
                "2. Engenharia de Prompts: Zero-shot, Few-shot, Chain-of-Thought e System Prompts.",
                "3. Integração de APIs: Endpoints, autenticação via chaves, tratamento de respostas JSON e streaming.",
                "4. Governança e Ética: LGPD, mitigação de vieses, conformidade de código e propriedade intelectual."
            ],
            contextBase: "A consultoria 'Nexus AI Solutions' foi contratada por um grupo corporativo para automatizar fluxos operacionais críticos e implementar ferramentas com IA Generativa.",
            desafioBase: "Desenvolver e validar pipelines assistidos por IA Generativa com alta precisão, garantindo conformidade técnica e integridade dos dados.",
            recursos: "Computadores com acesso a ambientes de desenvolvimento (VS Code/Python/Node.js), APIs de LLMs e repositórios versionados.",
            entregaveis: "Código-fonte documentado, relatórios comparativos de eficácia dos prompts e aplicação integrada funcional."
        },
        dev: {
            caps: [
                "Projetar arquitetura de software e modelagem de banco de dados relacional e não-relacional.",
                "Desenvolver APIs RESTful e serviços de backend com tratamento de erros e segurança.",
                "Implementar interfaces web interativas e responsivas com boas práticas de usabilidade.",
                "Executar testes automatizados (unitários e integração) e esteiras de integração contínua."
            ],
            socio: ["Demonstrar raciocínio lógico.", "Demonstrar trabalho colaborativo e comunicação técnica.", "Demonstrar organização e foco em entregas."],
            conhecimentos: [
                "1. Arquitetura de Software: Padrão MVC, Microsserviços e Clean Architecture.",
                "2. Banco de Dados: Modelagem relacional, queries SQL, índices e integridade referencial.",
                "3. Desenvolvimento Backend: APIs RESTful, autenticação JWT e validação de payloads.",
                "4. Qualidade de Software: Testes automatizados, versionamento com Git e CI/CD."
            ],
            contextBase: "A software house 'TechForge Systems' precisa entregar um sistema modular escalável para atender à alta demanda de gestão de seus clientes corporativos.",
            desafioBase: "Construir uma solução de software robusta, desenvolvendo desde a camada de dados e lógica de negócio até a interface final validada.",
            recursos: "Laboratório de informática com IDEs modernas, servidores locais de desenvolvimento e ferramentas de banco de dados.",
            entregaveis: "Repositório Git com aplicação completa, documentação técnica da API e suite de testes funcionais."
        },
        eletrica: {
            caps: [
                "Interpretar e elaborar diagramas elétricos unifilares e multifilares conforme normas da ABNT.",
                "Dimensionar condutores, dispositivos de proteção (disjuntores/DR/DPS) e eletrodutos.",
                "Executar instalações elétricas prediais e comandos de motores com estrita observância à NR-10.",
                "Realizar testes de continuidade, medição de grandezas elétricas e comissionamento de circuitos."
            ],
            socio: ["Demonstrar rigor no cumprimento de normas de segurança.", "Demonstrar atenção a detalhes.", "Demonstrar responsabilidade profissional."],
            conhecimentos: [
                "1. Normas Técnicas: NBR 5410 (Instalações Elétricas de Baixa Tensão) e NR-10 (Segurança em Eletricidade).",
                "2. Dimensionamento Elétrico: Critérios de capacidade de condução de corrente, queda de tensão e sobrecarga.",
                "3. Dispositivos de Proteção e Seccionamento: Disjuntores termomagnéticos, IDR, DPS e barramentos.",
                "4. Instrumentação e Medições: Uso de multímetro, alicate amperímetro e terrômetro."
            ],
            contextBase: "A construtora 'EletroPrime Engenharia' está finalizando uma edificação comercial e necessita da montagem completa do padrão de entrada e quadros de distribuição.",
            desafioBase: "Executar o cabeamento, conexões e parametrização dos dispositivos de proteção e acionamento, garantindo 100% de segurança e conformidade normativa.",
            recursos: "Bancadas de instalações elétricas prediais, ferramentas manuais isoladas (1000V), EPIs e instrumentos de medição.",
            entregaveis: "Quadro de distribuição montado e energizado com sucesso, relatório de conformidade da NBR 5410 e checklist de testes."
        },
        automacao: {
            caps: [
                "Programar Controladores Lógicos Programáveis (CLP) em linguagens normatizadas IEC 61131-3.",
                "Parametrizar inversores de frequência e acionamentos para controle de velocidade e torque.",
                "Integrar sensores industriais, atuadores eletropneumáticos e redes de comunicação de campo.",
                "Desenvolver telas de Interface Homem-Máquina (IHM) para monitoramento e supervisão do processo."
            ],
            socio: ["Demonstrar raciocínio lógico.", "Demonstrar atenção a detalhes.", "Demonstrar iniciativa na resolução de falhas."],
            conhecimentos: [
                "1. Arquitetura de CLP: Memória, ciclos de varredura (scan), módulos de I/O discretos e analógicos.",
                "2. Linguagens de Programação: Ladder (LD), Diagrama de Blocos de Funções (FBD) e Texto Estruturado (ST).",
                "3. Redes Industriais: Protocolos Modbus, Profinet/EthernetIP e parametrização de nós.",
                "4. Sistemas Eletropneumáticos: Válvulas direcionais, atuadores e sensores de proximidade indutivos/ópticos."
            ],
            contextBase: "A indústria automobilística 'AutoTech Brasil' está automatizando sua linha de montagem e contratou a equipe técnica para programar a nova estação robótica.",
            desafioBase: "Elaborar a lógica de controle no CLP, interligar os sensores e atuadores da célula e validar a rotina automática em modo contínuo sem paradas.",
            recursos: "Bancadas didáticas com CLP, IHM, módulos de I/O, inversores de frequência e software de programação/simulação.",
            entregaveis: "Programa do CLP funcional e comentado, telas de IHM ativas e relatório técnico de comissionamento da automação."
        },
        mecanica: {
            caps: [
                "Interpretar desenhos técnicos mecânicos com cotagem funcional e tolerâncias geométricas (GD&T).",
                "Operar máquinas-ferramentas convencionais e CNC respeitando parâmetros de usinagem e normas de segurança.",
                "Realizar medições e controle dimensional com paquímetros, micrômetros e relógio comparador.",
                "Executar procedimentos de ajuste, traçagem e acabamento mecânico em peças metálicas e polímeros."
            ],
            socio: ["Demonstrar atenção a detalhes.", "Demonstrar zelo pelo ferramental e patrimônio.", "Demonstrar postura preventiva de segurança."],
            conhecimentos: [
                "1. Leitura e Interpretação de Desenho: Projeções ortogonais, cortes, vistas auxiliares e rugosidade superficial.",
                "2. Metrologia Industrial: Paquímetro, micrômetro, goniômetro e cálculo de incerteza de medição.",
                "3. Usinagem: Cinemática de torneamento/fresamento, fluidos de corte e geometria de ferramentas.",
                "4. Materiais e Tratamentos: Aços carbono, ligas não-ferrosas e propriedades mecânicas."
            ],
            contextBase: "A metalúrgica 'Precisão Metalmecânica' recebeu um pedido urgente de usinagem de eixos e componentes críticos para a linha de produção de um cliente.",
            desafioBase: "Fabricar as peças no torno e fresadora respeitando rigorosamente as cotas de projeto e o padrão de acabamento especificado no desenho.",
            recursos: "Oficina mecânica com tornos, fresadoras, bancada de ajuste, ferramentas de corte e instrumentos de metrologia.",
            entregaveis: "Peça usinada em conformidade com o desenho técnico, relatório de controle dimensional e ficha de processo."
        },
        automotiva: {
            caps: [
                "Diagnosticar falhas em sistemas de gerenciamento eletrônico do motor utilizando scanner automotivo e osciloscópio.",
                "Realizar manutenção e testes em sistemas de freios (ABS/ESC), suspensão e direção veicular.",
                "Interpretar diagramas elétricos automotivos e analisar sinais de sensores e atuadores do trem de força.",
                "Executar inspeções e procedimentos de revisão periódica conforme manuais técnicos dos fabricantes."
            ],
            socio: ["Demonstrar raciocínio analítico.", "Demonstrar zelo com o veículo do cliente.", "Demonstrar responsabilidade técnica."],
            conhecimentos: [
                "1. Injeção Eletrônica: Sensores (MAP, MAF, sonda lambda, rotação) e atuadores (injetores, bobinas, corpo de borboleta).",
                "2. Eletroeletrônica Automotiva: Bateria, alternador, motor de partida e redes de comunicação veicular (CAN bus).",
                "3. Dinâmica Veicular: Geometria de direção, amortecedores, molas e sistemas de freios hidráulicos.",
                "4. Diagnóstico Automotivo: Leitura de DTCs (códigos de falha), análise de fluxo de dados e teste de componentes."
            ],
            contextBase: "A concessionária 'AutoPerformance Motors' identificou um veículo com sintomas de perda de potência intermitente e falha no sistema de injeção.",
            desafioBase: "Realizar o diagnóstico avançado guiado por osciloscópio e scanner, identificar o componente defeituoso e executar o reparo técnico em padrão de montadora.",
            recursos: "Oficina automotiva com elevadores veiculares, scanners de diagnóstico, osciloscópio automotivo, multímetros e ferramentas especiais.",
            entregaveis: "Veículo reparado e testado com emissões dentro do padrão, checklist de diagnóstico preenchido e relatório de ordem de serviço."
        },
        logistica: {
            caps: [
                "Planejar e coordenar operações de recebimento, conferência, armazenagem e expedição de mercadorias.",
                "Operar procedimentos de movimentação interna de cargas com rigorosa observância à NR-11.",
                "Gerenciar acuracidade de estoque, curva ABC e indicadores de desempenho logístico (KPIs/OTIF).",
                "Organizar fluxos de distribuição física, endereçamento e roteirização com sustentabilidade e rastreabilidade."
            ],
            socio: ["Demonstrar organização e método.", "Demonstrar visão sistêmica.", "Demonstrar comunicação assertiva."],
            conhecimentos: [
                "1. Gestão de Armazenagem: Sistemas WMS, tipos de estruturas de estocagem (porta-paletes, drive-in) e layout.",
                "2. Segurança Operacional: NR-11 (Transporte, Movimentação e Armazenagem de Materiais) e checklists de inspeção.",
                "3. Controle de Estoques: Inventários cíclicos, lote econômico de compra, ponto de pedido e FIFO/FEFO.",
                "4. Distribuição e Transporte: Modais de transporte, cubagem de carga e nível de serviço ao cliente."
            ],
            contextBase: "O centro de distribuição 'Logix Supply Chain' está reestruturando seus processos logísticos para reduzir o tempo de picking e zerar avarias.",
            desafioBase: "Mapear os fluxos internos, dimensionar os endereçamentos do armazém e executar a operação integrada garantindo agilidade e precisão de inventário.",
            recursos: "Espaço didático de simulação logística, software de controle de estoque/WMS, coletores de dados e equipamentos de movimentação.",
            entregaveis: "Mapeamento de processos logísticos concluído, relatório de acuracidade de inventário e plano de endereçamento validado."
        },
        general: {
            caps: [
                `Identificar fundamentos técnicos, normas e requisitos aplicáveis a ${courseName}.`,
                `Operar ferramentas, softwares e equipamentos específicos da área de ${courseName}.`,
                `Executar procedimentos técnicos e montagens de soluções em ${courseName} com qualidade.`,
                `Validar a conformidade técnica, segurança e eficácia das entregas do projeto.`
            ],
            socio: ["Demonstrar atenção a detalhes.", "Demonstrar raciocínio lógico.", "Demonstrar responsabilidade e trabalho em equipe."],
            conhecimentos: [
                `1. Fundamentos e Princípios Técnicos essenciais de ${courseName}.`,
                `2. Procedimentos e Boas Práticas operacionais da área profissional.`,
                `3. Normas Técnicas e Regulamentadoras pertinentes ao setor industrial.`,
                `4. Técnicas de Diagnóstico, Validação e Controle de Qualidade.`
            ],
            contextBase: `A empresa 'Soluções Industriais e Tecnológicas' contratou sua equipe técnica para desenvolver um projeto de alta relevância no setor de ${courseName}.`,
            desafioBase: `Como profissionais técnicos, planejar, executar e validar a solução solicitada aplicando os conceitos e ferramentas de ${courseName}.`,
            recursos: `Ambiente pedagógico especializado (laboratório/oficina), ferramentas manuais e equipamentos específicos de ${courseName}.`,
            entregaveis: `Produto/serviço técnico concluído com conformidade, documentação técnica assinada e relatório de validação das entregas.`
        }
    };

    const cfg = domainConfigs[domain] || domainConfigs.general;
    const capsTec = courseInfo.capacidadesTecnicas && courseInfo.capacidadesTecnicas.length > 0 ? courseInfo.capacidadesTecnicas : cfg.caps;
    const capsSocio = courseInfo.capacidadesSocioemocionais && courseInfo.capacidadesSocioemocionais.length > 0 ? courseInfo.capacidadesSocioemocionais : cfg.socio;

    let numSAs = 2;
    if (totalHours <= 30) numSAs = 1;
    else if (totalHours <= 60) numSAs = 2;
    else if (totalHours <= 100) numSAs = 3;
    else numSAs = 4;

    const saHours = Math.floor(totalHours / numSAs);
    const remainder = totalHours % numSAs;

    const situacoes = [];
    let currentRow = 15;

    for (let i = 1; i <= numSAs; i++) {
        const hoursForSA = (i === numSAs) ? saHours + remainder : saHours;
        const saNum = String(i).padStart(2, '0');
        
        const startIdx = Math.floor(((i - 1) / numSAs) * capsTec.length);
        const endIdx = Math.max(startIdx + 1, Math.floor((i / numSAs) * capsTec.length));
        const assignedCaps = capsTec.slice(startIdx, endIdx);
        if (assignedCaps.length === 0) assignedCaps.push(capsTec[0]);

        const saCriterios = [];
        assignedCaps.forEach((capText) => {
            saCriterios.push({
                row: currentRow++,
                cap: capText,
                crit: `Executa com precisão as atividades técnicas relacionadas à ${capText.toLowerCase().replace(/\.$/, '')}.`,
                tipo: "C"
            });
            saCriterios.push({
                row: currentRow++,
                cap: "",
                crit: `Aplica boas práticas e normas de segurança pertinentes durante os procedimentos de ${courseName}.`,
                tipo: "D"
            });
        });

        const socioCap = capsSocio[(i - 1) % capsSocio.length];
        saCriterios.push({
            row: currentRow++,
            cap: socioCap,
            crit: `Demonstra postura profissional e ${socioCap.toLowerCase().replace(/\.$/, '')} na resolução das demandas propostas.`,
            tipo: "C"
        });
        saCriterios.push({
            row: currentRow++,
            cap: "",
            crit: `Colabora ativamente com os colegas cumprindo prazos e instruções com zelo e organização.`,
            tipo: "D"
        });

        currentRow++;

        situacoes.push({
            numero: saNum,
            titulo: `Situação de Aprendizagem ${saNum} - ${i === 1 ? 'Fundamentação e Planejamento' : (i === numSAs ? 'Integração Final e Validação Técnica' : 'Desenvolvimento Prático')} de ${courseName}`,
            aulas: hoursForSA,
            estrategiaTipo: (i === 1) ? "Situação-problema" : (i === numSAs ? "Estudo de caso / Projeto Integrador" : "Projeto"),
            capacidadesTecnicas: assignedCaps,
            capacidadesSocioemocionais: [socioCap],
            conhecimentos: cfg.conhecimentos || [`Fundamentos e procedimentos técnicos de ${courseName}.`],
            contextualizacao: `${cfg.contextBase} O objetivo nesta etapa é analisar os requisitos técnicos, planejar a intervenção e executar os procedimentos de ${courseName} com máxima eficiência e qualidade.`,
            observacoesDocente: "Conduzir a mediação pedagógica estimulando o protagonismo dos alunos na resolução prática das tarefas em laboratório ou oficina.",
            desafio: `${cfg.desafioBase}`,
            resultadosEsperados: `${cfg.entregaveis}`,
            estrategiasEnsino: "Exposição dialogada; Aula prática de laboratório/oficina; Resolução colaborativa de problemas.",
            instrumentosAvaliacao: "Avaliação prática de desempenho; Relatório técnico de entrega; Ficha de observação comportamental.",
            recursos: `${cfg.recursos}`,
            criterios: saCriterios
        });
    }

    const cursoTipo = courseInfo.cursoTipo || 'tecnico';
    const duracao = parseInt(courseInfo.duracaoAula) || (cursoTipo === 'fic' ? 60 : 45);
    const totalAulas = Math.round((totalHours * 60) / duracao);
    let numAulasText = `${totalAulas} aulas de ${duracao} minutos cada`;
    if (courseInfo.modalidade === 'semipresencial' && (courseInfo.aulasPresenciais || courseInfo.aulasEad)) {
        numAulasText += ` (Presencial: ${courseInfo.aulasPresenciais || 0} | EaD: ${courseInfo.aulasEad || 0})`;
    }

    return {
        curso: courseName,
        unidade: courseInfo.courseUnit || courseName,
        sigla: sigla,
        cursoTipo: cursoTipo,
        duracaoAula: duracao,
        modalidade: courseInfo.modalidade || 'presencial',
        cargaHoraria: totalHours,
        numAulas: courseInfo.numAulas || numAulasText,
        docente: courseInfo.docente || "Docente SENAI",
        turma: courseInfo.turma || "TURMA 2026",
        semAno: courseInfo.semAno || "2º Sem/2026",
        escola: courseInfo.escola || "Escola SENAI \"Mariano Ferraz\"",
        objetivoUC: courseInfo.objetivoUC && courseInfo.objetivoUC.trim().length > 5 
            ? courseInfo.objetivoUC.trim() 
            : `Desenvolver capacidades técnicas e socioemocionais relativas a ${courseName} de acordo com as diretrizes do MSEP.`,
        situacoes: situacoes,
        _generatedByAI: false,
        _aiProvider: 'Motor Heurístico Multiárea SENAI'
    };
}

// 100% In-Memory Serverless OpenXML XLSX Compiler
function compileIRRACXlsx(courseData) {
    const templateBuffer = Buffer.from(templateBase64, 'base64');
    const zip = new AdmZip(templateBuffer);

    // 1. [Content_Types].xml
    let ctContent = zip.readAsText('[Content_Types].xml');
    ctContent = ctContent.replace(
        'application/vnd.ms-excel.sheet.macroEnabled.main+xml',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'
    );
    zip.updateFile('[Content_Types].xml', Buffer.from(ctContent, 'utf8'));

    // 2. xl/workbook.xml
    let wbContent = zip.readAsText('xl/workbook.xml');
    wbContent = wbContent.replace(/name="Antigravity"/g, `name="${courseData.unitSigla}"`);
    zip.updateFile('xl/workbook.xml', Buffer.from(wbContent, 'utf8'));

    // 3. String Table Management
    const sstRaw = zip.readAsText('xl/sharedStrings.xml');
    const stringList = [];
    const sstMatches = sstRaw.matchAll(/<si>(.*?)<\/si>/gs);
    for (const m of sstMatches) {
        const tMatch = m[1].match(/<t[^>]*>(.*?)<\/t>/s);
        if (tMatch) {
            stringList.push(tMatch[1]);
        } else {
            const rMatches = [...m[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)];
            stringList.push(rMatches.map(r => r[1]).join(''));
        }
    }

    function getOrAddString(str) {
        const idx = stringList.indexOf(str);
        if (idx !== -1) return idx;
        stringList.push(str);
        return stringList.length - 1;
    }

    // 4. Update sheet2.xml (Cadastro)
    let s2Content = zip.readAsText('xl/worksheets/sheet2.xml');
    const strCourseNameIdx = getOrAddString(courseData.courseName);
    const strUnitSiglaIdx = getOrAddString(courseData.unitSigla);
    const strTurmaIdx = getOrAddString(courseData.turma || "TURMA 2026");
    const strDocenteIdx = getOrAddString(courseData.docente || "Docente SENAI");
    const strSemAnoIdx = getOrAddString(courseData.semAno || "2º Sem/2026");

    s2Content = s2Content.replace(/<c r="D4"[^>]*><v>\d+<\/v><\/c>/, () => `<c r="D4" s="10" t="s"><v>${strCourseNameIdx}</v></c>`);
    s2Content = s2Content.replace(/<c r="D5"[^>]*><v>\d+<\/v><\/c>/, () => `<c r="D5" s="10" t="s"><v>${strTurmaIdx}</v></c>`);
    s2Content = s2Content.replace(/<c r="D6"[^>]*><v>\d+<\/v><\/c>/, () => `<c r="D6" s="10" t="s"><v>${strSemAnoIdx}</v></c>`);
    s2Content = s2Content.replace(/<c r="D7"[^>]*><v>\d+<\/v><\/c>/, () => `<c r="D7" s="10" t="s"><v>${strDocenteIdx}</v></c>`);
    s2Content = s2Content.replace(/<c r="D10"[^>]*><v>\d+<\/v><\/c>/, () => `<c r="D10" s="25" t="s"><v>${strCourseNameIdx}</v></c>`);
    s2Content = s2Content.replace(/<c r="E10"[^>]*><v>\d+<\/v><\/c>/, () => `<c r="E10" s="25" t="s"><v>${strUnitSiglaIdx}</v></c>`);
    s2Content = s2Content.replace(/<c r="F10"[^>]*><v>[\d.]+<\/v><\/c>/, () => `<c r="F10" s="26"><v>${courseData.workload || 40}</v></c>`);

    // Clean mock student names in Cadastro (sheet2)
    s2Content = s2Content.replace(/<c r="D25"[^>]*><v>\d+<\/v><\/c>/, '<c r="D25" s="88"/>');
    for (let r = 26; r <= 60; r++) {
        s2Content = s2Content.replace(new RegExp(`<c r="D${r}"[^>]*><v>\\d+<\\/v><\\/c>`), `<c r="D${r}" s="92"/>`);
    }
    zip.updateFile('xl/worksheets/sheet2.xml', Buffer.from(s2Content, 'utf8'));

    // 5. Update sheet1.xml (Home)
    let s1Content = zip.readAsText('xl/worksheets/sheet1.xml');
    s1Content = s1Content.replace(/<c r="D14"([^>]*)><f>Cadastro!E10<\/f><v>[^<]*<\/v><\/c>/, () => `<c r="D14" s="67" t="str"><f>Cadastro!E10</f><v>${courseData.unitSigla}</v></c>`);
    zip.updateFile('xl/worksheets/sheet1.xml', Buffer.from(s1Content, 'utf8'));

    const allCriteria = [];
    if (courseData.criteria && courseData.criteria.length > 0) {
        allCriteria.push(...courseData.criteria);
    } else if (courseData.situacoes) {
        courseData.situacoes.forEach(sa => {
            if (sa.criterios) {
                allCriteria.push(...sa.criterios);
            }
        });
    }

    let countCriticos = 0;
    let countDesejaveis = 0;
    allCriteria.forEach(c => {
        if (c.tipo === 'C') countCriticos++;
        if (c.tipo === 'D') countDesejaveis++;
    });

    const maxRowNumber = allCriteria.length > 0 ? Math.max(...allCriteria.map(c => c.row)) : 40;
    const evaluationRange = `$I$15:$I$${maxRowNumber}`;
    const matrixRange = `$J$15:$AD$${maxRowNumber}`;
    const offsetRange = `$J$15:$J$${maxRowNumber}`;

    // 6. Update sheet3.xml (Consolidação)
    let s3Content = zip.readAsText('xl/worksheets/sheet3.xml');
    s3Content = s3Content.replace(/Antigravity!/g, `${courseData.unitSigla}!`);
    s3Content = s3Content.replace(/<c r="M1"[^>]*><f>.*?<\/f><v>.*?<\/v><\/c>/, () => `<c r="M1" s="10" t="str"><f>IF(Cadastro!$E$10=&quot;&quot;,&quot;&quot;,Cadastro!$E$10)</f><v>${courseData.unitSigla}</v></c>`);

    // Dynamic formula adjustment in I2 to prevent #DIV/0! if countDesejaveis or countCriticos is 0
    let formulaI2 = `ROUND((G2*(50/E2))+(H2*(50/F2)),0)`;
    if (countCriticos > 0 && countDesejaveis === 0) {
        formulaI2 = `ROUND(G2*(100/E2),0)`;
    } else if (countCriticos === 0 && countDesejaveis > 0) {
        formulaI2 = `ROUND(H2*(100/F2),0)`;
    } else if (countCriticos === 0 && countDesejaveis === 0) {
        formulaI2 = `0`;
    }
    s3Content = s3Content.replace(/<f t="shared" ref="I2:I15" si="2">.*?<\/f>/, `<f t="shared" ref="I2:I15" si="2">${formulaI2}</f>`);

    for (let r = 2; r <= 34; r++) {
        const dRow = r + 23;
        const style = (r <= 22) ? "29" : "27";
        // Clean student name cache in Consolidação
        s3Content = s3Content.replace(
            new RegExp(`<c r="C${r}"[^>]*>.*?<\\/c>`),
            `<c r="C${r}" s="${style}" t="str"><f>IF(Cadastro!D${dRow}=&quot;&quot;,&quot;&quot;,Cadastro!D${dRow})</f><v></v></c>`
        );
        const lFormula = (r === 2) ? ' t="shared" ref="L2:L34" si="3"' : ' t="shared" si="3"';
        s3Content = s3Content.replace(
            new RegExp(`<c r="L${r}"[^>]*>.*?<\\/c>`),
            `<c r="L${r}" s="40" t="str"><f${lFormula}>C${r}</f><v></v></c>`
        );

        s3Content = s3Content.replace(new RegExp(`<c r="E${r}"[^>]*><v>[\\d.]+<\\/v><\\/c>`), () => `<c r="E${r}" s="1"><v>${countCriticos}</v></c>`);
        s3Content = s3Content.replace(new RegExp(`<f>SUMPRODUCT\\(\\(INDEX\\(${courseData.unitSigla}!\\$J\\$15:\\$AD\\$\\d+,,\\$B${r}\\)<>&quot;&quot;\\)\\*\\(INDEX\\(${courseData.unitSigla}!\\$J\\$15:\\$AD\\$\\d+,,\\$B${r}\\)<>&quot;N\\/A&quot;\\)\\)<\\/f>`), () => `<f>SUMPRODUCT((INDEX(${courseData.unitSigla}!${matrixRange},,$B${r})<>&quot;&quot;)*(INDEX(${courseData.unitSigla}!${matrixRange},,$B${r})<>&quot;N/A&quot;))</f>`);
        s3Content = s3Content.replace(new RegExp(`<f>COUNTIFS\\(${courseData.unitSigla}!\\$I\\$15:\\$I\\$\\d+,&quot;C&quot;,OFFSET\\(${courseData.unitSigla}!\\$J\\$15:\\$J\\$\\d+,0,ROW\\(A${r - 1}\\)-1\\),&quot;A&quot;\\)<\\/f>`), () => `<f>COUNTIFS(${courseData.unitSigla}!${evaluationRange},&quot;C&quot;,OFFSET(${courseData.unitSigla}!${offsetRange},0,ROW(A${r - 1})-1),&quot;A&quot;)</f>`);
        s3Content = s3Content.replace(new RegExp(`<f>COUNTIFS\\(${courseData.unitSigla}!\\$I\\$15:\\$I\\$\\d+,&quot;D&quot;,OFFSET\\(${courseData.unitSigla}!\\$J\\$15:\\$J\\$\\d+, 0, ROW\\(A${r - 1}\\)-1\\),&quot;A&quot;\\)<\\/f>`), () => `<f>COUNTIFS(${courseData.unitSigla}!${evaluationRange},&quot;D&quot;,OFFSET(${courseData.unitSigla}!${offsetRange}, 0, ROW(A${r - 1})-1),&quot;A&quot;)</f>`);
    }
    zip.updateFile('xl/worksheets/sheet3.xml', Buffer.from(s3Content, 'utf8'));

    // 7. Update sheet4.xml (Unit Sheet)
    let s4Content = zip.readAsText('xl/worksheets/sheet4.xml');
    s4Content = s4Content.replace(/<c r="A7"[^>]*><f>.*?<\/f><v>.*?<\/v><\/c>/, () => `<c r="A7" s="89" t="str"><f>Cadastro!D4</f><v>${courseData.courseName}</v></c>`);
    s4Content = s4Content.replace(/<c r="G7"[^>]*><f>.*?<\/f><v>.*?<\/v><\/c>/, () => `<c r="G7" s="89" t="str"><f>Cadastro!D10</f><v>${courseData.courseName}</v></c>`);
    s4Content = s4Content.replace(/<c r="AF7"[^>]*><f>.*?<\/f><v>.*?<\/v><\/c>/, () => `<c r="AF7" s="90" t="str"><f>Cadastro!F10</f><v>${courseData.workload || 40}</v></c>`);
    s4Content = s4Content.replace(/<c r="A9"[^>]*><f>.*?<\/f><v>.*?<\/v><\/c>/, () => `<c r="A9" s="89" t="str"><f>Cadastro!D7</f><v>${courseData.docente || "Docente SENAI"}</v></c>`);
    s4Content = s4Content.replace(/<c r="Q9"[^>]*><f>.*?<\/f><v>.*?<\/v><\/c>/, () => `<c r="Q9" s="89" t="str"><f>Cadastro!D5</f><v>${courseData.turma || "TURMA 2026"}</v></c>`);
    s4Content = s4Content.replace(/<c r="AF9"[^>]*><f>.*?<\/f><v>.*?<\/v><\/c>/, () => `<c r="AF9" s="90" t="str"><f>Cadastro!D6</f><v>${courseData.semAno || "2º Sem/2026"}</v></c>`);

    const studentCols = ['J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','AA','AB','AC','AD','AE','AF','AG','AH','AI','AJ','AK','AL','AM','AN','AO','AP'];
    
    // Clean student header names in Unit Sheet (sheet4)
    for (let i = 0; i < studentCols.length; i++) {
        const col = studentCols[i];
        const dRow = i + 25;
        s4Content = s4Content.replace(
            new RegExp(`<c r="${col}13"[^>]*>.*?<\\/c>`),
            `<c r="${col}13" s="80" t="str"><f>IF(Cadastro!$D${dRow}=&quot;&quot;,&quot;&quot;,Cadastro!$D${dRow})</f><v></v></c>`
        );
    }

    for (const c of allCriteria) {
        const rowNum = c.row;
        let rowXml = `<row r="${rowNum}" ht="30" customHeight="1">`;
        
        if (c.cap) {
            const capIdx = getOrAddString(c.cap);
            rowXml += `<c r="A${rowNum}" s="94" t="s"><v>${capIdx}</v></c>`;
        }
        
        const critStyle = (c.tipo === 'C') ? "95" : "98";
        const critIdx = getOrAddString(c.crit);
        rowXml += `<c r="E${rowNum}" s="${critStyle}" t="s"><v>${critIdx}</v></c>`;
        
        const tipoIdx = getOrAddString(c.tipo);
        rowXml += `<c r="I${rowNum}" s="96" t="s"><v>${tipoIdx}</v></c>`;
        
        // Leave all student criteria cells completely empty for teacher evaluation
        for (let i = 0; i < studentCols.length; i++) {
            const col = studentCols[i];
            rowXml += `<c r="${col}${rowNum}" s="97"/>`;
        }
        
        rowXml += `</row>`;
        
        const rowPattern = new RegExp(`<row r="${rowNum}"[^>]*>.*?<\\/row>`, 's');
        if (rowPattern.test(s4Content)) {
            s4Content = s4Content.replace(rowPattern, () => rowXml);
        }
    }
    zip.updateFile('xl/worksheets/sheet4.xml', Buffer.from(s4Content, 'utf8'));

    // 8. Rebuild xl/sharedStrings.xml
    let newSstXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst count="${stringList.length}" uniqueCount="${stringList.length}" xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`;
    for (const s of stringList) {
        const escaped = String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
        
        if (escaped.includes('\n') || escaped.startsWith(' ') || escaped.endsWith(' ')) {
            newSstXml += `<si><t xml:space="preserve">${escaped}</t></si>`;
        } else {
            newSstXml += `<si><t>${escaped}</t></si>`;
        }
    }
    newSstXml += `</sst>`;
    zip.updateFile('xl/sharedStrings.xml', Buffer.from(newSstXml, 'utf8'));

    return zip.toBuffer();
}

// Serverless Handler for Vercel / Cloud
module.exports = (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    
    // Resolve route from multiple sources:
    // 1. Query parameter ?route=... (from vercel.json rewrite)
    // 2. Query parameter ?path=...
    // 3. Vercel internal headers (x-matched-path, x-forwarded-uri, x-invoke-path)
    // 4. URL pathname
    const routeParam = (parsedUrl.searchParams.get('route') || parsedUrl.searchParams.get('path') || '').replace(/^\/+/, '').trim();
    const rawPath = (req.headers['x-matched-path'] 
                 || req.headers['x-forwarded-uri'] 
                 || req.headers['x-invoke-path'] 
                 || parsedUrl.pathname 
                 || '').replace(/^\/+/, '').trim();

    const isRoute = (name) => {
        if (routeParam === name || routeParam.startsWith(`${name}/`)) return true;
        if (rawPath === `api/${name}` || rawPath.endsWith(`/${name}`) || rawPath.startsWith(`api/${name}/`)) return true;
        if (rawPath === name) return true;
        return false;
    };

    if (isRoute('status') || (!routeParam && (rawPath === 'api' || rawPath === 'api/' || rawPath === 'api/index.js' || rawPath === 'api/index'))) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'online', version: '2.0.0', time: new Date() }));
        return;
    }

    if (isRoute('ai-status')) {
        const hasEnvKey = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 10 && process.env.GEMINI_API_KEY !== 'sua_chave_gemini_aqui');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            geminiConfigured: hasEnvKey,
            model: 'gemini-3.5-flash-lite',
            provider: 'Google Gemini'
        }));
        return;
    }

    if (isRoute('test-gemini') || isRoute('test-groq')) {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                let parsedKey = null;
                if (body && body.trim()) {
                    const data = JSON.parse(body);
                    parsedKey = data.apiKey;
                }
                const result = await testGeminiConnection(parsedKey);
                res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
        return;
    }

    if (isRoute('samples')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(SAMPLE_COURSES));
        return;
    }

    if (isRoute('generate-msep')) {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const plan = await generateMSEPPlan(data);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, plan }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
        return;
    }

    if (isRoute('export-irrac')) {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const courseData = JSON.parse(body);
                const xlsxBuffer = compileIRRACXlsx(courseData);
                
                const safeName = (courseData.unitSigla || 'IRRAC').replace(/[^a-zA-Z0-9-_]/g, '_');
                res.writeHead(200, {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': `attachment; filename="IRRAC - ${safeName}.xlsx"`,
                    'Content-Length': xlsxBuffer.length
                });
                res.end(xlsxBuffer);
            } catch (err) {
                console.error('Error exporting IRRAC:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Route not found', requestedRoute: routeParam || rawPath }));
};
