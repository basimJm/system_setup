package com.acme.shop.designsystem.components.navigation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.movableContentOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import com.acme.shop.designsystem.components.badge.AppCountBadge
import com.acme.shop.designsystem.components.glass.LocalFloatingBarPadding
import com.acme.shop.designsystem.components.glass.LocalGlassSource
import com.acme.shop.designsystem.components.glass.glassBackground
import com.acme.shop.designsystem.components.glass.glassClickable
import com.acme.shop.designsystem.components.glass.glassPressScale
import com.acme.shop.designsystem.components.glass.glassSource
import com.acme.shop.designsystem.components.glass.liquidGlass
import com.acme.shop.designsystem.components.glass.rememberGlass
import com.acme.shop.designsystem.components.glass.rememberGlassPress
import com.acme.shop.designsystem.components.glass.rememberGlassSource
import com.acme.shop.designsystem.components.text.AppText
import com.acme.shop.designsystem.theme.AppTheme
import com.acme.shop.designsystem.theme.GlassStyle
import com.acme.shop.designsystem.theme.NavigationStyle
import dev.chrisbanes.haze.HazeState

/** A top-level destination. [id] is any stable key owned by the app (route name); the design system never imports routes. */
@Immutable
data class AppNavItem(
    val id: String,
    val label: String,
    val icon: ImageVector,
    val badgeCount: Int = 0,
)

@Composable
private fun NavItemContent(item: AppNavItem, selected: Boolean, modifier: Modifier = Modifier) {
    val colors = AppTheme.colors
    val tint = if (selected) colors.accent else colors.faint
    val weight = if (selected) FontWeight.Bold else FontWeight.Medium
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space2, Alignment.CenterVertically),
    ) {
        Box {
            Icon(item.icon, contentDescription = null, tint = tint, modifier = Modifier.size(AppTheme.sizes.tabIcon))
            AppCountBadge(item.badgeCount, Modifier.align(Alignment.TopEnd))
        }
        AppText(text = item.label, style = AppTheme.typography.labelSmall.copy(fontWeight = weight), color = tint, maxLines = 1)
    }
}

/** Floating glass tab bar for compact portrait windows (Home, saved items, orders, Profile): an inset pill over the content. */
@Composable
fun AppBottomBar(
    items: List<AppNavItem>,
    selectedId: String,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val glassTokens = AppTheme.glass
    Row(
        modifier = modifier
            .fillMaxWidth()
            .windowInsetsPadding(WindowInsets.navigationBars)
            .padding(start = glassTokens.tabBarInset, end = glassTokens.tabBarInset, bottom = glassTokens.tabBarBottomGap)
            .liquidGlass(rememberGlass(), glassTokens.tabBarShape)
            .padding(horizontal = AppTheme.spacing.space6, vertical = AppTheme.spacing.space8),
    ) {
        items.forEach { item ->
            val selected = item.id == selectedId
            val press = rememberGlassPress()
            NavItemContent(
                item = item,
                selected = selected,
                modifier = Modifier
                    .weight(1f)
                    .glassPressScale(press)
                    .size(width = AppTheme.sizes.touchTarget, height = AppTheme.sizes.bottomBarHeight)
                    .then(if (selected) Modifier.glassBackground(glassTokens, glassTokens.tabBarShape, GlassStyle.Prominent) else Modifier)
                    .semantics { this.selected = selected }
                    .glassClickable(press, role = Role.Tab) { onSelect(item.id) },
            )
        }
    }
}

/** Floating glass rail for landscape and larger windows: an inset capsule with a glass lens on the selected item. */
@Composable
fun AppNavigationRail(
    items: List<AppNavItem>,
    selectedId: String,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val glassTokens = AppTheme.glass
    Column(
        modifier = modifier
            .fillMaxHeight()
            .windowInsetsPadding(WindowInsets.systemBars)
            .padding(start = glassTokens.tabBarBottomGap, top = glassTokens.tabBarBottomGap, bottom = glassTokens.tabBarBottomGap)
            .width(AppTheme.sizes.railWidth)
            .liquidGlass(rememberGlass(), glassTokens.tabBarShape)
            .padding(vertical = AppTheme.spacing.space12, horizontal = AppTheme.spacing.space6),
        verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        items.forEach { item ->
            val selected = item.id == selectedId
            val press = rememberGlassPress()
            NavItemContent(
                item = item,
                selected = selected,
                modifier = Modifier
                    .fillMaxWidth()
                    .glassPressScale(press)
                    .height(AppTheme.sizes.bottomBarHeight)
                    .then(if (selected) Modifier.glassBackground(glassTokens, glassTokens.tabBarShape, GlassStyle.Prominent) else Modifier)
                    .semantics { this.selected = selected }
                    .glassClickable(press, role = Role.Tab) { onSelect(item.id) },
            )
        }
    }
}

/** Chooses bottom bar or rail from the window, so every screen adapts the same way in portrait and landscape. */
@Composable
fun AppNavScaffold(
    items: List<AppNavItem>,
    selectedId: String,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
    navigationVisible: Boolean = true,
    content: @Composable () -> Unit,
) {
    // One content instance moves between the two layouts, so its state survives a rotation.
    val body = remember(content) { movableContentOf { content() } }
    if (!navigationVisible) {
        Box(modifier.fillMaxSize()) { body() }
        return
    }
    val source = rememberGlassSource()
    when (AppTheme.adaptive.navigation) {
        NavigationStyle.BottomBar -> FloatingBarLayout(source, body, modifier) { barModifier ->
            AppBottomBar(items, selectedId, onSelect, barModifier)
        }
        NavigationStyle.Rail -> Row(modifier.fillMaxSize()) {
            CompositionLocalProvider(LocalGlassSource provides source) { AppNavigationRail(items, selectedId, onSelect) }
            Box(Modifier.weight(1f).glassSource(source)) { body() }
        }
    }
}

/**
 * Content fills the window and is the glass backdrop; the bar floats over its bottom edge. The bar's height (with its
 * insets and gap) is published as [LocalFloatingBarPadding] so screens keep their last items reachable. the
 * height is computed from the same tokens the bar is built from ([floatingBarHeight]) instead of measured after the
 * first frame, which re-composed the whole navigation host (a static local) one frame after every start.
 */
@Composable
private fun FloatingBarLayout(
    source: HazeState,
    body: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    bar: @Composable (Modifier) -> Unit,
) {
    val barHeight = floatingBarHeight(
        itemHeight = AppTheme.sizes.bottomBarHeight,
        verticalPadding = AppTheme.spacing.space8,
        bottomGap = AppTheme.glass.tabBarBottomGap,
        navigationBarInset = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding(),
    )
    Box(modifier.fillMaxSize()) {
        CompositionLocalProvider(LocalFloatingBarPadding provides barHeight) {
            Box(Modifier.fillMaxSize().glassSource(source).consumeWindowInsets(WindowInsets.navigationBars)) { body() }
        }
        CompositionLocalProvider(LocalGlassSource provides source) {
            bar(Modifier.align(Alignment.BottomCenter))
        }
    }
}

/** Height [AppBottomBar] takes over the content: item row + its vertical padding, the gap and the navigation bar. */
internal fun floatingBarHeight(itemHeight: Dp, verticalPadding: Dp, bottomGap: Dp, navigationBarInset: Dp): Dp =
    itemHeight + verticalPadding + verticalPadding + bottomGap + navigationBarInset
