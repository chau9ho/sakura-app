
import React from 'react';
import { UseFormReturn, FieldValues, Path } from 'react-hook-form';
import Image from 'next/image';
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { FormField, FormItem, FormControl, FormDescription, FormMessage, FormLabel } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CheckCircle2 } from 'lucide-react';
import type { ImageOption } from './types'; // Adjust path as needed
import type { AvatarFormValues } from '../avatar-generation-form'; // Adjust path as needed

interface ImageSelectionGridProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  fieldName: Path<T>;
  label: string;
  description: string;
  options: ImageOption[];
  value: string; // Current value from form.watch
  aspectRatio?: string; // e.g., 'aspect-square', 'aspect-[2/3]'
  icon: React.ReactNode;
  sectionId: string;
  onSelectionChange?: () => void; // Optional callback on change
  disabled?: boolean;
}

const ImageSelectionGrid = <T extends FieldValues>({
  form,
  fieldName,
  label,
  description,
  options,
  value,
  aspectRatio = 'aspect-square',
  icon,
  sectionId,
  onSelectionChange,
  disabled = false,
}: ImageSelectionGridProps<T>) => {
  return (
    <AccordionItem value={sectionId} disabled={disabled}>
      <AccordionTrigger className="text-base font-semibold hover:no-underline px-2 py-2 rounded-md hover:bg-secondary/50 data-[state=open]:bg-secondary/80 disabled:opacity-50">
        <span className="flex items-center gap-2">
          {icon}
          {label}
          {value && !form.formState.errors[fieldName] && <CheckCircle2 className="h-5 w-5 text-green-500" />}
        </span>
      </AccordionTrigger>
      <AccordionContent className="pt-1 pb-2 px-2">
        <FormField
          control={form.control}
          name={fieldName}
          render={({ field }) => (
            <FormItem className="space-y-1">
              <FormDescription className="text-xs text-foreground/80 px-1">
                {description}
              </FormDescription>
              <FormControl>
                <RadioGroup
                  onValueChange={(newValue) => {
                      field.onChange(newValue);
                      if (onSelectionChange) {
                          onSelectionChange();
                      }
                  }}
                  defaultValue={field.value}
                  className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5 pt-1"
                >
                  {options.map((option) => (
                    <FormItem key={option.id} className="relative group">
                      <FormControl>
                        <RadioGroupItem value={option.id} id={`${fieldName}-${option.id}`} className="sr-only peer" />
                      </FormControl>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <FormLabel
                            htmlFor={`${fieldName}-${option.id}`}
                            className={cn(
                              "block cursor-pointer rounded-md border-2 border-muted bg-popover transition-all duration-200 ease-in-out overflow-hidden",
                              "hover:border-accent hover:shadow-md",
                              "peer-data-[state=checked]:border-primary peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-primary/50 peer-data-[state=checked]:shadow-lg"
                            )}
                          >
                            <div className={cn("overflow-hidden rounded-t-md", aspectRatio)}>
                              <Image
                                src={option.src}
                                alt={option.name}
                                width={150} // Increase base size for better preview
                                height={aspectRatio === 'aspect-[2/3]' ? 225 : 150}
                                className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-110"
                                data-ai-hint={option.dataAiHint}
                                priority={options.indexOf(option) < 10} // Prioritize loading first few images
                              />
                            </div>
                            <p className="truncate text-[10px] font-medium text-center p-0.5 bg-muted/50 rounded-b-md">{option.name}</p>
                          </FormLabel>
                        </TooltipTrigger>
                        {/* Increased size for tooltip content */}
                        <TooltipContent side="bottom" className={cn("p-0 border-none bg-transparent shadow-xl flex items-center justify-center", aspectRatio === 'aspect-[2/3]' ? "w-[240px] h-[360px]" : "w-[300px] h-[300px]")}>
                          <Image
                            src={option.src}
                            alt={option.name}
                            width={aspectRatio === 'aspect-[2/3]' ? 240 : 300}
                            height={aspectRatio === 'aspect-[2/3]' ? 360 : 300}
                            className="rounded-md object-cover"
                            data-ai-hint={option.dataAiHint}
                          />
                        </TooltipContent>
                      </Tooltip>
                    </FormItem>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage className="px-1" />
            </FormItem>
          )}
        />
      </AccordionContent>
    </AccordionItem>
  );
};

export default ImageSelectionGrid;
    