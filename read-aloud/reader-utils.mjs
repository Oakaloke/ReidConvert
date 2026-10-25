// Pure text/audio helpers. No network or document persistence.
export function wordCount(text) { return (text.trim().match(/\S+/g)||[]).length; }
export function splitChapters(text) {
  const lines=text.replace(/\r\n?/g,'\n').split('\n');
  const out=[]; let title='Opening', current=[];
  const heading=/^(?:chapter|part|book)\s+(?:\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)(?:\b.*)?$|^(?:prologue|epilogue|introduction|conclusion)$/i;
  for(const line of lines){const clean=line.trim();if(clean.length<140&&heading.test(clean)){if(current.join('\n').trim())out.push({title,text:current.join('\n').trim()});title=clean;current=[line];}else current.push(line);}
  if(current.join('\n').trim())out.push({title:out.length?title:(title==='Opening'?'Full document':title),text:current.join('\n').trim()});
  return out.flatMap(c=>{const words=c.text.split(/\s+/);if(words.length<=3500)return[c];const n=Math.ceil(words.length/3000);return Array.from({length:n},(_,i)=>({title:`${c.title} · section ${i+1} of ${n}`,text:words.slice(i*3000,(i+1)*3000).join(' ')}));});
}
export function speechChunks(text,max=280){
  // Word-boundary hard limit prevents Kokoro's tokenizer truncating long sentences.
  const words=text.replace(/\s+/g,' ').trim().split(' '); const chunks=[];let s='';
  for(let word of words){while(word.length>max){if(s){chunks.push(s);s='';}chunks.push(word.slice(0,max));word=word.slice(max);}if(!word)continue;if(s.length+word.length+1>max){chunks.push(s);s='';}s+=(s?' ':'')+word;if(/[.!?]["'”’)]?$/.test(word)&&s.length>110){chunks.push(s);s='';}}
  if(s)chunks.push(s);return chunks;
}
export function wavHeader(samples,rate=24000){const b=new ArrayBuffer(44),v=new DataView(b);const str=(i,s)=>{for(let j=0;j<s.length;j++)v.setUint8(i+j,s.charCodeAt(j));};str(0,'RIFF');v.setUint32(4,36+samples*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,samples*2,true);return b;}
