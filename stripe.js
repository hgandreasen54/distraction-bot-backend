/**
 * Stripe client wrapper.
 * Uses test mode when STRIPE_SECRET_KEY starts with 'sk_test_'.
 * Completed by backend-billing-engineer in Phase 4 once Heath provides live key.
 */

const Stripe = require('stripe');

let stripe;
function getStripe() {
    if (!stripe) {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) throw new Error('STRIPE_SECRET_KEY not set');
        stripe = Stripe(key);
    }
    return stripe;
}

/**
 * Issues a refund for the most recent invoice for a given Stripe customer.
 * @param {string} stripeCustomerId
 * @param {number} amountCents
 */
async function issueRefund(stripeCustomerId, amountCents) {
    const client = getStripe();

    // Find most recent paid invoice
    const invoices = await client.invoices.list({
        customer: stripeCustomerId,
        status: 'paid',
        limit: 1,
    });

    if (!invoices.data.length) {
        throw new Error('No paid invoice found for customer');
    }

    const invoice = invoices.data[0];
    const paymentIntentId = invoice.payment_intent;

    const refund = await client.refunds.create({
        payment_intent: paymentIntentId,
        amount: amountCents,
        reason: 'fraudulent', // closest Stripe reason; update to 'requested_by_customer' if preferred
        metadata: { reason: 'distraction_bot_streak_refund' },
    });

    return refund;
}

module.exports = { issueRefund };
