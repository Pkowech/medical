import type { MaterialProgressSummary } from '@/shared/types/progressInterface';

export function summarizeTopicMaterialProgress(
  materialIds: Array<string | number>,
  progressByMaterialId: ReadonlyMap<string, MaterialProgressSummary>,
) {
  const materialProgress = Object.fromEntries(
    materialIds.flatMap(materialId => {
      const progress = progressByMaterialId.get(String(materialId));
      return progress ? [[String(materialId), progress] as const] : [];
    }),
  );
  const readingProgressPercentage = materialIds.length
    ? Math.round(
        materialIds.reduce<number>(
          (total, materialId) =>
            total +
            (progressByMaterialId.get(String(materialId))?.progressPercentage ?? 0),
          0,
        ) / materialIds.length,
      )
    : 0;

  return { materialProgress, readingProgressPercentage };
}
