import {test,expect} from 'bun:test';
import {selectCaptions,captionDocument} from '../src/source-captions';
import {Studio} from '../src/core';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
const source={kind:'manual' as const,language:'en',trackLanguage:'en',pageUrl:'https://www.youtube.com/watch?v=abcdefghijk',extractor:'Youtube'};
const captions='WEBVTT\n\n00:00.000 --> 00:01.200\nHello <b>world</b>\n\n00:01.000 --> 00:02.000\nTiming remains.\n';
test('manual captions precede automatic captions; only genuine missing language returns no track',()=>{
 expect(selectCaptions({subtitles:{'en-US':[{ext:'vtt'}]},automatic_captions:{en:[{ext:'vtt'}]}})?.kind).toBe('manual');expect(selectCaptions({automatic_captions:{en:[{ext:'vtt'}]}})?.kind).toBe('automatic');expect(selectCaptions({subtitles:{es:[{ext:'vtt'}]}})).toBeUndefined();expect(()=>selectCaptions({subtitles:{en:[{ext:'json3'}]}})).toThrow('supported');expect(captionDocument(captions,source).duration).toBe(2);
});
test('source captions produce real owned transcript artifacts without Whisper and retain provider timing/provenance',async()=>{
 const root=await mkdtemp('/tmp/source-captions-');const studio=new Studio(root);await studio.init();try{const asset=await studio.uploadCaptions(captions,source,'alice');expect(asset.streams).toEqual([]);expect(asset.kind).toBe('captions');const q=await studio.quote({assetId:asset.id,steps:[{type:'transcribe'}]},'alice');const job=await studio.enqueue(q.id,'source-caption-test');for(let i=0;i<100;i++){const j=await studio.read('jobs',job.id);if(j.status==='succeeded')break;if(j.status==='failed')throw Error(j.error);await Bun.sleep(20)}const j=await studio.read('jobs',job.id);expect(j.status).toBe('succeeded');const transcript=JSON.parse(await readFile(studio.path('jobs',job.id,'0.transcript.json'),'utf8'));expect(transcript.engine).toBe('source-captions');expect(transcript.provenance.kind).toBe('manual');expect(transcript.modelSha256).toBeUndefined();expect(transcript.segments.map((s:any)=>[s.startSeconds,s.endSeconds])).toEqual([[0,1.2],[1,2]]);expect(transcript.segments[0].text).toBe('Hello world');await expect(studio.asset(asset.id,'bob')).rejects.toThrow();await expect(studio.quote({assetId:asset.id,steps:[{type:'clip',start:0,duration:1}]},'alice')).rejects.toThrow('Caption assets');}finally{await rm(root,{recursive:true,force:true})}
});
