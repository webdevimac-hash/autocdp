/**
 * Vehicle photo helpers.
 *
 * Until the DMS feed provides real photo URLs, the inventory grid shows
 * curated Unsplash images keyed deterministically off the vehicle id so a
 * given vehicle always shows the same placeholder.
 *
 * When metadata.photo_url (or metadata.images[0]) is populated by the
 * inventory import or DMS sync, that wins.
 */

// Curated Unsplash car photos — wide aspect, clean catalog look.
const CAR_PHOTO_POOL: ReadonlyArray<string> = [
  "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=900&h=540&fit=crop&auto=format&q=80", // black coupe
  "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=900&h=540&fit=crop&auto=format&q=80", // porsche
  "https://images.unsplash.com/photo-1542362567-b07e54358753?w=900&h=540&fit=crop&auto=format&q=80", // bmw
  "https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=900&h=540&fit=crop&auto=format&q=80", // sports angle
  "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=900&h=540&fit=crop&auto=format&q=80", // yellow lambo
  "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=900&h=540&fit=crop&auto=format&q=80", // suv front
  "https://images.unsplash.com/photo-1568844293986-8d0400bd4745?w=900&h=540&fit=crop&auto=format&q=80", // luxury sedan
  "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=900&h=540&fit=crop&auto=format&q=80", // ford truck
  "https://images.unsplash.com/photo-1617814086367-3eed8d3a8b14?w=900&h=540&fit=crop&auto=format&q=80", // toyota
  "https://images.unsplash.com/photo-1614026480418-bd11fde4f0d0?w=900&h=540&fit=crop&auto=format&q=80", // mustang
  "https://images.unsplash.com/photo-1606152421802-db97b9c7a11b?w=900&h=540&fit=crop&auto=format&q=80", // jeep
  "https://images.unsplash.com/photo-1493238792000-8113da705763?w=900&h=540&fit=crop&auto=format&q=80", // suv side
];

/**
 * Deterministic hash → index into the photo pool. Stable across reloads
 * so the same vehicle keeps the same photo.
 */
function hashIndex(key: string, modulo: number): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h % modulo;
}

/**
 * Resolve the best photo URL for a vehicle.
 * Priority:
 *   1. metadata.photo_url
 *   2. metadata.images[0]
 *   3. metadata.image_url
 *   4. Deterministic Unsplash fallback
 */
export function resolveVehiclePhoto(
  id: string | null | undefined,
  metadata?: Record<string, unknown> | null,
): string {
  const meta = metadata ?? {};
  const direct =
    (meta.photo_url as string | undefined) ??
    (meta.image_url as string | undefined);
  if (typeof direct === "string" && direct.startsWith("http")) {
    return direct;
  }

  const images = meta.images;
  if (Array.isArray(images) && typeof images[0] === "string") {
    return images[0];
  }

  return CAR_PHOTO_POOL[hashIndex(id ?? "", CAR_PHOTO_POOL.length)] ??
    CAR_PHOTO_POOL[0];
}

/** Build a small, public photo URL for the placeholder car CSV imports. */
export function placeholderPhotoFor(key: string): string {
  return CAR_PHOTO_POOL[hashIndex(key, CAR_PHOTO_POOL.length)];
}
