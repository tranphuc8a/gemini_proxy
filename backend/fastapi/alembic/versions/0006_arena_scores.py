"""arena_scores: the algorithm arena's leaderboard (best score per name per problem)

Revision ID: 0006_arena_scores
Revises: 0005_ai_usage_cache
"""

from alembic import op
import sqlalchemy as sa

revision = "0006_arena_scores"
down_revision = "0005_ai_usage_cache"
branch_labels = None
depends_on = None

_TABLE = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}


def upgrade() -> None:
    if "arena_scores" in sa.inspect(op.get_bind()).get_table_names():
        return                                  # created at startup by create_all on a fresh database
    op.create_table(
        "arena_scores",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("problem", sa.String(32), nullable=False),
        sa.Column("name", sa.String(40), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
        sa.UniqueConstraint("problem", "name", name="uq_arena_problem_name"),
        **_TABLE,
    )
    op.create_index("ix_arena_problem_score", "arena_scores", ["problem", "score"])


def downgrade() -> None:
    op.drop_index("ix_arena_problem_score", table_name="arena_scores")
    op.drop_table("arena_scores")
