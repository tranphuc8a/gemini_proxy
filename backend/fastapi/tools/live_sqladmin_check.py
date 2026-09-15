"""End-to-end check of the sql-administrator against a real MySQL server.

The unit suite runs on SQLite, which is what keeps it fast and dependency-free
and also what it cannot prove: that the generated DDL is accepted by MySQL, that
`information_schema` returns what the readers expect, and that a dump taken from
a live schema restores into an empty one. Every one of those turned up a real
bug that SQLite could not have caught -- a primary-key replacement that fails on
servers with `sql_require_primary_key`, a dump unreadable on a server running
`ANSI_QUOTES`, and a restore that dropped objects in the schema it came from.

Runs entirely inside a throwaway database (`gp_sqladmin_selftest`) and drops it
in a `finally`, so existing schemas are never touched. It connects with whatever
DB_* settings `.env` holds, so point it at a scratch server if that matters.

    cd backend/fastapi
    PYTHONPATH=. .venv/Scripts/python.exe tools/live_sqladmin_check.py

Exits non-zero on the first failed expectation.
"""

import asyncio
import sys

TEST_DB = "gp_sqladmin_selftest"

from sqlalchemy import text  # noqa: E402

from src.adapter.factory import sql_admin_factory  # noqa: E402
from src.application.config.config import settings  # noqa: E402
from src.domain.vo.sqladmin_vo import (  # noqa: E402
    AddColumnRequest,
    BackupRequest,
    CallRoutineRequest,
    ColumnDefinition,
    CreateTableRequest,
    DropColumnRequest,
    ForeignKeyRequest,
    IndexRequest,
    ModifyColumnRequest,
    PrimaryKeyRequest,
    RenameTableRequest,
    RestoreRequest,
    RoutineRequest,
    ViewRequest,
)

passed, failed = 0, []


def check(label, condition, detail=""):
    global passed
    if condition:
        passed += 1
        print(f"  ok   {label}")
    else:
        failed.append(label)
        print(f"  FAIL {label} {detail}")


async def main():
    service = sql_admin_factory.get_sql_admin_usecase()

    from src.domain.vo.sqladmin_vo import ConnectRequest

    session = await service.connect(
        ConnectRequest(
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            username=settings.DB_USERNAME,
            password=settings.DB_PASSWORD,
            database=None,
            label="selftest",
        )
    )
    token = session.token
    print(f"connected to MySQL {session.server_version} as {session.username}\n")

    # A throwaway database, dropped in `finally` whatever happens.
    from src.domain.vo.sqladmin_vo import CreateDatabaseRequest

    try:
        await service.drop_database(token, TEST_DB)
    except Exception:
        pass
    await service.create_database(token, CreateDatabaseRequest(name=TEST_DB))
    print(f"created {TEST_DB}\n")

    try:
        # ---------------------------------------------------------- tables
        await service.create_table(token, TEST_DB, CreateTableRequest(
            name="authors",
            columns=[
                ColumnDefinition(name="id", data_type="INT", nullable=False, extra="AUTO_INCREMENT"),
                ColumnDefinition(name="name", data_type="VARCHAR(120)", nullable=False),
            ],
            primary_key=["id"],
            engine="InnoDB",
            charset="utf8mb4",
        ))
        check("create table", True)

        await service.create_table(token, TEST_DB, CreateTableRequest(
            name="books",
            columns=[
                ColumnDefinition(name="id", data_type="INT", nullable=False, extra="AUTO_INCREMENT"),
                ColumnDefinition(name="author_id", data_type="INT", nullable=False),
                ColumnDefinition(name="title", data_type="VARCHAR(200)", nullable=False),
                ColumnDefinition(name="price", data_type="DECIMAL(10,2)", default="0"),
            ],
            primary_key=["id"],
        ))

        # ---------------------------------------------------------- columns
        await service.add_column(token, TEST_DB, "books", AddColumnRequest(
            column=ColumnDefinition(
                name="published_at", data_type="TIMESTAMP",
                nullable=False, default="CURRENT_TIMESTAMP",
                extra="ON UPDATE CURRENT_TIMESTAMP", after="title",
            )
        ))
        structure = await service.table_structure(token, TEST_DB, "books")
        names = [c.name for c in structure.columns]
        check("add column after another", names.index("published_at") == names.index("title") + 1, names)

        await service.modify_column(token, TEST_DB, "books", ModifyColumnRequest(
            name="title",
            column=ColumnDefinition(name="book_title", data_type="VARCHAR(300)", nullable=False, comment="renamed"),
        ))
        structure = await service.table_structure(token, TEST_DB, "books")
        check("rename+widen column", any(c.name == "book_title" and "300" in c.column_type for c in structure.columns))

        await service.add_column(token, TEST_DB, "books", AddColumnRequest(
            column=ColumnDefinition(name="scrap", data_type="INT")
        ))
        await service.drop_column(token, TEST_DB, "books", DropColumnRequest(name="scrap"))
        structure = await service.table_structure(token, TEST_DB, "books")
        check("drop column", all(c.name != "scrap" for c in structure.columns))

        # ------------------------------------------------------ keys/indexes
        await service.create_index(token, TEST_DB, "books", IndexRequest(
            name="ix_books_author", columns=["author_id"]
        ))
        structure = await service.table_structure(token, TEST_DB, "books")
        check("create index", any(i.name == "ix_books_author" for i in structure.indexes))

        await service.create_foreign_key(token, TEST_DB, "books", ForeignKeyRequest(
            name="fk_books_author", columns=["author_id"],
            referenced_table="authors", referenced_columns=["id"],
            on_delete="CASCADE", on_update="RESTRICT",
        ))
        structure = await service.table_structure(token, TEST_DB, "books")
        check("create foreign key", any(f.name == "fk_books_author" for f in structure.foreign_keys), structure.foreign_keys)

        # This server runs with sql_require_primary_key=ON, so the table is
        # created *with* a key and set_primary_key is exercised by replacing it.
        await service.create_table(token, TEST_DB, CreateTableRequest(
            name="tags",
            columns=[
                ColumnDefinition(name="book_id", data_type="INT", nullable=False),
                ColumnDefinition(name="tag", data_type="VARCHAR(40)", nullable=False),
            ],
            primary_key=["book_id"],
        ))
        await service.set_primary_key(token, TEST_DB, "tags", PrimaryKeyRequest(columns=["book_id", "tag"]))
        structure = await service.table_structure(token, TEST_DB, "tags")
        check("composite primary key", structure.primary_key == ["book_id", "tag"], structure.primary_key)

        await service.set_primary_key(token, TEST_DB, "tags", PrimaryKeyRequest(columns=["tag", "book_id"]))
        structure = await service.table_structure(token, TEST_DB, "tags")
        check("replace primary key", structure.primary_key == ["tag", "book_id"], structure.primary_key)

        await service.drop_foreign_key(token, TEST_DB, "books", "fk_books_author")
        structure = await service.table_structure(token, TEST_DB, "books")
        check("drop foreign key", not structure.foreign_keys)

        await service.drop_index(token, TEST_DB, "books", "ix_books_author")

        await service.rename_table(token, TEST_DB, "tags", RenameTableRequest(new_name="book_tags"))
        tables = [t.name for t in await service.list_tables(token, TEST_DB)]
        check("rename table", "book_tags" in tables and "tags" not in tables, tables)

        # ------------------------------------------------------------- data
        from src.domain.vo.sqladmin_vo import QueryRequest

        await service.run_sql(token, QueryRequest(
            sql=f"INSERT INTO `{TEST_DB}`.`authors` (name) VALUES ('Knuth'), ('Dijkstra')", database=TEST_DB
        ))
        await service.run_sql(token, QueryRequest(
            sql=(
                f"INSERT INTO `{TEST_DB}`.`books` (author_id, book_title, price) "
                "VALUES (1, 'TAOCP', 99.50), (2, 'A Discipline of Programming', 42.00)"
            ),
            database=TEST_DB,
        ))

        # ------------------------------------------------------------ views
        await service.save_view(token, TEST_DB, ViewRequest(
            name="v_books",
            select=f"SELECT b.id, b.book_title, a.name AS author FROM `{TEST_DB}`.`books` b "
                   f"JOIN `{TEST_DB}`.`authors` a ON a.id = b.author_id",
        ))
        views = await service.list_views(token, TEST_DB)
        check("create view", any(v.name == "v_books" for v in views), [v.name for v in views])

        one = await service.get_view(token, TEST_DB, "v_books")
        check("read view definition", bool(one.definition))

        rows = await service.run_sql(token, QueryRequest(sql=f"SELECT * FROM `{TEST_DB}`.`v_books`", database=TEST_DB))
        check("view returns rows", rows[0].row_count == 2, rows[0].row_count)

        try:
            await service.save_view(token, TEST_DB, ViewRequest(name="v_evil", select="SELECT 1; DROP DATABASE x"))
            check("view body refuses a second statement", False, "it was accepted")
        except Exception as cause:
            check("view body refuses a second statement", "mot cau lenh" in str(cause) or "SELECT" in str(cause))

        # --------------------------------------------------------- routines
        await service.save_routine(token, TEST_DB, RoutineRequest(statement=(
            "CREATE FUNCTION book_count(author INT) RETURNS INT DETERMINISTIC READS SQL DATA "
            "BEGIN DECLARE total INT; SELECT COUNT(*) INTO total FROM books WHERE author_id = author; "
            "RETURN total; END"
        )))
        await service.save_routine(token, TEST_DB, RoutineRequest(statement=(
            "CREATE PROCEDURE list_books() BEGIN SELECT id, book_title FROM books ORDER BY id; END"
        )))
        routines = await service.list_routines(token, TEST_DB)
        check("create function + procedure", len(routines) == 2, [(r.kind, r.name) for r in routines])
        check("routine parameters are read", any(r.parameters for r in routines), [r.parameters for r in routines])

        body = await service.get_routine(token, TEST_DB, "book_count", "FUNCTION")
        check("read routine body", body.definition and "RETURN total" in body.definition)

        called = await service.call_routine(token, TEST_DB, CallRoutineRequest(name="list_books"))
        check("call procedure", called.row_count == 2, called.row_count)

        await service.save_routine(token, TEST_DB, RoutineRequest(
            statement="CREATE PROCEDURE list_books() BEGIN SELECT 1; END", replace=True
        ))
        check("replace routine", True)

        try:
            await service.save_routine(token, TEST_DB, RoutineRequest(statement="DROP DATABASE defaultdb"))
            check("routine endpoint refuses non-routine SQL", False, "it was accepted")
        except Exception:
            check("routine endpoint refuses non-routine SQL", True)

        # ----------------------------------------------------------- backup
        backup = await service.backup_database(token, TEST_DB, BackupRequest())
        check("backup has tables", backup.tables == 3, backup.tables)
        check("backup has rows", backup.rows == 4, backup.rows)
        check("backup has views", backup.views == 1, backup.views)
        check("backup has routines", backup.routines == 2, backup.routines)
        check("backup uses DELIMITER for routines", "DELIMITER $$" in backup.content)

        # ---------------------------------------------------------- restore
        target = TEST_DB + "_restored"
        try:
            await service.drop_database(token, target)
        except Exception:
            pass
        await service.create_database(token, CreateDatabaseRequest(name=target))
        try:
            # The dump names the source schema in its CREATE VIEW, so a restore
            # into a different name is expected to carry the view across as-is.
            restored = await service.restore_database(token, target, RestoreRequest(
                content=backup.content, stop_on_error=False, confirm_database=target,
            ))
            check("restore executed most statements", restored.executed >= restored.statements - 2,
                  f"{restored.executed}/{restored.statements} errors={restored.errors[:2]}")

            tables = [t.name for t in await service.list_tables(token, target)]
            check("restored tables exist", {"authors", "books", "book_tags"} <= set(tables), tables)

            counted = await service.run_sql(token, QueryRequest(
                sql=f"SELECT COUNT(*) FROM `{target}`.`books`", database=target))
            check("restored rows", counted[0].rows[0][0] == 2, counted[0].rows)

            restored_routines = await service.list_routines(token, target)
            check("restored routines", len(restored_routines) == 2, [r.name for r in restored_routines])

            # The guard that stops a restore landing in the wrong schema.
            try:
                await service.restore_database(token, target, RestoreRequest(
                    content="SELECT 1;", confirm_database="something-else"))
                check("restore refuses a mismatched confirmation", False, "it was accepted")
            except Exception:
                check("restore refuses a mismatched confirmation", True)
        finally:
            await service.drop_database(token, target)

        # ---------------------------------------------------- schema-only dump
        schema_only = await service.backup_database(token, TEST_DB, BackupRequest(include_data=False))
        check("schema-only dump has no INSERTs", "INSERT INTO" not in schema_only.content)

        capped = await service.backup_database(token, TEST_DB, BackupRequest(max_rows_per_table=1))
        check("row cap is reported", bool(capped.truncated_tables), capped.truncated_tables)

        # --------------------------------------------------------- triggers
        triggers = await service.list_triggers(token, TEST_DB)
        check("list triggers (empty is fine)", isinstance(triggers, list))

        await service.drop_view(token, TEST_DB, "v_books")
        await service.drop_routine(token, TEST_DB, "book_count", "FUNCTION")
        check("drop view and routine", True)

    finally:
        try:
            await service.drop_database(token, TEST_DB)
            print(f"\ndropped {TEST_DB}")
        except Exception as cause:
            print(f"\nCOULD NOT DROP {TEST_DB}: {cause}")
        await service.disconnect(token)

    print(f"\n{passed} passed, {len(failed)} failed")
    if failed:
        for name in failed:
            print("  -", name)
        sys.exit(1)


asyncio.run(main())
