const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send('API para extrair transcrição de vídeos do YouTube. Use /transcript?videoId=...');
});

app.get("/transcript", async (req, res) => {
  const videoId = req.query.videoId;
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!videoId || !apiKey) {
    return res.status(400).json({ error: 'videoId e YOUTUBE_API_KEY são obrigatórios' });
  }

  try {
    // 1. Buscar ID das legendas
    const captionsRes = await axios.get(
      `https://youtube.googleapis.com/youtube/v3/captions`,
      {
        params: {
          videoId,
          part: "snippet",
          key: apiKey
        }
      }
    );

    const captions = captionsRes.data.items;
    if (!captions.length) {
      return res.status(404).json({ error: "Nenhuma legenda encontrada para este vídeo." });
    }

    const captionId = captions[0].id;

    // 2. Buscar o conteúdo da legenda
    const captionContentRes = await axios.get(
      `https://youtube.googleapis.com/youtube/v3/captions/${captionId}`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey
        }
      }
    );

    res.json({
      videoId,
      captionId,
      content: captionContentRes.data
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
