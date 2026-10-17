import {mkdir,readdir,readFile,writeFile,stat,rm} from 'node:fs/promises';
import {join} from 'node:path';
import type {Studio} from './core';
export const RETENTION_MS=60*60*1000;
const active=(j:any)=>['queued','running'].includes(j.status);
const terminal=(j:any)=>['succeeded','failed','expired'].includes(j.status);
const due=(value:any,now:number)=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=now;
/** Media cleanup only. Payment/replay records and small job tombstones remain to prevent repeat charging/execution. */
export class Retention {
 private timer?:ReturnType<typeof setInterval>;private since=Infinity;
 constructor(private studio:Studio,private busy=()=>false){}
 async init(schedule=true){await mkdir(this.studio.path('retention'),{recursive:true});const path=this.studio.path('retention','policy.json');try{this.since=JSON.parse(await readFile(path,'utf8')).managedSince}catch(e:any){if(e.code!=='ENOENT')throw e;this.since=Date.now();await writeFile(path,JSON.stringify({version:1,managedSince:this.since,legacyPolicy:'preserve pending approval'}))}if(schedule){await this.sweep();this.timer=setInterval(()=>{void this.sweep().catch(()=>console.error('Media retention cleanup failed; operator inspection required'))},30000);this.timer.unref()}}
 stop(){clearInterval(this.timer)}
 async sweep(options:{now?:number;dryRun?:boolean}={}){
  if(this.studio.maintenance||this.studio.activeRequests||this.studio.running||this.studio.uploading||this.busy())return {skipped:'active work'};
  let release!:()=>void;this.studio.maintenance=new Promise<void>(r=>release=r);
  const now=options.now??Date.now(),dryRun=options.dryRun??false;const removed:string[]=[],legacy:string[]=[],protectedAssets=new Set<string>(),protectedCache=new Set<string>();
  const records=async(kind:string)=>{const rows:any[]=[];for(const name of await readdir(this.studio.path(kind)).catch((e:any)=>{if(e.code==='ENOENT')return [];throw e})){if(!name.endsWith('.json'))continue;rows.push({name,value:await this.studio.read(kind,name.slice(0,-5))})}return rows};
  const remove=async(...parts:string[])=>{const relative=parts.join('/');try{await stat(this.studio.path(...parts))}catch(e:any){if(e.code==='ENOENT')return;throw e}removed.push(relative);if(!dryRun)await rm(this.studio.path(...parts),{recursive:true,force:true})};
  const protect=(j:any)=>{const id=j.inputAssetId||j.workflow?.assetId;if(id&&id!=='0'.repeat(64))protectedAssets.add(id);for(const a of j.artifacts||[])if(a.cacheKey)protectedCache.add(a.cacheKey)};
  try{
   const jobs=await records('jobs'),quotes=await records('quotes'),grants=await records('assetAccess'),imports=await records('imports');
   for(const {value:q} of quotes){if(jobs.some(r=>r.value.quoteId===q.id))continue;let payment:any;try{payment=await this.studio.read('payments',q.id)}catch(e:any){if(e.code!=='ENOENT')throw e}if(payment&&['pending','settled'].includes(payment.status)&&q.workflow?.assetId)protectedAssets.add(q.workflow.assetId)}
   for(const {value:j} of jobs){if(j.retentionVersion!==1){legacy.push('jobs/'+j.id);protect(j);continue}if(active(j)||!terminal(j)||!due(j.expiresAt,now)){protect(j);continue}
    await remove('jobs',j.id);await remove('import-work',j.id);
    if(j.status!=='expired'&&!dryRun){await this.studio.save('jobs',j.id,{id:j.id,owner:j.owner,quoteId:j.quoteId,retentionVersion:1,createdAt:j.createdAt,completedAt:j.completedAt,expiresAt:j.expiresAt,status:'expired',artifacts:[]});const q=quotes.find(r=>r.value.id===j.quoteId)?.value;if(q){delete q.workflow;q.filesExpiredAt=j.expiresAt;await this.studio.save('quotes',q.id,q)}}
   }
   for(const {name,value:g} of grants){if(g.retentionVersion!==1){legacy.push('assetAccess/'+name);protectedAssets.add(g.assetId)}else if(!due(g.expiresAt,now))protectedAssets.add(g.assetId);else if(!protectedAssets.has(g.assetId))await remove('assetAccess',name)}
   for(const {value:q} of quotes){if(!q.workflow)continue;if(q.retentionVersion!==1){legacy.push('quotes/'+q.id);if(q.workflow.assetId)protectedAssets.add(q.workflow.assetId);continue}if(!due(q.expiresAt,now)&&q.workflow.assetId)protectedAssets.add(q.workflow.assetId);
    if(!jobs.some(r=>r.value.quoteId===q.id)&&due(q.createdAt?new Date(Date.parse(q.createdAt)+RETENTION_MS).toISOString():undefined,now)){let payment=false;try{await this.studio.read('payments',q.id);payment=true}catch(e:any){if(e.code!=='ENOENT')throw e}if(!payment)await remove('quotes',q.id+'.json')}
   }
   for(const {value:r} of imports){if(r.retentionVersion!==1){legacy.push('imports/'+r.id);if(r.assetId)protectedAssets.add(r.assetId);continue}const j=jobs.find(row=>row.value.id===r.jobId)?.value;if(j&&(active(j)||!due(j.expiresAt,now)))continue;const expiry=j?.expiresAt||r.expiresAt;if(due(expiry,now)){await remove('import-work',r.id);if(!dryRun)await this.studio.save('imports',r.id,{id:r.id,owner:r.owner,status:'expired',expiresAt:expiry,retentionVersion:1})}else if(r.assetId)protectedAssets.add(r.assetId)}
   for(const {name,value:a} of await records('assets')){if(a.retentionVersion!==1){legacy.push('assets/'+name);continue}if(!protectedAssets.has(a.id)&&due(a.expiresAt,now)){await remove('assets',a.id);await remove('assets',name)}}
   for(const name of await readdir(this.studio.path('cache')).catch((e:any)=>{if(e.code==='ENOENT')return [];throw e})){if(!/^[a-f0-9]{64}$/.test(name))continue;let entry:any;try{entry=JSON.parse(await readFile(this.studio.path('cache',name,'entry.json'),'utf8'))}catch(e:any){if(e.code!=='ENOENT')throw e}if(entry?.retentionVersion!==1){legacy.push('cache/'+name);continue}if(!protectedCache.has(name)&&due(entry.expiresAt,now))await remove('cache',name)}
   // Crash leftovers have no usable manifest. Only files born after this policy was activated are eligible.
   for(const kind of ['assets','cache','import-work','jobs'])for(const item of await readdir(this.studio.path(kind),{withFileTypes:true}).catch((e:any)=>{if(e.code==='ENOENT')return [];throw e})){const name=item.name;const path=this.studio.path(kind,name);const info=await stat(path);if(info.birthtimeMs<this.since||info.mtimeMs+RETENTION_MS>now)continue;
    const orphan=name.endsWith('.tmp')?true:kind==='cache'?false:kind==='import-work'?!jobs.some(r=>r.value.id===name&&active(r.value))&&!imports.some(r=>r.value.id===name&&['queued','downloading'].includes(r.value.status)):kind==='assets'?!name.endsWith('.json')&&!name.includes('.tmp')&&!await Bun.file(this.studio.path('assets',name+'.json')).exists():name.endsWith('.tmp');if(orphan)await remove(kind,name)
   }
   return {dryRun,removed,legacyPreserved:[...new Set(legacy)],sweepIntervalSeconds:30};
  }finally{this.studio.maintenance=undefined;release();void this.studio.drain()}
 }
}
