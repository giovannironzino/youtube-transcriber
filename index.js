const express = require("express");
const cors = require("cors");
const getTranscript = require("youtube-transcript").default;

const app = express();
app.use(cors());

app.get("/transcript", async (req, res) => {
  const videoId = req.query.videoId;

  if (!videoId) {
    return res.status(400).json({
      error: "Parâmetro 'videoId' é obrigatório.",
      code: "MISSING_VIDEO_ID"
    });
  }

  try {
    const transcript = await getTranscript(videoId);
    res.json({ transcript });
  } catch (error) {
    const errorDetails = {
      name: error.name || "UnknownError",
      message: error.message || "Erro desconhecido",
      stack: error.stack || null,
      code: error.code || null,
      cause: error.cause || null,
      videoId,
      timestamp: new Date().toISOString()
    };

    console.error("🔴 Erro ao obter transcrição:", errorDetails);

    res.status(500).json({
      error: "Erro interno ao tentar obter a transcrição.",
      code: "TRANSCRIPTION_FAILURE",
      videoId: errorDetails.videoId,
      timestamp: errorDetails.timestamp,
      debug: {
        name: errorDetails.name,
        message: errorDetails.message,
        code: errorDetails.code
      }
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});
