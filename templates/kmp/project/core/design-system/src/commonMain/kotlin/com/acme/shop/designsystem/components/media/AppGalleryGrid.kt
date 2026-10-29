package com.acme.shop.designsystem.components.media

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import com.acme.shop.designsystem.components.image.AppImage
import com.acme.shop.designsystem.icons.AppIcons
import com.acme.shop.designsystem.resources.Res
import com.acme.shop.designsystem.resources.media_video
import com.acme.shop.designsystem.theme.AppTheme
import org.jetbrains.compose.resources.stringResource

private const val SQUARE = 1f
private const val TILE_TYPE = "mediaTile"

/** Instagram-style square grid of the items portfolio (item 11); video tiles show a play badge; tap opens . */
@Composable
fun AppGalleryGrid(
    items: List<MediaItemUi>,
    onOpen: (index: Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val gap = AppTheme.spacing.space2
    LazyVerticalGrid(
        columns = GridCells.Fixed(AppTheme.adaptive.galleryColumns),
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(gap),
        verticalArrangement = Arrangement.spacedBy(gap),
    ) {
        items(count = items.size, key = { items[it].id }, contentType = { TILE_TYPE }) { index ->
            AppMediaTile(item = items[index], onClick = { onOpen(index) })
        }
    }
}

/** One square tile; reused by the service and team sheets for their media rows. */
@Composable
fun AppMediaTile(
    item: MediaItemUi,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val videoLabel = stringResource(Res.string.media_video)
    Box(
        modifier = modifier
            .aspectRatio(SQUARE)
            .clip(AppTheme.shapes.small)
            .clickable(role = Role.Button, onClick = onClick),
    ) {
        AppImage(url = item.tileUrl, modifier = Modifier.fillMaxSize())
        if (item.kind == MediaKind.Video) {
            Box(
                modifier = Modifier
                    .align(Alignment.Center)
                    .size(AppTheme.sizes.dialogIcon)
                    .background(AppTheme.colors.scrim, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = AppIcons.Play,
                    contentDescription = videoLabel,
                    tint = AppTheme.colors.onMedia,
                    modifier = Modifier.padding(AppTheme.spacing.space8).fillMaxSize(),
                )
            }
        }
    }
}
