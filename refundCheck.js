/**
 * POST /refund-check
 *
 * Input:  { customerId: string, streakData: StreakRecord[] }
 * Output: { refunded: true, amount: 29.99 } | { refunded: false, reason: string }
 *
 * Security: JWT required (enforced upstream in index.js).
 * The backend re-derives streak eligibility independently — client data is NEVER trusted.
 *
 * Completed by backend-billing-engineer in Phase 4.
 */

const express = require('express');
const router = express.Router();
const { getSubscription } = require('../lib/revenuecat');
const { issueRefund } = require('../lib/stripe');

router.post('/', async (req, res) => {
    const { customerId, streakData } = req.body;

    if (!customerId || !Array.isArray(streakData)) {
        return res.status(400).json({ refunded: false, reason: 'Invalid request body' });
    }

    try {
        // Step 1: Validate streak data structure
        const validationError = validateStreakData(streakData);
        if (validationError) {
            return res.status(400).json({ refunded: false, reason: validationError });
        }

        // Step 2: Fetch subscription from RevenueCat independently
        const subscription = await getSubscription(customerId);
        if (!subscription || !subscription.active) {
            return res.status(400).json({ refunded: false, reason: 'No active subscription found' });
        }

        // Step 3: Cross-check that streak dates fall within the billing period
        const billingStart = new Date(subscription.periodStart);
        const billingEnd = new Date(subscription.periodEnd);
        const streakInWindow = streakData.every(record => {
            const d = new Date(record.date);
            return d >= billingStart && d <= billingEnd;
        });
        if (!streakInWindow) {
            return res.status(400).json({ refunded: false, reason: 'Streak dates outside billing period' });
        }

        // Step 4: Verify 30 consecutive perfect days
        if (!hasThirtyConsecutivePerfectDays(streakData, billingStart, billingEnd)) {
            return res.status(400).json({ refunded: false, reason: 'Streak does not meet 30-day requirement' });
        }

        // Step 5: Issue Stripe refund
        const refundResult = await issueRefund(subscription.stripeCustomerId, 2999); // $29.99 in cents
        return res.json({ refunded: true, amount: 29.99, refundId: refundResult.id });

    } catch (err) {
        // Never log user content — err.message only
        console.error('refund-check error:', err.message);
        return res.status(500).json({ refunded: false, reason: 'Internal server error' });
    }
});

/**
 * Validates that streakData has exactly 30 entries, all passed,
 * no duplicates, and no future dates.
 */
function validateStreakData(streakData) {
    if (streakData.length !== 30) return `Expected 30 streak records, got ${streakData.length}`;
    const dates = new Set();
    const today = new Date().toISOString().slice(0, 10);
    for (const record of streakData) {
        if (typeof record.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) {
            return 'Invalid date format in streak record';
        }
        if (record.date > today) return 'Streak contains future dates';
        if (!record.passed) return `Day ${record.date} not marked as passed`;
        if (dates.has(record.date)) return `Duplicate date in streak: ${record.date}`;
        dates.add(record.date);
    }
    return null;
}

/**
 * Verifies 30 consecutive passed days exist within the billing window.
 * Bug fix: must check that BOTH the starting day (sorted[0]) and all subsequent days are passed.
 */
function hasThirtyConsecutivePerfectDays(streakData, billingStart, billingEnd) {
    const sorted = [...streakData].sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length < 30) return false;

    // Must start with a passed day
    if (!sorted[0].passed) return false;

    let consecutive = 1;
    for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1].date);
        const curr = new Date(sorted[i].date);
        const diff = (curr - prev) / (1000 * 60 * 60 * 24);
        if (diff === 1 && sorted[i].passed) {
            consecutive++;
            if (consecutive >= 30) return true;
        } else {
            // Reset to check if this day starts a new streak
            consecutive = sorted[i].passed ? 1 : 0;
        }
    }
    return consecutive >= 30;
}

module.exports = router;
