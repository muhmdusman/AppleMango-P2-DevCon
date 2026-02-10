import { faker } from '@faker-js/faker'

export type OperatingRoom = {
  id: string
  name: string
  capabilities: string[]
  available: boolean
}

const CAPABILITIES = [
  'Cardiac Surgery',
  'Neurosurgery',
  'Orthopedic Surgery',
  'General Surgery'
]

export function generateOR(): OperatingRoom {
  return {
    id: faker.string.uuid(),
    name: `OR-${faker.number.int({ min: 1, max: 20 })}`,
    capabilities: faker.helpers.arrayElements(
      CAPABILITIES,
      { min: 1, max: 2 }
    ),
    available: faker.datatype.boolean()
  }
}

export function generateORs(count: number): OperatingRoom[] {
  return Array.from({ length: count }, generateOR)
}
