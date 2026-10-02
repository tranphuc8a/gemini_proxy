"""create course content tables (courses, sections, groups, docs)

Course content used to ship inside the web bundle as one `content.js` per
course (8 MB for the AI course). It now lives here; the web engine loads a
light manifest and fetches each document when opened.

The application's startup runs `create_all`, so on a deployment that started
before this migration was applied the tables may already exist. Each table is
therefore created only when missing — the same tolerance 0001 has.

Revision ID: 0003_create_course_tables
Revises: 0002_change_erole_bot_to_model
Create Date: 2026-10-02 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.mysql import LONGTEXT

# revision identifiers, used by Alembic.
revision = '0003_create_course_tables'
down_revision = '0002_change_erole_bot_to_model'
branch_labels = None
depends_on = None

LONG = sa.Text().with_variant(LONGTEXT, "mysql")
MYSQL = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}


def _ident(length: int):
    """Exact-compare identifier on MySQL (see course_entity.Ident)."""
    return sa.String(length).with_variant(sa.String(length, collation="utf8mb4_bin"), "mysql")


def _missing(name: str) -> bool:
    return not sa.inspect(op.get_bind()).has_table(name)


def upgrade() -> None:
    if _missing('courses'):
        op.create_table(
            'courses',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('slug', _ident(64), nullable=False, unique=True),
            sa.Column('title', sa.String(length=255), nullable=False),
            sa.Column('subtitle', sa.String(length=255), nullable=False, server_default=''),
            sa.Column('description', sa.Text(), nullable=False),
            sa.Column('icon', sa.String(length=32), nullable=False, server_default=''),
            sa.Column('config', sa.JSON(), nullable=False),
            sa.Column('stats', sa.JSON(), nullable=False),
            sa.Column('published', sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
            sa.Column('created_at', sa.BigInteger(), nullable=False),
            sa.Column('updated_at', sa.BigInteger(), nullable=False),
            **MYSQL,
        )
    if _missing('course_sections'):
        op.create_table(
            'course_sections',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('course_id', sa.Integer(), sa.ForeignKey('courses.id', ondelete='CASCADE'), nullable=False),
            sa.Column('sec_id', _ident(64), nullable=False),
            sa.Column('title', sa.String(length=255), nullable=False),
            sa.Column('sub', sa.String(length=255), nullable=False, server_default=''),
            sa.Column('icon', sa.String(length=32), nullable=False, server_default=''),
            sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
            sa.UniqueConstraint('course_id', 'sec_id', name='uq_course_sections_course_sec'),
            **MYSQL,
        )
    if _missing('course_groups'):
        op.create_table(
            'course_groups',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('section_id', sa.Integer(), sa.ForeignKey('course_sections.id', ondelete='CASCADE'), nullable=False),
            sa.Column('title', sa.String(length=255), nullable=False),
            sa.Column('short', sa.String(length=64), nullable=False, server_default=''),
            sa.Column('meta', sa.JSON(), nullable=False),
            sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
            **MYSQL,
        )
    if _missing('course_docs'):
        op.create_table(
            'course_docs',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('course_id', sa.Integer(), sa.ForeignKey('courses.id', ondelete='CASCADE'), nullable=False),
            sa.Column('group_id', sa.Integer(), sa.ForeignKey('course_groups.id', ondelete='SET NULL'), nullable=True),
            sa.Column('doc_id', _ident(255), nullable=False),
            sa.Column('slug', _ident(255), nullable=False),
            sa.Column('title', sa.String(length=500), nullable=False),
            sa.Column('kind', sa.String(length=32), nullable=False, server_default='lesson'),
            sa.Column('tag', sa.String(length=64), nullable=True),
            sa.Column('meta', sa.JSON(), nullable=False),
            sa.Column('outline', sa.JSON(), nullable=False),
            sa.Column('words', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('code_lines', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('minutes', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('md', LONG, nullable=False),
            sa.Column('title_folded', sa.String(length=500), nullable=False, server_default=''),
            sa.Column('heads_folded', sa.Text(), nullable=False),
            sa.Column('body_folded', LONG, nullable=False),
            sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('updated_at', sa.BigInteger(), nullable=False),
            sa.UniqueConstraint('course_id', 'doc_id', name='uq_course_docs_course_doc'),
            **MYSQL,
        )
        op.create_index('ix_course_docs_course_slug', 'course_docs', ['course_id', 'slug'])


def downgrade() -> None:
    for name in ('course_docs', 'course_groups', 'course_sections', 'courses'):
        if not _missing(name):
            if name == 'course_docs':
                op.drop_index('ix_course_docs_course_slug', table_name='course_docs')
            op.drop_table(name)
