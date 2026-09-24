// Builds a doctor-shareable PDF summary of a MindHx check-in, entirely in
// the browser - the PDF is generated from data already on the results page
// and never sent to or stored on the backend, consistent with the app's
// "we only ever save score/band/themes" privacy model.
import { jsPDF } from "jspdf";

type ResultForPdf = {
  risk_score: number;
  band: string;
  routing_decision: string;
  themes?: string[];
  components?: {
    phq9: { score: number; band: string };
    gad7: { score: number; band: string };
    k10: { score: number; band: string };
    text: { sentiment: string; signal: number };
    voice: { available: boolean; signal: number | null; note: string };
  };
  support_plan?: {
    title: string;
    next_action: string;
    professional_contact?: { recommended: boolean; action: string; what_to_say: string };
  };
};

type PreparedFor = { name?: string | null; email?: string | null };

const MARGIN = 18;
const PAGE_WIDTH = 210; // A4, mm
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

export function downloadResultsPdf(result: ResultForPdf, preparedFor: PreparedFor = {}): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  function ensureSpace(next: number): void {
    if (y + next > PAGE_HEIGHT - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  }

  function heading(text: string): void {
    ensureSpace(10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(20, 30, 45);
    doc.text(text, MARGIN, y);
    y += 7;
  }

  function paragraph(text: string, options: { size?: number; italic?: boolean; color?: [number, number, number] } = {}): void {
    const size = options.size ?? 10.5;
    doc.setFont("helvetica", options.italic ? "italic" : "normal");
    doc.setFontSize(size);
    const [r, g, b] = options.color ?? [50, 60, 75];
    doc.setTextColor(r, g, b);
    const lines: string[] = doc.splitTextToSize(text, CONTENT_WIDTH);
    for (const line of lines) {
      ensureSpace(size / 1.8);
      doc.text(line, MARGIN, y);
      y += size / 1.8;
    }
  }

  function keyValueRow(label: string, value: string): void {
    ensureSpace(6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(50, 60, 75);
    doc.text(label, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, MARGIN + 42, y);
    y += 6;
  }

  function spacer(amount = 4): void {
    y += amount;
  }

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(20, 30, 45);
  doc.text("MindHx Check-in Summary", MARGIN, y);
  y += 9;

  const generatedAt = new Date().toLocaleString();
  const preparedForLine = preparedFor.name || preparedFor.email
    ? `Prepared for: ${[preparedFor.name, preparedFor.email].filter(Boolean).join(" · ")}`
    : null;
  paragraph(`Generated ${generatedAt}${preparedForLine ? `  ·  ${preparedForLine}` : ""}`, { size: 9.5, color: [110, 120, 135] });
  spacer(3);

  paragraph(
    "MindHx is a screening and triage aid, not a diagnosis. This summary is a starting point for a conversation with a qualified professional, not a clinical assessment on its own.",
    { size: 9, italic: true, color: [130, 100, 40] }
  );
  spacer(6);

  // Combined signal
  heading("Combined signal");
  keyValueRow("Score", `${Math.round(result.risk_score * 100)} / 100`);
  keyValueRow("Band", result.band.replaceAll("_", " "));
  keyValueRow("Routing", result.routing_decision.replaceAll("_", " "));
  if (result.themes && result.themes.length > 0) {
    keyValueRow("Themes", result.themes.map((theme) => theme.replaceAll("_", " ")).join(", "));
  }
  spacer(4);

  // Component breakdown
  const components = result.components;
  if (components) {
    heading("Signal breakdown");
    keyValueRow("PHQ-9 (depression)", `${components.phq9.score} / 27 - ${components.phq9.band.replaceAll("_", " ")}`);
    keyValueRow("GAD-7 (anxiety)", `${components.gad7.score} / 21 - ${components.gad7.band.replaceAll("_", " ")}`);
    keyValueRow("K10 (distress)", `${components.k10.score} / 50 - ${components.k10.band.replaceAll("_", " ")}`);
    keyValueRow("Text signal", `${components.text.sentiment} (${Math.round(components.text.signal * 100)}%)`);
    keyValueRow(
      "Voice signal",
      components.voice.available ? `${Math.round((components.voice.signal ?? 0) * 100)}%` : "Not available"
    );
    spacer(4);
  }

  // Support plan
  if (result.support_plan) {
    heading(result.support_plan.title || "Suggested next step");
    paragraph(result.support_plan.next_action);
    spacer(3);
  }

  const contact = result.support_plan?.professional_contact;
  if (contact) {
    heading("Professional support");
    paragraph(contact.recommended ? "Speaking with a professional is recommended." : "No urgent professional contact was flagged.");
    if (contact.what_to_say) {
      spacer(2);
      paragraph(`Suggested starting point: "${contact.what_to_say}"`, { italic: true });
    }
  }

  // Footer note on the last page
  ensureSpace(14);
  spacer(8);
  paragraph(
    "This PDF was generated locally in your browser from your MindHx check-in results. MindHx does not store or transmit this document - only the score, band, and themes above are ever saved to your account.",
    { size: 8.5, color: [140, 150, 165] }
  );

  const filenameDate = new Date().toISOString().slice(0, 10);
  doc.save(`mindhx-checkin-${filenameDate}.pdf`);
}
