export interface ButtonConfig {
  id: string;
  position: number;
  playlist_uri: string | null;
  name: string | null;
  image_url: string | null;
  custom_image_url?: string | null;
}

export interface AppConfig {
  buttons: ButtonConfig[];
  grid_size: number;
  selected_device_id: string | null;
}

export interface PlaylistSummary {
  uri: string;
  name: string;
  image_url: string | null;
}

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
}
