import type { Agent } from './types';

export const MOCK_AGENTS: Agent[] = [
  {
    id: 'agent-1',
    name: 'Content Summarizer',
    description: 'Summarizes long articles or documents into concise paragraphs.',
    inputs: [
      {
        name: 'source_text',
        description: 'The full text to be summarized.',
        type: 'textarea',
        required: true,
      },
      {
        name: 'summary_length',
        description: 'Desired length of the summary.',
        type: 'select',
        required: true,
        defaultValue: 'medium',
        options: ['short', 'medium', 'long'],
      },
    ],
  },
  {
    id: 'agent-2',
    name: 'Image Classifier',
    description: 'Analyzes an image and provides a list of descriptive tags.',
    inputs: [
      {
        name: 'image_file',
        description: 'The image file to classify.',
        type: 'file',
        required: true,
      },
      {
        name: 'confidence_threshold',
        description: 'Minimum confidence level for tags (0.0 to 1.0).',
        type: 'number',
        required: false,
        defaultValue: 0.85,
      },
    ],
  },
  {
    id: 'agent-3',
    name: 'Code Generator',
    description: 'Generates boilerplate code for various programming tasks.',
    inputs: [
      {
        name: 'prompt',
        description: 'Detailed description of the desired code.',
        type: 'textarea',
        required: true,
      },
      {
        name: 'language',
        description: 'Programming language for the output.',
        type: 'select',
        required: true,
        defaultValue: 'TypeScript',
        options: ['TypeScript', 'Python', 'Go', 'Rust'],
      },
       {
        name: 'filename',
        description: 'Output filename.',
        type: 'text',
        required: true,
        defaultValue: "generated.ts"
      },
    ],
  },
];
