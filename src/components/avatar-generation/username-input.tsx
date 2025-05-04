
import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { User, CheckCircle2 } from 'lucide-react';
import type { AvatarFormValues } from '../avatar-generation-form'; // Adjust path as needed

interface UsernameInputProps {
  form: UseFormReturn<AvatarFormValues>;
  nextStep: () => void;
}

const UsernameInput: React.FC<UsernameInputProps> = ({ form, nextStep }) => {
  const watchedUsername = form.watch("username");

  // Handle Enter key press to move to the next step
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && watchedUsername && !form.formState.errors.username) {
      event.preventDefault(); // Prevent default form submission on Enter
      nextStep();
    }
  };


  return (
    <AccordionItem value="username-section">
      <AccordionTrigger className="text-base font-semibold hover:no-underline px-2 py-2 rounded-md hover:bg-secondary/50 data-[state=open]:bg-secondary/80">
        <span className="flex items-center gap-2">
          <User className="h-5 w-5" />
          步驟零：入個靚名
          {watchedUsername && !form.formState.errors.username && <CheckCircle2 className="h-5 w-5 text-green-500" />}
        </span>
      </AccordionTrigger>
      <AccordionContent className="pt-1 pb-2 px-2">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem className="px-2">
              <FormLabel className="text-base font-semibold flex items-center gap-2 sr-only"> {/* Hide visible label as it's in Trigger */}
                步驟零：入個靚名
              </FormLabel>
              <FormControl>
                <Input
                    placeholder="例如：櫻花武士"
                    {...field}
                    className="text-sm"
                    onBlur={() => { // Move to next step on blur if valid
                        if (watchedUsername && !form.formState.errors.username) {
                            nextStep();
                        }
                    }}
                    onKeyDown={handleKeyDown} // Handle Enter key
                />
              </FormControl>
              <FormDescription className="text-xs text-foreground/80 pt-1">
                呢個名會用嚟幫你搵返上載咗嘅相。撳 Enter 或者點擊其他地方確認。
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </AccordionContent>
    </AccordionItem>
  );
};

export default UsernameInput;
    