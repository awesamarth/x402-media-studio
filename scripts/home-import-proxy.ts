import {startImportProxy} from '../src/import-proxy';

// Local-only endpoint for a private SSH reverse forward; no public listener or cookies.
const proxy = await startImportProxy({port:Number(process.env.HOME_IMPORT_PROXY_PORT || 18792),homeRelay:true});
console.log(`YouTube home relay listening on 127.0.0.1:${proxy.port}`);
for (const signal of ['SIGINT','SIGTERM'] as const) process.once(signal,async()=>{
  await proxy.close();
  process.exit(0);
});
