import { defineConfig } from 'vite'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const allowedHosts = readLocalAllowedHosts()

export default defineConfig({
  server: {
    host: '0.0.0.0',
    allowedHosts,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts,
  },
})

function readLocalAllowedHosts(): string[] {
  const filePath = resolve(process.cwd(), '.vite-allowed-hosts.local')
  if (!existsSync(filePath)) {
    return []
  }

  return readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((host) => host.trim())
    .filter((host) => host.length > 0 && !host.startsWith('#'))
}
