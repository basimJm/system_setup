package com.acme.shop.designsystem

import com.acme.shop.designsystem.components.feedback.AppContentState
import com.acme.shop.designsystem.components.feedback.contentStateOf
import com.acme.shop.designsystem.components.layout.PagingUiDefaults
import com.acme.shop.designsystem.components.layout.shouldLoadMore
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

private const val PAGE = 10

class UniversalStatesTest {

    private fun loadMore(last: Int?, count: Int = PAGE, more: Boolean = true, loading: Boolean = false, prefetch: Int? = null) =
        if (prefetch == null) shouldLoadMore(last, count, more, loading) else shouldLoadMore(last, count, more, loading, prefetch)

    private fun state(loading: Boolean, offline: Boolean, error: String?, empty: Boolean, content: Boolean) =
        contentStateOf(loading, offline, error, empty, content)

    @Test
    fun loadsMoreWhenTheLastVisibleItemIsWithinThePrefetchWindow() {
        val threshold = PAGE - 1 - PagingUiDefaults.PREFETCH_ITEMS
        assertTrue(loadMore(last = threshold))
        assertTrue(loadMore(last = PAGE - 1))
        assertFalse(loadMore(last = threshold - 1))
    }

    @Test
    fun neverLoadsMoreWhileLoadingWithoutMorePagesOrWithoutItems() {
        assertFalse(loadMore(last = PAGE - 1, loading = true))
        assertFalse(loadMore(last = PAGE - 1, more = false))
        assertFalse(loadMore(last = null))
        assertFalse(loadMore(last = 0, count = 0))
    }

    @Test
    fun customPrefetchIsHonoured() {
        assertTrue(loadMore(last = 4, prefetch = 5))
        assertFalse(loadMore(last = 3, prefetch = 5))
    }

    @Test
    fun firstLoadShowsShimmerThenOfflineBeatsErrorBeatsEmpty() {
        assertEquals(AppContentState.Loading, state(loading = true, offline = true, error = "x", empty = true, content = false))
        assertEquals(AppContentState.Offline, state(loading = false, offline = true, error = "x", empty = true, content = false))
        assertEquals(AppContentState.Error("x"), state(loading = false, offline = false, error = "x", empty = true, content = false))
        assertEquals(AppContentState.Empty, state(loading = false, offline = false, error = null, empty = true, content = false))
        assertEquals(AppContentState.Content, state(loading = false, offline = false, error = null, empty = false, content = true))
    }

    @Test
    fun existingContentStaysVisibleDuringRefreshAndErrors() {
        assertEquals(AppContentState.Content, state(loading = true, offline = false, error = null, empty = false, content = true))
        assertEquals(AppContentState.Content, state(loading = false, offline = true, error = null, empty = false, content = true))
        assertEquals(AppContentState.Content, state(loading = false, offline = false, error = "x", empty = false, content = true))
    }
}
