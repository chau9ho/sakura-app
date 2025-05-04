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
      kimono: z.string().describe('The selected kimono for the avatar.'),
      background: z.string().describe('The selected background for the avatar.'),
      userDescription: z.string().optional().describe('Optional user provided description to influence avatar generation.'),
    }),
  },
  output: {
    schema: z.object({
      prompt: z.string().describe('The generated prompt for avatar creation.'),
    }),
  },
  prompt: `You are an AI assistant designed to generate creative prompts for avatar creation.

  The user has selected a kimono with the following description: {{{kimono}}}.
  The user has selected a background with the following description: {{{background}}}.
  {{#if userDescription}}
  The user has provided the following description: {{{userDescription}}}.
  Please incorporate this into the prompt to customize the avatar.
  {{/if}}

  Generate a detailed and imaginative prompt that combines the essence of the kimono and background to create a unique avatar.
  Consider elements like color schemes, artistic styles (e.g., painting, photography, illustration), and overall mood to produce a vivid and compelling image generation prompt. The prompt should include how the kimono and background are related, and any interesting visual elements which can make it unique. Make sure that the prompt has high visual appeal.
  The prompt should be a single sentence long.
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
