/** Look up a photo in src/assets/photos by file name (without extension). */
import type { ImageMetadata } from 'astro';

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/photos/*.jpg', { eager: true });

export function photo(name: string): ImageMetadata {
  const hit = files[`../assets/photos/${name}.jpg`];
  if (!hit) throw new Error(`Photo "${name}" not found in src/assets/photos`);
  return hit.default;
}
