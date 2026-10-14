const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const blogRoutes = require('./routes/blogRoutes');

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    const error = new Error('Request origin is not allowed');
    error.status = 403;
    return callback(error);
  },
  credentials: true
}));
app.use(express.json());

// Expose the uploads folder publicly so images can be fetched by the frontend
app.use('/uploads', express.static(uploadDir));

// API Routes
app.use('/api', blogRoutes);

app.use((error, req, res, next) => {
  const status = error.status || error.statusCode || (error.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  if (status >= 500) console.error('Request failed:', error);
  return res.status(status).json({
    error: status >= 500 ? 'Internal server error' : error.message
  });
});

app.listen(PORT, () => {
  console.log(`Server running smoothly on http://localhost:${PORT}`);
});