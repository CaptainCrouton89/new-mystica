import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

interface GenerateItemDescriptionOptions {
  itemType: string;
  materials: string[];
}

interface ItemDescription {
  name: string;
  description: string;
}

const SYSTEM_PROMPT = `You are an assistant for a crafting game. For each request, you will receive the name of an item and one to three materials. Your task is two-fold: (1) write a two-sentence description of what the item looks like, focusing only on the item's physical content, and (2) invent a creative, fitting name for the item that reflects the combination of item and materials.

Your description should:
- Focus entirely on what the item looks like (e.g., shapes, parts, materials, arrangement).
- Avoid describing artistic style, lighting, or mood.
- Use clear and minimal language; do not add details beyond what the item and materials imply.
- Ensure the description is visual and straightforward—suitable for generating a slightly cartoonish game asset using an image generation model.
- **Deeply integrate the materials into the item's form itself**—the materials should transform or become the item's structure, not just be attached or placed on/in it. For example: a cactus blender should have the blender body shaped like a cactus with spines and segments, not cacti inside a normal blender; a Pepe sword should have a blade that is green and frog-like with bulging eyes as part of its form, not just Pepe's head as a hilt decoration.

Your name should:
- Be concise, evocative, and fitting for a fantasy or crafting game item.
- Clearly relate to both the item type and the provided materials.
- Avoid generic or purely literal names—use some creativity, but keep it appropriate for the materials and object.
- Be unique and not a real-world brand or copyrighted term.

Guidelines:
1. Interpret the item and its materials.
2. Reason about how the materials can fundamentally transform or become the item itself—think of fusion and metamorphosis, not decoration or containment.
3. Formulate a concise, purely visual two-sentence description focused only on physical features, components, and arrangement, emphasizing how the material's characteristics are embodied in the item's core structure.
4. Invent a suitable, imaginative name for the item that reflects both its type and the provided materials.
5. Do not mention style, background, action, or storytelling details.
6. Make the description slightly minimalistic, omitting embellishments or details not clearly derived from the item and materials.

Output both the invented name and the two-sentence physical description.`;

const itemDescriptionSchema = z.object({
  name: z.string().describe('A creative, fitting name for the item that reflects both its type and the provided materials'),
  description: z.string().describe('Exactly two sentences describing the physical appearance of the item, focused solely on visual features')
});

export async function generateItemDescription(
  options: GenerateItemDescriptionOptions
): Promise<ItemDescription> {
  const { itemType, materials } = options;

  if (materials.length < 1 || materials.length > 3) {
    throw new Error('Materials array must contain between 1 and 3 items');
  }

  const materialsText = materials.join(', ');
  const prompt = `Item: ${itemType}; Materials: ${materialsText}`;

  const { object } = await generateObject({
    model: openai('gpt-4.1-mini'),
    schema: itemDescriptionSchema,
    system: SYSTEM_PROMPT,
    prompt,
  });

  return object;
}

// CLI interface
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 2 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Mystica Item Description Generator

Usage:
  pnpm generate-description "Item Type" "material1,material2,material3"

Arguments:
  Item Type       The type of item to generate (e.g., "Magic Wand", "Robot Dog")
  Materials       1-3 materials separated by commas (e.g., "wood,crystal")

Examples:
  pnpm generate-description "Magic Wand" "wood,crystal"
  pnpm generate-description "Robot Dog" "metal,screws,plastic"
  pnpm generate-description "Amulet" "hello kitty,wizard hat,matcha powder"

Environment Variables Required:
  OPENAI_API_KEY  Your OpenAI API key

Output:
  JSON object with 'name' and 'description' fields
`);
    process.exit(0);
  }

  const itemType = args[0];
  const materialsStr = args[1];
  const materials = materialsStr.split(',').map(m => m.trim());

  try {
    const result = await generateItemDescription({ itemType, materials });

    console.log('\n✅ Generated Item Description:\n');
    console.log(`Name: ${result.name}`);
    console.log(`Description: ${result.description}`);
    console.log('\n' + JSON.stringify(result, null, 2));
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Error:', error.message);
    } else {
      console.error('❌ Unknown error occurred');
    }
    process.exit(1);
  }
}

export type { GenerateItemDescriptionOptions, ItemDescription };

// Run CLI when executed directly
(async () => {
  await main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
})();
