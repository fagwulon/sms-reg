"""Transaction helper.

SQLAlchemy sessions autobegin on first use, so `Session.begin()` raises
"transaction already begun". This helper commits on success and rolls back
on any exception (including ApiError), giving atomic behaviour for
multi-step operations like registration and invitation acceptance.
"""

from __future__ import annotations

from contextlib import contextmanager

from sqlalchemy.orm import Session


@contextmanager
def transaction(db: Session):
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
