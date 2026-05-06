export type Grade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
export type OverallGrade = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
export type Confidence = 'low' | 'medium' | 'high'

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
      headlights: { left: Grade; right: Grade }
      frontFenders: Grade
      windshield: Grade
      frontDoors: { left: Grade; right: Grade }
      rearDoors: { left: Grade; right: Grade }
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
    valueRangeGel: { min: number; max: number }
    valueRangeUsd?: { min: number; max: number }
    caveats: string[]
  }
  summary: {
    overallGrade: OverallGrade
    visibleDamageNotes: string[]
    recommendation: string
    accuracyInputs: string[]
  }
}
