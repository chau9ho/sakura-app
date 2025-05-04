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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { generateAvatarPrompt } from '@/ai/flows/generate-avatar-prompt';
import { Loader2, Upload, Camera, Sparkles, Wand2, Image as ImageIcon, Shirt, Trees, Pencil, CheckCircle2 } from 'lucide-react'; // Added relevant icons
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"; // Import Accordion components
import { cn } from "@/lib/utils";

// Define the type for image options passed as props
export interface ImageOption {
  id: string;
  name: string;
  src: string;
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
  kimono: z.string().min(1, { message: "請揀一件和服。" }),
  background: z.string().min(1, { message: "請揀一個背景。" }),
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

   // Watch form values to enable/disable accordion items and show checkmarks
  const watchedPhoto = form.watch("photo");
  const watchedKimono = form.watch("kimono");
  const watchedBackground = form.watch("background");

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
      if (context && video.readyState >= video.HAVE_CURRENT_DATA) {
        // Set canvas dimensions based on video aspect ratio for capture
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        // Use a smaller dimension for capture if needed, maintaining aspect ratio
        const captureWidth = 480; // Example smaller width
        const captureHeight = (videoHeight / videoWidth) * captureWidth;
        canvasRef.current.width = captureWidth;
        canvasRef.current.height = captureHeight;

        context.drawImage(video, 0, 0, captureWidth, captureHeight); // Draw smaller image
        const dataUrl = canvasRef.current.toDataURL('image/png');
        setSelectedPhotoPreview(dataUrl);
        form.setValue("photo", dataUrl);
        stopCamera();
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

      const interval = setInterval(() => {
        setProgress((prev) => (prev >= 95 ? 95 : prev + 5));
      }, 300);

      try {
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
          return;
        }

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


        console.log("模擬緊圖像生成，用咗:", {
          prompt: promptResult.prompt,
          photo: values.photo instanceof File ? values.photo.name : "影咗嘅相",
        });

        await new Promise(resolve => setTimeout(resolve, 2000));
         setProgress(90);

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
         setProgress(0);
      } finally {
         clearInterval(interval);
      }
    });
  }

  return (
    <TooltipProvider delayDuration={100}>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2"> {/* Reduced space-y */}

        <Accordion type="single" collapsible defaultValue="photo-section" className="w-full space-y-1">

           {/* --- Photo Section --- */}
           <AccordionItem value="photo-section">
             <AccordionTrigger className="text-base font-semibold hover:no-underline px-2 py-2 rounded-md hover:bg-secondary/50 data-[state=open]:bg-secondary/80">
                <span className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                   步驟一：你嘅相
                   {watchedPhoto && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                </span>
             </AccordionTrigger>
             <AccordionContent className="pt-1 pb-2 px-2">
                <FormField
                  control={form.control}
                  name="photo"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="flex flex-col sm:flex-row gap-2 items-start">
                          <div className="flex-1 space-y-1">
                             {/* Reduced size: aspect-square and max-w-xs */}
                             <div className="relative w-full max-w-xs mx-auto aspect-square border border-dashed border-primary/50 rounded-lg flex items-center justify-center bg-secondary/50 overflow-hidden">
                                {selectedPhotoPreview ? (
                                <Image
                                    src={selectedPhotoPreview}
                                    alt="已選相片預覽"
                                    fill
                                    objectFit="contain"
                                 />
                                ) : isCapturing ? (
                                     <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                                ) : (
                                    <div className="text-center text-foreground/80 p-2">
                                        <Upload className="mx-auto h-6 w-6 mb-1" />
                                        <span className="text-xs">上載或影張相</span>
                                    </div>
                                )}
                                {!isCapturing && <video ref={videoRef} className="absolute w-px h-px opacity-0 pointer-events-none" playsInline muted />}
                             </div>
                             <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

                              <div className="flex gap-1.5 max-w-xs mx-auto">
                                  {!isCapturing ? (
                                    <>
                                      <Button type="button" variant="outline" size="sm" className="flex-1 relative text-xs h-8 px-2">
                                         <Upload className="mr-1 h-3.5 w-3.5" />
                                         上載
                                         <Input
                                            type="file"
                                            accept="image/*"
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            onChange={handlePhotoChange}
                                          />
                                      </Button>
                                      <Button type="button" variant="outline" size="sm" className="flex-1 text-xs h-8 px-2" onClick={startCamera}>
                                        <Camera className="mr-1 h-3.5 w-3.5" />
                                        影相
                                      </Button>
                                    </>
                                  ) : (
                                     <>
                                      <Button type="button" variant="secondary" size="sm" className="flex-1 text-xs h-8 px-2" onClick={stopCamera}>
                                        取消
                                      </Button>
                                      <Button type="button" variant="default" size="sm" className="flex-1 text-xs h-8 px-2" onClick={capturePhoto}>
                                         影啦！
                                      </Button>
                                     </>
                                  )}
                               </div>
                           </div>
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs text-foreground/80 px-1 pt-1">
                        上載張清啲嘅大頭相，或者用相機即刻影返張。
                      </FormDescription>
                      <FormMessage className="px-1"/>
                    </FormItem>
                  )}
                />
             </AccordionContent>
           </AccordionItem>

           {/* --- Kimono Section --- */}
           <AccordionItem value="kimono-section" disabled={!watchedPhoto}>
             <AccordionTrigger className="text-base font-semibold hover:no-underline px-2 py-2 rounded-md hover:bg-secondary/50 data-[state=open]:bg-secondary/80 disabled:opacity-50">
                <span className="flex items-center gap-2">
                  <Shirt className="h-5 w-5" />
                   步驟二：揀件和服👘
                   {watchedKimono && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                </span>
             </AccordionTrigger>
             <AccordionContent className="pt-1 pb-2 px-2">
                <FormField
                  control={form.control}
                  name="kimono"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormDescription className="text-xs text-foreground/80 px-1">
                        揀件和服俾你個頭像着啦。mouse hover可以放大睇㗎！
                      </FormDescription>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5 pt-1"
                        >
                          {kimonos.map((kimono) => (
                            <FormItem key={kimono.id} className="relative group">
                              <FormControl>
                                <RadioGroupItem value={kimono.id} id={`kimono-${kimono.id}`} className="sr-only peer" />
                              </FormControl>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <FormLabel
                                    htmlFor={`kimono-${kimono.id}`}
                                    className={cn(
                                      "block cursor-pointer rounded-md border-2 border-muted bg-popover transition-all duration-200 ease-in-out overflow-hidden", // Added overflow-hidden
                                      "hover:border-accent hover:shadow-md",
                                      "peer-data-[state=checked]:border-primary peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-primary/50 peer-data-[state=checked]:shadow-lg"
                                    )}
                                  >
                                    <div className="aspect-square overflow-hidden rounded-t-md">
                                      <Image
                                        src={kimono.src}
                                        alt={kimono.name}
                                        width={100}
                                        height={100}
                                        className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-110" // Enhanced zoom
                                        data-ai-hint={kimono.dataAiHint}
                                      />
                                    </div>
                                    <p className="truncate text-[10px] font-medium text-center p-0.5 bg-muted/50 rounded-b-md">{kimono.name}</p>
                                  </FormLabel>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="p-0 border-none bg-transparent shadow-xl w-[250px] h-[250px] flex items-center justify-center"> {/* Larger tooltip content */}
                                  <Image
                                     src={kimono.src}
                                     alt={kimono.name}
                                     width={250} // Larger preview size
                                     height={250}
                                     className="rounded-md object-cover"
                                     data-ai-hint={kimono.dataAiHint}
                                   />
                                </TooltipContent>
                              </Tooltip>
                            </FormItem>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage className="px-1"/>
                    </FormItem>
                  )}
                />
             </AccordionContent>
           </AccordionItem>

           {/* --- Background Section --- */}
           <AccordionItem value="background-section" disabled={!watchedKimono}>
             <AccordionTrigger className="text-base font-semibold hover:no-underline px-2 py-2 rounded-md hover:bg-secondary/50 data-[state=open]:bg-secondary/80 disabled:opacity-50">
                <span className="flex items-center gap-2">
                  <Trees className="h-5 w-5" />
                   步驟三：揀個背景🏞️
                   {watchedBackground && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                </span>
             </AccordionTrigger>
             <AccordionContent className="pt-1 pb-2 px-2">
                 <FormField
                  control={form.control}
                  name="background"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormDescription className="text-xs text-foreground/80 px-1">
                         揀個背景襯托你嘅頭像。mouse hover可以放大睇㗎！
                      </FormDescription>
                      <FormControl>
                         <RadioGroup
                           onValueChange={field.onChange}
                           defaultValue={field.value}
                           className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5 pt-1"
                         >
                           {backgrounds.map((bg) => (
                             <FormItem key={bg.id} className="relative group">
                               <FormControl>
                                  <RadioGroupItem value={bg.id} id={`bg-${bg.id}`} className="sr-only peer" />
                               </FormControl>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                       <FormLabel
                                         htmlFor={`bg-${bg.id}`}
                                         className={cn(
                                            "block cursor-pointer rounded-md border-2 border-muted bg-popover transition-all duration-200 ease-in-out overflow-hidden", // Added overflow-hidden
                                            "hover:border-accent hover:shadow-md",
                                            "peer-data-[state=checked]:border-primary peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-primary/50 peer-data-[state=checked]:shadow-lg"
                                         )}
                                       >
                                          <div className="aspect-[2/3] overflow-hidden rounded-t-md">
                                              <Image
                                               src={bg.src}
                                               alt={bg.name}
                                               width={100}
                                               height={150}
                                               className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-110" // Enhanced zoom
                                               data-ai-hint={bg.dataAiHint}
                                              />
                                           </div>
                                           <p className="truncate text-[10px] font-medium text-center p-0.5 bg-muted/50 rounded-b-md">{bg.name}</p>
                                       </FormLabel>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="p-0 border-none bg-transparent shadow-xl w-[200px] h-[300px] flex items-center justify-center"> {/* Larger tooltip, 2:3 ratio */}
                                        <Image
                                         src={bg.src}
                                         alt={bg.name}
                                         width={200} // Larger preview size
                                         height={300}
                                         className="rounded-md object-cover"
                                         data-ai-hint={bg.dataAiHint}
                                        />
                                    </TooltipContent>
                                </Tooltip>
                             </FormItem>
                           ))}
                         </RadioGroup>
                      </FormControl>
                      <FormMessage className="px-1"/>
                    </FormItem>
                  )}
                />
             </AccordionContent>
           </AccordionItem>

           {/* --- Description Section --- */}
           <AccordionItem value="description-section" disabled={!watchedBackground}>
             <AccordionTrigger className="text-base font-semibold hover:no-underline px-2 py-2 rounded-md hover:bg-secondary/50 data-[state=open]:bg-secondary/80 disabled:opacity-50">
                <span className="flex items-center gap-2">
                  <Pencil className="h-5 w-5" />
                   步驟四：加啲細節（可以唔填）
                </span>
             </AccordionTrigger>
             <AccordionContent className="pt-1 pb-2 px-2">
                <FormField
                   control={form.control}
                   name="userDescription"
                   render={({ field }) => (
                     <FormItem className="space-y-1">
                       <FormControl>
                         <Textarea
                           placeholder="例如：戴眼鏡、微笑、揸住把扇..."
                           className="resize-none text-sm h-16"
                           rows={2}
                           {...field}
                         />
                       </FormControl>
                       <FormDescription className="text-xs text-foreground/80 px-1 pt-1">
                         加少少描述，等個頭像更加獨特（最多150字）。
                       </FormDescription>
                       <FormMessage className="px-1"/>
                     </FormItem>
                   )}
                 />
             </AccordionContent>
           </AccordionItem>

        </Accordion>


         {/* Submit Button & Progress */}
        <div className="space-y-1.5 pt-2 px-2">
           <Button
             type="submit"
             disabled={isPending || !watchedPhoto || !watchedKimono || !watchedBackground} // Disable if steps not complete
             className="w-full bg-accent hover:bg-accent/90 text-accent-foreground h-10 text-base"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
              <div className="space-y-0.5">
                 <Progress value={progress} className="w-full [&>div]:bg-accent h-1.5" />
                 <p className="text-xs text-center text-foreground/80">努力生成緊你嘅頭像，等等啊...</p>
               </div>
            )}
        </div>


        {/* Generated Image Display */}
        {generatedImageUrl && !isPending && (
          <Card className="mt-3 mx-2 border-accent/50">
            <CardContent className="p-2">
               <Alert variant="default" className="mb-1.5 border-accent bg-accent/10 p-2">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <AlertTitle className="text-accent font-semibold text-sm">搞掂！✨</AlertTitle>
                  <AlertDescription className="text-xs text-foreground/80">
                    你嘅靚靚櫻花頭像整好喇！右掣或者長按就可以儲存。
                  </AlertDescription>
                </Alert>
              <div className="aspect-square relative w-full max-w-[300px] mx-auto rounded-lg overflow-hidden shadow-md"> {/* Even smaller max-w */}
                <Image
                  src={generatedImageUrl}
                  alt="生成嘅頭像"
                  fill
                  objectFit="cover"
                  data-ai-hint="generated avatar portrait"
                />
              </div>
               <Button
                    variant="outline"
                    size="sm" // Smaller button
                    className="w-full mt-2 text-sm h-9"
                    onClick={() => {
                        setGeneratedImageUrl(null);
                        form.reset();
                        setSelectedPhotoPreview(null);
                     }}
                    >
                    再整一個！
                </Button>
            </CardContent>
          </Card>
        )}
      </form>
    </Form>
    </TooltipProvider>
  );
}