import uuid

from app.routers import issues as issues_router


def test_submit_report_rejects_foreign_media_path(client, monkeypatch):
    def fail_create_issue_row(*_args, **_kwargs):
        raise AssertionError("create_issue_row should not be called")

    monkeypatch.setattr(
        issues_router.issues_service,
        "create_issue_row",
        fail_create_issue_row,
    )

    response = client.post(
        "/reports",
        json={
            "lat": 5.6037,
            "lng": -0.1870,
            "description": "Broken drain outside the school",
            "photo_path": "someone-else/photo.jpg",
        },
    )

    assert response.status_code == 403


def test_submit_report_normalizes_owned_media_path(client, monkeypatch):
    issue_id = uuid.uuid4()
    created_kwargs = {}

    def fake_create_issue_row(_supabase, **kwargs):
        created_kwargs.update(kwargs)
        return issue_id

    monkeypatch.setattr(
        issues_router.issues_service,
        "create_issue_row",
        fake_create_issue_row,
    )
    monkeypatch.setattr(issues_router.issues_service, "append_event", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(
        issues_router.issues_service,
        "run_post_create_ai",
        lambda *_args, **_kwargs: None,
    )

    response = client.post(
        "/reports",
        json={
            "lat": 5.6037,
            "lng": -0.1870,
            "description": "Broken drain outside the school",
            "photo_path": "/citizen-uuid-1/photo.jpg",
        },
    )

    assert response.status_code == 200
    assert response.json()["issue_id"] == str(issue_id)
    assert created_kwargs["photo_path"] == "citizen-uuid-1/photo.jpg"


def test_issue_detail_rejects_unrelated_user(client, monkeypatch):
    issue_id = uuid.uuid4()
    other_user_id = uuid.uuid4()

    monkeypatch.setattr(
        issues_router.issues_service,
        "fetch_issue",
        lambda *_args, **_kwargs: {
            "id": str(issue_id),
            "reporter_id": str(other_user_id),
            "routed_organization_id": None,
        },
    )
    monkeypatch.setattr(
        issues_router,
        "get_profile",
        lambda *_args, **_kwargs: {"role": "citizen", "organization_id": None},
    )
    monkeypatch.setattr(
        issues_router.issues_service,
        "list_issue_media",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            AssertionError("media should not be read")
        ),
    )

    response = client.get(f"/issues/{issue_id}")

    assert response.status_code == 403
