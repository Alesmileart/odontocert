"""OdontoCert - New feature: Listino linked to work-types + invoice auto-sum from declarations.

Covers:
- POST /api/price-items/generate creates one per_element item per (category, subtype), idempotent
- PriceItem round-trips category + subtype via POST and PUT, and GET returns them
- Invoice creation with lines derived from an ISSUED multi-works declaration produces the
  correct SUM (one line per lavorazione, qty = teeth count, unit_price from listino).
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://odonto-declarations.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ----------------------- Fixture: fresh user -----------------------
@pytest.fixture(scope="module")
def auth():
    email = f"TEST_link_{uuid.uuid4().hex[:10]}@lab.it"
    r = requests.post(f"{API}/auth/signup", json={
        "email": email, "password": "password123", "name": "TEST Listino Link"
    })
    assert r.status_code == 201, r.text
    return {"token": r.json()["access_token"], "email": email, "user_id": r.json()["user"]["id"]}


@pytest.fixture
def headers(auth):
    return {"Authorization": f"Bearer {auth['token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def seeded_work_types(auth):
    """Auto-seed default work-types by hitting GET /work-types once (module scope)."""
    h = {"Authorization": f"Bearer {auth['token']}"}
    r = requests.get(f"{API}/work-types", headers=h)
    assert r.status_code == 200
    wts = r.json()
    # sanity: expected defaults
    cats = {w["category"] for w in wts}
    assert "Protesi Fissa" in cats
    assert "Protesi Provvisoria" in cats
    return wts


# ----------------------- 1. PriceItem model: category + subtype -----------------------
class TestPriceItemCategorySubtype:
    def test_create_with_category_and_subtype(self, headers):
        payload = {
            "name": "TEST Corona Zirconia Monolitica",
            "price": 120.0,
            "mode": "per_element",
            "category": "Protesi Fissa",
            "subtype": "Corona in Zirconia Monolitica",
            "description": "test",
        }
        r = requests.post(f"{API}/price-items", json=payload, headers=headers)
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["category"] == "Protesi Fissa"
        assert data["subtype"] == "Corona in Zirconia Monolitica"
        assert data["mode"] == "per_element"
        assert data["price"] == 120.0

        # GET verifies persistence
        r2 = requests.get(f"{API}/price-items", headers=headers)
        assert r2.status_code == 200
        item = next((p for p in r2.json() if p["id"] == data["id"]), None)
        assert item is not None
        assert item["category"] == "Protesi Fissa"
        assert item["subtype"] == "Corona in Zirconia Monolitica"

        # PUT updates round-trip
        upd = {**payload, "price": 130.0, "subtype": "Corona in Zirconia Monolitica"}
        r3 = requests.put(f"{API}/price-items/{data['id']}", json=upd, headers=headers)
        assert r3.status_code == 200
        assert r3.json()["price"] == 130.0
        assert r3.json()["subtype"] == "Corona in Zirconia Monolitica"

        # cleanup
        requests.delete(f"{API}/price-items/{data['id']}", headers=headers)


# ----------------------- 2. POST /price-items/generate -----------------------
class TestGeneratePriceItems:
    def test_generate_creates_one_per_subtype_and_is_idempotent(self, headers, seeded_work_types):
        # clean any pre-existing price items from previous test
        existing = requests.get(f"{API}/price-items", headers=headers).json()
        for e in existing:
            requests.delete(f"{API}/price-items/{e['id']}", headers=headers)

        # expected: sum of subtypes across all default work-types (4 + 4 = 8)
        expected = sum(len(w.get("subtypes") or []) for w in seeded_work_types)
        assert expected == 8

        r = requests.post(f"{API}/price-items/generate", json={}, headers=headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["created"] == expected

        # list should now contain those items with mode=per_element, price=0
        items = requests.get(f"{API}/price-items", headers=headers).json()
        assert len(items) == expected
        for it in items:
            assert it["mode"] == "per_element"
            assert it["price"] == 0
            assert it["category"]
            assert it["subtype"]
            # name defaults to subtype
            assert it["name"] == it["subtype"]

        # idempotent second call returns created:0
        r2 = requests.post(f"{API}/price-items/generate", json={}, headers=headers)
        assert r2.status_code == 200
        assert r2.json()["created"] == 0
        items2 = requests.get(f"{API}/price-items", headers=headers).json()
        assert len(items2) == expected  # no duplicates

    def test_generate_requires_auth(self):
        r = requests.post(f"{API}/price-items/generate", json={})
        assert r.status_code in (401, 403)


# ----------------------- 3. Invoice auto-sum from linked ISSUED declaration -----------------------
class TestInvoiceLinkedDeclaration:
    def test_two_works_sum_from_listino(self, headers, auth):
        # 3a. Ensure listino has our two subtypes at known prices (update or create)
        items = requests.get(f"{API}/price-items", headers=headers).json()

        def upsert(category, subtype, price):
            match = next(
                (p for p in items if p.get("subtype", "").lower() == subtype.lower()
                 and p.get("category", "").lower() == category.lower()),
                None,
            )
            body = {"name": subtype, "price": price, "mode": "per_element",
                    "category": category, "subtype": subtype, "description": ""}
            if match:
                r = requests.put(f"{API}/price-items/{match['id']}", json=body, headers=headers)
                assert r.status_code == 200, r.text
            else:
                r = requests.post(f"{API}/price-items", json=body, headers=headers)
                assert r.status_code == 201, r.text

        upsert("Protesi Fissa", "Corona in Zirconia Monolitica", 120)
        upsert("Protesi Provvisoria", "Provvisorio", 50)

        # 3b. Create a client
        r = requests.post(f"{API}/clients", json={"name": "TEST Studio Link"}, headers=headers)
        assert r.status_code == 201
        client = r.json()

        # 3c. Create an ISSUED declaration with 2 works on tooth 13 each
        decl_payload = {
            "client_id": client["id"],
            "client_snapshot": {"name": client["name"]},
            "patient_name": "TEST Paziente",
            "device_type": "Protesi Fissa, Protesi Provvisoria",
            "device_description": "Corona in Zirconia Monolitica · Provvisorio",
            "teeth": [13],
            "works": [
                {"category": "Protesi Fissa", "subtype": "Corona in Zirconia Monolitica", "teeth": [13]},
                {"category": "Protesi Provvisoria", "subtype": "Provvisorio", "teeth": [13]},
            ],
            "technician_name": "Mario Rossi",
            "signature_base64": "data:image/png;base64,iVBORw0KGgo=",  # non-empty -> status=issued
        }
        r = requests.post(f"{API}/declarations", json=decl_payload, headers=headers)
        assert r.status_code == 201, r.text
        decl = r.json()
        assert decl["status"] == "issued"
        assert decl["client_id"] == client["id"]

        # 3d. Verify GET /declarations filter (issued present)
        all_decls = requests.get(f"{API}/declarations", headers=headers).json()
        assert any(d["id"] == decl["id"] and d.get("status") == "issued" for d in all_decls)

        # 3e. Simulate the frontend logic: build lines from the declaration matched by subtype/category
        prices = requests.get(f"{API}/price-items", headers=headers).json()

        def match(cat, sub):
            m = next((p for p in prices if p.get("subtype", "").lower() == sub.lower()), None)
            if not m:
                m = next((p for p in prices if p.get("category", "").lower() == cat.lower() and not p.get("subtype")), None)
            return m

        lines = []
        for w in decl["works"]:
            m = match(w["category"], w["subtype"])
            count = len(w["teeth"] or [])
            mode = (m or {}).get("mode", "per_element")
            qty = count if (mode == "per_element" and count > 0) else 1
            unit_price = (m or {}).get("price", 0)
            lines.append({
                "description": f"{w['category']} — {w['subtype']}",
                "qty": qty,
                "unit_price": unit_price,
                "mode": mode,
                "declaration_id": decl["id"],
            })

        # Expect: 1 x 120 + 1 x 50 = 170
        assert len(lines) == 2
        assert lines[0]["unit_price"] == 120 and lines[0]["qty"] == 1
        assert lines[1]["unit_price"] == 50 and lines[1]["qty"] == 1

        invoice_payload = {
            "client_id": client["id"],
            "client_snapshot": {"name": client["name"]},
            "date": "",
            "lines": lines,
            "declaration_ids": [decl["id"]],
            "bollo": False,
            "notes": "",
        }
        r = requests.post(f"{API}/invoices", json=invoice_payload, headers=headers)
        assert r.status_code == 201, r.text
        inv = r.json()
        assert inv["total"] == 170.0
        assert len(inv["lines"]) == 2
        assert all(l["declaration_id"] == decl["id"] for l in inv["lines"])

        # 3f. GET back the invoice, verify persistence
        r2 = requests.get(f"{API}/invoices/{inv['id']}", headers=headers)
        assert r2.status_code == 200
        assert r2.json()["total"] == 170.0
        assert len(r2.json()["lines"]) == 2

        # cleanup
        requests.delete(f"{API}/invoices/{inv['id']}", headers=headers)
        requests.delete(f"{API}/declarations/{decl['id']}", headers=headers)
        requests.delete(f"{API}/clients/{client['id']}", headers=headers)

    def test_line_price_zero_when_no_listino_match(self, headers):
        """If a subtype has no listino price the line unit_price falls back to 0."""
        # Delete all listino for this scenario
        items = requests.get(f"{API}/price-items", headers=headers).json()
        for it in items:
            requests.delete(f"{API}/price-items/{it['id']}", headers=headers)

        prices = requests.get(f"{API}/price-items", headers=headers).json()
        assert prices == []

        # Emulate matching logic
        w = {"category": "Protesi Fissa", "subtype": "Corona in Zirconia Monolitica", "teeth": [11]}
        match = next((p for p in prices if p.get("subtype", "").lower() == w["subtype"].lower()), None)
        assert match is None

        # Create invoice with a line at unit_price=0
        line = {"description": "test", "qty": 1, "unit_price": 0, "mode": "per_element", "declaration_id": ""}
        r = requests.post(f"{API}/invoices",
                          json={"client_snapshot": {"name": "TEST no-price"}, "date": "",
                                "lines": [line], "bollo": False},
                          headers=headers)
        assert r.status_code == 201
        inv = r.json()
        assert inv["total"] == 0
        requests.delete(f"{API}/invoices/{inv['id']}", headers=headers)


# ----------------------- 4. Auth guard on generate -----------------------
def test_price_items_generate_requires_token():
    r = requests.post(f"{API}/price-items/generate", json={})
    assert r.status_code in (401, 403)
