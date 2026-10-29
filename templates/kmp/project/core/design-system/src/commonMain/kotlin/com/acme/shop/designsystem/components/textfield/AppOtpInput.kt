package com.acme.shop.designsystem.components.textfield

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.LayoutDirection
import com.acme.shop.designsystem.components.glass.glassBackground
import com.acme.shop.designsystem.components.text.AppText
import com.acme.shop.designsystem.resources.Res
import com.acme.shop.designsystem.resources.otp_description
import com.acme.shop.designsystem.theme.AppTheme
import org.jetbrains.compose.resources.stringResource

/** Keeps only ASCII digits and at most [length] of them. Pure and tested. */
fun sanitizeOtp(input: String, length: Int): String = input.filter { it in '0'..'9' }.take(length)

/**
 * One-time-code input with [length] boxes (the length comes from the backend, never a constant here).
 * Digits always run left to right, also in Arabic. States: empty, filling, filled and error.
 */
@Composable
fun AppOtpInput(
    value: String,
    onValueChange: (String) -> Unit,
    length: Int,
    modifier: Modifier = Modifier,
    error: Boolean = false,
    enabled: Boolean = true,
) {
    val colors = AppTheme.colors
    val description = stringResource(Res.string.otp_description, value.length, length)
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        BasicTextField(
            value = value,
            onValueChange = { onValueChange(sanitizeOtp(it, length)) },
            modifier = modifier.semantics { contentDescription = description },
            enabled = enabled,
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
            cursorBrush = SolidColor(colors.accent),
            decorationBox = { inner ->
                Box {
                    // The real field stays composed (focus, keyboard, paste) but invisible; the boxes draw its text.
                    Box(Modifier.alpha(0f)) { inner() }
                    Row(horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8)) {
                        repeat(length) { index ->
                            val borderColor = when {
                                error -> colors.danger
                                index == value.length -> colors.accent
                                index < value.length -> colors.gradientStart
                                else -> Color.Transparent
                            }
                            Box(
                                modifier = Modifier
                                    .size(AppTheme.sizes.otpBoxWidth, AppTheme.sizes.otpBoxHeight)
                                    .glassBackground(AppTheme.glass, AppTheme.shapes.medium)
                                    .border(AppTheme.sizes.borderWidth, borderColor, AppTheme.shapes.medium),
                                contentAlignment = Alignment.Center,
                            ) {
                                AppText(text = value.getOrNull(index)?.toString().orEmpty(), style = AppTheme.typography.titleLarge)
                            }
                        }
                    }
                }
            },
        )
    }
}
