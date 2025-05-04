// src/services/storage-service.ts
'use server';

import { Storage, File as GCSFile } from '@google-cloud/storage';
import path from 'path';
import type { ImageOption } from '@/components/avatar-generation-form'; // Adjust path if needed

// Ensure this path is correct relative to where the server process runs
// In Next.js deployed environments, you might need to adjust how you access this file
// or use environment variables for credentials.
const keyFilename = path.join(process.cwd(), 'src', 'comfyuiserver2024-46d307161d73.json');
const bucketName = 'motherday'; // Your GCS bucket name

let storage: Storage | null = null;

function getStorageClient(): Storage {
  if (!storage) {
    try {
      storage = new Storage({
        keyFilename: keyFilename,
        projectId: 'comfyuiserver2024', // Replace with your actual project ID if different
      });
      console.log("Google Cloud Storage client initialized successfully.");
    } catch (error) {
      console.error("Failed to initialize Google Cloud Storage client:", error);
      // Rethrow or handle appropriately - perhaps return a dummy client or throw
      throw new Error("Could not initialize GCS client. Check credentials and path.");
    }
  }
  return storage;
}

/**
 * Lists photos for a specific user in the GCS bucket.
 * @param username The username to filter photos by.
 * @returns A promise that resolves to an array of ImageOption.
 */
export async function listUserPhotos(username: string): Promise<ImageOption[]> {
  if (!username) {
    console.warn('listUserPhotos called without a username.');
    return [];
  }

  const storageClient = getStorageClient(); // Get initialized client
  const prefix = `${username}_`; // Files are expected to be named like 'username_timestamp.ext'

  try {
    const [files] = await storageClient.bucket(bucketName).getFiles({ prefix });
    console.log(`Found ${files.length} files for prefix "${prefix}" in bucket "${bucketName}".`);

    const photoOptions: ImageOption[] = files
        // Optional: Filter out potential folder placeholders if necessary
       .filter(file => !file.name.endsWith('/'))
       .map((file: GCSFile, index: number) => {
            const fileName = file.name;
            // Construct the public URL
            const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
            // Basic display name generation
            const displayName = `上載圖片 ${index + 1}`; // Or parse timestamp if needed

            return {
                id: fileName, // Use the full file name as a unique ID
                name: displayName,
                src: publicUrl,
                description: `由 ${username} 上載嘅相片`,
                dataAiHint: 'uploaded photo portrait', // Generic hint
            };
        });

    return photoOptions;
  } catch (error) {
    console.error(`Error listing files for user "${username}" in bucket "${bucketName}":`, error);
    // Decide how to handle: return empty array, throw, etc.
    // Check for specific errors like 'bucket not found' or permissions issues.
     if (error instanceof Error && (error as any).code === 404) {
       console.warn(`Bucket "${bucketName}" not found or access denied.`);
     } else if (error instanceof Error && (error as any).code === 403) {
        console.warn(`Permission denied for accessing bucket "${bucketName}". Check service account roles.`);
     }
     // Return empty for simplicity in the UI, but log the error server-side.
    return [];
  }
}
