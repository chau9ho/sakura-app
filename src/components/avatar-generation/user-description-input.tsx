
import React from 'react';
import { UseFormReturn, FieldValues, Path } from 'react-hook-form';
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { FormField, FormItem, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, CheckCircle2 } from 'lucide-react';

interface UserDescriptionInputProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  fieldName?: Path<T>; // Make optional if not always used
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}

const UserDescriptionInput = <T extends FieldValues>({
  form,
  fieldName = "userDescription" as Path<T>, // Default field name
  value,
  onValueChange,
  disabled = false,
}: UserDescriptionInputProps<T>) => {
  return (
    <AccordionItem value="description-section" disabled={disabled}>
      <AccordionTrigger className="text-base font-semibold hover:no-underline px-2 py-2 rounded-md hover:bg-secondary/50 data-[state=open]:bg-secondary/80 disabled:opacity-50">
        <span className="flex items-center gap-2">
          <Pencil className="h-5 w-5" />
          步驟四：加啲細節（可以唔填）
           {/* Show check only if there's content and no error */}
           {value && !form.formState.errors[fieldName] && <CheckCircle2 className="h-5 w-5 text-green-500" />}
        </span>
      </AccordionTrigger>
      <AccordionContent className="pt-1 pb-2 px-2">
        <FormField
          control={form.control}
          name={fieldName}
          render={({ field }) => (
            <FormItem className="space-y-1">
              <FormControl>
                <Textarea
                  placeholder="例如：戴眼鏡、微笑、揸住把扇..."
                  className="resize-none text-sm h-16"
                  rows={2}
                  {...field}
                  onChange={(e) => {
                    field.onChange(e); // RHF's onChange
                    if (onValueChange) {
                      onValueChange(e.target.value); // Custom onChange
                    }
                  }}
                />
              </FormControl>
              <FormDescription className="text-xs text-foreground/80 px-1 pt-1">
                加少少描述，等個頭像更加獨特（最多150字）。
              </FormDescription>
              <FormMessage className="px-1" />
            </FormItem>
          )}
        />
      </AccordionContent>
    </AccordionItem>
  );
};

export default UserDescriptionInput;
    