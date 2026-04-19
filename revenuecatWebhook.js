/**
 * POST /webhook/revenuecat
 *
 * Handles: CANCELLATION, RENEWAL, EXPIRATION events.
 * Signature is verified before any processing — no auth header required.
 *
 * Completed by backend-billing-engineer in Phase 4.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

router.post('/', (req, res) => {
    // Step 1: Verify RevenueCat webhook signature
    const signature = req.headers['x-revenuecat-signature'];
    if (!signature) {
        return res.status(401).json({ error: 'Missing RevenueCat signature header' });
    }

    const isValid = verifyRevenueCatSignature(req.rawBody || JSON.stringify(req.body), signature);
    if (!isValid) {
        return res.status(401).json({ error: 'Invalid RevenueCat signature' });
    }

    // Step 2: Process event
    const { event } = req.body;
    const eventType = event?.type;

    switch (eventType) {
        case 'CANCELLATION':
        case 'EXPIRATION':
            // Mark subscription as inactive in our records if we maintain any
            // (v1 re-validates live from RC on every /refund-check — no local state needed)
            console.log(`RC webhook: ${eventType} for ${event?.app_user_id}`);
            break;
        case 'RENEWAL':
            console.log(`RC webhook: RENEWAL for ${event?.app_user_id}`);
            break;
        default:
            // Acknowledge but ignore unknown event types
            console.log(`RC webhook: unhandled event type ${eventType}`);
    }

    return res.status(200).json({ received: true });
});

/**
 * HMAC-SHA256 verification of RevenueCat webhook payload.
 * Secret is REVENUECAT_WEBHOOK_SECRET env var.
 */
function verifyRevenueCatSignature(payload, signature) {
    if (!process.env.REVENUECAT_WEBHOOK_SECRET) return false;
    const expected = crypto
        .createHmac('sha256', process.env.REVENUECAT_WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');
    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(expected, 'hex')
        );
    } catch {
        return false;
    }
}

module.exports = router;
