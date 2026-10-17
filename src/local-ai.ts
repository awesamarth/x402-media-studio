import {access} from 'node:fs/promises';import {constants} from 'node:fs';import {isAbsolute} from 'node:path';
export async function localAI(type:'transcribe'|'ocr'){
 const binary=type==='transcribe'?process.env.WHISPER_BIN:process.env.TESSERACT_BIN;const model=process.env.WHISPER_MODEL;
 if(!binary||!isAbsolute(binary))throw Error(`${type}: configure an absolute ${type==='transcribe'?'WHISPER_BIN':'TESSERACT_BIN'} path; no dependency is installed automatically`);
 await access(binary,constants.X_OK).catch(()=>{throw Error(`${type}: configured binary is unavailable`)});
 if(type==='transcribe'){if(!model||!isAbsolute(model))throw Error('transcribe: configure absolute WHISPER_MODEL path');await access(model,constants.R_OK).catch(()=>{throw Error('transcribe: configured model is unavailable')})}
 return {binary,model};
}
