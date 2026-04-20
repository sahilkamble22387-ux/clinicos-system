import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
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
