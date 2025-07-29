import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

const wixSiteUrl = 'https://colettesenger19254.wixsite.com/my-site-1'; // Make sure this is your live URL

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/_functions': {
        target: wixSiteUrl,
        changeOrigin: true,
      },
    },
  },
});