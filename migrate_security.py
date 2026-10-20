import uuid
from sqlalchemy import text
from db import engine, Base
import models

def migrate():
    print("Running security schema updates...")
    with engine.connect() as conn:
        # Create audit_logs and any other new tables
        Base.metadata.create_all(bind=engine)

        # Idempotently add columns to users table
        user_columns = [
            ("uuid", "VARCHAR(36)"),
            ("role", "VARCHAR(20) DEFAULT 'investor'"),
            ("is_active", "BOOLEAN DEFAULT TRUE"),
            ("failed_login_attempts", "INTEGER DEFAULT 0"),
            ("locked_until", "TIMESTAMP WITHOUT TIME ZONE"),
            ("two_factor_secret", "VARCHAR(64)"),
            ("two_factor_enabled", "BOOLEAN DEFAULT FALSE"),
        ]

        for col_name, col_type in user_columns:
            try:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col_name} {col_type};"))
                conn.commit()
            except Exception as e:
                print(f"Notice on users.{col_name}: {e}")

        # Idempotently add columns to portfolios table
        try:
            conn.execute(text("ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS uuid VARCHAR(36);"))
            conn.commit()
        except Exception as e:
            print(f"Notice on portfolios.uuid: {e}")

        # Fill UUIDs for any existing users with null uuid
        res = conn.execute(text("SELECT id FROM users WHERE uuid IS NULL;")).fetchall()
        for row in res:
            new_uid = str(uuid.uuid4())
            conn.execute(text("UPDATE users SET uuid = :uid WHERE id = :id"), {"uid": new_uid, "id": row[0]})
        conn.commit()

        # Fill UUIDs for any existing portfolios with null uuid
        res_p = conn.execute(text("SELECT id FROM portfolios WHERE uuid IS NULL;")).fetchall()
        for row in res_p:
            new_uid = str(uuid.uuid4())
            conn.execute(text("UPDATE portfolios SET uuid = :uid WHERE id = :id"), {"uid": new_uid, "id": row[0]})
        conn.commit()

        print("Security schema updates completed successfully!")

if __name__ == "__main__":
    migrate()
