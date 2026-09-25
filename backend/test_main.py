import asyncio

import httpx
import numpy as np
from fastapi.testclient import TestClient

import main
from database import init_db
from main import RAG_DOCUMENTS, _prosodic_features, _prosodic_risk_signal, _voice_emotion_scores, app, compose_chat_reply, is_urdu_script, summarize_trajectory
from models import CheckIn

init_db()
client = TestClient(app)


def test_register_login_and_read_me() -> None:
    register_response = client.post("/auth/register", json={"email": "patient@example.com", "password": "correct-horse-battery"})
    assert register_response.status_code == 201
    assert "access_token" in register_response.json()

    duplicate_response = client.post("/auth/register", json={"email": "patient@example.com", "password": "another-password"})
    assert duplicate_response.status_code == 409

    login_response = client.post("/auth/login", json={"email": "patient@example.com", "password": "correct-horse-battery"})
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]

    wrong_password_response = client.post("/auth/login", json={"email": "patient@example.com", "password": "wrong"})
    assert wrong_password_response.status_code == 401

    me_response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "patient@example.com"

    unauthenticated_response = client.get("/auth/me")
    assert unauthenticated_response.status_code == 401


def test_update_profile_is_partial_and_requires_auth() -> None:
    token = client.post("/auth/register", json={"email": "profile@example.com", "password": "correct-horse-battery"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    unauthenticated_response = client.put("/auth/me", json={"full_name": "Someone"})
    assert unauthenticated_response.status_code == 401

    name_response = client.put("/auth/me", json={"full_name": "Riya Kapoor", "avatar_data_url": "data:image/jpeg;base64,AAAA"}, headers=headers)
    assert name_response.status_code == 200
    body = name_response.json()
    assert body["full_name"] == "Riya Kapoor"
    assert body["avatar_data_url"] == "data:image/jpeg;base64,AAAA"

    # A second update that only touches phone must not clear full_name or
    # avatar_data_url set by the previous request - only fields present in
    # this request body should change.
    phone_only_response = client.put("/auth/me", json={"phone": "+92-300-1234567"}, headers=headers)
    assert phone_only_response.status_code == 200
    body = phone_only_response.json()
    assert body["phone"] == "+92-300-1234567"
    assert body["full_name"] == "Riya Kapoor"
    assert body["avatar_data_url"] == "data:image/jpeg;base64,AAAA"


def test_change_password_requires_current_password_and_then_signs_in_with_new_one() -> None:
    token = client.post("/auth/register", json={"email": "changepw@example.com", "password": "correct-horse-battery"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    unauthenticated_response = client.post("/auth/change-password", json={"current_password": "correct-horse-battery", "new_password": "new-password-123"})
    assert unauthenticated_response.status_code == 401

    wrong_current_response = client.post("/auth/change-password", json={"current_password": "wrong-password", "new_password": "new-password-123"}, headers=headers)
    assert wrong_current_response.status_code == 401

    # The old password must still work - a rejected attempt shouldn't have changed anything.
    still_old_password_response = client.post("/auth/login", json={"email": "changepw@example.com", "password": "correct-horse-battery"})
    assert still_old_password_response.status_code == 200

    change_response = client.post("/auth/change-password", json={"current_password": "correct-horse-battery", "new_password": "new-password-123"}, headers=headers)
    assert change_response.status_code == 200

    old_password_now_fails = client.post("/auth/login", json={"email": "changepw@example.com", "password": "correct-horse-battery"})
    assert old_password_now_fails.status_code == 401

    new_password_works = client.post("/auth/login", json={"email": "changepw@example.com", "password": "new-password-123"})
    assert new_password_works.status_code == 200


def test_admin_bootstrap_via_admin_emails_env_and_resource_crud(monkeypatch) -> None:
    """ADMIN_EMAILS is read once at import time, so patch the already-imported
    module attribute directly rather than the environment (which register/
    login wouldn't see)."""
    monkeypatch.setattr(main, "ADMIN_EMAILS", {"admin@example.com"})

    admin_token = client.post("/auth/register", json={"email": "admin@example.com", "password": "correct-horse-battery"}).json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    regular_token = client.post("/auth/register", json={"email": "regular@example.com", "password": "correct-horse-battery"}).json()["access_token"]
    regular_headers = {"Authorization": f"Bearer {regular_token}"}

    assert client.get("/auth/me", headers=admin_headers).json()["is_admin"] is True
    assert client.get("/auth/me", headers=regular_headers).json()["is_admin"] is False

    # A signed-in non-admin is forbidden (403), distinct from unauthenticated (401).
    assert client.get("/admin/analytics", headers=regular_headers).status_code == 403
    assert client.get("/admin/analytics").status_code == 401

    analytics_response = client.get("/admin/analytics", headers=admin_headers)
    assert analytics_response.status_code == 200
    assert "total_users" in analytics_response.json()

    create_response = client.post(
        "/admin/resources",
        json={
            "resource_type": "meditation", "slug": "test-breathing", "title": "Test breathing exercise", "summary": "A short summary.",
            "body": "Full body text.", "image_data_url": "data:image/jpeg;base64,AAAA", "published": True,
        },
        headers=admin_headers,
    )
    assert create_response.status_code == 201
    resource_id = create_response.json()["id"]
    assert create_response.json()["image_data_url"] == "data:image/jpeg;base64,AAAA"

    forbidden_create = client.post("/admin/resources", json={"resource_type": "meditation", "slug": "should-fail", "title": "x"}, headers=regular_headers)
    assert forbidden_create.status_code == 403

    invalid_type_response = client.post("/admin/resources", json={"resource_type": "not-a-real-type", "slug": "bad-type", "title": "x"}, headers=admin_headers)
    assert invalid_type_response.status_code == 400

    duplicate_slug_response = client.post(
        "/admin/resources", json={"resource_type": "therapy", "slug": "test-breathing", "title": "Duplicate slug"}, headers=admin_headers
    )
    assert duplicate_slug_response.status_code == 409

    public_get_response = client.get("/resources/test-breathing")
    assert public_get_response.status_code == 200
    assert public_get_response.json()["title"] == "Test breathing exercise"

    public_list_response = client.get("/resources", params={"resource_type": "meditation"})
    assert any(resource["slug"] == "test-breathing" for resource in public_list_response.json())

    # Unpublishing hides it from public endpoints but not from the admin's own list.
    update_response = client.put(f"/admin/resources/{resource_id}", json={"published": False}, headers=admin_headers)
    assert update_response.status_code == 200
    assert update_response.json()["published"] is False
    assert update_response.json()["title"] == "Test breathing exercise"  # untouched by a partial update

    assert client.get("/resources/test-breathing").status_code == 404
    admin_list_response = client.get("/admin/resources", headers=admin_headers)
    assert any(resource["slug"] == "test-breathing" for resource in admin_list_response.json())

    delete_response = client.delete(f"/admin/resources/{resource_id}", headers=admin_headers)
    assert delete_response.status_code == 204
    admin_list_after_delete = client.get("/admin/resources", headers=admin_headers)
    assert not any(resource["id"] == resource_id for resource in admin_list_after_delete.json())


def test_admin_users_list_shows_checkin_counts_and_requires_admin(monkeypatch) -> None:
    monkeypatch.setattr(main, "ADMIN_EMAILS", {"users-admin@example.com"})

    admin_token = client.post("/auth/register", json={"email": "users-admin@example.com", "password": "correct-horse-battery"}).json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    member_token = client.post("/auth/register", json={"email": "users-member@example.com", "password": "correct-horse-battery", "full_name": "Member Person"}).json()["access_token"]
    member_headers = {"Authorization": f"Bearer {member_token}"}

    assert client.get("/admin/users", headers=member_headers).status_code == 403
    assert client.get("/admin/users").status_code == 401

    # Two check-ins for the member, none for the admin - the count must be per-user.
    for _ in range(2):
        client.post("/checkins", json={"risk_score": 0.3, "band": "watch", "routing_decision": "no_referral_needed"}, headers=member_headers)

    users_response = client.get("/admin/users", headers=admin_headers)
    assert users_response.status_code == 200
    by_email = {user["email"]: user for user in users_response.json()}
    assert by_email["users-member@example.com"]["full_name"] == "Member Person"
    assert by_email["users-member@example.com"]["checkin_count"] == 2
    assert by_email["users-member@example.com"]["is_admin"] is False
    assert by_email["users-admin@example.com"]["checkin_count"] == 0
    assert by_email["users-admin@example.com"]["is_admin"] is True
    # Never the password hash or anything from a saved check-in's own content.
    assert "hashed_password" not in by_email["users-member@example.com"]


def test_pageview_tracking_is_public_and_shows_up_in_admin_analytics(monkeypatch) -> None:
    monkeypatch.setattr(main, "ADMIN_EMAILS", {"pageview-admin@example.com"})
    admin_token = client.post("/auth/register", json={"email": "pageview-admin@example.com", "password": "correct-horse-battery"}).json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # No auth required - the frontend fires this on every page load.
    for path in ["/", "/", "/meditation"]:
        response = client.post("/analytics/pageview", json={"path": path})
        assert response.status_code == 204

    analytics = client.get("/admin/analytics", headers=admin_headers).json()
    assert analytics["total_pageviews"] >= 3
    top_pages = {entry["path"]: entry["count"] for entry in analytics["top_pages"]}
    assert top_pages["/"] >= 2
    assert top_pages["/meditation"] >= 1


def test_forgot_password_does_not_reveal_whether_an_email_is_registered(monkeypatch) -> None:
    sent_emails = []
    monkeypatch.setattr(main, "send_email", lambda **kwargs: sent_emails.append(kwargs))

    client.post("/auth/register", json={"email": "reset-user@example.com", "password": "correct-horse-battery"})

    known_response = client.post("/auth/forgot-password", json={"email": "reset-user@example.com"})
    unknown_response = client.post("/auth/forgot-password", json={"email": "nobody-here@example.com"})

    assert known_response.status_code == 200
    assert unknown_response.status_code == 200
    assert known_response.json() == unknown_response.json()
    assert len(sent_emails) == 1
    assert sent_emails[0]["to"] == "reset-user@example.com"


def test_forgot_password_survives_a_broken_smtp_configuration(monkeypatch) -> None:
    """send_email() has no error handling of its own (smtplib raises on a bad
    host/port/credentials) - the endpoint must catch that itself, log it, and
    still return its normal 200/generic response instead of a 500, since the
    reset token was already committed before send_email() is even called."""
    def raise_smtp_error(**kwargs) -> None:
        raise OSError("Could not connect to SMTP host")

    monkeypatch.setattr(main, "send_email", raise_smtp_error)

    client.post("/auth/register", json={"email": "broken-smtp@example.com", "password": "correct-horse-battery"})
    response = client.post("/auth/forgot-password", json={"email": "broken-smtp@example.com"})

    assert response.status_code == 200
    assert response.json()["message"] == "If an account exists for that email, we've sent a link to reset the password."


def test_reset_password_updates_password_and_single_use_token(monkeypatch) -> None:
    sent_emails = []
    monkeypatch.setattr(main, "send_email", lambda **kwargs: sent_emails.append(kwargs))

    client.post("/auth/register", json={"email": "reset-flow@example.com", "password": "original-password"})
    client.post("/auth/forgot-password", json={"email": "reset-flow@example.com"})

    reset_link = sent_emails[-1]["text_body"]
    token = reset_link.split("token=")[1].split()[0]

    invalid_token_response = client.post("/auth/reset-password", json={"token": "not-a-real-token-xxxxxxxxxx", "new_password": "brand-new-password"})
    assert invalid_token_response.status_code == 400

    reset_response = client.post("/auth/reset-password", json={"token": token, "new_password": "brand-new-password"})
    assert reset_response.status_code == 200

    old_password_login = client.post("/auth/login", json={"email": "reset-flow@example.com", "password": "original-password"})
    assert old_password_login.status_code == 401

    new_password_login = client.post("/auth/login", json={"email": "reset-flow@example.com", "password": "brand-new-password"})
    assert new_password_login.status_code == 200

    reused_token_response = client.post("/auth/reset-password", json={"token": token, "new_password": "another-password"})
    assert reused_token_response.status_code == 400


def test_checkins_require_auth_and_round_trip() -> None:
    unauthenticated_response = client.post("/checkins", json={"risk_score": 0.5, "band": "watch", "routing_decision": "no_referral_needed"})
    assert unauthenticated_response.status_code == 401

    register_response = client.post("/auth/register", json={"email": "history-user@example.com", "password": "correct-horse-battery"})
    token = register_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    components = {
        "phq9": {"score": 12, "band": "moderate"},
        "gad7": {"score": 9, "band": "mild"},
        "k10": {"score": 22, "band": "moderate"},
        "text": {"sentiment": "negative", "signal": 0.6, "anxiety_level": 0.5},
        "voice": {"available": True, "signal": 0.4, "note": "some pausing"},
    }
    support_plan = {"title": "A gentle next step", "next_action": "Try box breathing tonight."}
    # transcript/typed_text/individual question answers are never part of
    # this request shape at all - CheckInCreateRequest has no such fields,
    # so sending them is simply ignored by FastAPI/Pydantic rather than
    # something that needs its own rejection path.
    create_response = client.post(
        "/checkins",
        json={
            "risk_score": 0.42, "band": "watch", "routing_decision": "no_referral_needed", "themes": ["anxiety", "hardship"],
            "components": components, "support_plan": support_plan,
            "transcript": "this should be silently ignored, not stored", "typed_text": "same here",
        },
        headers=headers,
    )
    assert create_response.status_code == 201
    body = create_response.json()
    assert body["themes"] == ["anxiety", "hardship"]
    assert body["components"] == components
    assert body["support_plan"] == support_plan
    assert "transcript" not in body and "typed_text" not in body

    list_response = client.get("/checkins", headers=headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1
    assert list_response.json()[0]["band"] == "watch"
    assert list_response.json()[0]["components"] == components


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["service"] == "mindhx"


def test_profile_session_is_ephemeral() -> None:
    response = client.post("/session/start", json={"profile": {"age_range": "25-34", "marital_status": "single", "life_context": "working"}})
    body = response.json()
    assert response.status_code == 200
    assert body["session_token"]
    assert "does not persist" in body["privacy"]


def test_text_analysis_flags_crisis_language() -> None:
    response = client.post("/analyze-text", json={"text": "I want to kill myself", "language": "en"})
    assert response.status_code == 200
    assert response.json()["crisis_language"] is True


def test_text_analysis_distinguishes_anxiety_stress_and_depression_language() -> None:
    """These are heuristic lexicon/ratio scores (see _linguistic_indicators), not a trained
    classifier - the test checks that clearly anxious, stressed, and hopeless/absolutist text
    each score highest on their own dimension, not that the exact values are "correct"."""
    anxious = client.post("/analyze-text", json={
        "text": "I keep worrying about everything, what if something goes wrong, I can't stop thinking about it, so nervous and on edge!",
        "language": "en",
    }).json()
    stressed = client.post("/analyze-text", json={
        "text": "I am so overwhelmed with deadlines, too much pressure at work, I can't keep up and I am exhausted, no time for anything.",
        "language": "en",
    }).json()
    depressive = client.post("/analyze-text", json={
        "text": "Nothing ever works out for me. I always fail at everything. I am completely worthless and everyone always leaves.",
        "language": "en",
    }).json()
    calm = client.post("/analyze-text", json={
        "text": "Today was a pretty normal day. I went for a walk and had a good time with friends.",
        "language": "en",
    }).json()

    for result in (anxious, stressed, depressive, calm):
        for field in ("anxiety_level", "stress_level", "depression_indicator"):
            assert field in result and 0.0 <= result[field] <= 1.0
        assert "linguistic_features" in result and result["linguistic_features"]["word_count"] > 0

    assert anxious["anxiety_level"] == max(anxious["anxiety_level"], anxious["stress_level"], anxious["depression_indicator"])
    assert stressed["stress_level"] == max(stressed["anxiety_level"], stressed["stress_level"], stressed["depression_indicator"])
    assert depressive["depression_indicator"] == max(depressive["anxiety_level"], depressive["stress_level"], depressive["depression_indicator"])
    assert calm["anxiety_level"] < anxious["anxiety_level"]
    assert calm["stress_level"] < stressed["stress_level"]
    assert calm["depression_indicator"] < depressive["depression_indicator"]


def test_phq9_item_nine_short_circuits() -> None:
    response = client.post("/score-phq9", json={"answers": [0, 0, 0, 0, 0, 0, 0, 0, 1]})
    body = response.json()
    assert response.status_code == 200
    assert body["item_9_crisis"] is True
    assert body["routing_decision"] == "refer_immediately"


def test_risk_assessment_returns_referral_for_elevated_phq() -> None:
    response = client.post("/risk-assess", json={"phq9_answers": [2, 2, 2, 2, 2, 2, 2, 2, 0]})
    body = response.json()
    assert response.status_code == 200
    assert body["crisis_flag"] is False
    assert body["routing_decision"] == "refer"
    assert set(body["components"]) == {"phq9", "gad7", "k10", "text", "voice", "combined_signal", "attribution"}
    assert body["components"]["attribution"]["method"] == "additive_signal_attribution"
    assert {item["name"] for item in body["components"]["attribution"]["contributions"]} == {"phq9", "gad7", "k10", "text"}


def test_gad7_and_k10_scores_route_to_structured_referral() -> None:
    response = client.post(
        "/risk-assess",
        json={
            "phq9_answers": [0] * 9,
            "gad7_answers": [2] * 7,
            "k10_answers": [3] * 10,
            "profile": {"age_range": "25-34", "preferred_language": "ur"},
        },
    )
    body = response.json()
    assert response.status_code == 200
    assert body["gad7"]["severity_band"] == "moderate"
    assert body["k10"]["severity_band"] == "severe"
    assert body["support_plan"]["route"] == "psychiatric_referral"
    assert body["support_plan"]["meditation"] == []


def test_prosodic_risk_signal_higher_for_flat_paused_audio() -> None:
    """Operates on already-decoded PCM arrays, so it exercises the heuristic math without
    needing PyAV (which requires a native ffmpeg build) to be installed."""
    sample_rate = 16000
    duration = 2
    t = np.linspace(0, duration, sample_rate * duration, endpoint=False)

    mostly_silent = np.zeros_like(t)
    mostly_silent[: sample_rate // 4] = 0.05 * np.sin(2 * np.pi * 200 * t[: sample_rate // 4])
    mostly_silent[-sample_rate // 4:] = 0.05 * np.sin(2 * np.pi * 200 * t[-sample_rate // 4:])

    continuous_varied = (0.3 + 0.2 * np.sin(2 * np.pi * 3 * t)) * np.sin(2 * np.pi * 220 * t)

    quiet_features = _prosodic_features(mostly_silent.astype(np.float32), sample_rate)
    active_features = _prosodic_features(continuous_varied.astype(np.float32), sample_rate)

    assert quiet_features["pause_ratio"] > active_features["pause_ratio"]
    assert _prosodic_risk_signal(quiet_features) > _prosodic_risk_signal(active_features)

    quiet_emotion = _voice_emotion_scores(quiet_features)
    active_emotion = _voice_emotion_scores(active_features)
    # Mostly-silent, flat, slow audio should read as fatigued and depression-coded rather
    # than stressed or angry; continuous, more energetically varied audio should read the
    # other way around. These are heuristic proxies, not a trained emotion classifier - the
    # test only checks the ordering the docstring above claims, not absolute values.
    assert quiet_emotion["fatigue"] > active_emotion["fatigue"]
    assert quiet_emotion["depression_indicator"] > active_emotion["depression_indicator"]
    assert active_emotion["stress"] > quiet_emotion["stress"]
    for scores in (quiet_emotion, active_emotion):
        assert set(scores) == {"calm", "stress", "anger", "fatigue", "depression_indicator"}
        assert all(0.0 <= value <= 1.0 for value in scores.values())


def test_themes_detect_trauma_and_frustration_from_raw_text() -> None:
    response = client.post(
        "/risk-assess",
        json={
            "phq9_answers": [0] * 9,
            "gad7_answers": [0] * 7,
            "k10_answers": [1] * 10,
            "typed_text": "I keep having flashbacks and I am so frustrated with everything",
        },
    )
    body = response.json()
    assert response.status_code == 200
    assert "trauma" in body["themes"]
    assert "frustration" in body["themes"]
    assert body["support_plan"]["meditation"]
    assert body["support_plan"]["strategies"]


def test_crisis_route_excludes_non_urgent_support() -> None:
    response = client.post(
        "/risk-assess",
        json={"phq9_answers": [0, 0, 0, 0, 0, 0, 0, 0, 1]},
    )
    body = response.json()
    assert body["support_plan"]["route"] == "crisis"
    assert body["support_plan"]["meditation"] == []
    assert "religious_support" not in body["support_plan"]


def test_ai_chat_retrieves_grounded_support() -> None:
    response = client.post("/ai/chat", json={"message": "I am feeling anxious and worried", "risk_clear": True})
    body = response.json()
    assert response.status_code == 200
    assert body["status"] == "grounded_support"
    assert body["sources"]
    assert body["generation"]["diagnosis"] is False


def test_ai_chat_responds_in_urdu_when_requested() -> None:
    response = client.post("/ai/chat", json={"message": "I am feeling anxious and worried", "language": "ur", "risk_clear": True})
    body = response.json()
    assert response.status_code == 200
    assert body["status"] == "grounded_support"
    assert all(ord(character) > 127 for character in body["sources"][0]["title"] if character.isalpha())


def test_ai_chat_escalates_crisis_before_retrieval() -> None:
    response = client.post("/ai/chat", json={"message": "I want to kill myself", "risk_clear": True})
    assert response.status_code == 200
    assert response.json()["status"] == "escalate"


def test_ai_chat_retrieves_family_stigma_content() -> None:
    response = client.post("/ai/chat", json={"message": "my family will be so ashamed if they find out", "risk_clear": True})
    body = response.json()
    assert response.status_code == 200
    assert body["intent"] == "family_stigma"
    assert body["sources"][0]["id"] == "family-stigma"


def test_ai_chat_retrieves_exam_pressure_content() -> None:
    response = client.post("/ai/chat", json={"message": "I have a big exam and cannot sleep from the pressure", "risk_clear": True})
    body = response.json()
    assert response.status_code == 200
    assert body["intent"] == "exam_pressure"
    assert body["sources"][0]["id"] == "exam-work-pressure"


def test_ai_chat_still_escalates_with_history_and_context_supplied() -> None:
    """The safety gate must run before any of the new personalization fields matter."""
    response = client.post("/ai/chat", json={
        "message": "I want to end my life",
        "risk_clear": True,
        "history": [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}],
        "screening_context": {"band": "low", "themes": []},
        "mood_checkins": [4, 4, 5],
    })
    assert response.status_code == 200
    assert response.json()["status"] == "escalate"


def test_is_urdu_script_detects_urdu_and_rejects_english() -> None:
    assert is_urdu_script("یہ ایک اردو جملہ ہے جو مکمل طور پر اردو میں لکھا گیا ہے۔") is True
    assert is_urdu_script("This is a plain English sentence with no Urdu at all.") is False
    assert is_urdu_script("MindHx AI آپ کی مدد کے لیے یہاں ہے اور آپ کی بات غور سے سنتا ہے۔") is True


def test_compose_chat_reply_rejects_english_output_when_urdu_requested(monkeypatch) -> None:
    """Defense in depth: an LLM that ignores the "reply in Urdu" system-prompt
    instruction must never surface an English reply to an Urdu-selected user -
    compose_chat_reply should discard it so the caller falls back to the
    guaranteed-correct Urdu template instead."""
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {"choices": [{"message": {"content": (
                '{"action": "respond", "message": "This is an English reply even though Urdu was requested.", '
                '"offer_exercise": null, "suggested_cta": null}'
            )}}]}

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self) -> "FakeAsyncClient":
            return self

        async def __aexit__(self, *args) -> bool:
            return False

        async def post(self, *args, **kwargs) -> FakeResponse:
            return FakeResponse()

    monkeypatch.setattr(httpx, "AsyncClient", FakeAsyncClient)

    result = asyncio.run(compose_chat_reply(
        message="مجھے بہت بےچینی محسوس ہو رہی ہے",
        language="ur",
        history=[],
        documents=[RAG_DOCUMENTS[0]],
        screening_context=None,
        trajectory_summary=None,
        mood_checkins=[],
        helpful_practices=[],
    ))

    assert result is None


def test_analyze_text_llm_cannot_suppress_a_heuristic_crisis_flag(monkeypatch) -> None:
    """Defense in depth: /analyze-text merges the deterministic keyword check's
    result with the LLM classifier's, spreading the LLM's fields on top. If the
    LLM disagrees and returns crisis_language: false for text the keyword
    check already flagged as crisis, that must never silently overwrite the
    heuristic's true - crisis_language gates real safety behavior (routing to
    /emergency, /risk-assess's crisis band, /ai/chat's escalation gate)."""
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {"choices": [{"message": {"content": (
                '{"sentiment": "negative", "keyword_flags": [], "crisis_language": false, '
                '"anxiety_level": 0.5, "stress_level": 0.5, "depression_indicator": 0.5}'
            )}}]}

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self) -> "FakeAsyncClient":
            return self

        async def __aexit__(self, *args) -> bool:
            return False

        async def post(self, *args, **kwargs) -> FakeResponse:
            return FakeResponse()

    monkeypatch.setattr(httpx, "AsyncClient", FakeAsyncClient)

    response = client.post("/analyze-text", json={"text": "I want to kill myself", "language": "en"})
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "openai"
    assert body["crisis_language"] is True


def test_mood_checkins_and_helpful_practices_require_auth_and_round_trip() -> None:
    unauthenticated = client.post("/mood-checkins", json={"mood": 3})
    assert unauthenticated.status_code == 401

    register_response = client.post("/auth/register", json={"email": "mood-user@example.com", "password": "correct-horse-battery"})
    token = register_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    create_response = client.post("/mood-checkins", json={"mood": 2}, headers=headers)
    assert create_response.status_code == 201
    assert create_response.json()["mood"] == 2

    list_response = client.get("/mood-checkins", headers=headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    practice_response = client.post("/helpful-practices", json={"practice_name": "box breathing"}, headers=headers)
    assert practice_response.status_code == 201
    assert practice_response.json()["practice_name"] == "box breathing"


def test_ai_chat_uses_signed_in_users_trajectory_and_practices() -> None:
    """End-to-end: a signed-in user's saved check-ins/moods/practices feed the chat
    context without erroring, even though no LLM key is configured in tests (so it
    still falls back to the deterministic template response)."""
    register_response = client.post("/auth/register", json={"email": "trajectory-user@example.com", "password": "correct-horse-battery"})
    token = register_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/checkins", json={"risk_score": 0.15, "band": "low", "routing_decision": "no_referral_needed", "themes": []}, headers=headers)
    client.post("/checkins", json={"risk_score": 0.45, "band": "elevated", "routing_decision": "refer", "themes": ["anxiety"]}, headers=headers)
    client.post("/mood-checkins", json={"mood": 4}, headers=headers)
    client.post("/mood-checkins", json={"mood": 2}, headers=headers)
    client.post("/helpful-practices", json={"practice_name": "5-4-3-2-1 grounding"}, headers=headers)

    response = client.post("/ai/chat", json={"message": "I feel anxious again"}, headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "grounded_support"


def test_summarize_trajectory_detects_rising_trend() -> None:
    check_ins = [
        CheckIn(user_id="u", risk_score=0.4, band="elevated", routing_decision="refer", themes=""),
        CheckIn(user_id="u", risk_score=0.15, band="low", routing_decision="no_referral_needed", themes=""),
    ]
    summary = summarize_trajectory(check_ins)
    assert summary is not None
    assert "rising" in summary


def test_summarize_trajectory_needs_at_least_two_check_ins() -> None:
    assert summarize_trajectory([]) is None
    assert summarize_trajectory([CheckIn(user_id="u", risk_score=0.1, band="low", routing_decision="no_referral_needed", themes="")]) is None