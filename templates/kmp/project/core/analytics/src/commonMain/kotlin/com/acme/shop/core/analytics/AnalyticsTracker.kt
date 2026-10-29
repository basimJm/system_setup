package com.acme.shop.core.analytics

/**
 * What screens and ViewModels call. Fire-and-forget: never suspends, never throws, never blocks the UI.
 * The app registers one implementation in Koin; features only depend on this interface.
 */
interface AnalyticsTracker {
    fun trackScreen(screen: AnalyticsScreen)
    fun trackAction(action: AnalyticsAction)

    /**
     * The navigation host reports every destination change. The tracker derives the screen
     * name from the route, attaches it to the following actions and sends a `screen_view` unless the screen itself
     * reports a richer one (with ids) right away through [trackScreen].
     */
    fun trackRoute(route: String?)

    /** Set on login, cleared (`null`) on logout. */
    fun setUserId(userId: String?)
    fun setUserProperty(key: String, value: String?)
}

/**
 * The vendor port. Firebase implements it per platform; tests use [RecordingAnalyticsBackend].
 * Receives events that already passed validation and carry the common context parameters.
 */
interface AnalyticsBackend {
    suspend fun logEvent(event: AnalyticsEvent)
    suspend fun setUserId(userId: String?)
    suspend fun setUserProperty(key: String, value: String?)
}

/** Default for previews, tests and the composition local before the app wires a real tracker. */
object NoOpAnalyticsTracker : AnalyticsTracker {
    override fun trackScreen(screen: AnalyticsScreen) = Unit
    override fun trackAction(action: AnalyticsAction) = Unit
    override fun trackRoute(route: String?) = Unit
    override fun setUserId(userId: String?) = Unit
    override fun setUserProperty(key: String, value: String?) = Unit
}

object NoOpAnalyticsBackend : AnalyticsBackend {
    override suspend fun logEvent(event: AnalyticsEvent) = Unit
    override suspend fun setUserId(userId: String?) = Unit
    override suspend fun setUserProperty(key: String, value: String?) = Unit
}

/** Keeps everything it receives; the test double for the tracker and for feature tests. */
class RecordingAnalyticsBackend : AnalyticsBackend {
    private val recorded = mutableListOf<AnalyticsEvent>()
    private val properties = LinkedHashMap<String, String?>()

    val events: List<AnalyticsEvent> get() = recorded.toList()
    val userProperties: Map<String, String?> get() = properties.toMap()
    var userId: String? = null
        private set

    override suspend fun logEvent(event: AnalyticsEvent) {
        recorded += event
    }

    override suspend fun setUserId(userId: String?) {
        this.userId = userId
    }

    override suspend fun setUserProperty(key: String, value: String?) {
        properties[key] = value
    }

    fun clear() {
        recorded.clear()
        properties.clear()
        userId = null
    }
}

/** Fans out to several backends (e.g. Firebase plus a debug logger in dev builds). */
class CompositeAnalyticsBackend(private val backends: List<AnalyticsBackend>) : AnalyticsBackend {
    override suspend fun logEvent(event: AnalyticsEvent) = backends.forEach { it.logEvent(event) }
    override suspend fun setUserId(userId: String?) = backends.forEach { it.setUserId(userId) }
    override suspend fun setUserProperty(key: String, value: String?) =
        backends.forEach { it.setUserProperty(key, value) }
}
