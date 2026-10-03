"""AI spending and answer cache

Two new tables, none of the existing ones changes:

* ``ai_usage`` — requests and tokens per UTC day and AI feature; the row with
  feature "*" is the day's total, the one the daily budget is checked on;
* ``ai_cache`` — answers that depend only on their inputs (a lesson's
  flashcards at a given revision), kept 30 days.

The application's startup runs ``create_all``, which creates missing tables, so a
deployment may already have them: each is created only when missing, like 0003.

Revision ID: 0005_ai_usage_cache
Revises: 0004_course_assets_history_trash
Create Date: 2026-10-03 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.mysql import LONGTEXT

# revision identifiers, used by Alembic.
revision = '0005_ai_usage_cache'
down_revision = '0004_course_assets_history_trash'
branch_labels = None
depends_on = None

LONG = sa.Text().with_variant(LONGTEXT, "mysql")
MYSQL = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}


def _missing(name: str) -> bool:
    return not sa.inspect(op.get_bind()).has_table(name)


def upgrade() -> None:
    if _missing('ai_usage'):
        op.create_table(
            'ai_usage',
            sa.Column('day', sa.String(length=10), primary_key=True),
            sa.Column('feature', sa.String(length=32), primary_key=True),
            sa.Column('requests', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('prompt_tokens', sa.BigInteger(), nullable=False, server_default='0'),
            sa.Column('output_tokens', sa.BigInteger(), nullable=False, server_default='0'),
            **MYSQL,
        )
    if _missing('ai_cache'):
        op.create_table(
            'ai_cache',
            sa.Column('cache_key', sa.String(length=40), primary_key=True),
            sa.Column('feature', sa.String(length=32), nullable=False),
            sa.Column('payload', LONG, nullable=False),
            sa.Column('created_at', sa.BigInteger(), nullable=False),
            **MYSQL,
        )
        op.create_index('ix_ai_cache_created_at', 'ai_cache', ['created_at'])


def downgrade() -> None:
    for name in ('ai_cache', 'ai_usage'):
        if not _missing(name):
            op.drop_table(name)
