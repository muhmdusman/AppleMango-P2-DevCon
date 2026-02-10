import { faker } from '@faker-js/faker'

export type Equipment = {
  id: string
  name: string
  type: string
  usage_hours: number
  last_maintenance: Date
  location: string
}

const EQUIPMENT_TYPES = [
  'Ventilator',
  'Anesthesia Machine',
  'ECG Monitor',
  'Defibrillator',
  'Surgical Robot'
]

export function generateEquipment(): Equipment {
  return {
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    type: faker.helpers.arrayElement(EQUIPMENT_TYPES),
    usage_hours: faker.number.int({ min: 100, max: 6000 }),
    last_maintenance: faker.date.past({ years: 1 }),
    location: `OR-${faker.number.int({ min: 1, max: 10 })}`
  }
}

export function generateEquipmentList(count: number): Equipment[] {
  return Array.from({ length: count }, generateEquipment)
}
