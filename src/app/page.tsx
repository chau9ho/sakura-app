import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AvatarGenerationForm from '@/components/avatar-generation-form';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info, Stars } from "lucide-react"; // Using Stars for a more anime feel

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center space-y-6"> {/* Reduced space-y */}
       <h1 className="text-4xl font-bold text-center text-primary animate-pulse">
         🌸 櫻の畫室 🌸
       </h1>
       <p className="text-center text-muted-foreground text-lg max-w-2xl">
         捕捉春天嘅氣息！上載你嘅靚相，揀件靚靚和服👘同埋夢幻背景，等我哋嘅AI幫你創造獨一無二嘅櫻花主題頭像啦！✨
       </p>

       <Alert className="max-w-3xl w-full bg-secondary border-primary/50">
          <Stars className="h-4 w-4 text-primary" /> {/* Changed icon */}
          <AlertTitle className="text-primary font-semibold">點樣玩？</AlertTitle>
          <AlertDescription>
            <ol className="list-decimal list-inside space-y-1 text-foreground/80">
              <li>上載或者即刻影張靚相 📸</li>
              <li>喺我哋嘅收藏入面揀件心水和服～</li>
              <li>揀一個勁靚嘅背景 🏞️</li>
              <li>（可以唔填）加少少描述，等AI更get到你想要咩！</li>
              <li>撳「生成頭像！」然後見證魔法發生！🪄</li>
            </ol>
          </AlertDescription>
        </Alert>


      <Card className="w-full max-w-3xl shadow-lg border-primary/30">
        <CardHeader className="pb-4"> {/* Reduced pb */}
          <CardTitle className="text-2xl text-center text-primary/90">整你嘅專屬頭像</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0"> {/* Reduced p */}
          <AvatarGenerationForm />
        </CardContent>
      </Card>

    </div>
  );
}
