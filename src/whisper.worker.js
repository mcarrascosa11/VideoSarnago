import {pipeline, env} from '@huggingface/transformers';
env.allowLocalModels = false;
// ONNX Runtime wasm from the CDN; vite.config.js leaves the local copy out of the build
env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/';

const MODEL = 'onnx-community/whisper-small';
const WASM = {device: 'wasm', dtype: 'q8'};
let model = null, engine = '', firstMode = '';

const report = text => self.postMessage({type: 'status', text});
const progress = p => {if (p.status === 'progress') report('Descargando ' + (p.file || 'modelo') + ': ' + Math.round(p.progress || 0) + '%');};

async function webgpu() {
  if (!self.navigator?.gpu) return null;
  try {return await navigator.gpu.requestAdapter() ? {device: 'webgpu', dtype: {encoder_model: 'fp32', decoder_model_merged: 'q4'}} : null;}
  catch {return null;}
}

async function load(options, label) {
  report(`Preparando Whisper Small (${label}). La primera vez descarga el modelo y puede tardar varios minutos…`);
  model = await pipeline('automatic-speech-recognition', MODEL, {...options, progress_callback: progress});
  engine = label;
}

const transcribe = (wave, language) => model(wave, {language: language || 'spanish', task: 'transcribe', chunk_length_s: 25, stride_length_s: 5, return_timestamps: true, no_repeat_ngram_size: 6});

self.onmessage = async ({data}) => {
  try {
    // ONNX Runtime settings are fixed once it starts, so each worker keeps the mode of its first job.
    if (!firstMode) {
      firstMode = data.mode;
      env.backends.onnx.wasm.numThreads = firstMode === 'fast' && self.crossOriginIsolated
        ? Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2)) : 1;
    }
    if (!model && firstMode === 'fast') {
      const gpu = await webgpu();
      if (gpu) {
        try {
          await load(gpu, 'tarjeta gráfica');
          report('Transcribiendo con la tarjeta gráfica…');
          const result = await transcribe(data.wave, data.language);
          if (result?.chunks?.length) {self.postMessage({type: 'result', chunks: result.chunks}); return;}
          throw new Error('Sin resultado en WebGPU');
        } catch (e) {
          console.warn('VideoSarnago: WebGPU no disponible para Whisper, se usa el procesador.', e);
          try {await model?.dispose();} catch {}
          model = null;
        }
      }
    }
    if (!model) await load(WASM, env.backends.onnx.wasm.numThreads > 1 ? `procesador, ${env.backends.onnx.wasm.numThreads} hilos` : 'procesador');
    report(`Transcribiendo el audio (${engine}). Las frases aparecerán aquí al terminar…`);
    const result = await transcribe(data.wave, data.language);
    self.postMessage({type: 'result', chunks: result.chunks});
  } catch (e) {model = null; self.postMessage({type: 'error', message: e.message || String(e)});}
};
