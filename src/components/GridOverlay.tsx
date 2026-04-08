interface GridOverlayProps {
  cellSize: number;
  boardWidth: number;
  boardHeight: number;
  opacity?: number;
}

export default function GridOverlay({ cellSize, boardWidth, boardHeight, opacity = 0.15 }: GridOverlayProps) {
  if (cellSize <= 0 || boardWidth <= 0 || boardHeight <= 0) return null;

  const cols = Math.ceil(boardWidth / cellSize) + 1;
  const rows = Math.ceil(boardHeight / cellSize) + 1;

  const vLines: number[] = [];
  const hLines: number[] = [];

  for (let i = 0; i <= cols; i++) vLines.push(i * cellSize);
  for (let j = 0; j <= rows; j++) hLines.push(j * cellSize);

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-5"
      width={boardWidth}
      height={boardHeight}
      style={{ opacity }}
    >
      {vLines.map(x => (
        <line key={`v${x}`} x1={x} y1={0} x2={x} y2={boardHeight}
          stroke="hsl(var(--gold))" strokeWidth={0.5} />
      ))}
      {hLines.map(y => (
        <line key={`h${y}`} x1={0} y1={y} x2={boardWidth} y2={y}
          stroke="hsl(var(--gold))" strokeWidth={0.5} />
      ))}
    </svg>
  );
}
