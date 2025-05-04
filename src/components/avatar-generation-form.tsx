
"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { generateAvatarPrompt } from '@/ai/flows/generate-avatar-prompt';
import { Loader2, Upload, Camera, Sparkles, Wand2 } from 'lucide-react'; // Added Wand2
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Import Tooltip components

// More diverse and anime-inspired options
const kimonos = [
  { id: 'k1', name: '經典粉櫻', description: '傳統粉紅色櫻花圖案和服', image: 'https://picsum.photos/100/100?random=1' , dataAiHint: 'pink sakura kimono' },
  { id: 'k2', name: '優雅藍浪', description: '深藍色配上藝術感波浪紋和服', image: 'https://picsum.photos/100/100?random=2', dataAiHint: 'blue wave kimono' },
  { id: 'k3', name: '華麗金鶴', description: '奢華金白色配仙鶴圖案和服', image: 'https://picsum.photos/100/100?random=3', dataAiHint: 'gold crane kimono' },
  { id: 'k4', name: '春綠竹影', description: '淺綠色配雅緻竹葉圖案和服', image: 'https://picsum.photos/100/100?random=4', dataAiHint: 'green bamboo kimono' },
  { id: 'k5', name: '魔法少女星願', description: '閃亮星星同絲帶裝飾嘅魔法少女風和服', image: 'https://picsum.photos/100/100?random=9', dataAiHint: 'magical girl star kimono' },
  { id: 'k6', name: '賽博武士赤紅', description: '未來感線條同霓虹燈效果嘅武士風和服', image: 'https://picsum.photos/100/100?random=10', dataAiHint: 'cyberpunk samurai kimono' },
  { id: 'k7', name: '暗夜蝶舞', description: '深紫色配上神秘蝴蝶圖案嘅和服', image: 'https://picsum.photos/100/100?random=11', dataAiHint: 'dark butterfly kimono' },
];

const backgrounds = [
  { id: 'b1', name: '櫻花公園小徑', description: '寧靜嘅公園小徑，兩旁開滿櫻花樹', image: 'https://picsum.photos/100/100?random=5', dataAiHint: 'sakura park path' },
  { id: 'b2', name: '山頂寺廟景觀', description: '傳統寺廟，俯瞰雲霧繚繞嘅山巒', image: 'https://picsum.photos/100/100?random=6', dataAiHint: 'mountain temple view' },
  { id: 'b3', name: '夜祭燈籠街', description: '充滿活力嘅夜市祭典，掛滿發光燈籠', image: 'https://picsum.photos/100/100?random=7', dataAiHint: 'night festival lanterns' },
  { id: 'b4', name: '禪意庭園小橋', description: '寧靜嘅禪意庭園，有木橋橫跨錦鯉池', image: 'https://picsum.photos/100/100?random=8', dataAiHint: 'zen garden bridge' },
  { id: 'b5', name: '異世界漂浮島', description: '懸浮喺空中嘅奇幻島嶼，有瀑布流下', image: 'https://picsum.photos/100/100?random=12', dataAiHint: 'fantasy floating island' },
  { id: 'b6', name: '星空下的鳥居', description: '喺璀璨星空下嘅神秘紅色鳥居', image: 'https://picsum.photos/100/100?random=13', dataAiHint: 'starry sky torii gate' },
  { id: 'b7', name: '蒸汽龐克都市', description: '充滿齒輪、管道同飛行船嘅復古未來都市', image: 'https://picsum.photos/100/100?random=14', dataAiHint: 'steampunk city' },
];

const formSchema = z.object({
  photo: z.any().refine(file => file instanceof File || typeof file === 'string', {
    message: "請上載或影張相。",
  }),
  kimono: z.string().min(1, { message: "請揀一件和服。" }),
  background: z.string().min(1, { message: "請揀一個背景。" }),
  userDescription: z.string().max(150, { message: "描述唔可以超過150個字。" }).optional(),
});

// Helper component for displaying selectable image with tooltip zoom
const SelectableImageItem = ({ item, type }: { item: { id: string, name: string, description: string, image: string, dataAiHint: string }, type: 'kimono' | 'background' }) => (
  <SelectItem key={item.id} value={item.id}>
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 py-1 cursor-pointer">
            <Image
              src={item.image}
              alt={item.name}
              width={36} // Slightly smaller thumbnail
              height={36}
              className="rounded-sm shrink-0"
              data-ai-hint={item.dataAiHint}
            />
            <div className="flex-1 min-w-0"> {/* Ensure text doesn't overflow */}
              <p className="font-medium text-sm truncate">{item.name}</p> {/* Truncate long names */}
              {/* <p className="text-xs text-muted-foreground truncate">{item.description}</p> */} {/* Optionally hide description in dropdown */}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="p-0 border-none bg-transparent shadow-xl">
          <Image
            src={item.image}
            alt={item.name}
            width={200} // Larger preview size
            height={200}
            className="rounded-md"
            data-ai-hint={item.dataAiHint}
          />
          <p className="mt-1 text-center text-sm font-medium bg-background/80 backdrop-blur-sm px-2 py-1 rounded-b-md">{item.name}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </SelectItem>
);


export default function AvatarGenerationForm() {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      photo: undefined,
      kimono: "",
      background: "",
      userDescription: "",
    },
  });

  // Handle photo selection for preview
  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      form.setValue("photo", file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setIsCapturing(false); // Ensure camera is off if file is uploaded
      stopCamera();
    } else {
        form.setValue("photo", undefined);
        setSelectedPhotoPreview(null);
    }
  };

  // Start camera capture
  const startCamera = async () => {
    setIsCapturing(true);
    setSelectedPhotoPreview(null); // Clear file upload preview
    form.setValue("photo", undefined); // Clear file upload value
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // videoRef.current.play(); // play() is called by autoPlay prop
        }
      } catch (err) {
        console.error("影相機出錯: ", err);
        toast({
          title: "相機錯誤",
          description: "開唔到相機，請確保你已經俾咗權限。",
          variant: "destructive",
        });
        setIsCapturing(false);
      }
    } else {
       toast({
          title: "相機錯誤",
          description: "你嘅瀏覽器唔支援影相功能。",
          variant: "destructive",
        });
        setIsCapturing(false);
    }
  };

  // Capture photo from video stream
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current && isCapturing) {
      const context = canvasRef.current.getContext('2d');
      const video = videoRef.current;
      if (context && video.readyState >= video.HAVE_CURRENT_DATA) { // Check if video data is available
        // Set canvas dimensions based on video aspect ratio
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        canvasRef.current.width = videoWidth;
        canvasRef.current.height = videoHeight;

        context.drawImage(video, 0, 0, videoWidth, videoHeight);
        const dataUrl = canvasRef.current.toDataURL('image/png');
        setSelectedPhotoPreview(dataUrl); // Show captured photo preview
        form.setValue("photo", dataUrl); // Set form value to data URL
        stopCamera(); // Stop camera after capture
      } else {
         toast({
          title: "影相失敗",
          description: "未能成功影相，請再試一次。",
          variant: "destructive",
        });
      }
    }
  };

   // Stop camera stream
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCapturing(false);
  };

  // Cleanup camera on component unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);


  function onSubmit(values: z.infer<typeof formSchema>) {
    startTransition(async () => {
      setGeneratedImageUrl(null);
      setProgress(0);

      // Simulate progress
      const interval = setInterval(() => {
        setProgress((prev) => (prev >= 95 ? 95 : prev + 5));
      }, 300); // Faster progress simulation

      try {
        const selectedKimono = kimonos.find(k => k.id === values.kimono);
        const selectedBackground = backgrounds.find(b => b.id === values.background);

        if (!selectedKimono || !selectedBackground) {
          throw new Error("揀嘅和服或者背景唔啱。");
        }

        // 1. Generate Prompt using AI Flow
         setProgress(10);
        const promptResult = await generateAvatarPrompt({
          kimono: selectedKimono.description,
          background: selectedBackground.description,
          userDescription: values.userDescription,
        });
         setProgress(30);

         console.log("生成嘅提示:", promptResult.prompt);
         toast({
            title: "提示已生成",
            description: `用緊呢個提示: ${promptResult.prompt.substring(0, 50)}...`,
         });


        // 2. TODO: Integrate with actual image generation API
        // Placeholder simulation
        console.log("模擬緊圖像生成，用咗:", {
          prompt: promptResult.prompt,
          photo: values.photo instanceof File ? values.photo.name : "影咗嘅相",
        });

        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 2000)); // Shorter delay
         setProgress(90);


        // Replace with actual generated image URL from the API response
        const simulatedImageUrl = `https://picsum.photos/512/512?random=${Date.now()}`;
        setGeneratedImageUrl(simulatedImageUrl);
        setProgress(100);

        toast({
          title: "頭像生成完成！",
          description: "你獨一無二嘅櫻花頭像整好喇。",
        });

      } catch (error) {
        console.error("生成頭像出錯:", error);
        toast({
          title: "生成失敗",
          description: error instanceof Error ? error.message : "發生咗啲意料之外嘅錯誤。",
          variant: "destructive",
        });
         setProgress(0); // Reset progress on error
      } finally {
         clearInterval(interval); // Clear progress interval
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6"> {/* Reduced space-y */}

        {/* Photo Input */}
         <FormField
          control={form.control}
          name="photo"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-lg font-semibold">你嘅相</FormLabel>
              <FormControl>
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="flex-1 space-y-2">
                     <div className="relative w-full aspect-video border border-dashed border-primary/50 rounded-lg flex items-center justify-center bg-secondary/50 overflow-hidden">
                        {selectedPhotoPreview ? (
                        <Image
                            src={selectedPhotoPreview}
                            alt="已選相片預覽"
                            layout="fill"
                            objectFit="contain"
                         />
                        ) : isCapturing ? (
                            // Ensure video tag is always rendered for the ref
                             <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                        ) : (
                            <div className="text-center text-muted-foreground p-4">
                                <Upload className="mx-auto h-10 w-10 mb-2" /> {/* Smaller icon */}
                                <span>上載或影張相</span>
                            </div>
                        )}
                        {/* Always render video tag for ref, hide if not capturing */}
                        {!isCapturing && <video ref={videoRef} className="absolute w-px h-px opacity-0 pointer-events-none" playsInline muted />}
                     </div>
                      {/* Hidden canvas for capturing photo */}
                     <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

                     {/* Action Buttons */}
                      <div className="flex gap-2">
                          {!isCapturing ? (
                            <>
                              <Button type="button" variant="outline" className="flex-1 relative text-sm h-9"> {/* Compact button */}
                                 <Upload className="mr-1.5 h-4 w-4" />
                                 上載相片
                                 <Input
                                    type="file"
                                    accept="image/*"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={handlePhotoChange}
                                  />
                              </Button>
                              <Button type="button" variant="outline" className="flex-1 text-sm h-9" onClick={startCamera}> {/* Compact button */}
                                <Camera className="mr-1.5 h-4 w-4" />
                                即刻影相
                              </Button>
                            </>
                          ) : (
                             <>
                              <Button type="button" variant="secondary" className="flex-1 text-sm h-9" onClick={stopCamera}> {/* Changed Cancel to secondary */}
                                取消
                              </Button>
                              <Button type="button" variant="default" className="flex-1 text-sm h-9" onClick={capturePhoto}>
                                 影啦！
                              </Button>
                             </>
                          )}
                       </div>
                   </div>
                </div>
              </FormControl>
              <FormDescription className="text-xs"> {/* Smaller description */}
                上載張清啲嘅相，或者用相機即刻影返張。
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />


        {/* Kimono Selector */}
        <FormField
          control={form.control}
          name="kimono"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-lg font-semibold">揀件和服👘</FormLabel>
                 <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="揀你鍾意嘅和服款式" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                       {kimonos.map((kimono) => (
                         <SelectableImageItem key={kimono.id} item={kimono} type="kimono" />
                       ))}
                    </SelectContent>
                 </Select>
              <FormDescription className="text-xs">
                揀件和服俾你個頭像着啦。mouse hover可以放大睇㗎！
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Background Selector */}
        <FormField
          control={form.control}
          name="background"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-lg font-semibold">揀個背景🏞️</FormLabel>
               <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="揀個靚靚背景" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                       {backgrounds.map((bg) => (
                         <SelectableImageItem key={bg.id} item={bg} type="background" />
                       ))}
                    </SelectContent>
                  </Select>
              <FormDescription className="text-xs">
                揀個背景襯托你嘅頭像。mouse hover可以放大睇㗎！
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

         {/* User Description (Optional) */}
         <FormField
           control={form.control}
           name="userDescription"
           render={({ field }) => (
             <FormItem>
               <FormLabel className="text-lg font-semibold">加啲細節（可以唔填）</FormLabel>
               <FormControl>
                 <Textarea
                   placeholder="例如：戴眼鏡、微笑、揸住把扇..."
                   className="resize-none text-sm" // smaller text
                   rows={2} // shorter textarea
                   {...field}
                 />
               </FormControl>
               <FormDescription className="text-xs">
                 加少少描述，等個頭像更加獨特（最多150字）。
               </FormDescription>
               <FormMessage />
             </FormItem>
           )}
         />


         {/* Submit Button & Progress */}
        <div className="space-y-3"> {/* Reduced space-y */}
           <Button type="submit" disabled={isPending} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground h-11 text-base"> {/* Larger button */}
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  生成緊...
                </>
              ) : (
                 <>
                   <Wand2 className="mr-2 h-5 w-5" /> {/* Changed Icon */}
                   施展魔法！生成頭像
                 </>
              )}
            </Button>
            {isPending && (
              <div className="space-y-1"> {/* Reduced space-y */}
                 <Progress value={progress} className="w-full [&>div]:bg-accent h-2" /> {/* Thinner progress bar */}
                 <p className="text-xs text-center text-muted-foreground">努力生成緊你嘅頭像，等等啊...</p>
               </div>
            )}
        </div>


        {/* Generated Image Display */}
        {generatedImageUrl && !isPending && ( // Only show when not pending
          <Card className="mt-6 border-accent/50"> {/* Reduced mt */}
            <CardContent className="p-4">
               <Alert variant="default" className="mb-3 border-accent bg-accent/10"> {/* Reduced mb */}
                  <Sparkles className="h-4 w-4 text-accent" />
                  <AlertTitle className="text-accent font-semibold">搞掂！✨</AlertTitle>
                  <AlertDescription className="text-xs"> {/* Smaller text */}
                    你嘅靚靚櫻花頭像整好喇！右掣或者長按就可以儲存。
                  </AlertDescription>
                </Alert>
              <div className="aspect-square relative w-full max-w-md mx-auto rounded-lg overflow-hidden shadow-md">
                <Image
                  src={generatedImageUrl}
                  alt="生成嘅頭像"
                  layout="fill"
                  objectFit="cover"
                  data-ai-hint="generated avatar portrait"
                />
              </div>
               <Button
                    variant="outline"
                    className="w-full mt-4 text-sm h-9"
                    onClick={() => {
                        setGeneratedImageUrl(null); // Clear image
                        form.reset(); // Reset form
                        setSelectedPhotoPreview(null); // Clear preview
                     }}
                    >
                    再整一個！
                </Button>
            </CardContent>
          </Card>
        )}
      </form>
    </Form>
  );
}
