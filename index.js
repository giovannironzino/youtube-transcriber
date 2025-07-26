
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('API para extrair transcrição de vídeos do YouTube. Use /transcript?videoId=...');
});

app.get('/transcript', async (req, res) => {
  const videoId = req.query.videoId;
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!videoId || !apiKey) {
    return res.status(400).json({ error: 'videoId e YOUTUBE_API_KEY são obrigatórios' });
  }

  try {
    const url = \`https://youtube.googleapis.com/youtube/v3/captions?videoId=\${videoId}&key=\${apiKey}\`;
    const response = await axios.get(url);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(\`Servidor rodando na porta \${PORT}\`);
});
