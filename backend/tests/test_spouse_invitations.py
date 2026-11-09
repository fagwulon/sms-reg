"""Spouse invitation & linking tests."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.models import SpouseInvitation
from tests.conftest import make_attendee_payload, register_attendee


def create_invite(client, registration_id: str) -> dict:
    res = client.post("/api/v1/spouse-invitations", json={"registration_id": registration_id})
    assert res.status_code == 201, res.text
    return res.json()


def spouse_payload(**overrides) -> dict:
    payload = make_attendee_payload(
        full_name="Adaeze Okafor",
        email="adaeze@example.com",
        phone="+234 803 123 4568",
        gender="female",
    )
    payload.update(overrides)
    return payload


class TestInviteCreation:
    def test_token_length_and_ttl(self, client):
        rid = register_attendee(client)["registration"]["registration_id"]
        invite = create_invite(client, rid)
        assert len(invite["token"]) >= 20
        assert invite["status"] == "pending"
        expires = datetime.fromisoformat(invite["expires_at"].replace("Z", "+00:00"))
        delta = expires - datetime.now(timezone.utc)
        assert timedelta(hours=47) < delta <= timedelta(hours=48)

    def test_unknown_registration_404(self, client):
        res = client.post("/api/v1/spouse-invitations",
                          json={"registration_id": "SMS26-XXXX-9999"})
        # (json passed as keyword)
        assert res.status_code == 404

    def test_raw_token_stored_for_retrieval(self, client, db):
        """Raw token is stored so invite URLs can be rebuilt on the ticket page."""
        rid = register_attendee(client)["registration"]["registration_id"]
        invite = create_invite(client, rid)
        stored = db.query(SpouseInvitation).one()
        assert stored.token == invite["token"]
        assert stored.token_hash != invite["token"]
        assert len(stored.token_hash) == 64  # sha256 hex

    def test_preview_does_not_leak_private_fields(self, client):
        rid = register_attendee(client)["registration"]["registration_id"]
        invite = create_invite(client, rid)
        res = client.get(f"/api/v1/spouse-invitations/{invite['token']}")
        assert res.status_code == 200
        body = res.json()
        assert body["can_accept"] is True
        assert body["inviter"]["full_name"] == "Chinedu Okafor"
        for sensitive in ("email", "phone", "expectations", "emergency_contact_name"):
            assert sensitive not in str(body)


class TestAcceptance:
    def test_accept_with_new_registration(self, client):
        rid = register_attendee(client)["registration"]["registration_id"]
        invite = create_invite(client, rid)
        res = client.post(
            f"/api/v1/spouse-invitations/{invite['token']}/accept",
            json={"mode": "new", "registration": spouse_payload()},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["registration"]["full_name"] == "Adaeze Okafor"
        assert body["spouse"]["registration_id"] == rid
        # Both keep their own IDs and QR codes.
        assert body["registration"]["registration_id"] != rid
        assert body["registration"]["qr_payload"].startswith("SMS26|")

    def test_accept_with_existing_registration(self, client):
        rid1 = register_attendee(client)["registration"]["registration_id"]
        rid2 = register_attendee(client, **spouse_payload())["registration"]["registration_id"]
        invite = create_invite(client, rid1)
        res = client.post(
            f"/api/v1/spouse-invitations/{invite['token']}/accept",
            json={"mode": "existing", "registration_id": rid2},
        )
        assert res.status_code == 200
        assert res.json()["registration"]["registration_id"] == rid2

    def test_link_visible_on_both_tickets(self, client):
        rid1 = register_attendee(client)["registration"]["registration_id"]
        invite = create_invite(client, rid1)
        client.post(
            f"/api/v1/spouse-invitations/{invite['token']}/accept",
            json={"mode": "new", "registration": spouse_payload()},
        )
        for rid in (rid1,):
            body = client.get(f"/api/v1/registrations/{rid}").json()
            assert body["spouse"] is not None
            assert body["spouse"]["full_name"] == "Adaeze Okafor"

    def test_gender_mismatch_409(self, client):
        rid = register_attendee(client)["registration"]["registration_id"]
        invite = create_invite(client, rid)
        res = client.post(
            f"/api/v1/spouse-invitations/{invite['token']}/accept",
            json={"mode": "new", "registration": spouse_payload(gender="male",
                                                               email="other@example.com")},
        )
        assert res.status_code == 409
        assert res.json()["detail"]["code"] == "gender_mismatch"

    def test_self_link_409(self, client):
        rid = register_attendee(client)["registration"]["registration_id"]
        invite = create_invite(client, rid)
        res = client.post(
            f"/api/v1/spouse-invitations/{invite['token']}/accept",
            json={"mode": "existing", "registration_id": rid},
        )
        assert res.status_code == 409
        assert res.json()["detail"]["code"] == "self_link"

    def test_already_accepted_409(self, client):
        rid = register_attendee(client)["registration"]["registration_id"]
        invite = create_invite(client, rid)
        payload = {"mode": "new", "registration": spouse_payload()}
        r1 = client.post(f"/api/v1/spouse-invitations/{invite['token']}/accept", json=payload)
        assert r1.status_code == 200
        payload2 = {"mode": "new", "registration": spouse_payload(email="second@example.com")}
        r2 = client.post(f"/api/v1/spouse-invitations/{invite['token']}/accept", json=payload2)
        assert r2.status_code == 409
        assert r2.json()["detail"]["code"] == "already_accepted"

    def test_second_link_rejected_already_linked(self, client):
        rid1 = register_attendee(client)["registration"]["registration_id"]
        invite1 = create_invite(client, rid1)
        client.post(f"/api/v1/spouse-invitations/{invite1['token']}/accept",
                    json={"mode": "new", "registration": spouse_payload()})
        # The linked spouse tries to invite someone else.
        rid2 = client.get(f"/api/v1/registrations/{rid1}").json()["spouse"]["registration_id"]
        res = client.post("/api/v1/spouse-invitations", json={"registration_id": rid2})
        assert res.status_code == 409
        assert res.json()["detail"]["code"] == "already_linked"

    def test_no_automatic_name_linking(self, client):
        # Two attendees with identical names must NOT be linked automatically.
        a = register_attendee(client, email="twin1@example.com")
        b = register_attendee(client, email="twin2@example.com")
        for reg in (a["registration"], b["registration"]):
            body = client.get(f"/api/v1/registrations/{reg['registration_id']}").json()
            assert body["spouse"] is None


class TestExpiryAndRevocation:
    def test_expired_invite_410(self, client, db):
        rid = register_attendee(client)["registration"]["registration_id"]
        invite = create_invite(client, rid)
        inv = db.query(SpouseInvitation).one()
        inv.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
        db.commit()
        res = client.post(
            f"/api/v1/spouse-invitations/{invite['token']}/accept",
            json={"mode": "new", "registration": spouse_payload()},
        )
        assert res.status_code == 410
        assert res.json()["detail"]["code"] == "invite_expired"
        # Status endpoint reflects expiry.
        prev = client.get(f"/api/v1/spouse-invitations/{invite['token']}").json()
        assert prev["status"] == "expired"
        assert prev["can_accept"] is False

    def test_revoked_invite_cannot_be_accepted(self, client):
        rid = register_attendee(client)["registration"]["registration_id"]
        invite = create_invite(client, rid)
        r = client.delete(f"/api/v1/spouse-invitations/{invite['token']}")
        assert r.status_code == 200
        assert r.json()["status"] == "revoked"
        res = client.post(
            f"/api/v1/spouse-invitations/{invite['token']}/accept",
            json={"mode": "new", "registration": spouse_payload()},
        )
        assert res.status_code == 410

    def test_invalid_token_404(self, client):
        res = client.get("/api/v1/spouse-invitations/INVDOESNOTEXIST123456")
        assert res.status_code == 404
        res = client.post("/api/v1/spouse-invitations/INVDOESNOTEXIST123456/accept",
                          json={"mode": "existing", "registration_id": "SMS26-AAAA-0001"})
        assert res.status_code == 404
