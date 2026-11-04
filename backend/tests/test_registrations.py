"""Registration endpoint tests."""

from __future__ import annotations

from tests.conftest import make_attendee_payload, register_attendee


class TestSuccessfulRegistration:
    def test_returns_201_with_contract_shape(self, client):
        res = client.post("/api/v1/registrations", json=make_attendee_payload())
        assert res.status_code == 201
        body = res.json()
        assert body["message"] == "Registration successful."
        reg = body["registration"]
        assert reg["registration_id"].startswith("SMS26-")
        assert reg["qr_payload"] == f"SMS26|{reg['registration_id']}"
        assert reg["status"] == "registered"
        assert reg["full_name"] == "Chinedu Okafor"
        assert body["spouse_invite"] is None

    def test_registration_ids_are_unique(self, client):
        ids = set()
        for i in range(50):
            body = register_attendee(client, email=f"user{i}@example.com")
            ids.add(body["registration"]["registration_id"])
        assert len(ids) == 50

    def test_each_attendee_gets_individual_qr(self, client):
        a = register_attendee(client, email="a@example.com")
        b = register_attendee(client, email="b@example.com",
                              full_name="Ada Okafor", gender="female")
        assert a["registration"]["qr_payload"] != b["registration"]["qr_payload"]

    def test_wants_spouse_invite_creates_invite(self, client):
        res = client.post(
            "/api/v1/registrations",
            json=make_attendee_payload(wants_spouse_invite=True),
        )
        assert res.status_code == 201
        invite = res.json()["spouse_invite"]
        assert invite is not None
        assert len(invite["token"]) >= 20
        assert invite["status"] == "pending"
        assert "token=" in invite["invite_url"]


class TestValidation:
    def test_missing_required_fields(self, client):
        res = client.post("/api/v1/registrations", json={})
        assert res.status_code == 422
        fields = res.json()["detail"]["fields"]
        for f in ("full_name", "email", "phone", "gender", "marital_status"):
            assert f in fields

    def test_invalid_email(self, client):
        res = client.post("/api/v1/registrations",
                          json=make_attendee_payload(email="not-an-email"))
        assert res.status_code == 422
        assert "email" in res.json()["detail"]["fields"]

    def test_invalid_phone(self, client):
        res = client.post("/api/v1/registrations",
                          json=make_attendee_payload(phone="abc"))
        assert res.status_code == 422
        assert "phone" in res.json()["detail"]["fields"]

    def test_invalid_gender_rejected(self, client):
        res = client.post("/api/v1/registrations",
                          json=make_attendee_payload(gender="other"))
        assert res.status_code == 422
        assert "gender" in res.json()["detail"]["fields"]

    def test_prefer_not_to_say_not_allowed(self, client):
        res = client.post("/api/v1/registrations",
                          json=make_attendee_payload(gender="prefer not to say"))
        assert res.status_code == 422

    def test_invalid_marital_status(self, client):
        res = client.post("/api/v1/registrations",
                          json=make_attendee_payload(marital_status="complicated"))
        assert res.status_code == 422
        assert "marital_status" in res.json()["detail"]["fields"]

    def test_duplicate_email_409(self, client):
        register_attendee(client, email="dup@example.com")
        res = client.post("/api/v1/registrations",
                          json=make_attendee_payload(email="DUP@example.com"))
        assert res.status_code == 409
        body = res.json()["detail"]
        assert body["code"] == "duplicate_email"
        assert "email" in body["fields"]


class TestRetrieval:
    def test_get_registration_public_fields_only(self, client):
        created = register_attendee(client)
        rid = created["registration"]["registration_id"]
        res = client.get(f"/api/v1/registrations/{rid.lower()}")  # case-insensitive
        assert res.status_code == 200
        body = res.json()
        assert body["registration_id"] == rid
        # Privacy: sensitive fields must not leak on the public endpoint.
        for sensitive in ("expectations", "emergency_contact_name",
                          "emergency_contact_phone", "email", "phone"):
            assert sensitive not in body

    def test_get_registration_not_found(self, client):
        res = client.get("/api/v1/registrations/SMS26-ZZZZ-9999")
        assert res.status_code == 404
        assert res.json()["detail"]["code"] == "not_found"

    def test_confirmation_endpoint(self, client):
        created = register_attendee(client)
        rid = created["registration"]["registration_id"]
        res = client.get(f"/api/v1/registrations/{rid}/confirmation")
        assert res.status_code == 200
        body = res.json()
        assert body["registration_id"] == rid
        assert body["qr_payload"] == f"SMS26|{rid}"


class TestCheckIn:
    def test_checkin_idempotent(self, client):
        rid = register_attendee(client)["registration"]["registration_id"]
        r1 = client.post(f"/api/v1/registrations/{rid}/checkin")
        assert r1.status_code == 200
        assert r1.json()["status"] == "checked_in"
        r2 = client.post(f"/api/v1/registrations/{rid}/checkin")
        assert r2.status_code == 200
        assert r2.json()["status"] == "checked_in"

    def test_checkin_cancelled_409(self, client, admin_token, db):
        from tests.conftest import auth_headers
        rid = register_attendee(client)["registration"]["registration_id"]
        res = client.patch(f"/api/v1/admin/registrations/{rid}",
                           json={"status": "cancelled"}, headers=auth_headers(admin_token))
        assert res.status_code == 200
        r = client.post(f"/api/v1/registrations/{rid}/checkin")
        assert r.status_code == 409
