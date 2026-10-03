"""Database inspection checks migrated from the executable pg/Prisma scripts."""

import os

import pytest


def _connect_to_test_database():
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        pytest.skip("DATABASE_URL is required for database checks")

    try:
        import psycopg
    except ImportError:
        try:
            import psycopg2 as psycopg
        except ImportError:
            pytest.skip("Install psycopg or psycopg2 to run database checks")
    return psycopg.connect(dsn)


@pytest.mark.integration
def test_topics_table_has_columns():
    connection = _connect_to_test_database()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = %s AND table_schema = current_schema()",
                ("topics",),
            )
            columns = {row[0] for row in cursor.fetchall()}
        assert columns, "The topics table should expose at least one column"
    finally:
        connection.close()


@pytest.mark.integration
def test_units_table_can_be_queried():
    connection = _connect_to_test_database()
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT id, name FROM "units" LIMIT 1')
            row = cursor.fetchone()
        assert row is None or len(row) == 2
    finally:
        connection.close()


@pytest.mark.integration
def test_notifications_table_can_be_counted_and_optional_user_can_be_inspected():
    connection = _connect_to_test_database()
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT COUNT(*) FROM "Notification"')
            total_notifications = cursor.fetchone()[0]
            assert total_notifications >= 0

            username = os.getenv("BACKEND_TEST_NOTIFICATION_USERNAME")
            if username:
                cursor.execute(
                    'SELECT "User".id, "User".email, COUNT("Notification".id) '
                    'FROM "User" LEFT JOIN "Notification" '
                    'ON "Notification"."userId" = "User".id '
                    'WHERE "User".username = %s '
                    'GROUP BY "User".id, "User".email',
                    (username,),
                )
                user_row = cursor.fetchone()
                assert user_row is None or len(user_row) == 3
    finally:
        connection.close()


@pytest.mark.integration
def test_seeded_analytics_tables_are_queryable():
    connection = _connect_to_test_database()
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT id FROM "User" LIMIT 1')
            cursor.fetchone()
            cursor.execute('SELECT id FROM "QuizAttempt" LIMIT 1')
            cursor.fetchone()
            cursor.execute('SELECT id FROM "StudySession" LIMIT 1')
            cursor.fetchone()
    finally:
        connection.close()
