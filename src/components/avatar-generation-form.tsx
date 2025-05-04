
"use client";

import React, { useState, useEffect, useTransition, useCallback, useRef } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Form } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { fetchPhotosAction } from '@/app/actions/fetch-photos';
import { generateAvatarAction, type GenerateAvatarResult } from '@/app/actions/generate-avatar-action';
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
  const [stream, setStream] = useState<MediaStream | null>(null); // Store the stream
  const captureTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref for capture timeout


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
   const nextStep = useCallback((currentStep: string) => {
    const steps = ["username-section", "photo-section", "kimono-section", "background-section", "description-section"];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
        // Only advance if the current step is valid
        const fieldName = currentStep.split('-')[0] as keyof AvatarFormValues;
        // Check error specifically for the field associated with the current step
        // Use form.getFieldState to get the error status reliably
        const fieldState = form.getFieldState(fieldName || 'username');
        if (!fieldState.error) {
             setActiveAccordionItem(steps[currentIndex + 1]);
        }
    }
   }, [form]); // Dependency on form


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
        // Faster increments initially, then slower
        let increment = 5;
        if (prev < 30) increment = 10;
        else if (prev < 60) increment = 7;
        else if (prev < 85) increment = 4;
        else increment = 2;
        return Math.min(prev + increment, 95);
      });
    }, 300); // Update more frequently
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

   // --- Camera Control Functions ---

   // Stop camera stream - make it stable
   const stopCamera = useCallback(() => {
     console.log("Attempting to stop camera stream..."); // Debug log
     if (stream) {
        stream.getTracks().forEach(track => {
            console.log(`Stopping track: ${track.label}, state: ${track.readyState}`);
            track.stop();
        });
        console.log("MediaStream tracks stopped.");
        setStream(null); // Clear the stream state
     } else {
        console.log("No active stream found to stop.");
     }
     if (videoRef.current && videoRef.current.srcObject) {
        // Ensure video src is cleared
        videoRef.current.srcObject = null;
        console.log("Video element srcObject cleared.");
     } else {
        console.log("No srcObject to clear on video element.");
     }
      setIsCapturing(false); // Always set capturing to false when stopping
      console.log("Set isCapturing to false.");
      // Clear any pending capture timeout
      if (captureTimeoutRef.current) {
        clearTimeout(captureTimeoutRef.current);
        captureTimeoutRef.current = null;
        console.log("Cleared pending capture timeout.");
      }
  }, [stream]); // Depend only on the stream state itself


  // Handle photo selection (from file upload, camera, or fetched photos)
  const handlePhotoSelection = useCallback((source: 'file' | 'camera' | 'fetched', data: File | string | ImageOption) => {
    // Don't stop camera if the source is 'camera', it will be stopped after capture
    if (source !== 'camera') {
       stopCamera();
    }
    setSelectedFetchedPhotoId(null); // Clear selection from fetched list
    form.clearErrors("photo");

    let photoValue: File | string | undefined = undefined;
    let previewUrl: string | null = null;
    let fetchedId: string | null = null;

    // Revoke previous blob URL if it exists
    if (selectedPhotoPreview && selectedPhotoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(selectedPhotoPreview);
    }

    if (source === 'file' && data instanceof File) {
        photoValue = data;
        previewUrl = URL.createObjectURL(data); // Use createObjectURL for immediate preview
    } else if (source === 'camera' && typeof data === 'string') {
        photoValue = data; // data is dataUrl
        previewUrl = data;
    } else if (source === 'fetched' && typeof data !== 'string' && !(data instanceof File)) {
        photoValue = data.src; // Use the URL as the value
        previewUrl = data.src;
        fetchedId = data.id;
    }

    form.setValue("photo", photoValue, { shouldValidate: true });
    setSelectedPhotoPreview(previewUrl);
    setSelectedFetchedPhotoId(fetchedId);

    // Manually trigger validation and advance after valid selection
    form.trigger("photo").then(isValid => {
        if (isValid) {
             // Add a slight delay to allow preview update before moving
             setTimeout(() => nextStep("photo-section"), 150);
        }
    });

  }, [form, stopCamera, selectedPhotoPreview, nextStep]); // Add nextStep dependency


  // Start camera capture
  const startCamera = useCallback(async () => {
    console.log("Attempting to start camera...");
    if (isCapturing || stream) {
        console.log("Camera already running or starting, stopping first.");
        stopCamera(); // Ensure any existing stream is stopped first
        await new Promise(resolve => setTimeout(resolve, 100)); // Delay
    }

    setSelectedPhotoPreview(null);
    form.setValue("photo", undefined, { shouldValidate: false });
    setSelectedFetchedPhotoId(null);
    setHasCameraPermission(null); // Reset
    setIsCapturing(true); // Set capturing true immediately to show video element

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      setStream(newStream); // Store the stream
      setHasCameraPermission(true);
      console.log("Camera permission granted.");

      if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          console.log("srcObject assigned to video element.");

          // Wait for video to be ready and play it
          await new Promise<void>((resolve, reject) => {
              const videoElement: HTMLVideoElement | null = videoRef.current;
              if (!videoElement) {
                  reject("Video ref became null during setup.");
                  return;
              }

              const onCanPlay = async () => {
                  console.log("Video 'canplay' event triggered.");
                  try {
                      videoElement.removeEventListener('canplay', onCanPlay);
                      videoElement.removeEventListener('error', onError);
                      if (videoElement) { // Check ref again
                          await videoRef.current.play();
                          console.log("Video stream started and playing.");
                          resolve();
                      } else {
                          reject("Video ref became null before playing.");
                      }
                  } catch (playError) {

                      console.error("Error playing video stream:", playError);
                      reject(playError);
                  }
              };

              const onError = (e: Event) => {
                  videoElement.removeEventListener('canplay', onCanPlay);
                  videoElement.removeEventListener('error', onError);
                  console.error("Video element error during setup:", e);
                  reject(e);
              };

              videoElement.addEventListener('canplay', onCanPlay);
              videoElement.addEventListener('error', onError);

              // Handle race condition: If video is already playable
              if (videoElement && videoElement.readyState >= videoElement.HAVE_ENOUGH_DATA) {
                  console.log("Video can already play, attempting play directly.");
                  onCanPlay();
              } else {
                  console.log("Waiting for 'canplay' event...");
              }
          });
      } else {
        console.warn("Video ref not available after getting stream.");
        newStream.getTracks().forEach(track => track.stop());
        setStream(null);
        setIsCapturing(false); // Ensure state is correct
        throw new Error("Video element reference is missing.");
      }
    } catch (err: any) {
       console.error("Error accessing or starting camera: ", err);
      setHasCameraPermission(false);
      toast({
        title: "相機錯誤",
        description: `開唔到相機: ${err.message || '請檢查你嘅瀏覽器設定有冇俾權限。'}`,
        variant: "destructive",
      });
      setIsCapturing(false);
      stopCamera(); // Ensure cleanup if error occurs
      setStream(null); // Explicitly set stream to null on error
    }
  }, [form, toast, stopCamera, isCapturing, stream]); // Dependencies


  // Capture photo from video stream
  const capturePhoto = useCallback(() => {
    console.log("Attempting to capture photo..."); // Debugging line

    if (captureTimeoutRef.current) {
        clearTimeout(captureTimeoutRef.current);
        captureTimeoutRef.current = null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
        console.error("Capture failed: Video or Canvas ref is missing.");
        toast({ title: "影相失敗", description: "內部錯誤：找不到影片或畫布元件。", variant: "destructive" });
        stopCamera();
        return;
    }

    if (!isCapturing || !stream) {
        console.warn("Capture called when not actively capturing or stream is null.");
        return;
    }

    const attemptCapture = (retries = 3, delay = 100) => {
        console.log(`Attempting capture (Retry ${4 - retries})`);
        const context = canvas.getContext('2d');

        if (context && video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth > 0 && video.videoHeight > 0 && !video.paused) {
            try {
                console.log("Video is ready, drawing to canvas.");
                const videoWidth = video.videoWidth;
                const videoHeight = video.videoHeight;
                const size = Math.min(videoWidth, videoHeight); // Use the smaller dimension for square crop
                const canvasSize = 480; // Target canvas size
                canvas.width = canvasSize;
                canvas.height = canvasSize;

                // Calculate source rectangle (sx, sy, sWidth, sHeight) to center the crop
                const sx = (videoWidth - size) / 2;
                const sy = (videoHeight - size) / 2;

                // Mirror the canvas context
                context.translate(canvasSize, 0);
                context.scale(-1, 1);

                // Draw the centered, cropped, and mirrored image onto the canvas
                context.drawImage(video, sx, sy, size, size, 0, 0, canvasSize, canvasSize);

                // Reset the transform to avoid affecting future drawings
                context.setTransform(1, 0, 0, 1, 0, 0);
                console.log("Photo drawn to canvas (centered, square, mirrored).");

                const dataUrl = canvas.toDataURL('image/png');
                stopCamera(); // Stop the camera *after* successful capture
                handlePhotoSelection('camera', dataUrl);
                console.log("Photo captured successfully (as data URL).");

            } catch (drawError) {
                console.error("Error drawing image to canvas:", drawError);
                toast({ title: "影相失敗", description: "繪製圖像時發生錯誤。", variant: "destructive" });
                stopCamera();
            }
        } else {
            // Log more details
             console.error("Capture failed: Video not ready or context unavailable.", { readyState: video.readyState, width: video.videoWidth, height: video.videoHeight, contextExists: !!context });
            if (retries > 0) {
                console.log(`Retrying capture in ${delay}ms...`);
                captureTimeoutRef.current = setTimeout(() => attemptCapture(retries - 1, delay * 2), delay);
            } else {
                console.error("Capture failed after multiple retries: Video not ready or context unavailable.");
                toast({ title: "影相失敗", description: "未能成功影相，請再試一次或檢查相機連接。", variant: "destructive" });
                stopCamera();
            }
        }
    };

    attemptCapture(); // Start the capture attempt process

}, [isCapturing, stream, handlePhotoSelection, toast, stopCamera]); // Added stream dependency


   // --- Photo Fetching Logic ---
   const fetchUserPhotos = useCallback(async (username: string, isUserTriggered: boolean = false) => {
    if (!username) {
         console.log("Fetch photos skipped: no username provided.");
         return;
    }
    console.log(`Fetching photos for user: ${username}, Triggered by user: ${isUserTriggered}`);
    let showFetchingIndicator = isUserTriggered; // Only show spinner if user clicked refresh

    // Only start transition (show spinner) if user triggered
    const fetchLogic = async () => {
      // Only clear existing photos if explicitly triggered by user,
      // otherwise keep them for a smoother experience while typing username
      if (showFetchingIndicator) {
          setFetchedPhotos([]); // Clear only when user explicitly refreshes
      }

      const result = await fetchPhotosAction(username);

      if (result.success) {
          setFetchedPhotos(result.photos);
          console.log(`Fetched ${result.photos.length} photos.`);
          if (result.photos.length > 0) {
              // Don't toast if not user triggered
              // if (showFetchingIndicator) {
              //     toast({
              //         title: "圖片已載入",
              //         description: `搵到 ${result.photos.length} 張 ${username} 嘅相。`,
              //     });
              // }
              // Auto-select the first photo if none is currently selected
              const currentPhotoValue = form.getValues("photo");
              if (!currentPhotoValue && !selectedPhotoPreview && result.photos[0]) {
                  console.log("Auto-selecting first fetched photo.");
                  handlePhotoSelection('fetched', result.photos[0]);
              }
          } else {
              // Only show "not found" toast if the fetch was triggered by the user explicitly and not looping
              if (showFetchingIndicator) {
                // Don't show the toast immediately, prevent flashing
                //   toast({
                //       title: "未搵到圖片",
                //       description: `暫時未搵到 ${username} 嘅相。試下用QR code上載？`,
                //       variant: "default", // Use default variant, not destructive
                //       duration: 3000, // Shorter duration
                //   });
              }
              // Don't clear selection if fetch succeeds with 0 photos, user might have uploaded/captured one
              const currentPhotoValue = form.getValues("photo");
               if (!currentPhotoValue && !selectedPhotoPreview) {
                   setSelectedFetchedPhotoId(null);
               }
          }
      } else {
          console.error("Error fetching user photos:", result.error);
          toast({
              title: "載入圖片失敗",
              description: result.error || "嘗試載入用戶圖片時發生錯誤。",
              variant: "destructive",
          });
           setFetchedPhotos([]); // Clear photos on error
           const currentPhotoValue = form.getValues("photo");
           if (!currentPhotoValue && !selectedPhotoPreview) {
              setSelectedFetchedPhotoId(null);
              form.setValue("photo", undefined, { shouldValidate: false });
              setSelectedPhotoPreview(null);
          }
      }
    };

    if (showFetchingIndicator) {
        startFetchingPhotosTransition(fetchLogic);
    } else {
        fetchLogic(); // Run directly without transition if not user triggered
    }

  }, [toast, form, handlePhotoSelection, startFetchingPhotosTransition, selectedPhotoPreview]); // Added dependencies


  // Cleanup camera on component unmount
  useEffect(() => {
    const cleanup = stopCamera;
    return () => {
      console.log("AvatarGenerationForm unmounting, running cleanup (stopCamera).");
      cleanup();
       if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
       }
        if (selectedPhotoPreview && selectedPhotoPreview.startsWith('blob:')) {
            URL.revokeObjectURL(selectedPhotoPreview);
        }
        if (captureTimeoutRef.current) {
            clearTimeout(captureTimeoutRef.current);
        }
    };
  }, [stopCamera, selectedPhotoPreview]);


  // Auto-fetch photos when username changes (debounced)
  // Modified to not fetch immediately on load unless username persists
    useEffect(() => {
      const handler = setTimeout(() => {
          const currentUsername = form.getValues("username");
          // Only fetch if username is stable and not empty
          if (watchedUsername && watchedUsername === currentUsername && currentUsername.length > 0) {
              console.log(`Debounced: Fetching photos for ${watchedUsername}`);
              fetchUserPhotos(watchedUsername, false); // Not user triggered
          } else if (!watchedUsername && !currentUsername) {
               // Clear photos only if username is actively cleared
               console.log("Debounced: Clearing fetched photos as username is empty.");
               setFetchedPhotos([]);
               setSelectedFetchedPhotoId(null);
               const currentPhotoValue = form.getValues("photo");
               // Only clear preview if it's from fetched photos
               if (typeof currentPhotoValue === 'string' && currentPhotoValue.startsWith('http')) {
                   form.setValue("photo", undefined, { shouldValidate: false });
                   setSelectedPhotoPreview(null);
               }
          }
      }, 700); // Slightly longer debounce time

      return () => {
          clearTimeout(handler);
      };
  }, [watchedUsername, fetchUserPhotos, form]); // form dependency for getValues


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
        let result: GenerateAvatarResult = { success: false, error: "未知錯誤" }; // Default error
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
            result = await generateAvatarAction(actionInput); // Assign result here
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
            // Throw error using the result's error message
            throw new Error(result.error || "伺服器發生未知錯誤。");
            }

        } catch (error: any) {
            console.error("Generation onSubmit catch block:", error);
            resetProgress(); // Reset progress on error
            toast({
            title: "生成失敗 😥",
            // Display the caught error message, or the result error if available
            description: error.message || result?.error || "發生咗啲意料之外嘅錯誤。",
            variant: "destructive",
            });
            // Keep accordion open to the last step or relevant error step?
            // For now, let's not change the active item on error.
        }
    });
  }

  const handleReset = useCallback(() => {
    console.log("Resetting form...");
    stopCamera(); // Ensure camera is stopped
    setGeneratedImageUrl(null);
    setGeneratedPromptText(null);
    resetProgress();
    const currentUsername = form.getValues("username");
    form.reset({
      username: currentUsername, // Keep username
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

     // Re-fetch photos for the current user if username exists
     if (currentUsername) {
        fetchUserPhotos(currentUsername, false); // Non-user triggered fetch
     } else {
        setFetchedPhotos([]); // Clear if no username
     }

    setActiveAccordionItem('username-section'); // Go back to first step
    setHasCameraPermission(null); // Reset camera permission status
  }, [form, fetchUserPhotos, stopCamera, selectedPhotoPreview]); // Dependencies are stable


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
              // Pass true for isUserTriggered when refresh button is clicked
              fetchUserPhotos={fetchUserPhotos} // Pass the stable fetchUserPhotos function
              isFetchingPhotos={isFetchingPhotos}
              fetchedPhotos={fetchedPhotos}
              selectedFetchedPhotoId={selectedFetchedPhotoId}
              handlePhotoSelection={handlePhotoSelection}
              handleFileUploadChange={(e) => {
                 const file = e.target.files?.[0];
                 if (file) {
                     console.log("File selected:", file.name, file.size, file.type);
                     // Pass the file to the handler
                     handlePhotoSelection('file', file);
                     e.target.value = ''; // Reset file input after selection is handled
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
              disabled={!watchedPhoto || !!form.getFieldState("photo").error || isPending} // Disable if no valid photo or pending
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
              disabled={!watchedKimono || !!form.getFieldState("kimono").error || isPending} // Disable if no valid kimono or pending
            />

            {/* --- Description Section --- */}
            <UserDescriptionInput
              form={form}
              value={watchedUserDescription}
              onValueChange={(value) => form.setValue('userDescription', value, { shouldValidate: true })} // Ensure value updates RHF
              disabled={!watchedBackground || !!form.getFieldState("background").error || isPending} // Disable if no valid background or pending
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

