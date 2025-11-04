"""change erole 'bot' -> 'model'

Revision ID: 0002_change_erole_bot_to_model
Revises: 0001_create_initial_tables
Create Date: 2025-11-05 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0002_change_erole_bot_to_model'
down_revision = '0001_create_initial_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    # First, update existing data from 'bot' to 'model'
    try:
        op.execute("""UPDATE messages SET role='model' WHERE role='bot'""")
    except Exception:
        # best-effort: continue if table doesn't exist or update fails
        pass

    # Then alter the column enum definition depending on dialect
    if dialect in ("mysql", "mysql+pymysql", "mysql+aiomysql"):
        # MySQL: modify column to new ENUM
        try:
            op.execute("""
            ALTER TABLE messages
            MODIFY COLUMN role ENUM('user','model') NOT NULL
            """)
        except Exception:
            pass
    else:
        # For other DBs, attempt a generic ALTER using SQLAlchemy Enum
        try:
            op.alter_column('messages', 'role',
                            existing_type=sa.Enum('user', 'bot', name='erole'),
                            type_=sa.Enum('user', 'model', name='erole'),
                            existing_nullable=False)
        except Exception:
            pass


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    # revert values from 'model' back to 'bot'
    try:
        op.execute("""UPDATE messages SET role='bot' WHERE role='model'""")
    except Exception:
        pass

    if dialect in ("mysql", "mysql+pymysql", "mysql+aiomysql"):
        try:
            op.execute("""
            ALTER TABLE messages
            MODIFY COLUMN role ENUM('user','bot') NOT NULL
            """)
        except Exception:
            pass
    else:
        try:
            op.alter_column('messages', 'role',
                            existing_type=sa.Enum('user', 'model', name='erole'),
                            type_=sa.Enum('user', 'bot', name='erole'),
                            existing_nullable=False)
        except Exception:
            pass
