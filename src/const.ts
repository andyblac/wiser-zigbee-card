import type { Options } from "vis-network";

export const CARD_VERSION = "3.0.1-dev.12";

export const OPTIONS: Options = {
  autoResize: true,
  height: "100%",
  nodes: {
    shape: "box",
    color: {
      background: "#edf2f8",
      border: "#c9d5e4",
      highlight: { background: "#dce9f8", border: "#5288bd" },
    },
    font: { size: 14, face: "system-ui, sans-serif", color: "#26364a" },
    margin: { top: 14, bottom: 14, left: 18, right: 18 },
    widthConstraint: { minimum: 100, maximum: 160 },
    borderWidth: 1,
    shapeProperties: { borderRadius: 12 },
  },
  groups: {
    Controller: { color: { background: "#dceee6", border: "#91bba7" } },
    RoomStat: { color: { background: "#eee6f2", border: "#c9b3d5" } },
    iTRV: { color: { background: "#f7eadc", border: "#d9bc98" } },
    SmartPlug: { color: { background: "#dceef0", border: "#94bec4" } },
    HeatingActuator: { color: { background: "#e1e9fa", border: "#aabce0" } },
    UnderFloorHeating: { color: { background: "#e1e9fa", border: "#aabce0" } },
    Shutter: { color: { background: "#e7ebef", border: "#b4bec9" } },
    OnOffLight: { color: { background: "#f5efd9", border: "#d6c68e" } },
    DimmableLight: { color: { background: "#f5efd9", border: "#d6c68e" } },
  },
  edges: {
    arrows: { to: { enabled: true, scaleFactor: 0.45 } },
    color: {
      color: "#8a9bac",
      highlight: "#5288bd",
      hover: "#5288bd",
      inherit: false,
    },
    smooth: {
      enabled: true,
      type: "cubicBezier",
      forceDirection: "horizontal",
      roundness: 0.45,
    },
    width: 1.5,
    font: {
      align: "horizontal",
      color: "#66788a",
      size: 11,
      face: "system-ui, sans-serif",
      strokeWidth: 0,
    },
  },
  interaction: {
    hover: true,
    dragView: true,
    dragNodes: true,
    selectConnectedEdges: true,
    zoomView: false,
    keyboard: false,
  },
  physics: { enabled: false },
};
