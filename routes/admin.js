// routes/admin.js
const express = require("express");
const router = express.Router();
const PDFDocument = require("pdfkit");
const bcrypt = require("bcrypt");
const { normalizeDepartment } = require("../utils/departmentHelper");
const {
    drawInstituteHeader,
    gradeFromScore,
    drawSimpleTable,
    drawSignatureFooter
} = require("../utils/pdfHelper");

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

async function getFeedbackOpenState(pool) {
    await ensureFeedbackControlTables(pool);
    const [[row]] = await pool.query("SELECT IsOpen FROM FeedbackControl WHERE Id = 1");
    return Number(row?.IsOpen || 0) === 1;
}

async function tableExists(conn, tableName) {
    const [rows] = await conn.query(
        `SELECT 1
         FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_name = ?
         LIMIT 1`,
        [tableName]
    );
    return rows.length > 0;
}

async function columnExists(conn, tableName, columnName) {
    const [rows] = await conn.query(
        `SELECT 1
         FROM information_schema.columns
         WHERE table_schema = DATABASE()
           AND table_name = ?
           AND column_name = ?
         LIMIT 1`,
        [tableName, columnName]
    );
    return rows.length > 0;
}

  // 1. ADD FACULTY

router.post("/add-faculty", async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { name, email, department } = req.body;

        // Normalize department name
        const normalizedDept = normalizeDepartment(department);

        // Set default password: "12345"
        const defaultPassword = "12345";
        const passwordHash = await bcrypt.hash(defaultPassword, 10);

        await pool.query(
            "INSERT INTO Faculty (Name, Email, Department, PasswordHash) VALUES (?, ?, ?, ?)",
            [name, email, normalizedDept, passwordHash]
        );

        res.json({ message: "Faculty added successfully! Default password: 12345" });

    } catch (err) {
        console.error("Error adding faculty:", err);
        res.status(500).json({ error: "Server error adding faculty" });
    }
});

  // SET/RESET FACULTY PASSWORD

router.post("/set-faculty-password", async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { facultyId, password } = req.body;

        if (!facultyId || !password) {
            return res.status(400).json({ error: "Faculty ID and password are required" });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        await pool.query(
            "UPDATE Faculty SET PasswordHash = ? WHERE FacultyID = ?",
            [passwordHash, facultyId]
        );

        res.json({ message: "Faculty password updated successfully!" });

    } catch (err) {
        console.error("Error setting faculty password:", err);
        res.status(500).json({ error: "Server error setting password" });
    }
});

  // SET/RESET STUDENT PASSWORD

router.post("/set-student-password", async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { studentId, password } = req.body;

        if (!studentId || !password) {
            return res.status(400).json({ error: "Student ID and password are required" });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        await pool.query(
            "UPDATE Students SET PasswordHash = ? WHERE StudentID = ?",
            [passwordHash, studentId]
        );

        res.json({ message: "Student password updated successfully!" });

    } catch (err) {
        console.error("Error setting student password:", err);
        res.status(500).json({ error: "Server error setting password" });
    }
});

  // UPDATE FACULTY

router.post("/update-faculty", async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { facultyId, name, email, department } = req.body;

        if (!facultyId || !name || !email || !department) {
            return res.status(400).json({ error: "All fields are required" });
        }

        // Normalize department
        const normalizedDept = normalizeDepartment(department);

        // Check if email already exists for another faculty
        const [existing] = await pool.query(
            "SELECT FacultyID FROM Faculty WHERE Email = ? AND FacultyID != ?",
            [email, facultyId]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: "Email already exists for another faculty" });
        }

        await pool.query(
            "UPDATE Faculty SET Name = ?, Email = ?, Department = ? WHERE FacultyID = ?",
            [name, email, normalizedDept, facultyId]
        );

        res.json({ message: "Faculty updated successfully!" });

    } catch (err) {
        console.error("Error updating faculty:", err);
        res.status(500).json({ error: "Server error updating faculty" });
    }
});

  // DELETE FACULTY

router.post("/delete-faculty", async (req, res) => {
    let conn;
    try {
        const pool = req.app.locals.pool;
        const { facultyId } = req.body;

        if (!facultyId) {
            return res.status(400).json({ error: "Faculty ID is required" });
        }

        conn = await pool.getConnection();
        await conn.beginTransaction();

        const [[faculty]] = await conn.query(
            "SELECT FacultyID FROM Faculty WHERE FacultyID = ?",
            [facultyId]
        );

        if (!faculty) {
            await conn.rollback();
            return res.status(404).json({ error: "Faculty not found" });
        }

        // Unassign faculty from all subjects, then delete faculty record.
        await conn.query("UPDATE Subjects SET FacultyID = NULL WHERE FacultyID = ?", [facultyId]);
        await conn.query("DELETE FROM Faculty WHERE FacultyID = ?", [facultyId]);

        await conn.commit();

        res.json({ message: "Faculty deleted successfully!" });

    } catch (err) {
        if (conn) {
            await conn.rollback();
        }
        console.error("Error deleting faculty:", err);
        res.status(500).json({ error: "Server error deleting faculty" });
    } finally {
        if (conn) {
            conn.release();
        }
    }
});

  // 2. VIEW FACULTY LIST

router.get("/faculty-list", async (req, res) => {
    try {
        const pool = req.app.locals.pool;

        const [rows] = await pool.query(
            "SELECT FacultyID, Name, Email, Department FROM Faculty"
        );

        res.json(rows);

    } catch (err) {
        console.error("Error fetching faculty list:", err);
        res.status(500).json({ error: "Server error listing faculty" });
    }
});

  // 3. ADD SUBJECT

router.get('/divisions/:dept/:semester', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const dept = decodeURIComponent(req.params.dept);
    const normalizedDept = normalizeDepartment(dept);
    const sem = Number(req.params.semester);
    const [rows] = await pool.query(
      `SELECT DivisionName FROM Divisions
       WHERE LOWER(Department) = LOWER(?) AND Semester = ?
       ORDER BY DivisionName`,
      [normalizedDept, sem]
    );
    res.json(rows); // returns [{DivisionName:'A'}, {DivisionName:'B'}, ...]
  } catch (err) {
    console.error('Error loading divisions:', err);
    res.status(500).json({ error: 'Cannot load divisions' });
  }
});

// ADD DIVISION
router.post("/add-division", async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { department, semester, division } = req.body;

        // Normalize department name
        const normalizedDept = normalizeDepartment(department);

        // check duplicate (case-insensitive)
        const [check] = await pool.query(
          "SELECT * FROM Divisions WHERE LOWER(Department) = LOWER(?) AND Semester=? AND DivisionName=?",
            [normalizedDept, semester, division]
        );

        if (check.length > 0) {
            return res.json({ error: "Division already exists!" });
        }

       await pool.query(
         "INSERT INTO Divisions (Department, Semester, DivisionName) VALUES (?, ?, ?)",
          [normalizedDept, semester, division]
        );


        res.json({ message: "Division added successfully" });

    } catch (err) {
        console.error("Division Add Error:", err);
        res.status(500).json({ error: "Server error adding division" });
    }
});

// LIST DEPARTMENTS
router.get("/departments", async (req, res) => {
    try {
        const pool = req.app.locals.pool;

        const [rows] = await pool.query(
            "SELECT DISTINCT Department FROM Subjects"
        );

        res.json(rows);

    } catch (err) {
        res.status(500).json({ error: "Cannot load departments" });
    }
});


// 2. Add subject — accepts single division or array of divisions
router.post('/add-subject', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { code, title, department, semesterId, division } = req.body;
    // division may be a string "A" or an array ["A","B"]
    if (!code || !title || !department || !semesterId || !division) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // Normalize department name
    const normalizedDept = normalizeDepartment(department);

    const divisions = Array.isArray(division) ? division : [division];

    // Insert one row per selected division
    const insertPromises = divisions.map(d =>
      pool.query(
        `INSERT INTO Subjects (Code, Title, Department, SemesterID, Division)
         VALUES (?, ?, ?, ?, ?)`,
        [code, title, normalizedDept, semesterId, d]
      )
    );

    await Promise.all(insertPromises);

    res.json({ success: true, message: 'Subject(s) added' });

  } catch (err) {
    console.error('Error adding subject(s):', err);
    res.status(500).json({ error: 'Server error adding subject' });
  }
});

  // 4. VIEW SUBJECT LIST

router.get("/subject-list", async (req, res) => {
    try {
        const pool = req.app.locals.pool;

        const [rows] = await pool.query(`
            SELECT 
            s.SubjectID,
            s.Code,
            s.Title,
            s.Department,
            s.SemesterID,
            s.Division,
            f.Name AS FacultyName
            FROM Subjects s
            LEFT JOIN Faculty f ON s.FacultyID = f.FacultyID

        `);

        res.json(rows);

    } catch (err) {
        console.error("Error fetching subject list:", err);
        res.status(500).json({ error: "Server error" });
    }
});

   // 5. ASSIGN FACULTY TO SUBJECT  (WITH DIVISION)

router.post("/assign-faculty", async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { subjectId, facultyId, division } = req.body;

        await pool.query(
            "UPDATE Subjects SET FacultyID = ? WHERE SubjectID = ? AND Division = ?",
            [facultyId, subjectId, division]
        );

        res.json({ message: "Faculty assigned to this division successfully!" });

    } catch (err) {
        console.error("Error assigning faculty:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// UNASSIGN FACULTY FROM SUBJECT
router.post("/unassign-faculty", async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { subjectId } = req.body;

        if (!subjectId) {
            return res.status(400).json({ error: "Subject ID is required" });
        }

        const [result] = await pool.query(
            "UPDATE Subjects SET FacultyID = NULL WHERE SubjectID = ?",
            [subjectId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Subject not found" });
        }

        res.json({ message: "Faculty unassigned successfully!" });
    } catch (err) {
        console.error("Error unassigning faculty:", err);
        res.status(500).json({ error: "Server error unassigning faculty" });
    }
});

  // 6. VIEW ALL STUDENTS

  // UPDATE STUDENT

router.post("/update-student", async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { studentId, name, email, department, division, semester } = req.body;

        if (!studentId || !name || !email || !department || !division || !semester) {
            return res.status(400).json({ error: "All fields are required" });
        }

        // Normalize department
        const normalizedDept = normalizeDepartment(department);

        // Check if email already exists for another student
        const [existing] = await pool.query(
            "SELECT StudentID FROM Students WHERE Email = ? AND StudentID != ?",
            [email, studentId]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: "Email already exists for another student" });
        }

        await pool.query(
            "UPDATE Students SET Name = ?, Email = ?, Department = ?, Division = ?, Semester = ? WHERE StudentID = ?",
            [name, email, normalizedDept, division, semester, studentId]
        );

        res.json({ message: "Student updated successfully!" });

    } catch (err) {
        console.error("Error updating student:", err);
        res.status(500).json({ error: "Server error updating student" });
    }
});

  // DELETE STUDENT

router.post("/delete-student", async (req, res) => {
    let conn;
    try {
        const pool = req.app.locals.pool;
        const { studentId } = req.body;

        if (!studentId) {
            return res.status(400).json({ error: "Student ID is required" });
        }

        conn = await pool.getConnection();
        await conn.beginTransaction();

        const [[student]] = await conn.query(
            "SELECT StudentID FROM Students WHERE StudentID = ?",
            [studentId]
        );

        if (!student) {
            await conn.rollback();
            return res.status(404).json({ error: "Student not found" });
        }

        if (await tableExists(conn, "FeedbackComments")) {
            await conn.query("DELETE FROM FeedbackComments WHERE StudentID = ?", [studentId]);
        }

        if (await tableExists(conn, "StudentFeedbackStatus")) {
            await conn.query("DELETE FROM StudentFeedbackStatus WHERE StudentID = ?", [studentId]);
        }

        if (await tableExists(conn, "Enrollment")) {
            await conn.query("DELETE FROM Enrollment WHERE StudentID = ?", [studentId]);
        }

        // Legacy schema support: if token-based feedback is used, clean token-linked responses first.
        const hasFeedbackTokens = await tableExists(conn, "FeedbackTokens");
        const hasFeedbackResponses = await tableExists(conn, "FeedbackResponses");
        if (hasFeedbackTokens) {
            if (hasFeedbackResponses && await columnExists(conn, "FeedbackResponses", "TokenID")) {
                await conn.query(
                    `DELETE fr
                     FROM FeedbackResponses fr
                     INNER JOIN FeedbackTokens ft ON fr.TokenID = ft.TokenID
                     WHERE ft.StudentID = ?`,
                    [studentId]
                );
            }
            await conn.query("DELETE FROM FeedbackTokens WHERE StudentID = ?", [studentId]);
        }

        // Current schema support: only if StudentID exists in responses table.
        if (hasFeedbackResponses && await columnExists(conn, "FeedbackResponses", "StudentID")) {
            await conn.query(
                "DELETE FROM FeedbackResponses WHERE StudentID = ?",
                [studentId]
            );
        }

        const [del] = await conn.query("DELETE FROM Students WHERE StudentID = ?", [studentId]);
        if (del.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ error: "Student not found" });
        }

        await conn.commit();

        res.json({ message: "Student deleted successfully!" });

    } catch (err) {
        if (conn) {
            await conn.rollback();
        }
        console.error("Error deleting student:", err);
        res.status(500).json({ error: "Server error deleting student" });
    } finally {
        if (conn) {
            conn.release();
        }
    }
});

router.get("/student-list", async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        await ensureFeedbackControlTables(pool);

        const [rows] = await pool.query(
            `SELECT s.StudentID, s.Name, s.RollNo, s.Email, s.Department, s.Division, s.Semester,
                    IFNULL(fr.IsRestricted, 0) AS IsRestricted,
                    IFNULL(fr.Reason, '') AS RestrictionReason
             FROM Students s
             LEFT JOIN FeedbackRestrictedStudents fr ON fr.StudentID = s.StudentID
             ORDER BY s.Department, s.Semester, s.RollNo`
        );

        res.json(rows);

    } catch (err) {
        console.error("Error fetching student list:", err);
        res.status(500).json({ error: "Server error" });
    }
});

router.get("/feedback-control", async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const isOpen = await getFeedbackOpenState(pool);
        res.json({ isOpen });
    } catch (err) {
        console.error("Error fetching feedback control:", err);
        res.status(500).json({ error: "Cannot load feedback control state" });
    }
});

router.post("/feedback-control", async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const isOpen = req.body && (req.body.isOpen === true || req.body.isOpen === 1 || req.body.isOpen === "1");
        await ensureFeedbackControlTables(pool);
        await pool.query("UPDATE FeedbackControl SET IsOpen = ? WHERE Id = 1", [isOpen ? 1 : 0]);
        res.json({ success: true, isOpen });
    } catch (err) {
        console.error("Error updating feedback control:", err);
        res.status(500).json({ error: "Cannot update feedback control state" });
    }
});

router.post("/student-feedback-restriction", async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const studentId = Number(req.body.studentId);
        const isRestricted = req.body && (req.body.isRestricted === true || req.body.isRestricted === 1 || req.body.isRestricted === "1");
        const reason = (req.body.reason || "").trim();

        if (!studentId) {
            return res.status(400).json({ error: "Student ID is required" });
        }

        await ensureFeedbackControlTables(pool);

        if (isRestricted) {
            await pool.query(
                `INSERT INTO FeedbackRestrictedStudents (StudentID, IsRestricted, Reason)
                 VALUES (?, 1, ?)
                 ON DUPLICATE KEY UPDATE IsRestricted = 1, Reason = VALUES(Reason)`,
                [studentId, reason]
            );
        } else {
            await pool.query(
                `INSERT INTO FeedbackRestrictedStudents (StudentID, IsRestricted, Reason)
                 VALUES (?, 0, NULL)
                 ON DUPLICATE KEY UPDATE IsRestricted = 0, Reason = NULL`,
                [studentId]
            );
        }

        res.json({ success: true });
    } catch (err) {
        console.error("Error updating student feedback restriction:", err);
        res.status(500).json({ error: "Cannot update student feedback restriction" });
    }
});

   // 7. FEEDBACK SUMMARY TABLE API

router.get("/feedback-summary/:subjectId", async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { subjectId } = req.params;

        const [rows] = await pool.query(
            `SELECT q.Text AS Question,
                    COUNT(fr.Rating) AS Responses,
                    IFNULL(ROUND(AVG(fr.Rating), 2), 0) AS AverageRating
             FROM Questions q
             LEFT JOIN FeedbackResponses fr
                ON q.QuestionID = fr.QuestionID
               AND fr.SubjectID = ?
             GROUP BY q.QuestionID
             ORDER BY q.QuestionID`,
            [subjectId]
        );

        res.json(rows);

    } catch (err) {
        console.error("Error fetching feedback summary:", err);
        res.status(500).json({ error: "Server error" });
    }
});

  // SHORT SUMMARY PDF REPORT 

router.get("/summary/pdf/:subjectId", async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const sid = req.params.subjectId;

    const [meta] = await pool.query(
      `SELECT s.SubjectID, s.Title AS Subject, s.Code, s.Department, 
              s.SemesterID, s.Division, f.Name AS Faculty
       FROM Subjects s
       LEFT JOIN Faculty f ON s.FacultyID = f.FacultyID
       WHERE s.SubjectID = ?`,
      [sid]
    );

    if (meta.length === 0) {
      return res.status(404).json({ error: "Subject not found" });
    }
    const info = meta[0];

    const [summary] = await pool.query(
      `SELECT q.Text AS Question,
              IFNULL(AVG(fr.Rating),0) AS AvgRating,
              COUNT(fr.Rating) AS TotalResponses
       FROM Questions q
       LEFT JOIN FeedbackResponses fr 
            ON q.QuestionID = fr.QuestionID 
           AND fr.SubjectID = ?
       WHERE q.Active = 1
       GROUP BY q.QuestionID
       ORDER BY q.Sequence`,
      [sid]
    );

    const [comments] = await pool.query(
      `SELECT Comment, Division, SubmittedAt
       FROM FeedbackComments
       WHERE SubjectID = ?
       ORDER BY SubmittedAt DESC
       LIMIT 100`,
      [sid]
    );

    const doc = new PDFDocument({ margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=summary_${sid}.pdf`);
    doc.pipe(res);

    drawInstituteHeader(doc, "STUDENT FEEDBACK REPORT - SUBJECT SUMMARY");
    doc.fontSize(10).fillColor("#000");
    doc.text(`Course/Department: ${info.Department}`);
    doc.text(`Subject: ${info.Subject} (${info.Code})`);
    doc.text(`Semester: ${info.SemesterID}   Division: ${info.Division}   Faculty: ${info.Faculty || "Not Assigned"}`);
    doc.text(`Generated On: ${new Date().toLocaleString("en-IN")}`);
    doc.moveDown(0.4);

    const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const qColumns = [
      { label: "No", width: 36, align: "center" },
      { label: "Question", width: tableWidth - 36 - 88 - 88, wrap: true },
      { label: "Avg Rating", width: 88, align: "center" },
      { label: "Responses", width: 88, align: "center" }
    ];

    const qRows = summary.map((row, i) => [
      i + 1,
      row.Question,
      (Number(row.AvgRating) || 0).toFixed(2),
      row.TotalResponses || 0
    ]);
    drawSimpleTable(doc, qColumns, qRows);

    const valid = summary.map((r) => Number(r.AvgRating) || 0).filter((n) => !Number.isNaN(n));
    const overall = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
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
    console.error("Summary PDF Error:", err);
    res.status(500).json({ error: "Cannot generate summary PDF" });
  }
});

router.get("/summary/division/pdf", async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const dept = req.query.dept ? String(req.query.dept) : "";
    const sem = req.query.sem ? Number(req.query.sem) : null;
    const div = req.query.div ? String(req.query.div) : "";

    const [rows] = await pool.query(
      `SELECT
          s.SubjectID,
          s.Code,
          s.Title,
          s.Department,
          s.SemesterID,
          s.Division,
          COALESCE(f.Name, 'Not Assigned') AS FacultyName,
          IFNULL(ROUND(AVG(fr.Rating),2), 0) AS Points,
          COUNT(fr.Rating) AS Responses
       FROM Subjects s
       LEFT JOIN Faculty f ON s.FacultyID = f.FacultyID
       LEFT JOIN FeedbackResponses fr ON fr.SubjectID = s.SubjectID
       WHERE (? = '' OR s.Department = ?)
         AND (? IS NULL OR s.SemesterID = ?)
         AND (? = '' OR s.Division = ?)
       GROUP BY s.SubjectID, s.Code, s.Title, s.Department, s.SemesterID, s.Division, f.Name
       ORDER BY s.Department, s.SemesterID, s.Division, s.Title`,
      [dept, dept, sem, sem, div, div]
    );

    const doc = new PDFDocument({ margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=division_consolidation_report.pdf");
    doc.pipe(res);

    drawInstituteHeader(doc, "STUDENT FEEDBACK REPORT - DIVISION CONSOLIDATION");
    doc.fontSize(10).fillColor("#000");
    doc.text(`Department: ${dept || "All"}`);
    doc.text(`Semester: ${sem || "All"}   Division: ${div || "All"}`);
    doc.text(`Generated On: ${new Date().toLocaleString("en-IN")}`);
    doc.moveDown(0.5);

    const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const columns = [
      { label: "Faculty Name", width: 130, wrap: true },
      { label: "Subject Name", width: tableWidth - 130 - 72 - 82 - 110, wrap: true },
      { label: "Points", width: 72, align: "center" },
      { label: "Grade", width: 82, align: "center" },
      { label: "Remarks", width: 110, wrap: true }
    ];

    const body = rows.map((r) => {
      const points = Number(r.Points) || 0;
      return [
        r.FacultyName,
        `${r.Title} (${r.Code})`,
        points.toFixed(2),
        gradeFromScore(points),
        Number(r.Responses) > 0 ? `Responses: ${Number(r.Responses)}` : "No responses"
      ];
    });

    drawSimpleTable(doc, columns, body);

    const totalPoints = rows.reduce((sum, r) => sum + (Number(r.Points) || 0), 0);
    const overall = rows.length ? totalPoints / rows.length : 0;
    doc.moveDown(0.7);
    doc.font("Helvetica-Bold").fontSize(11).text(`Division Overall Grade Point: ${overall.toFixed(2)} (${gradeFromScore(overall)})`);
    doc.font("Helvetica");

    drawSignatureFooter(doc);
    doc.end();
  } catch (err) {
    console.error("Division PDF Error:", err);
    res.status(500).json({ error: "Cannot generate division consolidation PDF" });
  }
});

  //  CSV REPORT
router.get("/summary/csv/:subjectId", async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const sid = req.params.subjectId;

    const [summary] = await pool.query(
      `SELECT q.Text AS Question,
              AVG(fr.Rating) AS AvgRating,
              COUNT(fr.Rating) AS TotalResponses
       FROM Questions q
       LEFT JOIN FeedbackResponses fr 
            ON q.QuestionID = fr.QuestionID 
           AND fr.SubjectID = ?
       WHERE q.Active = 1
       GROUP BY q.QuestionID
       ORDER BY q.Sequence`,
      [sid]
    );

    const [comments] = await pool.query(
      `SELECT Comment, SubmittedAt 
       FROM FeedbackComments
       WHERE SubjectID = ?
       ORDER BY SubmittedAt DESC`,
      [sid]
    );

    let csv = "Question,Average Rating,Total Responses\n";

    summary.forEach(r => {
      const avg = r.AvgRating ? Number(r.AvgRating).toFixed(2) : "0.00";
      csv += `"${r.Question.replace(/"/g, '""')}",${avg},${r.TotalResponses}\n`;
    });

    csv += "\nComments,SubmittedAt\n";

    comments.forEach(c => {
      csv += `"${(c.Comment || "").replace(/"/g, '""')}",${c.SubmittedAt}\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=summary_${sid}.csv`);
    res.send(csv);

  } catch (err) {
    console.error("Summary CSV Error:", err);
    res.status(500).json({ error: "Cannot generate CSV summary" });
  }
});

module.exports = router;


