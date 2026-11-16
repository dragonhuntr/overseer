// The status palette as class names. Spelled out in full so Tailwind can see them.
export type Tone = 'gray' | 'red' | 'orange' | 'amber' | 'green' | 'blue';

export const tone: Record<Tone, { text: string; solid: string }> = {
  gray: { text: 'text-tone-gray', solid: 'bg-tone-gray-solid' },
  red: { text: 'text-tone-red', solid: 'bg-tone-red-solid' },
  orange: { text: 'text-tone-orange', solid: 'bg-tone-orange-solid' },
  amber: { text: 'text-tone-amber', solid: 'bg-tone-amber-solid' },
  green: { text: 'text-tone-green', solid: 'bg-tone-green-solid' },
  blue: { text: 'text-tone-blue', solid: 'bg-tone-blue-solid' },
};

export const isTone = (v: unknown): v is Tone => typeof v === 'string' && v in tone;
