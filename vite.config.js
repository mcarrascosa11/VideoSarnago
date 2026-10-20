import {defineConfig} from 'vite';

// The ONNX Runtime wasm (~21 MB) loads from jsDelivr (see whisper.worker.js), so keep it out of every Vercel deployment
const dropOrtWasm = () => ({
  name: 'drop-ort-wasm',
  apply: 'build',
  generateBundle(_, bundle) {
    for (const file of Object.keys(bundle)) if (/ort-wasm.*\.wasm$/.test(file)) delete bundle[file];
  }
});

// Same cross-origin isolation as vercel.json, so FFmpeg and Whisper can use several threads locally too
const headers = {'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'credentialless'};

export default defineConfig({
  plugins: [dropOrtWasm()],
  worker: {format: 'es', plugins: () => [dropOrtWasm()]},
  optimizeDeps: {exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']},
  server: {headers},
  preview: {headers},
});
