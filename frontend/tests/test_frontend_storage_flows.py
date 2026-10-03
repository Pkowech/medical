import os
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright


FRONTEND_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")
FRONTEND_PWA_URL = os.environ.get("FRONTEND_PWA_URL", "").rstrip("/")


def read_frontend(path: str) -> str:
    return (FRONTEND_ROOT / path).read_text(encoding="utf-8")


def test_local_storage_helpers_cover_round_trip_and_failure_paths():
    helpers = read_frontend("src/lib/core/utils.ts")
    getter = helpers.split("export function getLocalStorageItem", 1)[1].split(
        "export function setLocalStorageItem", 1
    )[0]
    setter = helpers.split("export function setLocalStorageItem", 1)[1].split(
        "export function removeLocalStorageItem", 1
    )[0]
    remover = helpers.split("export function removeLocalStorageItem", 1)[1].split(
        "Format number", 1
    )[0]

    assert "localStorage.getItem(key)" in getter
    assert "JSON.parse(item)" in getter
    assert "typeof window === 'undefined'" in getter
    assert "catch" in getter
    assert "JSON.stringify(value)" in setter
    assert "localStorage.setItem(key" in setter
    assert "console.error" in setter
    assert "localStorage.removeItem(key)" in remover
    assert "console.error" in remover


def test_app_and_learning_progress_stores_persist_only_intended_state():
    app_store = read_frontend("src/core/stores/index.ts")
    course_store = read_frontend("src/features/courses/hooks/useCourseProgressStore.ts")
    unit_store = read_frontend("src/features/courses/hooks/useUnitProgressStore.ts")

    assert "name: 'app-storage'" in app_store
    assert "partialize: state =>" in app_store
    assert "user: state.user" in app_store
    assert "settings: state.settings" in app_store
    assert "theme: state.theme" in app_store
    assert "name: 'course-progress-storage'" in course_store
    assert "name: 'unit-progress-storage'" in unit_store

    for source in (course_store, unit_store):
        assert "version: 1" in source
        assert "migrate: (persistedState: unknown)" in source
        assert "Array.isArray(bookmarks)" in source
        assert "Object.keys(bookmarks" in source
        assert "markLessonComplete" in source
        assert "toggleBookmark" in source
        assert "saveNote" in source


def test_search_history_storage_covers_crud_deduplication_and_limits():
    service = read_frontend("src/features/search/services/searchHistoryService.ts")
    config = read_frontend("src/features/search/config/searchConfig.ts")

    assert "medical_search_history" in service
    assert "localStorage.getItem(this.storageKey)" in service
    assert "localStorage.setItem(this.storageKey" in service
    assert "localStorage.removeItem(this.storageKey)" in service
    assert "item.query.toLowerCase() !== query.toLowerCase()" in service
    assert "history.slice(0, this.maxItems)" in service
    assert "SEARCH_HISTORY_STORAGE_KEY" in config
    assert "MAX_SEARCH_HISTORY_ITEMS: 10" in config
    assert "getRecentSearches" in service
    assert "searchHistory(query: string)" in service


def test_query_cache_round_trip_migrates_legacy_storage_to_indexeddb():
    cache = read_frontend("src/lib/core/queryCachePersistence.ts")
    database = read_frontend("src/lib/core/offline/db.ts")

    assert "initDB()" in cache
    assert "db.get('queryCache', cacheKey)" in cache
    assert "db.put('queryCache', persisted)" in cache
    assert "db.delete('queryCache', cacheKey)" in cache
    assert "window.localStorage.getItem(cacheKey)" in cache
    assert "window.localStorage.removeItem(cacheKey)" in cache
    assert "CACHE_MAX_AGE_MS" in cache
    assert "signal?.aborted" in cache
    assert "query.meta?.persist === true" in cache
    assert "shouldDehydrateMutation: () => false" in cache
    assert "queryCache:" in database


def test_offline_progress_queue_covers_enqueue_read_remove_flush_and_legacy_migration():
    queue = read_frontend(
        "src/features/learning-management/services/offlineProgressSync.ts"
    )
    sync_service = read_frontend("src/lib/core/offline/syncService.ts")

    assert "migrateLegacyQueue" in queue
    assert "initializeOfflineQueue" in queue
    assert "syncService.importQueueItem(progressItem)" in queue
    assert "syncService.addToOutbox(" in queue
    assert "'/progress/sync'" in queue
    assert "'/progress/statements'" in queue
    assert "syncService.getQueueItems()" in queue
    assert "syncService.removeQueueItem(queueId)" in queue
    assert "syncService.syncOutbox()" in queue
    assert "syncQueue:" in read_frontend("src/lib/core/offline/db.ts")
    assert "async addToOutbox(" in sync_service
    assert "async syncOutbox()" in sync_service


def test_offline_replay_only_queues_allowlisted_learning_posts_not_admin_deletes():
    policy = read_frontend("src/lib/core/offline/offlineQueuePolicy.ts")
    api_client = read_frontend("src/features/auth/services/apiClient.ts")
    sync_service = read_frontend("src/lib/core/offline/syncService.ts")
    worker = read_frontend("worker/index.js")

    assert "method?.toUpperCase() !== 'POST'" in policy
    for route in (
        "'/progress/sync'",
        "'/progress/log'",
        "'/progress/statements'",
        "'/learning/progress'",
        "'/quizzes/submit'",
    ):
        assert route in policy
    assert "isOfflineQueueableRequest(" in api_client
    assert "if (isQueueableRequest && isNetworkOrServerTemp)" in api_client
    assert "if (!isOfflineQueueableRequest(item.method, item.url))" in sync_service
    assert "if (item.status === 'failed' && isOfflineQueueableRequest" in sync_service
    assert "if (!isQueueableRequest(item))" in worker
    assert "Please perform it again while online." in worker


def test_admin_user_management_search_pagination_and_inline_delete_are_wired():
    page = read_frontend("src/app/admin/users/page.tsx")
    user_list = read_frontend("src/features/admin/components/UserList.tsx")
    service = read_frontend("src/features/admin/services/adminService.ts")
    backend = read_frontend("../backend/src/modules/admin/services/admin.service.ts")
    controller = read_frontend("../backend/src/modules/admin/controllers/admin.controller.ts")

    assert ".getRoles()" in page
    assert ".getUsers(page, 10, {" in page
    assert "setUsers(currentUsers => currentUsers.filter" in page
    assert "setRefreshVersion(version => version + 1)" in page
    assert "window.location.reload" not in page
    assert "Search name, email, or username" in user_list
    assert "onPageChange(page - 1)" in user_list
    assert "onPageChange(page + 1)" in user_list
    assert "paginationValue ??= record.pagination ?? record.meta" in service
    assert "normalizeAdminUser(user)" in service
    assert "where.OR" in backend
    assert "where.userRoles" in backend
    assert "where.isLocked = false" in backend
    assert "where.isLocked = true" in backend
    assert "@Query('search')" in controller
    assert "@Query('role')" in controller
    assert "@Query('status')" in controller


def test_failed_offline_changes_can_be_cleared_without_retrying_unsafe_requests():
    service = read_frontend("src/lib/core/offline/syncService.ts")
    hook = read_frontend("src/lib/hooks/useConnectivity.ts")
    indicator = read_frontend("src/components/ui/ConnectivityIndicator.tsx")

    assert "retryableFailedChanges" in service
    assert "async discardAllFailedItems()" in service
    assert "if (item.status === 'failed')" in service
    assert "discardAllFailedItems()" in hook
    assert "retryableFailedChanges > 0" in indicator
    assert "Discard all failed offline changes from this device?" in indicator
    assert "Clear failed" in indicator


def test_local_file_metadata_is_saved_on_device_without_uploading_file_details():
    reader = read_frontend("src/features/student/components/LocalMaterialReader.tsx")
    offline_service = read_frontend("src/lib/core/offline/offlineService.ts")
    database = read_frontend("src/lib/core/offline/db.ts")

    assert "crypto.subtle.digest('SHA-256', buffer)" in reader
    assert "offlineService.saveLocalFileMetadata(metadata)" in reader
    assert "localFileMetadata.filename" in reader
    assert "localFileMetadata.mimetype" in reader
    assert "localFileMetadata.size" in reader
    assert "localFileMetadata.hash" in reader
    assert "The file itself is not copied" in reader
    assert "/materials/local/register" not in reader
    assert "/materials/local/progress" not in reader
    assert "async saveLocalFileMetadata(" in offline_service
    assert "async getLocalFileMetadata(" in offline_service
    assert "localFileMetadata:" in database
    assert "const DB_VERSION = 6" in database


def test_production_pwa_build_and_course_recommendations_use_cacheable_fast_path():
    package = read_frontend("package.json")
    next_config = read_frontend("next.config.js")
    dashboard = read_frontend("src/features/courses/components/courses-dashboard.tsx")
    providers = read_frontend("src/app/providers.tsx")
    backend_courses = read_frontend(
        "../backend/src/modules/education/courses/services/courses.service.ts"
    )

    assert "next build --webpack" in package
    assert "urlPattern: ({ request }) => request.mode === 'navigate'" in next_config
    assert "handler: 'NetworkOnly',\n    options: {}," in next_config
    assert "handler: 'CacheFirst'" in next_config
    assert "meta: { persist: Boolean(user?.id) }" in dashboard
    assert "if (!envUrl) return;" in providers
    assert "const aiRecommendations = this.getAiRecommendedCourses(userId, limit);" in backend_courses
    assert "void aiRecommendations.then(async aiCourses =>" in backend_courses
    assert "private async getAiRecommendedCourses(" in backend_courses


def test_recommendation_session_cache_is_invalidated_before_refresh():
    integration = read_frontend(
        "src/features/learning-management/services/quizProgressIntegration.ts"
    )
    invalidation = integration.index("sessionStorage.removeItem(`recommendations-${userId}`)")
    refresh = integration.index("learningPathService.getRecommendedPaths(5)", invalidation)
    persist = integration.index("sessionStorage.setItem(", refresh)

    assert invalidation < refresh < persist
    assert "JSON.stringify(freshRecommendations)" in integration


def test_pwa_caches_only_static_assets_and_public_resources():
    config = read_frontend("next.config.js")
    strategies = config.split("const getPWACacheStrategies = () => [", 1)[1].split(
        "\n];", 1
    )[0]

    assert "urlPattern: /^https?:\\/\\/[^/]+\\/api(?:\\/|$)/i" in strategies
    assert "handler: 'NetworkOnly'" in strategies
    assert "medtrack-static-v1" in strategies
    assert "medtrack-public-assets-v1" in strategies
    assert "handler: 'CacheFirst'" in strategies
    assert "maxEntries: 300" in strategies
    assert "maxEntries: 150" in strategies


def test_user_progress_requests_require_the_stored_user_id():
    store = read_frontend(
        "src/features/learning-management/hooks/useProgressStore.ts"
    )

    assert store.count("localStorage.getItem('userId')") == 2
    assert "if (!userId) throw new Error('User not authenticated')" in store
    assert "syncService.getProgress(userId)" in store
    assert "syncService.saveProgress(progressToSave, lastUpdated)" in store


def test_login_form_exposes_browser_password_manager_autofill_fields():
    login_page = read_frontend("src/app/(auth)/login/page.tsx")

    assert 'autoComplete="on"' in login_page
    assert 'name="identifier"' in login_page
    assert 'autoComplete="username"' in login_page
    assert 'name="password"' in login_page
    assert 'autoComplete="current-password"' in login_page


def test_browser_storage_survives_reload_and_theme_provider_reacts_to_storage_events():
    storage_key = "pwa-storage-flow-e2e"

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page()
        page.add_init_script(
            """if (!sessionStorage.getItem('pwa-theme-seeded')) {
                localStorage.setItem('medtrack-theme', 'dark');
                sessionStorage.setItem('pwa-theme-seeded', 'true');
            }"""
        )
        try:
            page.goto(f"{FRONTEND_URL}/login", wait_until="domcontentloaded")
            page.locator("body").wait_for()
            assert page.locator('form input[name="identifier"]').get_attribute(
                "autocomplete"
            ) == "username"
            assert page.locator('form input[name="password"]').get_attribute(
                "autocomplete"
            ) == "current-password"
            page.wait_for_function(
                "() => document.documentElement.classList.contains('dark')"
            )

            page.evaluate(
                """key => {
                    localStorage.setItem(key, JSON.stringify({ saved: true }));
                    sessionStorage.setItem(key, 'session-value');
                    window.dispatchEvent(new StorageEvent('storage', {
                        key: 'medtrack-theme',
                        oldValue: 'dark',
                        newValue: 'light',
                    }));
                }""",
                storage_key,
            )
            page.wait_for_function(
                "() => !document.documentElement.classList.contains('dark')"
            )
            assert page.evaluate(
                "() => localStorage.getItem('medtrack-theme')"
            ) == "light"

            page.reload(wait_until="domcontentloaded")
            assert page.evaluate(
                "key => JSON.parse(localStorage.getItem(key))",
                storage_key,
            ) == {"saved": True}
            assert page.evaluate(
                "key => sessionStorage.getItem(key)",
                storage_key,
            ) == "session-value"
            page.wait_for_function(
                "() => !document.documentElement.classList.contains('dark')"
            )

            page.evaluate(
                """async key => {
                    const cacheName = 'pwa-storage-flow-e2e';
                    const cache = await caches.open(cacheName);
                    await cache.put('/pwa-storage-flow-e2e', new Response('cached'));

                    const databaseName = 'pwa-storage-flow-e2e';
                    const database = await new Promise((resolve, reject) => {
                        const request = indexedDB.open(databaseName, 1);
                        request.onupgradeneeded = () => request.result.createObjectStore('items');
                        request.onsuccess = () => resolve(request.result);
                        request.onerror = () => reject(request.error);
                    });
                    await new Promise((resolve, reject) => {
                        const transaction = database.transaction('items', 'readwrite');
                        transaction.objectStore('items').put('stored', key);
                        transaction.oncomplete = resolve;
                        transaction.onerror = () => reject(transaction.error);
                    });
                    database.close();
                }""",
                storage_key,
            )
            page.reload(wait_until="domcontentloaded")
            assert page.evaluate(
                """async key => {
                    const response = await (await caches.open('pwa-storage-flow-e2e'))
                        .match('/pwa-storage-flow-e2e');
                    const database = await new Promise((resolve, reject) => {
                        const request = indexedDB.open('pwa-storage-flow-e2e', 1);
                        request.onsuccess = () => resolve(request.result);
                        request.onerror = () => reject(request.error);
                    });
                    const value = await new Promise((resolve, reject) => {
                        const request = database.transaction('items').objectStore('items').get(key);
                        request.onsuccess = () => resolve(request.result);
                        request.onerror = () => reject(request.error);
                    });
                    database.close();
                    return { cache: await response.text(), indexedDb: value };
                }""",
                storage_key,
            ) == {"cache": "cached", "indexedDb": "stored"}
        finally:
            page.evaluate(
                """async key => {
                    localStorage.removeItem(key);
                    sessionStorage.removeItem(key);
                    sessionStorage.removeItem('pwa-theme-seeded');
                    localStorage.removeItem('medtrack-theme');
                    await caches.delete('pwa-storage-flow-e2e');
                    await new Promise(resolve => {
                        const request = indexedDB.deleteDatabase('pwa-storage-flow-e2e');
                        request.onsuccess = resolve;
                        request.onerror = resolve;
                        request.onblocked = resolve;
                    });
                }""",
                storage_key,
            )
            browser.close()


def test_production_service_worker_returns_offline_fallback_for_uncached_navigation():
    if not FRONTEND_PWA_URL:
        pytest.skip("Set FRONTEND_PWA_URL to a production frontend server to test PWA fallback.")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page()
        try:
            page.goto(f"{FRONTEND_PWA_URL}/login", wait_until="domcontentloaded")
            page.wait_for_function(
                "() => navigator.serviceWorker?.controller !== null",
                timeout=20000,
            )
            page.context.set_offline(True)
            page.goto(
                f"{FRONTEND_PWA_URL}/courses",
                wait_until="domcontentloaded",
                timeout=15000,
            )
            assert page.title() == "Offline - MedTrack Hub"
            assert page.get_by_role("heading", name="Page Unavailable").is_visible()
            assert page.locator("#status").inner_text() in {
                "Reconnecting automatically when this page is reachable...",
                "Still unable to reach this page. Retrying automatically...",
            }
            assert page.get_by_text("You are back online!").count() == 0
        finally:
            page.context.set_offline(False)
            browser.close()


def test_offline_fallback_reloads_page_automatically_when_reachable():
    offline_page = read_frontend("public/offline.html")
    reachable = False
    document_requests = 0

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page()

        def respond_to_page_request(route):
            nonlocal document_requests
            request = route.request
            if request.is_navigation_request():
                document_requests += 1
                if document_requests == 1:
                    route.fulfill(body=offline_page, content_type="text/html")
                else:
                    route.fulfill(
                        body="<html><head><title>Recovered page</title></head></html>",
                        content_type="text/html",
                    )
            elif reachable:
                route.fulfill(status=200, body="reachable")
            else:
                route.fulfill(status=503, body="unavailable")

        try:
            page.route("**/courses", respond_to_page_request)
            page.goto("http://pwa.test/courses", wait_until="domcontentloaded")
            page.wait_for_function(
                "() => document.querySelector('#status')?.textContent.includes('Retrying automatically')"
            )
            reachable = True
            page.evaluate("window.dispatchEvent(new Event('online'))")
            page.wait_for_function(
                "() => document.title === 'Recovered page'",
                timeout=10000,
            )
            assert document_requests == 2
        finally:
            browser.close()
