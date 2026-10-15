import {
  Camera,
  CameraResultType,
  CameraSource,
  CameraDirection,
} from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

export interface CameraCaptureResult {
  file: File;
  previewUrl: string;
}

export const CAMERA_PERMISSION_DENIED_MESSAGE =
  'Camera permission is required to take a photo. You can also choose Upload Photo instead.';

export class CameraPermissionError extends Error {
  constructor(message: string = CAMERA_PERMISSION_DENIED_MESSAGE) {
    super(message);
    this.name = 'CameraPermissionError';
  }
}

export class CameraCancelledError extends Error {
  constructor(message: string = 'User cancelled camera.') {
    super(message);
    this.name = 'CameraCancelledError';
  }
}

/**
 * Checks and requests camera permissions using @capacitor/camera.
 * Throws CameraPermissionError if the user denies camera permission.
 */
export async function checkAndRequestCameraPermissions(): Promise<void> {
  // On native platforms, check and request permissions via Capacitor
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await Camera.checkPermissions();
      if (status.camera === 'denied') {
        throw new CameraPermissionError();
      }
      if (status.camera !== 'granted') {
        const requestRes = await Camera.requestPermissions({ permissions: ['camera'] });
        if (requestRes.camera === 'denied') {
          throw new CameraPermissionError();
        }
      }
    } catch (err: any) {
      if (err instanceof CameraPermissionError) {
        throw err;
      }
      const errMsg = err?.message?.toLowerCase() || '';
      if (errMsg.includes('denied') || errMsg.includes('permission')) {
        throw new CameraPermissionError();
      }
      console.warn('[Camera] Permission check error:', err);
    }
  }
}

/**
 * Opens the native rear-facing device camera using @capacitor/camera.
 * Converts the captured photo into a standard File object and preview URL.
 */
export async function captureLaundryPhoto(): Promise<CameraCaptureResult> {
  // 1. Verify / request camera permission
  await checkAndRequestCameraPermissions();

  let photo;
  try {
    photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      direction: CameraDirection.Rear,
      saveToGallery: false,
    });
  } catch (err: any) {
    const errMsg = err?.message?.toLowerCase() || '';
    if (
      errMsg.includes('user cancelled') ||
      errMsg.includes('cancelled') ||
      errMsg.includes('canceled')
    ) {
      throw new CameraCancelledError();
    }
    if (errMsg.includes('permission') || errMsg.includes('denied')) {
      throw new CameraPermissionError();
    }
    // Re-throw unexpected errors
    throw err;
  }

  if (!photo) {
    throw new CameraCancelledError();
  }

  // 2. Convert captured photo to standard File object
  let file: File;
  let previewUrl = photo.webPath || '';
  const format = photo.format || 'jpeg';

  if (photo.webPath) {
    const response = await fetch(photo.webPath);
    const blob = await response.blob();
    file = new File([blob], `laundry_camera_${Date.now()}.${format}`, {
      type: blob.type || `image/${format}`,
      lastModified: Date.now(),
    });
  } else if (photo.dataUrl) {
    const response = await fetch(photo.dataUrl);
    const blob = await response.blob();
    file = new File([blob], `laundry_camera_${Date.now()}.${format}`, {
      type: blob.type || `image/${format}`,
      lastModified: Date.now(),
    });
    previewUrl = photo.dataUrl;
  } else if (photo.base64String) {
    const byteCharacters = atob(photo.base64String);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: `image/${format}` });
    file = new File([blob], `laundry_camera_${Date.now()}.${format}`, {
      type: `image/${format}`,
      lastModified: Date.now(),
    });
    previewUrl = URL.createObjectURL(blob);
  } else {
    throw new Error('Unable to process captured photo data from device camera.');
  }

  return { file, previewUrl };
}
