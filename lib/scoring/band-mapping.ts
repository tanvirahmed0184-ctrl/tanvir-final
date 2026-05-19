export function getBandScore(
  rawScore: number,
  module: "READING" | "LISTENING",
  variant: "ACADEMIC" | "GENERAL" = "ACADEMIC",
): number {
  if (module === "LISTENING") {
    const m: [number, number][] = [
      [40, 9],
      [39, 8.5],
      [37, 8],
      [35, 7.5],
      [32, 7],
      [30, 6.5],
      [26, 6],
      [23, 5.5],
      [18, 5],
      [16, 4.5],
      [13, 4],
      [0, 0],
    ];
    return m.find(([min]) => rawScore >= min)?.[1] ?? 0;
  }

  if (variant === "GENERAL") {
    const m: [number, number][] = [
      [40, 9],
      [39, 8.5],
      [37, 8],
      [36, 7.5],
      [34, 7],
      [32, 6.5],
      [30, 6],
      [27, 5.5],
      [23, 5],
      [19, 4.5],
      [0, 0],
    ];
    return m.find(([min]) => rawScore >= min)?.[1] ?? 0;
  }

  const m: [number, number][] = [
    [40, 9],
    [39, 8.5],
    [37, 8],
    [35, 7.5],
    [33, 7],
    [30, 6.5],
    [27, 6],
    [23, 5.5],
    [19, 5],
    [15, 4.5],
    [13, 4],
    [0, 0],
  ];
  return m.find(([min]) => rawScore >= min)?.[1] ?? 0;
}
