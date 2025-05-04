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
import { Loader2, Upload, Camera, Sparkles } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

// Mock data for kimonos and backgrounds - replace with actual data fetching or config
const kimonos = [
  { id: 'k1', name: 'Classic Pink Floral', description: 'Traditional pink kimono with cherry blossom patterns.', image: 'https://picsum.photos/100/100?random=1' , dataAiHint: 'pink floral kimono' },
  { id: 'k2', name: 'Elegant Blue Wave', description: 'Deep blue kimono featuring artistic wave designs.', image: 'https://picsum.photos/100/100?random=2', dataAiHint: 'blue wave kimono' },
  { id: 'k3', name: 'Golden Crane', description: 'Luxurious gold and white kimono with crane motifs.', image: 'https://picsum.photos/100/100?random=3', dataAiHint: 'gold crane kimono' },
  { id: 'k4', name: 'Spring Green Bamboo', description: 'Light green kimono with subtle bamboo leaf patterns.', image: 'https://picsum.photos/100/100?random=4', dataAiHint: 'green bamboo kimono' },
];

const backgrounds = [
  { id: 'b1', name: 'Sakura Park Path', description: 'A serene park path lined with blooming cherry blossom trees.', image: 'https://picsum.photos/100/100?random=5', dataAiHint: 'sakura park path' },
  { id: 'b2', name: 'Mountain View Temple', description: 'A traditional temple overlooking mountains shrouded in mist.', image: 'https://picsum.photos/100/100?random=6', dataAiHint: 'mountain temple view' },
  { id: 'b3', name: 'Night Festival Lanterns', description: 'A vibrant night festival scene with glowing lanterns.', image: 'https://picsum.photos/100/100?random=7', dataAiHint: 'night festival lanterns' },
  { id: 'b4', name: 'Zen Garden Bridge', description: 'A peaceful zen garden featuring a wooden bridge over a koi pond.', image: 'https://picsum.photos/100/100?random=8', dataAiHint: 'zen garden bridge' },
];

const formSchema = z.object({
  photo: z.any().refine(file => file instanceof File || typeof file === 'string', { // Allow File or string (for captured image data URL)
    message: "Please upload or capture a photo.",
  }),
  kimono: z.string().min(1, { message: "Please select a kimono." }),
  background: z.string().min(1, { message: "Please select a background." }),
  userDescription: z.string().max(150, { message: "Description cannot exceed 150 characters." }).optional(),
});

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
          videoRef.current.play();
        }
      } catch (err) {
        console.error("Error accessing camera: ", err);
        toast({
          title: "Camera Error",
          description: "Could not access the camera. Please ensure permissions are granted.",
          variant: "destructive",
        });
        setIsCapturing(false);
      }
    }
  };

  // Capture photo from video stream
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        // Set canvas dimensions based on video aspect ratio
        const videoWidth = videoRef.current.videoWidth;
        const videoHeight = videoRef.current.videoHeight;
        canvasRef.current.width = videoWidth;
        canvasRef.current.height = videoHeight;

        context.drawImage(videoRef.current, 0, 0, videoWidth, videoHeight);
        const dataUrl = canvasRef.current.toDataURL('image/png');
        setSelectedPhotoPreview(dataUrl); // Show captured photo preview
        form.setValue("photo", dataUrl); // Set form value to data URL
        stopCamera(); // Stop camera after capture
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
      }, 500);

      try {
        const selectedKimono = kimonos.find(k => k.id === values.kimono);
        const selectedBackground = backgrounds.find(b => b.id === values.background);

        if (!selectedKimono || !selectedBackground) {
          throw new Error("Invalid kimono or background selection.");
        }

        // 1. Generate Prompt using AI Flow
         setProgress(10);
        const promptResult = await generateAvatarPrompt({
          kimono: selectedKimono.description,
          background: selectedBackground.description,
          userDescription: values.userDescription,
        });
         setProgress(30);

         console.log("Generated Prompt:", promptResult.prompt);
         toast({
            title: "Prompt Generated",
            description: `Using prompt: ${promptResult.prompt.substring(0, 50)}...`,
         });


        // 2. TODO: Integrate with actual image generation API (e.g., ComfyUI, Stable Diffusion)
        // This part requires setting up the backend call to your image generation service.
        // You would pass the generated prompt and the uploaded/captured photo.
        // For now, we simulate the process and use a placeholder image.

        console.log("Simulating image generation with:", {
          prompt: promptResult.prompt,
          photo: values.photo instanceof File ? values.photo.name : "Captured Photo",
          // Include other parameters needed by your image generation API
        });

        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 3000));
         setProgress(90);


        // Replace with actual generated image URL from the API response
        const simulatedImageUrl = `https://picsum.photos/512/512?random=${Date.now()}`;
        setGeneratedImageUrl(simulatedImageUrl);
        setProgress(100);

        toast({
          title: "Avatar Generated!",
          description: "Your unique sakura avatar is ready.",
        });

      } catch (error) {
        console.error("Error generating avatar:", error);
        toast({
          title: "Generation Failed",
          description: error instanceof Error ? error.message : "An unexpected error occurred.",
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

        {/* Photo Input */}
         <FormField
          control={form.control}
          name="photo"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-lg font-semibold">Your Photo</FormLabel>
              <FormControl>
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="flex-1 space-y-2">
                     <div className="relative w-full aspect-square border border-dashed border-primary/50 rounded-lg flex items-center justify-center bg-secondary/50 overflow-hidden">
                        {selectedPhotoPreview ? (
                        <Image
                            src={selectedPhotoPreview}
                            alt="Selected photo preview"
                            layout="fill"
                            objectFit="contain"
                         />
                        ) : isCapturing && videoRef.current ? (
                             <video ref={videoRef} className="w-full h-full object-cover" />
                        ) : (
                        <div className="text-center text-muted-foreground p-4">
                            <Upload className="mx-auto h-12 w-12 mb-2" />
                            <span>Upload or capture a photo</span>
                        </div>
                        )}
                     </div>
                      {/* Hidden canvas for capturing photo */}
                     <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

                     {/* Action Buttons */}
                      <div className="flex gap-2">
                          {!isCapturing ? (
                            <>
                              <Button type="button" variant="outline" className="flex-1 relative">
                                 <Upload className="mr-2 h-4 w-4" />
                                 Upload Photo
                                 <Input
                                    type="file"
                                    accept="image/*"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={handlePhotoChange}
                                  />
                              </Button>
                              <Button type="button" variant="outline" className="flex-1" onClick={startCamera}>
                                <Camera className="mr-2 h-4 w-4" />
                                Capture Photo
                              </Button>
                            </>
                          ) : (
                             <>
                              <Button type="button" variant="destructive" className="flex-1" onClick={stopCamera}>
                                Cancel
                              </Button>
                              <Button type="button" variant="default" className="flex-1" onClick={capturePhoto}>
                                 Take Picture
                              </Button>
                             </>
                          )}
                       </div>
                   </div>


                </div>
              </FormControl>
              <FormDescription>
                Upload a clear photo of yourself or capture one using your camera.
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
              <FormLabel className="text-lg font-semibold">Choose a Kimono</FormLabel>
                 <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a kimono style" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                       {kimonos.map((kimono) => (
                        <SelectItem key={kimono.id} value={kimono.id}>
                           <div className="flex items-center gap-3 py-1">
                              <Image
                                src={kimono.image}
                                alt={kimono.name}
                                width={40}
                                height={40}
                                className="rounded-sm"
                                data-ai-hint={kimono.dataAiHint}
                              />
                             <div>
                                <p className="font-medium">{kimono.name}</p>
                                <p className="text-xs text-muted-foreground">{kimono.description}</p>
                              </div>
                           </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                 </Select>
              <FormDescription>
                Select the kimono style for your avatar.
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
              <FormLabel className="text-lg font-semibold">Choose a Background</FormLabel>
               <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a background scene" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                       {backgrounds.map((bg) => (
                         <SelectItem key={bg.id} value={bg.id}>
                            <div className="flex items-center gap-3 py-1">
                              <Image
                                src={bg.image}
                                alt={bg.name}
                                width={40}
                                height={40}
                                className="rounded-sm"
                                data-ai-hint={bg.dataAiHint}
                              />
                              <div>
                                <p className="font-medium">{bg.name}</p>
                                <p className="text-xs text-muted-foreground">{bg.description}</p>
                              </div>
                            </div>
                         </SelectItem>
                       ))}
                    </SelectContent>
                  </Select>
              <FormDescription>
                Select the background scene for your avatar.
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
               <FormLabel className="text-lg font-semibold">Additional Details (Optional)</FormLabel>
               <FormControl>
                 <Textarea
                   placeholder="e.g., wearing glasses, smiling gently, holding a fan..."
                   className="resize-none"
                   {...field}
                 />
               </FormControl>
               <FormDescription>
                 Add a short description to further customize your avatar (max 150 chars).
               </FormDescription>
               <FormMessage />
             </FormItem>
           )}
         />


         {/* Submit Button & Progress */}
        <div className="space-y-4">
           <Button type="submit" disabled={isPending} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                 <>
                   <Sparkles className="mr-2 h-4 w-4" />
                   Generate Avatar
                 </>
              )}
            </Button>
            {isPending && (
              <div className="space-y-2">
                 <Progress value={progress} className="w-full [&>div]:bg-accent" />
                 <p className="text-sm text-center text-muted-foreground">Generating your avatar, please wait...</p>
               </div>
            )}
        </div>


        {/* Generated Image Display */}
        {generatedImageUrl && (
          <Card className="mt-8 border-accent/50">
            <CardContent className="p-4">
               <Alert variant="default" className="mb-4 border-accent bg-accent/10">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <AlertTitle className="text-accent font-semibold">Generation Complete!</AlertTitle>
                  <AlertDescription>
                    Your beautiful Sakura Avatar is ready. Right-click or long-press to save.
                  </AlertDescription>
                </Alert>
              <div className="aspect-square relative w-full max-w-md mx-auto rounded-lg overflow-hidden shadow-md">
                <Image
                  src={generatedImageUrl}
                  alt="Generated Avatar"
                  layout="fill"
                  objectFit="cover"
                  data-ai-hint="generated avatar portrait"
                />
              </div>
            </CardContent>
          </Card>
        )}
      </form>
    </Form>
  );
}
