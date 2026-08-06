"""OdontoCert new feature tests - Provider settings, Materials inventory, Auto-deduct stock."""
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


# ----------------------- Fixtures -----------------------
@pytest.fixture(scope="module")
def auth():
    email = f"TEST_{uuid.uuid4().hex[:10]}@lab.it"
    r = requests.post(f"{API}/auth/signup", json={
        "email": email, "password": "password123", "name": "TEST NewFeat"
    })
    assert r.status_code == 201, r.text
    return {"token": r.json()["access_token"], "email": email}


@pytest.fixture
def headers(auth):
    return {"Authorization": f"Bearer {auth['token']}", "Content-Type": "application/json"}


# ----------------------- Provider settings -----------------------
class TestProviderSettings:
    def test_get_default_provider_settings(self, headers):
        r = requests.get(f"{API}/provider-settings", headers=headers)
        assert r.status_code == 200, r.text
        data = r.json()
        # defaults
        for k in ("signature_provider", "signature_reference", "pec_provider", "pec_address",
                  "conservation_provider", "conservation_reference", "notes"):
            assert k in data
            assert data[k] == ""
        for k in ("signature_enabled", "pec_enabled", "conservation_enabled"):
            assert data[k] is False

    def test_update_and_persist_provider_settings(self, headers):
        payload = {
            "signature_provider": "Aruba",
            "signature_reference": "AR-TEST-1",
            "signature_enabled": True,
            "pec_provider": "Aruba PEC",
            "pec_address": "test@pec.aruba.it",
            "pec_enabled": True,
            "conservation_provider": "Aruba DocFly",
            "conservation_reference": "CONS-1",
            "conservation_enabled": False,
            "notes": "TEST notes",
        }
        r = requests.put(f"{API}/provider-settings", headers=headers, json=payload)
        assert r.status_code == 200, r.text
        # verify persistence
        r2 = requests.get(f"{API}/provider-settings", headers=headers)
        assert r2.status_code == 200
        got = r2.json()
        for k, v in payload.items():
            assert got[k] == v, f"Field {k} mismatch: {got[k]} != {v}"


# ----------------------- Materials inventory -----------------------
class TestMaterialsInventory:
    def test_create_material_with_inventory(self, headers):
        payload = {
            "name": "TEST Zirconia Inv",
            "manufacturer": "Ivoclar",
            "ce_number": "CE-1",
            "lot_default": "L1",
            "category": "ceramica",
            "track_stock": True,
            "unit": "pz",
            "stock": 10,
            "min_stock": 2,
            "location": "Scaffale A",
        }
        r = requests.post(f"{API}/materials", headers=headers, json=payload)
        assert r.status_code == 201, r.text
        m = r.json()
        assert m["track_stock"] is True
        assert m["unit"] == "pz"
        assert m["stock"] == 10
        assert m["min_stock"] == 2
        assert m["location"] == "Scaffale A"
        assert m.get("stock_updated_at")  # should be set for tracked materials
        # cleanup
        requests.delete(f"{API}/materials/{m['id']}", headers=headers)

    def test_backward_compat_material_without_inventory(self, headers):
        # create legacy-shaped material (no inventory fields)
        payload = {
            "name": "TEST Legacy",
            "manufacturer": "X",
            "ce_number": "CE-2",
            "lot_default": "L2",
            "category": "metallo",
        }
        r = requests.post(f"{API}/materials", headers=headers, json=payload)
        assert r.status_code == 201, r.text
        mid = r.json()["id"]
        # GET should not 500
        r = requests.get(f"{API}/materials", headers=headers)
        assert r.status_code == 200
        found = next((m for m in r.json() if m["id"] == mid), None)
        assert found is not None
        assert found["track_stock"] is False
        assert found["stock"] == 0
        # cleanup
        requests.delete(f"{API}/materials/{mid}", headers=headers)

    def test_update_material_inventory(self, headers):
        r = requests.post(f"{API}/materials", headers=headers, json={
            "name": "TEST Upd", "track_stock": False, "unit": "", "stock": 0, "min_stock": 0
        })
        mid = r.json()["id"]

        r = requests.put(f"{API}/materials/{mid}", headers=headers, json={
            "name": "TEST Upd", "manufacturer": "", "ce_number": "", "lot_default": "",
            "category": "", "track_stock": True, "unit": "g", "stock": 100, "min_stock": 20,
            "location": "B2"
        })
        assert r.status_code == 200, r.text
        m = r.json()
        assert m["track_stock"] is True
        assert m["unit"] == "g"
        assert m["stock"] == 100
        assert m["min_stock"] == 20
        assert m["location"] == "B2"
        requests.delete(f"{API}/materials/{mid}", headers=headers)

    def test_stock_adjust_carico_and_scarico(self, headers):
        r = requests.post(f"{API}/materials", headers=headers, json={
            "name": "TEST Adj", "track_stock": True, "unit": "pz", "stock": 5, "min_stock": 1
        })
        mid = r.json()["id"]

        # carico (+3)
        r = requests.post(f"{API}/materials/{mid}/adjust", headers=headers, json={"delta": 3, "reason": "carico"})
        assert r.status_code == 200, r.text
        assert r.json()["stock"] == 8
        assert r.json()["track_stock"] is True

        # scarico (-2)
        r = requests.post(f"{API}/materials/{mid}/adjust", headers=headers, json={"delta": -2, "reason": "scarico"})
        assert r.status_code == 200
        assert r.json()["stock"] == 6

        # verify persistence via GET
        r = requests.get(f"{API}/materials", headers=headers)
        found = next((m for m in r.json() if m["id"] == mid), None)
        assert found["stock"] == 6

        requests.delete(f"{API}/materials/{mid}", headers=headers)

    def test_stock_adjust_sets_track_stock_true(self, headers):
        # create material with track_stock=False
        r = requests.post(f"{API}/materials", headers=headers, json={
            "name": "TEST AutoTrack", "track_stock": False, "unit": "", "stock": 0
        })
        mid = r.json()["id"]

        r = requests.post(f"{API}/materials/{mid}/adjust", headers=headers, json={"delta": 5, "reason": "primo carico"})
        assert r.status_code == 200
        assert r.json()["track_stock"] is True
        assert r.json()["stock"] == 5

        requests.delete(f"{API}/materials/{mid}", headers=headers)

    def test_stock_adjust_nonexistent_404(self, headers):
        r = requests.post(f"{API}/materials/{uuid.uuid4()}/adjust", headers=headers, json={"delta": 1})
        assert r.status_code == 404


# ----------------------- Auto-deduct on issued declaration -----------------------
class TestAutoDeduct:
    def _create_tracked_material(self, headers, stock=10):
        r = requests.post(f"{API}/materials", headers=headers, json={
            "name": f"TEST AutoDed {uuid.uuid4().hex[:5]}", "track_stock": True,
            "unit": "pz", "stock": stock, "min_stock": 1
        })
        assert r.status_code == 201, r.text
        return r.json()["id"]

    def test_issued_declaration_deducts_stock(self, headers):
        mid = self._create_tracked_material(headers, stock=10)
        payload = {
            "client_snapshot": {"name": "TEST Auto"},
            "device_type": "Corona",
            "device_description": "test",
            "materials": [{
                "material_id": mid,
                "name": "TEST AutoDed",
                "qty": 3,
                "unit": "pz",
            }],
            "signature_base64": SIGNATURE_B64,
            "technician_name": "T",
        }
        r = requests.post(f"{API}/declarations", headers=headers, json=payload)
        assert r.status_code == 201, r.text
        assert r.json()["status"] == "issued"
        did = r.json()["id"]

        # verify stock decreased 10 -> 7
        r = requests.get(f"{API}/materials", headers=headers)
        found = next((m for m in r.json() if m["id"] == mid), None)
        assert found is not None
        assert found["stock"] == 7, f"Expected 7, got {found['stock']}"

        # cleanup
        requests.delete(f"{API}/declarations/{did}", headers=headers)
        requests.delete(f"{API}/materials/{mid}", headers=headers)

    def test_draft_declaration_does_not_deduct(self, headers):
        mid = self._create_tracked_material(headers, stock=10)
        payload = {
            "client_snapshot": {"name": "TEST DraftNoDed"},
            "device_type": "Corona",
            "device_description": "test",
            "materials": [{
                "material_id": mid,
                "name": "TEST AutoDed",
                "qty": 3,
                "unit": "pz",
            }],
            "signature_base64": "",  # draft
            "technician_name": "T",
        }
        r = requests.post(f"{API}/declarations", headers=headers, json=payload)
        assert r.status_code == 201, r.text
        assert r.json()["status"] == "draft"
        did = r.json()["id"]

        # stock must NOT change
        r = requests.get(f"{API}/materials", headers=headers)
        found = next((m for m in r.json() if m["id"] == mid), None)
        assert found["stock"] == 10, f"Draft should not deduct; got {found['stock']}"

        requests.delete(f"{API}/declarations/{did}", headers=headers)
        requests.delete(f"{API}/materials/{mid}", headers=headers)

    def test_issued_without_qty_or_unit_does_not_deduct(self, headers):
        mid = self._create_tracked_material(headers, stock=10)
        payload = {
            "client_snapshot": {"name": "TEST NoQty"},
            "device_type": "Corona",
            "device_description": "t",
            "materials": [{
                "material_id": mid,
                "name": "TEST AutoDed",
                "qty": 0,  # no quantity
                "unit": "pz",
            }],
            "signature_base64": SIGNATURE_B64,
            "technician_name": "T",
        }
        r = requests.post(f"{API}/declarations", headers=headers, json=payload)
        assert r.status_code == 201
        did = r.json()["id"]
        r = requests.get(f"{API}/materials", headers=headers)
        found = next((m for m in r.json() if m["id"] == mid), None)
        assert found["stock"] == 10

        requests.delete(f"{API}/declarations/{did}", headers=headers)
        requests.delete(f"{API}/materials/{mid}", headers=headers)

    def test_issued_untracked_material_not_deducted(self, headers):
        # create untracked material
        r = requests.post(f"{API}/materials", headers=headers, json={
            "name": "TEST Untracked", "track_stock": False, "unit": "pz", "stock": 10
        })
        mid = r.json()["id"]
        payload = {
            "client_snapshot": {"name": "TEST UnTrk"},
            "device_type": "Corona",
            "device_description": "t",
            "materials": [{"material_id": mid, "name": "TEST Untracked", "qty": 2, "unit": "pz"}],
            "signature_base64": SIGNATURE_B64,
            "technician_name": "T",
        }
        r = requests.post(f"{API}/declarations", headers=headers, json=payload)
        assert r.status_code == 201
        did = r.json()["id"]
        r = requests.get(f"{API}/materials", headers=headers)
        found = next((m for m in r.json() if m["id"] == mid), None)
        assert found["stock"] == 10, "Untracked material should not be deducted"

        requests.delete(f"{API}/declarations/{did}", headers=headers)
        requests.delete(f"{API}/materials/{mid}", headers=headers)
