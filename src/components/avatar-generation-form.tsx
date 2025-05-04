"use client";

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Image from 'next/image';
import QRCode from 'qrcode.react';
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
import { fetchPhotosAction } from '@/app/actions/fetch-photos'; // Import the server action
import { Loader2, Upload, Camera, Sparkles, Wand2, Image as ImageIcon, Shirt, Trees, Pencil, CheckCircle2, User, QrCode, RefreshCw } from 'lucide-react'; // Added relevant icons
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"; // Import Accordion components
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton

// Define the type for image options passed as props or fetched
export interface ImageOption {
  id: string; // Can be filename or unique identifier
  name: string; // Display name
  src: string; // URL or data URI
  description: string; // Description for AI or display
  dataAiHint: string; // Hint for AI
}

// Define props for the component
interface AvatarGenerationFormProps {
  kimonos: ImageOption[];
  backgrounds: ImageOption[];
}

const formSchema = z.object({
  username: z.string().min(1, { message: "請輸入用戶名。" }),
  photo: z.any().refine(fileOrDataUrl => fileOrDataUrl instanceof File || (typeof fileOrDataUrl === 'string' && (fileOrDataUrl.startsWith('data:image/') || fileOrDataUrl.startsWith('http'))), { // Allow http(s) URLs
    message: "請上載、用QR碼上載、或影張相。",
  }),
  kimono: z.string().min(1, { message: "請揀一件和服。" }),
  background: z.string().min(1, { message: "請揀一個背景。" }),
  userDescription: z.string().max(150, { message: "描述唔可以超過150個字。" }).optional(),
});


export default function AvatarGenerationForm({ kimonos = [], backgrounds = [] }: AvatarGenerationFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isFetchingPhotos, startFetchingPhotosTransition] = useTransition(); // Separate transition for fetching
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isQrCodeDialogOpen, setIsQrCodeDialogOpen] = useState(false);
  const [fetchedPhotos, setFetchedPhotos] = useState<ImageOption[]>([]);
  // Use isFetchingPhotos transition state for loading indicator
  // const [isLoadingPhotos, setIsLoadingPhotos] = useState<boolean>(false); // Replaced by isFetchingPhotos
  const [selectedFetchedPhotoId, setSelectedFetchedPhotoId] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      photo: undefined,
      kimono: "",
      background: "",
      userDescription: "",
    },
  });

  // Watch form values
  const watchedUsername = form.watch("username");
  const watchedPhoto = form.watch("photo");
  const watchedKimono = form.watch("kimono");
  const watchedBackground = form.watch("background");

  const qrCodeUrl = watchedUsername
    ? `https://upload-photo-dot-comfyuiserver2024.uc.r.appspot.com/?userName=${encodeURIComponent(watchedUsername)}`
    : "";

  // --- Photo Fetching Logic ---
  const fetchUserPhotos = useCallback(async (username: string) => {
    if (!username) return;

    startFetchingPhotosTransition(async () => {
        setFetchedPhotos([]); // Clear previous photos immediately
        console.log(`Fetching photos for user: ${username}`);

        const result = await fetchPhotosAction(username); // Call the server action

        if (result.success) {
            setFetchedPhotos(result.photos);
            if (result.photos.length > 0) {
                toast({
                    title: "圖片已載入",
                    description: `搵到 ${result.photos.length} 張 ${username} 嘅相。`,
                });
            } else {
                toast({
                    title: "未搵到圖片",
                    description: `暫時未搵到 ${username} 嘅相，試下用QR Code上載？`,
                    variant: "default",
                });
            }
        } else {
            console.error("Error fetching user photos:", result.error);
            toast({
                title: "載入圖片失敗",
                description: result.error || "嘗試載入用戶圖片時發生錯誤。",
                variant: "destructive",
            });
            setFetchedPhotos([]); // Ensure photos are cleared on error
        }
    });
  }, [toast]);


  // Handle photo selection (from file upload, camera, or fetched photos)
  const handlePhotoSelection = (source: 'file' | 'camera' | 'fetched', data: File | string | ImageOption) => {
    stopCamera(); // Stop camera if running
    setSelectedFetchedPhotoId(null); // Deselect any fetched photo

    if (source === 'file' && data instanceof File) {
      form.setValue("photo", data);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(data);
    } else if (source === 'camera' && typeof data === 'string') {
      form.setValue("photo", data); // data is dataUrl
      setSelectedPhotoPreview(data);
    } else if (source === 'fetched' && typeof data !== 'string' && !(data instanceof File)) {
        form.setValue("photo", data.src); // Use the URL as the value
        setSelectedPhotoPreview(data.src);
        setSelectedFetchedPhotoId(data.id);
    } else {
         form.setValue("photo", undefined);
         setSelectedPhotoPreview(null);
    }
  };


  // Handle direct file upload change
  const handleFileUploadChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handlePhotoSelection('file', file);
    }
  };

  // Start camera capture
  const startCamera = async () => {
    setIsCapturing(true);
    setSelectedPhotoPreview(null); // Clear file upload preview
    form.setValue("photo", undefined); // Clear file upload value
    setSelectedFetchedPhotoId(null);
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
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const captureWidth = 480;
        const captureHeight = (videoHeight / videoWidth) * captureWidth;
        canvasRef.current.width = captureWidth;
        canvasRef.current.height = captureHeight;

        context.drawImage(video, 0, 0, captureWidth, captureHeight);
        const dataUrl = canvasRef.current.toDataURL('image/png');
        handlePhotoSelection('camera', dataUrl);
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
   const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
        try {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
         } catch (error) {
            console.error("Error stopping camera stream:", error);
         }
     }
     // Check if state update is needed
     if (isCapturing) {
         setIsCapturing(false);
     }
 }, [isCapturing]);


  // Cleanup camera on component unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Auto-fetch photos when username changes (debounced)
   useEffect(() => {
       if (watchedUsername) {
           const handler = setTimeout(() => {
               fetchUserPhotos(watchedUsername);
           }, 500); // Debounce fetching by 500ms

           return () => {
               clearTimeout(handler);
           };
       } else {
           // Clear photos if username is cleared
           setFetchedPhotos([]);
           setSelectedFetchedPhotoId(null);
       }
   }, [watchedUsername, fetchUserPhotos]);

   // Auto-select first fetched photo if none is selected
   useEffect(() => {
       // If no photo is actively selected (neither preview nor fetched ID exists),
       // and there are fetched photos available, select the first one.
       if (!selectedPhotoPreview && !selectedFetchedPhotoId && fetchedPhotos.length > 0) {
           console.log("Auto-selecting first fetched photo");
           handlePhotoSelection('fetched', fetchedPhotos[0]);
       }
   }, [fetchedPhotos, selectedPhotoPreview, selectedFetchedPhotoId]); // Add dependencies



  function onSubmit(values: z.infer<typeof formSchema>) {
    startTransition(async () => {
      setGeneratedImageUrl(null);
      setProgress(0);

      const interval = setInterval(() => {
        setProgress((prev) => (prev >= 95 ? 95 : prev + 5));
      }, 300);

      try {
        // Ensure photo data is handled correctly (File or data URL or http URL)
        let photoData: string | File = values.photo;
        if (photoData instanceof File) {
           console.log("Using uploaded file:", photoData.name);
           // Convert File to data URL for consistency or if the AI needs it
           const dataUrl = await new Promise<string>((resolve, reject) => {
             const reader = new FileReader();
             reader.onloadend = () => resolve(reader.result as string);
             reader.onerror = reject;
             reader.readAsDataURL(photoData as File);
           });
           photoData = dataUrl; // Now photoData is always a string (data URL or http URL)
        } else {
           console.log("Using photo from camera/fetched URL/data URL");
        }


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
        // Generate the prompt using the AI flow
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

         // --- Actual Image Generation Call (Placeholder) ---
         // TODO: Replace this section with the actual Genkit image generation call
         //       using the promptResult.prompt and the selected photo (photoData).
         //       Make sure to handle the image data correctly (e.g., as data URI if needed).
        console.log("準備調用圖像生成...");
        console.log("將使用提示:", promptResult.prompt);
        console.log("將使用圖片:", typeof photoData === 'string' ? photoData.substring(0, 60)+'...' : '未知圖片來源');

        // --- Using Placeholder Image Generation ---
        console.log("模擬圖像生成中...");
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate delay
        setProgress(90);
        const simulatedImageUrl = `https://picsum.photos/512/512?random=${Date.now()}`;

        setGeneratedImageUrl(simulatedImageUrl);
        setProgress(100);
        // --- End Placeholder ---


        toast({
          title: "頭像生成完成！",
          description: "你獨一無二嘅櫻花頭像整好喇。",
        });

      } catch (error) {
        console.error("生成頭像過程出錯:", error);
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">

         {/* --- Username Section --- */}
         <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
                <FormItem className="px-2">
                <FormLabel className="text-base font-semibold flex items-center gap-2">
                    <User className="h-5 w-5" />
                    步驟零：入個靚名
                </FormLabel>
                <FormControl>
                    <Input placeholder="例如：櫻花武士" {...field} className="text-sm" />
                </FormControl>
                <FormDescription className="text-xs text-foreground/80 pt-1">
                    呢個名會用嚟幫你搵返上載咗嘅相。
                </FormDescription>
                <FormMessage />
                </FormItem>
            )}
          />

        {/* --- Accordion for Steps --- */}
        <Accordion type="single" collapsible defaultValue="photo-section" className="w-full space-y-1">

           {/* --- Photo Section --- */}
           <AccordionItem value="photo-section" disabled={!watchedUsername}>
             <AccordionTrigger className="text-base font-semibold hover:no-underline px-2 py-2 rounded-md hover:bg-secondary/50 data-[state=open]:bg-secondary/80 disabled:opacity-50">
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
                         <div>
                            {/* --- Upload/Camera Options --- */}
                            <div className="flex flex-col sm:flex-row gap-2 items-start mb-3">
                                <div className="flex-1 space-y-1">
                                    {/* Preview Area */}
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
                                                <ImageIcon className="mx-auto h-6 w-6 mb-1" />
                                                <span className="text-xs">預覽會喺度顯示</span>
                                            </div>
                                        )}
                                        {!isCapturing && <video ref={videoRef} className="absolute w-px h-px opacity-0 pointer-events-none" playsInline muted />}
                                    </div>
                                    <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

                                    {/* Action Buttons */}
                                    <div className="flex gap-1.5 max-w-xs mx-auto">
                                        {!isCapturing ? (
                                            <>
                                            {/* File Upload Button */}
                                            <Button type="button" variant="outline" size="sm" className="flex-1 relative text-xs h-8 px-2">
                                                <Upload className="mr-1 h-3.5 w-3.5" />
                                                上載檔案
                                                <Input
                                                    type="file"
                                                    accept="image/*"
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                    onChange={handleFileUploadChange}
                                                />
                                            </Button>
                                            {/* QR Code Upload Button */}
                                            <Dialog open={isQrCodeDialogOpen} onOpenChange={setIsQrCodeDialogOpen}>
                                                <DialogTrigger asChild>
                                                    <Button type="button" variant="outline" size="sm" className="flex-1 text-xs h-8 px-2" disabled={!watchedUsername}>
                                                        <QrCode className="mr-1 h-3.5 w-3.5" />
                                                        QR Code
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="sm:max-w-md">
                                                    <DialogHeader>
                                                    <DialogTitle>用手機上載相片</DialogTitle>
                                                    <DialogDescription>
                                                        用你嘅手機掃描呢個QR Code，就可以直接上載相片到你嘅用戶名「{watchedUsername}」底下。上載完成後，撳下面嘅「重新整理」掣。
                                                    </DialogDescription>
                                                    </DialogHeader>
                                                    <div className="flex items-center justify-center py-4">
                                                    {qrCodeUrl ? (
                                                        <QRCode value={qrCodeUrl} size={200} level="H" />
                                                    ) : (
                                                        <p className="text-destructive">請先輸入用戶名。</p>
                                                    )}
                                                    </div>
                                                     <Button type="button" variant="default" size="sm" onClick={() => fetchUserPhotos(watchedUsername)} disabled={isFetchingPhotos || !watchedUsername}>
                                                         {isFetchingPhotos ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                                         重新整理上載列表
                                                    </Button>
                                                </DialogContent>
                                            </Dialog>
                                            {/* Camera Button */}
                                            <Button type="button" variant="outline" size="sm" className="flex-1 text-xs h-8 px-2" onClick={startCamera}>
                                                <Camera className="mr-1 h-3.5 w-3.5" />
                                                影相
                                            </Button>
                                            </>
                                        ) : (
                                            // Camera Capture/Cancel Buttons
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

                             {/* --- Fetched Photos Section --- */}
                              {watchedUsername && (
                                <div className="mt-2 pt-2 border-t border-border">
                                    <div className="flex justify-between items-center mb-1 px-1">
                                        <FormLabel className="text-sm font-medium">已上載嘅相</FormLabel>
                                        <Button type="button" variant="ghost" size="sm" onClick={() => fetchUserPhotos(watchedUsername)} disabled={isFetchingPhotos} className="h-7 px-2 text-xs">
                                            {isFetchingPhotos ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
                                            重新整理
                                        </Button>
                                    </div>
                                     <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-1.5">
                                        {isFetchingPhotos ? (
                                            Array.from({ length: 4 }).map((_, idx) => (
                                                 <Skeleton key={`skel-${idx}`} className="aspect-square rounded-md bg-muted/50" />
                                             ))
                                        ) : fetchedPhotos.length > 0 ? (
                                             fetchedPhotos.map((photo) => (
                                                 <button
                                                    key={photo.id}
                                                    type="button"
                                                    onClick={() => handlePhotoSelection('fetched', photo)}
                                                    className={cn(
                                                        "relative aspect-square rounded-md overflow-hidden border-2 transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                                                        selectedFetchedPhotoId === photo.id ? "border-primary ring-2 ring-primary/50" : "border-muted hover:border-accent"
                                                    )}
                                                 >
                                                    <Image
                                                        src={photo.src}
                                                        alt={photo.name}
                                                        fill
                                                        sizes="(max-width: 640px) 20vw, (max-width: 768px) 16vw, 12vw" // Adjust sizes
                                                        className="object-cover"
                                                        onError={(e) => {
                                                            // Attempt to hide parent button if image fails
                                                            const buttonElement = e.currentTarget.closest('button');
                                                            if (buttonElement) buttonElement.style.display = 'none';
                                                            console.warn(`無法載入圖片: ${photo.src}`);
                                                         }}
                                                    />
                                                    {selectedFetchedPhotoId === photo.id && (
                                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                            <CheckCircle2 className="h-6 w-6 text-primary-foreground" />
                                                        </div>
                                                    )}
                                                </button>
                                             ))
                                        ) : (
                                            <p className="col-span-full text-xs text-center text-foreground/80 py-2">
                                                未搵到用戶「{watchedUsername}」嘅相。試下用 QR code 上載？
                                            </p>
                                        )}
                                     </div>
                                </div>
                             )}

                        </div>
                      </FormControl>
                       <FormDescription className="text-xs text-foreground/80 px-1 pt-1">
                        用上面嘅方法揀一張相，或者揀返之前上載過嘅相。
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
                                      "block cursor-pointer rounded-md border-2 border-muted bg-popover transition-all duration-200 ease-in-out overflow-hidden",
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
                                        className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-110"
                                        data-ai-hint={kimono.dataAiHint}
                                      />
                                    </div>
                                    <p className="truncate text-[10px] font-medium text-center p-0.5 bg-muted/50 rounded-b-md">{kimono.name}</p>
                                  </FormLabel>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="p-0 border-none bg-transparent shadow-xl w-[250px] h-[250px] flex items-center justify-center">
                                  <Image
                                     src={kimono.src}
                                     alt={kimono.name}
                                     width={250}
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
                                            "block cursor-pointer rounded-md border-2 border-muted bg-popover transition-all duration-200 ease-in-out overflow-hidden",
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
                                               className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-110"
                                               data-ai-hint={bg.dataAiHint}
                                              />
                                           </div>
                                           <p className="truncate text-[10px] font-medium text-center p-0.5 bg-muted/50 rounded-b-md">{bg.name}</p>
                                       </FormLabel>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="p-0 border-none bg-transparent shadow-xl w-[200px] h-[300px] flex items-center justify-center">
                                        <Image
                                         src={bg.src}
                                         alt={bg.name}
                                         width={200}
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
             disabled={isPending || !watchedPhoto || !watchedKimono || !watchedBackground}
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
              <div className="aspect-square relative w-full max-w-[300px] mx-auto rounded-lg overflow-hidden shadow-md">
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
                    size="sm"
                    className="w-full mt-2 text-sm h-9"
                    onClick={() => {
                        setGeneratedImageUrl(null);
                        form.reset({ // Reset form with default values
                          username: watchedUsername, // Keep username maybe? Or clear it too: ""
                          photo: undefined,
                          kimono: "",
                          background: "",
                          userDescription: ""
                        });
                        setSelectedPhotoPreview(null);
                        // Refetch photos if username is kept, or clear if username is cleared
                        if (watchedUsername) {
                            fetchUserPhotos(watchedUsername); // Refetch for the same user
                        } else {
                           setFetchedPhotos([]); // Clear fetched photos if username is reset
                        }
                        setSelectedFetchedPhotoId(null);
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
