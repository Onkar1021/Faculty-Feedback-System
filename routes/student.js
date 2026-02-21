// routes/student.js

const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const { normalizeDepartment } = require("../utils/departmentHelper");

async function ensureFeedbackControlTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS FeedbackControl (
      Id TINYINT PRIMARY KEY,
      IsOpen TINYINT(1) NOT NULL DEFAULT 1,
      UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS FeedbackRestrictedStudents (
      StudentID INT PRIMARY KEY,
      IsRestricted TINYINT(1) NOT NULL DEFAULT 1,
      Reason VARCHAR(255) NULL,
      UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(
    `INSERT INTO FeedbackControl (Id, IsOpen)
     VALUES (1, 1)
     ON DUPLICATE KEY UPDATE Id = Id`
  );
}

// route for subjects
router.get("/subjects/:studentId", async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const studentId = req.params.studentId;
        await ensureFeedbackControlTables(pool);

        // 1. Get student's Department, Semester, Division
        const [[student]] = await pool.query(
            "SELECT Department, Semester, Division FROM Students WHERE StudentID = ?",
            [studentId]
        );

        const [[control]] = await pool.query("SELECT IsOpen FROM FeedbackControl WHERE Id = 1");
        const feedbackOpen = Number(control?.IsOpen || 0) === 1;

        const [[restriction]] = await pool.query(
            "SELECT IsRestricted, Reason FROM FeedbackRestrictedStudents WHERE StudentID = ?",
            [studentId]
        );
        const restricted = Number(restriction?.IsRestricted || 0) === 1;
        const restrictionReason = (restriction?.Reason || "").trim();

        // 2. Show subjects ONLY for that student's batch (case-insensitive department matching)
        const normalizedDept = normalizeDepartment(student.Department);
        const [rows] = await pool.query(
            `SELECT 
                s.SubjectID,
                s.Title,
                COALESCE(f.Name, 'Not Assigned') AS FacultyName,
                COALESCE(fs.Submitted, 0) AS Submitted
                FROM Subjects s
                LEFT JOIN Faculty f ON s.FacultyID = f.FacultyID
                LEFT JOIN StudentFeedbackStatus fs
                ON fs.StudentID = ? AND fs.SubjectID = s.SubjectID
                WHERE LOWER(s.Department) = LOWER(?)
                AND s.SemesterID = ?
                AND s.Division = ?`,
            [studentId, normalizedDept, student.Semester, student.Division]
        );

        res.json(
            rows.map((r) => ({
                ...r,
                FeedbackOpen: feedbackOpen ? 1 : 0,
                Restricted: restricted ? 1 : 0,
                RestrictionReason: restrictionReason
            }))
        );

    } catch (err) {
        console.error("Error fetching subjects:", err);
        res.status(500).json({ error: "Server error" });
    }
});

  // 1. GET ACTIVE QUESTIONS

router.get("/questions", async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const [rows] = await pool.query(
      "SELECT QuestionID, Text FROM Questions WHERE Active = 1 ORDER BY Sequence"
    );

    res.json(rows);

  } catch (err) {
    console.error("Error fetching questions:", err);
    res.status(500).json({ error: "Unable to load questions" });
  }
});


// SUBMIT FEEDBACK
router.post("/submit-feedback", async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    await ensureFeedbackControlTables(pool);

    const { studentId, subjectId, responses, comment } = req.body;

    const [[control]] = await pool.query("SELECT IsOpen FROM FeedbackControl WHERE Id = 1");
    const feedbackOpen = Number(control?.IsOpen || 0) === 1;
    if (!feedbackOpen) {
      return res.json({ error: "Feedback window is currently closed by admin." });
    }

    const [[restriction]] = await pool.query(
      "SELECT IsRestricted, Reason FROM FeedbackRestrictedStudents WHERE StudentID = ?",
      [studentId]
    );
    if (Number(restriction?.IsRestricted || 0) === 1) {
      const reason = (restriction?.Reason || "").trim();
      return res.json({ error: reason ? `Feedback access is restricted: ${reason}` : "Feedback access is restricted by admin." });
    }

    // get student division
    const [[student]] = await pool.query(
      "SELECT Division FROM Students WHERE StudentID=?",
      [studentId]
    );

    const division = student?.Division || null;

    // Check duplicate
    const [status] = await pool.query(
      "SELECT * FROM StudentFeedbackStatus WHERE StudentID=? AND SubjectID=?",
      [studentId, subjectId]
    );

    if (status.length > 0 && status[0].Submitted)
      return res.json({ error: "Feedback already submitted" });

    // Insert question ratings
    for (const r of responses) {
      await pool.query(
        `INSERT INTO FeedbackResponses (SubjectID, QuestionID, Rating)
         VALUES (?, ?, ?)`,
        [subjectId, r.questionId, r.rating]
      );
    }

    // Insert overall comment
    if (comment && comment.trim() !== "") {
      await pool.query(
        `INSERT INTO FeedbackComments (SubjectID, StudentID, Division, Comment)
         VALUES (?, ?, ?, ?)`,
        [subjectId, studentId, division, comment.trim()]
      );
    }

    // Mark as submitted
    await pool.query(
      `INSERT INTO StudentFeedbackStatus (StudentID, SubjectID, Submitted)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE Submitted=1`,
      [studentId, subjectId]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("Submit feedback error:", err);
    res.status(500).json({ error: "Server error submitting feedback" });
  }
});

// CHANGE PASSWORD

router.post("/change-password", async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { studentId, oldPassword, newPassword } = req.body;

    if (!studentId || !oldPassword || !newPassword) {
      return res.json({ error: "Missing fields" });
    }

    const [[student]] = await pool.query(
      "SELECT PasswordHash FROM Students WHERE StudentID=?",
      [studentId]
    );

    if (!student) return res.json({ error: "Student not found" });

    const ok = await bcrypt.compare(oldPassword, student.PasswordHash);
    if (!ok) return res.json({ error: "Old password is wrong" });

    const newHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      "UPDATE Students SET PasswordHash=? WHERE StudentID=?",
      [newHash, studentId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Password update error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
