"""create initial conversations and messages tables

Revision ID: 0001_create_initial_tables
Revises: 
Create Date: 2025-11-04 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
import logging

# revision identifiers, used by Alembic.
revision = '0001_create_initial_tables'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum type for message role
    erole = sa.Enum('user', 'bot', name='erole')
    try:
        erole.create(op.get_bind(), checkfirst=True)
    except Exception:
        logging.getLogger(__name__).warning("Could not create enum 'erole' (may already exist)")

    # conversations table
    try:
        op.create_table(
            'conversations',
            sa.Column('id', sa.String(length=64), primary_key=True),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('created_at', sa.BigInteger(), nullable=False),
            sa.Column('updated_at', sa.BigInteger(), nullable=True),
        )
        op.create_index('idx_conversations_created_at', 'conversations', ['created_at'])
    except Exception:
        logging.getLogger(__name__).warning("Conversations table may already exist; skipping creation")

    # messages table
    try:
        op.create_table(
            'messages',
            sa.Column('id', sa.String(length=64), primary_key=True),
            sa.Column('conversation_id', sa.String(length=64), nullable=False),
            sa.Column('role', erole, nullable=False),
            sa.Column('content', sa.Text(), nullable=False),
            sa.Column('created_at', sa.BigInteger(), nullable=False),
            sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='CASCADE'),
        )
        op.create_index('idx_messages_conversation_id', 'messages', ['conversation_id'])
        op.create_index('idx_messages_created_at', 'messages', ['created_at'])
    except Exception:
        logging.getLogger(__name__).warning("Messages table may already exist; skipping creation")


def downgrade() -> None:
    try:
        op.drop_index('idx_messages_created_at', table_name='messages')
        op.drop_index('idx_messages_conversation_id', table_name='messages')
        op.drop_table('messages')
    except Exception:
        logging.getLogger(__name__).warning("Messages table not present or could not be dropped")

    try:
        op.drop_index('idx_conversations_created_at', table_name='conversations')
        op.drop_table('conversations')
    except Exception:
        logging.getLogger(__name__).warning("Conversations table not present or could not be dropped")

    # drop enum type
    try:
        erole = sa.Enum(name='erole')
        erole.drop(op.get_bind(), checkfirst=True)
    except Exception:
        logging.getLogger(__name__).warning("Enum 'erole' not present or could not be dropped")
