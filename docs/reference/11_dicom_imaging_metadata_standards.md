# DICOM Imaging Metadata Standards & Modality Integration

## 1. Scope & Objective

Digital Imaging and Communications in Medicine (DICOM PS 3.3) is the international standard for medical images and associated data. This specification establishes how Mediclaim ingests, catalogues, queries, and secures diagnostic radiology studies.

---

## 2. DICOM Information Entity Hierarchy

DICOM establishes a strict four-tier relational model:

```
[Patient]
   └── (1..*) [Study]
                └── (1..*) [Series]
                             └── (1..*) [SOP Instance / Image Slice]
```

### UID Hierarchy Definitions
- **Study Instance UID (`0020,000D`):** Globally unique identifier for an imaging session.
- **Series Instance UID (`0020,000E`):** Distinct acquisition protocol within a study (e.g., Axial T1, Sagittal T2).
- **SOP Instance UID (`0008,0018`):** Unique identifier for a single slice, frame, or report object.

---

## 3. Medical Imaging Modalities Supported

| Modality Code | Full Modality Description | Primary Clinical Applications | Standard Slice Resolution |
|:--------------|:--------------------------|:------------------------------|:--------------------------|
| `CT` | Computed Tomography | Trauma, chest, abdomen, stroke | 512 x 512, 16-bit grayscale |
| `MR` | Magnetic Resonance Imaging | Brain, spine, soft tissue, joints | 256 x 256 to 1024 x 1024 |
| `DX` / `CR` | Digital Radiography / X-Ray | Bone fractures, chest screening | 2048 x 2048 to 4096 x 4096 |
| `US` | Diagnostic Ultrasound | Obstetrics, cardiology, abdominal | Dynamic multi-frame Cine / 2D |
| `XA` | X-Ray Angiography | Coronary catheterization, vascular | Dynamic 30 fps fluoroscopy |
| `NM` | Nuclear Medicine (SPECT/PET)| Oncology staging, metabolic scans | 128 x 128 volumetric voxel |

---

## 4. Core DICOM Attribute Dictionary

| Tag | Keyword | VR | Description | Mediclaim Usage |
|:----|:--------|:---|:------------|:----------------|
| `(0008,0020)` | `StudyDate` | `DA` | Date the study was initiated | Search index |
| `(0008,0060)` | `Modality` | `CS` | Primary imaging acquisition type | Filter facet |
| `(0008,1030)` | `StudyDescription`| `LO` | Institution-generated description | Free-text search |
| `(0018,0050)` | `SliceThickness` | `DS` | Nominal slice thickness in mm | 3D reconstruction |
| `(0020,0032)` | `ImagePositionPatient` | `DS` | Coordinates (x,y,z) of top-left voxel | Spatial localization |
| `(0028,0010)` | `Rows` | `US` | Number of image rows | Viewer viewport |
| `(0028,0011)` | `Columns` | `US` | Number of image columns | Viewer viewport |
| `(0028,0100)` | `BitsAllocated` | `US` | Number of bits per pixel sample | Pixel decoding |

---

## 5. DICOMweb RESTful Protocols

Mediclaim communicates with hospital PACS via standard DICOMweb interfaces:

```yaml
dicomweb_endpoints:
  qido_rs:
    description: "Query based on ID for DICOM Objects"
    path: "/studies?PatientID={patient_id}&Modality={modality}"
    method: "GET"
  wado_rs:
    description: "Web Access to DICOM Persistent Objects"
    path: "/studies/{studyUID}/series/{seriesUID}/instances/{sopUID}"
    method: "GET"
  stow_rs:
    description: "Store Over the Web by RESTful Services"
    path: "/studies"
    method: "POST"
```

---

## 6. Privacy & De-Identification Safeguards

1. **PS 3.15 Profile:** Image headers de-identified for secondary research remove patient name, address, and explicit birthdate according to Basic Application Confidentiality Profile.
2. **Pixel Burn-in Scrubbing:** Ultrasound and fluoroscopy images undergo optical OCR scanning to detect and blackout burned-in demographic text annotations.
