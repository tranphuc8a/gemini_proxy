"""Generic Alembic script template used by alembic.
This file is included as a simple placeholder so `alembic init` style layout is complete.
"""

<%text>
Revision ID: ${up_revision}
Revises: ${down_revision or None}
Create Date: ${create_datetime}
</%text>

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = ${repr(up_revision)}
down_revision = ${repr(down_revision)}
branch_labels = None
def upgrade():
    pass

def downgrade():
    pass
