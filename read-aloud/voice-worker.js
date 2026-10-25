import { KokoroTTS } from 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';
let tts;
self.onmessage=async({data})=>{
  if(data.type!=='generate')return;
  const {id,chunks,voice}=data;
  try{
    if(!tts){self.postMessage({type:'status',id,message:'Downloading the voice model (about 92 MB plus supporting files). First use takes longer.'});
      tts=await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX',{dtype:'q8',device:'wasm',progress_callback:p=>{if(p.status==='progress')self.postMessage({type:'download',id,file:p.file,progress:p.progress});}});}
    self.postMessage({type:'loaded',id});
    for(let i=0;i<chunks.length;i++){
      const audio=await tts.generate(chunks[i],{voice,speed:1});
      const pcm=new Int16Array(audio.audio.length);
      for(let j=0;j<pcm.length;j++){const x=Math.max(-1,Math.min(1,audio.audio[j]));pcm[j]=Math.round(x<0?x*32768:x*32767);}
      self.postMessage({type:'chunk',id,index:i,total:chunks.length,rate:audio.sampling_rate,pcm:pcm.buffer},[pcm.buffer]);
    }
    self.postMessage({type:'done',id});
  }catch(e){self.postMessage({type:'error',id,message:e?.message||'Voice generation failed.'});}
};
