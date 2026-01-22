import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/yahoo-geocoding': {
        target: 'https://map.yahooapis.jp',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo-geocoding/, '/geocode/V1/geoCoder'),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
        },
      },
    },
  },
})
