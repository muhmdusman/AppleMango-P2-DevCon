import { faker } from '@faker-js/faker'
import type { Patient } from './patients'
import type { Surgeon } from './surgeons'
import type { OperatingRoom } from './ors'

export type Surgery = {
  id: string
  patient_id: string
  surgeon_id: string
  or_id: string
  procedure_code: string
  procedure_name: string
  complexity: number
  scheduled_duration: number
  actual_duration: number
  predicted_duration: number
  priority: 'Low' | 'Medium' | 'High' | 'Emergency'
  scheduled_start: Date
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Delayed'
}

const PROCEDURES = [
  { code: 'ICD10-0DTJ4ZZ', name: 'Appendectomy', base: 60 },
  { code: 'ICD10-0FT44ZZ', name: 'Hip Replacement', base: 120 },
  { code: 'ICD10-0WQF0ZZ', name: 'Craniotomy', base: 180 }
]

export function generateSurgery(
  patient: Patient,
  surgeon: Surgeon,
  or: OperatingRoom
): Surgery {
  const procedure = faker.helpers.arrayElement(PROCEDURES)
  const complexity = faker.number.int({ min: 1, max: 5 })

  const predicted =
    procedure.base +
    complexity * 15 +
    faker.number.int({ min: -10, max: 20 })

  const actual =
    predicted + faker.number.int({ min: -15, max: 30 })

  return {
    id: faker.string.uuid(),
    patient_id: patient.id,
    surgeon_id: surgeon.id,
    or_id: or.id,
    procedure_code: procedure.code,
    procedure_name: procedure.name,
    complexity,
    scheduled_duration: procedure.base + complexity * 10,
    predicted_duration: predicted,
    actual_duration: actual,
    priority: faker.helpers.arrayElement([
      'Low',
      'Medium',
      'High',
      'Emergency'
    ]),
    scheduled_start: faker.date.soon({ days: 14 }),
    status: faker.helpers.arrayElement([
      'Scheduled',
      'In Progress',
      'Completed',
      'Delayed'
    ])
  }
}
