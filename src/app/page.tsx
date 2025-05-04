import React from 'react';
import fs from 'fs/promises';
import path from 'path';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AvatarGenerationForm, { type ImageOption } from '@/components/avatar-generation-form'; // Import ImageOption type
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info, Stars } from "lucide-react"; // Using Stars for a more anime feel

// Helper function to read images from a directory
async function getDirectoryImages(dirPath: string, publicPath: string): Promise<ImageOption[]> {
  try {
    const directory = path.join(process.cwd(), 'public', dirPath);
    const filenames = await fs.readdir(directory);
    return filenames
      .filter(name => /\.(jpg|jpeg|png|webp)$/i.test(name)) // Filter for image files
      .map((name, index) => {
         const id = name; // Use filename as ID
         // Basic name generation: remove extension, replace underscores/hyphens
         const displayName = name.replace(/\.[^/.]+$/, "").replace(/[_-\s]+/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        return {
          id: id,
          name: displayName,
          src: path.join('/', publicPath, name), // Use the public path for src
          // Add a placeholder description or derive if possible
          description: `${displayName} style`,
          // Add placeholder data-ai-hint or derive if needed
          dataAiHint: displayName.toLowerCase().split(' ').slice(0, 2).join(' '),
        };
      });
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
    return []; // Return empty array on error
  }
}


export default async function Home() {
  // Fetch images from public directories
  const kimonos = await getDirectoryImages('Kimono', 'Kimono');
  const backgrounds = await getDirectoryImages('background', 'background'); // Corrected directory name

  return (
    <div className="flex flex-col items-center justify-center space-y-4"> {/* Reduced space-y */}
       <h1 className="text-4xl font-bold text-center text-primary animate-pulse">
         🌸 櫻の畫室 🌸
       </h1>
       <p className="text-center text-foreground/90 text-lg max-w-2xl"> {/* Changed text-muted-foreground */}
         捕捉春天嘅氣息！上載你嘅靚相，揀件靚靚和服👘同埋夢幻背景，等我哋嘅AI幫你創造獨一無二嘅櫻花主題頭像啦！✨
       </p>

       <Alert className="max-w-3xl w-full bg-secondary border-primary/50">
          <Stars className="h-4 w-4 text-primary" /> {/* Changed icon */}
          <AlertTitle className="text-primary font-semibold">點樣玩？</AlertTitle>
          <AlertDescription>
            <ol className="list-decimal list-inside space-y-1 text-foreground/80 text-sm"> {/* Kept text-foreground/80 */}
              <li>上載或者即刻影張靚相 📸</li>
              <li>喺下面揀件心水和服～ 👇</li>
              <li>再揀一個勁靚嘅背景 🏞️</li>
              <li>（可以唔填）加少少描述，等AI更get到你想要咩！</li>
              <li>撳「施展魔法！」然後見證魔法發生！🪄</li>
            </ol>
          </AlertDescription>
        </Alert>


      <Card className="w-full max-w-3xl shadow-lg border-primary/30">
        <CardHeader className="pb-2"> {/* Further reduced pb */}
          <CardTitle className="text-xl text-center text-primary/90">整你嘅專屬頭像</CardTitle> {/* Smaller title */}
        </CardHeader>
        <CardContent className="p-4 pt-2"> {/* Reduced padding */}
          {/* Pass fetched images to the form */}
          <AvatarGenerationForm kimonos={kimonos} backgrounds={backgrounds} />
        </CardContent>
      </Card>

    </div>
  );
}
