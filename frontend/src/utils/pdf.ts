import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

type Material = { name: string; manufacturer?: string; ce_number?: string; lot?: string; category?: string };
type Conformity = {
  mdr_2017_745?: boolean;
  biocompatible?: boolean;
  single_patient?: boolean;
  made_to_prescription?: boolean;
  notes?: string;
};

export type DeclarationData = {
  number?: string;
  issue_date?: string;
  patient_ref?: string;
  device_type?: string;
  device_description?: string;
  norm_reference?: string;
  technician_name?: string;
  signature_base64?: string;
  materials?: Material[];
  conformity?: Conformity;
  client_snapshot?: {
    name?: string;
    clinic?: string;
    address?: string;
    vat?: string;
    email?: string;
    phone?: string;
  };
};

export type LabProfile = {
  lab_name?: string;
  responsible_person?: string;
  address?: string;
  city?: string;
  vat?: string;
  registration_number?: string;
  phone?: string;
  email?: string;
};

function fmtDate(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

function check(v?: boolean) {
  return v ? "&#9745;" : "&#9744;";
}

export function buildDeclarationHtml(d: DeclarationData, lab: LabProfile): string {
  const client = d.client_snapshot || {};
  const c = d.conformity || {};
  const materialsRows =
    (d.materials || [])
      .map(
        (m) => `
      <tr>
        <td>${m.name || "-"}</td>
        <td>${m.manufacturer || "-"}</td>
        <td class="mono">${m.ce_number || "-"}</td>
        <td class="mono">${m.lot || "-"}</td>
      </tr>`
      )
      .join("") ||
    `<tr><td colspan="4" style="text-align:center;color:#7A857F">Nessun materiale indicato</td></tr>`;

  const signatureImg = d.signature_base64
    ? `<img src="${d.signature_base64}" style="height:70px;object-fit:contain" />`
    : `<div style="height:70px"></div>`;

  return `
<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111412; padding: 32px; font-size: 12px; }
  .mono { font-family: 'Courier New', monospace; }
  h1 { font-size: 20px; color: #2D4A3E; margin: 0 0 2px; }
  .sub { color: #7A857F; font-size: 11px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2D4A3E; padding-bottom: 12px; margin-bottom: 20px; }
  .lab { text-align: right; font-size: 11px; line-height: 1.5; }
  .lab strong { color: #2D4A3E; font-size: 13px; }
  .title { text-align: center; font-size: 16px; font-weight: bold; margin: 18px 0 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .norm { text-align: center; color: #7A857F; margin-bottom: 20px; font-size: 11px; }
  .grid { display: flex; gap: 16px; margin-bottom: 18px; }
  .box { flex: 1; border: 1px solid #E3E8E5; border-radius: 8px; padding: 12px; }
  .box h3 { margin: 0 0 8px; font-size: 11px; text-transform: uppercase; color: #2D4A3E; letter-spacing: 0.5px; }
  .row { margin-bottom: 4px; }
  .row .k { color: #7A857F; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  th { background: #F0F3F1; text-align: left; padding: 8px; font-size: 10px; text-transform: uppercase; color: #2D332F; border-bottom: 1px solid #C4CCC7; }
  td { padding: 8px; border-bottom: 1px solid #EBF0EC; font-size: 11px; }
  .decl { border: 1px solid #E3E8E5; border-radius: 8px; padding: 14px; margin-bottom: 18px; background: #F3F7F4; }
  .decl li { margin-bottom: 6px; list-style: none; }
  .sign { display: flex; justify-content: space-between; margin-top: 40px; }
  .sign .col { width: 45%; }
  .sign .line { border-top: 1px solid #111412; padding-top: 4px; color: #7A857F; }
  .badge { display:inline-block; background:#2D4A3E; color:#fff; padding:2px 8px; border-radius:999px; font-size:10px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${lab.lab_name || "Laboratorio Odontotecnico"}</h1>
      <div class="sub">${lab.address || ""} ${lab.city ? "· " + lab.city : ""}</div>
    </div>
    <div class="lab">
      <strong>${lab.lab_name || ""}</strong><br/>
      ${lab.responsible_person ? "Resp.: " + lab.responsible_person + "<br/>" : ""}
      ${lab.vat ? "P.IVA: " + lab.vat + "<br/>" : ""}
      ${lab.registration_number ? "Iscr.: " + lab.registration_number + "<br/>" : ""}
      ${lab.phone || ""} ${lab.email ? "· " + lab.email : ""}
    </div>
  </div>

  <div class="title">Dichiarazione di Conformità</div>
  <div class="norm">Dispositivo medico su misura — ${d.norm_reference || "Regolamento (UE) 2017/745 (MDR)"}</div>

  <div style="text-align:center;margin-bottom:18px">
    <span class="badge">N. ${d.number || "—"}</span>
    &nbsp;&nbsp; Data di emissione: <strong>${fmtDate(d.issue_date)}</strong>
  </div>

  <div class="grid">
    <div class="box">
      <h3>Committente / Odontoiatra</h3>
      <div class="row"><span class="k">Nome:</span> ${client.name || "-"}</div>
      <div class="row"><span class="k">Studio:</span> ${client.clinic || "-"}</div>
      <div class="row"><span class="k">Indirizzo:</span> ${client.address || "-"}</div>
      <div class="row"><span class="k">P.IVA:</span> <span class="mono">${client.vat || "-"}</span></div>
    </div>
    <div class="box">
      <h3>Dispositivo</h3>
      <div class="row"><span class="k">Rif. paziente:</span> ${d.patient_ref || "-"}</div>
      <div class="row"><span class="k">Tipo:</span> ${d.device_type || "-"}</div>
      <div class="row"><span class="k">Descrizione:</span> ${d.device_description || "-"}</div>
    </div>
  </div>

  <h3 style="font-size:11px;text-transform:uppercase;color:#2D4A3E;letter-spacing:0.5px;margin-bottom:6px">Materiali impiegati</h3>
  <table>
    <thead>
      <tr><th>Materiale</th><th>Produttore</th><th>Marcatura CE</th><th>Lotto</th></tr>
    </thead>
    <tbody>${materialsRows}</tbody>
  </table>

  <div class="decl">
    <h3 style="margin:0 0 8px;font-size:11px;text-transform:uppercase;color:#2D4A3E">Il sottoscritto dichiara che:</h3>
    <li>${check(c.mdr_2017_745)} Il dispositivo è conforme ai requisiti generali di sicurezza e prestazione del Reg. (UE) 2017/745.</li>
    <li>${check(c.made_to_prescription)} È stato fabbricato su misura secondo prescrizione del professionista sanitario.</li>
    <li>${check(c.single_patient)} È destinato all'uso esclusivo del paziente sopra indicato.</li>
    <li>${check(c.biocompatible)} I materiali impiegati sono biocompatibili e provvisti di marcatura CE.</li>
    ${c.notes ? `<li style="margin-top:8px;color:#3A423D"><em>Note: ${c.notes}</em></li>` : ""}
  </div>

  <div class="sign">
    <div class="col">
      <div>Luogo e data: ${lab.city || ""}, ${fmtDate(d.issue_date)}</div>
    </div>
    <div class="col" style="text-align:center">
      ${signatureImg}
      <div class="line">${d.technician_name || lab.responsible_person || "L'Odontotecnico"}</div>
    </div>
  </div>
</body>
</html>`;
}

export async function exportDeclarationPdf(d: DeclarationData, lab: LabProfile) {
  const html = buildDeclarationHtml(d, lab);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Condividi dichiarazione", UTI: "com.adobe.pdf" });
  }
  return uri;
}
