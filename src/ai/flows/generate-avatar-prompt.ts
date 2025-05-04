'use server';

/**
 * @fileOverview Generates an avatar prompt based on user selected kimono and background.
 *
 * - generateAvatarPrompt - A function that generates the avatar prompt.
 * - GenerateAvatarPromptInput - The input type for the generateAvatarPrompt function.
 * - GenerateAvatarPromptOutput - The return type for the generateAvatarPrompt function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const GenerateAvatarPromptInputSchema = z.object({
  kimono: z.string().describe('The selected kimono for the avatar.'),
  background: z.string().describe('The selected background for the avatar.'),
  userDescription: z.string().optional().describe('Optional user provided description to influence avatar generation.'),
});
export type GenerateAvatarPromptInput = z.infer<typeof GenerateAvatarPromptInputSchema>;

const GenerateAvatarPromptOutputSchema = z.object({
  prompt: z.string().describe('The generated prompt for avatar creation.'),
});
export type GenerateAvatarPromptOutput = z.infer<typeof GenerateAvatarPromptOutputSchema>;

export async function generateAvatarPrompt(input: GenerateAvatarPromptInput): Promise<GenerateAvatarPromptOutput> {
  return generateAvatarPromptFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateAvatarPrompt',
  input: {
    schema: z.object({
      kimono: z.string().describe('揀選咗嘅和服，用作生成頭像。'),
      background: z.string().describe('揀選咗嘅背景，用作生成頭像。'),
      userDescription: z.string().optional().describe('用戶可以提供嘅額外描述，用嚟影響頭像生成。'),
    }),
  },
  output: {
    schema: z.object({
      prompt: z.string().describe('生成出嚟嘅頭像創造提示。'),
    }),
  },
  prompt: `你係一個AI助手，專門幫人諗點樣整啲好有創意嘅動漫風格頭像提示。

  用戶揀咗件和服，描述係：{{{kimono}}}。
  用戶揀咗個背景，描述係：{{{background}}}。
  {{#if userDescription}}
  用戶仲加咗啲描述：{{{userDescription}}}。
  請將呢啲描述融入提示，整返個更加個人化嘅頭像。
  {{/if}}

  請生成一個詳細又有想像力嘅提示，將和服同背景嘅精髓結合埋一齊，創造一個獨特嘅動漫風格頭像。
  要考慮顏色配搭、藝術風格（例如：日系動畫、水彩風、漫畫線條感）、整體氣氛，整出一個生動又吸引人嘅圖像生成提示。
  提示應該包含和服同背景點樣互相襯托，同埋加入啲有趣嘅視覺元素令佢更加特別。
  務求令到提示充滿視覺吸引力同動漫感。
  提示應該係一句完整嘅句子。
  `,
});

const generateAvatarPromptFlow = ai.defineFlow<
  typeof GenerateAvatarPromptInputSchema,
  typeof GenerateAvatarPromptOutputSchema
>(
  {
    name: 'generateAvatarPromptFlow',
    inputSchema: GenerateAvatarPromptInputSchema,
    outputSchema: GenerateAvatarPromptOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
