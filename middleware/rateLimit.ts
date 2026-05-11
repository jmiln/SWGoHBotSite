import rateLimit from "express-rate-limit";

export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many requests from this IP, please try again later.",
});

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many login attempts, please try again later.",
});

export const saveLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        req.session.flash = { type: "error", message: "Too many save attempts. Please wait a moment before trying again." };
        const guildId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id ?? "");
        res.redirect(`/guild/${guildId}/edit`);
    },
});
