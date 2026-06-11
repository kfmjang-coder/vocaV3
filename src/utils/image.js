/** 촬영 이미지를 1024px로 압축 → base64 반환. 이미지는 어디에도 저장하지 않음 (S4) */
export async function compressImage(file, maxSize = 1024) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
  return { base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' };
}
