import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CRISIS_TYPES = [
  { id: 'medical', label: 'Medical Emergency', description: 'Sudden illness, injury, accident' },
  { id: 'fire', label: 'Fire', description: 'Structure, bush, or vehicle fire' },
  { id: 'flood', label: 'Flood / Flash Flood', description: 'Rising water, submerged roads' },
  { id: 'violence', label: 'Civil Unrest / Violence', description: 'Conflict, armed violence' },
  { id: 'missing', label: 'Missing Person', description: 'Child or vulnerable adult' },
  { id: 'infrastructure', label: 'Infrastructure Failure', description: 'Collapsed structure, gas leak' },
  { id: 'drought', label: 'Drought', description: 'Extended water shortage' },
  { id: 'wildfire', label: 'Wildfire / Forest Fire', description: 'Forest or grassland fire' },
];
