package com.acme.shop.designsystem.components.avatar

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.Dp
import com.acme.shop.designsystem.components.image.AppImage
import com.acme.shop.designsystem.components.text.AppText
import com.acme.shop.designsystem.theme.AppTheme

/** First letter of the first and last word of [name], upper-cased; empty for a blank name. Pure and tested. */
fun initialsOf(name: String, maxLetters: Int = MAX_INITIALS): String =
    name.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }.take(maxLetters)
        .joinToString("") { it.first().uppercase() }

private const val MAX_INITIALS = 2

/** Circular photo with a letter fallback, and an optional availability dot (on duty / on leave). */
@Composable
fun AppAvatar(
    name: String,
    modifier: Modifier = Modifier,
    imageUrl: String? = null,
    size: Dp = AppTheme.sizes.avatar,
    available: Boolean? = null,
) {
    val colors = AppTheme.colors
    Box(modifier = modifier.size(size)) {
        Box(
            modifier = Modifier.size(size).clip(AppTheme.shapes.circle).background(colors.soft),
            contentAlignment = Alignment.Center,
        ) {
            if (imageUrl != null) {
                AppImage(url = imageUrl, modifier = Modifier.size(size))
            } else {
                AppText(text = initialsOf(name), style = AppTheme.typography.titleMedium, color = colors.accent, maxLines = 1)
            }
        }
        if (available != null) {
            Box(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .size(AppTheme.sizes.statusDot)
                    .background(if (available) colors.success else colors.faint, AppTheme.shapes.circle),
            )
        }
    }
}
