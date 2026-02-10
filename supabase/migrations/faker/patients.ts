import { faker } from '@faker-js/faker'

export type Patient = {
  id: string
  name: string
  age: number
  gender: 'Male' | 'Female'
  bmi: number
  asa_score: number
  comorbidities: string[]
}

const COMORBIDITIES = [
  'Diabetes',
  'Hypertension',
  'COPD',
  'Heart Disease',
  'Asthma',
  'None'
]

export function generatePatient(): Patient {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    age: faker.number.int({ min: 18, max: 85 }),
    gender: faker.helpers.arrayElement(['Male', 'Female']),
    bmi: faker.number.float({ min: 18, max: 40,  }),
    asa_score: faker.number.int({ min: 1, max: 4 }),
    comorbidities: faker.helpers.arrayElements(
      COMORBIDITIES,
      { min: 1, max: 2 }
    )
  }
}

export function generatePatients(count: number): Patient[] {
  return Array.from({ length: count }, generatePatient)
}
