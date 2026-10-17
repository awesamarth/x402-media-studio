import {Studio} from '../src/core';
import {Imports} from '../src/imports';
import {readFile,writeFile} from 'node:fs/promises';
const studio=new Studio('data/import-demo');await studio.init();const imports=new Imports(studio);await imports.init();
const started=Date.now();let record=await imports.enqueue({url:'https://raw.githubusercontent.com/ggml-org/whisper.cpp/v1.9.4/samples/jfk.wav',media:'audio',idempotencyKey:'public-jfk-demo-001'},'public-demo');
for(let i=0;i<400;i++){record=await imports.get(record.id,'public-demo');if(['succeeded','failed'].includes(record.status))break;await Bun.sleep(1000)}
if(record.status!=='succeeded')throw Error(record.error||'Import demo timed out');
const job=await studio.read('jobs',record.jobId);const transcript=JSON.parse(await readFile(studio.path('jobs',job.id,'0.transcript.json'),'utf8'));const text=transcript.segments.map((s:any)=>s.text).join(' ');if(!/ask not/i.test(text))throw Error('Public speech transcript did not contain the expected phrase');
const report={fixture:'whisper.cpp v1.9.4 public JFK sample',elapsedMs:Date.now()-started,import:record,artifacts:job.artifacts,text};await writeFile(studio.path('report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
