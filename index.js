const express = require("express");
const transcript = require("youtube-transcript");
const rateLimit = require("express-rate-limit");

const app = express();
const port = process.env.PORT || 10000;

// Limite de 30 requisições por IP a cada 15 minutos
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    error: "Muitas requisições. Tente novamente mais tarde."
  }
});

app.use(limiter);

// Função de validação básica para ID do YouTube
function isValidVideoId(id) {
  const regex = /^[a-zA-Z0-9_-]{11}$/;
  return regex.test(id);
}

app.get("/transcript", async (req, res) => {
  const videoId = req.query.videoId;

  // Validação do ID
  if (!videoId) {
    return res.status(400).json({ error: "Parâmetro 'videoId' ausente." });
  }

  if (!isValidVideoId(videoId)) {
    return res.status(400).json({ error: "Formato de 'videoId' inválido." });
  }

  try {
    const transcriptData = await transcript.getTranscript(videoId);
    res.json({ transcript: transcriptData });
  } catch (error) {
    // Log no servidor (não enviado ao cliente)
    console.error("Erro ao obter transcrição:", {
      videoId,
      name: error.name,
      message: error.message,
      stack: error.stack
    });

    // Mensagem genérica ao cliente
    res.status(500).json({
      error: "Erro interno ao tentar obter a transcrição.",
      code: "TRANSCRIPTION_FAILURE",
      videoId,
      timestamp: new Date().toISOString()
    });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
