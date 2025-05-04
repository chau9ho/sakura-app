
"use client";

import React, { useState, useEffect, useTransition, useCallback, useRef } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Form } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
// import { generateAvatarPrompt } from '@/ai/flows/generate-avatar-prompt'; // Keep for now if needed elsewhere, but action handles prompt gen
import { fetchPhotosAction } from '@/app/actions/fetch-photos';
import { generateAvatarAction } from '@/app/actions/generate-avatar-action'; // Import the new action
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

// Schema needs to align with the server action's input schema
const formSchema = z.object({
  username: z.string().min(1, { message: "請輸入用戶名。" }),
  photo: z.any().refine(data =>
    (data instanceof File && data.size > 0) || // File object
    (typeof data === 'string' && (data.startsWith('data:image/') || data.startsWith('http'))), // Data URL or HTTP(s) URL
    { message: "請上載、用QR碼上載、或影張相。" }
  ),
  kimono: z.string().min(1, { message: "請揀一件和服。" }), // Store ID only
  background: z.string().min(1, { message: "請揀一個背景。" }), // Store ID only
  userDescription: z.string().max(150, { message: "描述唔可以超過150個字。" }).optional(),
});

export type AvatarFormValues = z.infer<typeof formSchema>;

export default function AvatarGenerationForm({ kimonos = [], backgrounds = [] }: AvatarGenerationFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isFetchingPhotos, startFetchingPhotosTransition] = useTransition();
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generatedPromptText, setGeneratedPromptText] = useState<string | null>(null); // Store the prompt text
  const [progress, setProgress] = useState<number>(0);
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isQrCodeDialogOpen, setIsQrCodeDialogOpen] = useState(false);
  const [fetchedPhotos, setFetchedPhotos] = useState<ImageOption[]>([]);
  const [selectedFetchedPhotoId, setSelectedFetchedPhotoId] = useState<string | null>(null);
  const [activeAccordionItem, setActiveAccordionItem] = useState<string>("username-section"); // Start with username open
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null); // Ref for interval


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
        // Only advance if the current step is valid
        const fieldName = currentStep.split('-')[0] as keyof AvatarFormValues;
        if (fieldName && !form.formState.errors[fieldName]) {
           setActiveAccordionItem(steps[currentIndex + 1]);
        }
    }
  };


   // --- Progress Simulation ---
   const startProgressSimulation = () => {
    setProgress(0);
    if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
    }
    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
          return 95; // Cap at 95% until success/failure
        }
        // Simulate slower progress initially, then faster
        const increment = prev < 50 ? 2 : (prev < 80 ? 5 : 3);
        return Math.min(prev + increment, 95);
      });
    }, 500); // Update every 500ms
  };

   const completeProgress = () => {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        setProgress(100);
   };

   const resetProgress = () => {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        setProgress(0);
   };

   // Clear interval on unmount
    useEffect(() => {
        return () => {
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
        }
        };
    }, []);


  // --- Camera Control Functions ---

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
     if (isCapturing) {
         setIsCapturing(false);
     }
 }, [isCapturing]);


  // Handle photo selection (from file upload, camera, or fetched photos)
  const handlePhotoSelection = useCallback((source: 'file' | 'camera' | 'fetched', data: File | string | ImageOption) => {
    stopCamera(); // Stop camera if running
    setSelectedFetchedPhotoId(null);
    form.clearErrors("photo"); // Clear validation error on new selection

    let photoValue: File | string | undefined = undefined;
    let previewUrl: string | null = null;
    let fetchedId: string | null = null;

    if (source === 'file' && data instanceof File) {
        photoValue = data;
        const reader = new FileReader();
        reader.onloadend = () => {
            setSelectedPhotoPreview(reader.result as string);
             // Don't auto-advance here, let user confirm selection visually
        };
        reader.readAsDataURL(data);
    } else if (source === 'camera' && typeof data === 'string') {
        photoValue = data; // data is dataUrl
        previewUrl = data;
        // Don't auto-advance here
    } else if (source === 'fetched' && typeof data !== 'string' && !(data instanceof File)) {
        photoValue = data.src; // Use the URL as the value
        previewUrl = data.src;
        fetchedId = data.id;
         // Don't auto-advance here
    }

    // Set value and trigger validation, but don't advance accordion automatically
    form.setValue("photo", photoValue, { shouldValidate: true });
    setSelectedPhotoPreview(previewUrl);
    setSelectedFetchedPhotoId(fetchedId);

    // Manually advance if selection is valid
    form.trigger("photo").then(isValid => {
        if (isValid) {
             setTimeout(() => nextStep("photo-section"), 100); // Small delay allows preview update
        }
    });


  }, [form, stopCamera]); // Ensure stopCamera is defined before this

  // Start camera capture
  const startCamera = useCallback(async () => {
    stopCamera(); // Stop any existing stream first
    setIsCapturing(true);
    setSelectedPhotoPreview(null);
    form.setValue("photo", undefined); // Clear photo value
    setSelectedFetchedPhotoId(null);

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
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
  }, [form, toast, stopCamera]);

  // Capture photo from video stream
  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current && isCapturing) {
      const context = canvasRef.current.getContext('2d');
      const video = videoRef.current;
      if (context && video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0) {
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const size = Math.min(videoWidth, videoHeight);
        const x = (videoWidth - size) / 2;
        const y = (videoHeight - size) / 2;
        const canvasSize = 480;
        canvasRef.current.width = canvasSize;
        canvasRef.current.height = canvasSize;
        context.drawImage(video, x, y, size, size, 0, 0, canvasSize, canvasSize);
        const dataUrl = canvasRef.current.toDataURL('image/png');
        handlePhotoSelection('camera', dataUrl);
        // stopCamera(); // Called within handlePhotoSelection
      } else {
         toast({ title: "影相失敗", description: "未能成功影相，請再試一次。", variant: "destructive" });
      }
    }
  }, [isCapturing, handlePhotoSelection, toast]);


   // --- Photo Fetching Logic ---
   const fetchUserPhotos = useCallback(async (username: string) => {
    if (!username) return;

    startFetchingPhotosTransition(async () => {
        setFetchedPhotos([]);
        setSelectedFetchedPhotoId(null);
        form.setValue("photo", undefined); // Clear photo selection when user changes
        setSelectedPhotoPreview(null);

        const result = await fetchPhotosAction(username);

        if (result.success) {
            setFetchedPhotos(result.photos);
            if (result.photos.length > 0) {
                toast({
                    title: "圖片已載入",
                    description: `搵到 ${result.photos.length} 張 ${username} 嘅相。`,
                });
                 // Automatically select the first photo IF no photo is currently selected
                 if (!form.getValues("photo")) {
                    handlePhotoSelection('fetched', result.photos[0]);
                 }
            } else {
                toast({
                    title: "未搵到圖片",
                    description: `暫時未搵到 ${username} 嘅相。`,
                    variant: "default", // Use default, not destructive
                });
            }
        } else {
            console.error("Error fetching user photos:", result.error);
            toast({
                title: "載入圖片失敗",
                description: result.error || "嘗試載入用戶圖片時發生錯誤。",
                variant: "destructive",
            });
            setFetchedPhotos([]);
        }
         // Don't auto-advance accordion here, let user interaction decide
    });
  }, [toast, form, handlePhotoSelection]);


  // Cleanup camera on component unmount
  useEffect(() => {
    return () => {
      stopCamera();
       if (progressIntervalRef.current) { // Clear interval on unmount
            clearInterval(progressIntervalRef.current);
       }
    };
  }, [stopCamera]);

  // Auto-fetch photos when username changes (debounced)
   useEffect(() => {
       const handler = setTimeout(() => {
            if (watchedUsername && watchedUsername === form.getValues("username")) { // Ensure it's the latest value
                 fetchUserPhotos(watchedUsername);
            } else if (!watchedUsername) {
                 // Clear photos if username is cleared
                 setFetchedPhotos([]);
                 setSelectedFetchedPhotoId(null);
                 form.setValue("photo", undefined);
                 setSelectedPhotoPreview(null);
            }
       }, 500); // Debounce time

       return () => {
           clearTimeout(handler);
       };
   }, [watchedUsername, fetchUserPhotos, form]); // Add form dependency


  // Handle form submission
  async function onSubmit(values: AvatarFormValues) {
    setGeneratedImageUrl(null);
    setGeneratedPromptText(null);
    startProgressSimulation();

    startTransition(async () => {
      try {
        // Find the full kimono and background objects based on their IDs
        const selectedKimono = kimonos.find(k => k.id === values.kimono);
        const selectedBackground = backgrounds.find(b => b.id === values.background);

        if (!selectedKimono || !selectedBackground) {
           throw new Error("無法找到所選的和服或背景資料。");
        }

         // Prepare input for the server action
        const actionInput = {
          username: values.username,
          photo: values.photo, // Pass File, data URL, or HTTP URL directly
          kimono: selectedKimono,
          background: selectedBackground,
          userDescription: values.userDescription,
        };

        console.log("Calling generateAvatarAction with input:", actionInput);
        const result = await generateAvatarAction(actionInput);
        console.log("generateAvatarAction result:", result);


        if (result.success && result.imageUrl) {
          setGeneratedImageUrl(result.imageUrl);
          setGeneratedPromptText(result.prompt || null); // Store the returned prompt
          completeProgress(); // Mark progress as complete
          toast({
            title: "頭像生成完成！🎉",
            description: "你獨一無二嘅櫻花頭像整好喇。",
          });
           setActiveAccordionItem(''); // Collapse all sections after success
        } else {
          throw new Error(result.error || "伺服器發生未知錯誤。");
        }

      } catch (error: any) {
        console.error("Generation onSubmit error:", error);
        resetProgress(); // Reset progress on error
        toast({
          title: "生成失敗 😥",
          description: error.message || "發生咗啲意料之外嘅錯誤。",
          variant: "destructive",
        });
         // Optionally keep the accordion open to the last step or relevant error step
      }
    });
  }

  const handleReset = useCallback(() => {
    stopCamera();
    setGeneratedImageUrl(null);
    setGeneratedPromptText(null);
    resetProgress(); // Reset progress bar
    const currentUsername = form.getValues("username"); // Keep current username
    form.reset({
      username: currentUsername, // Keep username
      photo: undefined,
      kimono: "",
      background: "",
      userDescription: ""
    });
    setSelectedPhotoPreview(null);
    setSelectedFetchedPhotoId(null);

     // Refetch photos for the current user to potentially auto-select
     if (currentUsername) {
        fetchUserPhotos(currentUsername);
     } else {
        setFetchedPhotos([]);
     }

    setActiveAccordionItem('username-section'); // Go back to first step
  }, [form, fetchUserPhotos, stopCamera]);


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
                 if (file) {
                     e.target.value = ''; // Reset file input to allow re-selection of the same file
                     handlePhotoSelection('file', file);
                 }
              }}
              startCamera={startCamera}
              stopCamera={stopCamera}
              capturePhoto={capturePhoto}
              nextStep={() => nextStep("photo-section")} // This nextStep prop might not be needed if validation handles it
              disabled={!watchedUsername || isPending} // Disable if no username or generation is pending
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
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shirt"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg>}
              sectionId="kimono-section"
              onSelectionChange={() => form.trigger("kimono").then(isValid => isValid && setTimeout(() => nextStep("kimono-section"), 100))}
              disabled={!watchedPhoto || form.formState.errors.photo || isPending} // Disable if no valid photo or pending
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
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trees"><path d="M10 10v.2A3 3 0 0 1 7.1 13H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2.9a3 3 0 0 1 2.9 2.8V10z"/><path d="M7 14v.2A3 3 0 0 0 9.9 17H14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2.9a3 3 0 0 0-2.9 2.8V14z"/><path d="M17 14v.2A3 3 0 0 1 14.1 17H10a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2.9a3 3 0 0 1 2.9 2.8V14z"/></svg>}
              sectionId="background-section"
              onSelectionChange={() => form.trigger("background").then(isValid => isValid && setTimeout(() => nextStep("background-section"), 100))}
              disabled={!watchedKimono || form.formState.errors.kimono || isPending} // Disable if no valid kimono or pending
            />

            {/* --- Description Section --- */}
            <UserDescriptionInput
              form={form}
              value={form.watch('userDescription')}
              // Don't auto-advance on typing, let submit button handle final step
              // onValueChange={() => nextStep("description-section")}
              disabled={!watchedBackground || form.formState.errors.background || isPending} // Disable if no valid background or pending
            />

          </Accordion>


          {/* Submit Button & Progress */}
          <div className="space-y-1.5 pt-2 px-2">
             <Button
               type="submit"
               disabled={isPending || !form.formState.isValid} // Disable if pending or form is invalid
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
                   <p className="text-xs text-center text-foreground/80">努力生成緊你嘅頭像，請稍候...</p>
                 </div>
              )}
          </div>


          {/* Generated Image Display */}
          {generatedImageUrl && !isPending && (
            <GeneratedAvatarDisplay
              imageUrl={generatedImageUrl}
              prompt={generatedPromptText} // Pass the prompt text
              onReset={handleReset}
            />
          )}
        </form>
      </Form>
    </TooltipProvider>
  );
}

