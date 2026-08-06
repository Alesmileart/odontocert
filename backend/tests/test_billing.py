"""OdontoCert Fatturazione (billing) tests - Price list (Listino) & Invoices (Fatture)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://odonto-declarations.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ----------------------- Fixtures -----------------------
@pytest.fixture(scope="module")
def auth():
    """Fresh signup so tests are isolated (empty listino / no invoices)."""
    email = f"TEST_bill_{uuid.uuid4().hex[:10]}@lab.it"
    r = requests.post(f"{API}/auth/signup", json={
        "email": email, "password": "password123", "name": "TEST Billing"
    })
    assert r.status_code == 201, r.text
    return {"token": r.json()["access_token"], "email": email}


@pytest.fixture
def headers(auth):
    return {"Authorization": f"Bearer {auth['token']}", "Content-Type": "application/json"}


# ----------------------- Listino (price-items) -----------------------
class TestPriceItems:
    def test_list_empty(self, headers):
        r = requests.get(f"{API}/price-items", headers=headers)
        assert r.status_code == 200, r.text
        assert r.json() == []

    def test_create_flat_mode(self, headers):
        payload = {"name": "TEST Corona zirconia", "price": 120.0, "mode": "flat",
                   "category": "Protesi fissa", "description": "Corona in zirconia monolitica"}
        r = requests.post(f"{API}/price-items", json=payload, headers=headers)
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["name"] == payload["name"]
        assert data["price"] == 120.0
        assert data["mode"] == "flat"
        assert data["id"]
        # GET to verify persisted
        g = requests.get(f"{API}/price-items", headers=headers)
        assert any(x["id"] == data["id"] and x["mode"] == "flat" for x in g.json())

    def test_create_per_element_mode(self, headers):
        payload = {"name": "TEST Faccetta", "price": 80.0, "mode": "per_element",
                   "category": "Estetica", "description": ""}
        r = requests.post(f"{API}/price-items", json=payload, headers=headers)
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["mode"] == "per_element"
        assert data["price"] == 80.0

    def test_update_price_item(self, headers):
        # Create
        c = requests.post(f"{API}/price-items", json={"name": "TEST U", "price": 10, "mode": "flat"},
                          headers=headers)
        item_id = c.json()["id"]
        # Update
        u = requests.put(f"{API}/price-items/{item_id}", headers=headers,
                         json={"name": "TEST U2", "price": 25.5, "mode": "per_element",
                               "category": "X", "description": "desc"})
        assert u.status_code == 200, u.text
        assert u.json()["price"] == 25.5
        assert u.json()["mode"] == "per_element"
        # Verify via GET
        g = requests.get(f"{API}/price-items", headers=headers).json()
        found = next(x for x in g if x["id"] == item_id)
        assert found["name"] == "TEST U2"
        assert found["mode"] == "per_element"

    def test_update_missing_returns_404(self, headers):
        r = requests.put(f"{API}/price-items/does-not-exist", headers=headers,
                         json={"name": "x", "price": 1, "mode": "flat"})
        assert r.status_code == 404

    def test_delete_price_item(self, headers):
        c = requests.post(f"{API}/price-items", json={"name": "TEST DEL", "price": 5, "mode": "flat"},
                          headers=headers)
        item_id = c.json()["id"]
        d = requests.delete(f"{API}/price-items/{item_id}", headers=headers)
        assert d.status_code == 200
        # Ensure gone
        g = requests.get(f"{API}/price-items", headers=headers).json()
        assert all(x["id"] != item_id for x in g)


# ----------------------- Invoices (fatture) -----------------------
class TestInvoices:
    def test_list_empty(self, headers):
        r = requests.get(f"{API}/invoices", headers=headers)
        assert r.status_code == 200
        assert r.json() == []

    def test_create_invoice_total_with_bollo(self, headers):
        """Spec: (qty 3 x 10.00) + (qty 1 x 50.00) + bollo=true (2.0) => 82.00"""
        payload = {
            "client_id": None,
            "client_snapshot": {"name": "TEST Studio Bianchi", "vat": "01234567890"},
            "date": "2026-01-15",
            "lines": [
                {"description": "Corona", "qty": 3, "unit_price": 10.0, "mode": "flat", "declaration_id": ""},
                {"description": "Faccetta", "qty": 1, "unit_price": 50.0, "mode": "per_element", "declaration_id": ""},
            ],
            "bollo": True,
            "bollo_amount": 2.0,
            "notes": "TEST invoice",
            "status": "issued",
        }
        r = requests.post(f"{API}/invoices", json=payload, headers=headers)
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["total"] == 82.0, f"expected 82.0 got {data['total']}"
        assert data["number"].startswith("FT-"), data["number"]
        # Format FT-YYYY-NNNN
        parts = data["number"].split("-")
        assert len(parts) == 3 and len(parts[1]) == 4 and len(parts[2]) == 4
        assert "esente IVA" in data.get("exemption_text", "")
        assert data["bollo"] is True
        # Persist check
        g = requests.get(f"{API}/invoices/{data['id']}", headers=headers)
        assert g.status_code == 200
        assert g.json()["total"] == 82.0
        return data["id"]

    def test_create_invoice_no_bollo(self, headers):
        payload = {
            "client_snapshot": {"name": "TEST NoBollo"},
            "lines": [
                {"description": "Item", "qty": 2, "unit_price": 15.0, "mode": "flat", "declaration_id": ""},
            ],
            "bollo": False,
        }
        r = requests.post(f"{API}/invoices", json=payload, headers=headers)
        assert r.status_code == 201
        assert r.json()["total"] == 30.0

    def test_invoice_number_sequential(self, headers):
        """Two consecutive invoices should get sequential numbers (NNNN increments)."""
        r1 = requests.post(f"{API}/invoices", json={"lines": [{"qty": 1, "unit_price": 1.0}]},
                           headers=headers)
        r2 = requests.post(f"{API}/invoices", json={"lines": [{"qty": 1, "unit_price": 2.0}]},
                           headers=headers)
        assert r1.status_code == 201 and r2.status_code == 201
        n1 = int(r1.json()["number"].split("-")[-1])
        n2 = int(r2.json()["number"].split("-")[-1])
        assert n2 == n1 + 1, f"{r1.json()['number']} -> {r2.json()['number']}"

    def test_update_invoice_recomputes_total(self, headers):
        c = requests.post(f"{API}/invoices", json={
            "lines": [{"qty": 1, "unit_price": 100.0}], "bollo": False,
        }, headers=headers)
        assert c.status_code == 201
        inv_id = c.json()["id"]
        original_number = c.json()["number"]
        # Update: change qty and enable bollo
        u = requests.put(f"{API}/invoices/{inv_id}", json={
            "lines": [{"description": "X", "qty": 2, "unit_price": 100.0, "mode": "flat", "declaration_id": ""}],
            "bollo": True, "bollo_amount": 2.0,
        }, headers=headers)
        assert u.status_code == 200, u.text
        assert u.json()["total"] == 202.0
        # Number should remain the same
        assert u.json()["number"] == original_number
        # Verify persistence
        g = requests.get(f"{API}/invoices/{inv_id}", headers=headers)
        assert g.json()["total"] == 202.0
        assert g.json()["bollo"] is True

    def test_update_missing_invoice_404(self, headers):
        r = requests.put(f"{API}/invoices/nonexistent-id", json={"lines": []}, headers=headers)
        assert r.status_code == 404

    def test_delete_invoice(self, headers):
        c = requests.post(f"{API}/invoices", json={"lines": [{"qty": 1, "unit_price": 5.0}]},
                          headers=headers)
        inv_id = c.json()["id"]
        d = requests.delete(f"{API}/invoices/{inv_id}", headers=headers)
        assert d.status_code == 200
        g = requests.get(f"{API}/invoices/{inv_id}", headers=headers)
        assert g.status_code == 404

    def test_invoice_does_not_leak_mongo_id_or_user(self, headers):
        c = requests.post(f"{API}/invoices", json={"lines": [{"qty": 1, "unit_price": 1.0}]},
                          headers=headers)
        data = c.json()
        assert "_id" not in data
        assert "user_id" not in data
        # list
        for inv in requests.get(f"{API}/invoices", headers=headers).json():
            assert "_id" not in inv and "user_id" not in inv

    def test_invoice_default_exemption_text(self, headers):
        r = requests.post(f"{API}/invoices", json={"lines": []}, headers=headers)
        assert r.status_code == 201
        assert "art. 10" in r.json()["exemption_text"]

    def test_auth_required(self):
        r = requests.get(f"{API}/invoices")
        assert r.status_code in (401, 403)
        r2 = requests.get(f"{API}/price-items")
        assert r2.status_code in (401, 403)


# ----------------------- Cleanup -----------------------
def teardown_module(module):
    """Best-effort cleanup: delete test items/invoices created."""
    # Fresh users are per-module; leaving data attached to isolated test user is OK.
    pass
