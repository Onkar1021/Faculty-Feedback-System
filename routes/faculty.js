// routes/faculty.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const PDFDocument = require("pdfkit");
const {
  drawInstituteHeader,
  gradeFromScore,
  drawSimpleTable,
  drawSignatureFooter
} = require("../utils/pdfHelper");

// FACULTY LOGIN

router.post("/login", async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { email, password } = req.body;

    const [[faculty]] = await pool.query(
      "SELECT * FROM Faculty WHERE Email = ?",
      [email]
    );

    if (!faculty)
      return res.status(401).json({ error: "Invalid email or password" });

    if (!faculty.PasswordHash)
      return res
        .status(500)
        .json({ error: "Faculty password not set. Contact admin." });

    const ok = await bcrypt.compare(password, faculty.PasswordHash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });

    res.json({ facultyId: faculty.FacultyID, name: faculty.Name });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// SUBJECT LIST FOR FACULTY
router.get("/subjects/:facultyId", async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const [rows] = await pool.query(
      `SELECT SubjectID, Code, Title, Department, SemesterID, Division
       FROM Subjects
       WHERE FacultyID = ?
       ORDER BY SemesterID, Division, Title`,
      [req.params.facultyId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Faculty subjects error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// SUMMARY (VIEW ONLY)

router.get("/summary/:facultyId/:subjectId", async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { facultyId, subjectId } = req.params;

    const [[check]] = await pool.query(
      "SELECT FacultyID FROM Subjects WHERE SubjectID = ?",
      [subjectId]
    );

    if (!check) return res.json({ error: "Subject not found" });
    if (check.FacultyID !== Number(facultyId))
      return res.json({ error: "Not authorized" });

    const [rows] = await pool.query(
      `SELECT q.QuestionID, q.Text AS Question,
              COUNT(fr.Rating) AS Responses,
              IFNULL(ROUND(AVG(fr.Rating),2),0) AS AvgRating
       FROM Questions q
       LEFT JOIN FeedbackResponses fr
           ON q.QuestionID = fr.QuestionID
          AND fr.SubjectID = ?
       WHERE q.Active = 1
       GROUP BY q.QuestionID
       ORDER BY q.Sequence`,
      [subjectId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Summary error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// COMMENTS FOR SUBJECT

router.get("/comments/:facultyId/:subjectId", async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { facultyId, subjectId } = req.params;

    const [[check]] = await pool.query(
      "SELECT FacultyID FROM Subjects WHERE SubjectID = ?",
      [subjectId]
    );
    if (!check) return res.json({ error: "Subject not found" });
    if (check.FacultyID !== Number(facultyId))
      return res.json({ error: "Not authorized" });

    const [rows] = await pool.query(
      `SELECT Comment, Division, SubmittedAt 
       FROM FeedbackComments
       WHERE SubjectID = ?
       ORDER BY SubmittedAt DESC`,
      [subjectId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Comments error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DOWNLOAD PDF

router.get("/summary/pdf/:facultyId/:subjectId", async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { facultyId, subjectId } = req.params;

    const [[assign]] = await pool.query(
      "SELECT * FROM Subjects WHERE SubjectID=?",
      [subjectId]
    );
    if (!assign) return res.json({ error: "Subject not found" });
    if (assign.FacultyID !== Number(facultyId)) return res.json({ error: "Not authorized" });

    const info = assign;

    const [summary] = await pool.query(
      `SELECT q.Text AS Question,
              IFNULL(ROUND(AVG(fr.Rating),2),0) AS AvgRating,
              COUNT(fr.Rating) AS TotalResponses
       FROM Questions q
       LEFT JOIN FeedbackResponses fr 
              ON q.QuestionID = fr.QuestionID
             AND fr.SubjectID = ?
       WHERE q.Active = 1
       GROUP BY q.QuestionID
       ORDER BY q.Sequence`,
      [subjectId]
    );

    const [comments] = await pool.query(
      `SELECT Comment, Division, SubmittedAt
       FROM FeedbackComments
       WHERE SubjectID=?
       ORDER BY SubmittedAt DESC`,
      [subjectId]
    );

    const doc = new PDFDocument({ margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=faculty_summary_${subjectId}.pdf`);
    doc.pipe(res);

    drawInstituteHeader(doc, "STUDENT FEEDBACK REPORT - SUBJECT SUMMARY");
    doc.fontSize(10).fillColor("#000");
    doc.text(`Course/Department: ${info.Department}`);
    doc.text(`Subject: ${info.Title} (${info.Code})`);
    doc.text(`Semester: ${info.SemesterID}   Division: ${info.Division}`);
    doc.text(`Generated On: ${new Date().toLocaleString("en-IN")}`);
    doc.moveDown(0.4);

    const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const columns = [
      { label: "No", width: 36, align: "center" },
      { label: "Question", width: tableWidth - 36 - 88 - 88, wrap: true },
      { label: "Avg Rating", width: 88, align: "center" },
      { label: "Responses", width: 88, align: "center" }
    ];

    const rows = summary.map((s, i) => [
      i + 1,
      s.Question,
      (Number(s.AvgRating) || 0).toFixed(2),
      s.TotalResponses || 0
    ]);
    drawSimpleTable(doc, columns, rows);

    const overall = rows.length ? rows.reduce((sum, r) => sum + Number(r[2]), 0) / rows.length : 0;
    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").fontSize(11).text(`Overall Grade Point: ${overall.toFixed(2)} (${gradeFromScore(overall)})`);
    doc.font("Helvetica");

    doc.moveDown(0.6);
    doc.fontSize(11).font("Helvetica-Bold").text("Remarks / Comments");
    doc.font("Helvetica");
    if (comments.length === 0) {
      doc.fontSize(10).text("No comments submitted for this subject.");
    } else {
      comments.forEach((c, idx) => {
        if (doc.y > doc.page.height - doc.page.margins.bottom - 45) {
          doc.addPage();
          drawInstituteHeader(doc, "STUDENT FEEDBACK REPORT - COMMENTS");
        }
        const txt = c.Comment && c.Comment.trim() ? c.Comment.trim() : "No remarks";
        doc.fontSize(9).text(`${idx + 1}. [Div ${c.Division}] ${txt}`);
      });
    }

    drawSignatureFooter(doc);
    doc.end();
  } catch (err) {
    console.error("PDF error:", err);
    res.status(500).json({ error: "Cannot generate PDF" });
  }
});

// DOWNLOAD CSV

router.get("/summary/csv/:facultyId/:subjectId", async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { facultyId, subjectId } = req.params;

    const [[assign]] = await pool.query(
      "SELECT FacultyID FROM Subjects WHERE SubjectID=?",
      [subjectId]
    );
    if (!assign) return res.json({ error: "Subject not found" });
    if (assign.FacultyID !== Number(facultyId))
      return res.json({ error: "Not authorized" });

    const [summary] = await pool.query(
      `SELECT q.Text AS Question,
              ROUND(AVG(fr.Rating),2) AS AvgRating,
              COUNT(fr.Rating) AS TotalResponses
       FROM Questions q
       LEFT JOIN FeedbackResponses fr 
              ON q.QuestionID = fr.QuestionID
             AND fr.SubjectID = ?
       WHERE q.Active = 1
       GROUP BY q.QuestionID
       ORDER BY q.Sequence`,
      [subjectId]
    );

    const [comments] = await pool.query(
      `SELECT Comment, Division, SubmittedAt
       FROM FeedbackComments
       WHERE SubjectID=?`,
      [subjectId]
    );

    let csv = "Question,Avg Rating,Responses\n";
    summary.forEach((s) => {
      csv += `"${s.Question.replace(/\"/g, '""')}",${s.AvgRating},${s.TotalResponses}\n`;
    });

    csv += "\nComments,Division,SubmittedAt\n";
    comments.forEach((c) => {
      csv += `"${c.Comment.replace(/\"/g, '""')}",${c.Division},${c.SubmittedAt}\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=faculty_summary_${subjectId}.csv`
    );
    res.send(csv);
  } catch (err) {
    console.error("CSV error:", err);
    res.status(500).json({ error: "Cannot generate CSV" });
  }
});

// CHANGE PASSWORD

router.post("/change-password", async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { facultyId, oldPassword, newPassword } = req.body;

    if (!facultyId || !oldPassword || !newPassword) {
      return res.json({ error: "Missing fields" });
    }

    const [[fac]] = await pool.query(
      "SELECT PasswordHash FROM Faculty WHERE FacultyID=?",
      [facultyId]
    );

    if (!fac) return res.json({ error: "Faculty not found" });

    const ok = await bcrypt.compare(oldPassword, fac.PasswordHash);
    if (!ok) return res.json({ error: "Old password is wrong" });

    const newHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      "UPDATE Faculty SET PasswordHash=? WHERE FacultyID=?",
      [newHash, facultyId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Password update error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

