package com.acme.shop.core.common

expect fun logEvent(name: String, params: Map<String, Any>)
expect fun logScreen(screenName: String)
expect fun logCrash(throwable: Throwable)
expect fun setUserId(userId: String?)
interface FeatureFlags {
    fun isEnabled(key: String): Boolean;
    fun isEnabledFlow(key: String): kotlinx.coroutines.flow.Flow<Boolean>;
    suspend fun refresh()
}

object FeatureFlagKeys {
    const val FEATURE_A = "feature_a";
    const val FEATURE_B = "feature_b";
    fun defaultValueForMissingKey(key: String): Boolean = false
}

class InMemoryFeatureFlags(private val flags: Map<String, Boolean> = emptyMap()) : FeatureFlags {
    override fun isEnabled(key: String): Boolean =
        flags[key] ?: FeatureFlagKeys.defaultValueForMissingKey(key);

    override fun isEnabledFlow(key: String): kotlinx.coroutines.flow.Flow<Boolean> =
        kotlinx.coroutines.flow.flowOf(isEnabled(key));

    override suspend fun refresh() {}
}
