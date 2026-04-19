"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vite_1 = require("vite");
const path_1 = __importDefault(require("path"));
// Server build configuration
exports.default = (0, vite_1.defineConfig)({
    build: {
        lib: {
            entry: path_1.default.resolve(__dirname, "node-build.ts"),
            name: "server",
            fileName: "production",
            formats: ["es"],
        },
        outDir: "../dist/server",
        target: "node22",
        ssr: true,
        rollupOptions: {
            external: [
                // Node.js built-ins
                "fs",
                "path",
                "url",
                "http",
                "https",
                "os",
                "crypto",
                "stream",
                "util",
                "events",
                "buffer",
                "querystring",
                "child_process",
                // External dependencies that should not be bundled
                "express",
                "cors",
            ],
            output: {
                format: "es",
                entryFileNames: "[name].mjs",
            },
        },
        minify: false, // Keep readable for debugging
        sourcemap: true,
    },
    resolve: {
        alias: {
            "@shared": path_1.default.resolve(__dirname, "./shared"),
        },
    },
    define: {
        "process.env.NODE_ENV": '"production"',
    },
});
