/**
 * RevenueCat API wrapper — server-side.
 * Used to independently verify subscription status on /refund-check.
 * Completed by backend-billing-engineer in Phase 4.
 */

const https = require('https');

const RC_API_BASE = 'https://api.revenuecat.com/v1';

/**
 * Fetches subscription data for a given RevenueCat customer ID.
 * Returns { active, periodStart, periodEnd, stripeCustomerId } or null.
 */
async function getSubscription(customerId) {
    const key = process.env.REVENUECAT_SECRET_KEY;
    if (!key) throw new Error('REVENUECAT_SECRET_KEY not set');

    const data = await rcGet(`/subscribers/${encodeURIComponent(customerId)}`, key);
    const entitlement = data?.subscriber?.entitlements?.pro;

    if (!entitlement || entitlement.expires_date < new Date().toISOString()) {
        return { active: false };
    }

    return {
        active: true,
        periodStart: entitlement.purchase_date,
        periodEnd: entitlement.expires_date,
        stripeCustomerId: data.subscriber?.subscriber_attributes?.stripe_customer_id?.value ?? null,
    };
}

function rcGet(path, apiKey) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.revenuecat.com',
            path: `/v1${path}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'X-Platform': 'macos',
            },
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(new Error('Failed to parse RevenueCat response'));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

module.exports = { getSubscription };
