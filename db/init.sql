CREATE DATABASE IF NOT EXISTS FacultyFeedbackSystem;
USE FacultyFeedbackSystem;

CREATE TABLE IF NOT EXISTS Admins (
  AdminID INT AUTO_INCREMENT PRIMARY KEY,
  Username VARCHAR(100) UNIQUE NOT NULL,
  PasswordHash VARCHAR(255) NOT NULL,
  Role VARCHAR(50) DEFAULT 'admin',
  CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Faculty (
  FacultyID INT AUTO_INCREMENT PRIMARY KEY,
  Name VARCHAR(100) NOT NULL,
  Department VARCHAR(100) NOT NULL,
  Email VARCHAR(150) UNIQUE NOT NULL,
  PasswordHash VARCHAR(255) NULL,
  CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Students (
  StudentID INT AUTO_INCREMENT PRIMARY KEY,
  RollNo VARCHAR(50) UNIQUE NOT NULL,
  Name VARCHAR(100) NOT NULL,
  Email VARCHAR(200) UNIQUE NOT NULL,
  Department VARCHAR(100) NOT NULL,
  Division VARCHAR(20) NOT NULL,
  Semester INT NOT NULL,
  PasswordHash VARCHAR(255) NOT NULL,
  CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Divisions (
  DivisionID INT AUTO_INCREMENT PRIMARY KEY,
  Department VARCHAR(50) NOT NULL,
  Semester INT NOT NULL,
  DivisionName VARCHAR(10) NOT NULL,
  UNIQUE KEY uniq_division (Department, Semester, DivisionName)
);

CREATE TABLE IF NOT EXISTS Subjects (
  SubjectID INT AUTO_INCREMENT PRIMARY KEY,
  Code VARCHAR(50) NOT NULL,
  Title VARCHAR(200) NOT NULL,
  FacultyID INT NULL,
  SemesterID INT NOT NULL,
  Department VARCHAR(100) NOT NULL,
  Division VARCHAR(10) NOT NULL DEFAULT 'A',
  CONSTRAINT fk_subject_faculty
    FOREIGN KEY (FacultyID) REFERENCES Faculty(FacultyID)
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS Enrollment (
  EnrollmentID INT AUTO_INCREMENT PRIMARY KEY,
  StudentID INT NOT NULL,
  SubjectID INT NOT NULL,
  UNIQUE KEY uniq_enrollment (StudentID, SubjectID),
  CONSTRAINT fk_enroll_student
    FOREIGN KEY (StudentID) REFERENCES Students(StudentID)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_enroll_subject
    FOREIGN KEY (SubjectID) REFERENCES Subjects(SubjectID)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS Questions (
  QuestionID INT AUTO_INCREMENT PRIMARY KEY,
  Text VARCHAR(500) NOT NULL,
  Sequence INT NOT NULL DEFAULT 1,
  Active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS StudentFeedbackStatus (
  StatusID INT AUTO_INCREMENT PRIMARY KEY,
  StudentID INT NOT NULL,
  SubjectID INT NOT NULL,
  Submitted BOOLEAN DEFAULT FALSE,
  UNIQUE KEY uniq_feedback_status (StudentID, SubjectID),
  CONSTRAINT fk_status_student
    FOREIGN KEY (StudentID) REFERENCES Students(StudentID)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_status_subject
    FOREIGN KEY (SubjectID) REFERENCES Subjects(SubjectID)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS FeedbackResponses (
  ResponseID INT AUTO_INCREMENT PRIMARY KEY,
  SubjectID INT NOT NULL,
  QuestionID INT NOT NULL,
  Rating INT NOT NULL,
  SubmittedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_response_subject
    FOREIGN KEY (SubjectID) REFERENCES Subjects(SubjectID)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_response_question
    FOREIGN KEY (QuestionID) REFERENCES Questions(QuestionID)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS FeedbackComments (
  CommentID INT AUTO_INCREMENT PRIMARY KEY,
  SubjectID INT NOT NULL,
  StudentID INT NOT NULL,
  Division VARCHAR(10) NULL,
  Comment TEXT,
  SubmittedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_comment_subject
    FOREIGN KEY (SubjectID) REFERENCES Subjects(SubjectID)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_comment_student
    FOREIGN KEY (StudentID) REFERENCES Students(StudentID)
    ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO Questions (Text, Sequence, Active)
SELECT 'The teacher covers the entire syllabus', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM Questions WHERE Sequence = 1);

INSERT INTO Questions (Text, Sequence, Active)
SELECT 'The teacher discusses topics in detail', 2, 1
WHERE NOT EXISTS (SELECT 1 FROM Questions WHERE Sequence = 2);

INSERT INTO Questions (Text, Sequence, Active)
SELECT 'The teacher possesses deep knowledge of the subject taught', 3, 1
WHERE NOT EXISTS (SELECT 1 FROM Questions WHERE Sequence = 3);

INSERT INTO Questions (Text, Sequence, Active)
SELECT 'The teacher communicates clearly', 4, 1
WHERE NOT EXISTS (SELECT 1 FROM Questions WHERE Sequence = 4);

INSERT INTO Questions (Text, Sequence, Active)
SELECT 'The teacher inspires me by his/her knowledge in the subject', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM Questions WHERE Sequence = 5);

INSERT INTO Questions (Text, Sequence, Active)
SELECT 'The teacher is punctual to the class', 6, 1
WHERE NOT EXISTS (SELECT 1 FROM Questions WHERE Sequence = 6);

INSERT INTO Questions (Text, Sequence, Active)
SELECT 'The teacher engages the class for the full duration and completes the course in time', 7, 1
WHERE NOT EXISTS (SELECT 1 FROM Questions WHERE Sequence = 7);

INSERT INTO Questions (Text, Sequence, Active)
SELECT 'The teacher comes fully prepared for the class', 8, 1
WHERE NOT EXISTS (SELECT 1 FROM Questions WHERE Sequence = 8);

INSERT INTO Questions (Text, Sequence, Active)
SELECT 'The teacher provides guidance counseling in academic and non-academic matters inside/outside the class', 9, 1
WHERE NOT EXISTS (SELECT 1 FROM Questions WHERE Sequence = 9);
