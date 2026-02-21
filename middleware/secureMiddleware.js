const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

function secureMiddleware(appOrigin) {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false
  });

  // Allow multiple origins: localhost for dev, Vercel for production
  const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://spc-document-request-system-three.vercel.app', // Your new domain
  'https://spc-document-request-system-9nlmjv2ak-doms-projects-4253da97.vercel.app', // The preview domain from logs
  appOrigin
].filter(Boolean);

  const corsOptions = {
    origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.indexOf(origin) !== -1;
    const isVercel = origin.endsWith('.vercel.app'); // Allows any vercel.app domain

    if (isAllowed || isVercel) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
    credentials: true,
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  };

  return {
    helmet: helmet(),
    limiter,
    cors: cors(corsOptions)
  };
}

module.exports = secureMiddleware;
