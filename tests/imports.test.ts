import {test,expect} from 'bun:test';
import {importRequest,Imports} from '../src/imports';
import {Studio} from '../src/core';
import {mkdtemp,rm} from 'node:fs/promises';
test('import requests restrict flags, URLs and ordered workflow defaults',()=>{
 const base={url:'https://raw.githubusercontent.com/example/media/main/a.wav',media:'audio',idempotencyKey:'test-key-001'};
 expect(importRequest(base).steps).toEqual([{type:'transcribe',language:'en'}]);
 expect(importRequest({...base,media:'video'}).steps).toEqual([{type:'frames',atSeconds:[0]}]);
 for(const extra of [{flags:['--cookies','secret']},{url:'http://localhost/a'},{media:'other'},{steps:[{type:'localize'}]},{idempotencyKey:'tiny'}])expect(()=>importRequest({...base,...extra})).toThrow();
});
test('import restart fails interrupted downloads and hides request URLs from other owners',async()=>{
 const root=await mkdtemp('/tmp/import-state-');const studio=new Studio(root);await studio.init();
 const imports=new Imports(studio);await imports.init();await studio.save('imports','abc123',{id:'abc123',owner:'alice',status:'downloading',request:{url:'https://example.invalid/private'},fingerprint:'test'});await imports.init();
 const record=await imports.get('abc123','alice');expect(record.status).toBe('failed');expect(record.request).toBeUndefined();expect(record.fingerprint).toBeUndefined();await expect(imports.get('abc123','bob')).rejects.toThrow('not found');await rm(root,{recursive:true,force:true});
});
