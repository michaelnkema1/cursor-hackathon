from uuid import UUID
from unittest.mock import patch


def _report_payload(**overrides):
    payload = {
        "lat": 5.6037,
        "lng": -0.1870,
        "title": "Pothole on main road",
        "description": "A deep pothole is blocking traffic.",
    }
    payload.update(overrides)
    return payload


@patch("app.routers.issues.issues_service.create_issue_row")
def test_submit_report_rejects_media_paths_outside_reporter_prefix(mock_create, client):
    response = client.post(
        "/reports",
        json=_report_payload(photo_path="other-user/stolen-photo.jpg"),
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "photo_path must reference an upload owned by the reporter"
    )
    mock_create.assert_not_called()


@patch("app.routers.issues.issues_service.create_issue_row")
def test_submit_report_rejects_media_path_traversal(mock_create, client):
    response = client.post(
        "/reports",
        json=_report_payload(audio_path="citizen-uuid-1/../secret.wav"),
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid audio_path"
    mock_create.assert_not_called()


@patch("app.routers.issues.issues_service.run_post_create_ai")
@patch("app.routers.issues.issues_service.append_event")
@patch("app.routers.issues.issues_service.create_issue_row")
def test_submit_report_accepts_and_normalizes_owned_media_paths(
    mock_create,
    mock_append_event,
    mock_run_post_create_ai,
    client,
):
    issue_id = UUID("00000000-0000-0000-0000-000000000123")
    mock_create.return_value = issue_id

    response = client.post(
        "/reports",
        json=_report_payload(
            photo_path="/citizen-uuid-1/photo.jpg",
            audio_path=" citizen-uuid-1/audio.wav ",
            video_path="citizen-uuid-1/video.mp4",
        ),
    )

    assert response.status_code == 200
    assert response.json()["issue_id"] == str(issue_id)

    create_kwargs = mock_create.call_args.kwargs
    assert create_kwargs["photo_path"] == "citizen-uuid-1/photo.jpg"
    assert create_kwargs["audio_path"] == "citizen-uuid-1/audio.wav"
    assert create_kwargs["video_path"] == "citizen-uuid-1/video.mp4"

    append_kwargs = mock_append_event.call_args.kwargs
    assert append_kwargs["payload"]["video_path"] == "citizen-uuid-1/video.mp4"

    ai_kwargs = mock_run_post_create_ai.call_args.kwargs
    assert ai_kwargs["photo_path"] == "citizen-uuid-1/photo.jpg"
    assert ai_kwargs["audio_path"] == "citizen-uuid-1/audio.wav"
    assert ai_kwargs["video_path"] == "citizen-uuid-1/video.mp4"
