// src/services/comfyui-service.ts
'use server';

import config from '@/config';
import { randomUUID } from 'crypto';
import { arrayBufferToDataUrl } from '@/lib/utils'; // Import from utils

const COMFYUI_SERVER_ADDRESS = config.comfyuiServerAddress;
const CLIENT_ID = randomUUID();

interface QueuePromptResponse {
  prompt_id: string;
  number: number;
  node_errors: Record<string, any>; // Adjust based on actual error structure
}

interface ComfyUIHistory {
    [promptId: string]: {
        prompt: [number, string, Record<string, any>, Record<string, any>, string[]];
        outputs: Record<string, ComfyUIOutputNode>;
        status: {
            status_str: string;
            completed: boolean;
            messages: [string, any][]; // [type, data]
        };
    };
}

interface ComfyUIOutputNode {
    images: {
        filename: string;
        subfolder: string;
        type: 'output' | 'input' | 'temp';
    }[];
    // Add other potential output types if needed (e.g., gifs)
}


/**
 * Uploads an image file to the ComfyUI server.
 * @param file - The image file data as a File object.
 * @param filename - The desired filename on the server.
 * @param type - The type of upload ('input', 'temp').
 * @param overwrite - Whether to overwrite if the file exists.
 * @returns Promise resolving to the server's response or throwing an error.
 */
export async function uploadImageToComfyUI(
  file: File,
  filename?: string, // Make filename optional, server can generate one
  type: 'input' | 'temp' = 'input',
  overwrite: boolean = true
): Promise<any> {
  const formData = new FormData();
  formData.append('image', file, filename || file.name); // Use original filename if not provided
  formData.append('type', type);
  formData.append('overwrite', String(overwrite));

  try {
    const response = await fetch(`${COMFYUI_SERVER_ADDRESS}/upload/image`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`ComfyUI Upload Error (${response.status}): ${errorText}`);
      throw new Error(`Failed to upload image to ComfyUI: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('ComfyUI Upload Success:', result);
    return result; // Contains name, subfolder, type
  } catch (error) {
    console.error('Error during ComfyUI upload fetch:', error);
    if (error instanceof Error) {
        throw new Error(`Network or fetch error during ComfyUI upload: ${error.message}`);
    }
    throw new Error('An unknown error occurred during ComfyUI upload.');
  }
}

/**
 * Queues a workflow prompt on the ComfyUI server.
 * @param promptWorkflow - The workflow object.
 * @returns Promise resolving to the queue response containing prompt_id.
 */
export async function queuePrompt(promptWorkflow: object): Promise<QueuePromptResponse> {
  const body = JSON.stringify({
    prompt: promptWorkflow,
    client_id: CLIENT_ID,
  });

  try {
    const response = await fetch(`${COMFYUI_SERVER_ADDRESS}/prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body,
    });

    if (!response.ok) {
      const errorText = await response.text();
       console.error(`ComfyUI Queue Prompt Error (${response.status}): ${errorText}`);
      throw new Error(`Failed to queue prompt: ${response.statusText} - ${errorText}`);
    }

    const result: QueuePromptResponse = await response.json();
    console.log('ComfyUI Queue Prompt Success:', result);
    if (result.node_errors && Object.keys(result.node_errors).length > 0) {
        console.error('ComfyUI Node Errors:', result.node_errors);
        // Optionally throw a more specific error here based on node_errors
    }
    return result;
  } catch (error) {
    console.error('Error during ComfyUI queue prompt fetch:', error);
     if (error instanceof Error) {
        throw new Error(`Network or fetch error during ComfyUI queue prompt: ${error.message}`);
    }
    throw new Error('An unknown error occurred during ComfyUI queue prompt.');
  }
}

/**
 * Fetches the execution history for a given prompt ID.
 * @param promptId - The ID of the prompt to fetch history for.
 * @returns Promise resolving to the history object.
 */
export async function getHistory(promptId: string): Promise<ComfyUIHistory> {
  try {
    const response = await fetch(`${COMFYUI_SERVER_ADDRESS}/history/${promptId}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`ComfyUI Get History Error (${response.status}): ${errorText}`);
      throw new Error(`Failed to get history for prompt ${promptId}: ${response.statusText} - ${errorText}`);
    }
    const result: ComfyUIHistory = await response.json();
    return result;
  } catch (error) {
     console.error(`Error fetching history for prompt ${promptId}:`, error);
     if (error instanceof Error) {
        throw new Error(`Network or fetch error getting ComfyUI history: ${error.message}`);
    }
    throw new Error(`An unknown error occurred getting ComfyUI history for prompt ${promptId}.`);
  }
}

/**
 * Fetches an image from the ComfyUI server.
 * @param filename - The name of the image file.
 * @param subfolder - The subfolder where the image is located.
 * @param type - The type of directory ('output', 'input', 'temp').
 * @returns Promise resolving to the image data as an ArrayBuffer.
 */
export async function getImage(filename: string, subfolder: string, type: 'output' | 'input' | 'temp'): Promise<ArrayBuffer> {
  const params = new URLSearchParams({
    filename: filename,
    subfolder: subfolder,
    type: type,
  });

  try {
    const response = await fetch(`${COMFYUI_SERVER_ADDRESS}/view?${params.toString()}`);
    if (!response.ok) {
       const errorText = await response.text();
       console.error(`ComfyUI Get Image Error (${response.status}): ${errorText}`);
      throw new Error(`Failed to fetch image ${filename} from ComfyUI: ${response.statusText} - ${errorText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return arrayBuffer;
  } catch (error) {
      console.error(`Error fetching image ${filename} from ComfyUI:`, error);
      if (error instanceof Error) {
        throw new Error(`Network or fetch error getting ComfyUI image: ${error.message}`);
      }
      throw new Error(`An unknown error occurred getting ComfyUI image ${filename}.`);
  }
}


/**
 * Fetches a file from a URL (e.g., GCS) and returns it as a File object.
 * Needed because server actions cannot directly use client-side File objects.
 * @param url The URL of the file to fetch.
 * @param filename The desired filename for the File object.
 * @param type The MIME type of the file.
 * @returns A Promise resolving to a File object.
 */
export async function fetchUrlAsFile(url: string, filename: string, type: string): Promise<File> {
    try {
        const response = await fetch(url, { cache: 'no-store'}); // Avoid caching issues
        if (!response.ok) {
            throw new Error(`Failed to fetch file from URL: ${url}, Status: ${response.statusText}`);
        }
        const blob = await response.blob();
        return new File([blob], filename, { type });
    } catch (error) {
        console.error(`Error in fetchUrlAsFile for ${url}:`, error);
        if (error instanceof Error) {
             throw new Error(`Failed to fetch file from ${url}: ${error.message}`);
        }
         throw new Error(`An unknown error occurred while fetching file from ${url}.`);
    }
}
