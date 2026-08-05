import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

type Material = { name: string; manufacturer?: string; ce_number?: string; lot?: string; category?: string };
type Conformity = { notes?: string };

export type DeclarationData = {
  number?: string;
  codice_lavoro?: string;
  issue_date?: string;
  patient_name?: string;
  patient_ref?: string;
  device_type?: string;
  device_description?: string;
  teeth?: number[];
  prescription_code?: string;
  prescription_date?: string;
  prescriber?: string;
  legal_text?: string;
  protocollo?: string;
  materiali_intro?: string;
  annotations?: string;
  norm_reference?: string;
  technician_name?: string;
  signature_base64?: string;
  delivery_date?: string;
  usage_days?: string;
  storage_no_flip?: boolean;
  storage_no_shake?: boolean;
  storage_proper_place?: boolean;
  non_sterile?: boolean;
  materials?: Material[];
  conformity?: Conformity;
};

export type LabProfile = {
  lab_name?: string;
  responsible_person?: string;
  address?: string;
  city?: string;
  vat?: string;
  registration_number?: string;
  reg_imprese?: string;
  authorized_label?: string;
  phone?: string;
  email?: string;
  logo_base64?: string;
};

export const DEFAULT_LEGAL_TEXT =
  "il dispositivo medico su misura ad uso odontoiatrico qui sotto designato è conforme nella sua costruzione ai requisiti di cui all'allegato I e ai disposti dell'allegato VIII della Direttiva 93/42/CEE attuata dal D.Lgs. 46/97 ed emendato col D.Lgs. 37/10 di recepimento Direttiva 2007/47/CE.";

export const DEFAULT_PROTOCOLLO =
  "Il dispositivo medico su misura ad uso odontoiatrico in oggetto è stato eseguito secondo le fasi di lavorazione riportate nel protocollo generale di fabbricazione adottato presso il laboratorio del fabbricante e trascritte in sintesi nel fascicolo tecnico allegato alla prescrizione e conservate su supporto informatico.";

export const DEFAULT_MATERIALI_INTRO =
  "Per la fabbricazione del dispositivo medico su misura ad uso odontoiatrico in oggetto sono stati utilizzati esclusivamente materiali con marcatura CE. La loro rintracciabilità è garantita dalla documentazione riportata nel fascicolo tecnico allegato alla prescrizione e conservata su supporto informatico.";

export const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

function fmtDate(iso?: string) {
  if (!iso) return "";
  if (iso.includes("/")) return iso;
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function toothCells(row: number[], selected: Set<number>, numbersOnTop: boolean) {
  const numbers = row
    .map((t, i) => `${i === 8 ? '<td class="tspace"></td>' : ""}<td class="tnum">${t}</td>`)
    .join("");
  const boxes = row
    .map(
      (t, i) =>
        `${i === 8 ? '<td class="tspace"></td>' : ""}<td class="tbox">${
          selected.has(t) ? "&#10005;" : "&nbsp;"
        }</td>`
    )
    .join("");
  return numbersOnTop
    ? `<tr>${numbers}</tr><tr>${boxes}</tr>`
    : `<tr>${boxes}</tr><tr>${numbers}</tr>`;
}

export function buildDeclarationHtml(d: DeclarationData, lab: LabProfile): string {
  const selected = new Set(d.teeth || []);
  const legal = d.legal_text || DEFAULT_LEGAL_TEXT;
  const protocollo = d.protocollo || DEFAULT_PROTOCOLLO;
  const materialiIntro = d.materiali_intro || DEFAULT_MATERIALI_INTRO;

  const materialsList =
    (d.materials || []).length > 0
      ? `<div class="matlist">${(d.materials || [])
          .map(
            (m) =>
              `<span class="matchip">${m.name}${m.ce_number ? ` · CE ${m.ce_number}` : ""}${
                m.lot ? ` · Lotto ${m.lot}` : ""
              }</span>`
          )
          .join("")}</div>`
      : "";

  const labLogo = lab.logo_base64
    ? `<img src="${lab.logo_base64}" class="lab-logo" />`
    : `<div class="lab-logo-text">${lab.lab_name || ""}</div>`;

  const deviceLine = [d.device_type, d.device_description].filter(Boolean).join(" &gt;&gt; ");

  const storageItems = [
    d.storage_no_flip ? "Non capovolgere la confezione" : null,
    d.storage_no_shake ? "Non sbattere l'involucro" : null,
    d.storage_proper_place ? "Conservare in luogo adeguato" : null,
    d.non_sterile ? "<strong>NON STERILE</strong> (Non sterilizzare a caldo)" : null,
  ]
    .filter(Boolean)
    .map((s) => `<div>${s}</div>`)
    .join("");

  const signatureImg = d.signature_base64
    ? `<img src="${d.signature_base64}" class="sig" />`
    : `<div class="sig"></div>`;

  return `
<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4 portrait; margin: 22px; }
  * { box-sizing: border-box; }
  body { font-family: 'Times New Roman', Georgia, serif; color: #111; font-size: 11px; line-height: 1.45; }
  .sheet { border: 1px solid #333; padding: 22px 26px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
  .min { font-size: 12px; }
  .min .b { font-weight: bold; font-style: italic; }
  .min .s { font-style: italic; font-size: 10px; }
  .lab-logo { max-height: 54px; }
  .lab-logo-text { font-weight: bold; font-style: italic; color: #1a5b34; font-size: 14px; text-align: right; }
  h1 { text-align: center; font-size: 15px; margin: 18px 0 14px; }
  .center { text-align: center; }
  .fab { text-align: center; font-weight: bold; margin: 6px 0; line-height: 1.5; }
  .fab .name { font-size: 12px; }
  .attesta { text-align: center; margin: 10px 0; }
  .legal { text-align: justify; font-weight: bold; margin: 8px 0 14px; }
  .kv { margin: 4px 0; }
  .kv b { display: inline-block; min-width: 130px; }
  .strong { font-weight: bold; }
  table.teeth { border-collapse: collapse; margin: 14px auto; }
  table.teeth td { text-align: center; }
  table.teeth td.tnum { width: 24px; height: 14px; font-size: 9px; color: #111; border: none; padding: 1px 0; }
  table.teeth td.tbox { width: 24px; height: 22px; border: 1px solid #111; font-size: 13px; font-weight: bold; line-height: 20px; }
  table.teeth td.tspace { width: 12px; border: none; }
  .section-bar { background: #eee; border-top: 1px solid #333; border-bottom: 1px solid #333; text-align: center; font-weight: bold; padding: 3px; margin-top: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
  .section-body { text-align: justify; padding: 6px 2px; }
  .matlist { margin-top: 4px; }
  .matchip { display: inline-block; border: 1px solid #999; border-radius: 3px; padding: 1px 6px; margin: 2px 3px 2px 0; font-size: 10px; }
  .sign-area { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 26px; }
  .sig { width: 200px; height: 60px; object-fit: contain; }
  .sig-label { border-top: 1px solid #111; text-align: center; padding-top: 3px; width: 220px; font-style: italic; }
  .cut { border-top: 2px dashed #666; margin: 22px 0 8px; position: relative; text-align: left; }
  .cut span { position: absolute; top: -9px; left: 0; background: #fff; padding-right: 6px; }
  .label-title { text-align: center; font-weight: bold; background: #eee; border: 1px solid #333; padding: 3px; text-transform: uppercase; }
  .label-grid { display: flex; border: 1px solid #333; border-top: none; }
  .label-col { flex: 1; padding: 10px 12px; }
  .label-col.left { border-right: 1px solid #333; }
  .label-col h4 { margin: 0 0 4px; font-size: 11px; }
  .small { font-size: 9px; color: #333; }
</style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="min">
        <div class="b">Ministero della Salute</div>
        <div class="s">${lab.authorized_label || "Laboratorio Odontotecnico Autorizzato"}</div>
      </div>
      <div>${labLogo}</div>
    </div>

    <h1>Dichiarazione di conformità alle normative CE</h1>

    <div class="center">Con la presente dichiarazione, il fabbricante:</div>

    <div class="fab">
      <div class="name">${lab.lab_name || "Laboratorio Odontotecnico"}</div>
      <div>${lab.address || ""}${lab.phone ? " cell." + lab.phone : ""} ${lab.city || ""}</div>
      <div>${lab.registration_number ? "Reg. Min. Salute: " + lab.registration_number : ""} ${
    lab.reg_imprese ? "Reg. Imprese: " + lab.reg_imprese : ""
  }</div>
    </div>

    <div class="attesta">attesta sotto la propria esclusiva responsabilità che</div>

    <div class="legal">${legal}</div>

    <div class="kv"><b>Codice lavoro:</b> <span class="strong">${d.codice_lavoro || d.number || "—"}</span></div>
    <div class="kv"><b>Il dispositivo è identificato come:</b></div>
    <div class="strong" style="margin:2px 0 4px">${deviceLine || "—"}</div>

    <table class="teeth">
      ${toothCells(UPPER_TEETH, selected, true)}
      ${toothCells(LOWER_TEETH, selected, false)}
    </table>

    <div class="kv">E' stato realizzato ed è destinato esclusivamente per il paziente:</div>
    <div class="strong">${d.patient_name || d.patient_ref || "—"}</div>

    <div class="kv" style="margin-top:8px">Il dispositivo è conforme alle specifiche espresse nella prescrizione:</div>
    <div class="kv"><b>Codice:</b> <span class="strong">${d.prescription_code || "—"}</span></div>
    <div class="kv"><b>Data:</b> ${fmtDate(d.prescription_date) || "—"}</div>
    <div class="kv"><b>Prescrivente:</b> ${d.prescriber || "—"}</div>

    <div class="section-bar">Protocollo di fabbricazione adottato</div>
    <div class="section-body">${protocollo}</div>

    <div class="section-bar">Materiali utilizzati per la fabbricazione</div>
    <div class="section-body">${materialiIntro}${materialsList}</div>

    <div class="kv" style="margin-top:12px">Annotazioni od eventuali eccezioni di livello accettabile che non è stato possibile rimuovere:</div>
    <div class="strong">(${d.annotations || "Nessuna"})</div>

    <div class="sign-area">
      <div>Data, ${fmtDate(d.issue_date)}</div>
      <div style="text-align:center">
        ${signatureImg}
        <div class="sig-label">Il legale rappresentante<br/>${d.technician_name || lab.responsible_person || ""}</div>
      </div>
    </div>

    <div class="cut"><span>&#9986;</span></div>

    <div class="label-title">Etichetta</div>
    <div class="label-grid">
      <div class="label-col left">
        <div>La confezione contiene un dispositivo medico su misura ad uso odontoiatrico identificato come:</div>
        <h4>${d.device_type || "—"}</h4>
        <div style="margin-top:16px"><strong>Fabbricato da:</strong></div>
        <div>${lab.lab_name || ""}</div>
        <div class="small">${lab.address || ""} ${lab.city || ""}</div>
        <div class="small">${lab.registration_number ? "Reg. Min. Sal.: " + lab.registration_number : ""} ${
    lab.reg_imprese ? "Reg. Imp.: " + lab.reg_imprese : ""
  }</div>
      </div>
      <div class="label-col">
        <div class="kv"><b>Codice lavoro:</b> <span class="strong">${d.codice_lavoro || "—"}</span></div>
        <div class="kv"><b>Data di consegna:</b> ${fmtDate(d.delivery_date) || fmtDate(d.issue_date)}</div>
        <div class="kv"><b>Termini per l'utilizzo dalla data di consegna:</b> ${d.usage_days || "—"} giorni</div>
        <div style="margin-top:8px"><strong>Condizioni specifiche di conservazione e manipolazione:</strong></div>
        ${storageItems}
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function exportDeclarationPdf(d: DeclarationData, lab: LabProfile) {
  const html = buildDeclarationHtml(d, lab);
  // A4 portrait (595 x 842 pt) — vertical layout
  const { uri } = await Print.printToFileAsync({ html, base64: false, width: 595, height: 842 });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: "Condividi dichiarazione",
      UTI: "com.adobe.pdf",
    });
  }
  return uri;
}
