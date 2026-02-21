// Utility script to set default password for all faculty members who don't have passwords
const bcrypt = require("bcrypt");
const mysql = require("mysql2/promise");
require('dotenv').config();

(async () => {
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST || "localhost",
            user: process.env.DB_USER || "root",
            password: process.env.DB_PASS || "",
            database: process.env.DB_NAME || "FacultyFeedbackSystem"
        });

        console.log("Connecting to database...");

        // Get all faculty members
        const [rows] = await pool.query("SELECT FacultyID, Name, Email, PasswordHash FROM Faculty");

        if (rows.length === 0) {
            console.log("No faculty members found in database.");
            process.exit(0);
        }

        const defaultPassword = "12345";
        const passwordHash = await bcrypt.hash(defaultPassword, 10);

        let updated = 0;
        let skipped = 0;

        for (const faculty of rows) {
            if (!faculty.PasswordHash || faculty.PasswordHash === null) {
                await pool.query(
                    "UPDATE Faculty SET PasswordHash=? WHERE FacultyID=?",
                    [passwordHash, faculty.FacultyID]
                );
                console.log(`✓ Password set for: ${faculty.Name} (${faculty.Email})`);
                updated++;
            } else {
                console.log(`⊘ Skipped (already has password): ${faculty.Name} (${faculty.Email})`);
                skipped++;
            }
        }

        console.log("\n=== Summary ===");
        console.log(`Updated: ${updated} faculty members`);
        console.log(`Skipped: ${skipped} faculty members`);
        console.log(`\nDefault password for all updated accounts: ${defaultPassword}`);
        console.log("\nDone!");

        await pool.end();
        process.exit(0);

    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
})();
