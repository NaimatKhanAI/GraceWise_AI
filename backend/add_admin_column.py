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
    
    # Check if column exists
    cursor.execute("""
        SELECT COUNT(*) 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'gracewise' 
        AND TABLE_NAME = 'user' 
        AND COLUMN_NAME = 'is_admin'
    """)
    
    exists = cursor.fetchone()[0]
    
    if exists == 0:
        # Add the is_admin column
        cursor.execute("ALTER TABLE user ADD COLUMN is_admin BOOLEAN DEFAULT FALSE")
        conn.commit()
        print("✓ Column 'is_admin' added successfully!")
    else:
        print("✓ Column 'is_admin' already exists!")
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"Error: {e}")
    conn.rollback()
    conn.close()
