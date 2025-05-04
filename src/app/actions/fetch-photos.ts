// src/app/actions/fetch-photos.ts
'use server';

import { listUserPhotos } from '@/services/storage-service';
import type { ImageOption } from '@/components/avatar-generation-form'; // Adjust path if needed

/**
 * Server action to fetch photos for a given username from Google Cloud Storage.
 * This ensures credentials are only handled server-side.
 * @param username The username to fetch photos for.
 * @returns A promise resolving to an array of ImageOption or an error object.
 */
export async function fetchPhotosAction(username: string): Promise<{ success: true; photos: ImageOption[] } | { success: false; error: string }> {
  if (!username) {
    return { success: false, error: '用戶名不能為空。' };
  }

  try {
    const photos = await listUserPhotos(username);
    return { success: true, photos };
  } catch (error) {
    console.error('[Server Action fetchPhotosAction] Error:', error);
    // Return a generic error message to the client
    return { success: false, error: '無法載入圖片，請稍後再試。' };
  }
}
