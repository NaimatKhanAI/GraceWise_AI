import pymysql

# Connect to the database
conn = pymysql.connect(
    host='localhost',
    user='root',
    password='',
    database='gracewise'
)

try:
    cursor = conn.cursor()
    
    print("Adding quiz and quiz_result tables...")
    
    # Create quiz table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS quiz (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            document_name VARCHAR(255),
            questions JSON NOT NULL,
            created_by INT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT TRUE,
            FOREIGN KEY (created_by) REFERENCES user(id)
        )
    """)
    print("✓ Quiz table created/verified")
    
    # Create quiz_result table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS quiz_result (
            id INT AUTO_INCREMENT PRIMARY KEY,
            quiz_id INT NOT NULL,
            user_id INT NOT NULL,
            answers JSON NOT NULL,
            score FLOAT NOT NULL,
            total_questions INT NOT NULL,
            feedback JSON,
            completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (quiz_id) REFERENCES quiz(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES user(id)
        )
    """)
    print("✓ Quiz result table created/verified")
    
    conn.commit()
    print("\n✓ All tables created successfully!")
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"Error: {e}")
    conn.rollback()
    conn.close()
