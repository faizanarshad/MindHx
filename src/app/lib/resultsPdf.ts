// Builds a doctor-shareable PDF summary of a MindHx check-in, entirely in
// the browser - the PDF is generated from data already on the results page
// and never sent to or stored on the backend, consistent with the app's
// "we only ever save score/band/themes" privacy model.
//
// Includes every signal graph (as vector bars, not screenshots) plus, when
// per-question detail is available, the full transcript, written
// reflection, and every PHQ-9/GAD-7/K10 question alongside the answer that
// was selected - so a clinician can see exactly what was asked and chosen,
// not just the aggregate score.
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
    text: { sentiment: string; signal: number; anxiety_level?: number | null; stress_level?: number | null; depression_indicator?: number | null };
    voice: { available: boolean; signal: number | null; note: string; emotion?: { calm: number; stress: number; anger: number; fatigue: number; depression_indicator: number } | null };
    attribution?: {
      note: string;
      contributions: { label: string; modality: string; share_pct: number }[];
    };
  };
  support_plan?: {
    title: string;
    next_action: string;
    professional_contact?: { recommended: boolean; action: string; what_to_say: string };
  };
};

type CheckInDetailForPdf = {
  language: string;
  transcript: string;
  typedText: string;
  phq9: { question: string; answer: string | null }[];
  gad7: { question: string; answer: string | null }[];
  k10: { question: string; answer: string | null }[];
};

type PreparedFor = { name?: string | null; email?: string | null };

const MARGIN = 18;
const PAGE_WIDTH = 210; // A4, mm
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

export function downloadResultsPdf(result: ResultForPdf, preparedFor: PreparedFor = {}, detail?: CheckInDetailForPdf): void {
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

  function subheading(text: string): void {
    ensureSpace(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(40, 90, 150);
    doc.text(text, MARGIN, y);
    y += 6;
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

  function barRow(label: string, fraction: number, valueLabel: string): void {
    ensureSpace(9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(50, 60, 75);
    doc.text(label, MARGIN, y);
    doc.text(valueLabel, MARGIN + CONTENT_WIDTH, y, { align: "right" });
    y += 3.2;
    const barHeight = 3;
    doc.setFillColor(228, 233, 239);
    doc.rect(MARGIN, y, CONTENT_WIDTH, barHeight, "F");
    const clamped = Math.max(0, Math.min(1, fraction));
    if (clamped > 0) {
      doc.setFillColor(58, 130, 217);
      doc.rect(MARGIN, y, Math.max(1.5, CONTENT_WIDTH * clamped), barHeight, "F");
    }
    y += barHeight + 4.5;
  }

  function barGroup(title: string, rows: { label: string; fraction: number; valueLabel: string }[]): void {
    if (rows.length === 0) return;
    subheading(title);
    for (const row of rows) barRow(row.label, row.fraction, row.valueLabel);
    spacer(2);
  }

  function qaItem(index: number, question: string, answer: string | null): void {
    ensureSpace(6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(40, 50, 65);
    const qLines: string[] = doc.splitTextToSize(`${index + 1}. ${question}`, CONTENT_WIDTH);
    for (const line of qLines) {
      ensureSpace(4.4);
      doc.text(line, MARGIN, y);
      y += 4.4;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(58, 130, 217);
    // A plain ASCII prefix, not an arrow glyph - jsPDF's built-in fonts use
    // WinAnsiEncoding and don't include U+2192, which rendered as garbled,
    // wrongly-spaced text when this was tried.
    const aLines: string[] = doc.splitTextToSize(`Answer: ${answer ?? "Not answered"}`, CONTENT_WIDTH - 4);
    for (const line of aLines) {
      ensureSpace(4.4);
      doc.text(line, MARGIN + 4, y);
      y += 4.4;
    }
    y += 2;
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

  // Component breakdown + graphs
  const components = result.components;
  if (components) {
    heading("Signal breakdown");
    keyValueRow("PHQ-9 (depression)", `${components.phq9.score} / 27 - ${components.phq9.band.replaceAll("_", " ")}`);
    keyValueRow("GAD-7 (anxiety)", `${components.gad7.score} / 21 - ${components.gad7.band.replaceAll("_", " ")}`);
    keyValueRow("K10 (distress)", `${components.k10.score} / 50 - ${components.k10.band.replaceAll("_", " ")}`);
    keyValueRow("Text signal", `${components.text.sentiment} (${Math.round(components.text.signal * 100)}%)`);
    keyValueRow("Voice signal", components.voice.available ? `${Math.round((components.voice.signal ?? 0) * 100)}%` : "Not available");
    spacer(3);

    barGroup("Signal levels (graph)", [
      { label: "PHQ-9 (depression)", fraction: components.phq9.score / 27, valueLabel: `${components.phq9.score}/27` },
      { label: "GAD-7 (anxiety)", fraction: components.gad7.score / 21, valueLabel: `${components.gad7.score}/21` },
      { label: "K10 (distress)", fraction: components.k10.score / 50, valueLabel: `${components.k10.score}/50` },
      { label: "Text signal", fraction: components.text.signal, valueLabel: `${Math.round(components.text.signal * 100)}%` },
      { label: "Voice signal", fraction: components.voice.signal ?? 0, valueLabel: components.voice.available ? `${Math.round((components.voice.signal ?? 0) * 100)}%` : "N/A" },
    ]);

    if (components.text.anxiety_level != null && components.text.stress_level != null && components.text.depression_indicator != null) {
      barGroup("Word-choice breakdown (graph)", [
        { label: "Anxiety", fraction: components.text.anxiety_level, valueLabel: `${Math.round(components.text.anxiety_level * 100)}%` },
        { label: "Stress", fraction: components.text.stress_level, valueLabel: `${Math.round(components.text.stress_level * 100)}%` },
        { label: "Depression indicator", fraction: components.text.depression_indicator, valueLabel: `${Math.round(components.text.depression_indicator * 100)}%` },
      ]);
    }

    if (components.voice.emotion) {
      const emotion = components.voice.emotion;
      barGroup("Voice tone breakdown (graph)", [
        { label: "Calm", fraction: emotion.calm, valueLabel: `${Math.round(emotion.calm * 100)}%` },
        { label: "Stress", fraction: emotion.stress, valueLabel: `${Math.round(emotion.stress * 100)}%` },
        { label: "Anger", fraction: emotion.anger, valueLabel: `${Math.round(emotion.anger * 100)}%` },
        { label: "Fatigue", fraction: emotion.fatigue, valueLabel: `${Math.round(emotion.fatigue * 100)}%` },
        { label: "Depression indicator", fraction: emotion.depression_indicator, valueLabel: `${Math.round(emotion.depression_indicator * 100)}%` },
      ]);
    }

    if (components.attribution && components.attribution.contributions.length > 0) {
      barGroup(
        "Signal contribution to combined score (graph)",
        components.attribution.contributions.map((item) => ({
          label: `${item.label} (${item.modality})`,
          fraction: item.share_pct / 100,
          valueLabel: `${item.share_pct}%`,
        }))
      );
    }
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
    spacer(3);
  }

  // Full check-in detail: transcript, written reflection, and every
  // question with the answer selected - not just the aggregate score.
  if (detail) {
    if (detail.language === "اردو") {
      // Urdu content isn't included here: jsPDF's built-in fonts have no
      // Urdu/Arabic-script glyphs, and rendering it without a properly
      // shaped Unicode font would produce garbled or disconnected text in
      // a document meant for a clinician - worse than omitting it. The
      // full Urdu detail is still visible on the results page itself.
      doc.addPage();
      y = MARGIN;
      heading("Full check-in detail");
      paragraph(
        "This check-in was completed in Urdu. The full transcript, written reflection, and question-by-question answers are not included in this PDF, since they can't be rendered reliably with the fonts available here. The complete Urdu detail remains visible on the MindHx results page in your browser.",
        { italic: true, color: [130, 100, 40] }
      );
    } else {
      doc.addPage();
      y = MARGIN;
      heading("Full check-in detail");
      paragraph("Everything below is exactly what was recorded, typed, and selected during this check-in.", { size: 9, color: [110, 120, 135] });
      spacer(4);

      subheading("Voice transcript");
      paragraph(detail.transcript.trim() || "(No voice recording captured.)");
      spacer(4);

      subheading("Written reflection");
      paragraph(detail.typedText.trim() || "(Nothing entered.)");
      spacer(6);

      heading("PHQ-9 - full responses");
      detail.phq9.forEach((item, index) => qaItem(index, item.question, item.answer));
      spacer(4);

      heading("GAD-7 - full responses");
      detail.gad7.forEach((item, index) => qaItem(index, item.question, item.answer));
      spacer(4);

      heading("K10 - full responses");
      detail.k10.forEach((item, index) => qaItem(index, item.question, item.answer));
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
