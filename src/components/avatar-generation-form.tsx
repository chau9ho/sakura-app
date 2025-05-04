
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // Import RadioGroup
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { generateAvatarPrompt } from '@/ai/flows/generate-avatar-prompt';
import { Loader2, Upload, Camera, Sparkles, Wand2 } from 'lucide-react'; // Added Wand2
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Import Tooltip components
import { cn } from "@/lib/utils"; // Import cn utility

// Define the type for image options passed as props
export interface ImageOption {
  id: string;
  name: string;
  src: string; // Changed from 'image' to 'src' to match fetched data
  description: string;
  dataAiHint: string;
}

// Define props for the component
interface AvatarGenerationFormProps {
  kimonos: ImageOption[];
  backgrounds: ImageOption[];
}

const formSchema = z.object({
  photo: z.any().refine(fileOrDataUrl => fileOrDataUrl instanceof File || (typeof fileOrDataUrl === 'string' && fileOrDataUrl.startsWith('data:image/')), {
    message: "請上載或影張相。",
  }),
  kimono: z.string().min(1, { message: "請揀一件和服。" }), // Store the ID (filename)
  background: z.string().min(1, { message: "請揀一個背景。" }), // Store the ID (filename)
  userDescription: z.string().max(150, { message: "描述唔可以超過150個字。" }).optional(),
});


export default function AvatarGenerationForm({ kimonos = [], backgrounds = [] }: AvatarGenerationFormProps) {
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
        form.setValue("photo", dataUrl); // Set form value to data URL string
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
        // Find the selected item details using the ID (filename) stored in the form values
        const selectedKimono = kimonos.find(k => k.id === values.kimono);
        const selectedBackground = backgrounds.find(b => b.id === values.background);

        if (!selectedKimono || !selectedBackground) {
          toast({
             title: "選擇錯誤",
             description: "請確認你已經選擇咗和服同背景。",
             variant: "destructive",
          });
          clearInterval(interval);
          setProgress(0);
          return; // Stop submission if items not found
        }

        // 1. Generate Prompt using AI Flow
        setProgress(10);
        const promptResult = await generateAvatarPrompt({
          kimono: selectedKimono.description, // Pass description to the flow
          background: selectedBackground.description, // Pass description to the flow
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4"> {/* Reduced space-y */}

        {/* Photo Input */}
         <FormField
          control={form.control}
          name="photo"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base font-semibold">你嘅相</FormLabel> {/* Slightly smaller label */}
              <FormControl>
                <div className="flex flex-col sm:flex-row gap-3 items-start"> {/* Reduced gap */}
                  <div className="flex-1 space-y-2">
                     <div className="relative w-full aspect-[4/3] border border-dashed border-primary/50 rounded-lg flex items-center justify-center bg-secondary/50 overflow-hidden"> {/* Changed aspect ratio */}
                        {selectedPhotoPreview ? (
                        <Image
                            src={selectedPhotoPreview}
                            alt="已選相片預覽"
                            layout="fill"
                            objectFit="contain"
                         />
                        ) : isCapturing ? (
                             <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                        ) : (
                            <div className="text-center text-muted-foreground p-3"> {/* Reduced padding */}
                                <Upload className="mx-auto h-8 w-8 mb-1" /> {/* Smaller icon */}
                                <span className="text-sm">上載或影張相</span> {/* Smaller text */}
                            </div>
                        )}
                        {!isCapturing && <video ref={videoRef} className="absolute w-px h-px opacity-0 pointer-events-none" playsInline muted />}
                     </div>
                     <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

                     {/* Action Buttons */}
                      <div className="flex gap-2">
                          {!isCapturing ? (
                            <>
                              <Button type="button" variant="outline" className="flex-1 relative text-xs h-8 px-2"> {/* Compact button */}
                                 <Upload className="mr-1 h-3.5 w-3.5" />
                                 上載相片
                                 <Input
                                    type="file"
                                    accept="image/*"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={handlePhotoChange}
                                  />
                              </Button>
                              <Button type="button" variant="outline" className="flex-1 text-xs h-8 px-2" onClick={startCamera}> {/* Compact button */}
                                <Camera className="mr-1 h-3.5 w-3.5" />
                                即刻影相
                              </Button>
                            </>
                          ) : (
                             <>
                              <Button type="button" variant="secondary" className="flex-1 text-xs h-8 px-2" onClick={stopCamera}>
                                取消
                              </Button>
                              <Button type="button" variant="default" className="flex-1 text-xs h-8 px-2" onClick={capturePhoto}>
                                 影啦！
                              </Button>
                             </>
                          )}
                       </div>
                   </div>
                </div>
              </FormControl>
              <FormDescription className="text-xs">
                上載張清啲嘅相，或者用相機即刻影返張。
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />


        {/* Kimono Selector Grid */}
        <FormField
          control={form.control}
          name="kimono"
          render={({ field }) => (
            <FormItem className="space-y-1"> {/* Reduced space */}
              <FormLabel className="text-base font-semibold">揀件和服👘</FormLabel>
              <FormDescription className="text-xs">
                揀件和服俾你個頭像着啦。mouse hover可以放大睇㗎！
              </FormDescription>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 pt-1" // Responsive grid layout
                >
                  {kimonos.map((kimono) => (
                    <FormItem key={kimono.id} className="relative">
                      <FormControl>
                        <TooltipProvider delayDuration={100}>
                           <Tooltip>
                              <TooltipTrigger asChild>
                                  <RadioGroupItem value={kimono.id} id={`kimono-${kimono.id}`} className="sr-only peer" />
                              </TooltipTrigger>
                               <TooltipContent side="bottom" className="p-0 border-none bg-transparent shadow-xl max-w-xs">
                                 <Image
                                    src={kimono.src}
                                    alt={kimono.name}
                                    width={200} // Larger preview size
                                    height={200}
                                    className="rounded-md object-cover"
                                    data-ai-hint={kimono.dataAiHint}
                                  />
                                  <p className="mt-1 text-center text-sm font-medium bg-background/90 backdrop-blur-sm px-2 py-1 rounded-b-md">
                                     {kimono.name}
                                  </p>
                               </TooltipContent>
                            </Tooltip>
                         </TooltipProvider>
                      </FormControl>
                      <FormLabel
                        htmlFor={`kimono-${kimono.id}`}
                        className={cn(
                          "block cursor-pointer rounded-md border-2 border-muted bg-popover transition-all duration-150 ease-in-out",
                          "hover:border-accent hover:shadow-md",
                          "peer-data-[state=checked]:border-primary peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-primary/50 peer-data-[state=checked]:shadow-lg" // Styling for selected item
                        )}
                      >
                        <div className="aspect-square overflow-hidden rounded-t-md">
                           <Image
                            src={kimono.src}
                            alt={kimono.name}
                            width={100}
                            height={100}
                            className="h-full w-full object-cover transition-transform duration-200 hover:scale-105"
                            data-ai-hint={kimono.dataAiHint}
                          />
                        </div>
                        <p className="truncate text-xs font-medium text-center p-1 bg-muted/50 rounded-b-md">{kimono.name}</p>
                      </FormLabel>
                    </FormItem>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />


        {/* Background Selector Grid */}
        <FormField
          control={form.control}
          name="background"
          render={({ field }) => (
            <FormItem className="space-y-1"> {/* Reduced space */}
              <FormLabel className="text-base font-semibold">揀個背景🏞️</FormLabel>
              <FormDescription className="text-xs">
                 揀個背景襯托你嘅頭像。mouse hover可以放大睇㗎！
              </FormDescription>
              <FormControl>
                 <RadioGroup
                   onValueChange={field.onChange}
                   defaultValue={field.value}
                   className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 pt-1" // Responsive grid layout
                 >
                   {backgrounds.map((bg) => (
                     <FormItem key={bg.id} className="relative">
                       <FormControl>
                          <TooltipProvider delayDuration={100}>
                             <Tooltip>
                               <TooltipTrigger asChild>
                                  <RadioGroupItem value={bg.id} id={`bg-${bg.id}`} className="sr-only peer" />
                               </TooltipTrigger>
                               <TooltipContent side="bottom" className="p-0 border-none bg-transparent shadow-xl max-w-xs">
                                   <Image
                                    src={bg.src}
                                    alt={bg.name}
                                    width={200} // Larger preview size
                                    height={200}
                                    className="rounded-md object-cover"
                                    data-ai-hint={bg.dataAiHint}
                                   />
                                   <p className="mt-1 text-center text-sm font-medium bg-background/90 backdrop-blur-sm px-2 py-1 rounded-b-md">
                                      {bg.name}
                                   </p>
                               </TooltipContent>
                             </Tooltip>
                          </TooltipProvider>
                       </FormControl>
                       <FormLabel
                         htmlFor={`bg-${bg.id}`}
                         className={cn(
                            "block cursor-pointer rounded-md border-2 border-muted bg-popover transition-all duration-150 ease-in-out",
                            "hover:border-accent hover:shadow-md",
                            "peer-data-[state=checked]:border-primary peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-primary/50 peer-data-[state=checked]:shadow-lg" // Styling for selected item
                         )}
                       >
                          <div className="aspect-video overflow-hidden rounded-t-md"> {/* Use aspect-video for backgrounds */}
                              <Image
                               src={bg.src}
                               alt={bg.name}
                               width={160} // Adjust size if needed
                               height={90}
                               className="h-full w-full object-cover transition-transform duration-200 hover:scale-105"
                               data-ai-hint={bg.dataAiHint}
                              />
                           </div>
                           <p className="truncate text-xs font-medium text-center p-1 bg-muted/50 rounded-b-md">{bg.name}</p>
                       </FormLabel>
                     </FormItem>
                   ))}
                 </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

         {/* User Description (Optional) */}
         <FormField
           control={form.control}
           name="userDescription"
           render={({ field }) => (
             <FormItem className="space-y-1"> {/* Reduced space */}
               <FormLabel className="text-base font-semibold">加啲細節（可以唔填）</FormLabel>
               <FormControl>
                 <Textarea
                   placeholder="例如：戴眼鏡、微笑、揸住把扇..."
                   className="resize-none text-sm h-16" // shorter textarea
                   rows={2}
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
        <div className="space-y-2 pt-2"> {/* Reduced space-y, added pt */}
           <Button type="submit" disabled={isPending} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground h-10 text-base"> {/* Slightly smaller button */}
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {/* Smaller loader */}
                  生成緊...
                </>
              ) : (
                 <>
                   <Wand2 className="mr-2 h-5 w-5" />
                   施展魔法！生成頭像
                 </>
              )}
            </Button>
            {isPending && (
              <div className="space-y-1">
                 <Progress value={progress} className="w-full [&>div]:bg-accent h-1.5" /> {/* Thinner progress bar */}
                 <p className="text-xs text-center text-muted-foreground">努力生成緊你嘅頭像，等等啊...</p>
               </div>
            )}
        </div>


        {/* Generated Image Display */}
        {generatedImageUrl && !isPending && ( // Only show when not pending
          <Card className="mt-4 border-accent/50"> {/* Reduced mt */}
            <CardContent className="p-3"> {/* Reduced padding */}
               <Alert variant="default" className="mb-2 border-accent bg-accent/10 p-3"> {/* Reduced margin/padding */}
                  <Sparkles className="h-4 w-4 text-accent" />
                  <AlertTitle className="text-accent font-semibold text-sm">搞掂！✨</AlertTitle> {/* Smaller title */}
                  <AlertDescription className="text-xs">
                    你嘅靚靚櫻花頭像整好喇！右掣或者長按就可以儲存。
                  </AlertDescription>
                </Alert>
              <div className="aspect-square relative w-full max-w-sm mx-auto rounded-lg overflow-hidden shadow-md"> {/* Slightly smaller max-w */}
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
                    className="w-full mt-3 text-sm h-9" // Reduced mt
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
