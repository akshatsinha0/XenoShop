require('dotenv').config();
const express = require('express');
const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'xenoshop-backend' }));

const PORT=process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`XenoShop backend (Prisma) running on http://localhost:${PORT}`);
});
