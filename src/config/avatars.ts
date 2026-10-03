/**
 * The GLB model is not stored in the repo (too large for Cloudflare Pages),
 * so it is loaded from a pinned commit on GitHub instead.
 */
export const REMOTE_GLB_AVATAR_URL =
  'https://raw.githubusercontent.com/VladLerkin/ai-interview/75a4105/public/avatar.glb';

export const LOCAL_VRM_AVATAR_URL = '/avatar.vrm';

export const CUSTOM_AVATAR_ID = 'custom';

export interface AvatarOption {
  id: string;
  name: string;
  /** Model URL, or `null` for the custom-upload option. */
  url: string | null;
  img: string;
}

export const PREDEFINED_AVATARS: AvatarOption[] = [
  { id: 'default', name: 'Standard AI', url: LOCAL_VRM_AVATAR_URL, img: 'https://api.dicebear.com/7.x/bottts/svg?seed=ai&backgroundColor=1f2937' },
  { id: 'realistic', name: 'Business Woman', url: REMOTE_GLB_AVATAR_URL, img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jessica&backgroundColor=1f2937' },
  { id: 'tech', name: 'Tech Lead', url: LOCAL_VRM_AVATAR_URL, img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=1f2937' },
  { id: CUSTOM_AVATAR_ID, name: 'Custom Upload', url: null, img: 'https://api.dicebear.com/7.x/identicon/svg?seed=custom&backgroundColor=374151' },
];

export const DEFAULT_AVATAR_ID = 'realistic';
