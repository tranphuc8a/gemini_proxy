"""course files, document history and trash

Three new tables, none of the existing ones changes:

* ``course_assets``        — files uploaded to a course (images a lesson shows);
* ``course_doc_revisions`` — the version of a document each save replaced, and
  the version a delete removed (its trash entry);
* ``course_trash``         — a deleted course, kept whole as its export bundle.

The application's startup runs ``create_all``, which creates missing tables, so a
deployment may already have them: each is created only when missing, like 0003.

Revision ID: 0004_course_assets_history_trash
Revises: 0003_create_course_tables
Create Date: 2026-10-03 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.mysql import LONGBLOB, LONGTEXT

# revision identifiers, used by Alembic.
revision = '0004_course_assets_history_trash'
down_revision = '0003_create_course_tables'
branch_labels = None
depends_on = None

LONG = sa.Text().with_variant(LONGTEXT, "mysql")
BLOB = sa.LargeBinary().with_variant(LONGBLOB, "mysql")
MYSQL = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}


def _ident(length: int):
    """Exact-compare identifier on MySQL (see course_entity.Ident)."""
    return sa.String(length).with_variant(sa.String(length, collation="utf8mb4_bin"), "mysql")


def _missing(name: str) -> bool:
    return not sa.inspect(op.get_bind()).has_table(name)


def upgrade() -> None:
    if _missing('course_assets'):
        op.create_table(
            'course_assets',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('course_id', sa.Integer(), sa.ForeignKey('courses.id', ondelete='CASCADE'), nullable=False),
            sa.Column('name', _ident(128), nullable=False),
            sa.Column('mime', sa.String(length=100), nullable=False),
            sa.Column('size', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('sha1', sa.String(length=40), nullable=False, server_default=''),
            sa.Column('data', BLOB, nullable=False),
            sa.Column('created_at', sa.BigInteger(), nullable=False),
            sa.UniqueConstraint('course_id', 'name', name='uq_course_assets_course_name'),
            **MYSQL,
        )
    if _missing('course_doc_revisions'):
        op.create_table(
            'course_doc_revisions',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('course_id', sa.Integer(), sa.ForeignKey('courses.id', ondelete='CASCADE'), nullable=False),
            sa.Column('doc_id', _ident(255), nullable=False),
            sa.Column('action', sa.String(length=16), nullable=False, server_default='sua'),
            sa.Column('title', sa.String(length=500), nullable=False, server_default=''),
            sa.Column('slug', _ident(255), nullable=False, server_default=''),
            sa.Column('kind', sa.String(length=32), nullable=False, server_default='lesson'),
            sa.Column('tag', sa.String(length=64), nullable=True),
            sa.Column('meta', sa.JSON(), nullable=False),
            sa.Column('placement', sa.JSON(), nullable=False),
            sa.Column('md', LONG, nullable=False),
            sa.Column('words', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('saved_at', sa.BigInteger(), nullable=False),
            **MYSQL,
        )
        op.create_index('ix_course_doc_revisions_doc', 'course_doc_revisions', ['course_id', 'doc_id', 'saved_at'])
    if _missing('course_trash'):
        op.create_table(
            'course_trash',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('slug', _ident(64), nullable=False),
            sa.Column('title', sa.String(length=255), nullable=False, server_default=''),
            sa.Column('doc_count', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('bundle', LONG, nullable=False),
            sa.Column('deleted_at', sa.BigInteger(), nullable=False),
            **MYSQL,
        )


def downgrade() -> None:
    for name in ('course_trash', 'course_doc_revisions', 'course_assets'):
        if not _missing(name):
            op.drop_table(name)
