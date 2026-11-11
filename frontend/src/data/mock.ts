// Static, synthetic data for the first UI pass.
// Replace with typed API calls (src/api/) once the FastAPI backend is up.
import type { IconName } from '../components/Icon'
import type {
  Kind,
  AllergySeverity,
  AllergyRecord,
  HealthEvent,
  PatientProfile,
  PrescriptionRecord,
  AccessGrant,
  AccessRequest,
  Caregiver,
  AuditLogEntry,
} from '../types'

export type {
  Kind,
  AllergySeverity,
  AllergyRecord,
  HealthEvent,
  PatientProfile,
  PrescriptionRecord,
  AccessGrant,
  AccessRequest,
  Caregiver,
  AuditLogEntry,
}

export type Severity = AllergySeverity

export const kindOrder: Kind[] = ['allergy', 'condition', 'medication', 'vaccination', 'report']

export const kinds: Record<Kind, { label: string; plural: string; icon: IconName }> = {
  allergy: { label: 'Allergy', plural: 'Allergies', icon: 'alert' },
  condition: { label: 'Condition', plural: 'Conditions', icon: 'heart' },
  medication: { label: 'Medicine', plural: 'Medicines', icon: 'pill' },
  vaccination: { label: 'Vaccination', plural: 'Vaccinations', icon: 'syringe' },
  report: { label: 'Report', plural: 'Reports', icon: 'flask' },
}

  export const initialPatientProfile: PatientProfile = {
    id: 'pat-001',
    userId: 'usr-001',
    mediclaimId: '4821 9306 1175',
    aadhaarMasked: 'XXXX-XXXX-8921',
    fullName: 'Ananya Rao',
    firstName: 'Ananya',
    dateOfBirth: '1994-05-12',
    gender: 'Female',
    bloodGroup: 'O+',
    phone: '+91 98765 43210',
    address: 'Flat 402, Sea View Apartments, Shivaji Park, Mumbai, Maharashtra – 400028',
    emergencyContact: {
      name: 'Lakshmi Rao',
      phone: '+91 98765 12345',
      relation: 'Mother',
    },
    isProfileComplete: true,
    createdAt: '2024-01-10T08:00:00Z',
    updatedAt: '2026-09-02T10:30:00Z',
  }

export const patient = {
  name: initialPatientProfile.fullName,
  firstName: initialPatientProfile.firstName,
  mediclaimId: initialPatientProfile.mediclaimId,
  dob: initialPatientProfile.dateOfBirth,
  gender: initialPatientProfile.gender,
  bloodGroup: initialPatientProfile.bloodGroup,
  phone: initialPatientProfile.phone,
  address: initialPatientProfile.address,
}

export const initialAllergies: AllergyRecord[] = [
  {
    id: 'alg-01',
    kind: 'allergy',
    title: 'Penicillin',
    allergen: 'Penicillin-G & Amoxicillin',
    category: 'medication',
    severity: 'severe',
    criticality: 'high',
    reaction: 'Generalized urticaria, bronchospasm, and facial angioedema',
    status: 'active',
    identifiedDate: '2003-08-21',
    provider: 'Dr. S. Nair, Family Clinic',
    notes: 'Strictly avoid penicillin-class antibiotics and beta-lactams.',
  },
  {
    id: 'alg-02',
    kind: 'allergy',
    title: 'Dust Mites',
    allergen: 'Dermatophagoides pteronyssinus',
    category: 'environment',
    severity: 'mild',
    criticality: 'low',
    reaction: 'Rhinitis, morning sneezing, and mild conjunctival injection',
    status: 'active',
    identifiedDate: '2018-02-17',
    provider: 'Dr. Meera Iyer, Shivaji Park Clinic',
    notes: 'Triggered by seasonal weather changes and high-humidity rooms.',
  },
]

export const initialPrescriptions: PrescriptionRecord[] = [
  {
    id: 'rx-01',
    title: 'Asthma Maintenance Prescription',
    doctor: 'Dr. Rohan Kulkarni',
    organization: 'Lifeline Pulmonology Clinic',
    date: '2026-08-14',
    status: 'active',
    fileType: 'pdf',
    fileName: 'prescription_kulkarni_aug2026.pdf',
    fileSize: '412 KB',
    instructions: 'Take 2 puffs daily in the morning, rinse mouth with water afterwards.',
    medications: [
      { name: 'Budesonide Inhaler', dosage: '200 mcg', frequency: 'Twice daily', duration: '90 days' },
      { name: 'Levocetirizine', dosage: '5 mg', frequency: 'Once daily at bedtime', duration: '30 days' },
    ],
  },
  {
    id: 'rx-02',
    title: 'Post-Viral Recovery Consultation',
    doctor: 'Dr. Meera Iyer',
    organization: 'Shivaji Park Health Centre',
    date: '2026-01-20',
    status: 'completed',
    fileType: 'image',
    fileName: 'rx_dr_iyer_jan2026.jpg',
    fileSize: '1.2 MB',
    instructions: 'Complete full 5-day course with plenty of oral fluids.',
    medications: [
      { name: 'Paracetamol', dosage: '650 mg', frequency: 'SOS for fever', duration: '5 days' },
      { name: 'Vitamin C & Zinc', dosage: '500 mg', frequency: 'Once daily', duration: '15 days' },
    ],
  },
]

export const events: HealthEvent[] = [
  { id: 'e01', kind: 'vaccination', title: 'Tdap booster', detail: 'Tetanus, diphtheria and pertussis booster. One dose.', date: '2026-09-02', provider: 'Dr. Meera Iyer, Shivaji Park Clinic' },
  { id: 'e02', kind: 'report', title: 'HbA1c blood test', short: 'HbA1c', detail: '5.4%, within the normal range.', date: '2026-03-11', provider: 'Apex Diagnostics, Dadar' },
  { id: 'e03', kind: 'report', title: 'Spirometry', detail: 'Mild airflow obstruction, consistent with asthma. Review in 12 months.', date: '2025-11-20', provider: 'Dr. Rohan Kulkarni, Lifeline Clinic' },
  { id: 'e04', kind: 'vaccination', title: 'Influenza (annual)', short: 'Influenza', detail: 'Seasonal flu vaccine, 2025-26 season.', date: '2025-10-04', provider: 'Dr. Meera Iyer, Shivaji Park Clinic' },
  { id: 'e05', kind: 'medication', title: 'Budesonide inhaler', short: 'Budesonide', detail: '200 mcg, twice daily. Preventer for asthma.', date: '2024-01-15', provider: 'Dr. Rohan Kulkarni, Lifeline Clinic', status: 'active' },
  { id: 'e06', kind: 'report', title: 'Lipid profile', detail: 'All values within the normal range.', date: '2023-03-22', provider: 'Apex Diagnostics, Dadar' },
  { id: 'e07', kind: 'medication', title: 'Salbutamol inhaler', short: 'Salbutamol', detail: '100 mcg, as needed for wheeze or breathlessness.', date: '2022-10-09', provider: 'Dr. Rohan Kulkarni, Lifeline Clinic', status: 'active' },
  { id: 'e08', kind: 'condition', title: 'Asthma (mild, persistent)', short: 'Asthma', detail: 'Diagnosed after a recurring night cough. Managed with inhalers.', date: '2022-10-09', provider: 'Dr. Rohan Kulkarni, Lifeline Clinic', status: 'active' },
  { id: 'e09', kind: 'vaccination', title: 'COVID-19, dose 2', short: 'COVID-19', detail: 'Covishield, second dose.', date: '2021-08-04', provider: 'Government Vaccination Centre, Bandra' },
  { id: 'e10', kind: 'vaccination', title: 'COVID-19, dose 1', short: 'COVID-19', detail: 'Covishield, first dose.', date: '2021-05-18', provider: 'Government Vaccination Centre, Bandra' },
  { id: 'e11', kind: 'allergy', title: 'Dust mites', detail: 'Sneezing and watery eyes on exposure. Triggered by dusty environments.', date: '2018-02-17', provider: 'Dr. Meera Iyer, Shivaji Park Clinic', status: 'active', severity: 'mild', reaction: 'Sneezing, watery eyes' },
  { id: 'e12', kind: 'condition', title: 'Appendicitis', detail: 'Laparoscopic appendectomy with two nights in hospital.', date: '2015-11-03', provider: 'Sion Government Hospital', status: 'resolved' },
  { id: 'e13', kind: 'condition', title: 'Dengue fever', short: 'Dengue', detail: 'Admitted for four days. Fully recovered.', date: '2009-09-12', provider: 'Municipal General Hospital', status: 'resolved' },
  { id: 'e14', kind: 'allergy', title: 'Penicillin', detail: 'Skin rash after amoxicillin course. Avoid all penicillin-class antibiotics.', date: '2003-08-21', provider: 'Dr. S. Nair, Family Clinic', status: 'active', severity: 'moderate', reaction: 'Skin rash, hives' },
  { id: 'e15', kind: 'vaccination', title: 'Measles vaccine', short: 'Measles', detail: 'Single dose at nine months.', date: '1995-02-10', provider: 'Primary Health Centre' },
  { id: 'e16', kind: 'vaccination', title: 'BCG and Hepatitis B (birth dose)', short: 'BCG, Hep B', detail: 'Given before discharge.', date: '1994-05-13', provider: 'Government Maternity Hospital' },
  { id: 'e17', kind: 'report', title: 'Birth record', detail: 'Birth weight 3.1 kg. No complications.', date: '1994-05-12', provider: 'Government Maternity Hospital' },
]

export const initialGrants: AccessGrant[] = [
  { id: 'g1', name: 'Dr. Rohan Kulkarni', role: 'Pulmonologist, Lifeline Clinic', scope: ['condition', 'medication', 'allergy'], remaining: '1 h 48 min left' },
  { id: 'g2', name: 'Dr. Meera Iyer', role: 'General physician, Shivaji Park Clinic', scope: ['allergy', 'vaccination'], remaining: '5 h 20 min left' },
]

export const initialRequests: AccessRequest[] = [
  { id: 'r1', name: 'Dr. Farhan Ali', role: 'Dermatologist, Skin & Care Centre', scope: ['allergy', 'medication'], duration: '2 hours' },
]

export const caregivers: Caregiver[] = [
  { id: 'c1', name: 'Lakshmi Rao', relation: 'Mother', scope: 'Timeline and vaccinations', since: 'Since 14 Jan 2025' },
]

export const accessLog: AuditLogEntry[] = [
  { id: 'l1', who: 'Dr. Rohan Kulkarni', what: 'viewed conditions and medicines', when: 'Today, 10:42', action: 'view' },
  { id: 'l2', who: 'Dr. Meera Iyer', what: 'viewed allergies and vaccinations', when: 'Today, 09:15', action: 'view' },
  { id: 'l3', who: 'Dr. Neha Shah', what: 'access ended automatically', when: '2 Sep 2026', action: 'revoke' },
  { id: 'l4', who: 'Dr. Meera Iyer', what: 'added Tdap booster', when: '2 Sep 2026', action: 'upload' },
  { id: 'l5', who: 'You', what: 'uploaded a prescription', when: '28 Aug 2026', action: 'upload' },
]

export const suggestions: { id: string; icon: IconName; title: string; body: string }[] = [
  { id: 's1', icon: 'syringe', title: 'Your flu vaccine is due this month', body: 'Your last dose was on 4 Oct 2025. Seasonal flu vaccines are given every year.' },
  { id: 's2', icon: 'heart', title: 'Ask about a yearly asthma check', body: 'Your last spirometry was in November 2025. Your doctor can tell you if a repeat is due.' },
  { id: 's3', icon: 'alert', title: 'Mention your penicillin allergy', body: 'Tell any new doctor or pharmacist before an antibiotic is prescribed.' },
]
