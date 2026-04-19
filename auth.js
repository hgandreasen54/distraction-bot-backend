/**
 * JWT verification middleware.
 * Tokens expire in 5 minutes. Signed with HS256 using JWT_SECRET env var.
 * Completed by backend-billing-engineer in Phase 4.
 */

const jwt = require('jsonwebtoken');

function verifyJWT(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }

    const token = authHeader.slice(7);
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: ['HS256'],
            // 5-minute expiry enforced at signing time; verify checks exp claim
        });
        req.jwtPayload = payload;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

module.exports = { verifyJWT };
