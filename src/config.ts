// src/config.ts

interface Config {
  comfyuiServerAddress: string;
  // Add other configurable settings here if needed
}

const config: Config = {
  // Default to localhost, but use environment variable if available
  // Ensure your ComfyUI server is accessible from your Next.js server environment
  comfyuiServerAddress: process.env.COMFYUI_SERVER_ADDRESS || "http://127.0.0.1:8188",
};

// Validate address format (basic check)
if (!config.comfyuiServerAddress.startsWith('http://') && !config.comfyuiServerAddress.startsWith('https://')) {
  console.warn(`Invalid COMFYUI_SERVER_ADDRESS format: ${config.comfyuiServerAddress}. Using default http://127.0.0.1:8188`);
  config.comfyuiServerAddress = "http://127.0.0.1:8188";
}

// Remove trailing slash if present
config.comfyuiServerAddress = config.comfyuiServerAddress.replace(/\/$/, "");


export default config;
