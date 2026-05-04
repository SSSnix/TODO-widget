import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron';
import { resolve } from 'path';

export default defineConfig({
    plugins: [
        electron([
            {
                entry: 'electron/main.js',
                vite: {
                    build: {
                        outDir: 'dist-electron',
                        sourcemap: true,
                        minify: false,
                    },
                },
            },
        ]),
    ],
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    },
    server: {
        port: 5173,
    },
});