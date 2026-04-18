/**
 * Distraction Bot — Backend
 * Purpose: Refund validation + RevenueCat billing webhooks ONLY.
 * No window titles, task descriptions, or user content ever processed here.
 *
 * Completed by backend-billing-engineer in Phase 4.
 */

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { verifyJWT } = require('./middleware/auth');
const refundCheck = require('./routes/refundCheck');
const revenuecatWebhook = require('./routes/revenuecatWebhook');

const app = express();

// Security headers (§11)
app.use(helmet());

// Raw body parsing for webhook signature verification (must come before express.json)
// Stores raw request body in req.rawBody for HMAC verification
app.use((req, res, next) => {
    let rawBody = '';
    req.on('data', chunk => {
        rawBody += chunk.toString('utf8');
    });
    req.on('end', () => {
        req.rawBody = rawBody;
        next();
    });
});

// Body parsing
app.use(express.json());

// Rate limiting: 10 req/min per IP on all routes (§11)
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// Routes — all require valid JWT except RevenueCat webhook (uses signature verification instead)
app.use('/refund-check', verifyJWT, refundCheck);
app.use('/webhook/revenuecat', revenuecatWebhook);

// Health check (no auth — used by Railway)
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Distraction Bot backend running on port ${PORT}`);
});

module.exports = app;
