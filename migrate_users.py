import hashlib
from sqlalchemy import text
from db import engine, SessionLocal
from models import Base

def run_migration():
    print("Running migration for users table...")
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                full_name VARCHAR(150) NOT NULL,
                password_hash VARCHAR(256) NOT NULL,
                broker VARCHAR(100) DEFAULT 'KixBroker BVC',
                risk_profile VARCHAR(50) DEFAULT 'Moderado',
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """))
        conn.execute(text("""
            ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
        """))
        conn.commit()
    print("Users table and user_id foreign key verified!")

if __name__ == "__main__":
    run_migration()
