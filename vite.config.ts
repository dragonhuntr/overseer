import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// In dev, /api goes to the hub: a local one by default, or another with HUB=http://host:7420 bun run dev.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/api': process.env.HUB ?? 'http://localhost:7420' } },
});
