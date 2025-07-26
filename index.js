// Arquivo: index.js (Versão final para o seu servidor no Render)

require('dotenv').config(); // Para ler o arquivo .env com as chaves
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors()); // Permite que o frontend acesse a API
app.use(express.json()); // Permite que a API receba JSON no corpo das requisições

const PORT = process.env.PORT || 10000;

// Chaves de API carregadas de forma segura das variáveis de ambiente
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// --- FUNÇÕES AUXILIARES ---

function extractVideoId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function parseSrt(srtText) {
    if (!srtText || typeof srtText !== 'string') return "";
    const textWithoutTimestamps = srtText
        .replace(/\d+\r\n\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}\r\n/g, '')
        .replace(/<[^>]*>/g, '');
    return textWithoutTimestamps.replace(/\r\n/g, ' ').trim();
}

// --- ENDPOINTS DA API ---

app.get('/', (req, res) => {
    res.send('Servidor da API de Análise de Vídeos está no ar.');
});

app.get('/transcript', async (req, res) => {
    const videoUrl = req.query.videoUrl;
    if (!videoUrl) {
        return res.status(400).json({ error: 'O parâmetro "videoUrl" é obrigatório.' });
    }

    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
        return res.status(400).json({ error: 'URL do YouTube inválida ou formato não reconhecido.' });
    }

    if (!YOUTUBE_API_KEY) {
        console.error("Chave da API do YouTube não configurada no servidor.");
        return res.status(500).json({ error: "Erro de configuração do servidor." });
    }

    try {
        const listUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${YOUTUBE_API_KEY}`;
        const listResponse = await axios.get(listUrl);

        if (listResponse.data.items.length === 0) {
            return res.status(404).json({ error: "Não foram encontradas legendas para este vídeo." });
        }

        const captionTrack = listResponse.data.items.find(item => item.snippet.language.startsWith('pt')) || listResponse.data.items.find(item => item.snippet.language.startsWith('en')) || listResponse.data.items[0];
        const trackId = captionTrack.id;

        const downloadUrl = `https://www.googleapis.com/youtube/v3/captions/${trackId}?key=${YOUTUBE_API_KEY}&tfmt=srt`;
        const downloadResponse = await axios.get(downloadUrl);

        const cleanTranscript = parseSrt(downloadResponse.data);
        res.json({ transcription: cleanTranscript });

    } catch (err) {
        console.error("Erro no /transcript:", err.response ? err.response.data.error : err.message);
        res.status(500).json({ error: 'Falha ao obter a transcrição do YouTube.', details: err.message });
    }
});

app.post('/analyze', async (req, res) => {
    const { simulatedVideoData } = req.body;

    if (!simulatedVideoData || !simulatedVideoData.transcription) {
        return res.status(400).json({ error: 'Dados para análise (transcrição) são obrigatórios.' });
    }
    
    if (!GEMINI_API_KEY) {
        console.error("Chave da API Gemini não configurada no servidor.");
        return res.status(500).json({ error: "Erro de configuração do servidor." });
    }

    // Função que chama a API Gemini
    const callGeminiAPI = async (prompt, schema) => {
        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", responseSchema: schema }
        };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        
        const response = await axios.post(apiUrl, payload);
        const result = response.data;

        if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
            const jsonString = result.candidates[0].content.parts[0].text;
            return JSON.parse(jsonString);
        } else {
            throw new Error("Resposta da API Gemini inválida ou inesperada.");
        }
    };

    // Função que prepara o prompt e o schema para cada seção
    const getSectionAnalysis = (sectionNumber, data) => {
        let prompt = '';
        let schema = {};

        // LÓGICA COMPLETA DO SWITCH-CASE INSERIDA AQUI
        switch (sectionNumber) {
             case 1: // Conteúdo Verbal
                prompt = `Analise o seguinte conteúdo de vídeo para a Seção 1 (Conteúdo Verbal). A transcrição é: '${data.transcription}'. Identifique a mensagem central explícita, possíveis mensagens implícitas/simbólicas. Reconheça o tipo discursivo predominante, a natureza da fala. Avalie a clareza, coerência e progressão temática, identificando pressupostos, registros linguísticos e inferências. Retorne um JSON com 'identificacao' e 'avaliacao'.`;
                schema = { type: "OBJECT", properties: { identificacao: { type: "OBJECT", properties: { mensagemCentralExplicita: { type: "STRING" }, mensagensImplicitasSimbolicasSubversivas: { type: "ARRAY", items: { type: "STRING" } }, tipoDiscursivoPredominante: { type: "STRING" }, naturezaDaFala: { type: "STRING" } } }, avaliacao: { type: "OBJECT", properties: { clarezaCoerenciaProgressaoTematica: { type: "STRING" }, pressupostosNaoDitos: { type: "ARRAY", items: { type: "STRING" } }, registrosLinguisticosMistos: { type: "ARRAY", items: { type: "STRING" } }, inferencias: { type: "ARRAY", items: { type: "STRING" } } } } } };
                break;
            case 2: // Estrutura Expressiva
                prompt = `Analise o seguinte conteúdo de vídeo para a Seção 2 (Estrutura Expressiva). A transcrição é: '${data.transcription}'. Capture recursos expressivos como entonação e pausas. Avalie o alinhamento desses elementos à intenção comunicativa. Identifique se a entrega soa ensaiada ou espontânea. Avalie se há amplificação da mensagem por figuras retóricas. Aferir se o vídeo transmite credibilidade. Retorne um JSON com 'identificacao' e 'avaliacao'.`;
                schema = { type: "OBJECT", properties: { identificacao: { type: "OBJECT", properties: { recursosExpressivos: { type: "ARRAY", items: { type: "STRING" } }, tipoDeEntrega: { type: "STRING" }, figurasRetoricas: { type: "ARRAY", items: { type: "STRING" } } } }, avaliacao: { type: "OBJECT", properties: { alinhamentoIntencaoComunicativa: { type: "STRING" }, amplificacaoObscurecimentoMensagem: { type: "STRING" }, transmiteCredibilidadeCarismaAutoridade: { type: "STRING" } } } } };
                break;
            case 3: // Situação Comunicativa
                prompt = `Analise o seguinte conteúdo de vídeo para a Seção 3 (Situação Comunicativa). A transcrição é: '${data.transcription}'. Identifique o emissor, o destinatário presumido, o contexto sociocultural e o tipo de contrato comunicacional. Avalie a coerência entre quem fala, como fala e para quem fala. Retorne um JSON com 'identificacao' e 'avaliacao'.`;
                schema = { type: "OBJECT", properties: { identificacao: { type: "OBJECT", properties: { emissor: { type: "STRING" }, destinatarioPresumido: { type: "STRING" }, contextoSocioculturalHistorico: { type: "STRING" }, tipoContratoComunicacional: { type: "STRING" } } }, avaliacao: { type: "OBJECT", properties: { coerenciaComunicativa: { type: "STRING" }, vinculosDeslocamentosIncoerencias: { type: "ARRAY", items: { type: "STRING" } } } } } };
                break;
            case 4: // Sistema de Signos Visuais e Sonoros
                prompt = `Analise o seguinte conteúdo de vídeo para a Seção 4 (Sistema de Signos Visuais e Sonoros). A transcrição é: '${data.transcription}'. Detecte elementos visuais e sonoros em destaque (cenário, objetos, trilha, edição, símbolos), com avaliação sobre sua função. A montagem (cortes, ritmo) deverá ser considerada em relação à clareza e emoção. Retorne um JSON com 'identificacao' e 'avaliacao'.`;
                schema = { type: "OBJECT", properties: { identificacao: { type: "OBJECT", properties: { elementosVisuaisEmDestaque: { type: "ARRAY", items: { type: "STRING" } }, elementosSonorosEmDestaque: { type: "ARRAY", items: { type: "STRING" } }, montagem: { type: "STRING" } } }, avaliacao: { type: "OBJECT", properties: { funcaoSimbolicaDecorativa: { type: "STRING" }, montagemImpacto: { type: "STRING" } } } } };
                break;
            case 5: // Efeitos Cognitivos e Emocionais
                prompt = `Analise o seguinte conteúdo de vídeo para a Seção 5 (Efeitos Cognitivos e Emocionais). A transcrição é: '${data.transcription}'. Identifique emoções ativadas, gatilhos psicológicos e a natureza da resposta. Avalie se o estímulo cognitivo exigido é ativo ou passivo e se está adequado ao público-alvo. Retorne um JSON com 'identificacao' e 'avaliacao'.`;
                schema = { type: "OBJECT", properties: { identificacao: { type: "OBJECT", properties: { emocoesAtivadas: { type: "ARRAY", items: { type: "STRING" } }, gatilhosPsicologicos: { type: "ARRAY", items: { type: "STRING" } }, naturezaDaResposta: { type: "STRING" } } }, avaliacao: { type: "OBJECT", properties: { estimuloCognitivoExigido: { type: "STRING" }, adequacaoAoPublicoAlvo: { type: "STRING" } } } } };
                break;
            case 6: // Síntese e Coerência Global
                prompt = `Analise o seguinte conteúdo de vídeo para a Seção 6 (Síntese e Coerência Global). A transcrição é: '${data.transcription}'. Identifique os elementos nucleares da mensagem e da integração entre fala, imagem e som. Avalie se a multimodalidade opera de forma convergente ou se há ruídos. Retorne um JSON com 'identificacao' e 'avaliacao'.`;
                schema = { type: "OBJECT", properties: { identificacao: { type: "OBJECT", properties: { elementosNuclearesDaMensagem: { type: "ARRAY", items: { type: "STRING" } }, integracaoMultimodal: { type: "STRING" } } }, avaliacao: { type: "OBJECT", properties: { operacaoMultimodalidade: { type: "STRING" }, ruidosDesviosContradicoes: { type: "ARRAY", items: { type: "STRING" } } } } } };
                break;
            case 7: // Aspectos Técnicos
                prompt = `Analise o seguinte conteúdo de vídeo para a Seção 7 (Aspectos Técnicos). A transcrição é: '${data.transcription}'. Identifique o nível técnico da captação (áudio, vídeo, iluminação), e avalie a presença de recursos de acessibilidade. A qualidade técnica será correlacionada à percepção de profissionalismo. Retorne um JSON com 'identificacao' e 'avaliacao'.`;
                schema = { type: "OBJECT", properties: { identificacao: { type: "OBJECT", properties: { nivelTecnicoCaptacao: { type: "STRING" }, recursosAcessibilidade: { type: "ARRAY", items: { type: "STRING" } } } }, avaliacao: { type: "OBJECT", properties: { qualidadeTecnicaCorrelacao: { type: "STRING" }, impactoNaRecepcao: { type: "STRING" } } } } };
                break;
            case 8: // Potencial de Uso Estratégico
                prompt = `Analise o seguinte conteúdo de vídeo para a Seção 8 (Potencial de Uso Estratégico). A transcrição é: '${data.transcription}'. Faça uma leitura de aplicação em marketing, com sugestões de canais e formatos, análise do perfil de público e recomendação sobre recortes e métricas esperadas. Retorne um JSON com 'identificacao' e 'avaliacao'.`;
                schema = { type: "OBJECT", properties: { identificacao: { type: "OBJECT", properties: { canaisFormatosSugeridos: { type: "ARRAY", items: { type: "STRING" } }, perfilPublicoEngajamentoPrevisto: { type: "STRING" }, recomendacoesConteudo: { type: "ARRAY", items: { type: "STRING" } } } }, avaliacao: { type: "OBJECT", properties: { metricasEsperadas: { type: "ARRAY", items: { type: "STRING" } } } } } };
                break;
            default:
                throw new Error("Seção inválida.");
        }
        return callGeminiAPI(prompt, schema);
    };

    try {
        const report = {};
        for (let i = 1; i <= 8; i++) {
            report[`secao${i}`] = await getSectionAnalysis(i, simulatedVideoData);
        }
        res.json({ reportData: report });

    } catch (err) {
        console.error("Erro no /analyze:", err.response ? err.response.data.error : err.message);
        res.status(500).json({ error: 'Falha ao analisar o conteúdo com a API Gemini.', details: err.message });
    }
});

// --- INICIALIZAÇÃO DO SERVIDOR ---
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
