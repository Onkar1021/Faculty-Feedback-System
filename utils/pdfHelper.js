function drawInstituteHeader(doc, reportTitle) {
  doc
    .fontSize(13)
    .fillColor("#0b3b75")
    .text("SANJEEVAN GROUP OF INSTITUTIONS, PANHALA", { align: "center" });

  doc
    .fontSize(9)
    .fillColor("#222")
    .text(
      "Approved by AICTE, New Delhi | Recognized by Govt. of Maharashtra | Affiliated to Shivaji University, Kolhapur",
      { align: "center" }
    )
    .text(
      "Affiliated to MSBTE | Permanent Affiliation by Dr. Babasaheb Ambedkar Technological University, Raigad",
      { align: "center" }
    );

  doc.moveDown(0.4);
  const x1 = doc.page.margins.left;
  const x2 = doc.page.width - doc.page.margins.right;
  doc.moveTo(x1, doc.y).lineTo(x2, doc.y).strokeColor("#0b3b75").lineWidth(1).stroke();
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor("#000").text(reportTitle, { align: "center" });
  doc.moveDown(0.5);
}

function gradeFromScore(score) {
  const s = Number(score) || 0;
  if (s >= 4.5) return "EXCELLENT";
  if (s >= 3.5) return "VERY GOOD";
  if (s >= 2.5) return "GOOD";
  if (s >= 1.5) return "AVERAGE";
  return "POOR";
}

function drawSimpleTable(doc, columns, rows) {
  const left = doc.page.margins.left;
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const minBottom = doc.page.height - doc.page.margins.bottom - 40;
  const defaultRowHeight = 20;

  const drawHeader = () => {
    const y = doc.y;
    doc.rect(left, y, tableWidth, 20).fillAndStroke("#ffe95a", "#333");
    doc.fillColor("#000").fontSize(10).font("Helvetica-Bold");

    let x = left;
    columns.forEach((col) => {
      doc.text(col.label, x + 4, y + 6, {
        width: col.width - 8,
        align: col.align || "left",
        lineBreak: false
      });
      x += col.width;
    });

    doc.font("Helvetica");
    doc.y = y + 20;
  };

  drawHeader();
  rows.forEach((row) => {
    const wrapIdx = columns.findIndex((c) => c.wrap);
    const wrapWidth = wrapIdx >= 0 ? columns[wrapIdx].width - 8 : 0;
    const wrapText = wrapIdx >= 0 ? String(row[wrapIdx] ?? "") : "";
    const wrapHeight = wrapIdx >= 0
      ? doc.heightOfString(wrapText, { width: wrapWidth, align: columns[wrapIdx].align || "left" })
      : defaultRowHeight;
    const rowHeight = Math.max(defaultRowHeight, Math.ceil(wrapHeight) + 8);

    if (doc.y + rowHeight > minBottom) {
      doc.addPage();
      drawHeader();
    }

    const y = doc.y;
    doc.rect(left, y, tableWidth, rowHeight).stroke("#d0d0d0");

    let x = left;
    row.forEach((value, idx) => {
      doc.fontSize(9).fillColor("#111").text(String(value ?? ""), x + 4, y + 4, {
        width: columns[idx].width - 8,
        align: columns[idx].align || "left"
      });
      x += columns[idx].width;
    });

    doc.y = y + rowHeight;
  });
}

function drawSignatureFooter(doc) {
  const availableBottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y > availableBottom - 80) {
    doc.addPage();
  }

  const y = doc.page.height - doc.page.margins.bottom - 55;
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const w = right - left;
  const seg = w / 3;

  doc.strokeColor("#444").lineWidth(1);
  doc.moveTo(left + 10, y).lineTo(left + seg - 10, y).stroke();
  doc.moveTo(left + seg + 10, y).lineTo(left + (2 * seg) - 10, y).stroke();
  doc.moveTo(left + (2 * seg) + 10, y).lineTo(right - 10, y).stroke();

  doc.fontSize(9).fillColor("#111");
  doc.text("Faculty", left, y + 4, { width: seg, align: "center" });
  doc.text("Principal", left + seg, y + 4, { width: seg, align: "center" });
  doc.text("HOD", left + (2 * seg), y + 4, { width: seg, align: "center" });
}

module.exports = {
  drawInstituteHeader,
  gradeFromScore,
  drawSimpleTable,
  drawSignatureFooter
};
