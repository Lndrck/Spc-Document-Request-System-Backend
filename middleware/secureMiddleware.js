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
    'https://spc-document-request-system-three.vercel.app',
    appOrigin
  ].filter(Boolean);

  const corsOptions = {
    origin: function(origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // Check if the origin is in the allowed list
      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }
      
      // Also allow if appOrigin is not set (dev mode)
      if (!appOrigin) return callback(null, true);
      
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
