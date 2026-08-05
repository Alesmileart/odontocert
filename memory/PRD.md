# OdontoCert — PRD

## Original Problem Statement
"Crea un'app mobile: vorrei creare un app per odontotecnici per emettere dichiarazione di conformità sul lavoro eseguito si puo fare?"
(Mobile app for dental technicians to issue Declarations of Conformity for the work performed.)

## Architecture
- **Frontend**: Expo SDK 54 (React Native 0.81), expo-router file-based routing, react-native-keyboard-controller, expo-print + expo-sharing (PDF), react-native-signature-canvas (firma), expo-image, expo-linear-gradient.
- **Backend**: FastAPI + Motor (MongoDB). JWT auth (PyJWT + bcrypt). All routes under `/api`.
- **DB collections**: users, profiles, clients, materials, declarations.
- **Design**: "iOS-Native Clean" personality, Deep Sage Green (#2D4A3E) brand, Plus Jakarta Sans + Space Mono (technical data), bottom tabs.

## User Personas
- **Odontotecnico / Laboratorio**: creates MDR-compliant declarations of conformity for custom prosthetic devices, reuses client (dentist) and material master data, exports/shares PDFs.

## Core Requirements (static)
1. Auth personale (login/registrazione) per salvare i dati del laboratorio.
2. Dichiarazione completa: dati lab, committente/odontoiatra, dispositivo, materiali con lotti/CE, riferimenti normativi MDR 2017/745.
3. Firma sullo schermo + export PDF condivisibile.
4. Archivio dichiarazioni + anagrafica clienti e materiali riutilizzabili.

## Implemented (2026-06)
- [x] JWT auth: signup/login/me, secure token storage.
- [x] Lab profile auto-fill (GET/PUT /api/profile) + Reg. Min. Salute, Reg. Imprese, dicitura autorizzazione.
- [x] Clients & Materials library CRUD with bottom-sheet editor.
- [x] Declaration wizard restructured to classic Italian format: Lavoro/Paziente → Arcata (schema denti FDI) → Prescrizione/Materiali → Etichetta/Note → Firma.
- [x] Dental tooth chart selector (FDI 18-28 / 48-38) with ☒ marking.
- [x] PDF layout faithful to the standard "Dichiarazione di conformità alle normative CE": intestazione Ministero della Salute + logo lab, blocco fabbricante, testo Direttiva 93/42/CEE, codice lavoro, schema dentale, prescrizione, PROTOCOLLO DI FABBRICAZIONE, MATERIALI UTILIZZATI, annotazioni, firma "Il legale rappresentante", ETICHETTA staccabile (consegna, giorni, condizioni conservazione, NON STERILE).
- [x] Auto codice lavoro NNNN/YYYY, draft vs issued status.
- [x] Signature capture pad + PDF share.
- [x] Dashboard stats + recent list, Archive search/filter chips.
- [x] Verified: backend curl (new format), wizard steps, tooth chart, PDF rendering screenshot.

## Backlog (prioritized)
- P1: Logo laboratorio upload nel profilo (già supportato nel PDF, manca UI upload immagine).
- P1: Duplica dichiarazione / usa come modello.
- P1: Date picker per data prescrizione/consegna (ora testo GG/MM/AAAA).
- P2: Toggle Direttiva 93/42/CEE vs Regolamento UE 2017/745 (MDR).
- P2: Filtro archivio per prescrivente e per data range.
- P2: Barcode/QR sul PDF come nell'originale.

## Next Tasks
- Await user feedback; prioritize logo upload and PDF branding.
