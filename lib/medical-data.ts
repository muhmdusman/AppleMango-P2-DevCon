/* ============================================================
   ICD-10 Medical Procedure Codes & Equipment Catalog
   Source: CMS ICD-10-PCS (Public Domain)
   Equipment: Standard OR Equipment Catalogs
   ============================================================ */

/** ICD-10-PCS procedure entries used for realistic surgery generation */
export interface ICD10Procedure {
  code: string;
  name: string;
  category: string;
  specialization: "general" | "cardiac" | "neuro" | "orthopedic" | "ent";
  avgDuration: number;     // minutes
  complexity: 1 | 2 | 3 | 4 | 5;
  equipment: string[];
  preOp: string;
  postOp: string;
}

export const ICD10_PROCEDURES: ICD10Procedure[] = [
  // ── General Surgery ──────────────────────────────────────
  { code: "0DT60ZZ", name: "Laparoscopic Appendectomy", category: "Digestive System", specialization: "general", avgDuration: 60, complexity: 2, equipment: ["Laparoscopic Tower", "Electrocautery Unit"], preOp: "CBC, CRP, Ultrasound Abdomen, NPO 8h", postOp: "Oral Antibiotics 5 days, Follow-up 1 week" },
  { code: "0FB44ZZ", name: "Laparoscopic Cholecystectomy", category: "Hepatobiliary System", specialization: "general", avgDuration: 75, complexity: 2, equipment: ["Laparoscopic Tower", "Electrocautery Unit"], preOp: "LFTs, Ultrasound Abdomen, CBC, NPO 8h", postOp: "Same-day discharge if stable, Low-fat diet 2 weeks" },
  { code: "0DQ60ZZ", name: "Open Hernia Repair with Mesh", category: "Lower GI", specialization: "general", avgDuration: 90, complexity: 2, equipment: ["General Surgical Set", "Mesh Graft Kit"], preOp: "CBC, ECG if >40y, NPO 6h", postOp: "Wound care, No heavy lifting 6 weeks, Follow-up 2 weeks" },
  { code: "0DT70ZZ", name: "Right Hemicolectomy", category: "Digestive System", specialization: "general", avgDuration: 150, complexity: 4, equipment: ["General Surgical Set", "Stapling Device", "Electrocautery Unit"], preOp: "CT Abdomen, CEA, Bowel Prep, Blood Cross-match 2 units, Cardiology Clearance", postOp: "NPO 48h, IV Antibiotics, DVT Prophylaxis, Drain management" },
  { code: "0B110Z4", name: "Total Thyroidectomy", category: "Endocrine System", specialization: "general", avgDuration: 120, complexity: 3, equipment: ["Thyroid Surgical Set", "Nerve Monitor"], preOp: "Thyroid Profile, Neck Ultrasound, Vocal Cord Assessment, Calcium levels", postOp: "Calcium monitoring q6h, Voice assessment, Thyroid replacement" },
  { code: "0UT90ZZ", name: "Total Abdominal Hysterectomy", category: "Female Reproductive", specialization: "general", avgDuration: 120, complexity: 3, equipment: ["General Surgical Set", "Electrocautery Unit"], preOp: "CBC, Pap smear, Pelvic Ultrasound, Blood type, ECG", postOp: "Foley 24h, DVT Prophylaxis, Ambulation Day 1" },
  { code: "0DTJ0ZZ", name: "Sigmoid Colectomy", category: "Digestive System", specialization: "general", avgDuration: 180, complexity: 4, equipment: ["General Surgical Set", "Stapling Device", "Laparoscopic Tower"], preOp: "Colonoscopy, CT Abdomen, Bowel Prep, Blood Cross-match 3 units", postOp: "NPO until bowel sounds, IV Antibiotics 5 days, Gradual diet" },
  { code: "0FT40ZZ", name: "Open Cholecystectomy", category: "Hepatobiliary System", specialization: "general", avgDuration: 100, complexity: 3, equipment: ["General Surgical Set", "Electrocautery Unit"], preOp: "LFTs, MRCP, CBC, Blood type, NPO 8h", postOp: "Drain care, IV Antibiotics 48h, Progress diet slowly" },
  { code: "0D160J4", name: "Gastric Bypass (Roux-en-Y)", category: "Digestive System", specialization: "general", avgDuration: 180, complexity: 4, equipment: ["Laparoscopic Tower", "Stapling Device", "Liver Retractor"], preOp: "Endoscopy, Psych eval, Nutritional eval, Sleep study, ECG, PFTs", postOp: "Liquid diet 2 weeks, B12/Iron supplements, Nutritionist follow-up" },
  { code: "0DB60ZZ", name: "Splenectomy (Open)", category: "Lymphatic System", specialization: "general", avgDuration: 120, complexity: 3, equipment: ["General Surgical Set", "Electrocautery Unit", "Ligature Clips"], preOp: "CBC, Coag Profile, CT Abdomen, Pneumococcal vaccine, Blood Cross-match 4 units", postOp: "DVT Prophylaxis, Post-splenectomy vaccines, Antibiotic prophylaxis" },
  { code: "0DT80ZZ", name: "Laparoscopic Nissen Fundoplication", category: "Digestive System", specialization: "general", avgDuration: 105, complexity: 3, equipment: ["Laparoscopic Tower", "Bougie Dilator"], preOp: "Barium Swallow, pH Study, Manometry, NPO 8h", postOp: "Liquid diet 1 week, Anti-reflux precautions, PPI taper" },

  // ── Cardiac Surgery ──────────────────────────────────────
  { code: "0210093", name: "Coronary Artery Bypass Graft (CABG) x3", category: "Heart & Great Vessels", specialization: "cardiac", avgDuration: 300, complexity: 5, equipment: ["Heart-Lung Bypass Machine", "Cardiac Surgical Set", "Sternal Saw"], preOp: "Coronary Angiography, Echo, Blood Cross-match 4 units, PFTs, Carotid Duplex", postOp: "ICU 48-72h, Cardiac Monitoring, Chest Drain, Cardiac Rehab" },
  { code: "02RF0JZ", name: "Aortic Valve Replacement", category: "Heart & Great Vessels", specialization: "cardiac", avgDuration: 240, complexity: 5, equipment: ["Heart-Lung Bypass Machine", "Valve Prosthesis", "TEE Probe"], preOp: "Echo (TTE/TEE), Cardiac Cath, CT Aortogram, Dental clearance, Blood Cross-match 4 units", postOp: "ICU 48h, Anticoagulation, Echo Day 5, Endocarditis prophylaxis" },
  { code: "02RG0JZ", name: "Mitral Valve Repair", category: "Heart & Great Vessels", specialization: "cardiac", avgDuration: 270, complexity: 5, equipment: ["Heart-Lung Bypass Machine", "Annuloplasty Ring", "TEE Probe"], preOp: "TEE, Cardiac Cath, CT Chest, Blood Cross-match 4 units, PFTs", postOp: "ICU 48h, Anticoagulation 3 months, Serial Echo, Cardiac Rehab" },
  { code: "03CG0ZZ", name: "Carotid Endarterectomy", category: "Upper Arteries", specialization: "cardiac", avgDuration: 150, complexity: 4, equipment: ["Vascular Surgical Set", "Shunt Kit", "Doppler Probe"], preOp: "Carotid Duplex, CT Angiography, Cardiology Clearance, Blood type", postOp: "BP Monitoring q15m 24h, Neuro Checks, ICU 24h, Dual antiplatelet" },
  { code: "04V00DZ", name: "Abdominal Aortic Aneurysm Repair", category: "Lower Arteries", specialization: "cardiac", avgDuration: 240, complexity: 5, equipment: ["Vascular Surgical Set", "Cell Saver", "C-Arm Fluoroscopy"], preOp: "CT Aortogram, Echo, Blood Cross-match 6 units, Renal Function", postOp: "ICU 48h, Distal pulse checks q1h, Renal monitoring, DVT Prophylaxis" },
  { code: "02YA0Z0", name: "Heart Transplant", category: "Heart & Great Vessels", specialization: "cardiac", avgDuration: 480, complexity: 5, equipment: ["Heart-Lung Bypass Machine", "Cardiac Surgical Set", "Sternal Saw", "Transport Cooler"], preOp: "Full cardiac workup, HLA typing, Cross-match, Panel Reactive Antibodies", postOp: "ICU indefinite, Immunosuppression, Endomyocardial biopsy Day 7" },

  // ── Neurosurgery ─────────────────────────────────────────
  { code: "00B70ZZ", name: "Craniotomy for Tumor Excision", category: "Central Nervous System", specialization: "neuro", avgDuration: 300, complexity: 5, equipment: ["Surgical Microscope", "Neuronavigation System", "Craniotome"], preOp: "MRI Brain with contrast, CT Angiography, Functional MRI, Dexamethasone, Antiepileptics", postOp: "Neuro ICU 72h, q1h Neuro checks, Serial CT, Antiepileptics, Dexamethasone taper" },
  { code: "00B80ZZ", name: "Craniotomy for Meningioma", category: "Cerebral Meninges", specialization: "neuro", avgDuration: 240, complexity: 5, equipment: ["Surgical Microscope", "Neuronavigation System", "Bipolar Cautery"], preOp: "MRI Brain, CT Head, Angiography if vascular, Dexamethasone", postOp: "Neuro ICU 48h, Neuro checks q1h, Wound drain, Seizure prophylaxis" },
  { code: "00SG0ZZ", name: "Lumbar Laminectomy & Discectomy", category: "Peripheral Nervous System", specialization: "neuro", avgDuration: 120, complexity: 3, equipment: ["Spine Instrument Set", "Surgical Microscope", "C-Arm Fluoroscopy"], preOp: "MRI Lumbar Spine, EMG/NCV, X-ray L-Spine, Anesthesia clearance", postOp: "Ambulation Day 0, Physio, Neuro assessment, Pain management" },
  { code: "0RS10AZ", name: "Cervical Spinal Fusion (ACDF)", category: "Upper Joints", specialization: "neuro", avgDuration: 150, complexity: 4, equipment: ["Spine Instrument Set", "Bone Graft", "C-Arm Fluoroscopy", "Surgical Microscope"], preOp: "MRI C-Spine, CT C-Spine, Flexion/Extension X-rays, Bone density", postOp: "Cervical collar 6 weeks, Swallow assessment, Physio, X-ray 6 weeks" },
  { code: "009T0ZZ", name: "Ventriculoperitoneal Shunt Placement", category: "Central Nervous System", specialization: "neuro", avgDuration: 90, complexity: 3, equipment: ["Shunt System", "Neuronavigation System"], preOp: "CT Head, MRI Brain, ICP monitoring, Blood work", postOp: "Head elevation 30°, Neuro checks q2h, Shunt series X-ray" },
  { code: "00B00ZZ", name: "Stereotactic Brain Biopsy", category: "Central Nervous System", specialization: "neuro", avgDuration: 90, complexity: 3, equipment: ["Stereotactic Frame", "Neuronavigation System", "CT Scanner"], preOp: "MRI Brain, CT Head, Coagulation profile, Consent for diagnosis", postOp: "CT Head 6h post-op, Neuro checks q1h, Wound care" },

  // ── Orthopedic Surgery ───────────────────────────────────
  { code: "0SR9019", name: "Total Hip Replacement", category: "Lower Joints", specialization: "orthopedic", avgDuration: 150, complexity: 4, equipment: ["Power Drill", "Hip Prosthesis Set", "C-Arm Fluoroscopy"], preOp: "Hip X-ray AP/Lateral, Echo if >65y, Blood Cross-match 2 units, DVT Risk Assessment, Dental clearance", postOp: "DVT Prophylaxis 28 days, Physio Day 1, Walker 6 weeks, Antibiotic prophylaxis" },
  { code: "0SRD019", name: "Total Knee Replacement", category: "Lower Joints", specialization: "orthopedic", avgDuration: 120, complexity: 3, equipment: ["Power Drill", "Knee Prosthesis Set", "Tourniquet"], preOp: "Knee X-ray AP/Lat, MRI if needed, Blood Cross-match 2 units, ECG, DVT Risk", postOp: "CPM Machine, Physio Day 1, DVT Prophylaxis, Pain Management Protocol" },
  { code: "0QS60ZZ", name: "ORIF Femur Fracture", category: "Lower Bones", specialization: "orthopedic", avgDuration: 180, complexity: 4, equipment: ["Power Drill", "Intramedullary Nail Set", "C-Arm Fluoroscopy"], preOp: "Femur X-ray AP/Lat, CT if complex, CBC, PT/APTT, Blood Cross-match 3 units", postOp: "DVT Prophylaxis, Physio Day 2, Weight-bearing protocol, X-ray 6 weeks" },
  { code: "0QS30ZZ", name: "ORIF Radius/Ulna Fracture", category: "Upper Bones", specialization: "orthopedic", avgDuration: 90, complexity: 2, equipment: ["Small Fragment Set", "C-Arm Fluoroscopy", "Power Drill"], preOp: "Forearm X-ray, Neurovascular exam, CBC, NPO 6h", postOp: "Splint/Cast, Elevation, Physio 2 weeks, X-ray 4 weeks" },
  { code: "0MBN0ZZ", name: "ACL Reconstruction (Arthroscopic)", category: "Lower Joints", specialization: "orthopedic", avgDuration: 120, complexity: 3, equipment: ["Arthroscopy Tower", "Graft Fixation Set", "Tourniquet"], preOp: "MRI Knee, X-ray Knee, Physio baseline, NPO 6h", postOp: "Brace, CPM, Physio protocol 9 months, Cryotherapy" },
  { code: "0PS004Z", name: "Rotator Cuff Repair (Arthroscopic)", category: "Upper Joints", specialization: "orthopedic", avgDuration: 105, complexity: 3, equipment: ["Arthroscopy Tower", "Suture Anchor Set"], preOp: "MRI Shoulder, X-ray, Physio baseline assessment", postOp: "Sling 6 weeks, Pendulum exercises, Physio protocol 4-6 months" },
  { code: "0QS00ZZ", name: "Spinal Fusion (Lumbar Posterior)", category: "Lower Bones", specialization: "orthopedic", avgDuration: 240, complexity: 5, equipment: ["Spine Instrument Set", "Pedicle Screw Set", "C-Arm Fluoroscopy", "Bone Graft"], preOp: "MRI L-Spine, CT L-Spine, Bone Density, Blood Cross-match 3 units, Anesthesia clearance", postOp: "Lumbar brace, No BLT 12 weeks, Physio 6 weeks, X-ray 6 weeks" },

  // ── ENT / Ophthalmic ─────────────────────────────────────
  { code: "09TC0ZZ", name: "Tonsillectomy & Adenoidectomy", category: "Ear Nose Throat", specialization: "ent", avgDuration: 45, complexity: 1, equipment: ["ENT Surgical Set", "Electrocautery Unit"], preOp: "CBC, Coag Profile, NPO 8h, Consent for bleeding risk", postOp: "Soft diet 2 weeks, Pain management, Watch for bleeding" },
  { code: "09TM0ZZ", name: "Functional Endoscopic Sinus Surgery", category: "Ear Nose Throat", specialization: "ent", avgDuration: 90, complexity: 2, equipment: ["Endoscope Tower", "Microdebrider", "Navigation System"], preOp: "CT Sinuses, Nasal Endoscopy, Allergy testing, NPO 6h", postOp: "Nasal packing 24h, Saline irrigation, Antibiotics 10 days" },
  { code: "08RJ3JZ", name: "Cataract Surgery with IOL Implant", category: "Eye", specialization: "ent", avgDuration: 30, complexity: 1, equipment: ["Phacoemulsification System", "IOL Kit", "Surgical Microscope"], preOp: "Biometry, Slit lamp exam, IOP measurement, Topical mydriatics", postOp: "Eye shield overnight, Topical antibiotics/steroids 4 weeks, No heavy lifting" },
  { code: "09S50ZZ", name: "Septoplasty", category: "Ear Nose Throat", specialization: "ent", avgDuration: 60, complexity: 2, equipment: ["ENT Surgical Set", "Nasal Splints"], preOp: "CT Sinuses, Nasal Endoscopy, CBC, NPO 6h", postOp: "Nasal packing 48h, Saline spray, No nose blowing 2 weeks" },
  { code: "09150ZZ", name: "Mastoidectomy", category: "Ear Nose Throat", specialization: "ent", avgDuration: 150, complexity: 4, equipment: ["Surgical Microscope", "High-Speed Drill", "ENT Surgical Set"], preOp: "CT Temporal Bone, Audiometry, CBC, NPO 8h", postOp: "Head elevation, Antibiotic eardrops, Hearing test 6 weeks" },
];

/** Standard OR Equipment Catalog entries */
export interface EquipmentCatalogEntry {
  name: string;
  type: string;
  maxUsage: number;
  locations: string[];
}

export const EQUIPMENT_CATALOG: EquipmentCatalogEntry[] = [
  // General
  { name: "General Surgical Set", type: "instruments", maxUsage: 100, locations: ["Storage-1", "Storage-2"] },
  { name: "Laparoscopic Tower (Stryker)", type: "instruments", maxUsage: 150, locations: ["OR-1", "OR-2"] },
  { name: "Electrocautery Unit (Valleylab)", type: "instruments", maxUsage: 200, locations: ["OR-1", "OR-2", "OR-3"] },
  { name: "Stapling Device (Ethicon)", type: "instruments", maxUsage: 50, locations: ["Storage-1"] },
  { name: "Ligature Clip Applier", type: "instruments", maxUsage: 120, locations: ["Storage-1"] },
  // Anesthesia
  { name: "Anesthesia Machine (Dräger Primus)", type: "anesthesia", maxUsage: 500, locations: ["OR-1", "OR-3"] },
  { name: "Anesthesia Machine (GE Aisys CS2)", type: "anesthesia", maxUsage: 500, locations: ["OR-2", "OR-4"] },
  { name: "Anesthesia Machine (Mindray A7)", type: "anesthesia", maxUsage: 500, locations: ["OR-5", "OR-6"] },
  // Cardiac
  { name: "Heart-Lung Bypass Machine (Terumo)", type: "cardiac", maxUsage: 50, locations: ["OR-3"] },
  { name: "Intra-Aortic Balloon Pump (Maquet)", type: "cardiac", maxUsage: 80, locations: ["OR-3"] },
  { name: "TEE Probe (Philips)", type: "cardiac", maxUsage: 200, locations: ["OR-3"] },
  { name: "Cell Saver (Haemonetics)", type: "cardiac", maxUsage: 100, locations: ["OR-3", "OR-5"] },
  { name: "Defibrillator (Zoll R-Series)", type: "cardiac", maxUsage: 100, locations: ["Emergency", "OR-3"] },
  // Neuro
  { name: "Surgical Microscope (Zeiss KINEVO)", type: "neuro", maxUsage: 200, locations: ["OR-4"] },
  { name: "Neuronavigation System (Medtronic StealthStation)", type: "neuro", maxUsage: 100, locations: ["OR-4"] },
  { name: "Craniotome (Midas Rex)", type: "neuro", maxUsage: 80, locations: ["OR-4"] },
  { name: "Bipolar Cautery (Codman)", type: "neuro", maxUsage: 150, locations: ["OR-4", "OR-1"] },
  // Orthopedic
  { name: "Power Drill (Stryker System 8)", type: "instruments", maxUsage: 100, locations: ["OR-5"] },
  { name: "C-Arm Fluoroscopy (Siemens Cios)", type: "imaging", maxUsage: 300, locations: ["OR-5", "OR-4"] },
  { name: "Arthroscopy Tower (Arthrex Synergy)", type: "instruments", maxUsage: 120, locations: ["OR-5"] },
  { name: "Tourniquet System (Zimmer)", type: "instruments", maxUsage: 500, locations: ["OR-5", "Storage-1"] },
  // Monitoring
  { name: "Patient Monitor (Philips MX800)", type: "monitoring", maxUsage: 600, locations: ["OR-1", "OR-2"] },
  { name: "Patient Monitor (GE B450)", type: "monitoring", maxUsage: 600, locations: ["OR-3", "OR-4"] },
  { name: "Pulse Oximeter (Masimo Rad-97)", type: "monitoring", maxUsage: 800, locations: ["Pre-Op", "PACU"] },
  { name: "Portable Ultrasound (SonoSite)", type: "imaging", maxUsage: 400, locations: ["Pre-Op", "OR-1"] },
  // ENT
  { name: "Endoscope Tower (Karl Storz)", type: "instruments", maxUsage: 150, locations: ["OR-6"] },
  { name: "Microdebrider (Medtronic)", type: "instruments", maxUsage: 100, locations: ["OR-6"] },
  { name: "Phacoemulsification System (Alcon)", type: "instruments", maxUsage: 200, locations: ["OR-6"] },
  { name: "High-Speed Drill (Bien-Air)", type: "instruments", maxUsage: 80, locations: ["OR-6", "OR-4"] },
];

/** Pakistani cities for multi-tenant hospital data */
export const PAKISTAN_CITIES = [
  "Islamabad", "Lahore", "Karachi", "Rawalpindi", "Peshawar",
  "Faisalabad", "Multan", "Quetta", "Sialkot", "Hyderabad",
];

/** Hospital name templates */
export const HOSPITAL_NAMES = [
  "Pakistan Institute of Medical Sciences",
  "Combined Military Hospital",
  "Shifa International Hospital",
  "Aga Khan University Hospital",
  "Lady Reading Hospital",
  "Jinnah Hospital",
  "Holy Family Hospital",
  "Services Hospital",
  "Nishtar Medical University Hospital",
  "Allied Hospital",
];

/** Medical specializations for staff */
export const SPECIALIZATIONS: Record<string, string[]> = {
  surgeon: ["general", "cardiac", "neuro", "orthopedic", "ent", "vascular", "pediatric", "plastic"],
  anesthesiologist: ["general", "cardiac", "neuro", "pediatric", "obstetric"],
  nurse: ["general", "cardiac", "neuro", "orthopedic", "ent", "icu", "pacu"],
};
