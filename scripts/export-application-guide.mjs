import {mkdir,readFile,writeFile} from 'node:fs/promises';

// Uses the app's PDF renderer locally. No Gemini request or account data is used.
const base=new URL(process.argv[2]??'http://localhost:3000');
if(!['localhost','127.0.0.1'].includes(base.hostname)) throw new Error('Use a local app server for guide export');
const markdown=await readFile(new URL('../APPLICATION_GUIDE.md',import.meta.url),'utf8');
const response=await fetch(new URL('/api/export-pdf',base),{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({bookTitle:'Learning Space Application Guide',markdown}),
  signal:AbortSignal.timeout(120000),
});
if(!response.ok || !response.headers.get('content-type')?.includes('application/pdf')) {
  throw new Error(`Guide PDF export failed (${response.status}); check the local server`);
}
const bytes=Buffer.from(await response.arrayBuffer());
if(bytes.subarray(0,5).toString()!=='%PDF-') throw new Error('Guide export was not a PDF');
const directory=new URL('../output/pdf/',import.meta.url);
await mkdir(directory,{recursive:true});
await writeFile(new URL('learning-space-application-guide.pdf',directory),bytes);
console.log('Created output/pdf/learning-space-application-guide.pdf');
