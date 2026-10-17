// One source of truth for upload admission, HTTP buffering, and the local client.
export const MAX_UPLOAD_BYTES = 104857600; // 100 MiB
export function validateUploadSize(bytes:number){
 if(!Number.isSafeInteger(bytes)||bytes<1||bytes>MAX_UPLOAD_BYTES)throw Error('Asset must be 1 byte–100 MiB (104857600 bytes maximum)');
}
