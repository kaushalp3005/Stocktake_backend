"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.requireRole = requireRole;
const auth_js_1 = require("../utils/auth.js");
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = (0, auth_js_1.extractTokenFromHeader)(authHeader);
    if (!token) {
        return res.status(401).json({ error: "Missing authorization token" });
    }
    const payload = (0, auth_js_1.verifyToken)(token);
    if (!payload) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
    req.user = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
    };
    next();
}
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: "Insufficient permissions" });
        }
        next();
    };
}
