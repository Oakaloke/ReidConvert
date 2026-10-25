import {KokoroTTS} from 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';
import {Output,Mp4OutputFormat,StreamTarget,AudioSampleSource,AudioSample,Quality,canEncodeAudio} from 'https://cdn.jsdelivr.net/npm/mediabunny@1.62.1/+esm';
import {registerAacEncoder} from 'https://cdn.jsdelivr.net/npm/@mediabunny/aac-encoder@1.62.1/+esm';
import {speechChunks} from './reader-utils.mjs';
self.onmessage=async({data:d})=>{
 let disk,root,output,success=false;
 const send=(type,extra={})=>self.postMessage({id:d.id,type,...extra});
 try{
  if(!navigator.storage?.getDirectory)throw Error('Whole-book MP4 needs local browser file storage. Try current Chrome, Edge or Safari with normal browsing, not private mode.');
  root=await navigator.storage.getDirectory();const handle=await root.getFileHandle(d.temp,{create:true});
  if(!handle.createSyncAccessHandle)throw Error('This browser cannot stream a large audio file to local storage. Section WAV downloads still work.');
  disk=await handle.createSyncAccessHandle();
  if(!(await canEncodeAudio('aac',{sampleRate:24000,numberOfChannels:1,quality:new Quality({bitrate:64000})})))registerAacEncoder();
  if(!(await canEncodeAudio('aac',{sampleRate:24000,numberOfChannels:1,quality:new Quality({bitrate:64000})})))throw Error('AAC encoding is unavailable in this browser. Section WAV downloads still work.');
  let written=0;
  const target=new StreamTarget(new WritableStream({write({data,position}){let n=0;while(n<data.byteLength){const count=disk.write(data.subarray(n),{at:position+n});if(!count)throw Error('Local audio storage is full.');n+=count;}written=Math.max(written,position+data.byteLength);}}),{chunked:true,chunkSize:1048576});
  output=new Output({format:new Mp4OutputFormat({fastStart:false}),target});
  const source=new AudioSampleSource({codec:'aac',quality:new Quality({bitrate:64000})});
  output.addAudioTrack(source,{languageCode:'eng',name:'Whole book'});await output.start();
  send('status',{message:'Preparing the local voice engine…'});
  const tts=await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX',{dtype:'q8',device:'wasm',progress_callback:p=>{if(p.status==='progress')send('model',{file:p.file,progress:p.progress});}});
  let samples=0,done=0;const total=d.chapters.reduce((n,c)=>n+speechChunks(c.text).length,0),start=performance.now();
  for(let section=0;section<d.chapters.length;section++){
   for(const text of speechChunks(d.chapters[section].text)){
    const audio=await tts.generate(text,{voice:d.voice,speed:1});
    if(audio.sampling_rate!==24000)throw Error('Unexpected voice sample rate. Export stopped rather than creating incorrect audio.');
    // One generated segment at a time; await encoding/disk backpressure before continuing.
    const sample=new AudioSample({data:audio.audio,format:'f32-planar',numberOfChannels:1,sampleRate:24000,timestamp:samples/24000});
    try{await source.add(sample);}finally{sample.close();}
    samples+=audio.audio.length;done++;
    send('progress',{done,total,section:section+1,sections:d.chapters.length,seconds:samples/24000,bytes:written,remaining:Math.max(0,(performance.now()-start)/1000/done*(total-done))});
   }
  }
  source.close();send('status',{message:'Finishing the MP4 file…'});await output.finalize();disk.flush();disk.close();disk=null;
  const file=await handle.getFile();success=true;send('done',{file,seconds:samples/24000});
 }catch(e){try{await output?.cancel();}catch{}send('error',{message:e?.message||'Whole-book export failed.'});}
 finally{try{disk?.close();}catch{}if(!success&&root)try{await root.removeEntry(d.temp);}catch{}}
};
