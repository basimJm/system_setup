package com.acme.shop.designsystem.components.glass

import androidx.compose.foundation.background
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.ui.unit.Dp
import com.acme.shop.designsystem.theme.AppTheme
import com.acme.shop.designsystem.theme.GlassStyle
import com.acme.shop.designsystem.theme.GlassTokens
import dev.chrisbanes.haze.ExperimentalHazeApi
import dev.chrisbanes.haze.HazeInputScale
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.HazeStyle
import dev.chrisbanes.haze.HazeTint
import dev.chrisbanes.haze.hazeEffect
import dev.chrisbanes.haze.hazeSource
import dev.chrisbanes.haze.rememberHazeState

/** How a glass surface is drawn: backdrop blur, the opaque-enough chrome tint, or see-through content glass. */
enum class GlassMode { Blur, TintOnly, Content }

/**
 * Fallback decision: blur only when there is content to blur ([hasSource]), the platform can blur
 * ([blurSupported]: Android 12+ and iOS; Haze reports it) and we are not rendering a preview.
 */
fun glassModeOf(hasSource: Boolean, blurSupported: Boolean, inPreview: Boolean): GlassMode =
    if (hasSource && blurSupported && !inPreview) GlassMode.Blur else GlassMode.TintOnly

/** The backdrop that glass chrome blurs. Provided by [com.acme.shop.designsystem.components.layout.AppScreen]
 *  and the app-level [com.acme.shop.designsystem.components.navigation.AppNavScaffold]. */
val LocalGlassSource = staticCompositionLocalOf<HazeState?> { null }

/** Everything a glass surface needs, resolved once in composition (see [rememberGlass]). */
@Stable
class GlassSpec(val tokens: GlassTokens, val source: HazeState?, val mode: GlassMode)

/** Remembers a new backdrop source for a container whose content should show through its glass chrome. */
@Composable
fun rememberGlassSource(): HazeState = rememberHazeState()

/** Space a floating bar (the glass tab bar) takes over the bottom of the content; screens pad by it. */
val LocalFloatingBarPadding = staticCompositionLocalOf { Dp.Hairline }

/** Glass settings for the current theme and backdrop. */
@Composable
fun rememberGlass(source: HazeState? = LocalGlassSource.current): GlassSpec {
    val tokens = AppTheme.glass
    val inPreview = LocalInspectionMode.current
    val blurSupported = source?.blurEnabled ?: false
    return remember(tokens, source, inPreview, blurSupported) {
        GlassSpec(tokens, source, glassModeOf(source != null, blurSupported, inPreview))
    }
}

/** Marks this content as the backdrop blurred by glass chrome drawn over it. */
fun Modifier.glassSource(state: HazeState?): Modifier = if (state == null) this else hazeSource(state)

/**
 * Liquid Glass on a modifier chain (bars, sheets, controls): optional soft shadow, then [glassMaterial] clipped to
 * [shape] (this clips the element's own content too; [rim] = false for edge-to-edge chrome such as the top bar; use
 * [AppGlassSurface] for containers whose children must not be
 * clipped). [elevated] = false for edge-to-edge chrome (top bar, sheet) and flat controls.
 */
fun Modifier.liquidGlass(
    glass: GlassSpec,
    shape: Shape,
    elevated: Boolean = true,
    style: GlassStyle = GlassStyle.Regular,
    rim: Boolean = true,
): Modifier {
    val t = glass.tokens
    val shadowed = if (elevated) glassShadow(t, t.shadowElevation, shape) else this
    return shadowed.clip(shape).glassMaterial(glass, style, shape, rim)
}

/** Soft outer shadow of a glass shape; nothing when [elevation] is zero. */
internal fun Modifier.glassShadow(t: GlassTokens, elevation: Dp, shape: Shape): Modifier {
    if (elevation == Dp.Hairline) return this
    val shadowColor = t.shadow.copy(alpha = t.shadowAlpha)
    return shadow(elevation, shape, clip = false, ambientColor = shadowColor, spotColor = shadowColor)
}

/**
 * The glass body, drawn on an already clipped layer: real backdrop blur ([GlassMode.Blur], Haze; Android 12+ and iOS)
 * or, without a backdrop, a translucent gradient ([GlassMode.Content]) / the near-opaque chrome tint
 * ([GlassMode.TintOnly]). Then the specular sheen and the refractive rim.
 */
@OptIn(ExperimentalHazeApi::class)
internal fun Modifier.glassMaterial(glass: GlassSpec, style: GlassStyle, shape: Shape, rim: Boolean = true): Modifier {
    val t = glass.tokens
    val body = when (glass.mode) {
        GlassMode.Blur -> hazeEffect(
            state = glass.source,
            style = HazeStyle(
                backgroundColor = t.tint,
                tint = HazeTint(t.tintColor),
                blurRadius = t.blurRadius,
                noiseFactor = t.noiseFactor,
                fallbackTint = HazeTint(t.fallbackColor),
            ),
        ) {
            // blur a down-scaled copy of the backdrop (Haze picks the scale per platform) instead of the
            // full-resolution frame on every frame the content scrolls under the bar.
            inputScale = HazeInputScale.Auto
        }
        GlassMode.TintOnly -> background(t.fallbackColor)
        GlassMode.Content -> background(Brush.verticalGradient(listOf(t.fillTop(style), t.fillBottom(style))))
    }
    val shined = body.glassSheen(t, t.sheen(style))
    return if (rim) shined.glassRim(t, shape) else shined
}

/** Glass for cards, buttons, fields and chips inside the content: see-through body, sheen and refractive rim. */
@Composable
fun rememberContentGlass(): GlassSpec {
    val tokens = AppTheme.glass
    return remember(tokens) { GlassSpec(tokens, null, GlassMode.Content) }
}

/** Sheen + rim only, for brand-filled controls (primary buttons, selected chips and tabs). */
fun Modifier.glassHighlight(glass: GlassSpec, shape: Shape): Modifier = glassSheen(glass.tokens).glassRim(glass.tokens, shape)
