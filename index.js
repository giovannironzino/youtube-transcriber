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
    const getSectionAnalysis = (
        
