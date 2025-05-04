
"use client";

import React, { useState, useEffect, useTransition, useCallback, useRef } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Form } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { generateAvatarPrompt } from '@/ai/flows/generate-avatar-prompt';
import { fetchPhotosAction } from '@/app/actions/fetch-photos';
import { Loader2, Wand2 } from 'lucide-react';
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TooltipProvider } from "@/components/ui/tooltip";

import UsernameInput from './avatar-generation/username-input';
import PhotoSelectionSection from './avatar-generation/photo-selection-section';
import ImageSelectionGrid from './avatar-generation/image-selection-grid';
import UserDescriptionInput from './avatar-generation/user-description-input';
import GeneratedAvatarDisplay from './avatar-generation/generated-avatar-display';

import type { ImageOption } from './avatar-generation/types';


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

export type AvatarFormValues = z.infer<typeof formSchema>;

export default function AvatarGenerationForm({ kimonos = [], backgrounds = [] }: AvatarGenerationFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isFetchingPhotos, startFetchingPhotosTransition] = useTransition();
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isQrCodeDialogOpen, setIsQrCodeDialogOpen] = useState(false);
  const [fetchedPhotos, setFetchedPhotos] = useState<ImageOption[]>([]);
  const [selectedFetchedPhotoId, setSelectedFetchedPhotoId] = useState<string | null>(null);
  const [activeAccordionItem, setActiveAccordionItem] = useState<string>("username-section"); // Start with username open


  const form = useForm<AvatarFormValues>({
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

   // Function to move to the next accordion item
   const nextStep = (currentStep: string) => {
    const steps = ["username-section", "photo-section", "kimono-section", "background-section", "description-section"];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setActiveAccordionItem(steps[currentIndex + 1]);
    }
  };

  // --- Camera Control Functions ---

  // Stop camera stream (Define this early)
  const stopCamera = useCallback(() => {
    console.log('Attempting to stop camera. isCapturing:', isCapturing);
    if (videoRef.current && videoRef.current.srcObject) {
        try {
            const stream = videoRef.current.srcObject as MediaStream;
            // Ensure all tracks are stopped
            stream.getTracks().forEach(track => {
                if (track.readyState === 'live') {
                    track.stop();
                }
            });
            videoRef.current.srcObject = null; // Clear the srcObject
            console.log('Camera stream stopped.');
         } catch (error) {
            console.error("Error stopping camera stream:", error);
         }
     }
     // Ensure isCapturing state is updated if it was true
     if (isCapturing) {
         setIsCapturing(false);
         console.log('Set isCapturing to false');
     } else {
         console.log('Stop camera called but not currently capturing.');
     }
 }, [isCapturing]); // Add isCapturing dependency


  // Handle photo selection (from file upload, camera, or fetched photos)
  const handlePhotoSelection = useCallback((source: 'file' | 'camera' | 'fetched', data: File | string | ImageOption) => {
    stopCamera(); // Stop camera if running
    setSelectedFetchedPhotoId(null);

    let photoValue: File | string | undefined = undefined;
    let previewUrl: string | null = null;
    let fetchedId: string | null = null;

    if (source === 'file' && data instanceof File) {
        photoValue = data;
        const reader = new FileReader();
        reader.onloadend = () => {
            setSelectedPhotoPreview(reader.result as string);
             nextStep("photo-section"); // Move to next step after selection
        };
        reader.readAsDataURL(data);
        // No need for object URL if using data URL for preview
    } else if (source === 'camera' && typeof data === 'string') {
        photoValue = data; // data is dataUrl
        previewUrl = data;
        nextStep("photo-section"); // Move to next step after selection
    } else if (source === 'fetched' && typeof data !== 'string' && !(data instanceof File)) {
        photoValue = data.src; // Use the URL as the value
        previewUrl = data.src;
        fetchedId = data.id;
        nextStep("photo-section"); // Move to next step after selection
    }

    form.setValue("photo", photoValue, { shouldValidate: true }); // Set value and trigger validation
    setSelectedPhotoPreview(previewUrl); // Update preview state
    setSelectedFetchedPhotoId(fetchedId); // Update selected fetched ID state

  }, [form, stopCamera]); // Ensure stopCamera is defined before this

  // Start camera capture
  const startCamera = useCallback(async () => {
    stopCamera(); // Stop any existing stream first
    setIsCapturing(true);
    setSelectedPhotoPreview(null);
    form.setValue("photo", undefined);
    setSelectedFetchedPhotoId(null);
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } }); // Prefer user-facing camera
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play(); // Ensure video plays
          console.log("Camera started successfully.");
        }
      } catch (err) {
        console.error("影相機出錯: ", err);
        toast({
          title: "相機錯誤",
          description: "開唔到相機，請確保你已經俾咗權限。",
          variant: "destructive",
        });
        setIsCapturing(false); // Reset state on error
      }
    } else {
       toast({
          title: "相機錯誤",
          description: "你嘅瀏覽器唔支援影相功能。",
          variant: "destructive",
        });
        setIsCapturing(false); // Reset state if not supported
    }
  }, [form, toast, stopCamera]); // Add stopCamera dependency

  // Capture photo from video stream
  const capturePhoto = useCallback(() => {
    console.log('Capture photo called. isCapturing:', isCapturing);
    if (videoRef.current && canvasRef.current && isCapturing) {
      const context = canvasRef.current.getContext('2d');
      const video = videoRef.current;
      // Ensure video has data and is ready
      if (context && video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0) {
        console.log('Capturing frame...');
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        // Simple square crop from center
        const size = Math.min(videoWidth, videoHeight);
        const x = (videoWidth - size) / 2;
        const y = (videoHeight - size) / 2;

        // Set canvas size (can be smaller for performance)
        const canvasSize = 480;
        canvasRef.current.width = canvasSize;
        canvasRef.current.height = canvasSize;

        // Draw the cropped square area onto the canvas
        context.drawImage(video, x, y, size, size, 0, 0, canvasSize, canvasSize);

        const dataUrl = canvasRef.current.toDataURL('image/png');
        console.log('Photo captured as data URL.');
        handlePhotoSelection('camera', dataUrl);
        // stopCamera(); // Removed: stopCamera is called in handlePhotoSelection
      } else {
         console.warn('Capture failed: Video not ready or no dimensions.');
         toast({
          title: "影相失敗",
          description: "未能成功影相，請再試一次或確保相機運作正常。",
          variant: "destructive",
        });
      }
    } else {
        console.warn('Capture skipped: Not capturing or refs not available.');
    }
  }, [isCapturing, handlePhotoSelection, toast]); // Removed stopCamera dependency here


   // --- Photo Fetching Logic ---
   const fetchUserPhotos = useCallback(async (username: string) => {
    if (!username) return;

    startFetchingPhotosTransition(async () => {
        setFetchedPhotos([]);
        setSelectedFetchedPhotoId(null); // Reset selection when fetching new user
        console.log(`Fetching photos for user: ${username}`);

        const result = await fetchPhotosAction(username);

        if (result.success) {
            setFetchedPhotos(result.photos);
            if (result.photos.length > 0) {
                toast({
                    title: "圖片已載入",
                    description: `搵到 ${result.photos.length} 張 ${username} 嘅相。`,
                });
                 // Auto-select the first fetched photo if no other photo is selected
                if (!form.getValues("photo")) {
                    handlePhotoSelection('fetched', result.photos[0]);
                }

            } else {
                toast({
                    title: "未搵到圖片",
                    description: `暫時未搵到 ${username} 嘅相，試下用QR Code上載？`,
                    variant: "default",
                });
            }
             // Move to photo step if username is entered and fetching is done
             if (username) nextStep("username-section");
        } else {
            console.error("Error fetching user photos:", result.error);
            toast({
                title: "載入圖片失敗",
                description: result.error || "嘗試載入用戶圖片時發生錯誤。",
                variant: "destructive",
            });
            setFetchedPhotos([]);
        }
    });
  }, [toast, form, handlePhotoSelection]); // Added handlePhotoSelection

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
           }, 500);

           return () => {
               clearTimeout(handler);
           };
       } else {
           setFetchedPhotos([]);
           setSelectedFetchedPhotoId(null);
       }
   }, [watchedUsername, fetchUserPhotos]);


  async function onSubmit(values: AvatarFormValues) {
    startTransition(async () => {
      setGeneratedImageUrl(null);
      setProgress(0);

      const interval = setInterval(() => {
        setProgress((prev) => (prev >= 95 ? 95 : prev + 5));
      }, 300);

      try {
        let photoData: string | File = values.photo;
        if (photoData instanceof File) {
           const dataUrl = await new Promise<string>((resolve, reject) => {
             const reader = new FileReader();
             reader.onloadend = () => resolve(reader.result as string);
             reader.onerror = reject;
             reader.readAsDataURL(photoData as File);
           });
           photoData = dataUrl;
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

        // --- Placeholder Image Generation ---
        console.log("模擬圖像生成中...");
        await new Promise(resolve => setTimeout(resolve, 2000));
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
         // Keep accordion open at the end result
         setActiveAccordionItem(''); // Or maybe 'result-section' if you add one
      }
    });
  }

  const handleReset = useCallback(() => {
    stopCamera(); // Stop camera if running
    setGeneratedImageUrl(null);
    form.reset({
      username: watchedUsername, // Keep username
      photo: undefined,
      kimono: "",
      background: "",
      userDescription: ""
    });
    setSelectedPhotoPreview(null);
    // Refetch photos to potentially auto-select first one again
    if (watchedUsername) {
        fetchUserPhotos(watchedUsername);
    } else {
       setFetchedPhotos([]);
    }
    setSelectedFetchedPhotoId(null);
    setActiveAccordionItem('photo-section'); // Go back to photo step
  }, [form, watchedUsername, fetchUserPhotos, stopCamera]); // Added stopCamera

  return (
    <TooltipProvider delayDuration={100}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">

          {/* --- Accordion for Steps --- */}
          <Accordion
            type="single"
            collapsible
            value={activeAccordionItem}
            onValueChange={setActiveAccordionItem} // Allow manual accordion changes
            className="w-full space-y-1"
          >
            {/* --- Username Section --- */}
            <UsernameInput form={form} nextStep={() => nextStep("username-section")} />

            {/* --- Photo Section --- */}
            <PhotoSelectionSection
              form={form}
              watchedUsername={watchedUsername}
              watchedPhoto={watchedPhoto}
              selectedPhotoPreview={selectedPhotoPreview}
              isCapturing={isCapturing}
              videoRef={videoRef}
              canvasRef={canvasRef}
              isQrCodeDialogOpen={isQrCodeDialogOpen}
              setIsQrCodeDialogOpen={setIsQrCodeDialogOpen}
              qrCodeUrl={qrCodeUrl}
              fetchUserPhotos={fetchUserPhotos}
              isFetchingPhotos={isFetchingPhotos}
              fetchedPhotos={fetchedPhotos}
              selectedFetchedPhotoId={selectedFetchedPhotoId}
              handlePhotoSelection={handlePhotoSelection}
              handleFileUploadChange={(e) => {
                 const file = e.target.files?.[0];
                 if (file) handlePhotoSelection('file', file);
              }}
              startCamera={startCamera}
              stopCamera={stopCamera}
              capturePhoto={capturePhoto}
              nextStep={() => nextStep("photo-section")}
              disabled={!watchedUsername} // Disable if no username
            />

            {/* --- Kimono Section --- */}
            <ImageSelectionGrid
              form={form}
              fieldName="kimono"
              label="步驟二：揀件和服👘"
              description="揀件和服俾你個頭像着啦。mouse hover可以放大睇㗎！"
              options={kimonos}
              value={watchedKimono}
              aspectRatio="aspect-square"
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shirt"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg>} // Inline SVG for Shirt
              sectionId="kimono-section"
              onSelectionChange={() => nextStep("kimono-section")}
              disabled={!watchedPhoto} // Disable if no photo selected
            />

            {/* --- Background Section --- */}
            <ImageSelectionGrid
              form={form}
              fieldName="background"
              label="步驟三：揀個背景🏞️"
              description="揀個背景襯托你嘅頭像。mouse hover可以放大睇㗎！"
              options={backgrounds}
              value={watchedBackground}
              aspectRatio="aspect-[2/3]"
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trees"><path d="M10 10v.2A3 3 0 0 1 7.1 13H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2.9a3 3 0 0 1 2.9 2.8V10z"/><path d="M7 14v.2A3 3 0 0 0 9.9 17H14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2.9a3 3 0 0 0-2.9 2.8V14z"/><path d="M17 14v.2A3 3 0 0 1 14.1 17H10a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2.9a3 3 0 0 1 2.9 2.8V14z"/></svg>} // Inline SVG for Trees
              sectionId="background-section"
              onSelectionChange={() => nextStep("background-section")}
              disabled={!watchedKimono} // Disable if no kimono selected
            />

            {/* --- Description Section --- */}
            <UserDescriptionInput
              form={form}
              value={form.watch('userDescription')}
              onValueChange={() => nextStep("description-section")} // Optional: auto-advance on typing
              disabled={!watchedBackground} // Disable if no background selected
            />

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
            <GeneratedAvatarDisplay
              imageUrl={generatedImageUrl}
              onReset={handleReset}
            />
          )}
        </form>
      </Form>
    </TooltipProvider>
  );
}

