const express = require("express");
const cors = require("cors");
const { getTranscript } = require("youtube-transcript");

const app = express();
app.use(cors());

app.get("/transcript", async (req, res) => {
  const videoId = req.query.videoId;

  if (!videoId) {
    return res.status(400).json({ error: "Parâmetro 'videoId' é obrigatório." });
  }

  try {
    const transcript = await getTranscript(videoId);
    res.json(transcript);
  } catch (error) {
    console.error("Erro ao obter transcrição:", error.message);
    res.status(500).json({ error: "Erro ao obter transcrição." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
