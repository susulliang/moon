// ============================================================================
// Vector glyphs — distinct SVG shapes per building type
// Each glyph is drawn in a 100x100 viewBox centered at (0,0): coords -50..50
// ============================================================================

import type { BuildingTypeId } from "@/sim/types";

interface GlyphProps {
  /** stroke / accent color */
  color: string;
  /** opacity of fill */
  fillOpacity?: number;
}

const COMMON_PROPS = {
  fill: "none",
  strokeWidth: 1.4,
  strokeLinejoin: "round" as const,
  strokeLinecap: "round" as const,
};

/**
 * Returns an array of SVG path/element descriptors rendered into a fragment.
 * Coords are centered at (0,0). Half-extent ~40.
 */
export function renderBuildingGlyph(typeId: BuildingTypeId, props: GlyphProps): JSX.Element {
  const { color, fillOpacity = 0.12 } = props;
  const fill = color;
  const stroke = color;

  switch (typeId) {
    // ==================== POWER ====================
    case "nuclear_reactor": {
      // hexagonal reactor core with cooling fins + radiation symbol
      return (
        <g {...COMMON_PROPS} stroke={stroke} fill={fill} fillOpacity={fillOpacity}>
          <polygon points="0,-30 26,-15 26,15 0,30 -26,15 -26,-15" />
          <circle cx="0" cy="0" r="10" />
          <circle cx="0" cy="0" r="3" fill={stroke} />
          <path d="M0 -10 L0 -22 M8.7 -5 L18 -13 M8.7 5 L18 13 M0 10 L0 22 M-8.7 5 L-18 13 M-8.7 -5 L-18 -13" />
        </g>
      );
    }
    case "solar_array": {
      // four-panel solar array
      return (
        <g {...COMMON_PROPS} stroke={stroke} fill={fill} fillOpacity={fillOpacity}>
          <rect x="-40" y="-22" width="80" height="44" />
          <line x1="-20" y1="-22" x2="-20" y2="22" />
          <line x1="0" y1="-22" x2="0" y2="22" />
          <line x1="20" y1="-22" x2="20" y2="22" />
          <line x1="-40" y1="0" x2="40" y2="0" />
          <rect x="-6" y="22" width="12" height="10" fill={stroke} fillOpacity={0.5} />
        </g>
      );
    }
    case "battery_bank": {
      // stacked battery cylinders
      return (
        <g {...COMMON_PROPS} stroke={stroke} fill={fill} fillOpacity={fillOpacity}>
          <rect x="-30" y="-22" width="20" height="44" />
          <rect x="-10" y="-22" width="20" height="44" />
          <rect x="10" y="-22" width="20" height="44" />
          <line x1="-30" y1="-10" x2="-10" y2="-10" />
          <line x1="-10" y1="-10" x2="10" y2="-10" />
          <line x1="10" y1="-10" x2="30" y2="-10" />
          <line x1="-30" y1="10" x2="-10" y2="10" />
          <line x1="-10" y1="10" x2="10" y2="10" />
          <line x1="10" y1="10" x2="30" y2="10" />
          <path d="M-20 -22 L-20 -28 L0 -28 L0 -22 M0 -22 L0 -28 L20 -28 L20 -22" />
        </g>
      );
    }

    // ==================== HABITAT ====================
    case "crew_habitat": {
      // inflatable cylindrical habitat
      return (
        <g {...COMMON_PROPS} stroke={stroke} fill={fill} fillOpacity={fillOpacity}>
          <rect x="-36" y="-22" width="72" height="44" rx="14" />
          <line x1="-22" y1="-22" x2="-22" y2="22" />
          <line x1="0" y1="-22" x2="0" y2="22" />
          <line x1="22" y1="-22" x2="22" y2="22" />
          <circle cx="-36" cy="0" r="4" fill={stroke} fillOpacity={0.7} />
          <circle cx="36" cy="0" r="4" fill={stroke} fillOpacity={0.7} />
        </g>
      );
    }
    case "residential_dome": {
      // large dome with airlock
      return (
        <g {...COMMON_PROPS} stroke={stroke} fill={fill} fillOpacity={fillOpacity}>
          <path d="M-40 30 A40 40 0 0 1 40 30 Z" />
          <path d="M-30 30 A30 30 0 0 1 30 30" />
          <path d="M-20 30 A20 20 0 0 1 20 30" />
          <line x1="0" y1="-10" x2="0" y2="30" />
          <line x1="-40" y1="30" x2="40" y2="30" />
          <rect x="-6" y="22" width="12" height="8" fill={stroke} fillOpacity={0.5} />
          <circle cx="0" cy="-12" r="2" fill={stroke} />
        </g>
      );
    }
    case "medical_bay": {
      // cross-emblem building
      return (
        <g {...COMMON_PROPS} stroke={stroke} fill={fill} fillOpacity={fillOpacity}>
          <rect x="-30" y="-22" width="60" height="44" />
          <path d="M-8 -10 L-8 -4 L-14 -4 L-14 4 L-8 4 L-8 10 L8 10 L8 4 L14 4 L14 -4 L8 -4 L8 -10 Z" fill={stroke} fillOpacity={0.55} />
        </g>
      );
    }

    // ==================== LIFE SUPPORT ====================
    case "water_plant": {
      // water tank + processing
      return (
        <g {...COMMON_PROPS} stroke={stroke} fill={fill} fillOpacity={fillOpacity}>
          <ellipse cx="-12" cy="0" rx="20" ry="28" />
          <ellipse cx="-12" cy="-28" rx="20" ry="5" />
          <path d="M10 -20 L20 -20 L20 20 L10 20" />
          <path d="M14 -10 L24 -10 M14 0 L24 0 M14 10 L24 10" />
          <path d="M0 -5 Q3 -10 6 -5 Q9 0 6 5 Q3 10 0 5 Q-3 0 0 -5 Z" fill={stroke} fillOpacity={0.45} />
        </g>
      );
    }
    case "oxygen_plant": {
      // electrolyzer columns
      return (
        <g {...COMMON_PROPS} stroke={stroke} fill={fill} fillOpacity={fillOpacity}>
          <rect x="-32" y="-24" width="16" height="48" />
          <rect x="-8" y="-24" width="16" height="48" />
          <rect x="16" y="-24" width="16" height="48" />
          <circle cx="-24" cy="-30" r="4" fill={stroke} fillOpacity={0.6} />
          <circle cx="0" cy="-30" r="4" fill={stroke} fillOpacity={0.6} />
          <circle cx="24" cy="-30" r="4" fill={stroke} fillOpacity={0.6} />
          <line x1="-32" y1="0" x2="32" y2="0" strokeDasharray="2 3" />
        </g>
      );
    }
    case "greenhouse": {
      // greenhouse with plant rows
      return (
        <g {...COMMON_PROPS} stroke={stroke} fill={fill} fillOpacity={fillOpacity}>
          <rect x="-40" y="-20" width="80" height="40" />
          <path d="M-40 -20 L0 -28 L40 -20" />
          <line x1="-25" y1="-20" x2="-25" y2="20" />
          <line x1="0" y1="-20" x2="0" y2="20" />
          <line x1="25" y1="-20" x2="25" y2="20" />
          <circle cx="-32" cy="10" r="3" fill={stroke} fillOpacity={0.5} />
          <circle cx="-12" cy="12" r="3" fill={stroke} fillOpacity={0.5} />
          <circle cx="12" cy="10" r="3" fill={stroke} fillOpacity={0.5} />
          <circle cx="32" cy="12" r="3" fill={stroke} fillOpacity={0.5} />
        </g>
      );
    }
    case "waste_recycler": {
      // recycling loop icon
      return (
        <g {...COMMON_PROPS} stroke={stroke} fill={fill} fillOpacity={fillOpacity}>
          <rect x="-30" y="-22" width="60" height="44" />
          <path d="M-12 -6 A14 14 0 0 1 12 -6 L8 -10 M12 -6 L16 -2" />
          <path d="M12 6 A14 14 0 0 1 -12 6 L-8 10 M-12 6 L-16 2" />
          <circle cx="0" cy="0" r="3" fill={stroke} fillOpacity={0.6} />
        </g>
      );
    }

    // ==================== ISRU / MINING ====================
    case "regolith_harvester": {
      // boxy harvester with bucket wheel
      return (
        <g {...COMMON_PROPS} stroke={stroke} fill={fill} fillOpacity={fillOpacity}>
          <rect x="-30" y="-22" width="48" height="44" />
          <circle cx="26" cy="0" r="14" />
          <line x1="26" y1="-14" x2="26" y2="14" />
          <line x1="12" y1="-7" x2="40" y2="7" />
          <line x1="12" y1="7" x2="40" y2="-7" />
          <line x1="-30" y1="22" x2="-30" y2="28" />
          <line x1="18" y1="22" x2="18" y2="28" />
        </g>
      );
    }
    case "regolith_excavator": {
      // deep bore excavator with drilling mast
      return (
        <g {...COMMON_PROPS} stroke={stroke} fill={fill} fillOpacity={fillOpacity}>
          <rect x="-28" y="-22" width="56" height="44" />
          <line x1="-14" y1="-22" x2="-14" y2="22" />
          <line x1="14" y1="-22" x2="14" y2="22" />
          <line x1="-28" y1="0" x2="28" y2="0" />
          <path d="M0 -22 L0 -40 M-10 -34 L10 -34" />
          <path d="M-8 -40 L8 -40 L4 -48 L-4 -48 Z" fill={stroke} fillOpacity={0.5} />
          <circle cx="0" cy="0" r="6" />
        </g>
      );
    }
    case "helium3_extractor": {
      // He-3 extractor: nucleus symbol
      return (
        <g {...COMMON_PROPS} stroke={stroke} fill={fill} fillOpacity={fillOpacity}>
          <circle cx="0" cy="0" r="22" />
          <ellipse cx="0" cy="0" rx="22" ry="8" />
          <ellipse cx="0" cy="0" rx="8" ry="22" />
          <ellipse cx="0" cy="0" rx="22" ry="8" transform="rotate(60)" />
          <ellipse cx="0" cy="0" rx="22" ry="8" transform="rotate(-60)" />
          <circle cx="0" cy="0" r="4" fill={stroke} />
          <rect x="-30" y="20" width="60" height="6" fill={stroke} fillOpacity={0.3} />
        </g>
      );
    }

    // ==================== MANUFACTURING ====================
    case "fab_bay": {
      // smelting furnace
      return (
        <g {...COMMON_PROPS} stroke={stroke} fill={fill} fillOpacity={fillOpacity}>
          <rect x="-30" y="-22" width="60" height="44" />
          <path d="M-18 -22 L-18 0 L18 0 L18 -22" />
          <rect x="-12" y="-10" width="24" height="20" />
          <path d="M-8 4 L-4 14 M0 4 L0 14 M8 4 L4 14" />
          <circle cx="-22" cy="-26" r="3" fill={stroke} fillOpacity={0.6} />
          <circle cx="22" cy="-26" r="3" fill={stroke} fillOpacity={0.6} />
        </g>
      );
    }
    case "parts_factory": {
      // factory with sawtooth roof
      return (
        <g {...COMMON_PROPS} stroke={stroke} fill={fill} fillOpacity={fillOpacity}>
          <rect x="-36" y="-14" width="72" height="36" />
          <path d="M-36 -14 L-30 -24 L-24 -14 L-18 -24 L-12 -14 L-6 -24 L0 -14 L6 -24 L12 -14 L18 -24 L24 -14 L30 -24 L36 -14" />
          <line x1="-20" y1="22" x2="-20" y2="6" />
          <line x1="20" y1="22" x2="20" y2="6" />
          <rect x="-12" y="6" width="24" height="16" fill={stroke} fillOpacity={0.3} />
        </g>
      );
    }
    case "shipyard": {
      // large shipyard gantry
      return (
        <g {...COMMON_PROPS} stroke={stroke} fill={fill} fillOpacity={fillOpacity}>
          <rect x="-50" y="-30" width="100" height="60" />
          <path d="M-50 -30 L-50 -38 L50 -38 L50 -30" />
          <line x1="-30" y1="-30" x2="-30" y2="30" />
          <line x1="30" y1="-30" x2="30" y2="30" />
          <path d="M-40 0 L40 0" strokeDasharray="3 4" />
          <path d="M-14 10 L14 10 L10 22 L-10 22 Z" fill={stroke} fillOpacity={0.45} />
        </g>
      );
    }

    // ==================== RESEARCH ====================
    case "research_lab": {
      // lab building with flask
      return (
        <g {...COMMON_PROPS} stroke={stroke} fill={fill} fillOpacity={fillOpacity}>
          <rect x="-32" y="-22" width="64" height="44" />
          <path d="M-6 -8 L-6 -2 L-12 12 L12 12 L6 -2 L6 -8 Z" fill={stroke} fillOpacity={0.5} />
          <line x1="-8" y1="-8" x2="8" y2="-8" />
          <line x1="0" y1="6" x2="0" y2="10" />
          <circle cx="-3" cy="9" r="1" fill={stroke} />
          <circle cx="3" cy="9" r="1" fill={stroke} />
        </g>
      );
    }
    case "observatory": {
      // observatory dome with slit
      return (
        <g {...COMMON_PROPS} stroke={stroke} fill={fill} fillOpacity={fillOpacity}>
          <rect x="-32" y="0" width="64" height="22" />
          <path d="M-28 0 A28 28 0 0 1 28 0 Z" />
          <path d="M-4 -26 L4 -26 L4 0 L-4 0 Z" fill={stroke} fillOpacity={0.6} />
          <line x1="-32" y1="22" x2="32" y2="22" />
        </g>
      );
    }
    case "mars_mission_control": {
      // mission control with dish + comms
      return (
        <g {...COMMON_PROPS} stroke={stroke} fill={fill} fillOpacity={fillOpacity}>
          <rect x="-40" y="-10" width="80" height="32" />
          <path d="M-12 -10 L-12 -22 L12 -22 L12 -10" />
          <path d="M0 -22 L0 -34 M-10 -34 L10 -34" />
          <path d="M0 -34 L-12 -42 A12 8 0 0 1 12 -42 Z" fill={stroke} fillOpacity={0.4} />
          <line x1="-30" y1="22" x2="-30" y2="30" />
          <line x1="30" y1="22" x2="30" y2="30" />
          <line x1="-30" y1="6" x2="-20" y2="6" />
          <line x1="30" y1="6" x2="20" y2="6" />
        </g>
      );
    }

    // ==================== LOGISTICS ====================
    case "storage_depot": {
      // storage tanks cluster
      return (
        <g {...COMMON_PROPS} stroke={stroke} fill={fill} fillOpacity={fillOpacity}>
          <circle cx="-18" cy="-6" r="12" />
          <circle cx="18" cy="-6" r="12" />
          <rect x="-12" y="8" width="24" height="14" />
          <ellipse cx="-18" cy="-18" rx="12" ry="3" />
          <ellipse cx="18" cy="-18" rx="12" ry="3" />
        </g>
      );
    }
    case "landing_pad": {
      // landing pad with X marker
      return (
        <g {...COMMON_PROPS} stroke={stroke} fill={fill} fillOpacity={fillOpacity}>
          <circle cx="0" cy="0" r="36" />
          <circle cx="0" cy="0" r="28" strokeDasharray="3 3" />
          <path d="M-20 -20 L20 20 M20 -20 L-20 20" />
          <circle cx="0" cy="0" r="4" fill={stroke} />
        </g>
      );
    }
    case "rover_depot": {
      // rover garage
      return (
        <g {...COMMON_PROPS} stroke={stroke} fill={fill} fillOpacity={fillOpacity}>
          <rect x="-36" y="-22" width="72" height="44" />
          <rect x="-10" y="-12" width="20" height="12" fill={stroke} fillOpacity={0.4} />
          <circle cx="-18" cy="20" r="6" />
          <circle cx="18" cy="20" r="6" />
          <line x1="-36" y1="-22" x2="-44" y2="-30" />
          <line x1="36" y1="-22" x2="44" y2="-30" />
        </g>
      );
    }
    case "corridor": {
      // pressurized walkway tube with ribs
      return (
        <g {...COMMON_PROPS} stroke={stroke} fill={fill} fillOpacity={fillOpacity}>
          <rect x="-18" y="-10" width="36" height="20" rx="6" />
          <line x1="-10" y1="-10" x2="-10" y2="10" />
          <line x1="0" y1="-10" x2="0" y2="10" />
          <line x1="10" y1="-10" x2="10" y2="10" />
          <circle cx="0" cy="0" r="1.5" fill={stroke} fillOpacity={0.5} />
        </g>
      );
    }

    // ==================== SIGNATURE ====================
    case "rail_launch": {
      // rail launch system: long track + gantry
      return (
        <g {...COMMON_PROPS} stroke={stroke} fill={fill} fillOpacity={fillOpacity}>
          <line x1="-130" y1="0" x2="130" y2="0" strokeWidth="2" />
          <line x1="-130" y1="6" x2="130" y2="6" strokeWidth="2" />
          {Array.from({ length: 14 }).map((_, i) => {
            const x = -120 + i * 18;
            return <line key={i} x1={x} y1="0" x2={x} y2="6" />;
          })}
          <path d="M100 -6 L130 -6 L130 12 L100 12 Z" fill={stroke} fillOpacity={0.4} />
          <path d="M-130 -6 L-150 -16 L-150 22 L-130 12 Z" fill={stroke} fillOpacity={0.3} />
          <line x1="-150" y1="-16" x2="-150" y2="-26" />
          <line x1="-150" y1="-26" x2="-138" y2="-30" />
          <line x1="-150" y1="-26" x2="-162" y2="-30" />
        </g>
      );
    }

    default:
      return <rect x="-30" y="-30" width="60" height="60" stroke={stroke} fill={fill} fillOpacity={fillOpacity} />;
  }
}
