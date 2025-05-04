
import React from 'react';
import Image from 'next/image';
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Sparkles } from 'lucide-react';

interface GeneratedAvatarDisplayProps {
  imageUrl: string;
  onReset: () => void;
}

const GeneratedAvatarDisplay: React.FC<GeneratedAvatarDisplayProps> = ({ imageUrl, onReset }) => {
  return (
    <Card className="mt-3 mx-2 border-accent/50">
      <CardContent className="p-2">
        <Alert variant="default" className="mb-1.5 border-accent bg-accent/10 p-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <AlertTitle className="text-accent font-semibold text-sm">搞掂！✨</AlertTitle>
          <AlertDescription className="text-xs text-foreground/80">
            你嘅靚靚櫻花頭像整好喇！右掣或者長按就可以儲存。
          </AlertDescription>
        </Alert>
        <div className="aspect-square relative w-full max-w-[300px] mx-auto rounded-lg overflow-hidden shadow-md">
          <Image
            src={imageUrl}
            alt="生成嘅頭像"
            fill
            sizes="(max-width: 640px) 80vw, 300px" // Responsive sizes
            className="object-cover"
            data-ai-hint="generated avatar portrait"
            priority // Prioritize loading the result image
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-2 text-sm h-9"
          onClick={onReset}
        >
          再整一個！
        </Button>
      </CardContent>
    </Card>
  );
};

export default GeneratedAvatarDisplay;
    