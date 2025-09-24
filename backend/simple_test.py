import psycopg2

# Test connection parameters
connection_params = {
    'host': 'localhost',
    'port': 5433,
    'database': 'taskroute',
    'user': 'postgres',
    'password': 'password'
}

print("Testing database connection...")
print(f"Trying to connect to: {connection_params}")

try:
    # Try to connect
    conn = psycopg2.connect(**connection_params)
    print("✅ Direct psycopg2 connection successful!")
    
    # Test a simple query
    cursor = conn.cursor()
    cursor.execute("SELECT version();")
    result = cursor.fetchone()
    print(f"PostgreSQL version: {result[0]}")
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"❌ Connection failed: {e}")
    print("\nTrying alternative connection methods...")
    
    # Try without password
    try:
        conn_no_pass = psycopg2.connect(
            host='localhost',
            port=5433,
            database='taskroute',
            user='postgres'
        )
        print("✅ Connection successful WITHOUT password!")
        conn_no_pass.close()
    except Exception as e2:
        print(f"❌ No password also failed: {e2}")
        
    # Try with different host
    try:
        conn_127 = psycopg2.connect(
            host='127.0.0.1',
            port=5433,
            database='taskroute',
            user='postgres',
            password='password'
        )
        print("✅ Connection successful with 127.0.0.1!")
        conn_127.close()
    except Exception as e3:
        print(f"❌ 127.0.0.1 also failed: {e3}")