import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

const plugins: PluginOption[] = [react()]

if (process.env.ANALYZE === 'true') {
  plugins.push(
    visualizer({
      filename: 'stats/bundle.html',
      template: 'treemap',
      gzipSize: true,
      brotliSize: true,
    })
  )
}

// https://vite.dev/config/
export default defineConfig({
  plugins,
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          mapbox: ['mapbox-gl'],
        },
      },
    },
  },
})
