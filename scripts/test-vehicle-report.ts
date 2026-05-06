import assert from 'node:assert/strict'
import {
  extractVehicleReportJson,
  normalizeVehicleInspectionReport,
  summarizeVehicleReport,
  type VehicleInspectionReport,
} from '../worker/src/vehicle-report'

const validReport: VehicleInspectionReport = {
  vehicle: {
    make: 'Toyota',
    model: 'Prius',
    modelConfidence: 'high',
    yearEstimate: '2016-2018',
    mileageEstimate: '120,000-160,000 km',
  },
  inspection: {
    interior: {
      steeringWheelCondition: 8,
      controlPanel: true,
      seatCondition: 7,
      ceilingAndPillars: 8,
      multimediaScreen: true,
    },
    exterior: {
      hood: 8,
      frontBumper: 7,
      headlights: { left: 9, right: 8 },
      frontFenders: 8,
      windshield: 9,
      frontDoors: { left: 8, right: 8 },
      rearDoors: { left: 8, right: 7 },
      sideSillsThresholds: 8,
      roof: 9,
      rearFenders: 8,
      taillights: 9,
      trunkLidAndRearBumper: 8,
    },
    electronicPanel: {
      dashboardIndicators: true,
      checkEngineLight: false,
      airbags: true,
      absBrakeSystem: true,
    },
    technicalDetails: {
      wheelsAndTires: 7,
      fluidLeakTraces: 9,
    },
  },
  market: {
    valueRangeGel: { min: 18000, max: 23000 },
    valueRangeUsd: { min: 6500, max: 8300 },
    caveats: ['Photo-based estimate only'],
  },
  summary: {
    overallGrade: 'B',
    visibleDamageNotes: ['Minor bumper wear'],
    recommendation: 'Good candidate if service history checks out.',
    accuracyInputs: ['VIN', 'odometer photo', 'service history'],
  },
}

assert.deepEqual(normalizeVehicleInspectionReport(validReport), validReport)

const fGradeReport = {
  ...validReport,
  summary: {
    ...validReport.summary,
    overallGrade: 'F',
  },
}
assert.equal(normalizeVehicleInspectionReport(fGradeReport).summary.overallGrade, 'F')

const clamped = normalizeVehicleInspectionReport({
  ...validReport,
  inspection: {
    ...validReport.inspection,
    interior: {
      ...validReport.inspection.interior,
      steeringWheelCondition: 13,
      seatCondition: 0,
    },
  },
})
assert.equal(clamped.inspection.interior.steeringWheelCondition, 10)
assert.equal(clamped.inspection.interior.seatCondition, 1)

assert.throws(
  () =>
    normalizeVehicleInspectionReport({
      ...validReport,
      inspection: {
        ...validReport.inspection,
        electronicPanel: {
          ...validReport.inspection.electronicPanel,
          checkEngineLight: 'maybe',
        },
      },
    }),
  /checkEngineLight/
)

assert.deepEqual(extractVehicleReportJson('```json\n{"ok":true}\n```'), { ok: true })
assert.deepEqual(extractVehicleReportJson('{"vehicle":{"make":"Toyota"}}'), {
  vehicle: { make: 'Toyota' },
})
assert.deepEqual(extractVehicleReportJson('Here is the JSON:\n```json\n{"ok":true}\n```\nDone.'), { ok: true })
assert.deepEqual(extractVehicleReportJson('Here is the JSON: {"ok":true,"nested":{"value":1}} Done.'), {
  ok: true,
  nested: { value: 1 },
})

const georgianSummary = summarizeVehicleReport(validReport, 'ka')
assert.match(georgianSummary, /საერთო შეფასება/)
assert.doesNotMatch(georgianSummary, /Overall grade/)

console.log('vehicle report validation tests passed')
