// src/app/actions/generate-avatar-action.ts
'use server';

import { z } from 'zod';
import {
  uploadImageToComfyUI,
  queuePrompt,
  getHistory,
  getImage,
  fetchUrlAsFile,
} from '@/services/comfyui-service';
import { arrayBufferToDataUrl } from '@/lib/utils'; // Corrected import path
import workflowData from '@/kimono.json'; // Assuming workflow is in this file
import type { ImageOption } from '@/components/avatar-generation/types';
import { generateAvatarPrompt } from '@/ai/flows/generate-avatar-prompt';
import { randomInt } from 'crypto';
import config from '@/config'; // Import config to access server address for error messages

const COMFYUI_SERVER_ADDRESS = config.comfyuiServerAddress;


// Define the input schema for the action using Zod
const generateAvatarSchema = z.object({
  username: z.string().min(1),
  photo: z.union([
    z.instanceof(File).refine(file => file.size > 0, 'Photo file cannot be empty.'), // From direct upload or camera
    z.string().url().refine(url => url.startsWith('http'), 'Photo must be a valid URL.'), // From fetched photos (GCS URL)
    z.string().refine(dataUrl => dataUrl.startsWith('data:image/'), 'Photo must be a valid data URL.') // From camera capture before form submission was possible
  ]),
  kimono: z.object({
    id: z.string().min(1, "Kimono ID is required."),
    name: z.string(),
    src: z.string(), // Path within public/Kimono
    description: z.string(),
    dataAiHint: z.string(),
  }),
  background: z.object({
    id: z.string().min(1, "Background ID is required."),
    name: z.string(),
    src: z.string(), // Path within public/background
    description: z.string(),
    dataAiHint: z.string(),
  }),
  userDescription: z.string().max(150).optional(),
});

export type GenerateAvatarInput = z.infer<typeof generateAvatarSchema>;

export interface GenerateAvatarResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  prompt?: string; // Return the generated prompt for debugging/info
}

// The server action function
export async function generateAvatarAction(
  input: GenerateAvatarInput
): Promise<GenerateAvatarResult> {
    console.log("Received generation request:", {
        username: input.username,
        kimono: input.kimono.id,
        background: input.background.id,
        photoType: typeof input.photo === 'string' ? (input.photo.startsWith('data:') ? 'dataUrl' : 'url') : 'file',
        userDescription: input.userDescription,
    });

  // 1. Validate input
  const validation = generateAvatarSchema.safeParse(input);
  if (!validation.success) {
    console.error("Validation failed:", validation.error.errors);
    return { success: false, error: `輸入無效: ${validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}` };
  }

  const { username, photo, kimono, background, userDescription } = validation.data;

  try {
    // 2. Prepare Photo File for Upload
    let photoFile: File;
    let photoFilenameForWorkflow: string;

    if (typeof photo === 'string') {
        if (photo.startsWith('data:image/')) {
             // Convert data URL to File
             const blob = await fetch(photo).then(res => res.blob());
             const fileExtension = blob.type.split('/')[1] || 'png';
             photoFilenameForWorkflow = `${username}_cam_${Date.now()}.${fileExtension}`;
             photoFile = new File([blob], photoFilenameForWorkflow, { type: blob.type });
             console.log(`Converted camera data URL to File: ${photoFilenameForWorkflow}`);
        } else if (photo.startsWith('http')) {
             // Fetch URL and create File
             const originalFilename = photo.substring(photo.lastIndexOf('/') + 1);
             // Ensure a fallback filename if URL doesn't have one
             photoFilenameForWorkflow = originalFilename || `${username}_url_${Date.now()}.png`;
             const fileType = photo.endsWith('.png') ? 'image/png' : photo.endsWith('.jpg') || photo.endsWith('.jpeg') ? 'image/jpeg' : 'image/webp'; // Basic type detection
             photoFile = await fetchUrlAsFile(photo, photoFilenameForWorkflow, fileType);
             console.log(`Fetched photo URL as File: ${photoFilenameForWorkflow}`);
        } else {
             throw new Error("Invalid photo string format. Expected data URL or HTTP(S) URL.");
        }
    } else {
      photoFile = photo; // Already a File object from direct upload
      photoFilenameForWorkflow = photo.name;
       console.log(`Using direct upload File: ${photoFilenameForWorkflow}`);
    }

    // 3. Upload Images to ComfyUI (User Photo, Kimono, Background)
    console.log("Uploading user photo to ComfyUI...");
    const userPhotoUploadResult = await uploadImageToComfyUI(photoFile, photoFilenameForWorkflow, 'input', true);
    const userPhotoFilename = userPhotoUploadResult.name; // Use the filename returned by ComfyUI
    console.log(`User photo uploaded as: ${userPhotoFilename}`);

    console.log("Uploading kimono image to ComfyUI...");
    // Kimono path is relative to public, fetch it as file
    const kimonoFilePath = `public${kimono.src}`; // Construct path relative to project root
    // Need to actually read the file from the filesystem here. Server actions run in Node.js.
    const fs = require('fs/promises');
    const path = require('path');
    const kimonoAbsolutePath = path.join(process.cwd(), kimonoFilePath);
     let kimonoFile: File;
     try {
         const kimonoBuffer = await fs.readFile(kimonoAbsolutePath);
         const kimonoMimeType = kimono.src.endsWith('.png') ? 'image/png' : 'image/jpeg'; // Adjust as needed
         const kimonoBlob = new Blob([kimonoBuffer], { type: kimonoMimeType });
         kimonoFile = new File([kimonoBlob], path.basename(kimono.src), { type: kimonoMimeType });
         console.log(`Read kimono file from filesystem: ${kimono.src}`);
     } catch (fsError) {
        console.error(`Failed to read kimono file: ${kimonoAbsolutePath}`, fsError);
        throw new Error(`內部錯誤：無法讀取和服圖像文件。`);
     }
    const kimonoUploadResult = await uploadImageToComfyUI(kimonoFile, kimonoFile.name, 'input', true);
    const kimonoFilename = kimonoUploadResult.name;
    console.log(`Kimono image uploaded as: ${kimonoFilename}`);

    console.log("Uploading background image to ComfyUI...");
     const backgroundFilePath = `public${background.src}`;
     const backgroundAbsolutePath = path.join(process.cwd(), backgroundFilePath);
     let backgroundFile: File;
      try {
         const backgroundBuffer = await fs.readFile(backgroundAbsolutePath);
         const backgroundMimeType = background.src.endsWith('.png') ? 'image/png' : 'image/jpeg'; // Adjust as needed
         const backgroundBlob = new Blob([backgroundBuffer], { type: backgroundMimeType });
         backgroundFile = new File([backgroundBlob], path.basename(background.src), { type: backgroundMimeType });
         console.log(`Read background file from filesystem: ${background.src}`);
      } catch (fsError) {
         console.error(`Failed to read background file: ${backgroundAbsolutePath}`, fsError);
         throw new Error(`內部錯誤：無法讀取背景圖像文件。`);
      }
    const backgroundUploadResult = await uploadImageToComfyUI(backgroundFile, backgroundFile.name, 'input', true);
    const backgroundFilename = backgroundUploadResult.name;
    console.log(`Background image uploaded as: ${backgroundFilename}`);


    // 4. Generate AI Prompt (if needed, or use descriptions)
    console.log("Generating AI prompt...");
    const promptGenResult = await generateAvatarPrompt({
      kimono: kimono.description,
      background: background.description,
      userDescription: userDescription,
    });
    const finalPrompt = promptGenResult.prompt;
    console.log("Generated prompt:", finalPrompt);

    // 5. Modify Workflow JSON
    const modifiedWorkflow = JSON.parse(JSON.stringify(workflowData)); // Deep clone

    // -- Update Node Inputs --
    // Node 88: User Photo (PuLID input)
    if (modifiedWorkflow["88"]) {
        modifiedWorkflow["88"]["inputs"]["image"] = userPhotoFilename;
    } else console.warn("Workflow node 88 not found for user photo.");

    // Node 39: Kimono Photo (Redux input)
    if (modifiedWorkflow["39"]) {
        modifiedWorkflow["39"]["inputs"]["image"] = kimonoFilename;
    } else console.warn("Workflow node 39 not found for kimono photo.");

     // Node 47: Background Photo (Florence2 input for prompt gen / Redux style ref)
     // Assuming we still use the selected background for style even if generating description
     if (modifiedWorkflow["47"]) {
         modifiedWorkflow["47"]["inputs"]["image"] = backgroundFilename;
     } else console.warn("Workflow node 47 not found for background photo.");

     // Node 9: Positive Prompt (CLIP Text Encode) - Use the generated prompt
     if (modifiedWorkflow["9"]) {
         modifiedWorkflow["9"]["inputs"]["text"] = finalPrompt;
     } else console.warn("Workflow node 9 not found for positive prompt.");

     // Node 80: Display Text (easy showAnything) - Also show the generated prompt
     if (modifiedWorkflow["80"]) {
         modifiedWorkflow["80"]["inputs"]["text"] = `Generated Prompt: ${finalPrompt}`;
     } else console.warn("Workflow node 80 not found for displaying text.");


    // Node 99: Seed
    if (modifiedWorkflow["99"]) {
        modifiedWorkflow["99"]["inputs"]["seed"] = randomInt(0, 2**32 - 1); // Use crypto.randomInt for better randomness
    } else console.warn("Workflow node 99 not found for seed.");

    // Node 101: Save Image - Optional: customize filename
    const outputFilenamePrefix = `SakuraAvatar_${username}_${Date.now()}`;
    if (modifiedWorkflow["101"]) {
        modifiedWorkflow["101"]["inputs"]["filename_prefix"] = outputFilenamePrefix;
    } else console.warn("Workflow node 101 not found for output filename.");

     // --- Log final workflow ---
     // console.log("Final Workflow JSON:", JSON.stringify(modifiedWorkflow, null, 2));


    // 6. Queue Prompt with ComfyUI
    console.log("Queueing prompt with ComfyUI...");
    const queueResponse = await queuePrompt(modifiedWorkflow);
    const promptId = queueResponse.prompt_id;
    console.log(`Prompt queued with ID: ${promptId}`);

    // 7. Poll for Result (using WebSocket is preferred, but polling is simpler for now)
    let history;
    let attempts = 0;
    const maxAttempts = 60; // Increase attempts to 60 (2 minutes timeout)
    const pollInterval = 2000; // 2 seconds

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;
      console.log(`Polling for result... Attempt ${attempts}/${maxAttempts}`);
      history = await getHistory(promptId);

      const promptHistory = history[promptId];
      if (promptHistory) {
         // Check status first
         if (promptHistory.status?.completed) {
           console.log("Prompt completed!");
           // Check for outputs even if completed is true
           if (!promptHistory.outputs || Object.keys(promptHistory.outputs).length === 0) {
               console.warn("Prompt completed but no outputs found in history yet. Polling again...");
               // Continue polling for a few more seconds if outputs are missing
               if (attempts < maxAttempts - 5) continue; // Allow 5 extra polls
               else throw new Error("Prompt completed, but no output data was received from ComfyUI.");
           }
           break; // Exit loop, we have the result
        } else if (promptHistory.status?.status_str === 'error') {
             console.error("ComfyUI execution error in history:", promptHistory.status.messages);
             const errorMessages = promptHistory.status.messages?.map(m => m[1]?.message || JSON.stringify(m[1])).join('; ') || '未知執行錯誤';
             throw new Error(`ComfyUI 執行錯誤: ${errorMessages}`);
        }
        // Optional: Log intermediate status
        // console.log("Prompt status:", promptHistory.status?.status_str);
      }
    }

    if (attempts >= maxAttempts) {
      throw new Error(`生成超時（${maxAttempts * pollInterval / 1000}秒），請稍後再試或檢查 ComfyUI 伺服器狀態 (${COMFYUI_SERVER_ADDRESS})。`);
    }

    // 8. Extract Output Image Filename from History (Ensure history is defined)
    const promptHistory = history?.[promptId];
    if (!promptHistory?.outputs) {
        console.error("Final history check failed: No outputs found for prompt", promptId, history);
        throw new Error("處理記錄中未找到輸出數據。");
    }

    let outputNodeId: string | undefined;

    // Find the output node (assuming it's the VAEDecode or Image Save node)
    // Node 17 = VAEDecode, Node 101 = Image Save
     const outputNodeCandidates = ["17", "101"]; // Prioritize 101 (Save Image) if available
     for (const nodeId of ["101", "17"]) {
         if (promptHistory.outputs[nodeId]?.images?.length > 0) {
            outputNodeId = nodeId;
            break;
         }
     }

    if (!outputNodeId) {
        console.error("Could not find valid output node with images in history:", promptHistory.outputs);
        throw new Error("無法喺處理記錄搵到輸出圖像。檢查 ComfyUI 工作流程嘅輸出節點。");
    }

    const outputImageInfo = promptHistory.outputs[outputNodeId].images[0];
    const { filename: outputFilename, subfolder: outputSubfolder, type: outputType } = outputImageInfo;

    // 9. Fetch the Generated Image
    console.log(`Fetching generated image: ${outputFilename} (type: ${outputType}, subfolder: ${outputSubfolder})`);
    const imageBuffer = await getImage(outputFilename, outputSubfolder, outputType);

    // 10. Convert to Data URL
    const mimeType = outputFilename.endsWith('.png') ? 'image/png' : 'image/jpeg'; // Assuming PNG or JPG output
    const imageUrl = arrayBufferToDataUrl(imageBuffer, mimeType);
    console.log("Image fetched and converted to data URL.");

    return {
        success: true,
        imageUrl: imageUrl,
        prompt: finalPrompt // Include the generated prompt in the success response
    };

  } catch (error: any) {
    console.error("Avatar generation failed:", error);
    // Ensure error message is extracted correctly
    let errorMessage = '生成失敗: 未知錯誤';
    if (error instanceof Error) {
        errorMessage = `生成失敗: ${error.message}`;
    } else if (typeof error === 'string') {
        errorMessage = `生成失敗: ${error}`;
    }
    // Check if it's a network error and include server address
    if (errorMessage.includes('Network') || errorMessage.includes('fetch failed') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('網絡')) {
         errorMessage += ` (伺服器地址: ${COMFYUI_SERVER_ADDRESS})`;
    }

    return { success: false, error: errorMessage };
  }
}

