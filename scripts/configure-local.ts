import {readFile,writeFile,stat} from 'node:fs/promises';import {resolve} from 'node:path';import {fileHash} from '../src/pipeline';import {command} from '../src/process';
const tesseract=Bun.which('tesseract');if(!tesseract)throw Error('Install Tesseract first');
const settings:Record<string,string>={BILLING_MODE:'free',WHISPER_BIN:resolve('.runtime/whisper.cpp-1.9.4/build/bin/whisper-cli'),WHISPER_MODEL:resolve('.runtime/models/ggml-small.bin'),TESSERACT_BIN:tesseract,TESSDATA_DIR:resolve('.runtime/models/tessdata'),TRANSLATE_PYTHON:resolve('.runtime/translation/venv/bin/python'),TRANSLATE_MODEL_DIR:resolve('.runtime/translation/models/en_es')};
let prior='';try{prior=await readFile('.env.local','utf8')}catch{}
const preserved=prior.split('\n').filter(line=>line.trim()&&!Object.keys(settings).some(key=>line.startsWith(key+'=')));
await writeFile('.env.local',preserved.concat(Object.entries(settings).map(([key,value])=>`${key}=${JSON.stringify(value)}`)).join('\n')+'\n');
const files=[];for(const path of [settings.WHISPER_BIN!,settings.WHISPER_MODEL!,resolve('.runtime/models/tessdata/eng.traineddata'),resolve('.runtime/translation/models/en_es/model/model.bin')])files.push({path,bytes:(await stat(path)).size,sha256:await fileHash(path)});
await writeFile('.runtime/install-manifest.json',JSON.stringify({platform:process.platform,arch:process.arch,whisperVersion:(await command([settings.WHISPER_BIN!,'--version'])).trim(),tesseractVersion:(await command([tesseract,'--version'])).split('\n')[0],files},null,2));
console.log('Wrote non-secret local engine paths and install manifest; preserved account settings. Billing is free.');
