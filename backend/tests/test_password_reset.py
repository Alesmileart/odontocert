# Password reset (forgot/reset) flow tests - OdontoCert
import os
import time
import uuid
import hashlib
import secrets
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

BASE_URL = (os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"
RESET_EMAIL = "delivered@resend.dev"
ORIG_PW = "newpass1"
FORGOT_MSG = "Se l'email esiste, riceverai un link per reimpostare la password."

mongo = MongoClient(os.environ["MONGO_URL"])
db = mongo[os.environ["DB_NAME"]]


def sha(t):
    return hashlib.sha256(t.encode()).hexdigest()


def get_user():
    return db.users.find_one({"email": RESET_EMAIL})


def insert_token(user_id, expires_delta=timedelta(hours=1), used=False):
    token = "TEST_" + secrets.token_urlsafe(32)
    db.password_resets.insert_one({
        "id": "TEST_" + str(uuid.uuid4()),
        "user_id": user_id,
        "token_hash": sha(token),
        "created_at": "2000-01-01T00:00:00+00:00",
        "expires_at": (datetime.now(timezone.utc) + expires_delta).isoformat(),
        "used": used,
    })
    return token


def login(email, pw):
    return requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=20)


def reset(token, pw):
    return requests.post(f"{API}/auth/reset-password", json={"token": token, "password": pw}, timeout=20)


@pytest.fixture(scope="module", autouse=True)
def restore_password():
    u = get_user()
    if not u:
        pytest.skip("delivered@resend.dev not present")
    yield
    # Restore password to newpass1 via reset flow
    u = get_user()
    t = insert_token(u["id"])
    r = reset(t, ORIG_PW)
    assert r.status_code == 200
    assert login(RESET_EMAIL, ORIG_PW).status_code == 200
    db.password_resets.delete_many({"id": {"$regex": "^TEST_"}})


# --- Login regression
class TestLogin:
    def test_login_tecnico(self):
        r = login("tecnico@lab.it", "password123")
        assert r.status_code == 200
        d = r.json()
        assert d["access_token"] and d["user"]["email"] == "tecnico@lab.it"

    def test_login_wrong_pw(self):
        assert login("tecnico@lab.it", "wrongpw").status_code == 401


# --- forgot-password: anti enumeration
class TestForgot:
    def test_same_message_existing_and_nonexisting(self):
        r1 = requests.post(f"{API}/auth/forgot-password", json={"email": RESET_EMAIL}, timeout=20)
        r2 = requests.post(f"{API}/auth/forgot-password", json={"email": f"nobody_{uuid.uuid4().hex[:6]}@example.com"}, timeout=20)
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json() == r2.json() == {"message": FORGOT_MSG}

    def test_token_stored_hashed_and_throttled(self):
        u = get_user()
        time.sleep(3)
        docs = list(db.password_resets.find({"user_id": u["id"], "created_at": {"$gt": (datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat()}}))
        assert len(docs) >= 1, "no reset record created"
        d = docs[-1]
        assert len(d["token_hash"]) == 64 and all(c in "0123456789abcdef" for c in d["token_hash"])
        assert "token" not in d
        exp = datetime.fromisoformat(d["expires_at"]) - datetime.fromisoformat(d["created_at"])
        assert timedelta(minutes=59) < exp <= timedelta(hours=1, seconds=1)
        # Throttle: second request within a minute creates no new record
        n_before = db.password_resets.count_documents({"user_id": u["id"]})
        r = requests.post(f"{API}/auth/forgot-password", json={"email": RESET_EMAIL.upper()}, timeout=20)
        assert r.status_code == 200 and r.json()["message"] == FORGOT_MSG
        time.sleep(3)
        assert db.password_resets.count_documents({"user_id": u["id"]}) == n_before

    def test_new_request_invalidates_previous(self):
        u = get_user()
        old = insert_token(u["id"])
        # remove recent records to bypass throttle
        db.password_resets.update_many({"user_id": u["id"], "created_at": {"$gt": "2001"}}, {"$set": {"created_at": "2000-01-01T00:00:00+00:00"}})
        r = requests.post(f"{API}/auth/forgot-password", json={"email": RESET_EMAIL}, timeout=20)
        assert r.status_code == 200
        time.sleep(4)
        rec = db.password_resets.find_one({"token_hash": sha(old)})
        assert rec["used"] is True
        assert reset(old, "whatever1").status_code == 400

    def test_invalid_email_format(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": "notanemail"}, timeout=20)
        assert r.status_code == 422


# --- reset-password
class TestReset:
    def test_invalid_token(self):
        r = reset("TEST_invalid_token_xyz123", "abcdef1")
        assert r.status_code == 400
        assert "non valido" in r.json()["detail"]

    def test_expired_token(self):
        t = insert_token(get_user()["id"], expires_delta=timedelta(minutes=-5))
        assert reset(t, "abcdef1").status_code == 400

    def test_short_password(self):
        t = insert_token(get_user()["id"])
        assert reset(t, "abc").status_code == 422
        # token not consumed by validation failure
        assert db.password_resets.find_one({"token_hash": sha(t)})["used"] is False

    def test_valid_reset_single_use(self):
        t = insert_token(get_user()["id"])
        r = reset(t, "TESTnewpw9")
        assert r.status_code == 200
        assert "Password aggiornata" in r.json()["message"]
        assert reset(t, "TESTanother9").status_code == 400
        assert login(RESET_EMAIL, ORIG_PW).status_code == 401
        assert login(RESET_EMAIL, "TESTnewpw9").status_code == 200
