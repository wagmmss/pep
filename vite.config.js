import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

function copySnippetsPlugin() {
  return {
    name: 'copy-snippets-json',
    closeBundle() {
      const src = path.resolve(process.cwd(), 'snippets/snippets_todos.json');
      const destDir = path.resolve(process.cwd(), 'dist/snippets');
      const dest = path.join(destDir, 'snippets_todos.json');
      if (fs.existsSync(src)) {
        fs.mkdirSync(destDir, { recursive: true });
        fs.copyFileSync(src, dest);
      }
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [copySnippetsPlugin()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: false,
    allowedHosts: true,
    hmr: false
  }
});
