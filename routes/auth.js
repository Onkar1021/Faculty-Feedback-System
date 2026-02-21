const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const { normalizeDepartment } = require("../utils/departmentHelper");

//  STUDENT REGISTRATION 

router.post("/register", async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { name, rollno, email, department, division, semester, password } = req.body;

        if (!name || !rollno || !email || !password || !department || !semester) {
            return res.json({ error: "Please fill all required fields" });
        }

        // Check email
        const [emailCheck] = await pool.query(
            "SELECT * FROM Students WHERE Email = ?",
            [email]
        );

        if (emailCheck.length > 0) {
            return res.json({ error: "Email already registered" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Normalize department name
        const normalizedDept = normalizeDepartment(department);

        // Insert student
        const [result] = await pool.query(
            `INSERT INTO Students (Name, RollNo, Email, Department, Division, Semester, PasswordHash)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [name, rollno, email, normalizedDept, division, semester, hashedPassword]
        );

        const studentId = result.insertId;

        //  AUTO ASSIGN SUBJECTS (case-insensitive department matching)
        const [subjects] = await pool.query(
        `SELECT SubjectID FROM Subjects
         WHERE LOWER(Department) = LOWER(?) AND SemesterID = ? AND Division = ?`,
        [normalizedDept, semester, division]
        );


        for (let sub of subjects) {
            await pool.query(
                `INSERT INTO Enrollment (StudentID, SubjectID)
                 VALUES (?, ?)`,
                [studentId, sub.SubjectID]
            );
        }

        res.json({ message: "Registration successful" });

    } catch (error) {
        console.error("Registration Error:", error);
        res.status(500).json({ error: "Server error during registration" });
    }
});

// faculty login 
router.post("/faculty-login", async (req, res) => {
    const pool = req.app.locals.pool;
    const { email, password } = req.body;

    const [[faculty]] = await pool.query(
        "SELECT FacultyID, Name, Email, PasswordHash FROM Faculty WHERE Email=?",
        [email]
    );

    if (!faculty)
        return res.json({ error: "Faculty not found!" });

    const match = await bcrypt.compare(password, faculty.PasswordHash);

    if (!match)
        return res.json({ error: "Incorrect password!" });

    res.json({
        success: true,
        facultyId: faculty.FacultyID,
        name: faculty.Name
    });
});

//  STUDENT LOGIN 

router.post("/student-login", async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { email, password } = req.body;

        const [rows] = await pool.query(
            "SELECT * FROM Students WHERE Email = ?",
            [email]
        );

        if (rows.length === 0) {
            return res.json({ error: "Invalid email or password" });
        }

        const student = rows[0];

        const isMatch = await bcrypt.compare(password, student.PasswordHash);

        if (!isMatch) {
            return res.json({ error: "Invalid email or password" });
        }

        res.json({
            studentId: student.StudentID,
            name: student.Name
        });

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ error: "Server error during login" });
    }
});

module.exports = router;
