import dicomParser from 'dicom-parser';

/**
 * Decodes a raw DICOM (.dcm) file into a canvas data URL that <img> can display.
 * Supports the common case: single-frame, uncompressed (or basic) grayscale or
 * RGB pixel data with standard window center/width. This is NOT a full PACS
 * viewer (no multi-frame cine, no compressed transfer syntaxes like JPEG2000)
 * but it correctly renders the vast majority of exported CT/X-ray/MRI slices.
 */
export async function decodeDicomToDataUrl(arrayBuffer) {
  const byteArray = new Uint8Array(arrayBuffer);
  const dataSet = dicomParser.parseDicom(byteArray);

  const rows = dataSet.uint16('x00280010');
  const columns = dataSet.uint16('x00280011');
  const samplesPerPixel = dataSet.uint16('x00280002') || 1;
  const bitsAllocated = dataSet.uint16('x00280100') || 16;
  const pixelRepresentation = dataSet.uint16('x00280103') || 0; // 0=unsigned, 1=signed
  const rescaleSlope = parseFloat(dataSet.string('x00281053') || '1');
  const rescaleIntercept = parseFloat(dataSet.string('x00281052') || '0');

  let windowCenter = parseFloat((dataSet.string('x00281050') || '').split('\\')[0]);
  let windowWidth = parseFloat((dataSet.string('x00281051') || '').split('\\')[0]);

  const pixelDataElement = dataSet.elements.x7fe00010;
  if (!rows || !columns || !pixelDataElement) {
    throw new Error('Unsupported or corrupt DICOM file: missing pixel data or dimensions');
  }

  const canvas = document.createElement('canvas');
  canvas.width = columns;
  canvas.height = rows;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(columns, rows);

  if (samplesPerPixel >= 3) {
    // RGB (e.g. ultrasound, photographic capture)
    const pixels = new Uint8Array(byteArray.buffer, pixelDataElement.dataOffset, pixelDataElement.length);
    for (let i = 0, p = 0; i < pixels.length; i += 3, p += 4) {
      imageData.data[p] = pixels[i];
      imageData.data[p + 1] = pixels[i + 1];
      imageData.data[p + 2] = pixels[i + 2];
      imageData.data[p + 3] = 255;
    }
  } else {
    // Grayscale — apply rescale + window/level, the standard DICOM display pipeline
    const numPixels = rows * columns;
    const raw = bitsAllocated > 8
      ? (pixelRepresentation ? new Int16Array(byteArray.buffer, pixelDataElement.dataOffset, numPixels)
                             : new Uint16Array(byteArray.buffer, pixelDataElement.dataOffset, numPixels))
      : new Uint8Array(byteArray.buffer, pixelDataElement.dataOffset, numPixels);

    // Auto window if not specified in the file
    if (isNaN(windowCenter) || isNaN(windowWidth)) {
      let min = Infinity, max = -Infinity;
      for (let i = 0; i < numPixels; i++) {
        const v = raw[i] * rescaleSlope + rescaleIntercept;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      windowCenter = (max + min) / 2;
      windowWidth = max - min || 1;
    }

    const lower = windowCenter - windowWidth / 2;
    const upper = windowCenter + windowWidth / 2;

    for (let i = 0, p = 0; i < numPixels; i++, p += 4) {
      const hu = raw[i] * rescaleSlope + rescaleIntercept;
      let gray = ((hu - lower) / (upper - lower)) * 255;
      gray = Math.max(0, Math.min(255, gray));
      imageData.data[p] = gray;
      imageData.data[p + 1] = gray;
      imageData.data[p + 2] = gray;
      imageData.data[p + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

export function isDicomUrl(url) {
  return /\.dcm($|\?)/i.test(url) || /\.dicom($|\?)/i.test(url);
}

/** Fetches and decodes a DICOM URL; returns a displayable PNG data URL. */
export async function loadDicomAsImage(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch DICOM file (${resp.status})`);
  const buffer = await resp.arrayBuffer();
  return decodeDicomToDataUrl(buffer);
}
