import {randomUUID} from 'node:crypto';
export function linuxImportCommand(workDir:string,proxyDir:string,args:string[],image=process.env.IMPORT_RUNNER_IMAGE||'x402-media-importer:local') {
 if(!/^[a-zA-Z0-9][a-zA-Z0-9._/:-]*(?:@sha256:[a-f0-9]{64})?$/.test(image))throw Error('Invalid importer image');
 const rootless=process.env.IMPORT_RUNNER_ROOTLESS==='1';
 const socket=process.env.DOCKER_HOST;
 if(rootless&&(!socket||!/^unix:\/\/\/run\/user\/[0-9]+\/docker\.sock$/.test(socket)))throw Error('Rootless importer requires its local per-user Docker socket');
 const name='media-import-'+randomUUID();
 return {name,binary:process.env.DOCKER_BIN||'docker',args:[...(rootless?['--host',socket!]:[]),'run','--rm','--pull','never','--name',name,'--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','64','--memory','512m','--memory-swap','512m','--cpus','1','--user',rootless?'0:0':`${process.getuid?.()??1000}:${process.getgid?.()??1000}`,'--tmpfs','/tmp:rw,nosuid,nodev,noexec,size=32m','--mount',`type=bind,source=${workDir},target=/work`,'--mount',`type=bind,source=${proxyDir},target=/proxy,readonly`,'--workdir','/work',image,...args]};
}
