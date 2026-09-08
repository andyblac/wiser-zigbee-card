import {
  LovelaceCard,
  LovelaceCardConfig,
  LovelaceCardEditor,
} from "custom-card-helpers";

declare global {
  interface HTMLElementTagNameMap {
    "wiser-zigbee-card-editor": LovelaceCardEditor;
    "hui-error-card": LovelaceCard;
  }
}

export type NetworkOrientation = "vertical" | "horizontal";
export interface WiserZigbeeCardConfig extends LovelaceCardConfig {
  type: string;
  name?: string;
  hub: string;
  auto_update: boolean;
  log_seed: boolean;
  layout_seed: string;
  map_only?: boolean;
  map_height?: number | null | "";
  show_layout_export?: boolean;
  show_device_list?: boolean;
  orientation?: NetworkOrientation;
  layout_orientation?: NetworkOrientation;
  layout_id?: string;
  layout_data?: Record<string, { x: number; y: number }> | "";
}

export interface node {
  id: number;
  label: string;
  group: string;
  x: number;
  y: number;
}

export interface edge {
  id: string;
  from: number;
  to: number;
  label: string;
}

export interface zigbeeData {
  nodes: node[];
  edges: edge[];
}

enum WiserEvent {
  WiserUpdated = "wiser_updated",
}

export interface WiserEventData {
  event: WiserEvent;
}
