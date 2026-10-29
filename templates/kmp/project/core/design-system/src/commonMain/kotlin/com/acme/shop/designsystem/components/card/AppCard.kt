package com.acme.shop.designsystem.components.card

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import com.acme.shop.designsystem.components.glass.AppGlassSurface
import com.acme.shop.designsystem.components.glass.glassClickable
import com.acme.shop.designsystem.components.glass.glassPressScale
import com.acme.shop.designsystem.components.glass.rememberGlassPress
import com.acme.shop.designsystem.theme.AppTheme

/**
 * Card = [AppGlassSurface] (regular glass, no elevation shadow under see-through glass); clickable with the liquid press
 * when [onClick] is set.
 */
@Composable
fun AppCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    contentPadding: Dp = AppTheme.spacing.space16,
    content: @Composable () -> Unit,
) {
    val shape = AppTheme.shapes.medium
    val press = rememberGlassPress()
    val clickable = if (onClick != null) Modifier.glassClickable(press, onClick = onClick) else Modifier
    AppGlassSurface(
        modifier = modifier
            .glassPressScale(press)
            .then(clickable),
        shape = shape,
        contentPadding = PaddingValues(contentPadding),
    ) {
        content()
    }
}
