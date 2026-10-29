package com.acme.shop.designsystem.components.brand

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.Dp
import com.acme.shop.designsystem.components.text.AppText
import com.acme.shop.designsystem.resources.Res
import com.acme.shop.designsystem.resources.brand_name
import com.acme.shop.designsystem.resources.brand_tagline
import com.acme.shop.designsystem.resources.ic_app_logo_light
import com.acme.shop.designsystem.theme.AppTheme
import com.acme.shop.designsystem.utils.softShadow
import org.jetbrains.compose.resources.painterResource
import org.jetbrains.compose.resources.stringResource

/** The app icon as the design draws it: a rounded square (radius = 1/4 of the size) with a violet glow. */
@Composable
fun AppLogo(modifier: Modifier = Modifier, size: Dp = AppTheme.sizes.logo, shadow: Boolean = true) {
    val shape = androidx.compose.foundation.shape.RoundedCornerShape(size / LOGO_RADIUS_RATIO)
    val glow = AppTheme.colors.gradientStart.copy(alpha = AppTheme.elevation.logoShadowAlpha)
    val shadowModifier = if (shadow) Modifier.softShadow(AppTheme.elevation.overlay, glow, shape) else Modifier
    Image(
        painter = painterResource(Res.drawable.ic_app_logo_light),
        contentDescription = stringResource(Res.string.brand_name),
        contentScale = ContentScale.Crop,
        modifier = modifier.size(size).then(shadowModifier).clip(shape),
    )
}

/** Logo + "" serif wordmark + letter-spaced tagline (login, nickname, system screens). */
@Composable
fun AppBrandHeader(modifier: Modifier = Modifier, size: Dp = AppTheme.sizes.logo, tagline: Boolean = true) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space6),
    ) {
        AppLogo(size = size)
        Spacer(Modifier.height(AppTheme.spacing.space6))
        AppText(
            text = stringResource(Res.string.brand_name),
            style = AppTheme.typography.wordmark,
        )
        if (tagline) {
            AppText(
                text = stringResource(Res.string.brand_tagline),
                style = AppTheme.typography.tagline,
                color = AppTheme.colors.gradientEnd,
            )
        }
    }
}

private const val LOGO_RADIUS_RATIO = 4
