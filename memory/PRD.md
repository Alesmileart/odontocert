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
- [x] Anteprima PDF in-app (WebView/iframe) di dichiarazione e prescrizione, con condivisione/esportazione dal pulsante in fondo all'anteprima.
- [x] Stampa/export solo del documento (Platform.OS branching: web usa Print.printAsync per stampare solo l'HTML; native genera PDF pulito e condivide).
- [x] Dichiarazione compattata per stare in 1 sola pagina A4.
- [x] Fascicolo dei Protocolli di Fabbricazione (CRUD /api/protocols) suddiviso per tipologia, con modelli predefiniti, stampa singola e fascicolo completo in PDF; accessibile da Profilo.
- [x] Duplica dichiarazione (detail -> /declaration/new?from=<id> con precompilazione, firma esclusa).
- [x] Filtri archivio: ricerca testo, chip stato, filtro per prescrivente e per intervallo di date (con badge filtri attivi).
- [x] Impostazioni provider (Profilo -> Impostazioni provider): predisposizione firma digitale/PEC/conservazione, salva solo riferimenti non sensibili + toggle Predisposto/Non attivo. API GET/PUT /api/provider-settings. NON operativa (nessuna firma/PEC/conservazione reale).
- [x] Magazzino (tab in basso): giacenza materiali con unità, scorta minima, ubicazione; toggle "Gestisci giacenza" in Anagrafica; badge sotto-scorta; carico/scarico manuale (POST /api/materials/{id}/adjust); scarico automatico su dichiarazione EMESSA quando il materiale ha unità e quantità utilizzata (clamp a 0).
- [x] Salvataggio materiale manuale: in dichiarazione, se il materiale digitato non è in anagrafica, chiede "Salvare in anagrafica?" e lo aggiunge alla libreria se confermato.
- [x] Fatturazione (Profilo -> Fatturazione): Listino voci prezzo (forfait o per elemento), Fatture ai clienti esenti IVA art.10 con righe manuali + collegamento opzionale alle dichiarazioni + marca da bollo €2 opzionale, numerazione monotona FT-AAAA-NNNN, totale calcolato lato server. PDF Fattura (fiscale) e Cedolino pre-fattura (riepilogo NON fiscale per lo studio). API: /api/price-items CRUD, /api/invoices CRUD.
- [x] Lavorazioni multiple per paziente: una dichiarazione elenca più lavorazioni, ognuna con categoria + sottotipo (scelti da menù, non digitati) e la PROPRIA selezione di denti. Catalogo tipi di lavorazione modificabile (Profilo -> Tipi di lavorazione, API /api/work-types CRUD con auto-seed di 2 categorie predefinite: Protesi Fissa, Protesi Provvisoria). PDF dichiarazione e prescrizione mostrano ogni lavorazione con la sua griglia denti. Retrocompatibile con dichiarazioni legacy.
- [x] Listino collegato ai tipi di lavorazione: voci con categoria + sottotipo, pulsante "Genera dal catalogo" (POST /api/price-items/generate, idempotente) crea una voce per ogni sottotipo (prezzo 0, per elemento). In fattura, collegando una dichiarazione EMESSA si genera una riga per ogni lavorazione con prezzo dal listino (per elemento × n. denti) e somma automatica; se manca il prezzo, riga a 0 da compilare. Solo dichiarazioni emesse sono collegabili.
- [x] Cedolino pre-fattura: UNA riga per ogni dente (es. "Sechi A · elemento 15") con colonne Paziente · Codice · Tipo di lavorazione · Elemento · Q.tà · Prezzo · Importo. Denti/paziente/codice presi dalla dichiarazione collegata. InvoiceLine backend con patient_name/codice_lavoro/teeth. Backfill in billing/[id]: le fatture create prima del campo denti recuperano elementi/paziente/codice dalla dichiarazione collegata all'apertura.
- [x] Archivio: selezione multipla dichiarazioni EMESSE (individuale o "Tutte") e stampa/invio di tutte le selezionate in un unico PDF (una per pagina) con un click. Refactor pdf.ts: declarationStyles()/declarationSheetHtml(), buildDeclarationsBatchHtml + exportDeclarationsBatchPdf.

## Architettura backend condiviso (predisposizione)
- Backend unico FastAPI + MongoDB con API REST per user/profile/clients/materials/declarations, riutilizzabili da futuri frontend (web magazzino, fatturazione).
- Dati anagrafica cliente e materiali centralizzati e già richiamati dalla dichiarazione → pronti per moduli magazzino/fatturazione.

## Backlog (prioritized)
- P2: Toggle Direttiva 93/42/CEE vs Regolamento UE 2017/745 (MDR).
- P2: Barcode/QR sul PDF.
- P3: Attivazione reale provider firma/PEC/conservazione (richiede integration_expert + credenziali utente).

## Next Tasks
- Await user feedback; prioritize logo upload and PDF branding.

## Expo SDK 58 upgrade (Jun 2026)
- expo 58.0.17, react-native 0.88, react 19.3, expo-router ~58
- @expo/vector-icons replaced by @react-native-vector-icons/ionicons; app.json cleaned (newArchEnabled/edgeToEdgeEnabled)
- expo-doctor 20/20; frontend regression iteration_11 passed

## Password dimenticata (Jun 2026)
- Link su login, /forgot-password e /reset-password; email via Emergent managed Resend (backend/email_service.py), token hash sha256, scade 1h, monouso, messaggio generico anti-enumerazione, throttle 1/min
- APP_PUBLIC_URL in backend/.env per il link (aggiornare al dominio di produzione dopo il deploy)

## Cedolino leggibile su telefono (Jun 2026)
- media query <600px: righe a scheda (paziente/codice/importo, lavorazione, elemento/Q.tà/prezzo); PDF A4 invariato; PdfPreview non forza viewport 800 per documenti device-width
