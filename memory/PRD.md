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
- [x] Declaration wizard classic Italian format: Lavoro/Paziente → Arcata (schema denti FDI) → Prescrizione/Materiali → Etichetta/Note → Firma; client anagrafica (client_id + snapshot) salvata sulla dichiarazione.
- [x] Dental tooth chart selector + PDF grid con caselle bordate, spazio centrale e ✕ sugli elementi selezionati.
- [x] PDF Dichiarazione di conformità (A4 verticale) fedele al documento originale.
- [x] **Modulo Prescrizione**: PDF prescrizione odontoiatrica auto-compilato dai dati della dichiarazione (anagrafica studio/cliente + dati laboratorio + griglia denti con elementi segnati + dispositivo + materiali + firma prescrivente). Pulsante dedicato nel dettaglio dichiarazione.
- [x] Auto codice lavoro NNNN/YYYY, draft vs issued.
- [x] Signature capture + PDF share (dichiarazione e prescrizione).
- [x] Dashboard stats + recent, Archive search/filter chips.
- [x] Logo laboratorio: upload dalla galleria (expo-image-picker, con permessi) salvato come data URI e stampato nell'intestazione di dichiarazione e prescrizione.
- [x] Selettore data a calendario (tap) per data prescrizione e data consegna.

## Architettura backend condiviso (predisposizione)
- Backend unico FastAPI + MongoDB con API REST per user/profile/clients/materials/declarations, riutilizzabili da futuri frontend (web magazzino, fatturazione).
- Dati anagrafica cliente e materiali centralizzati e già richiamati dalla dichiarazione → pronti per moduli magazzino/fatturazione.

## Backlog (prioritized)
- P2: Modulo magazzino (giacenze materiali + scarico automatico da dichiarazione) sullo stesso backend.
- P2: Modulo fatturazione elettronica (integrazione SDI via provider accreditato).
- P2: Toggle Direttiva 93/42/CEE vs Regolamento UE 2017/745 (MDR).
- P2: Barcode/QR sul PDF.

## Next Tasks
- Await user feedback; prioritize logo upload and PDF branding.
