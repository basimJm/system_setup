package com.acme.shop.designsystem.components.layout

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.displayCutout
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyGridState
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import com.acme.shop.designsystem.components.glass.LocalFloatingBarPadding
import com.acme.shop.designsystem.components.glass.glassBackdrop
import com.acme.shop.designsystem.components.glass.LocalGlassSource
import com.acme.shop.designsystem.components.glass.glassSource
import com.acme.shop.designsystem.components.glass.liquidGlass
import com.acme.shop.designsystem.components.glass.rememberGlass
import com.acme.shop.designsystem.components.glass.rememberGlassSource
import com.acme.shop.designsystem.components.shimmer.AppShimmerListItem
import com.acme.shop.designsystem.theme.AppTheme

/**
 * Screen scaffold: background, side insets (display cutout in landscape), and the content column limited to the
 * adaptive max width and centered, so one layout serves phones, landscape and tablets. The content is the backdrop
 * of the glass bars; everything sits above the floating tab bar ([LocalFloatingBarPadding]). With
 * [scrollsUnderTabBar] the content runs under the floating glass tab bar; the screen pads its scroll content's end
 * by [tabBarInset]. With [contentUnderBars] the content fills the screen and scrolls under the glass bars: the bar heights then arrive in
 * the [PaddingValues] (top/bottom), which the screen must apply as its list content padding.
 */
@Composable
fun AppScreen(
    modifier: Modifier = Modifier,
    topBar: (@Composable () -> Unit)? = null,
    bottomBar: (@Composable () -> Unit)? = null,
    maxContentWidth: Dp = AppTheme.adaptive.contentMaxWidth,
    handleIme: Boolean = true,
    contentUnderBars: Boolean = false,
    scrollsUnderTabBar: Boolean = false,
    content: @Composable (PaddingValues) -> Unit,
) {
    val imeModifier = if (handleIme) Modifier.imePadding() else Modifier
    // only content that scrolls UNDER this screen's own bars is a backdrop worth recording. In the column
    // layout the bars sit beside the content and the floating tab bar blurs the scaffold's backdrop, so a second
    // backdrop here re-recorded the whole screen on every frame for nothing. Bars in the column layout use the tint.
    val source = if (contentUnderBars) rememberGlassSource() else null
    val rootModifier = modifier
        .fillMaxSize()
        .glassBackdrop(AppTheme.colors.background, AppTheme.glass)
        .padding(bottom = if (scrollsUnderTabBar) Dp.Hairline else LocalFloatingBarPadding.current)
        .windowInsetsPadding(WindowInsets.displayCutout)
        .then(imeModifier)
    val body: @Composable (PaddingValues) -> Unit = { padding ->
        Box(modifier = Modifier.fillMaxSize().glassSource(source), contentAlignment = Alignment.TopCenter) {
            Box(Modifier.widthIn(max = maxContentWidth).fillMaxSize()) { content(padding) }
        }
    }
    CompositionLocalProvider(LocalGlassSource provides source) {
        if (contentUnderBars) {
            OverlaidBars(topBar, bottomBar, body, rootModifier)
        } else {
            Column(modifier = rootModifier) {
                topBar?.invoke()
                Box(Modifier.weight(1f).fillMaxWidth()) {
                    body(PaddingValues(horizontal = AppTheme.adaptive.horizontalPadding))
                }
                bottomBar?.invoke()
            }
        }
    }
}

/** Bottom space a screen built with `scrollsUnderTabBar = true` adds after its last scrollable item. */
@Composable
fun tabBarInset(): Dp = LocalFloatingBarPadding.current

/** Bars drawn over the content; their measured heights become the content's top/bottom padding. */
@Composable
private fun OverlaidBars(
    topBar: (@Composable () -> Unit)?,
    bottomBar: (@Composable () -> Unit)?,
    body: @Composable (PaddingValues) -> Unit,
    modifier: Modifier = Modifier,
) {
    val density = LocalDensity.current
    var topHeight by remember { mutableStateOf(Dp.Hairline) }
    var bottomHeight by remember { mutableStateOf(Dp.Hairline) }
    Box(modifier) {
        val side = AppTheme.adaptive.horizontalPadding
        body(PaddingValues(start = side, end = side, top = topHeight, bottom = bottomHeight))
        Box(Modifier.align(Alignment.TopCenter).onSizeChanged { topHeight = with(density) { it.height.toDp() } }) {
            topBar?.invoke()
        }
        Box(Modifier.align(Alignment.BottomCenter).onSizeChanged { bottomHeight = with(density) { it.height.toDp() } }) {
            bottomBar?.invoke()
        }
    }
}

/** Pull-to-refresh container for every data screen except forms. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppPullToRefresh(
    refreshing: Boolean,
    onRefresh: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    PullToRefreshBox(isRefreshing = refreshing, onRefresh = onRefresh, modifier = modifier) { content() }
}

/**
 * Grid whose column count follows the window (1 on phones in portrait, more in landscape and on tablets).
 * With [onLoadMore] it also pages like [AppPagedList]: next page near the end, a full-width [footer] while loading.
 */
@Composable
fun AppAdaptiveGrid(
    itemCount: Int,
    itemKey: (Int) -> Any,
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(AppTheme.adaptive.horizontalPadding),
    state: LazyGridState = rememberLazyGridState(),
    hasMore: Boolean = false,
    loadingMore: Boolean = false,
    onLoadMore: () -> Unit = {},
    footer: @Composable () -> Unit = { AppShimmerListItem() },
    itemContent: @Composable (Int) -> Unit,
) {
    val gap = AppTheme.spacing.space12
    val currentOnLoadMore by rememberUpdatedState(onLoadMore)
    val loadMore by remember(itemCount, hasMore, loadingMore) {
        derivedStateOf {
            shouldLoadMore(
                lastVisibleIndex = state.layoutInfo.visibleItemsInfo.lastOrNull()?.index,
                itemCount = itemCount,
                hasMore = hasMore,
                loadingMore = loadingMore,
            )
        }
    }
    LaunchedEffect(loadMore) {
        if (loadMore) currentOnLoadMore()
    }
    LazyVerticalGrid(
        columns = GridCells.Fixed(AppTheme.adaptive.gridColumns),
        modifier = modifier,
        state = state,
        contentPadding = contentPadding,
        horizontalArrangement = Arrangement.spacedBy(gap),
        verticalArrangement = Arrangement.spacedBy(gap),
    ) {
        items(count = itemCount, key = itemKey, contentType = { GRID_ITEM_TYPE }) { index -> itemContent(index) }
        if (loadingMore) {
            item(key = GRID_FOOTER_KEY, contentType = GRID_FOOTER_TYPE, span = { GridItemSpan(maxLineSpan) }) { footer() }
        }
    }
}

private const val GRID_ITEM_TYPE = "gridItem"
private const val GRID_FOOTER_TYPE = "gridFooter"
private const val GRID_FOOTER_KEY = "grid-footer"

/** Sticky bottom action area (Book now, Cancel orders, Continue): content above the system navigation bar. */
@Composable
fun AppStickyActionBar(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .liquidGlass(rememberGlass(), RectangleShape, elevated = false, rim = false)
            .windowInsetsPadding(WindowInsets.navigationBars)
            .padding(horizontal = AppTheme.adaptive.horizontalPadding, vertical = AppTheme.spacing.space12),
    ) {
        content()
    }
}
