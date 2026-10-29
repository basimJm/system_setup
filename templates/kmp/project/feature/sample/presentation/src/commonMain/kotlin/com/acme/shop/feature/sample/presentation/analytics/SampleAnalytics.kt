package com.acme.shop.feature.sample.presentation.analytics

import com.acme.shop.core.analytics.AnalyticsScreen

/** Analytics names of the sample feature (CLAUDE.md §3: snake_case constants, never literals at call sites). */
object SampleAnalytics {
    private const val SCREEN_NAME = "sample"
    const val ACTION_REFRESH = "sample_refresh"
    const val ACTION_ITEM_OPEN = "sample_item_open"
    const val PARAM_ITEM_ID = "item_id"

    val SCREEN = AnalyticsScreen(SCREEN_NAME)
}
