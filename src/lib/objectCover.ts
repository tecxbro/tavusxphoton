export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Object-fit: cover source crop for a media frame drawn into a destination box.
 *
 * @param sourceWidth - Source media width in px.
 * @param sourceHeight - Source media height in px.
 * @param destWidth - Destination box width in px.
 * @param destHeight - Destination box height in px.
 * @returns Source rectangle to sample when drawing cover-fit.
 */
export function objectCoverSourceRect(
  sourceWidth: number,
  sourceHeight: number,
  destWidth: number,
  destHeight: number,
): Rect {
  if (sourceWidth <= 0 || sourceHeight <= 0 || destWidth <= 0 || destHeight <= 0) {
    return { x: 0, y: 0, width: Math.max(0, sourceWidth), height: Math.max(0, sourceHeight) };
  }

  const sourceRatio = sourceWidth / sourceHeight;
  const destRatio = destWidth / destHeight;

  if (sourceRatio > destRatio) {
    const width = sourceHeight * destRatio;
    return {
      x: (sourceWidth - width) / 2,
      y: 0,
      width,
      height: sourceHeight,
    };
  }

  const height = sourceWidth / destRatio;
  return {
    x: 0,
    y: (sourceHeight - height) / 2,
    width: sourceWidth,
    height,
  };
}

/**
 * Begin a rounded-rect path on a 2D canvas context (for LiquidGL video blit masks).
 *
 * @param ctx - Canvas 2D context.
 * @param x - Left edge.
 * @param y - Top edge.
 * @param width - Box width.
 * @param height - Box height.
 * @param radius - Corner radius (clamped to half-min side).
 */
export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}
