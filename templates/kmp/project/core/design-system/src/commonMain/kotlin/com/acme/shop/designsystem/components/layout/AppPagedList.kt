package com.acme.shop.designsystem.components.layout

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import com.acme.shop.designsystem.components.shimmer.AppShimmerListItem
import com.acme.shop.designsystem.theme.AppTheme

private const val PAGED_ITEM_TYPE = "pagedItem"
private const val PAGED_FOOTER_TYPE = "pagedFooter"
private const val PAGED_FOOTER_KEY = "paged-footer"

/**
 * Vertical list with infinite scroll: calls [onLoadMore] once when the user nears the end while
 * [hasMore] is true and nothing is loading, and shows [footer] (a shimmer item by default) while the next page loads.
 * Items always carry a key and a content type (CLAUDE.md §6).
 */
@Composable
fun <T> AppPagedList(
    items: List<T>,
    itemKey: (T) -> Any,
    hasMore: Boolean,
    loadingMore: Boolean,
    onLoadMore: () -> Unit,
    modifier: Modifier = Modifier,
    state: LazyListState = rememberLazyListState(),
    contentPadding: PaddingValues = PaddingValues(AppTheme.adaptive.horizontalPadding),
    footer: @Composable () -> Unit = { AppShimmerListItem() },
    itemContent: @Composable (T) -> Unit,
) {
    val currentOnLoadMore by rememberUpdatedState(onLoadMore)
    val loadMore by remember(items.size, hasMore, loadingMore) {
        derivedStateOf {
            shouldLoadMore(
                lastVisibleIndex = state.layoutInfo.visibleItemsInfo.lastOrNull()?.index,
                itemCount = items.size,
                hasMore = hasMore,
                loadingMore = loadingMore,
            )
        }
    }
    LaunchedEffect(loadMore) {
        if (loadMore) currentOnLoadMore()
    }
    LazyColumn(
        modifier = modifier,
        state = state,
        contentPadding = contentPadding,
        verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12),
    ) {
        items(count = items.size, key = { itemKey(items[it]) }, contentType = { PAGED_ITEM_TYPE }) { index ->
            itemContent(items[index])
        }
        if (loadingMore) {
            item(key = PAGED_FOOTER_KEY, contentType = PAGED_FOOTER_TYPE) { footer() }
        }
    }
}
