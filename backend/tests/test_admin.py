"""Organizer auth, admin endpoints and QR verification tests."""

from __future__ import annotations

from tests.conftest import auth_headers, make_attendee_payload, register_attendee


class TestAuth:
    def test_login_success(self, client, admin_token):
        # admin_token fixture already proves login works; verify /me too.
        res = client.get("/api/v1/auth/me", headers=auth_headers(admin_token))
        assert res.status_code == 200
        assert res.json()["role"] == "admin"

    def test_login_wrong_password(self, client, organizer_credentials):
        from app.models import Organizer
        from app.core.security import hash_password
        from tests.conftest import TestingSessionLocal
        import uuid
        with TestingSessionLocal() as db:
            db.add(Organizer(id=uuid.uuid4(), full_name="A", email="x@y.z",
                             password_hash=hash_password("right"), role="admin", is_active=True))
            db.commit()
        res = client.post("/api/v1/auth/login",
                          json={"email": "x@y.z", "password": "wrong"})
        assert res.status_code == 401
        assert res.json()["detail"]["code"] == "not_authenticated"

    def test_admin_endpoint_requires_auth(self, client):
        for path in ("/api/v1/admin/registrations", "/api/v1/admin/stats",
                     "/api/v1/admin/spouse-invitations", "/api/v1/admin/audit-log"):
            res = client.get(path)
            assert res.status_code == 401, path
            assert res.json()["detail"]["code"] == "not_authenticated"

    def test_invalid_token_401(self, client):
        res = client.get("/api/v1/admin/stats",
                         headers={"Authorization": "Bearer not.a.token"})
        assert res.status_code == 401

    def test_organizer_role_cannot_delete(self, client, staff_token):
        rid = register_attendee(client)["registration"]["registration_id"]
        res = client.delete(f"/api/v1/admin/registrations/{rid}",
                            headers=auth_headers(staff_token))
        assert res.status_code == 403
        assert res.json()["detail"]["code"] == "forbidden"


class TestAdminEndpoints:
    def test_list_registrations(self, client, admin_token):
        register_attendee(client, email="one@example.com")
        register_attendee(client, email="two@example.com", gender="female",
                          full_name="Ada Okafor")
        res = client.get("/api/v1/admin/registrations?per_page=10",
                         headers=auth_headers(admin_token))
        assert res.status_code == 200
        body = res.json()
        assert body["total"] == 2
        assert len(body["items"]) == 2
        # Admin view includes private fields.
        assert "expectations" in body["items"][0]

    def test_list_filter_by_gender_and_search(self, client, admin_token):
        register_attendee(client, email="one@example.com")
        register_attendee(client, email="two@example.com", gender="female",
                          full_name="Ada Okafor")
        res = client.get("/api/v1/admin/registrations?gender=female",
                         headers=auth_headers(admin_token))
        assert res.json()["total"] == 1
        res = client.get("/api/v1/admin/registrations?q=ada",
                         headers=auth_headers(admin_token))
        assert res.json()["total"] == 1

    def test_get_single_and_update_status(self, client, admin_token):
        rid = register_attendee(client)["registration"]["registration_id"]
        res = client.get(f"/api/v1/admin/registrations/{rid}",
                         headers=auth_headers(admin_token))
        assert res.status_code == 200
        assert res.json()["registration_id"] == rid
        res = client.patch(f"/api/v1/admin/registrations/{rid}",
                           json={"status": "checked_in"}, headers=auth_headers(admin_token))
        assert res.status_code == 200
        assert res.json()["status"] == "checked_in"

    def test_stats(self, client, admin_token):
        register_attendee(client, email="one@example.com")
        register_attendee(client, email="two@example.com", gender="female",
                          marital_status="single")
        res = client.get("/api/v1/admin/stats", headers=auth_headers(admin_token))
        assert res.status_code == 200
        body = res.json()
        assert body["total"] == 2
        assert body["male"] == 1
        assert body["female"] == 1
        assert body["single"] == 1
        assert body["married"] == 1
        assert len(body["by_day"]) == 14

    def test_qr_verify(self, client, admin_token):
        created = register_attendee(client)
        reg = created["registration"]
        res = client.post("/api/v1/admin/qr/verify",
                          json={"qr_payload": reg["qr_payload"]},
                          headers=auth_headers(admin_token))
        assert res.status_code == 200
        body = res.json()
        assert body["valid"] is True
        assert body["registration_id"] == reg["registration_id"]
        # Invalid payload
        res = client.post("/api/v1/admin/qr/verify",
                          json={"qr_payload": "SMS26|SMS26-ZZZZ-9999"},
                          headers=auth_headers(admin_token))
        assert res.json()["valid"] is False
        # QR verify requires auth
        res = client.post("/api/v1/admin/qr/verify", json={"qr_payload": reg["qr_payload"]})
        assert res.status_code == 401

    def test_csv_export(self, client, admin_token):
        register_attendee(client)
        res = client.get("/api/v1/admin/registrations/export",
                         headers=auth_headers(admin_token))
        assert res.status_code == 200
        assert "text/csv" in res.headers["content-type"]
        lines = res.text.strip().splitlines()
        assert lines[0] == ("registration_id,full_name,email,phone,gender,marital_status,"
                            "occupation,age_range,city,status,spouse_registration_id,created_at")
        assert len(lines) == 2

    def test_delete_detaches_spouse_not_deletes(self, client, admin_token):
        from tests.conftest import auth_headers as ah
        rid1 = register_attendee(client)["registration"]["registration_id"]
        invite_res = client.post("/api/v1/spouse-invitations", json={"registration_id": rid1})
        token = invite_res.json()["token"]
        client.post(f"/api/v1/spouse-invitations/{token}/accept",
                    json={"mode": "new", "registration": make_attendee_payload(
                        full_name="Adaeze Okafor", email="adaeze@example.com",
                        gender="female", phone="+234 803 123 4568")})
        spouse = client.get(f"/api/v1/registrations/{rid1}").json()["spouse"]
        rid2 = spouse["registration_id"]

        res = client.delete(f"/api/v1/admin/registrations/{rid1}",
                            headers=ah(admin_token))
        assert res.status_code == 200
        assert res.json()["ok"] is True
        # Spouse record still exists, link detached.
        res = client.get(f"/api/v1/registrations/{rid2}")
        assert res.status_code == 200
        assert res.json()["spouse"] is None
        # Deleted registration is gone.
        assert client.get(f"/api/v1/registrations/{rid1}").status_code == 404

    def test_audit_log_records_status_change(self, client, admin_token):
        rid = register_attendee(client)["registration"]["registration_id"]
        client.patch(f"/api/v1/admin/registrations/{rid}",
                     json={"status": "checked_in"}, headers=auth_headers(admin_token))
        res = client.get("/api/v1/admin/audit-log", headers=auth_headers(admin_token))
        assert res.status_code == 200
        actions = [item["action"] for item in res.json()]
        assert "registration.checked_in" in actions
