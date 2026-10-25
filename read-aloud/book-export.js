// Whole-book MP4 uses a private browser temp file, never a text upload.
export function createBookExporter({getDocument,beforeStart,setBusy}){
 const $=id=>document.getElementById(id);let worker=null,id=0,temp=null,url=null,busy=false;
 const note=(a,b='')=>{$('bookStatus').textContent=a;$('bookDetail').textContent=b;};
 const format=s=>s<60?`${Math.ceil(s)} sec`:`${Math.ceil(s/60)} min`;
 async function remove(name){if(!name||!navigator.storage?.getDirectory)return;try{const root=await navigator.storage.getDirectory();for(let i=0;i<4;i++){try{await root.removeEntry(name);return;}catch(e){if(e.name==='NotFoundError')return;await new Promise(r=>setTimeout(r,150*(i+1)));}}note('Temporary audio cleanup needs attention.','Use browser site-data settings to remove ReidConvert temporary audio.');}catch{}}
 function stop(){id++;worker?.terminate();worker=null;busy=false;setBusy(false);$('bookCancel').hidden=true;$('bookProgress').hidden=true;}
 function reset(){stop();if(url)URL.revokeObjectURL(url);url=null;$('bookAudio').pause();$('bookAudio').removeAttribute('src');$('bookAudio').load();$('bookAudio').hidden=true;$('bookDownload').hidden=true;$('bookDownload').removeAttribute('href');const old=temp;temp=null;void remove(old);refresh();}
 function refresh(){const doc=getDocument();$('bookCreate').disabled=busy||!doc.chapters.length;if(!busy){const seconds=doc.chapters.reduce((n,c)=>n+c.text.trim().split(/\s+/).length,0)/150*60;note(doc.chapters.length?'The whole book. One audio file.':'Add a document to create a whole-book MP4.',doc.chapters.length?`Rough estimate: ${format(seconds)} listening · ${(seconds*8000/1048576).toFixed(1)} MB at 64 kbps. Actual duration and size vary.`:'Every chapter is included in its original order.');}}
 function cancel(){reset();note('Whole-book export cancelled.','The partial audio file is removed. Start again to recreate the whole book; there is no resume after cancellation.');}
 async function start(){if(busy)return;beforeStart();reset();const doc=getDocument();if(!doc.chapters.length)return;busy=true;const run=++id;setBusy(true);$('bookCreate').disabled=true;$('bookCancel').hidden=false;$('bookProgress').hidden=false;$('bookProgress').value=0;note('Checking local storage and MP4 support…','Keep this tab open and your computer awake. Long books may take a long time to create.');
 try{
  if(!navigator.storage?.getDirectory)throw Error('Local browser file storage is unavailable. Try current Chrome, Edge or Safari outside private browsing.');
  const estimate=await navigator.storage.estimate();if(run!==id)return;const bytes=doc.chapters.reduce((n,c)=>n+c.text.length,0)/5/150*60*8000;if(estimate.quota-estimate.usage<bytes*1.5+20*1048576)throw Error('Not enough free browser storage for the estimated MP4. Free site storage or use section WAV downloads.');
  temp=`rc-book-${Date.now()}-${crypto.randomUUID()}.mp4`;worker=new Worker('./book-worker.js?v=1',{type:'module'});
  const fail=message=>{if(run!==id)return;stop();const old=temp;temp=null;void remove(old);$('bookCreate').disabled=false;note('Could not create the whole-book MP4.',message+' No document text was uploaded.');};
  worker.onerror=()=>fail('The local MP4 engine could not start or ran out of memory.');
  worker.onmessage=({data:d})=>{if(d.id!==run)return;
   if(d.type==='status')note(d.message,'All chapters are processed locally. Keep this tab open.');
   if(d.type==='model')note('Downloading voice files…',`${d.file||'Voice engine'} · ${Math.round(d.progress||0)}%`);
   if(d.type==='progress'){$('bookProgress').value=d.done/d.total*100;note(`Creating whole book · section ${d.section} of ${d.sections}`,`${d.done} / ${d.total} segments · ${format(d.seconds)} audio created · about ${format(d.remaining)} remaining (estimate).`);}
   if(d.type==='error')fail(d.message);
   if(d.type==='done'){worker?.terminate();worker=null;busy=false;setBusy(false);$('bookCancel').hidden=true;$('bookProgress').value=100;$('bookCreate').disabled=false;url=URL.createObjectURL(d.file);$('bookDownload').href=url;$('bookDownload').download=`${doc.title.replace(/\.[^.]+$/,'').replace(/[^a-z0-9 _-]/gi,'').slice(0,80)||'Book'} - Whole book.mp4`;$('bookDownload').hidden=false;$('bookAudio').src=url;$('bookAudio').hidden=false;note('Your whole-book MP4 is ready.',`${format(d.seconds)} of AAC audio · ${(d.file.size/1048576).toFixed(1)} MB. Use the yellow download button to save it.`);}
  };worker.postMessage({id:run,temp,chapters:doc.chapters,voice:doc.voice});
 }catch(e){if(run===id){stop();$('bookCreate').disabled=false;note('Whole-book MP4 is unavailable.',e.message);}}
 }
 $('bookCreate').addEventListener('click',start);$('bookCancel').addEventListener('click',cancel);
 window.addEventListener('beforeunload',()=>{worker?.terminate();if(url)URL.revokeObjectURL(url);void remove(temp);});
 // Only expired files owned by this feature; never another active tab's audio.
 (async()=>{try{const root=await navigator.storage.getDirectory();for await(const [name]of root.entries()){const m=/^rc-book-(\d+)-[\w-]+\.mp4$/.exec(name);if(m&&Date.now()-Number(m[1])>86400000)await remove(name);}}catch{}})();
 return{reset,refresh,cancel,isBusy:()=>busy};
}
