import {access} from 'node:fs/promises';import {constants} from 'node:fs';import {isAbsolute,join,resolve} from 'node:path';
async function executable(path:string|undefined,label:string){if(!path||!isAbsolute(path))throw Error(`${label}: configure an absolute executable path`);await access(path,constants.X_OK).catch(()=>{throw Error(`${label}: configured binary is unavailable`)});return path}
async function readable(path:string|undefined,label:string){if(!path||!isAbsolute(path))throw Error(`${label}: configure an absolute model path`);await access(path,constants.R_OK).catch(()=>{throw Error(`${label}: configured model is unavailable`)});return path}
export async function localAI(type:'transcribe'|'ocr'){
 const binary=await executable(type==='transcribe'?process.env.WHISPER_BIN:process.env.TESSERACT_BIN,type);
 const model=await readable(type==='transcribe'?process.env.WHISPER_MODEL:process.env.TESSDATA_DIR?join(process.env.TESSDATA_DIR,'eng.traineddata'):undefined,type);
 return {binary,model};
}
export async function localTranslation(){const python=await executable(process.env.TRANSLATE_PYTHON,'localize');const model=await readable(process.env.TRANSLATE_MODEL_DIR,'localize');await readable(join(model,'model','model.bin'),'localize');return {python,model,script:resolve('scripts/translate.py')}}
export async function aiCapabilities(){const configured=async(action:()=>Promise<unknown>)=>{try{await action();return true}catch{return false}};return {transcribe:await configured(()=>localAI('transcribe')),ocr:await configured(()=>localAI('ocr')),localize:await configured(()=>localTranslation()),transcriptionLanguages:['en','auto'],translationPairs:[{from:'en',to:'es'}],ocrLanguages:['eng']}}
