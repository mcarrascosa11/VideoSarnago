import {pipeline, env} from '@huggingface/transformers';
env.allowLocalModels = false;
// A single WASM thread also works without cross-origin isolation.
env.backends.onnx.wasm.numThreads = 1;
let model;
self.onmessage = async ({data}) => {
  const report = text => self.postMessage({type:'status',text});
  try {
    if (!model) {
      report('Descargando Whisper Small multilingüe. La primera vez puede tardar varios minutos…');
      model = await pipeline('automatic-speech-recognition','onnx-community/whisper-small',{
        device:'wasm',dtype:'q8',
        progress_callback:p=>{if(p.status==='progress') report('Descargando '+(p.file || 'modelo')+': '+Math.round(p.progress || 0)+'%');}
      });
    }
    report('Transcribiendo el audio. Las frases aparecerán aquí al terminar…');
    const result=await model(data.wave,{language:data.language || 'spanish',task:'transcribe',chunk_length_s:25,stride_length_s:5,return_timestamps:'word',no_repeat_ngram_size:6});
    self.postMessage({type:'result',chunks:result.chunks});
  } catch(e) { model=null;self.postMessage({type:'error',message:e.message || String(e)}); }
};
