package com.acme.shop.designsystem.components.pager

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import com.acme.shop.designsystem.resources.Res
import com.acme.shop.designsystem.resources.page_description
import com.acme.shop.designsystem.theme.AppTheme
import org.jetbrains.compose.resources.stringResource

/** Pager dots (banners, onboarding): the selected dot stretches into a pill, as in the design prototype. */
@Composable
fun AppPageIndicator(count: Int, selected: Int, modifier: Modifier = Modifier) {
    val colors = AppTheme.colors
    val sizes = AppTheme.sizes
    val description = stringResource(Res.string.page_description, selected + 1, count)
    Row(
        modifier = modifier.semantics { contentDescription = description },
        horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space6),
    ) {
        repeat(count) { index ->
            val active = index == selected
            androidx.compose.foundation.layout.Box(
                Modifier
                    .animateContentSize()
                    .height(sizes.statusDot)
                    .width(if (active) sizes.pageIndicatorActive else sizes.statusDot)
                    .background(if (active) colors.accent else colors.line, AppTheme.shapes.pill),
            )
        }
    }
}
