
import React, { RefObject } from 'react';
import { UseFormReturn } from 'react-hook-form';
import Image from 'next/image';
import QRCode from 'qrcode.react';
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { FormField, FormItem, FormControl, FormDescription, FormMessage, FormLabel } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"; // Added Alert
import { ImageIcon, Upload, Camera, QrCode, RefreshCw, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react'; // Added AlertTriangle
import { cn } from "@/lib/utils";
import type { ImageOption } from './types';
import type { AvatarFormValues } from '../avatar-generation-form';

interface PhotoSelectionSectionProps {
  form: UseFormReturn<AvatarFormValues>;
  watchedUsername: string;
  watchedPhoto: any;
  selectedPhotoPreview: string | null;
  isCapturing: boolean;
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  isQrCodeDialogOpen: boolean;
  setIsQrCodeDialogOpen: (isOpen: boolean) => void;
  qrCodeUrl: string;
  fetchUserPhotos: (username: string, isUserTriggered?: boolean) => Promise<void>; // Updated signature
  isFetchingPhotos: boolean;
  fetchedPhotos: ImageOption[];
  selectedFetchedPhotoId: string | null;
  handlePhotoSelection: (source: 'file' | 'camera' | 'fetched', data: File | string | ImageOption) => void;
  handleFileUploadChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  capturePhoto: () => void;
  nextStep: () => void;
  disabled?: boolean;
  hasCameraPermission: boolean | null; // Added prop for permission status
}

const PhotoSelectionSection: React.FC<PhotoSelectionSectionProps> = ({
  form,
  watchedUsername,
  watchedPhoto,
  selectedPhotoPreview,
  isCapturing,
  videoRef,
  canvasRef,
  isQrCodeDialogOpen,
  setIsQrCodeDialogOpen,
  qrCodeUrl,
  fetchUserPhotos,
  isFetchingPhotos,
  fetchedPhotos,
  selectedFetchedPhotoId,
  handlePhotoSelection,
  handleFileUploadChange,
  startCamera,
  stopCamera,
  capturePhoto,
  nextStep,
  disabled = false,
  hasCameraPermission, // Destructure the new prop
}) => {
  return (
    <AccordionItem value="photo-section" disabled={disabled}>
      <AccordionTrigger className="text-base font-semibold hover:no-underline px-2 py-2 rounded-md hover:bg-secondary/50 data-[state=open]:bg-secondary/80 disabled:opacity-50">
        <span className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          步驟一：你嘅相
          {watchedPhoto && !form.formState.errors.photo && <CheckCircle2 className="h-5 w-5 text-green-500" />}
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
                      <div className="relative w-full max-w-[200px] mx-auto aspect-square border border-dashed border-primary/50 rounded-lg flex items-center justify-center bg-secondary/50 overflow-hidden">
                        {selectedPhotoPreview ? (
                          <Image
                            src={selectedPhotoPreview}
                            alt="已選相片預覽"
                            fill
                            objectFit="contain"
                            sizes="(max-width: 640px) 50vw, 200px"
                            // Ensure unique key if src can change rapidly, though fill/objectFit usually handles it
                            key={selectedPhotoPreview}
                          />
                        ) : isCapturing ? (
                           // Show video only when capturing AND permission granted
                          <video ref={videoRef} className={cn("w-full h-full object-cover", hasCameraPermission === false && "hidden")} autoPlay playsInline muted />
                        ) : (
                          <div className="text-center text-foreground/80 p-2">
                            <ImageIcon className="mx-auto h-6 w-6 mb-1" />
                            <span className="text-xs">預覽會喺度顯示</span>
                          </div>
                        )}
                         {/* Always render video element for ref, but hide it when not capturing */}
                         {!isCapturing && <video ref={videoRef} className="absolute w-px h-px -z-10 opacity-0 pointer-events-none" playsInline muted />}
                      </div>
                      {/* Hidden canvas for capturing photo */}
                      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

                      {/* Camera Permission Alert */}
                      {hasCameraPermission === false && !isCapturing && (
                        <Alert variant="destructive" className="max-w-[200px] mx-auto p-2 text-xs">
                          <AlertTriangle className="h-3 w-3" />
                          <AlertTitle className="text-xs">相機權限</AlertTitle>
                          <AlertDescription className="text-xs">
                            無法存取相機。請喺瀏覽器設定允許權限。
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-1.5 max-w-[200px] mx-auto">
                        {!isCapturing ? (
                          <>
                            {/* File Upload Button */}
                            <Button type="button" variant="outline" size="sm" className="flex-1 relative text-xs h-8 px-2">
                              <Upload className="mr-1 h-3.5 w-3.5" />
                              上載
                              <Input
                                type="file"
                                accept="image/*"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={handleFileUploadChange}
                                // Add key to force re-render if needed, though not typical for file inputs
                              />
                            </Button>
                            {/* QR Code Upload Button */}
                            <Dialog open={isQrCodeDialogOpen} onOpenChange={setIsQrCodeDialogOpen}>
                              <DialogTrigger asChild>
                                <Button type="button" variant="outline" size="sm" className="flex-1 text-xs h-8 px-2" disabled={!watchedUsername}>
                                  <QrCode className="mr-1 h-3.5 w-3.5" />
                                  QR
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
                                <Button type="button" variant="default" size="sm" onClick={() => fetchUserPhotos(watchedUsername, true)} disabled={isFetchingPhotos || !watchedUsername}>
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
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              className="flex-1 text-xs h-8 px-2"
                              onClick={capturePhoto}
                              disabled={hasCameraPermission === false} // Disable capture if no permission
                            >
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
                        <Button type="button" variant="ghost" size="sm" onClick={() => fetchUserPhotos(watchedUsername, true)} disabled={isFetchingPhotos} className="h-7 px-2 text-xs">
                          {isFetchingPhotos ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
                          整理
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
                                sizes="(max-width: 640px) 20vw, (max-width: 768px) 16vw, 12vw"
                                className="object-cover"
                                onError={(e) => {
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
                             {/* Only show this if NOT actively fetching */}
                             {!isFetchingPhotos && `未搵到用戶「${watchedUsername}」嘅相。試下用 QR code 上載？`}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              </FormControl>
              <FormDescription className="text-xs text-foreground/80 px-1 pt-1">
                用上面嘅方法揀一張相，或者揀返之前上載過嘅相。影完相之後，相片會顯示喺上面預覽區域。
              </FormDescription>
              <FormMessage className="px-1" />
            </FormItem>
          )}
        />
      </AccordionContent>
    </AccordionItem>
  );
};

export default PhotoSelectionSection;
