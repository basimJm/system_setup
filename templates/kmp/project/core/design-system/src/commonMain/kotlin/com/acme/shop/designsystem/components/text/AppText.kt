package com.acme.shop.designsystem.components.text

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import com.acme.shop.designsystem.theme.AppTheme

/** The only text primitive: style and color come from the theme, never from literals. */
@Composable
fun AppText(
    text: String,
    modifier: Modifier = Modifier,
    style: TextStyle = AppTheme.typography.bodyMedium,
    color: Color = AppTheme.colors.ink,
    textAlign: TextAlign? = null,
    maxLines: Int = Int.MAX_VALUE,
    overflow: TextOverflow = TextOverflow.Ellipsis,
    onTextLayout: ((TextLayoutResult) -> Unit)? = null,
) {
    Text(
        text = text,
        modifier = modifier,
        style = style,
        color = color,
        textAlign = textAlign,
        maxLines = maxLines,
        overflow = overflow,
        onTextLayout = onTextLayout,
    )
}

/** Same primitive for inline-styled text (server rich text, links): styles still come from the theme. */
@Composable
fun AppText(
    text: AnnotatedString,
    modifier: Modifier = Modifier,
    style: TextStyle = AppTheme.typography.bodyMedium,
    color: Color = AppTheme.colors.ink,
    textAlign: TextAlign? = null,
    maxLines: Int = Int.MAX_VALUE,
    overflow: TextOverflow = TextOverflow.Ellipsis,
) {
    Text(text = text, modifier = modifier, style = style, color = color, textAlign = textAlign, maxLines = maxLines, overflow = overflow)
}
