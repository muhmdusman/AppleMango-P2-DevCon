import { faker } from '@faker-js/faker'

export type Surgeon = {
  id: string
  name: string
  specialization: string
  experience_years: number
  avg_surgery_duration: number
  availability: boolean
}

const SPECIALIZATIONS = [
  'General Surgery',
  'Orthopedics',
  'Cardiology',
  'Neurosurgery',
  'Urology'
]

export function generateSurgeon(): Surgeon {
  const experience = faker.number.int({ min: 3, max: 30 })

  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    specialization: faker.helpers.arrayElement(SPECIALIZATIONS),
    experience_years: experience,
    avg_surgery_duration: faker.number.int({
      min: 60 - experience,
      max: 180 - experience
    }),
    availability: faker.datatype.boolean()
  }
}

export function generateSurgeons(count: number): Surgeon[] {
  return Array.from({ length: count }, generateSurgeon)
}
