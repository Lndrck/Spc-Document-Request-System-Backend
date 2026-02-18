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

  const corsOptions = {
    origin: function(origin, callback) {
      if (!origin) return callback(null, true);
      if (!appOrigin) return callback(null, false);
      if (origin === appOrigin) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS']
  };

  return {
    helmet: helmet(),
    limiter,
    cors: cors(corsOptions)
  };
}

module.exports = secureMiddleware;
