from unittest.mock import patch


def test_submit_report_rejects_media_path_outside_reporter_prefix(client):
    with patch("app.routers.issues.issues_service.create_issue_row") as create_issue:
        response = client.post(
            "/reports",
            json={
                "lat": 5.6037,
                "lng": -0.1870,
                "description": "Dangerous pothole near the junction",
                "photo_path": "different-user/photo.jpg",
            },
        )

    assert response.status_code == 403
    assert "reporter" in response.json()["detail"].lower()
    create_issue.assert_not_called()
