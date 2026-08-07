"""OdontoCert - Tests for Work Types catalog (categoria -> sottotipi) and multi-lavorazioni.

Covers:
- GET /api/work-types auto-seeds DEFAULT_WORK_TYPES on empty DB
- POST/PUT/DELETE /api/work-types (CRUD)
- POST /api/declarations with 'works' list is stored and returned by GET
- Backward compat: legacy declaration without 'works' still works
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://odonto-declarations.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SIGNATURE_B64 = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR"
    "42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)

DEFAULT_CATEGORIES = {"Protesi Fissa", "Protesi Provvisoria"}
FIXED_SUBTYPES = {
    "Corona in Zirconia Monolitica",
    "Corona in Zirconia Stratificata",
    "Corona Avvitata",
    "Intarsio in Composito",
}
PROV_SUBTYPES = {
    "Provvisorio",
    "Provvisorio Prelimatura",
    "Provvisorio Armato",
    "Provvisorio Rinforzato",
}


# ----------------------- Fixtures -----------------------
@pytest.fixture(scope="module")
def fresh_user():
    """Signup a brand-new user so work-types starts empty (verifies auto-seed)."""
    email = f"TEST_{uuid.uuid4().hex[:10]}@lab.it"
    r = requests.post(f"{API}/auth/signup", json={
        "email": email, "password": "password123", "name": "TEST Works"
    })
    assert r.status_code == 201, r.text
    return {"token": r.json()["access_token"], "email": email}


@pytest.fixture
def headers(fresh_user):
    return {"Authorization": f"Bearer {fresh_user['token']}", "Content-Type": "application/json"}


# ----------------------- Auto-seed -----------------------
class TestWorkTypesAutoSeed:
    def test_first_get_seeds_defaults(self, headers):
        r = requests.get(f"{API}/work-types", headers=headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        cats = {d["category"] for d in data}
        assert DEFAULT_CATEGORIES.issubset(cats), f"Missing defaults, got {cats}"

        fissa = next(d for d in data if d["category"] == "Protesi Fissa")
        prov = next(d for d in data if d["category"] == "Protesi Provvisoria")
        assert set(fissa["subtypes"]) == FIXED_SUBTYPES
        assert set(prov["subtypes"]) == PROV_SUBTYPES
        # each has an id
        assert fissa.get("id")
        assert prov.get("id")

    def test_second_get_does_not_reseed(self, headers):
        # first call seeded already; a second call should return same 2 records, no dupes
        r = requests.get(f"{API}/work-types", headers=headers)
        assert r.status_code == 200
        data = r.json()
        cats = [d["category"] for d in data]
        # exactly 2 defaults, no duplicates
        assert cats.count("Protesi Fissa") == 1
        assert cats.count("Protesi Provvisoria") == 1

    def test_no_mongo_id_leak(self, headers):
        r = requests.get(f"{API}/work-types", headers=headers)
        for d in r.json():
            assert "_id" not in d
            assert "user_id" not in d

    def test_auth_required(self):
        r = requests.get(f"{API}/work-types")
        assert r.status_code in (401, 403)


# ----------------------- CRUD -----------------------
class TestWorkTypesCRUD:
    def test_create_category(self, headers):
        payload = {
            "category": "TEST Ortodonzia",
            "subtypes": ["Bite", "Placca di svincolo"],
            "order": 10,
        }
        r = requests.post(f"{API}/work-types", headers=headers, json=payload)
        assert r.status_code == 201, r.text
        got = r.json()
        assert got["category"] == "TEST Ortodonzia"
        assert got["subtypes"] == ["Bite", "Placca di svincolo"]
        assert got["order"] == 10
        assert got.get("id")

        # verify persistence
        r2 = requests.get(f"{API}/work-types", headers=headers)
        assert r2.status_code == 200
        cats = {d["category"] for d in r2.json()}
        assert "TEST Ortodonzia" in cats

        # cleanup
        requests.delete(f"{API}/work-types/{got['id']}", headers=headers)

    def test_update_category_rename_and_subtypes(self, headers):
        # create
        r = requests.post(f"{API}/work-types", headers=headers, json={
            "category": "TEST TempCat", "subtypes": ["A", "B"], "order": 5
        })
        tid = r.json()["id"]

        r = requests.put(f"{API}/work-types/{tid}", headers=headers, json={
            "category": "TEST Renamed",
            "subtypes": ["A", "B", "C"],
            "order": 7,
        })
        assert r.status_code == 200, r.text
        got = r.json()
        assert got["category"] == "TEST Renamed"
        assert got["subtypes"] == ["A", "B", "C"]
        assert got["order"] == 7

        # verify via GET
        r2 = requests.get(f"{API}/work-types", headers=headers)
        found = next((d for d in r2.json() if d["id"] == tid), None)
        assert found is not None
        assert found["category"] == "TEST Renamed"
        assert found["subtypes"] == ["A", "B", "C"]

        requests.delete(f"{API}/work-types/{tid}", headers=headers)

    def test_update_nonexistent_404(self, headers):
        r = requests.put(f"{API}/work-types/{uuid.uuid4()}", headers=headers, json={
            "category": "x", "subtypes": [], "order": 0
        })
        assert r.status_code == 404

    def test_delete_category(self, headers):
        r = requests.post(f"{API}/work-types", headers=headers, json={
            "category": "TEST DelCat", "subtypes": ["x"], "order": 99
        })
        tid = r.json()["id"]
        r = requests.delete(f"{API}/work-types/{tid}", headers=headers)
        assert r.status_code == 200
        # verify gone
        r2 = requests.get(f"{API}/work-types", headers=headers)
        assert not any(d["id"] == tid for d in r2.json())


# ----------------------- Declarations.works -----------------------
class TestDeclarationsWithWorks:
    def test_create_declaration_with_multiple_works(self, headers):
        works = [
            {"category": "Protesi Fissa",       "subtype": "Corona in Zirconia Monolitica", "teeth": [11, 12]},
            {"category": "Protesi Provvisoria", "subtype": "Provvisorio",                   "teeth": [21]},
        ]
        payload = {
            "client_snapshot": {"name": "TEST Pat MultiWorks"},
            "patient_name": "TEST Pat MultiWorks",
            "device_type": "Protesi Fissa · Protesi Provvisoria",         # joined
            "device_description": "Corona in Zirconia Monolitica; Provvisorio",
            "teeth": [11, 12, 21],                                          # union
            "works": works,
            "signature_base64": SIGNATURE_B64,
            "technician_name": "TEST T",
        }
        r = requests.post(f"{API}/declarations", headers=headers, json=payload)
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["status"] == "issued"
        assert d["works"] and len(d["works"]) == 2
        assert d["works"][0]["category"] == "Protesi Fissa"
        assert d["works"][0]["subtype"] == "Corona in Zirconia Monolitica"
        assert d["works"][0]["teeth"] == [11, 12]
        assert d["works"][1]["category"] == "Protesi Provvisoria"
        assert d["works"][1]["subtype"] == "Provvisorio"
        assert d["works"][1]["teeth"] == [21]
        assert d["teeth"] == [11, 12, 21]
        assert "_id" not in d and "user_id" not in d
        did = d["id"]

        # GET verifies persistence
        r2 = requests.get(f"{API}/declarations/{did}", headers=headers)
        assert r2.status_code == 200
        g = r2.json()
        assert len(g["works"]) == 2
        assert g["works"][0]["teeth"] == [11, 12]
        assert g["works"][1]["teeth"] == [21]

        # list also returns works
        r3 = requests.get(f"{API}/declarations", headers=headers)
        assert r3.status_code == 200
        listed = next((x for x in r3.json() if x["id"] == did), None)
        assert listed is not None
        assert len(listed["works"]) == 2

        requests.delete(f"{API}/declarations/{did}", headers=headers)

    def test_legacy_declaration_without_works(self, headers):
        payload = {
            "client_snapshot": {"name": "TEST Legacy"},
            "patient_name": "TEST Legacy",
            "device_type": "Corona",
            "device_description": "singola",
            "teeth": [16],
            "signature_base64": SIGNATURE_B64,
            "technician_name": "TEST T",
        }
        r = requests.post(f"{API}/declarations", headers=headers, json=payload)
        assert r.status_code == 201, r.text
        d = r.json()
        assert d.get("works") == []
        assert d["teeth"] == [16]
        assert d["device_type"] == "Corona"
        did = d["id"]

        # GET still works and returns works=[]
        r2 = requests.get(f"{API}/declarations/{did}", headers=headers)
        assert r2.status_code == 200
        assert r2.json().get("works") == []
        assert r2.json()["teeth"] == [16]

        requests.delete(f"{API}/declarations/{did}", headers=headers)

    def test_draft_with_works_stored(self, headers):
        payload = {
            "client_snapshot": {"name": "TEST Draft W"},
            "patient_name": "TEST Draft",
            "works": [{"category": "Protesi Fissa", "subtype": "Corona Avvitata", "teeth": [26]}],
            "signature_base64": "",   # draft
            "technician_name": "T",
        }
        r = requests.post(f"{API}/declarations", headers=headers, json=payload)
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["status"] == "draft"
        assert len(d["works"]) == 1
        assert d["works"][0]["subtype"] == "Corona Avvitata"
        requests.delete(f"{API}/declarations/{d['id']}", headers=headers)
