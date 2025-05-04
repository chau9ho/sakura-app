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
      // Add cache control to prevent unexpected caching issues
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text(); // Capture the error response
      console.error(`ComfyUI Upload Error (${response.status}): ${errorText}`);
      throw new Error(`ComfyUI 上傳錯誤 (${response.statusText}): ${errorText}`);
    }

    const result = await response.json();
    console.log('ComfyUI Upload Success:', result);
    return result; // Contains name, subfolder, type
  } catch (error) {
    console.error('Error during ComfyUI upload fetch:', error); // Log the detailed error
    if (error instanceof Error && error.stack) {
      console.error('Stack Trace:', error.stack); // Log the stack trace if available
    } else {
      console.error('Non-Error object caught:', error); // Handle non-Error objects
    }
    if (error instanceof Error) {
        // Check for specific fetch errors like ECONNREFUSED or network errors
        if ((error as any).cause?.code === 'ECONNREFUSED') {
             throw new Error(`網絡連線被拒絕，無法連接 ComfyUI 伺服器 (${COMFYUI_SERVER_ADDRESS})。請檢查伺服器是否正在運行或地址是否正確。`);
        } else if (error.message.includes('fetch failed')) {
             throw new Error(`網絡錯誤，無法連接 ComfyUI 伺服器 (${COMFYUI_SERVER_ADDRESS})。請檢查網絡連線或 ngrok tunnel。`);
        }
        throw new Error(`網絡或 fetch 錯誤 (ComfyUI 上傳): ${error.message}`);
    }
    throw new Error('上傳圖片到 ComfyUI 時發生未知錯誤。');
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
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
       console.error(`ComfyUI Queue Prompt Error (${response.status}): ${errorText}`);
      throw new Error(`無法排隊 prompt (${response.statusText}): ${errorText}`);
    }

    const result: QueuePromptResponse = await response.json();
    console.log('ComfyUI Queue Prompt Success:', result);
    if (result.node_errors && Object.keys(result.node_errors).length > 0) {
        console.error('ComfyUI Node Errors:', result.node_errors);
        // Optionally throw a more specific error here based on node_errors
        const firstErrorKey = Object.keys(result.node_errors)[0];
        const firstErrorDetails = result.node_errors[firstErrorKey];
        throw new Error(`ComfyUI 工作流程節點錯誤 (節點 ${firstErrorKey}): ${firstErrorDetails.errors?.[0]?.message || '未知節點錯誤'}`);
    }
    return result;
  } catch (error) {
    console.error('Error during ComfyUI queue prompt fetch:', error);
     if (error instanceof Error) {
        if ((error as any).cause?.code === 'ECONNREFUSED') {
             throw new Error(`網絡連線被拒絕，無法連接 ComfyUI 伺服器 (${COMFYUI_SERVER_ADDRESS})。請檢查伺服器是否正在運行或地址是否正確。`);
        } else if (error.message.includes('fetch failed')) {
            throw new Error(`網絡錯誤，無法連接 ComfyUI 伺服器 (${COMFYUI_SERVER_ADDRESS})。請檢查網絡連線或 ngrok tunnel。`);
        }
        throw new Error(`網絡或 fetch 錯誤 (ComfyUI 排隊): ${error.message}`);
    }
    throw new Error('排隊 ComfyUI prompt 時發生未知錯誤。');
  }
}

/**
 * Fetches the execution history for a given prompt ID.
 * @param promptId - The ID of the prompt to fetch history for.
 * @returns Promise resolving to the history object.
 */
export async function getHistory(promptId: string): Promise<ComfyUIHistory> {
  try {
    const response = await fetch(`${COMFYUI_SERVER_ADDRESS}/history/${promptId}`, { cache: 'no-store' });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`ComfyUI Get History Error (${response.status}): ${errorText}`);
      throw new Error(`無法獲取 prompt ${promptId} 的歷史記錄 (${response.statusText}): ${errorText}`);
    }
    const result: ComfyUIHistory = await response.json();
    // Add status check within history
     if (result[promptId]?.status?.status_str === 'error') {
         const errorMessages = result[promptId].status.messages?.map(m => m[1]?.message || JSON.stringify(m[1])).join('; ') || '未知執行錯誤';
         console.error(`ComfyUI Execution Error in History for prompt ${promptId}:`, errorMessages);
         throw new Error(`ComfyUI 執行錯誤: ${errorMessages}`);
     }
    return result;
  } catch (error) {
     console.error(`Error fetching history for prompt ${promptId}:`, error);
     if (error instanceof Error) {
        if ((error as any).cause?.code === 'ECONNREFUSED') {
            throw new Error(`網絡連線被拒絕，無法連接 ComfyUI 伺服器 (${COMFYUI_SERVER_ADDRESS})。`);
        } else if (error.message.includes('fetch failed')) {
            throw new Error(`網絡錯誤，無法連接 ComfyUI 伺服器 (${COMFYUI_SERVER_ADDRESS})。`);
        }
        // Re-throw specific execution errors caught earlier
        if (error.message.startsWith('ComfyUI 執行錯誤:')) {
            throw error;
        }
        throw new Error(`網絡或 fetch 錯誤 (獲取歷史記錄): ${error.message}`);
    }
    throw new Error(`獲取 prompt ${promptId} 的 ComfyUI 歷史記錄時發生未知錯誤。`);
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
    const response = await fetch(`${COMFYUI_SERVER_ADDRESS}/view?${params.toString()}`, { cache: 'no-store' });
    if (!response.ok) {
       const errorText = await response.text();
       console.error(`ComfyUI Get Image Error (${response.status}): ${errorText}`);
      throw new Error(`無法從 ComfyUI 獲取圖片 ${filename} (${response.statusText}): ${errorText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return arrayBuffer;
  } catch (error) {
      console.error(`Error fetching image ${filename} from ComfyUI:`, error);
      if (error instanceof Error) {
        if ((error as any).cause?.code === 'ECONNREFUSED') {
             throw new Error(`網絡連線被拒絕，無法連接 ComfyUI 伺服器 (${COMFYUI_SERVER_ADDRESS})。`);
        } else if (error.message.includes('fetch failed')) {
            throw new Error(`網絡錯誤，無法連接 ComfyUI 伺服器 (${COMFYUI_SERVER_ADDRESS})。`);
        }
        throw new Error(`網絡或 fetch 錯誤 (獲取圖片): ${error.message}`);
      }
      throw new Error(`從 ComfyUI 獲取圖片 ${filename} 時發生未知錯誤。`);
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
            throw new Error(`無法從 URL 獲取文件: ${url}, 狀態: ${response.statusText}`);
        }
        const blob = await response.blob();
        return new File([blob], filename, { type });
    } catch (error) {
        console.error(`Error in fetchUrlAsFile for ${url}:`, error);
        if (error instanceof Error) {
             if ((error as any).cause?.code === 'ECONNREFUSED') {
                 throw new Error(`網絡連線被拒絕，無法從 ${url} 獲取文件。`);
             } else if (error.message.includes('fetch failed')) {
                 throw new Error(`網絡錯誤，無法從 ${url} 獲取文件。請檢查網絡連線。`);
             }
             throw new Error(`無法從 ${url} 獲取文件: ${error.message}`);
        }
         throw new Error(`從 ${url} 獲取文件時發生未知錯誤。`);
    }
}

