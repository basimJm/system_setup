package com.acme.shop.designsystem.components.glass

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Shape
import com.acme.shop.designsystem.theme.AppTheme
import com.acme.shop.designsystem.theme.GlassStyle

/**
 * Base Liquid Glass container of the design system: a translucent, shining surface with a refractive rim (no elevation
 * shadow: under a see-through body it would show through). It is purely visual: no click, focus, padding or size is added unless
 * passed in, and children keep their own measurement, input and semantics.
 *
 * - The glass is drawn on a background layer the size of the surface, so children are NOT clipped unless
 *   [clipContent] is true (use it for edge-to-edge images inside the shape).
 * - [blurBackdrop] = true blurs the content behind the surface (real backdrop blur, Haze) when the surface is drawn
 *   OVER a glass source ([LocalGlassSource]: bars, overlays) and the platform can blur. Inside the source content
 *   itself, or without blur support, it falls back to the translucent tint — it never pretends to blur.
 * - Colours, alphas, sheen, rim, elevation come from `AppTheme.glass` (light and dark).
 *
 * Usage:
 * ```
 * AppGlassSurface(contentPadding = PaddingValues(AppTheme.spacing.space16)) { AppText("…") }           // card
 * AppGlassSurface(shape = AppTheme.shapes.circle, style = GlassStyle.Prominent) { Icon(…) }              // floating control
 * AppGlassSurface(modifier = Modifier.fillMaxWidth(), style = GlassStyle.Subtle) { AppSearchBarContent() } // field
 * ```
 */
@Composable
fun AppGlassSurface(
    modifier: Modifier = Modifier,
    shape: Shape = AppTheme.shapes.medium,
    style: GlassStyle = GlassStyle.Regular,
    contentPadding: PaddingValues = NoPadding,
    clipContent: Boolean = false,
    blurBackdrop: Boolean = false,
    content: @Composable BoxScope.() -> Unit,
) {
    val glass = if (blurBackdrop) rememberGlass() else rememberContentGlass()
    Box(modifier = modifier, propagateMinConstraints = true) {
        Spacer(Modifier.matchParentSize().clip(shape).glassMaterial(glass, style, shape))
        Box(
            modifier = (if (clipContent) Modifier.clip(shape) else Modifier).padding(contentPadding),
            propagateMinConstraints = true,
            content = content,
        )
    }
}

private val NoPadding = PaddingValues()
