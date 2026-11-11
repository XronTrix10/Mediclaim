// Static, synthetic data for the first UI pass.
// Replace with typed API calls (src/api/) once the FastAPI backend is up.
import type { IconName } from '../components/Icon'

export type Kind = 'allergy' | 'condition' | 'medication' | 'vaccination' | 'report'

export const kindOrder: Kind[] = ['allergy', 'condition', 'medication', 'vaccination', 'report']

export const kinds: Record<Kind, { label: string; plural: string; icon: IconName }> = {
  allergy: { label: 'Allergy', plural: 'Allergies', icon: 'alert' },
  condition: { label: 'Condition', plural: 'Conditions', icon: 'heart' },
  medication: { label: 'Medicine', plural: 'Medicines', icon: 'pill' },
  vaccination: { label: 'Vaccination', plural: 'Vaccinations', icon: 'syringe' },
  report: { label: 'Report', plural: 'Reports', icon: 'flask' },
}

export const patient = {
  name: 'Ananya Rao',
  firstName: 'Ananya',
  mediclaimId: '4821 9306 1175',
  dob: '1994-05-12',
}

export interface HealthEvent {
  id: string
  kind: Kind
  title: string
  /** Short label used inside the graph */
  short?: string
  detail: string
  date: string
  provider: string
  status?: 'active' | 'resolved'
}

export const events: HealthEvent[] = [
  { id: 'e01', kind: 'vaccination', title: 'Tdap booster', detail: 'Tetanus, diphtheria and pertussis booster. One dose.', date: '2026-09-02', provider: 'Dr. Meera Iyer, Shivaji Park Clinic' },
  { id: 'e02', kind: 'report', title: 'HbA1c blood test', short: 'HbA1c', detail: '5.4%, within the normal range.', date: '2026-03-11', provider: 'Apex Diagnostics, Dadar' },
  { id: 'e03', kind: 'report', title: 'Spirometry', detail: 'Mild airflow obstruction, consistent with asthma. Review in 12 months.', date: '2025-11-20', provider: 'Dr. Rohan Kulkarni, Lifeline Clinic' },
  { id: 'e04', kind: 'vaccination', title: 'Influenza (annual)', short: 'Influenza', detail: 'Seasonal flu vaccine, 2025–26 season.', date: '2025-10-04', provider: 'Dr. Meera Iyer, Shivaji Park Clinic' },
  { id: 'e05', kind: 'medication', title: 'Budesonide inhaler', short: 'Budesonide', detail: '200 mcg, twice daily. Preventer for asthma.', date: '2024-01-15', provider: 'Dr. Rohan Kulkarni, Lifeline Clinic', status: 'active' },
  { id: 'e06', kind: 'report', title: 'Lipid profile', detail: 'All values within the normal range.', date: '2023-03-22', provider: 'Apex Diagnostics, Dadar' },
  { id: 'e07', kind: 'medication', title: 'Salbutamol inhaler', short: 'Salbutamol', detail: '100 mcg, as needed for wheeze or breathlessness.', date: '2022-10-09', provider: 'Dr. Rohan Kulkarni, Lifeline Clinic', status: 'active' },
  { id: 'e08', kind: 'condition', title: 'Asthma (mild, persistent)', short: 'Asthma', detail: 'Diagnosed after a recurring night cough. Managed with inhalers.', date: '2022-10-09', provider: 'Dr. Rohan Kulkarni, Lifeline Clinic', status: 'active' },
  { id: 'e09', kind: 'vaccination', title: 'COVID-19, dose 2', short: 'COVID-19', detail: 'Covishield, second dose.', date: '2021-08-04', provider: 'Government Vaccination Centre, Bandra' },
  { id: 'e10', kind: 'vaccination', title: 'COVID-19, dose 1', short: 'COVID-19', detail: 'Covishield, first dose.', date: '2021-05-18', provider: 'Government Vaccination Centre, Bandra' },
  { id: 'e11', kind: 'allergy', title: 'Dust mites', detail: 'Sneezing and watery eyes. Mild.', date: '2018-02-17', provider: 'Dr. Meera Iyer, Shivaji Park Clinic', status: 'active' },
  { id: 'e12', kind: 'condition', title: 'Appendicitis', detail: 'Laparoscopic appendectomy with two nights in hospital.', date: '2015-11-03', provider: 'Sion Government Hospital', status: 'resolved' },
  { id: 'e13', kind: 'condition', title: 'Dengue fever', short: 'Dengue', detail: 'Admitted for four days. Fully recovered.', date: '2009-09-12', provider: 'Municipal General Hospital', status: 'resolved' },
  { id: 'e14', kind: 'allergy', title: 'Penicillin', detail: 'Skin rash after amoxicillin. Moderate. Avoid penicillin-class antibiotics.', date: '2003-08-21', provider: 'Dr. S. Nair, Family Clinic', status: 'active' },
  { id: 'e15', kind: 'vaccination', title: 'Measles vaccine', short: 'Measles', detail: 'Single dose at nine months.', date: '1995-02-10', provider: 'Primary Health Centre' },
  { id: 'e16', kind: 'vaccination', title: 'BCG and Hepatitis B (birth dose)', short: 'BCG, Hep B', detail: 'Given before discharge.', date: '1994-05-13', provider: 'Government Maternity Hospital' },
  { id: 'e17', kind: 'report', title: 'Birth record', detail: 'Birth weight 3.1 kg. No complications.', date: '1994-05-12', provider: 'Government Maternity Hospital' },
]

export interface AccessGrant {
  id: string
  name: string
  role: string
  scope: Kind[]
  remaining: string
}

export const initialGrants: AccessGrant[] = [
  { id: 'g1', name: 'Dr. Rohan Kulkarni', role: 'Pulmonologist, Lifeline Clinic', scope: ['condition', 'medication', 'allergy'], remaining: '1 h 48 min left' },
  { id: 'g2', name: 'Dr. Meera Iyer', role: 'General physician, Shivaji Park Clinic', scope: ['allergy', 'vaccination'], remaining: '5 h 20 min left' },
]

export interface AccessRequest {
  id: string
  name: string
  role: string
  scope: Kind[]
  duration: string
}

export const initialRequests: AccessRequest[] = [
  { id: 'r1', name: 'Dr. Farhan Ali', role: 'Dermatologist, Skin & Care Centre', scope: ['allergy', 'medication'], duration: '2 hours' },
]

export const caregivers = [
  { id: 'c1', name: 'Lakshmi Rao', relation: 'Mother', scope: 'Timeline and vaccinations', since: 'Since 14 Jan 2025' },
]

export const accessLog = [
  { id: 'l1', who: 'Dr. Rohan Kulkarni', what: 'viewed conditions and medicines', when: 'Today, 10:42' },
  { id: 'l2', who: 'Dr. Meera Iyer', what: 'viewed allergies and vaccinations', when: 'Today, 09:15' },
  { id: 'l3', who: 'Dr. Neha Shah', what: 'access ended automatically', when: '2 Sep 2026' },
  { id: 'l4', who: 'Dr. Meera Iyer', what: 'added Tdap booster', when: '2 Sep 2026' },
  { id: 'l5', who: 'You', what: 'uploaded a prescription', when: '28 Aug 2026' },
]

export const suggestions: { id: string; icon: IconName; title: string; body: string }[] = [
  { id: 's1', icon: 'syringe', title: 'Your flu vaccine is due this month', body: 'Your last dose was on 4 Oct 2025. Seasonal flu vaccines are given every year.' },
  { id: 's2', icon: 'heart', title: 'Ask about a yearly asthma check', body: 'Your last spirometry was in November 2025. Your doctor can tell you if a repeat is due.' },
  { id: 's3', icon: 'alert', title: 'Mention your penicillin allergy', body: 'Tell any new doctor or pharmacist before an antibiotic is prescribed.' },
]
