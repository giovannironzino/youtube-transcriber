// index.js (Para o seu servidor no Render)

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

// Função para extrair ID do vídeo de diferentes formatos de URL do YouTube
function extractVideoId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// Função para limpar o texto da legenda (formato SRT)
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

/**
 * ENDPOINT 1: Obter Transcrição
 * Recebe uma URL do YouTube e retorna a transcrição em texto puro.
 */
app.get('/transcript', async (req, res) => {
    const videoUrl = req.query.videoUrl;
    if (!videoUrl) {
        return res.status(400).json({ error: 'O parâmetro "videoUrl" é obrigatório.' });
    }

    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
        return res.status(400).json({ error: 'URL do YouTube inválida ou formato não reconhecido.' });
    }

    try {
        // Etapa 1: Listar legendas
        const listUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${YOUTUBE_API_KEY}`;
        const listResponse = await axios.get(listUrl);

        if (listResponse.data.items.length === 0) {
            return res.status(404).json({ error: "Não foram encontradas legendas para este vídeo." });
        }

        const captionTrack = listResponse.data.items.find(item => item.snippet.language.startsWith('pt')) || listResponse.data.items.find(item => item.snippet.language.startsWith('en')) || listResponse.data.items[0];
        const trackId = captionTrack.id;

        // Etapa 2: Baixar legenda
        const downloadUrl = `https://www.googleapis.com/youtube/v3/captions/${trackId}?key=${YOUTUBE_API_KEY}&tfmt=srt`;
        const downloadResponse = await axios.get(downloadUrl);

        // Etapa 3: Limpar e retornar
        const cleanTranscript = parseSrt(downloadResponse.data);
        res.json({ transcription: cleanTranscript });

    } catch (err) {
        console.error("Erro no /transcript:", err.response ? err.response.data.error : err.message);
        res.status(500).json({ error: 'Falha ao obter a transcrição do YouTube.', details: err.message });
    }
});


/**
 * ENDPOINT 2: Analisar Conteúdo com Gemini
 * Recebe a transcrição e outros dados, e retorna a análise completa.
 */
app.post('/analyze', async (req, res) => {
    const { simulatedVideoData } = req.body;

    if (!simulatedVideoData || !simulatedVideoData.transcription) {
        return res.status(400).json({ error: 'Dados para análise (especialmente a transcrição) são obrigatórios.' });
    }

    try {
        const report = {};
        // O código dos prompts e schemas que você já tem iria aqui.
        // Por simplicidade, vamos chamar uma função que simula isso.
        // Na sua implementação real, você colocaria o switch-case aqui dentro.
        // A função analyzeSection faria a chamada real à API Gemini.

        const analyzeSection = async (sectionNumber, data) => {
            // A lógica de `switch-case` com prompts e schemas estaria aqui
            // ... (vou omitir por brevidade, mas você deve inseri-la)
            const prompt = `Analisando a transcrição: ${data.transcription}. Gere a análise para a seção ${sectionNumber}.`;
            // Este é um exemplo simplificado. Use seus prompts detalhados.
            const schema = { type: "OBJECT", properties: { identificacao: { type: "OBJECT" }, avaliacao: { type: "OBJECT" } } };

            const payload = {
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json", responseSchema: schema }
            };
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

            const response = await axios.post(apiUrl, payload);
            const result = response.data;
            const jsonString = result.candidates[0].content.parts[0].text;
            return JSON.parse(jsonString);
        };

        for (let i = 1; i <= 8; i++) {
            // Para simplificar, estamos apenas passando o objeto inteiro.
            // Você pode customizar os dados passados para cada seção se necessário.
            const sectionData = await analyzeSection(i, simulatedVideoData);
            report[`secao${i}`] = sectionData;
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
