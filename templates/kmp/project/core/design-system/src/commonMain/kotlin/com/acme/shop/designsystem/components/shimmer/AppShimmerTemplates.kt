package com.acme.shop.designsystem.components.shimmer

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.acme.shop.designsystem.components.card.AppCard
import com.acme.shop.designsystem.theme.AppTheme

/** Width fractions of the text placeholders so a shimmer reads like the content it stands for. */
private const val TITLE_WIDTH_FRACTION = 0.6f
private const val SUBTITLE_WIDTH_FRACTION = 0.4f
private const val BODY_WIDTH_FRACTION = 0.85f

/** How a card is laid out: full width in lists, fixed compact width in horizontal sections. */
enum class ShimmerCardLayout { Vertical, Horizontal }

/** Placeholder of a media card (image, title, rating line, subtitle line). */
@Composable
fun AppShimmerCard(
    modifier: Modifier = Modifier,
    layout: ShimmerCardLayout = ShimmerCardLayout.Vertical,
) {
    val sizes = AppTheme.sizes
    val spacing = AppTheme.spacing
    val width = if (layout == ShimmerCardLayout.Horizontal) Modifier.width(sizes.cardCompactWidth) else Modifier.fillMaxWidth()
    AppCard(modifier = modifier.then(width), contentPadding = spacing.space12) {
        Column(verticalArrangement = Arrangement.spacedBy(spacing.space8)) {
            AppShimmerBox(Modifier.fillMaxWidth().height(sizes.cardImageHeight), AppTheme.shapes.medium)
            AppShimmerLine(Modifier.fillMaxWidth(TITLE_WIDTH_FRACTION))
            AppShimmerLine(Modifier.fillMaxWidth(SUBTITLE_WIDTH_FRACTION))
            AppShimmerLine(Modifier.fillMaxWidth(BODY_WIDTH_FRACTION))
        }
    }
}

/** Placeholder of a list row with a leading image (review item, notification, team row, service row). */
@Composable
fun AppShimmerListItem(
    modifier: Modifier = Modifier,
    circularImage: Boolean = false,
) {
    val sizes = AppTheme.sizes
    val spacing = AppTheme.spacing
    val imageShape = if (circularImage) CircleShape else AppTheme.shapes.small
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(spacing.space12),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AppShimmerBox(Modifier.size(sizes.listItemImage), imageShape)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(spacing.space8)) {
            AppShimmerLine(Modifier.fillMaxWidth(TITLE_WIDTH_FRACTION))
            AppShimmerLine(Modifier.fillMaxWidth(BODY_WIDTH_FRACTION))
        }
    }
}

/** Placeholder of a home section: title line, then a row of compact cards. */
@Composable
fun AppShimmerSection(
    modifier: Modifier = Modifier,
    cardCount: Int = SHIMMER_SECTION_CARDS,
) {
    val spacing = AppTheme.spacing
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(spacing.space12)) {
        AppShimmerLine(Modifier.fillMaxWidth(SUBTITLE_WIDTH_FRACTION), height = AppTheme.sizes.badgeHeight)
        Row(horizontalArrangement = Arrangement.spacedBy(spacing.space12)) {
            repeat(cardCount) { AppShimmerCard(layout = ShimmerCardLayout.Horizontal) }
        }
    }
}

/** Placeholder of a vertical list while the first page loads. */
@Composable
fun AppShimmerList(
    modifier: Modifier = Modifier,
    itemCount: Int = SHIMMER_LIST_ITEMS,
    circularImage: Boolean = false,
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space16)) {
        repeat(itemCount) { AppShimmerListItem(circularImage = circularImage) }
    }
}

/** Default placeholder counts: enough to fill a phone screen without overdrawing. */
const val SHIMMER_SECTION_CARDS = 3
const val SHIMMER_LIST_ITEMS = 6
