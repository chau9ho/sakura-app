
// src/config.ts

interface Config {
  comfyuiServerAddress: string;
  // Add other configurable settings here if needed
}

const config: Config = {
  // Default to localhost, but use environment variable if available
  comfyuiServerAddress: process.env.COMFYUI_SERVER_ADDRESS || "http://192.168.50.144:8188", // Updated default address
};

// Validate address format (basic check)
if (!config.comfyuiServerAddress.startsWith('http://') && !config.comfyuiServerAddress.startsWith('https://')) {
  console.error(`Invalid COMFYUI_SERVER_ADDRESS format: ${config.comfyuiServerAddress}. Ensure it starts with http:// or https://`);
  config.comfyuiServerAddress = "http://192.168.50.144:8188"; // Revert to a default on invalid format
}

// Remove trailing slash if present
config.comfyuiServerAddress = config.comfyuiServerAddress.replace(/\/$/, "");

// Log the configured server address (after validation and cleanup)
console.log(`Using ComfyUI Server Address: ${config.comfyuiServerAddress}`); // Log the address being used

export default config;

