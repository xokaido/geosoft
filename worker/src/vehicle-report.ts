export type Grade = number
export type OverallGrade = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
export type Confidence = 'low' | 'medium' | 'high'
type UiLanguage = 'ka' | 'ru' | 'en'

export type VehicleInspectionReport = {
  vehicle: {
    make: string
    model: string
    modelConfidence: Confidence
    yearEstimate: string
    mileageEstimate: string
  }
  inspection: {
    interior: {
      steeringWheelCondition: Grade
      controlPanel: boolean
      seatCondition: Grade
      ceilingAndPillars: Grade
      multimediaScreen: boolean
    }
    exterior: {
      hood: Grade
      frontBumper: Grade
      headlights: {
        left: Grade
        right: Grade
      }
      frontFenders: Grade
      windshield: Grade
      frontDoors: {
        left: Grade
        right: Grade
      }
      rearDoors: {
        left: Grade
        right: Grade
      }
      sideSillsThresholds: Grade
      roof: Grade
      rearFenders: Grade
      taillights: Grade
      trunkLidAndRearBumper: Grade
    }
    electronicPanel: {
      dashboardIndicators: boolean
      checkEngineLight: boolean
      airbags: boolean
      absBrakeSystem: boolean
    }
    technicalDetails: {
      wheelsAndTires: Grade
      fluidLeakTraces: Grade
    }
  }
  market: {
    valueRangeGel: {
      min: number
      max: number
    }
    valueRangeUsd?: {
      min: number
      max: number
    }
    caveats: string[]
  }
  summary: {
    overallGrade: OverallGrade
    visibleDamageNotes: string[]
    recommendation: string
    accuracyInputs: string[]
  }
}

type JsonRecord = Record<string, unknown>

const CONFIDENCES = new Set<Confidence>(['low', 'medium', 'high'])
const OVERALL_GRADES = new Set<OverallGrade>(['A', 'B', 'C', 'D', 'E', 'F'])

const UI_LANG_LABEL: Record<UiLanguage, string> = {
  ka: 'Georgian',
  ru: 'Russian',
  en: 'English',
}

const SUMMARY_LABELS: Record<
  UiLanguage,
  {
    overallGrade: string
    modelConfidence: string
    marketEstimate: string
    visibleDamage: string
    recommendation: string
    noVisibleDamage: string
  }
> = {
  ka: {
    overallGrade: 'საერთო შეფასება',
    modelConfidence: 'მოდელის ამოცნობის სანდოობა',
    marketEstimate: 'საბაზრო შეფასება',
    visibleDamage: 'ხილული დაზიანება',
    recommendation: 'რეკომენდაცია',
    noVisibleDamage: 'მნიშვნელოვანი ხილული დაზიანება არ არის მითითებული',
  },
  ru: {
    overallGrade: 'Общая оценка',
    modelConfidence: 'Уверенность в модели',
    marketEstimate: 'Рыночная оценка',
    visibleDamage: 'Видимые повреждения',
    recommendation: 'Рекомендация',
    noVisibleDamage: 'Заметные видимые повреждения не указаны',
  },
  en: {
    overallGrade: 'Overall grade',
    modelConfidence: 'model confidence',
    marketEstimate: 'Market estimate',
    visibleDamage: 'Visible damage',
    recommendation: 'Recommendation',
    noVisibleDamage: 'No notable visible damage reported',
  },
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function requireRecord(value: unknown, path: string): JsonRecord {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object`)
  }
  return value
}

function valueAt(record: JsonRecord, key: string, path: string): unknown {
  if (!(key in record)) {
    throw new Error(`${path}.${key} is required`)
  }
  return record[key]
}

function childRecord(record: JsonRecord, key: string, path: string): JsonRecord {
  return requireRecord(valueAt(record, key, path), `${path}.${key}`)
}

function stringField(record: JsonRecord, key: string, path: string): string {
  const value = valueAt(record, key, path)
  if (typeof value !== 'string') {
    throw new Error(`${path}.${key} must be a string`)
  }
  return value
}

function stringArrayField(record: JsonRecord, key: string, path: string): string[] {
  const value = valueAt(record, key, path)
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error(`${path}.${key} must be an array of strings`)
  }
  return [...value]
}

function gradeField(record: JsonRecord, key: string, path: string): Grade {
  const value = valueAt(record, key, path)
  const numericValue = typeof value === 'number' ? value : Number.NaN
  if (!Number.isFinite(numericValue)) {
    throw new Error(`${path}.${key} must be a number`)
  }
  return Math.min(10, Math.max(1, Math.round(numericValue)))
}

function booleanField(record: JsonRecord, key: string, path: string): boolean {
  const value = valueAt(record, key, path)
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  throw new Error(`${path}.${key} must be a boolean`)
}

function confidenceField(record: JsonRecord, key: string, path: string): Confidence {
  const value = stringField(record, key, path)
  if (!CONFIDENCES.has(value as Confidence)) {
    throw new Error(`${path}.${key} must be one of: low, medium, high`)
  }
  return value as Confidence
}

function overallGradeField(record: JsonRecord, key: string, path: string): OverallGrade {
  const value = stringField(record, key, path)
  if (!OVERALL_GRADES.has(value as OverallGrade)) {
    throw new Error(`${path}.${key} must be one of: A, B, C, D, E, F`)
  }
  return value as OverallGrade
}

function numberField(record: JsonRecord, key: string, path: string): number {
  const value = valueAt(record, key, path)
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${path}.${key} must be a finite number`)
  }
  return value
}

function valueRangeField(record: JsonRecord, key: string, path: string): { min: number; max: number } {
  const range = childRecord(record, key, path)
  return {
    min: numberField(range, 'min', `${path}.${key}`),
    max: numberField(range, 'max', `${path}.${key}`),
  }
}

function optionalValueRangeField(
  record: JsonRecord,
  key: string,
  path: string
): { min: number; max: number } | undefined {
  if (!(key in record) || record[key] === undefined || record[key] === null) return undefined
  const range = requireRecord(record[key], `${path}.${key}`)
  return {
    min: numberField(range, 'min', `${path}.${key}`),
    max: numberField(range, 'max', `${path}.${key}`),
  }
}

function pairedGradeField(record: JsonRecord, key: string, path: string): { left: Grade; right: Grade } {
  const pair = childRecord(record, key, path)
  return {
    left: gradeField(pair, 'left', `${path}.${key}`),
    right: gradeField(pair, 'right', `${path}.${key}`),
  }
}

function tryParseJson(value: string): unknown | undefined {
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

function extractBalancedJsonObject(raw: string): string | null {
  for (let start = raw.indexOf('{'); start !== -1; start = raw.indexOf('{', start + 1)) {
    let depth = 0
    let inString = false
    let escaped = false

    for (let index = start; index < raw.length; index++) {
      const char = raw[index]

      if (inString) {
        if (escaped) {
          escaped = false
        } else if (char === '\\') {
          escaped = true
        } else if (char === '"') {
          inString = false
        }
        continue
      }

      if (char === '"') {
        inString = true
      } else if (char === '{') {
        depth += 1
      } else if (char === '}') {
        depth -= 1
        if (depth === 0) {
          return raw.slice(start, index + 1)
        }
      }
    }
  }

  return null
}

export function extractVehicleReportJson(raw: string): unknown {
  const trimmed = raw.trim()
  const parsedRaw = tryParseJson(trimmed)
  if (parsedRaw !== undefined) return parsedRaw

  const fencedBlocks = trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)
  for (const fencedBlock of fencedBlocks) {
    const parsedFence = tryParseJson(fencedBlock[1].trim())
    if (parsedFence !== undefined) return parsedFence
  }

  const balancedObject = extractBalancedJsonObject(trimmed)
  if (balancedObject) {
    const parsedObject = tryParseJson(balancedObject)
    if (parsedObject !== undefined) return parsedObject
  }

  return JSON.parse(trimmed)
}

export function normalizeVehicleInspectionReport(input: unknown): VehicleInspectionReport {
  const root = requireRecord(input, 'report')
  const vehicle = childRecord(root, 'vehicle', 'report')
  const inspection = childRecord(root, 'inspection', 'report')
  const interior = childRecord(inspection, 'interior', 'report.inspection')
  const exterior = childRecord(inspection, 'exterior', 'report.inspection')
  const electronicPanel = childRecord(inspection, 'electronicPanel', 'report.inspection')
  const technicalDetails = childRecord(inspection, 'technicalDetails', 'report.inspection')
  const market = childRecord(root, 'market', 'report')
  const summary = childRecord(root, 'summary', 'report')
  const valueRangeUsd = optionalValueRangeField(market, 'valueRangeUsd', 'report.market')

  return {
    vehicle: {
      make: stringField(vehicle, 'make', 'report.vehicle'),
      model: stringField(vehicle, 'model', 'report.vehicle'),
      modelConfidence: confidenceField(vehicle, 'modelConfidence', 'report.vehicle'),
      yearEstimate: stringField(vehicle, 'yearEstimate', 'report.vehicle'),
      mileageEstimate: stringField(vehicle, 'mileageEstimate', 'report.vehicle'),
    },
    inspection: {
      interior: {
        steeringWheelCondition: gradeField(interior, 'steeringWheelCondition', 'report.inspection.interior'),
        controlPanel: booleanField(interior, 'controlPanel', 'report.inspection.interior'),
        seatCondition: gradeField(interior, 'seatCondition', 'report.inspection.interior'),
        ceilingAndPillars: gradeField(interior, 'ceilingAndPillars', 'report.inspection.interior'),
        multimediaScreen: booleanField(interior, 'multimediaScreen', 'report.inspection.interior'),
      },
      exterior: {
        hood: gradeField(exterior, 'hood', 'report.inspection.exterior'),
        frontBumper: gradeField(exterior, 'frontBumper', 'report.inspection.exterior'),
        headlights: pairedGradeField(exterior, 'headlights', 'report.inspection.exterior'),
        frontFenders: gradeField(exterior, 'frontFenders', 'report.inspection.exterior'),
        windshield: gradeField(exterior, 'windshield', 'report.inspection.exterior'),
        frontDoors: pairedGradeField(exterior, 'frontDoors', 'report.inspection.exterior'),
        rearDoors: pairedGradeField(exterior, 'rearDoors', 'report.inspection.exterior'),
        sideSillsThresholds: gradeField(exterior, 'sideSillsThresholds', 'report.inspection.exterior'),
        roof: gradeField(exterior, 'roof', 'report.inspection.exterior'),
        rearFenders: gradeField(exterior, 'rearFenders', 'report.inspection.exterior'),
        taillights: gradeField(exterior, 'taillights', 'report.inspection.exterior'),
        trunkLidAndRearBumper: gradeField(exterior, 'trunkLidAndRearBumper', 'report.inspection.exterior'),
      },
      electronicPanel: {
        dashboardIndicators: booleanField(electronicPanel, 'dashboardIndicators', 'report.inspection.electronicPanel'),
        checkEngineLight: booleanField(electronicPanel, 'checkEngineLight', 'report.inspection.electronicPanel'),
        airbags: booleanField(electronicPanel, 'airbags', 'report.inspection.electronicPanel'),
        absBrakeSystem: booleanField(electronicPanel, 'absBrakeSystem', 'report.inspection.electronicPanel'),
      },
      technicalDetails: {
        wheelsAndTires: gradeField(technicalDetails, 'wheelsAndTires', 'report.inspection.technicalDetails'),
        fluidLeakTraces: gradeField(technicalDetails, 'fluidLeakTraces', 'report.inspection.technicalDetails'),
      },
    },
    market: {
      valueRangeGel: valueRangeField(market, 'valueRangeGel', 'report.market'),
      ...(valueRangeUsd ? { valueRangeUsd } : {}),
      caveats: stringArrayField(market, 'caveats', 'report.market'),
    },
    summary: {
      overallGrade: overallGradeField(summary, 'overallGrade', 'report.summary'),
      visibleDamageNotes: stringArrayField(summary, 'visibleDamageNotes', 'report.summary'),
      recommendation: stringField(summary, 'recommendation', 'report.summary'),
      accuracyInputs: stringArrayField(summary, 'accuracyInputs', 'report.summary'),
    },
  }
}

export function buildVehicleReportPrompt(uiLanguage: UiLanguage | null): string {
  const languageLine = uiLanguage
    ? `Write all natural-language string values in ${UI_LANG_LABEL[uiLanguage]}.`
    : 'Write all natural-language string values in the same language as the user request.'

  return [
    'Analyze the provided vehicle photos and return only one valid JSON object for a structured vehicle inspection report.',
    languageLine,
    'Do not include markdown fences, comments, or explanatory text around the JSON.',
    'Use integer condition grades from 1 to 10, where 10 is excellent visible condition.',
    'Use booleans for equipment and indicator fields. Use modelConfidence as one of: low, medium, high.',
    'If a value cannot be determined from the images, provide the best cautious estimate and explain uncertainty in market.caveats or summary.accuracyInputs.',
    'Required JSON shape:',
    `{
  "vehicle": {
    "make": "string",
    "model": "string",
    "modelConfidence": "low | medium | high",
    "yearEstimate": "string",
    "mileageEstimate": "string"
  },
  "inspection": {
    "interior": {
      "steeringWheelCondition": 1,
      "controlPanel": true,
      "seatCondition": 1,
      "ceilingAndPillars": 1,
      "multimediaScreen": true
    },
    "exterior": {
      "hood": 1,
      "frontBumper": 1,
      "headlights": { "left": 1, "right": 1 },
      "frontFenders": 1,
      "windshield": 1,
      "frontDoors": { "left": 1, "right": 1 },
      "rearDoors": { "left": 1, "right": 1 },
      "sideSillsThresholds": 1,
      "roof": 1,
      "rearFenders": 1,
      "taillights": 1,
      "trunkLidAndRearBumper": 1
    },
    "electronicPanel": {
      "dashboardIndicators": true,
      "checkEngineLight": false,
      "airbags": true,
      "absBrakeSystem": true
    },
    "technicalDetails": {
      "wheelsAndTires": 1,
      "fluidLeakTraces": 1
    }
  },
  "market": {
    "valueRangeGel": { "min": 0, "max": 0 },
    "valueRangeUsd": { "min": 0, "max": 0 },
    "caveats": ["string"]
  },
  "summary": {
    "overallGrade": "A | B | C | D | E | F",
    "visibleDamageNotes": ["string"],
    "recommendation": "string",
    "accuracyInputs": ["string"]
  }
}`,
  ].join('\n\n')
}

export function summarizeVehicleReport(report: VehicleInspectionReport, uiLanguage: UiLanguage | null = 'en'): string {
  const labels = SUMMARY_LABELS[uiLanguage ?? 'en']
  const usdRange = report.market.valueRangeUsd
    ? ` / USD ${report.market.valueRangeUsd.min}-${report.market.valueRangeUsd.max}`
    : ''
  const visibleDamage = report.summary.visibleDamageNotes.length
    ? report.summary.visibleDamageNotes.join('; ')
    : labels.noVisibleDamage

  return [
    `${report.vehicle.make} ${report.vehicle.model} (${report.vehicle.yearEstimate})`,
    `${labels.overallGrade}: ${report.summary.overallGrade}; ${labels.modelConfidence}: ${report.vehicle.modelConfidence}`,
    `${labels.marketEstimate}: GEL ${report.market.valueRangeGel.min}-${report.market.valueRangeGel.max}${usdRange}`,
    `${labels.visibleDamage}: ${visibleDamage}`,
    `${labels.recommendation}: ${report.summary.recommendation}`,
  ].join('\n')
}
