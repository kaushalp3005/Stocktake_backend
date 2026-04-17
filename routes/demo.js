"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDemo = void 0;
const handleDemo = (req, res) => {
    const response = {
        message: "Hello from Express server",
    };
    res.status(200).json(response);
};
exports.handleDemo = handleDemo;
