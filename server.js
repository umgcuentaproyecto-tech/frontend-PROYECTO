const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

app.get('/config.js', (req, res) => {
  const rawApiBaseUrl = (process.env.API_BASE_URL || '').trim();
  const apiBaseUrl = rawApiBaseUrl && !/^https?:\/\//i.test(rawApiBaseUrl)
    ? `https://${rawApiBaseUrl}`
    : rawApiBaseUrl;

  res.type('application/javascript').send(
    `window.__API_BASE_URL__ = ${JSON.stringify(apiBaseUrl)};`
  );
});

app.use(express.static(__dirname));

app.listen(port, () => {
  console.log(`Frontend listo en el puerto ${port}`);
});