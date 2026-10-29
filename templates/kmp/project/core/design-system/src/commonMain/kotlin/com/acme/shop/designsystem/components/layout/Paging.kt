package com.acme.shop.designsystem.components.layout

/** Infinite-scroll defaults: ask for the next page this many items before the end. */
object PagingUiDefaults {
    const val PREFETCH_ITEMS = 3
}

/**
 * Whether the list should request its next page now. Pure so it is unit-tested:
 * only when there is a next page, nothing is loading, and the last visible item is within [prefetch] of the end.
 */
fun shouldLoadMore(
    lastVisibleIndex: Int?,
    itemCount: Int,
    hasMore: Boolean,
    loadingMore: Boolean,
    prefetch: Int = PagingUiDefaults.PREFETCH_ITEMS,
): Boolean {
    if (!hasMore || loadingMore) return false
    if (itemCount == 0 || lastVisibleIndex == null) return false
    return lastVisibleIndex >= itemCount - 1 - prefetch
}
