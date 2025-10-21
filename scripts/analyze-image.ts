#!/usr/bin/env tsx
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load .env.local from project root (override mode)
config({ path: path.join(__dirname, '..', '.env.local'), override: true });

interface ImageInput {
  path: string;
  mimeType: string;
}

async function analyzeImages(question: string, imagePaths: string[]): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY not found in environment variables');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Prepare image inputs
  const images: ImageInput[] = imagePaths.map(imagePath => {
    const ext = path.extname(imagePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.heic': 'image/heic',
      '.heif': 'image/heif'
    };

    const mimeType = mimeTypes[ext] || 'image/jpeg';

    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image not found: ${imagePath}`);
    }

    return { path: imagePath, mimeType };
  });

  // Build content array with images and question
  const content: any[] = [];

  // Add all images first
  for (const image of images) {
    const imageData = fs.readFileSync(image.path);
    content.push({
      inlineData: {
        mimeType: image.mimeType,
        data: imageData.toString('base64')
      }
    });
  }

  // Add question last (best practice per docs)
  content.push(question);

  const result = await model.generateContent(content);
  const response = result.response;
  return response.text();
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: pnpm analyze-image "Your question" image1.jpg [image2.jpg ...]');
    console.error('');
    console.error('Examples:');
    console.error('  pnpm analyze-image "What objects do you see?" photo.jpg');
    console.error('  pnpm analyze-image "Compare these images" img1.jpg img2.jpg img3.jpg');
    process.exit(1);
  }

  const question = args[0];
  const imagePaths = args.slice(1);

  console.log(`Analyzing ${imagePaths.length} image(s)...`);
  console.log(`Question: ${question}\n`);

  try {
    const response = await analyzeImages(question, imagePaths);
    console.log('Response:');
    console.log(response);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
