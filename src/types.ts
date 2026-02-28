export type SeverityTier = 'Tier 1 — Critical' | 'Tier 2 — High' | 'Tier 3 — Moderate';

export interface Alert {
  id: string;
  type: string;
  description: string;
  latitude: number;
  longitude: number;
  severity: SeverityTier;
  status: 'active' | 'resolved' | 'rejected';
  verified: boolean;
  created_at: string;
  photo_url?: string;
  ai_guidance: string;
  ai_summary?: string;
  address_full?: string;
  address_area?: string;
  address_city?: string;
  location_method?: string;
  reference_id: string;
}

export interface Organisation {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  service_radius: number;
  contact_email: string;
  status: 'pending' | 'active' | 'suspended';
  donation_url?: string;
}

export interface Comment {
  id: string;
  alert_id: string;
  text: string;
  author_name: string;
  flagged: boolean;
  created_at: string;
}

export interface CrisisType {
  id: string;
  label: string;
  description: string;
}
