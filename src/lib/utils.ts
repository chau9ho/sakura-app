import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converts an ArrayBuffer to a Base64 Data URL.
 * This function works in both Node.js and browser environments.
 * @param buffer - The ArrayBuffer containing the image data.
 * @param mimeType - The MIME type of the image (e.g., 'image/png').
 * @returns The Base64 encoded data URL.
 */
export function arrayBufferToDataUrl(buffer: ArrayBuffer, mimeType: string): string {
    // Check if running in Node.js environment (Buffer is available)
    if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
      // Node.js environment
      const base64 = Buffer.from(buffer).toString('base64');
      return `data:${mimeType};base64,${base64}`;
    }
    // Check if running in Browser environment (window and btoa are available)
    else if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
      // Browser environment
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = window.btoa(binary);
      return `data:${mimeType};base64,${base64}`;
    } else {
      // Fallback or error for unsupported environments
      console.error("arrayBufferToDataUrl: Unsupported environment (neither Node.js nor Browser with btoa).");
      // You might want to throw an error or return a placeholder/error string
      throw new Error("Unsupported environment for ArrayBuffer to Data URL conversion.");
      // return `data:${mimeType};base64,ERROR_UNSUPPORTED_ENV`;
    }
}
