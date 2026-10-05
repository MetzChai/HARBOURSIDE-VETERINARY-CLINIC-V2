/**
 * Helper to normalize pet, owner, and profile image URLs.
 * Supports:
 * - New Cloudinary URLs (https://res.cloudinary.com/...)
 * - External URLs (http://, https://)
 * - Local blob previews (blob:...) and data URLs (data:...)
 * - Legacy local relative paths (/uploads/pets/...)
 */
export function getImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:")
  ) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  return `/uploads/${trimmed}`;
}
