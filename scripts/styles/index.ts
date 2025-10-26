/**
 * Style System Registry
 *
 * Central registry for all available styles. Import this to access styles
 * throughout the application.
 *
 * Default style: rubberhose (1930s rubber hose animation)
 */

import { Style, StyleName, StyleConfig, StylePromptBuilder } from './types';
import { rubberhoseStyle } from './rubberhose';
import { chibiStyle } from './chibi';
import { pixel8bitStyle } from './pixel-8bit';

// Central registry - easy to see all available styles
const styleRegistry = new Map<StyleName, Style>([
  ['rubberhose', rubberhoseStyle],
  ['chibi', chibiStyle],
  ['pixel-8bit', pixel8bitStyle],
  // Add new styles here:
  // ['watercolor', watercolorStyle],
  // ['sketch', sketchStyle],
]);

/**
 * Get a specific style by name
 * @param name - Style name (rubberhose, chibi, pixel-8bit, etc.)
 * @returns Style configuration and prompt builders
 * @throws Error if style not found
 */
export function getStyle(name: StyleName): Style {
  const style = styleRegistry.get(name);
  if (!style) {
    const available = Array.from(styleRegistry.keys()).join(', ');
    throw new Error(`Unknown style: "${name}". Available styles: ${available}`);
  }
  return style;
}

/**
 * Get all available style names
 * @returns Array of style names
 */
export function listStyles(): StyleName[] {
  return Array.from(styleRegistry.keys());
}

/**
 * Get the default style (rubberhose)
 * Can be overridden via DEFAULT_STYLE environment variable
 * @returns Default style configuration and prompt builders
 */
export function getDefaultStyle(): Style {
  // Allow override via environment variable, but default to rubberhose
  const defaultStyleName = (process.env.DEFAULT_STYLE || 'rubberhose') as StyleName;
  return getStyle(defaultStyleName);
}

/**
 * Get style metadata (name, display name, description)
 * Useful for CLI help text and documentation
 * @param name - Style name
 * @returns Style metadata
 */
export function getStyleInfo(name: StyleName): {
  name: string;
  displayName: string;
  description: string;
  referenceCount: number;
  model: string;
} {
  const style = getStyle(name);
  return {
    name: style.config.name,
    displayName: style.config.displayName,
    description: style.config.description,
    referenceCount: style.config.referenceImages.length,
    model: style.config.model || 'google/nano-banana'
  };
}

/**
 * Check if a style exists
 * @param name - Style name to check
 * @returns True if style exists
 */
export function hasStyle(name: string): boolean {
  return styleRegistry.has(name);
}

/**
 * Print all available styles with details
 * Useful for CLI help text
 */
export function printStylesHelp(): void {
  const defaultStyleName = process.env.DEFAULT_STYLE || 'rubberhose';

  console.log('\nAvailable Styles:\n');

  for (const styleName of listStyles()) {
    const info = getStyleInfo(styleName);
    const isDefault = styleName === defaultStyleName;

    console.log(`  --style ${styleName}${isDefault ? ' (default)' : ''}`);
    console.log(`    ${info.displayName}`);
    console.log(`    ${info.description}`);
    console.log(`    References: ${info.referenceCount} images`);
    console.log(`    Model: ${info.model}\n`);
  }
}

// Re-exports for convenience
export { Style, StyleName, StyleConfig, StylePromptBuilder } from './types';
export { rubberhoseStyle, chibiStyle, pixel8bitStyle };
