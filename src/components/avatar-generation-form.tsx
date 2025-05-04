
"use client";

import React, { useState, useEffect, useTransition, useCallback, useRef } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Form } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { fetchPhotosAction } from '@/app/actions/fetch-photos';
import { generateAvatarAction } from '@/app/actions/generate-avatar-action';
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
  const [generatedPromptText, setGeneratedPromptText] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isQrCodeDialogOpen, setIsQrCodeDialogOpen] = useState(false);
  const [fetchedPhotos, setFetchedPhotos] = useState<ImageOption[]>([]);
  const [selectedFetchedPhotoId, setSelectedFetchedPhotoId] = useState<string | null>(null);
  const [activeAccordionItem, setActiveAccordionItem] = useState<string>("username-section");
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null); // Track camera permission


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
  const watchedUserDescription = form.watch("userDescription"); // Watch description too

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
             console.log("Camera stream stopped.");
          } catch (error) {
             console.error("Error stopping camera stream:", error);
          }
      }
      // Only set isCapturing false if it was true
      if (isCapturing) {
          setIsCapturing(false);
      }
  }, [isCapturing]);


  // Handle photo selection (from file upload, camera, or fetched photos)
  const handlePhotoSelection = useCallback((source: 'file' | 'camera' | 'fetched', data: File | string | ImageOption) => {
    if (source !== 'camera') { // Only stop camera if not selecting a camera shot
       stopCamera();
    }
    setSelectedFetchedPhotoId(null); // Clear selection from fetched list
    form.clearErrors("photo");

    let photoValue: File | string | undefined = undefined;
    let previewUrl: string | null = null;
    let fetchedId: string | null = null;

    if (source === 'file' && data instanceof File) {
        photoValue = data;
        previewUrl = URL.createObjectURL(data); // Use createObjectURL for immediate preview
        // Revoke previous URL if exists
        if (selectedPhotoPreview && selectedPhotoPreview.startsWith('blob:')) {
            URL.revokeObjectURL(selectedPhotoPreview);
        }
    } else if (source === 'camera' && typeof data === 'string') {
        photoValue = data; // data is dataUrl
        previewUrl = data;
        // Revoke previous blob URL if exists
        if (selectedPhotoPreview && selectedPhotoPreview.startsWith('blob:')) {
             URL.revokeObjectURL(selectedPhotoPreview);
        }
    } else if (source === 'fetched' && typeof data !== 'string' && !(data instanceof File)) {
        photoValue = data.src; // Use the URL as the value
        previewUrl = data.src;
        fetchedId = data.id;
        // Revoke previous blob URL if exists
        if (selectedPhotoPreview && selectedPhotoPreview.startsWith('blob:')) {
             URL.revokeObjectURL(selectedPhotoPreview);
        }
    }

    form.setValue("photo", photoValue, { shouldValidate: true });
    setSelectedPhotoPreview(previewUrl);
    setSelectedFetchedPhotoId(fetchedId);

    // Manually advance after valid selection
    form.trigger("photo").then(isValid => {
        if (isValid) {
             // Add a slight delay to allow preview update
             setTimeout(() => nextStep("photo-section"), 100);
        }
    });

  }, [form, stopCamera, selectedPhotoPreview, nextStep]); // Add nextStep dependency


  // Start camera capture
  const startCamera = useCallback(async () => {
    console.log("Attempting to start camera...");
    stopCamera(); // Ensure any existing stream is stopped first
    setSelectedPhotoPreview(null); // Clear preview
    form.setValue("photo", undefined, { shouldValidate: false }); // Clear photo value without immediate validation
    setSelectedFetchedPhotoId(null);
    setHasCameraPermission(null); // Reset permission status

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        setHasCameraPermission(true);
        console.log("Camera permission granted.");
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsCapturing(true); // Set capturing true only after successful stream setup
          console.log("Camera stream started and playing.");
        } else {
            console.warn("Video ref not available.");
             stream.getTracks().forEach(track => track.stop()); // Stop stream if ref is missing
             setHasCameraPermission(false); // Indicate failure
        }
      } catch (err) {
        console.error("Error accessing camera: ", err);
        setHasCameraPermission(false);
        toast({
          title: "相機錯誤",
          description: "開唔到相機，請檢查你嘅瀏覽器設定有冇俾權限。",
          variant: "destructive",
        });
        setIsCapturing(false);
      }
  }, [form, toast, stopCamera]); // Added stopCamera dependency


  // Capture photo from video stream
  const capturePhoto = useCallback(() => {
    console.log("Attempting to capture photo...");
    if (videoRef.current && canvasRef.current && isCapturing) {
      const context = canvasRef.current.getContext('2d');
      const video = videoRef.current;

      // Use HAVE_ENOUGH_DATA for safer capture - ensures frame data is available
      if (context && video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        // Create a square canvas
        const size = Math.min(videoWidth, videoHeight);
        const canvasSize = 480; // Output size for the photo
        canvasRef.current.width = canvasSize;
        canvasRef.current.height = canvasSize;

        // Calculate source rectangle (crop to center square)
        const sx = (videoWidth - size) / 2;
        const sy = (videoHeight - size) / 2;
        const sWidth = size;
        const sHeight = size;

        // Draw the square portion of the video onto the square canvas
        context.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvasSize, canvasSize);
        console.log("Photo drawn to canvas.");

        const dataUrl = canvasRef.current.toDataURL('image/png'); // Use PNG for consistency
        handlePhotoSelection('camera', dataUrl); // Pass dataUrl to handler
        // handlePhotoSelection now calls stopCamera
        console.log("Photo captured successfully (as data URL).");

        // nextStep("photo-section") is now called within handlePhotoSelection

      } else {
         console.error("Capture failed: Video not ready or context unavailable.", { readyState: video.readyState, width: video.videoWidth });
         toast({ title: "影相失敗", description: "未能成功影相，請再試一次或檢查相機連接。", variant: "destructive" });
         stopCamera(); // Stop camera on failure
      }
    } else {
        console.warn("CapturePhoto called but not ready:", { isCapturing, video: !!videoRef.current, canvas: !!canvasRef.current });
    }
  }, [isCapturing, handlePhotoSelection, toast, stopCamera]); // Add stopCamera dependency


   // --- Photo Fetching Logic ---
   const fetchUserPhotos = useCallback(async (username: string) => {
    if (!username) return;
    console.log(`Fetching photos for user: ${username}`);
    startFetchingPhotosTransition(async () => {
        setFetchedPhotos([]); // Clear previous photos immediately
        const currentPhotoValue = form.getValues("photo"); // Check if a photo is already selected

        const result = await fetchPhotosAction(username);

        if (result.success) {
            setFetchedPhotos(result.photos);
            console.log(`Fetched ${result.photos.length} photos.`);
            if (result.photos.length > 0) {
                toast({
                    title: "圖片已載入",
                    description: `搵到 ${result.photos.length} 張 ${username} 嘅相。`,
                });
                 // Only auto-select if NO photo is currently selected in the form
                 if (!currentPhotoValue) {
                    console.log("Auto-selecting first fetched photo.");
                    handlePhotoSelection('fetched', result.photos[0]);
                 }
            } else {
                toast({
                    title: "未搵到圖片",
                    description: `暫時未搵到 ${username} 嘅相。試下用QR code上載？`,
                    variant: "default",
                });
                 // Clear selection only if fetch succeeds with 0 photos AND no photo was selected before
                 if (!currentPhotoValue) {
                     setSelectedFetchedPhotoId(null);
                     form.setValue("photo", undefined, { shouldValidate: false }); // Clear without validate
                     setSelectedPhotoPreview(null);
                 }
            }
        } else {
            console.error("Error fetching user photos:", result.error);
            toast({
                title: "載入圖片失敗",
                description: result.error || "嘗試載入用戶圖片時發生錯誤。",
                variant: "destructive",
            });
            setFetchedPhotos([]);
            // Clear selection only if no photo was selected before the error
            if (!currentPhotoValue) {
                setSelectedFetchedPhotoId(null);
                form.setValue("photo", undefined, { shouldValidate: false }); // Clear without validate
                setSelectedPhotoPreview(null);
            }
        }
    });
  }, [toast, form, handlePhotoSelection]); // Added form, handlePhotoSelection


  // Cleanup camera on component unmount
  useEffect(() => {
    return () => {
      console.log("AvatarGenerationForm unmounting, stopping camera.");
      stopCamera();
       if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
       }
        // Revoke blob URL on unmount
        if (selectedPhotoPreview && selectedPhotoPreview.startsWith('blob:')) {
            URL.revokeObjectURL(selectedPhotoPreview);
        }
    };
  }, [stopCamera, selectedPhotoPreview]);

  // Auto-fetch photos when username changes (debounced)
   useEffect(() => {
       const handler = setTimeout(() => {
            const currentUsername = form.getValues("username");
            if (watchedUsername && watchedUsername === currentUsername) { // Ensure it's the latest value
                 console.log(`Debounced: Fetching photos for ${watchedUsername}`);
                 fetchUserPhotos(watchedUsername);
            } else if (!watchedUsername && !currentUsername) { // Only clear if both watched and actual are empty
                 console.log("Debounced: Clearing fetched photos as username is empty.");
                 setFetchedPhotos([]);
                 setSelectedFetchedPhotoId(null);
                 form.setValue("photo", undefined, { shouldValidate: false }); // Don't trigger validation on clear
                 setSelectedPhotoPreview(null);
            }
       }, 500); // Debounce time

       return () => {
           clearTimeout(handler);
       };
   }, [watchedUsername, fetchUserPhotos, form]);


  // Handle form submission
  async function onSubmit(values: AvatarFormValues) {
    console.log("Form submitted with values:", {
        username: values.username,
        photoType: typeof values.photo === 'string' ? (values.photo.startsWith('data:') ? 'dataUrl' : 'url') : 'file',
        kimono: values.kimono,
        background: values.background,
        userDescription: values.userDescription,
    });
    setGeneratedImageUrl(null);
    setGeneratedPromptText(null);
    startProgressSimulation();

    startTransition(async () => {
      try {
        // Find the full kimono and background objects based on their IDs
        const selectedKimono = kimonos.find(k => k.id === values.kimono);
        const selectedBackground = backgrounds.find(b => b.id === values.background);

        if (!selectedKimono) {
           throw new Error(`無法找到所選的和服資料 (ID: ${values.kimono})。`);
        }
        if (!selectedBackground) {
            throw new Error(`無法找到所選的背景資料 (ID: ${values.background})。`);
        }
         if (!values.photo) {
             throw new Error("未揀相片。");
         }

         // Prepare input for the server action
        const actionInput = {
          username: values.username,
          photo: values.photo, // Pass File, data URL, or HTTP URL directly
          kimono: selectedKimono,
          background: selectedBackground,
          userDescription: values.userDescription,
        };

        console.log("Calling generateAvatarAction with prepared input...");
        const result = await generateAvatarAction(actionInput);
        console.log("generateAvatarAction result received:", result);


        if (result.success && result.imageUrl) {
          setGeneratedImageUrl(result.imageUrl);
          setGeneratedPromptText(result.prompt || null);
          completeProgress();
          toast({
            title: "頭像生成完成！🎉",
            description: "你獨一無二嘅櫻花頭像整好喇。",
          });
           setActiveAccordionItem(''); // Collapse all sections after success
        } else {
           // Use the specific error from the action if available
           const errorMessage = result.error || "伺服器發生未知錯誤。";
           console.error("Generation failed in action:", errorMessage);
           throw new Error(errorMessage); // Throw the specific error
        }

      } catch (error: any) {
        console.error("Generation onSubmit catch block:", error);
        resetProgress(); // Reset progress on error
        toast({
          title: "生成失敗 😥",
          // Display the caught error message
          description: error.message || "發生咗啲意料之外嘅錯誤。",
          variant: "destructive",
        });
         // Keep accordion open to the last step or relevant error step?
         // For now, let's not change the active item on error.
      }
    });
  }

  const handleReset = useCallback(() => {
    console.log("Resetting form...");
    stopCamera();
    setGeneratedImageUrl(null);
    setGeneratedPromptText(null);
    resetProgress();
    const currentUsername = form.getValues("username");
    form.reset({
      username: currentUsername,
      photo: undefined,
      kimono: "",
      background: "",
      userDescription: ""
    });

    // Revoke blob URL on reset
    if (selectedPhotoPreview && selectedPhotoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(selectedPhotoPreview);
    }
    setSelectedPhotoPreview(null);
    setSelectedFetchedPhotoId(null);

     if (currentUsername) {
        fetchUserPhotos(currentUsername);
     } else {
        setFetchedPhotos([]);
     }

    setActiveAccordionItem('username-section');
    setHasCameraPermission(null); // Reset camera permission status
  }, [form, fetchUserPhotos, stopCamera, selectedPhotoPreview]);


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
                     console.log("File selected:", file.name, file.size, file.type);
                     e.target.value = ''; // Reset file input
                     handlePhotoSelection('file', file);
                 }
              }}
              startCamera={startCamera}
              stopCamera={stopCamera}
              capturePhoto={capturePhoto}
              nextStep={() => nextStep("photo-section")}
              disabled={!watchedUsername || isPending} // Disable if no username or generation is pending
              hasCameraPermission={hasCameraPermission} // Pass permission status
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
              disabled={!watchedPhoto || !!form.formState.errors.photo || isPending} // Disable if no valid photo or pending
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
              disabled={!watchedKimono || !!form.formState.errors.kimono || isPending} // Disable if no valid kimono or pending
            />

            {/* --- Description Section --- */}
            <UserDescriptionInput
              form={form}
              value={watchedUserDescription}
              onValueChange={(value) => form.setValue('userDescription', value, { shouldValidate: true })} // Ensure value updates RHF
              disabled={!watchedBackground || !!form.formState.errors.background || isPending} // Disable if no valid background or pending
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
              prompt={generatedPromptText}
              onReset={handleReset}
            />
          )}
        </form>
      </Form>
    </TooltipProvider>
  );
}

