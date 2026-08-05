"""OdontoCert API integration tests - Auth, Profile, Clients, Materials, Declarations, Dashboard."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://odonto-declarations.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ----------------------- Fixtures -----------------------
@pytest.fixture(scope="session")
def unique_email():
    return f"TEST_{uuid.uuid4().hex[:10]}@lab.it"


@pytest.fixture(scope="session")
def auth(unique_email):
    """Signup a fresh user and return {token, user}."""
    r = requests.post(f"{API}/auth/signup", json={
        "email": unique_email, "password": "password123", "name": "TEST Tecnico"
    })
    assert r.status_code == 201, r.text
    data = r.json()
    return {"token": data["access_token"], "user": data["user"], "email": unique_email}


@pytest.fixture
def headers(auth):
    return {"Authorization": f"Bearer {auth['token']}", "Content-Type": "application/json"}


# ----------------------- Auth tests -----------------------
class TestAuth:
    def test_root(self):
        r = requests.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("message") == "OdontoCert API"

    def test_signup_returns_token_and_user(self, auth):
        assert auth["token"]
        assert auth["user"]["email"] == auth["email"].lower()
        assert auth["user"]["name"] == "TEST Tecnico"
        assert "id" in auth["user"]

    def test_signup_duplicate_email_409(self, auth):
        r = requests.post(f"{API}/auth/signup", json={
            "email": auth["email"], "password": "password123", "name": "Dup"
        })
        assert r.status_code == 409

    def test_login_success(self, auth):
        r = requests.post(f"{API}/auth/login", json={
            "email": auth["email"], "password": "password123"
        })
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_login_invalid_401(self, auth):
        r = requests.post(f"{API}/auth/login", json={
            "email": auth["email"], "password": "wrongpw"
        })
        assert r.status_code == 401

    def test_me_with_token(self, auth, headers):
        r = requests.get(f"{API}/auth/me", headers=headers)
        assert r.status_code == 200
        assert r.json()["email"] == auth["email"].lower()

    def test_me_without_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code in (401, 403)


# ----------------------- Profile tests -----------------------
class TestProfile:
    def test_get_empty_profile(self, headers):
        r = requests.get(f"{API}/profile", headers=headers)
        assert r.status_code == 200
        data = r.json()
        # signup creates empty profile
        assert "lab_name" in data

    def test_update_and_persist_profile(self, headers):
        payload = {
            "lab_name": "TEST Laboratorio Rossi",
            "responsible_person": "Mario Rossi",
            "address": "Via Roma 1",
            "city": "Milano",
            "vat": "IT01234567890",
            "registration_number": "REG-TEST-001",
            "phone": "+39 02 1234567",
            "email": "info@lab.test",
            "logo_base64": "",
        }
        r = requests.put(f"{API}/profile", headers=headers, json=payload)
        assert r.status_code == 200
        # verify persistence
        r2 = requests.get(f"{API}/profile", headers=headers)
        assert r2.status_code == 200
        got = r2.json()
        assert got["lab_name"] == payload["lab_name"]
        assert got["vat"] == payload["vat"]


# ----------------------- Clients tests -----------------------
class TestClients:
    def test_crud_client(self, headers):
        # create
        r = requests.post(f"{API}/clients", headers=headers, json={
            "name": "TEST Studio Bianchi", "clinic": "Bianchi", "vat": "IT99999999999",
            "email": "b@x.it", "phone": "0000", "address": "Via A 1"
        })
        assert r.status_code == 201, r.text
        client = r.json()
        assert client["name"] == "TEST Studio Bianchi"
        cid = client["id"]

        # list
        r = requests.get(f"{API}/clients", headers=headers)
        assert r.status_code == 200
        assert any(c["id"] == cid for c in r.json())

        # update
        r = requests.put(f"{API}/clients/{cid}", headers=headers, json={
            "name": "TEST Studio Bianchi UP", "clinic": "B", "vat": "", "email": "", "phone": "", "address": ""
        })
        assert r.status_code == 200
        assert r.json()["name"] == "TEST Studio Bianchi UP"

        # delete
        r = requests.delete(f"{API}/clients/{cid}", headers=headers)
        assert r.status_code == 200
        # verify deletion
        r = requests.get(f"{API}/clients", headers=headers)
        assert not any(c["id"] == cid for c in r.json())

    def test_update_nonexistent_client_404(self, headers):
        r = requests.put(f"{API}/clients/{uuid.uuid4()}", headers=headers, json={
            "name": "x", "clinic": "", "vat": "", "email": "", "phone": "", "address": ""
        })
        assert r.status_code == 404


# ----------------------- Materials tests -----------------------
class TestMaterials:
    def test_crud_material(self, headers):
        r = requests.post(f"{API}/materials", headers=headers, json={
            "name": "TEST Zirconia HT", "manufacturer": "Ivoclar",
            "ce_number": "CE-1234", "lot_default": "L001", "category": "ceramica"
        })
        assert r.status_code == 201, r.text
        mid = r.json()["id"]

        r = requests.get(f"{API}/materials", headers=headers)
        assert any(m["id"] == mid for m in r.json())

        r = requests.put(f"{API}/materials/{mid}", headers=headers, json={
            "name": "TEST Zirconia HT v2", "manufacturer": "Ivoclar",
            "ce_number": "CE-1234", "lot_default": "L002", "category": "ceramica"
        })
        assert r.status_code == 200
        assert r.json()["lot_default"] == "L002"

        r = requests.delete(f"{API}/materials/{mid}", headers=headers)
        assert r.status_code == 200


# ----------------------- Declarations tests -----------------------
class TestDeclarations:
    def test_create_draft_without_signature(self, headers):
        payload = {
            "client_snapshot": {"name": "TEST Cliente", "vat": "IT00"},
            "patient_ref": "P-TEST-1",
            "device_type": "Corona",
            "device_description": "Corona in zirconia 2.1",
            "materials": [{"name": "Zirconia", "manufacturer": "X", "ce_number": "CE1", "lot": "L1"}],
            "conformity": {"mdr_2017_745": True, "biocompatible": True, "single_patient": True,
                           "made_to_prescription": True, "notes": ""},
            "technician_name": "TEST Tecnico",
            "signature_base64": "",
        }
        r = requests.post(f"{API}/declarations", headers=headers, json=payload)
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["status"] == "draft"
        assert d["number"].startswith("DC-")
        assert d["issue_date"]
        assert "_id" not in d
        assert "user_id" not in d
        return d["id"]

    def test_create_issued_with_signature_and_flow(self, headers):
        payload = {
            "client_snapshot": {"name": "TEST Cliente 2"},
            "device_type": "Ponte",
            "device_description": "Ponte 3 elementi",
            "materials": [],
            "signature_base64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
            "technician_name": "TEST Tecnico",
        }
        r = requests.post(f"{API}/declarations", headers=headers, json=payload)
        assert r.status_code == 201
        d = r.json()
        assert d["status"] == "issued"
        did = d["id"]
        number = d["number"]
        assert number.startswith("DC-")

        # list
        r = requests.get(f"{API}/declarations", headers=headers)
        assert r.status_code == 200
        lst = r.json()
        assert any(x["id"] == did for x in lst)

        # get by id
        r = requests.get(f"{API}/declarations/{did}", headers=headers)
        assert r.status_code == 200
        got = r.json()
        assert got["number"] == number
        assert "_id" not in got

        # delete
        r = requests.delete(f"{API}/declarations/{did}", headers=headers)
        assert r.status_code == 200
        r = requests.get(f"{API}/declarations/{did}", headers=headers)
        assert r.status_code == 404

    def test_auto_numbering_sequence(self, headers):
        # create two more and check numbers are sequential
        base = {
            "client_snapshot": {"name": "TEST Seq"},
            "device_type": "Corona",
            "device_description": "seq",
            "materials": [],
            "signature_base64": "",
            "technician_name": "T",
        }
        r1 = requests.post(f"{API}/declarations", headers=headers, json=base)
        r2 = requests.post(f"{API}/declarations", headers=headers, json=base)
        assert r1.status_code == 201 and r2.status_code == 201
        n1 = int(r1.json()["number"].split("-")[-1])
        n2 = int(r2.json()["number"].split("-")[-1])
        assert n2 == n1 + 1


# ----------------------- Dashboard tests -----------------------
class TestDashboard:
    def test_stats(self, headers):
        r = requests.get(f"{API}/dashboard/stats", headers=headers)
        assert r.status_code == 200
        data = r.json()
        for k in ("total", "this_year", "this_month", "clients"):
            assert k in data
            assert isinstance(data[k], int)


# ----------------------- Scoping test -----------------------
class TestScoping:
    def test_data_scoped_per_user(self, auth):
        # create second user
        email2 = f"TEST_{uuid.uuid4().hex[:10]}@lab.it"
        r = requests.post(f"{API}/auth/signup", json={
            "email": email2, "password": "password123", "name": "User2"
        })
        assert r.status_code == 201
        h2 = {"Authorization": f"Bearer {r.json()['access_token']}", "Content-Type": "application/json"}

        # user2 should see empty lists (data from user1 not visible)
        r = requests.get(f"{API}/declarations", headers=h2)
        assert r.status_code == 200
        # user2 clients empty
        r = requests.get(f"{API}/clients", headers=h2)
        assert r.status_code == 200
        assert r.json() == []
