import path from 'path';
import { pathToFileURL } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const AI_ROUTE_FILES: Record<string, string> = {
    '/api/ai/case-summary': 'api/ai/case-summary.ts',
    '/api/ai/clinical-suggestions': 'api/ai/clinical-suggestions.ts',
    '/api/ai/drug-check': 'api/ai/drug-check.ts',
    '/api/ai/soap-note': 'api/ai/soap-note.ts',
    '/api/ai/transcribe': 'api/ai/transcribe.ts',
    '/api/ai/patient-card': 'api/ai/patient-card.ts',
};

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    Object.assign(process.env, env);

    return {
        server: {
            port: 3000,
            host: '0.0.0.0',
            // Faster HMR
            hmr: {
                overlay: true,
            },
        },
        build: {
            // Raise chunk-size warning threshold (many heavy deps like jsPDF are expected)
            chunkSizeWarningLimit: 2000,
            rollupOptions: {
                input: {
                    index: path.resolve(__dirname, 'index.html'),
                    nirog: path.resolve(__dirname, 'nirog.html'),
                },
                output: {
                    // Split only isolated heavy libraries. Forcing React and the
                    // rest of node_modules into separate shared chunks caused a
                    // runtime circular dependency in production builds.
                    manualChunks(id) {
                        // Supabase + auth
                        if (id.includes('@supabase')) return 'supabase';
                        // PDF generation (heavy)
                        if (id.includes('jspdf') || id.includes('jsPDF')) return 'pdf';
                        // Excel / file export (heavy)
                        if (id.includes('exceljs') || id.includes('xlsx') || id.includes('file-saver')) return 'excel';
                        // Charts
                        if (id.includes('recharts')) return 'charts';
                        // QR code
                        if (id.includes('qrcode')) return 'qr';
                        // Framer motion
                        if (id.includes('framer-motion')) return 'animation';
                    },
                },
            },
            // Source maps only in development
            sourcemap: mode === 'development',
            // Minify in production
            minify: mode === 'production' ? 'esbuild' : false,
            target: 'es2020',
        },
        plugins: [
            react(),
            {
                name: 'nirogai-local-api',
                configureServer(server) {
                    server.middlewares.use(async (req, res, next) => {
                        const requestUrl = req.url ? new URL(req.url, 'http://127.0.0.1') : null;
                        const pathname = requestUrl?.pathname;
                        const routeFile = pathname ? AI_ROUTE_FILES[pathname] : undefined;

                        if (!routeFile) {
                            next();
                            return;
                        }

                        try {
                            const moduleUrl = `${pathToFileURL(path.resolve(__dirname, routeFile)).href}?t=${Date.now()}`;
                            const mod = await import(moduleUrl);
                            const handler = mod.default;

                            if (typeof handler !== 'function') {
                                res.statusCode = 500;
                                res.end(JSON.stringify({ error: 'invalid_handler' }));
                                return;
                            }

                            await handler(req, res);
                        } catch (error) {
                            console.error('Local AI route failed:', error);
                            res.statusCode = 500;
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ error: 'local_ai_route_failed' }));
                        }
                    });
                },
            },
        ],
        define: {
            'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
            'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, '.'),
            },
        },
        // Optimize pre-bundling of heavy deps so dev server starts faster
        optimizeDeps: {
            include: [
                'react',
                'react-dom',
                'react-router-dom',
                '@supabase/supabase-js',
                'lucide-react',
                'recharts',
            ],
        },
    };
});
