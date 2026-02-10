import { generatePatients } from './patients'
import { generateSurgeons } from './surgeons'
import { generateEquipmentList } from './equipment'
import { generateORs } from './ors'
import { generateSurgery } from './surgeries'

// Optionally import Supabase client here
// import { supabase } from '../../lib/supabase/client'

const patients = generatePatients(5000)
const surgeons = generateSurgeons(120)
const equipment = generateEquipmentList(300)
const ors = generateORs(20)

const surgeries = patients.slice(0, 3000).map(patient => {
  const surgeon = surgeons[Math.floor(Math.random() * surgeons.length)]
  const or = ors[Math.floor(Math.random() * ors.length)]
  return generateSurgery(patient, surgeon, or)
})

// Optionally insert into Supabase here
// await supabase.from('patients').insert(patients)
// await supabase.from('surgeons').insert(surgeons)
// ...

console.log('✅ Faker data generated successfully')
console.log({
  patients: patients.length,
  surgeons: surgeons.length,
  equipment: equipment.length,
  ors: ors.length,
  surgeries: surgeries.length
})
