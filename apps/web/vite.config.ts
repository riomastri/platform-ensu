import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import viteReact from '@vitejs/plugin-react'

const rootEnvDir = path.resolve(import.meta.dirname, '../..')

export default defineConfig(({ command, mode }) => {
  if (command === 'serve') {
    const loadedEnv = loadEnv(mode, rootEnvDir, '')
    for (const [key, value] of Object.entries(loadedEnv)) {
      if (process.env[key] === undefined) {
        process.env[key] = value
      }
    }
  }

  return {
    envDir: rootEnvDir,
    resolve: {
      tsconfigPaths: true,
    },
    plugins: [
      devtools(),
      tailwindcss(),
      tanstackStart(),
      nitro({ preset: 'node-server' }),
      viteReact(),
    ],
  }
})
