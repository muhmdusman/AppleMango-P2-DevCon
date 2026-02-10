/* ============================================================
   AI / Heuristic prediction utilities
   - Surgery duration prediction (complexity-based regression)
   - Schedule optimization scorer (greedy priority sorting)
   - Equipment failure prediction (usage threshold alerts)
   ============================================================ */

/**
 * Predict surgery duration using a complexity-based regression formula.
 * Factors: procedure complexity, patient age, BMI, ASA score, time of day.
 * Returns predicted minutes with confidence interval.
 */
export function predictSurgeryDuration(params: {
  complexity: number;       // 1-5
  estimatedDuration: number; // base minutes
  patientAge?: number;
  patientBmi?: number;
  asaScore?: number;        // 1-6
  hourOfDay?: number;       // 0-23
}): { predicted: number; lower: number; upper: number; confidence: number } {
  const { complexity, estimatedDuration, patientAge = 45, patientBmi = 25, asaScore = 2, hourOfDay = 10 } = params;

  // Base prediction from estimated duration
  let predicted = estimatedDuration;

  // Complexity multiplier (1.0 - 1.5x)
  const complexityFactor = 1 + (complexity - 1) * 0.12;
  predicted *= complexityFactor;

  // Age adjustment: older patients take longer (+0.5% per year over 50)
  if (patientAge > 50) {
    predicted *= 1 + (patientAge - 50) * 0.005;
  }

  // BMI adjustment: higher BMI adds time (+1% per BMI point over 30)
  if (patientBmi > 30) {
    predicted *= 1 + (patientBmi - 30) * 0.01;
  }

  // ASA score adjustment: higher ASA = more complex patient
  predicted *= 1 + (asaScore - 1) * 0.05;

  // Fatigue factor: afternoon surgeries take ~5% longer
  if (hourOfDay >= 14) {
    predicted *= 1.05;
  }

  predicted = Math.round(predicted);

  // Confidence interval (±15% for low complexity, ±25% for high)
  const marginPct = 0.1 + complexity * 0.03;
  const lower = Math.round(predicted * (1 - marginPct));
  const upper = Math.round(predicted * (1 + marginPct));
  const confidence = Math.max(60, Math.round(95 - complexity * 5));

  return { predicted, lower, upper, confidence };
}

/**
 * Score schedule quality from 0-100.
 * Checks for gaps, overtime, emergency buffer, batch similarity.
 */
export function scoreScheduleQuality(slots: {
  start: Date;
  end: Date;
  priority: string;
  procedureType?: string;
}[]): { score: number; issues: string[] } {
  if (slots.length === 0) return { score: 100, issues: [] };

  const issues: string[] = [];
  let score = 100;

  // Sort by start time
  const sorted = [...slots].sort((a, b) => a.start.getTime() - b.start.getTime());

  // Check for gaps > 30 min (wasted OR time)
  for (let i = 1; i < sorted.length; i++) {
    const gap = (sorted[i].start.getTime() - sorted[i - 1].end.getTime()) / 60000;
    if (gap > 30) {
      score -= 5;
      issues.push(`${Math.round(gap)}min gap between slots ${i} and ${i + 1}`);
    }
  }

  // Check emergency buffer (should have 2h free)
  const hasEmergencyBuffer = sorted.some(
    (_, i) => i < sorted.length - 1 &&
      (sorted[i + 1].start.getTime() - sorted[i].end.getTime()) / 3600000 >= 2
  );
  if (!hasEmergencyBuffer && sorted.length > 3) {
    score -= 10;
    issues.push("No emergency buffer period detected");
  }

  // Check for overtime (beyond 18:00)
  const overtimeSlots = sorted.filter(s => s.end.getHours() >= 18);
  if (overtimeSlots.length > 0) {
    score -= overtimeSlots.length * 3;
    issues.push(`${overtimeSlots.length} surgeries extend past 6 PM`);
  }

  // Bonus for batching similar procedures
  const types = sorted.map(s => s.procedureType).filter(Boolean);
  const uniqueTypes = new Set(types);
  if (uniqueTypes.size < types.length * 0.5) {
    score += 5; // similar procedures batched
  }

  return { score: Math.max(0, Math.min(100, score)), issues };
}

/**
 * Predict equipment failure risk based on usage count vs maintenance threshold.
 * Returns risk level and recommended action.
 */
export function predictEquipmentFailure(params: {
  usageCount: number;
  maxUsage: number;
  lastMaintenance?: string;
  daysSinceLastMaintenance?: number;
}): { risk: "low" | "medium" | "high" | "critical"; score: number; action: string } {
  const { usageCount, maxUsage, daysSinceLastMaintenance = 30 } = params;

  const usageRatio = usageCount / maxUsage;
  const ageRisk = daysSinceLastMaintenance / 90; // 90 days = full risk

  // Combined risk score 0-100
  const score = Math.round(Math.min(100, (usageRatio * 60 + ageRisk * 40)));

  if (score >= 80) {
    return { risk: "critical", score, action: "Schedule immediate maintenance — high failure probability" };
  } else if (score >= 60) {
    return { risk: "high", score, action: "Schedule maintenance within 48 hours" };
  } else if (score >= 40) {
    return { risk: "medium", score, action: "Monitor closely — maintenance due soon" };
  }
  return { risk: "low", score, action: "Normal operation — no action required" };
}
