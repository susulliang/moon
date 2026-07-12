// ============================================================================
// Pixel-art vector glyphs — Mario-style blocky sprites for each building type
// Each glyph is drawn in a 100x100 viewBox centered at (0,0): coords -50..50
// Uses a pxArt() helper: string-map → crisp <rect> pixels
// ============================================================================

import type { BuildingTypeId } from "@/sim/types";

export interface CorridorNeighbors {
  n: boolean;
  s: boolean;
  e: boolean;
  w: boolean;
}

interface GlyphProps {
  color: string;
  fillOpacity?: number;
  neighbors?: CorridorNeighbors;
}

// === Color helpers ===

function darken(hex: string, amt: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = (v: number) => Math.max(0, Math.floor(v * (1 - amt)));
  return `#${f(r).toString(16).padStart(2, "0")}${f(g).toString(16).padStart(2, "0")}${f(b).toString(16).padStart(2, "0")}`;
}

// === Pixel art renderer ===
// Each char in the map → one pixel rect. `ps` = pixel size in glyph units.

function pxArt(
  map: string[],
  palette: Record<string, string>,
  ps: number = 5,
): JSX.Element {
  const rows = map.length;
  const cols = Math.max(...map.map((r) => r.length));
  const offX = -Math.floor((cols * ps) / 2);
  const offY = -Math.floor((rows * ps) / 2);
  const rects: React.ReactNode[] = [];
  for (let y = 0; y < rows; y++) {
    const row = map[y] || "";
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c === " " || c === ".") continue;
      const fill = palette[c];
      if (!fill) continue;
      rects.push(
        <rect
          key={`${x}-${y}`}
          x={offX + x * ps}
          y={offY + y * ps}
          width={ps}
          height={ps}
          fill={fill}
        />,
      );
    }
  }
  return <g shapeRendering="crispEdges">{rects}</g>;
}

// Build a palette from the building's main color
function makePalette(color: string): Record<string, string> {
  return {
    "#": color,
    o: "#0a0a0a", // black outline
    "=": darken(color, 0.45), // dark shadow
    "-": darken(color, 0.2), // mid-tone
    "+": "#ffe0b0", // warm light (windows)
  };
}

// === Main entry point ===

export function renderBuildingGlyph(
  typeId: BuildingTypeId,
  props: GlyphProps,
): JSX.Element {
  const { color, fillOpacity = 0.15 } = props;
  const pal = makePalette(color);

  // For pixel art, fillOpacity affects how prominent the building is
  // We use it as an overlay opacity on the whole group
  const groupOpacity = fillOpacity < 0.2 ? fillOpacity * 3 : 1;

  switch (typeId) {
    // ==================== POWER ====================
    case "nuclear_reactor": {
      return (
        <g opacity={groupOpacity}>
          {pxArt([
            "....oooo....",
            "..oo######oo",
            ".o##########o",
            "o####=++=####o",
            "o###=++++=###o",
            "o##=++##++=##o",
            "o##=++##++=##o",
            "o###=++++=###o",
            "o####=++=####o",
            ".o##########o",
            "..oo######oo",
            "....oooo....",
          ], pal)}
        </g>
      );
    }
    case "solar_array": {
      return (
        <g opacity={groupOpacity}>
          {pxArt([
            ".oooooooooo.",
            "o==========o",
            "o##########o",
            "o==========o",
            "o##########o",
            "o==========o",
            "o##########o",
            ".oooooooooo.",
            ".....##.....",
            ".....##.....",
            "....####....",
            "....####....",
          ], pal)}
        </g>
      );
    }
    case "battery_bank": {
      return (
        <g opacity={groupOpacity}>
          {pxArt([
            ".++.++.++...",
            "o#oo#oo#oo..",
            "o#oo#oo#oo..",
            "o#oo#oo#oo..",
            "o#oo#oo#oo..",
            "o#oo#oo#oo..",
            "o#oo#oo#oo..",
            "o=oo=oo=oo..",
            ".o..o..o....",
            "............",
            "............",
            "............",
          ], pal)}
        </g>
      );
    }

    // ==================== HABITAT ====================
    case "crew_habitat": {
      return (
        <g opacity={groupOpacity}>
          {pxArt([
            ".oooooooooo.",
            "o##########o",
            "o#+######+#o",
            "o##########o",
            "o##########o",
            "o#+######+#o",
            "o##########o",
            "o##########o",
            "o#+######+#o",
            "o##########o",
            ".oooooooooo.",
            "............",
          ], pal)}
        </g>
      );
    }
    case "residential_dome": {
      return (
        <g opacity={groupOpacity}>
          {pxArt([
            "....oooo....",
            "..oo####oo..",
            ".o########o.",
            "o##########o",
            "o###====###o",
            "o#========#o",
            "o#==####==#o",
            ".o========o.",
            "..o##o##o##o",
            "...o##o##o.",
            "....oooo....",
            "............",
          ], pal)}
        </g>
      );
    }
    case "medical_bay": {
      return (
        <g opacity={groupOpacity}>
          {pxArt([
            ".oooooooooo.",
            "o##########o",
            "o##++++++##o",
            "o###++++###o",
            "o###++++###o",
            "o++++++++++o",
            "o++++++++++o",
            "o###++++###o",
            "o###++++###o",
            "o##++++++##o",
            ".oooooooooo.",
            "............",
          ], pal)}
        </g>
      );
    }

    // ==================== LIFE SUPPORT ====================
    case "water_plant": {
      return (
        <g opacity={groupOpacity}>
          {pxArt([
            ".oooooooooo.",
            "o##o####o##o",
            "o##o####o##o",
            "o##o####o##o",
            "o##o####o##o",
            "o##o====o##o",
            "o##o====o##o",
            "o##o####o##o",
            "o##o####o##o",
            ".ooo####ooo.",
            "............",
            "............",
          ], pal)}
        </g>
      );
    }
    case "oxygen_plant": {
      // Blue accent — uses the passed-in blue color
      return (
        <g opacity={groupOpacity}>
          {pxArt([
            ".oooooooooo.",
            "o#+o###+o##o",
            "o#oo###oo##o",
            "o#oo###oo##o",
            "o#oo###oo##o",
            "o#oo###oo##o",
            "o#oo###oo##o",
            "o#oo###oo##o",
            "o==o===o===o",
            ".oo.oo.oo.oo",
            "............",
            "............",
          ], pal)}
        </g>
      );
    }
    case "greenhouse": {
      // Green accent — transparent roof with plant rows
      return (
        <g opacity={groupOpacity}>
          {pxArt([
            ".oooooooooo.",
            "o++++++++++o",
            "o##======##o",
            "o#+######+#o",
            "o##======##o",
            "o#+######+#o",
            "o##======##o",
            "o#+######+#o",
            "o##======##o",
            "o##########o",
            ".oooooooooo.",
            "............",
          ], pal)}
        </g>
      );
    }
    case "waste_recycler": {
      return (
        <g opacity={groupOpacity}>
          {pxArt([
            ".oooooooooo.",
            "o##########o",
            "o##=##=##=##o",
            "o#========#o",
            "o##=##=##=##o",
            "o##########o",
            "o##=##=##=##o",
            "o#========#o",
            "o##=##=##=##o",
            "o##########o",
            ".oooooooooo.",
            "............",
          ], pal)}
        </g>
      );
    }

    // ==================== ISRU / MINING ====================
    case "regolith_harvester": {
      return (
        <g opacity={groupOpacity}>
          {pxArt([
            ".oooooooooo.",
            "o##########o",
            "o##########o",
            "o###====###o",
            "o###====###o",
            "o##########o",
            "o##########o",
            "o==o##o##o==o",
            ".oo.oo.oo.oo",
            "............",
            "............",
            "............",
          ], pal)}
        </g>
      );
    }
    case "regolith_excavator": {
      return (
        <g opacity={groupOpacity}>
          {pxArt([
            "....o##o....",
            "....o##o....",
            "....o##o....",
            ".oooooooooo.",
            "o##########o",
            "o##======##o",
            "o##########o",
            "o##########o",
            ".oooooooooo.",
            "....####....",
            "...######...",
            "............",
          ], pal)}
        </g>
      );
    }
    case "helium3_extractor": {
      return (
        <g opacity={groupOpacity}>
          {pxArt([
            "....oooo....",
            "..o##==##o..",
            ".o##====##o.",
            "o##=####=##o",
            "o#==####==#o",
            "o##=####=##o",
            "o#==####==#o",
            "o##=####=##o",
            ".o##====##o.",
            "..o##==##o..",
            "....oooo....",
            "............",
          ], pal)}
        </g>
      );
    }

    // ==================== MANUFACTURING ====================
    case "fab_bay": {
      return (
        <g opacity={groupOpacity}>
          {pxArt([
            ".oooooooooo.",
            "o##o####o##o",
            "o##o####o##o",
            "o##########o",
            "o##======##o",
            "o##=++++=##o",
            "o##=++++=##o",
            "o##======##o",
            "o##########o",
            ".oooooooooo.",
            "............",
            "............",
          ], pal)}
        </g>
      );
    }
    case "parts_factory": {
      return (
        <g opacity={groupOpacity}>
          {pxArt([
            "oooooooooooo",
            "o#o#o#o####o",
            "o#o#o#o####o",
            "o##########o",
            "o##======##o",
            "o##======##o",
            "o##########o",
            "o##########o",
            ".oooooooooo.",
            "............",
            "............",
            "............",
          ], pal)}
        </g>
      );
    }
    case "shipyard": {
      return (
        <g opacity={groupOpacity}>
          {pxArt([
            "oooooooooooo",
            "o==========o",
            "o##o####o##o",
            "o##o####o##o",
            "o##o####o##o",
            "o##o####o##o",
            "o##o####o##o",
            "o==========o",
            "oooooooooooo",
            "............",
            "............",
            "............",
          ], pal)}
        </g>
      );
    }

    // ==================== RESEARCH ====================
    case "research_lab": {
      return (
        <g opacity={groupOpacity}>
          {pxArt([
            ".oooooooooo.",
            "o##########o",
            "o##=++++=##o",
            "o##=++++=##o",
            "o##======##o",
            "o##########o",
            "o##======##o",
            "o##======##o",
            "o##########o",
            ".oooooooooo.",
            "............",
            "............",
          ], pal)}
        </g>
      );
    }
    case "observatory": {
      return (
        <g opacity={groupOpacity}>
          {pxArt([
            "....oooo....",
            "...o####o...",
            "..o######o..",
            ".o########o.",
            "o##########o",
            "o###====###o",
            "o##########o",
            "o##########o",
            "o##########o",
            ".oooooooooo.",
            "............",
            "............",
          ], pal)}
        </g>
      );
    }
    case "mars_mission_control": {
      return (
        <g opacity={groupOpacity}>
          {pxArt([
            "....o##o....",
            "....o##o....",
            "...o####o...",
            ".oooooooooo.",
            "o##########o",
            "o##======##o",
            "o##======##o",
            "o##########o",
            "o##########o",
            ".oooooooooo.",
            "............",
            "............",
          ], pal)}
        </g>
      );
    }

    // ==================== LOGISTICS ====================
    case "storage_depot": {
      return (
        <g opacity={groupOpacity}>
          {pxArt([
            ".oooooooooo.",
            "o#o##o##o##o",
            "o#o##o##o##o",
            "o#o##o##o##o",
            "o#o##o##o##o",
            "o#o##o##o##o",
            "o#o##o##o##o",
            "o#o##o##o##o",
            ".oo.oo.oo.oo",
            "............",
            "............",
            "............",
          ], pal)}
        </g>
      );
    }
    case "landing_pad": {
      return (
        <g opacity={groupOpacity}>
          {pxArt([
            "....oooo....",
            "..oo####oo..",
            ".o##====##o.",
            "o##=++++=##o",
            "o#==++++==#o",
            "o#==++++==#o",
            "o##=++++=##o",
            ".o##====##o.",
            "..oo####oo..",
            "....oooo....",
            "............",
            "............",
          ], pal)}
        </g>
      );
    }
    case "rover_depot": {
      return (
        <g opacity={groupOpacity}>
          {pxArt([
            ".oooooooooo.",
            "o##########o",
            "o#+######+#o",
            "o##########o",
            "o##======##o",
            "o##======##o",
            "o#o####o##o#",
            ".oo.oo.oo.o.",
            "............",
            "............",
            "............",
            "............",
          ], pal)}
        </g>
      );
    }
    case "corridor": {
      return renderCorridor(props);
    }

    // ==================== SIGNATURE ====================
    case "rail_launch": {
      // Long track with ties — drawn with direct rects for precision
      const o = "#0a0a0a";
      const r = color;
      const d = darken(color, 0.4);
      const ps = 4;
      const rails: React.ReactNode[] = [];
      let key = 0;
      // Two parallel rails
      for (let x = -48; x <= 44; x += ps) {
        rails.push(<rect key={key++} x={x} y={-8} width={ps} height={ps} fill={r} shapeRendering="crispEdges" />);
        rails.push(<rect key={key++} x={x} y={4} width={ps} height={ps} fill={r} shapeRendering="crispEdges" />);
      }
      // Ties (cross-bars)
      for (let x = -44; x <= 44; x += 12) {
        rails.push(<rect key={key++} x={x} y={-6} width={ps} height={12} fill={d} shapeRendering="crispEdges" />);
      }
      // Outline top + bottom
      for (let x = -48; x <= 44; x += ps) {
        rails.push(<rect key={key++} x={x} y={-12} width={ps} height={ps} fill={o} shapeRendering="crispEdges" />);
        rails.push(<rect key={key++} x={x} y={8} width={ps} height={ps} fill={o} shapeRendering="crispEdges" />);
      }
      // Gantry at east end
      rails.push(<rect key={key++} x={36} y={-16} width={12} height={28} fill={o} shapeRendering="crispEdges" />);
      rails.push(<rect key={key++} x={38} y={-14} width={8} height={24} fill={d} shapeRendering="crispEdges" />);
      rails.push(<rect key={key++} x={40} y={-20} width={4} height={4} fill={o} shapeRendering="crispEdges" />);

      return <g opacity={groupOpacity} shapeRendering="crispEdges">{rails}</g>;
    }

    default:
      return (
        <g opacity={groupOpacity}>
          {pxArt([
            ".oooooooo.",
            "o########o",
            "o########o",
            "o########o",
            "o########o",
            "o########o",
            "o########o",
            "o########o",
            ".oooooooo.",
            "..........",
          ], pal)}
        </g>
      );
  }
}

// === Corridor: dynamic tube that extends toward neighbors ===

function renderCorridor(props: GlyphProps): JSX.Element {
  const { color, neighbors = { n: false, s: false, e: false, w: false } } = props;
  const o = "#0a0a0a";
  const d = darken(color, 0.4);
  const l = darken(color, 0.15);
  const rects: React.ReactNode[] = [];
  let key = 0;
  const ps = 4; // pixel size

  // Central hub: 16x16 block centered at origin
  const hubHalf = 8;
  // Hub outline (4px thick)
  for (let x = -hubHalf - 2; x <= hubHalf - 2; x += ps) {
    rects.push(<rect key={key++} x={x} y={-hubHalf - 2} width={ps} height={ps} fill={o} />);
    rects.push(<rect key={key++} x={x} y={hubHalf - 2} width={ps} height={ps} fill={o} />);
  }
  for (let y = -hubHalf; y <= hubHalf - ps; y += ps) {
    rects.push(<rect key={key++} x={-hubHalf - 2} y={y} width={ps} height={ps} fill={o} />);
    rects.push(<rect key={key++} x={hubHalf - 2} y={y} width={ps} height={ps} fill={o} />);
  }
  // Hub interior
  for (let x = -hubHalf; x <= hubHalf - ps; x += ps) {
    for (let y = -hubHalf; y <= hubHalf - ps; y += ps) {
      rects.push(<rect key={key++} x={x} y={y} width={ps} height={ps} fill={color} />);
    }
  }
  // Center detail
  rects.push(<rect key={key++} x={-2} y={-2} width={4} height={4} fill={d} />);

  const tubeHalf = 7; // half-width of connector tube
  const edge = 50; // extend to viewBox edge

  // Helper: draw a connector in a direction
  const drawConnector = (dir: "n" | "s" | "e" | "w") => {
    if (!neighbors[dir]) return;
    const rib = (pos: number) => {
      // draw a rib line
    };
    void rib;

    if (dir === "n") {
      // Outline left + right
      for (let y = -edge; y < -hubHalf - 2; y += ps) {
        rects.push(<rect key={key++} x={-tubeHalf - 2} y={y} width={ps} height={ps} fill={o} />);
        rects.push(<rect key={key++} x={tubeHalf - 2} y={y} width={ps} height={ps} fill={o} />);
      }
      // Body
      for (let y = -edge; y < -hubHalf - 2; y += ps) {
        for (let x = -tubeHalf; x <= tubeHalf - ps; x += ps) {
          rects.push(<rect key={key++} x={x} y={y} width={ps} height={ps} fill={color} />);
        }
      }
      // Ribs every 8px
      for (let y = -edge + 4; y < -hubHalf - 2; y += 8) {
        for (let x = -tubeHalf; x <= tubeHalf - ps; x += ps) {
          rects.push(<rect key={key++} x={x} y={y} width={ps} height={ps} fill={d} />);
        }
      }
      // Center highlight line
      for (let y = -edge; y < -hubHalf - 2; y += ps) {
        rects.push(<rect key={key++} x={-1} y={y} width={2} height={ps} fill={l} />);
      }
    }
    if (dir === "s") {
      for (let y = hubHalf + 2; y < edge; y += ps) {
        rects.push(<rect key={key++} x={-tubeHalf - 2} y={y} width={ps} height={ps} fill={o} />);
        rects.push(<rect key={key++} x={tubeHalf - 2} y={y} width={ps} height={ps} fill={o} />);
      }
      for (let y = hubHalf + 2; y < edge; y += ps) {
        for (let x = -tubeHalf; x <= tubeHalf - ps; x += ps) {
          rects.push(<rect key={key++} x={x} y={y} width={ps} height={ps} fill={color} />);
        }
      }
      for (let y = hubHalf + 6; y < edge; y += 8) {
        for (let x = -tubeHalf; x <= tubeHalf - ps; x += ps) {
          rects.push(<rect key={key++} x={x} y={y} width={ps} height={ps} fill={d} />);
        }
      }
      for (let y = hubHalf + 2; y < edge; y += ps) {
        rects.push(<rect key={key++} x={-1} y={y} width={2} height={ps} fill={l} />);
      }
    }
    if (dir === "e") {
      for (let x = hubHalf + 2; x < edge; x += ps) {
        rects.push(<rect key={key++} x={x} y={-tubeHalf - 2} width={ps} height={ps} fill={o} />);
        rects.push(<rect key={key++} x={x} y={tubeHalf - 2} width={ps} height={ps} fill={o} />);
      }
      for (let x = hubHalf + 2; x < edge; x += ps) {
        for (let y = -tubeHalf; y <= tubeHalf - ps; y += ps) {
          rects.push(<rect key={key++} x={x} y={y} width={ps} height={ps} fill={color} />);
        }
      }
      for (let x = hubHalf + 6; x < edge; x += 8) {
        for (let y = -tubeHalf; y <= tubeHalf - ps; y += ps) {
          rects.push(<rect key={key++} x={x} y={y} width={ps} height={ps} fill={d} />);
        }
      }
      for (let x = hubHalf + 2; x < edge; x += ps) {
        rects.push(<rect key={key++} x={x} y={-1} width={ps} height={2} fill={l} />);
      }
    }
    if (dir === "w") {
      for (let x = -edge; x < -hubHalf - 2; x += ps) {
        rects.push(<rect key={key++} x={x} y={-tubeHalf - 2} width={ps} height={ps} fill={o} />);
        rects.push(<rect key={key++} x={x} y={tubeHalf - 2} width={ps} height={ps} fill={o} />);
      }
      for (let x = -edge; x < -hubHalf - 2; x += ps) {
        for (let y = -tubeHalf; y <= tubeHalf - ps; y += ps) {
          rects.push(<rect key={key++} x={x} y={y} width={ps} height={ps} fill={color} />);
        }
      }
      for (let x = -edge + 4; x < -hubHalf - 2; x += 8) {
        for (let y = -tubeHalf; y <= tubeHalf - ps; y += ps) {
          rects.push(<rect key={key++} x={x} y={y} width={ps} height={ps} fill={d} />);
        }
      }
      for (let x = -edge; x < -hubHalf - 2; x += ps) {
        rects.push(<rect key={key++} x={x} y={-1} width={ps} height={2} fill={l} />);
      }
    }
  };

  drawConnector("n");
  drawConnector("s");
  drawConnector("e");
  drawConnector("w");

  // If no neighbors at all, draw a small standalone cap
  if (!neighbors.n && !neighbors.s && !neighbors.e && !neighbors.w) {
    // end caps on all 4 sides
    for (let x = -hubHalf - 2; x <= hubHalf - 2; x += ps) {
      rects.push(<rect key={key++} x={x} y={-hubHalf - 6} width={ps} height={ps} fill={o} />);
      rects.push(<rect key={key++} x={x} y={hubHalf + 2} width={ps} height={ps} fill={o} />);
    }
  }

  return <g shapeRendering="crispEdges">{rects}</g>;
}
