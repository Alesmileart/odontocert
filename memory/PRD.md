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
- [x] Lab profile auto-fill (GET/PUT /api/profile).
- [x] Clients & Materials library CRUD with bottom-sheet editor.
- [x] 5-step declaration wizard (Cliente → Dispositivo → Materiali → Conformità → Firma) with progress bar.
- [x] Auto declaration numbering DC-YYYY-NNNN, draft vs issued status.
- [x] Signature capture pad.
- [x] PDF generation (HTML template) + share sheet.
- [x] Dashboard with monthly/yearly/total/clients stats + recent list + FAB.
- [x] Archive with search + status filter chips.
- [x] Verified: backend 17/17 pytest, frontend e2e flows pass.

## Backlog (prioritized)
- P1: Logo laboratorio upload nel profilo (mostrato in PDF).
- P1: Duplica dichiarazione / usa come modello.
- P2: Filtro archivio per cliente e per data range.
- P2: Numerazione personalizzabile / prefisso.
- P2: me endpoint 401 vs 403 cosmetic fix; migrate shadow* → boxShadow.

## Next Tasks
- Await user feedback; prioritize logo upload and PDF branding.
