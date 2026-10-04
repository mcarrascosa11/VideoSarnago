import {defineConfig} from 'vite';
export default defineConfig({worker:{format:'es'},optimizeDeps:{exclude:['@ffmpeg/ffmpeg','@ffmpeg/util']}});
