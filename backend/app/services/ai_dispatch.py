import logging
import threading

import httpx

logger = logging.getLogger(__name__)


def dispatch_self_http_process_issue(base_url: str, secret: str, issue_id: str) -> None:
    """
    Best-effort: start a daemon thread that POSTs to /internal/process-issue/{id}.
    May not complete on some serverless platforms; prefer Supabase webhook calling the same URL.
    """

    def run() -> None:
        url = f"{base_url.rstrip('/')}/internal/process-issue/{issue_id}"
        try:
            r = httpx.post(
                url,
                headers={"X-Internal-Key": secret},
                timeout=120.0,
            )
            r.raise_for_status()
        except Exception:
            logger.exception("Self-HTTP AI dispatch failed for issue %s", issue_id)

    threading.Thread(target=run, daemon=True).start()
