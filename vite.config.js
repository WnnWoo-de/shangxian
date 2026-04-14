import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    VitePWA({
      manifest: {
        name: '记账助手',
        short_name: '记账',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#409EFF',
        icons: [
          {
            src: '/logo-192x192.jpg',
            sizes: '192x192',
            type: 'image/jpeg',
          },
          {
            src: '/logo-512x512.jpg',
            sizes: '512x512',
            type: 'image/jpeg',
          },
          {
            src: '/favicon.ico',
            sizes: 'any',
            type: 'image/x-icon',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,json}'],
      },
      registerType: 'autoUpdate',
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/exceljs')) return 'exceljs'
          if (id.includes('node_modules/element-plus')) return 'element-plus'
          if (id.includes('node_modules/vue-router')) return 'vue-router'
          if (id.includes('node_modules/pinia')) return 'pinia'
          if (id.includes('node_modules/dayjs')) return 'dayjs'
          if (id.includes('node_modules/axios')) return 'axios'
          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/assets/styles/variables.scss" as *;\n@use "@/assets/styles/mixins.scss" as *;\n`
      }
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
