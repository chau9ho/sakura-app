import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AvatarGenerationForm from '@/components/avatar-generation-form';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center space-y-8">
       <h1 className="text-4xl font-bold text-center text-primary">
        🌸 Sakura Studio 🌸
      </h1>
      <p className="text-center text-muted-foreground text-lg max-w-2xl">
        Capture the essence of spring! Upload your photo, choose a beautiful kimono and a scenic background, and let our AI create a unique sakura-themed avatar for you.
      </p>

       <Alert className="max-w-3xl w-full bg-secondary border-primary/50">
          <Info className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary font-semibold">How it Works</AlertTitle>
          <AlertDescription>
            <ol className="list-decimal list-inside space-y-1 text-foreground/80">
              <li>Upload or capture your photo.</li>
              <li>Select a Kimono style from our collection.</li>
              <li>Choose a picturesque Background.</li>
              <li>Optionally, add a short description to guide the AI.</li>
              <li>Click "Generate Avatar" and watch the magic happen! ✨</li>
            </ol>
          </AlertDescription>
        </Alert>


      <Card className="w-full max-w-3xl shadow-lg border-primary/30">
        <CardHeader>
          <CardTitle className="text-2xl text-center text-primary/90">Create Your Avatar</CardTitle>
        </CardHeader>
        <CardContent>
          <AvatarGenerationForm />
        </CardContent>
      </Card>

    </div>
  );
}
