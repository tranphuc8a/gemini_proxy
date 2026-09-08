import os

os.environ.setdefault("TESTING", "1")

from fastapi.testclient import TestClient

from src.main import app


def test_admin_login_page_is_available():
    response = TestClient(app).get("/admin/login")

    assert response.status_code == 200
    assert "username" in response.text